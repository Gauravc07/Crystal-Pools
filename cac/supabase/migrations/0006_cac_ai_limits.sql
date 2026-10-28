-- ============================================================================
-- CAC production guards for live AI (OpenAI or Hugging Face):
--   * per-person hourly and workspace daily limits on assistant runs, so a
--     mistake or a loop cannot run up provider costs
--   * workspace snapshot loads only the 200 most recent runs
-- ============================================================================

alter table cac.setting drop constraint setting_key_check;
alter table cac.setting add constraint setting_key_check check (key in ('review_url','response_target_minutes','user_hourly_run_limit','workspace_daily_run_limit'));
insert into cac.setting (key, value) values ('user_hourly_run_limit', '30'), ('workspace_daily_run_limit', '200') on conflict (key) do nothing;

create index if not exists job_actor_created on cac.job (actor, created_at desc);
create index if not exists job_created on cac.job (created_at desc);

create or replace function cac.set_setting(p_key text, p_value text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), '{}');
begin
  if p_key = 'review_url' and btrim(coalesce(p_value, '')) <> '' and not cac.safe_url(btrim(p_value)) then perform cac.fail('The review link must be a valid HTTPS URL.'); end if;
  if p_key = 'response_target_minutes' and (coalesce(p_value, '') !~ '^[0-9]{1,4}$' or p_value::int not between 5 and 1440) then perform cac.fail('Response target must be 5–1440 minutes.'); end if;
  if p_key = 'user_hourly_run_limit' and (coalesce(p_value, '') !~ '^[0-9]{1,4}$' or p_value::int not between 1 and 500) then perform cac.fail('Hourly runs per person must be 1–500.'); end if;
  if p_key = 'workspace_daily_run_limit' and (coalesce(p_value, '') !~ '^[0-9]{1,5}$' or p_value::int not between 1 and 10000) then perform cac.fail('Daily runs for the workspace must be 1–10000.'); end if;
  update cac.setting set value = btrim(coalesce(p_value, '')), updated_at = now() where key = p_key;
  if not found then perform cac.fail('Unknown setting.'); end if;
  perform cac.log(v_actor.user_id, 'setting.updated', p_key, jsonb_build_object('value', btrim(coalesce(p_value, ''))));
  return (select jsonb_object_agg(key, value) from cac.setting);
end $$;

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

  -- Cost guards: new runs only (repeats above return the existing run).
  if (select count(*) from cac.job where actor = v_actor.user_id and created_at > now() - interval '1 hour')
     >= (select value::int from cac.setting where key = 'user_hourly_run_limit') then
    perform cac.fail('You have reached the hourly limit for assistant runs. Try again later, or ask an admin to raise it in Settings.', 'P0429');
  end if;
  if (select count(*) from cac.job where (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)
     >= (select value::int from cac.setting where key = 'workspace_daily_run_limit') then
    perform cac.fail('The workspace has reached today''s limit for assistant runs. An admin can raise it in Settings.', 'P0429');
  end if;

  insert into cac.job (dedupe, agent, target_id, target_kind, input, actor)
    values (v_key, p_agent, p_target, v_agent.kind, v_input || jsonb_build_object('target_version', (v_target->>'record_version')::int), v_actor.user_id)
    returning * into v_job;
  perform cac.log(v_actor.user_id, 'workflow.queued', v_job.id::text, jsonb_build_object('agent', p_agent, 'targetId', p_target));
  return to_jsonb(v_job);
end $$;

create or replace function cac.workspace_state()
returns jsonb language plpgsql stable security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.actor(auth.uid());
  v_records jsonb := '{}';
  k text;
  v jsonb;
begin
  foreach k in array array['customer','contact','site','prospect','opportunity','activity','task','survey','rate','portfolio','campaign','project','change','payment','maintenance','quote','draft','approval','revision','attachment','appointment','service_visit','review_request','knowledge','briefing'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), ''[]'') from cac.%I t', k) into v;
    v_records := v_records || jsonb_build_object(k, v);
  end loop;
  return jsonb_build_object(
    'user', to_jsonb(v_actor),
    'users', (select coalesce(jsonb_agg(to_jsonb(s) order by s.name), '[]') from cac.staff s),
    'records', v_records,
    'jobs', (select coalesce(jsonb_agg(j), '[]') from (select to_jsonb(x) j from cac.job x order by x.created_at desc limit 200) s),
    'events', (select coalesce(jsonb_agg(e), '[]') from (select to_jsonb(x) e from cac.event x order by x.id desc limit 300) s),
    'agents', (select jsonb_agg(to_jsonb(a) order by a.sort) from cac.agent a),
    'stages', to_jsonb(cac.stages()),
    'settings', (select jsonb_object_agg(key, value) from cac.setting),
    'metrics', cac.owner_metrics(),
    'lifecycle', cac.lifecycle_summary(),
    'usage', jsonb_build_object(
      'runs_today', (select count(*) from cac.job where (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date),
      'my_runs_last_hour', (select count(*) from cac.job where actor = v_actor.user_id and created_at > now() - interval '1 hour'),
      'by_model_30d', (select coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'model', model, 'runs', runs, 'failed', failed,
          'input_tokens', input_tokens, 'output_tokens', output_tokens) order by runs desc), '[]') from (
        select coalesce(analysis->>'provider', case when analysis is null then 'not analysed' else 'demo' end) as provider,
          coalesce(analysis->>'model', analysis->>'mode', '—') as model, count(*) as runs, count(*) filter (where status = 'failed') as failed,
          coalesce(sum((analysis->'usage'->>'input')::bigint), 0) as input_tokens, coalesce(sum((analysis->'usage'->>'output')::bigint), 0) as output_tokens
        from cac.job where created_at > now() - interval '30 days'
        group by 1, 2) g)),
    'config', jsonb_build_object(
      'outbound', 'disabled',
      'database', 'Supabase · cac schema',
      'worker', (select to_jsonb(w) from cac.worker_status w),
      'website_leads', to_regclass('public.leads') is not null,
      'photo_bucket', 'cac-survey-photos'));
end $$;
