-- ============================================================================
-- CAC workflow queue. Staff enqueue runs; the cac-worker Edge Function (service
-- role) claims a run, saves the analysis checkpoint, then completes it. All
-- business side effects of a run commit atomically in cac.complete_job.
-- ============================================================================

create or replace function cac.enqueue_run(p_agent text, p_target uuid, p_input jsonb default '{}', p_dedupe text default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_agent cac.agent;
  v_actor cac.staff;
  v_target jsonb;
  v_input jsonb := '{}';
  v_job cac.job;
  v_key text;
begin
  select * into v_agent from cac.agent where id = p_agent;
  if not found then perform cac.fail('Unknown workflow.'); end if;
  v_actor := cac.require_role(auth.uid(), array[v_agent.role] || case when p_agent = 'proposal' then array['engineer'] else '{}'::text[] end);
  v_target := cac.related(v_agent.kind, p_target);
  if p_input is not null and jsonb_typeof(p_input) = 'object' then
    select coalesce(jsonb_object_agg(key, value), '{}') into v_input from jsonb_each(p_input)
      where key in ('message','survey_id','items','scope','exclusions','terms','previous_id','campaign_id');
  end if;
  if char_length(coalesce(v_input->>'message', '')) > 5000 then perform cac.fail('The customer reply is too long (5,000 characters maximum).'); end if;
  if p_agent = 'outreach' and v_target->>'status' <> 'approved' then perform cac.fail('Approve the prospect before drafting outreach.'); end if;
  if p_agent = 'outreach' and (v_target->>'suppressed')::boolean then perform cac.fail('This prospect has opted out.'); end if;
  if not cac.blank(v_input, 'campaign_id') then perform cac.related('campaign', (v_input->>'campaign_id')::uuid); end if;
  if p_agent = 'followup' and cac.blank(v_input, 'message') then perform cac.fail('Enter the customer reply.'); end if;
  if p_agent = 'proposal' and (cac.blank(v_input, 'survey_id') or jsonb_typeof(v_input->'items') is distinct from 'array') then
    perform cac.fail('Choose a verified survey and rate-card quantities in the quote builder.');
  end if;

  select * into v_job from cac.job where agent = p_agent and target_id = p_target and status in ('queued','running','waiting_approval') limit 1;
  if found then return to_jsonb(v_job); end if;

  v_key := v_actor.user_id::text || ':' || coalesce(nullif(p_dedupe, ''), gen_random_uuid()::text);
  select * into v_job from cac.job where dedupe = v_key;
  if found then return to_jsonb(v_job); end if;

  insert into cac.job (dedupe, agent, target_id, target_kind, input, actor)
    values (v_key, p_agent, p_target, v_agent.kind, v_input || jsonb_build_object('target_version', (v_target->>'record_version')::int), v_actor.user_id)
    returning * into v_job;
  perform cac.log(v_actor.user_id, 'workflow.queued', v_job.id::text, jsonb_build_object('agent', p_agent, 'targetId', p_target));
  return to_jsonb(v_job);
end $$;

create or replace function cac.retry_run(p_job uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_job cac.job; v_actor cac.staff;
begin
  select * into v_job from cac.job where id = p_job for update;
  if not found then perform cac.fail('Run not found.', 'P0404'); end if;
  v_actor := cac.require_role(auth.uid(), array[(select role from cac.agent where id = v_job.agent)] || case when v_job.agent = 'proposal' then array['engineer'] else '{}'::text[] end);
  if v_job.status <> 'failed' or v_job.attempts >= v_job.max_attempts then
    perform cac.fail('Retry limit reached or run is not failed. Start a new run after correcting the issue.');
  end if;
  update cac.job set status = 'queued', available_at = now() where id = p_job returning * into v_job;
  perform cac.log(v_actor.user_id, 'workflow.retry_requested', p_job::text);
  return to_jsonb(v_job);
end $$;

-- ── Worker functions (service role only) ───────────────────────────────────

create or replace function cac.worker_heartbeat(p_mode text, p_ai_configured boolean)
returns void language sql security definer set search_path = cac, public as $$
  insert into cac.worker_status (id, mode, ai_configured, last_seen) values (1, p_mode, p_ai_configured, now())
  on conflict (id) do update set mode = excluded.mode, ai_configured = excluded.ai_configured, last_seen = now();
$$;

-- Claims the oldest available run (or one whose worker died) and returns it
-- with the bounded context the analysis may read.
create or replace function cac.claim_job()
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_job cac.job;
  v_target jsonb;
begin
  loop
    select * into v_job from cac.job
      where (status = 'queued' and available_at <= now()) or (status = 'running' and (locked_until is null or locked_until < now()))
      order by created_at for update skip locked limit 1;
    if not found then return null; end if;
    v_target := cac.get(v_job.target_kind, v_job.target_id);
    if v_target is null or (v_target->>'record_version')::int <> (v_job.input->>'target_version')::int then
      update cac.job set status = 'failed', step = 'retry_or_review', locked_until = null, error = 'Record changed after this workflow was queued. Start a new run.' where id = v_job.id;
      perform cac.log(v_job.actor, 'workflow.error', v_job.id::text, jsonb_build_object('message', 'Record changed after queueing'));
      continue;
    end if;
    if v_job.attempts >= v_job.max_attempts then
      update cac.job set status = 'failed', step = 'retry_or_review', locked_until = null, error = coalesce(error, 'Worker stopped during the final attempt.') where id = v_job.id;
      continue;
    end if;
    update cac.job set status = 'running', attempts = attempts + 1, step = 'load_context', locked_until = now() + interval '5 minutes',
      trace = trace || jsonb_build_array(jsonb_build_object('step', 'load_context', 'at', now()))
      where id = v_job.id returning * into v_job;
    return jsonb_build_object('job', to_jsonb(v_job), 'context', jsonb_build_object(
      'target', v_target,
      'input', v_job.input,
      'quotes', (select coalesce(jsonb_agg(to_jsonb(q) order by q.version), '[]') from cac.quote q where q.opportunity_id = v_job.target_id),
      'activities', (select coalesce(jsonb_agg(a), '[]') from (select to_jsonb(x) a from cac.activity x where x.opportunity_id = v_job.target_id order by x.created_at desc limit 10) s),
      'portfolio', (select coalesce(jsonb_agg(p), '[]') from (select to_jsonb(x) p from cac.portfolio x where x.status = 'approved' order by (x.segment = v_target->>'segment') desc nulls last, x.created_at desc limit 8) s),
      'images', case when v_job.agent = 'survey' then (select coalesce(jsonb_agg(i), '[]') from (select jsonb_build_object('name', x.name, 'mime', x.mime, 'path', x.path) i from cac.attachment x where x.survey_id = v_job.target_id order by x.created_at limit 4) s) else '[]' end
    ));
  end loop;
end $$;

create or replace function cac.save_analysis(p_job uuid, p_analysis jsonb)
returns void language plpgsql security definer set search_path = cac, public as $$
begin
  if jsonb_typeof(p_analysis) <> 'object' or jsonb_typeof(p_analysis->'summary') <> 'string' or jsonb_typeof(p_analysis->'missing') <> 'array' then
    perform cac.fail('Invalid analysis result. Review was not created.');
  end if;
  update cac.job set analysis = p_analysis, step = 'analysis_saved',
    trace = trace || jsonb_build_array(jsonb_build_object('step', 'analysis_saved', 'at', now(), 'mode', p_analysis->>'mode'))
    where id = p_job and status = 'running';
  if not found then perform cac.fail('Run is no longer running.'); end if;
end $$;

create or replace function cac.fail_job(p_job uuid, p_message text, p_terminal boolean)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_job cac.job;
begin
  update cac.job set
    status = case when p_terminal or attempts >= max_attempts then 'failed' else 'queued' end,
    error = left(p_message, 500), step = 'retry_or_review', locked_until = null,
    available_at = now() + make_interval(secs => power(2, attempts))
    where id = p_job and status = 'running' returning * into v_job;
  if found then perform cac.log(v_job.actor, 'workflow.error', p_job::text, jsonb_build_object('message', left(p_message, 500), 'attempt', v_job.attempts)); end if;
  return to_jsonb(v_job);
end $$;

-- Applies a saved analysis: drafts, review requests and follow-up side effects.
create or replace function cac.complete_job(p_job uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_job cac.job;
  v_agent cac.agent;
  v_actor cac.staff;
  v_target jsonb;
  a jsonb;
  v_updated jsonb; v_quote jsonb; v_review jsonb; v_draft jsonb; v_portfolio jsonb; v_previous jsonb; v_revision jsonb;
  v_body text;
  v_missing text;
  v_opportunity uuid;
  v_owner text;
begin
  select * into v_job from cac.job where id = p_job for update;
  if not found or v_job.status <> 'running' or v_job.analysis is null then perform cac.fail('Run is not ready to complete.'); end if;
  select * into v_agent from cac.agent where id = v_job.agent;
  v_target := cac.get(v_job.target_kind, v_job.target_id, true);
  if v_target is null or (v_target->>'record_version')::int <> (v_job.input->>'target_version')::int then
    perform cac.fail('Record changed during analysis. Start a fresh workflow.');
  end if;
  v_actor := cac.require_role(v_job.actor, array[v_agent.role] || case when v_agent.id = 'proposal' then array['engineer'] else '{}'::text[] end);
  a := v_job.analysis;
  v_missing := (select string_agg(x, E'\n') from jsonb_array_elements_text(coalesce(a->'missing', '[]')) x);

  if v_agent.id = 'research' then
    v_updated := cac.put('prospect', jsonb_build_object('id', v_target->>'id', 'research', a, 'research_date', current_date, 'status', 'draft'));
    v_review := cac.request_approval(v_actor.user_id, 'prospect', v_updated, 'prospect', 'sales', 'Review research · ' || (v_target->>'name'), a);
  elsif v_agent.id = 'qualification' then
    v_review := cac.request_approval(v_actor.user_id, 'opportunity', v_target, 'qualification', 'sales', 'Confirm qualification · ' || (v_target->>'name'), a);
  elsif v_agent.id = 'proposal' then
    v_quote := cac.create_quote_as(v_actor.user_id, v_job.input || jsonb_build_object('opportunity_id', v_target->>'id'));
    select to_jsonb(x) into v_review from cac.approval x where x.target_id = (v_quote->>'id')::uuid and x.status = 'pending';
  else
    if v_agent.id = 'outreach' then
      if v_target->>'status' <> 'approved' or (v_target->>'suppressed')::boolean then perform cac.fail('Prospect is no longer eligible for outreach.'); end if;
      select to_jsonb(x) into v_portfolio from cac.portfolio x where x.status = 'approved' order by (x.segment = v_target->>'segment') desc nulls last, x.created_at desc limit 1;
      if v_portfolio is null then perform cac.fail('Approve portfolio material before drafting outreach.'); end if;
      v_body := format(E'Hello %s team,\n\nWe would welcome a conversation about your pool requirements in %s. %s\n\nWould it be useful to discuss whether our services fit your plans?\n\nCrystal Pools\nIf this is not relevant, let us know and we will stop contacting you.',
        v_target->>'name', v_target->>'location', v_portfolio->>'description');
    elsif v_agent.id = 'survey' then
      v_body := format(E'Survey review: %s\n\n%s\nMeasurements and photos require engineer verification.', a->>'summary', coalesce(v_missing, ''));
    elsif v_agent.id = 'sales' then
      v_body := format(E'Meeting brief\n%s\nNext action: %s', a->>'summary', coalesce(nullif(v_target->>'next_action', ''), 'Confirm the next action with the owner.'));
    elsif v_agent.id = 'project' then
      v_body := format(E'Site coordination review\n%s\nConfirm any impact on scope, cost or programme using a change request.', a->>'summary');
    elsif v_agent.id = 'maintenance' then
      v_body := format(E'Renewal review: %s\n%s\nRenewal date: %s\nCommercial approval is required for any offer or price.', v_target->>'name', a->>'summary', coalesce(v_target->>'renewal_date', 'Confirm'));
    else
      v_body := coalesce(a->>'proposedReply', '');
    end if;
    v_opportunity := case when v_job.target_kind = 'opportunity' then v_job.target_id else nullif(v_target->>'opportunity_id', '')::uuid end;
    v_draft := cac.put('draft', jsonb_build_object('name', v_agent.name || ' · ' || (v_target->>'name'), 'agent', v_agent.id,
      'target_id', v_job.target_id, 'target_kind', v_job.target_kind, 'opportunity_id', v_opportunity,
      'prospect_id', case when v_job.target_kind = 'prospect' then v_job.target_id end, 'campaign_id', nullif(v_job.input->>'campaign_id', ''),
      'body', v_body, 'analysis', a, 'status', 'pending', 'run_id', v_job.id, 'created_by', v_actor.user_id));
    v_review := cac.request_approval(v_actor.user_id, 'draft', v_draft, case when v_agent.id = 'survey' then 'survey_draft' else v_agent.id end, v_agent.role, v_draft->>'name', a);

    if v_agent.id = 'followup' then
      v_owner := (select name from cac.staff where user_id = (v_target->>'owner_id')::uuid);
      perform cac.put('activity', jsonb_build_object('name', 'Customer reply', 'opportunity_id', v_job.target_id, 'type', 'Customer reply', 'notes', v_job.input->>'message', 'run_id', v_job.id, 'status', 'recorded', 'created_by', v_actor.user_id));
      update cac.task set status = 'paused', pause_reason = 'Contextual reply · ' || v_job.id
        where opportunity_id = v_job.target_id and category = 'generic_followup' and status = 'open';
      if v_job.input->>'message' ~* 'unsubscribe|stop contacting|remove me|do not contact' then
        update cac.customer set suppressed = true where id = (v_target->>'customer_id')::uuid;
        update cac.opportunity set suppressed = true where customer_id = (v_target->>'customer_id')::uuid;
      end if;
      if a->>'intent' = 'revision' then
        select to_jsonb(q) into v_previous from cac.quote q where q.opportunity_id = v_job.target_id and q.status = 'approved' order by q.version desc limit 1;
        v_revision := cac.put('revision', jsonb_build_object('name', 'Revision requested · ' || (v_target->>'name'), 'opportunity_id', v_job.target_id,
          'site_id', v_target->>'site_id', 'previous_quote_id', v_previous->>'id', 'status', 'needs_estimation',
          'heating_requested', coalesce((a->>'heatingRequested')::boolean, false), 'tentative_start', nullif(a->>'tentativeStart', ''),
          'requested_change', v_job.input->>'message', 'missing', coalesce(a->'missing', '[]'), 'run_id', v_job.id, 'created_by', v_actor.user_id));
        perform cac.put('task', jsonb_build_object('name', 'Estimate requested scope revision', 'opportunity_id', v_job.target_id, 'owner', 'Estimator / engineer',
          'due_date', current_date, 'status', 'open', 'revision_id', v_revision->>'id', 'notes', v_missing, 'category', 'estimation', 'created_by', v_actor.user_id));
      else
        perform cac.put('task', jsonb_build_object('name', case a->>'intent' when 'closure' then 'Review closure / opt-out' when 'later' then 'Confirm deferred follow-up date' else 'Review reply and clarify requirements' end,
          'opportunity_id', v_job.target_id, 'owner', coalesce(v_owner, 'Sales'), 'due_date', current_date, 'status', 'open', 'category', 'contextual', 'notes', v_missing, 'created_by', v_actor.user_id));
      end if;
    end if;
  end if;

  update cac.job set status = 'waiting_approval', step = 'human_review', approval_id = (v_review->>'id')::uuid, locked_until = null,
    trace = trace || jsonb_build_array(jsonb_build_object('step', 'human_review', 'at', now(), 'role', v_review->>'role'))
    where id = p_job returning * into v_job;
  perform cac.log(v_job.actor, 'workflow.awaiting_review', p_job::text, jsonb_build_object('approvalId', v_review->>'id'));
  return to_jsonb(v_job);
end $$;
