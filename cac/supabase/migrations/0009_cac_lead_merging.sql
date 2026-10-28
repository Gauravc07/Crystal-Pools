-- ============================================================================
-- CAC project leads: duplicates are merged, never lost or repeated.
--   * a project seen again (same report or a later one) adds its new contacts,
--     phones, emails and amenities to the existing lead; a field the new report
--     leaves blank keeps its saved value
--   * a project is matched by project + builder, or by the same project name with
--     the same PIN code or a builder name starting the same way (spelling variants)
--   * a project repeated inside one report is counted as a duplicate, not skipped
--   * Gmail files already imported (same file in another email) are reported
-- ============================================================================

-- Text lists: everything in a, then what b adds (compared case-insensitively), in first-seen order.
create or replace function cac.merge_list(a jsonb, b jsonb, p_max int default 40)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(v order by o), '[]') from (
    select v, o from (
      select distinct on (lower(btrim(v #>> '{}'))) v, o from (
        select v, ord as o from jsonb_array_elements(case when jsonb_typeof(a) = 'array' then a else '[]' end) with ordinality x(v, ord)
        union all
        select v, 100000 + ord from jsonb_array_elements(case when jsonb_typeof(b) = 'array' then b else '[]' end) with ordinality y(v, ord)
      ) both_lists
      where jsonb_typeof(v) = 'string' and btrim(v #>> '{}') <> ''
      order by lower(btrim(v #>> '{}')), o
    ) first_seen order by o limit p_max
  ) kept;
$$;

-- A builder or architect: newest non-blank name and address, combined phones and emails.
create or replace function cac.merge_party(a jsonb, b jsonb)
returns jsonb language sql immutable as $$
  select coalesce(a, '{}') || coalesce(b, '{}') || jsonb_build_object(
    'name', coalesce(nullif(btrim(b->>'name'), ''), a->>'name', ''),
    'firm', coalesce(nullif(btrim(b->>'firm'), ''), a->>'firm', ''),
    'address', coalesce(nullif(btrim(b->>'address'), ''), a->>'address', ''),
    'phones', cac.merge_list(a->'phones', b->'phones'),
    'emails', cac.merge_list(a->'emails', b->'emails'));
$$;

-- People: the same person (same name, phone or email) gets blanks filled; new people are added.
create or replace function cac.merge_people(a jsonb, b jsonb)
returns jsonb language plpgsql immutable as $$
declare
  v_out jsonb := case when jsonb_typeof(a) = 'array' then a else '[]' end;
  p jsonb; i int; q jsonb; v_match int;
  digits text; email text; name text;
begin
  for p in select * from jsonb_array_elements(case when jsonb_typeof(b) = 'array' then b else '[]' end) loop
    name := lower(regexp_replace(coalesce(p->>'name', ''), '^(mr|ms|mrs|dr)\.?\s*|[^a-z0-9]', '', 'gi'));
    digits := right(regexp_replace(coalesce(p->>'phone', ''), '[^0-9]', '', 'g'), 10);
    email := lower(btrim(coalesce(p->>'email', '')));
    v_match := null;
    for i in 0 .. jsonb_array_length(v_out) - 1 loop
      q := v_out->i;
      if (name <> '' and name = lower(regexp_replace(coalesce(q->>'name', ''), '^(mr|ms|mrs|dr)\.?\s*|[^a-z0-9]', '', 'gi')))
         or (char_length(digits) = 10 and digits = right(regexp_replace(coalesce(q->>'phone', ''), '[^0-9]', '', 'g'), 10))
         or (email <> '' and email = lower(btrim(coalesce(q->>'email', '')))) then
        v_match := i; exit;
      end if;
    end loop;
    if v_match is null then
      v_out := v_out || jsonb_build_array(p);
    else
      q := v_out->v_match;
      v_out := jsonb_set(v_out, array[v_match::text], jsonb_build_object(
        'name', coalesce(nullif(btrim(q->>'name'), ''), p->>'name', ''),
        'role', coalesce(nullif(btrim(q->>'role'), ''), p->>'role', ''),
        'phone', coalesce(nullif(btrim(q->>'phone'), ''), p->>'phone', ''),
        'email', coalesce(nullif(btrim(q->>'email'), ''), p->>'email', '')));
    end if;
  end loop;
  return (select coalesce(jsonb_agg(x), '[]') from (select x from jsonb_array_elements(v_out) x limit 12) s);
end $$;

-- Finds the saved lead for a project: exact project + builder, else the same project
-- name with the same PIN code or a builder name that starts the same way.
create or replace function cac.find_project_lead(p_key text, p_pincode text)
returns uuid language sql stable as $$
  select id from cac.project_lead
  where dedupe_key = p_key
     or (split_part(dedupe_key, '|', 1) = split_part(p_key, '|', 1) and split_part(p_key, '|', 1) <> ''
         and ((nullif(p_pincode, '') is not null and pincode = p_pincode)
              or (char_length(split_part(p_key, '|', 2)) >= 4 and left(split_part(dedupe_key, '|', 2), 4) = left(split_part(p_key, '|', 2), 4))))
  order by (dedupe_key = p_key) desc, created_at
  limit 1;
$$;

create or replace function cac.complete_lead_import(p_job uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_job cac.job;
  v_actor cac.staff;
  v_import jsonb;
  l jsonb;
  v_lead cac.project_lead;
  v_id uuid;
  v_saved jsonb;
  v_fields jsonb;
  v_rank jsonb := '{"early": 1, "mid": 2, "late": 3}';
  v_created int := 0; v_updated int := 0; v_advanced int := 0; v_skipped int := 0; v_duplicates int := 0; v_merged int := 0;
  v_seen uuid[] := '{}';
  v_key text;
  v_repeat boolean;
  v_before int;
begin
  select * into v_job from cac.job where id = p_job for update;
  if not found or v_job.status <> 'running' or v_job.analysis is null or v_job.agent <> 'leadimport' then perform cac.fail('Run is not ready to complete.'); end if;
  v_import := cac.get('lead_import', v_job.target_id, true);
  if v_import is null or (v_import->>'record_version')::int <> (v_job.input->>'target_version')::int then perform cac.fail('Report changed during analysis. Start a fresh run.'); end if;
  v_actor := cac.require_role(v_job.actor, array['sales']);
  if jsonb_typeof(v_job.analysis->'leads') is distinct from 'array' then perform cac.fail('The analysis has no leads list.'); end if;

  for l in select * from jsonb_array_elements(v_job.analysis->'leads') loop
    if cac.blank(l, 'project_name') or coalesce(l->>'stage_bucket', '') not in ('early','mid','late') or coalesce(l->>'priority', '') not in ('Hot','Warm','Cold') then
      v_skipped := v_skipped + 1; continue;
    end if;
    v_key := cac.lead_key(l->>'project_name', l->'builder'->>'name');
    v_fields := jsonb_build_object(
      'project_type', left(nullif(btrim(l->>'project_type'), ''), 80),
      'landmark', left(nullif(btrim(l->>'landmark'), ''), 300), 'area', left(nullif(btrim(l->>'area'), ''), 80), 'pincode', left(nullif(btrim(l->>'pincode'), ''), 6),
      'details', left(nullif(btrim(l->>'details'), ''), 300),
      'towers', case when jsonb_typeof(l->'towers') = 'number' then l->'towers' end, 'units', case when jsonb_typeof(l->'units') = 'number' then l->'units' end,
      'stage', left(nullif(btrim(l->>'stage'), ''), 120), 'stage_bucket', l->>'stage_bucket', 'possession', left(nullif(btrim(l->>'possession'), ''), 40),
      'pool_mentioned', coalesce(l->'pool_mentioned' = 'true', false),
      'fit', case when jsonb_typeof(l->'fit') = 'array' then l->'fit' else '[]' end,
      'priority', l->>'priority', 'function_area', left(l->>'function_area', 80),
      'import_id', v_import->>'id', 'report_serial', case when jsonb_typeof(l->'serial') = 'number' then l->'serial' end);

    v_id := cac.find_project_lead(v_key, left(nullif(btrim(l->>'pincode'), ''), 6));
    if v_id is null then
      v_saved := cac.put('project_lead', jsonb_strip_nulls(v_fields) || jsonb_build_object('name', left(btrim(l->>'project_name'), 160), 'dedupe_key', v_key,
        'builder', cac.merge_party('{}', l->'builder'), 'architect', cac.merge_party('{}', l->'architect'),
        'contacts', cac.merge_people('[]', l->'contacts'), 'products', cac.merge_list('[]', l->'products'),
        'owner', cac.lead_owner(l->>'stage_bucket'), 'status', 'New', 'created_by', v_actor.user_id,
        'history', jsonb_build_array(jsonb_build_object('at', now(), 'report', v_import->>'name', 'stage', l->>'stage', 'possession', l->>'possession'))));
      perform cac.schedule_lead_step(v_actor.user_id, (v_saved->>'id')::uuid, 1);
      v_seen := v_seen || (v_saved->>'id')::uuid;
      v_created := v_created + 1;
      continue;
    end if;

    select * into v_lead from cac.project_lead where id = v_id for update;
    v_repeat := v_id = any(v_seen);  -- the same project listed twice in this report
    v_before := jsonb_array_length(v_lead.contacts);
    v_saved := cac.put('project_lead', jsonb_build_object('id', v_lead.id,
        -- Blank in this report: keep what is saved. Lists and people: add what is new.
        'project_type', coalesce(v_fields->>'project_type', v_lead.project_type), 'landmark', coalesce(v_fields->>'landmark', v_lead.landmark),
        'area', coalesce(v_fields->>'area', v_lead.area), 'pincode', coalesce(v_fields->>'pincode', v_lead.pincode), 'details', coalesce(v_fields->>'details', v_lead.details),
        'towers', coalesce((v_fields->>'towers')::int, v_lead.towers), 'units', coalesce((v_fields->>'units')::int, v_lead.units),
        'stage', coalesce(v_fields->>'stage', v_lead.stage), 'possession', coalesce(v_fields->>'possession', v_lead.possession),
        'stage_bucket', case when v_fields->>'stage' is null then v_lead.stage_bucket else v_fields->>'stage_bucket' end,
        'priority', case when v_fields->>'stage' is null then v_lead.priority else v_fields->>'priority' end,
        'function_area', case when v_fields->>'stage' is null then v_lead.function_area else v_fields->>'function_area' end,
        'pool_mentioned', v_lead.pool_mentioned or (v_fields->>'pool_mentioned')::boolean,
        'fit', cac.merge_list(v_lead.fit, v_fields->'fit'), 'products', cac.merge_list(v_lead.products, l->'products'),
        'builder', cac.merge_party(v_lead.builder, l->'builder'), 'architect', cac.merge_party(v_lead.architect, l->'architect'),
        'contacts', cac.merge_people(v_lead.contacts, l->'contacts'),
        'import_id', v_import->>'id', 'report_serial', coalesce((v_fields->>'report_serial')::int, v_lead.report_serial),
        -- A lead still with the default owner for its old stage moves to the default owner for its new stage.
        'owner', case when v_fields->>'stage' is not null and v_lead.owner = cac.lead_owner(v_lead.stage_bucket) then cac.lead_owner(v_fields->>'stage_bucket') else v_lead.owner end,
        'history', v_lead.history || case when not v_repeat and (v_fields->>'stage' is distinct from v_lead.stage or v_fields->>'possession' is distinct from v_lead.possession)
          then jsonb_build_array(jsonb_build_object('at', now(), 'report', v_import->>'name', 'stage', coalesce(l->>'stage', v_lead.stage), 'possession', coalesce(l->>'possession', v_lead.possession))) else '[]' end));
    if jsonb_array_length(v_saved->'contacts') > v_before then
      v_merged := v_merged + 1;
      perform cac.put('comment', jsonb_build_object('name', v_lead.name, 'target_kind', 'project_lead', 'target_id', v_lead.id, 'kind', 'system',
        'body', format('%s: %s new contact(s) added: %s.', v_import->>'name', jsonb_array_length(v_saved->'contacts') - v_before,
          (select string_agg(coalesce(nullif(c->>'name', ''), nullif(c->>'phone', ''), c->>'email'), ', ') from jsonb_array_elements(v_saved->'contacts') with ordinality x(c, n) where n > v_before))));
    end if;
    if not v_repeat and v_fields->>'stage' is not null and (v_rank->>(v_fields->>'stage_bucket'))::int > (v_rank->>v_lead.stage_bucket)::int
       and v_lead.status in ('New','Contacted','Meeting','Interested') then
      perform cac.cancel_lead_tasks(v_actor.user_id, v_lead.id, 'Construction stage advanced');
      perform cac.schedule_lead_step(v_actor.user_id, v_lead.id, 1, null, 'Stage advanced: ');
      perform cac.put('comment', jsonb_build_object('name', v_lead.name, 'target_kind', 'project_lead', 'target_id', v_lead.id, 'kind', 'system',
        'body', format('%s: construction stage moved from "%s" to "%s". Follow-ups restarted.', v_import->>'name', coalesce(v_lead.stage, 'not recorded'), l->>'stage')));
      v_advanced := v_advanced + 1;
    end if;
    if v_repeat then v_duplicates := v_duplicates + 1;
    else v_seen := v_seen || v_lead.id; v_updated := v_updated + 1;
    end if;
  end loop;

  perform cac.put('lead_import', jsonb_build_object('id', v_import->>'id', 'status', 'imported',
    'result', jsonb_build_object('created', v_created, 'updated', v_updated, 'advanced', v_advanced, 'duplicates', v_duplicates, 'merged', v_merged,
      'skipped', v_skipped, 'missing', coalesce(v_job.analysis->'missing', '[]'))));
  update cac.job set status = 'completed', step = 'completed', completed_at = now(), locked_until = null,
    trace = trace || jsonb_build_array(jsonb_build_object('step', 'leads_saved', 'at', now(), 'created', v_created, 'updated', v_updated, 'duplicates', v_duplicates))
    where id = p_job returning * into v_job;
  perform cac.log(v_actor.user_id, 'leads.imported', v_import->>'id', jsonb_build_object('created', v_created, 'updated', v_updated, 'advanced', v_advanced, 'duplicates', v_duplicates, 'merged', v_merged, 'skipped', v_skipped));
  return to_jsonb(v_job);
end $$;

-- Gmail: report which files of an email were already imported (same file sent again).
create or replace function cac.mail_record_message(p_id text, p_from text, p_subject text, p_received_at timestamptz, p_files jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor uuid := cac.lead_import_actor();
  f jsonb;
  v_imports jsonb := '[]';
  v_duplicates int := 0;
  v_one jsonb;
begin
  if exists (select 1 from cac.mail_message where id = p_id) then return jsonb_build_object('duplicate', true, 'imports', '[]', 'duplicates', 0); end if;
  if v_actor is null then perform cac.fail('Add an active CAC admin before importing lead reports.'); end if;
  for f in select * from jsonb_array_elements(case when jsonb_typeof(p_files) = 'array' then p_files else '[]' end) loop
    v_one := cac.create_lead_import(v_actor, f || jsonb_build_object('source', 'gmail', 'mail_message_id', p_id,
      'mail_from', p_from, 'mail_subject', p_subject, 'received_at', p_received_at));
    if coalesce((v_one->>'duplicate')::boolean, false) then v_duplicates := v_duplicates + 1; else v_imports := v_imports || jsonb_build_array(v_one); end if;
  end loop;
  insert into cac.mail_message (id, mail_from, subject, received_at, files) values (p_id, left(p_from, 300), left(p_subject, 300), p_received_at, jsonb_array_length(v_imports));
  return jsonb_build_object('imports', v_imports, 'duplicates', v_duplicates);
end $$;

-- Staff: read a report again (for example after the extraction rules or model improve).
create or replace function cac.reread_lead_report(p_import uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
  v_import cac.lead_import;
  v_job cac.job;
begin
  select * into v_import from cac.lead_import where id = p_import;
  if not found then perform cac.fail('Report not found.', 'P0404'); end if;
  if v_import.sheets is null then perform cac.fail(coalesce(v_import.error, 'This file could not be read. Send it again as .xlsx.')); end if;
  select * into v_job from cac.job where agent = 'leadimport' and target_id = p_import and status in ('queued','running') limit 1;
  if found then return to_jsonb(v_job); end if;
  if (select count(*) from cac.job where (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)
     >= (select value::int from cac.setting where key = 'workspace_daily_run_limit') then
    perform cac.fail('The workspace has reached today''s limit for assistant runs. An admin can raise it in Settings.', 'P0429');
  end if;
  insert into cac.job (dedupe, agent, target_id, target_kind, input, actor)
    values ('leadimport:reread:' || gen_random_uuid(), 'leadimport', p_import, 'lead_import', jsonb_build_object('target_version', v_import.record_version), v_actor.user_id)
    returning * into v_job;
  update cac.lead_import set job_id = v_job.id where id = p_import;
  -- Keep the run's pinned version in step with the job link written just above.
  update cac.job set input = jsonb_build_object('target_version', (select record_version from cac.lead_import where id = p_import)) where id = v_job.id returning * into v_job;
  perform cac.log(v_actor.user_id, 'leads.report_reread', p_import::text);
  return to_jsonb(v_job);
end $$;

-- Staff: "Run agent now": checks Gmail on the next worker pass (when connected). The app then wakes the worker.
create or replace function cac.request_mail_check()
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
begin
  if cac.setting_value('lead_mail_configured') = 'true' then
    update cac.setting set value = '', updated_at = now() where key = 'lead_mail_last_poll';
  end if;
  perform cac.log(v_actor.user_id, 'leads.agent_run_requested', 'gmail');
  return jsonb_build_object('ok', true, 'gmail', cac.setting_value('lead_mail_configured') = 'true',
    'queued', (select count(*) from cac.job where agent = 'leadimport' and status in ('queued','running')));
end $$;

do $$
declare fn record;
begin
  for fn in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'cac'::regnamespace
    and p.proname in ('merge_list','merge_party','merge_people','find_project_lead','reread_lead_report') loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn.sig);
  end loop;
end $$;
grant execute on function cac.reread_lead_report(uuid) to authenticated;
