-- ============================================================================
-- CAC project lead reports:
--   * builder/architect project reports (.xlsx) arrive by Gmail or upload
--   * the worker reads each file with the configured model into project leads
--   * a lead is matched by project + builder, so the next month's report
--     updates its construction stage instead of creating a duplicate
--   * every lead gets a follow-up schedule set by its construction stage; when
--     the stage advances, the schedule restarts at the faster pace
--   * comments on leads (and opportunities, customers, prospects) and logged
--     contact outcomes that schedule the next step
-- ============================================================================

-- ── Tables ─────────────────────────────────────────────────────────────────

create table cac.lead_import (
  id uuid primary key default gen_random_uuid(),
  name text not null,                        -- file name
  source text not null check (source in ('gmail','upload')),
  sha256 text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  mail_message_id text, mail_from text, mail_subject text, received_at timestamptz,
  sheets jsonb,                              -- cell text by sheet and row; not sent to the app
  row_count int not null default 0,
  job_id uuid,                               -- the extraction run (cac.job)
  result jsonb,
  error text,
  status text not null default 'queued' check (status in ('queued','imported','failed')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.project_lead (
  id uuid primary key default gen_random_uuid(),
  name text not null,                        -- project name
  dedupe_key text not null unique,           -- project + builder, letters and digits only
  project_type text,
  builder jsonb not null default '{}',       -- { name, address, phones[], emails[] }
  architect jsonb not null default '{}',     -- { firm, name, address, phones[], emails[] }
  contacts jsonb not null default '[]',      -- [{ name, role, phone, email }]
  landmark text, area text, pincode text,
  details text, towers int, units int,
  stage text,
  stage_bucket text not null check (stage_bucket in ('early','mid','late')),
  possession text,
  products jsonb not null default '[]',
  pool_mentioned boolean not null default false,
  fit jsonb not null default '[]',           -- Crystal Pools lines the amenities point to
  priority text not null check (priority in ('Hot','Warm','Cold')),
  function_area text,                        -- owning function on the Crystal Pools chart
  owner text not null default 'Sales',
  follow_up_step int not null default 0,
  next_follow_up date,
  last_contact_at timestamptz, last_outcome text,
  history jsonb not null default '[]',       -- stage and possession seen in each report
  import_id uuid references cac.lead_import(id),
  report_serial int,
  converted_opportunity_id uuid references cac.opportunity(id),
  close_reason text,
  status text not null default 'New' check (status in ('New','Contacted','Meeting','Interested','Converted','Not relevant','Lost')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);
create index on cac.project_lead (status, next_follow_up);

create table cac.comment (
  id uuid primary key default gen_random_uuid(),
  name text not null,                        -- the record's name when commented
  target_kind text not null check (target_kind in ('project_lead','opportunity','customer','prospect')),
  target_id uuid not null,
  kind text not null default 'note' check (kind in ('note','contact','system')),
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'recorded',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);
create index on cac.comment (target_id, created_at);

-- Gmail messages already read (their files are in cac.lead_import).
create table cac.mail_message (
  id text primary key,
  mail_from text, subject text, received_at timestamptz,
  files int not null default 0,
  recorded_at timestamptz not null default now()
);

alter table cac.task add column project_lead_id uuid references cac.project_lead(id);
create index on cac.task (project_lead_id) where project_lead_id is not null;

insert into cac.agent values
  ('leadimport', 11, 'Lead report reader', 'lead_import', 'sales', 'Read a project report spreadsheet into project leads with contacts, construction stage and amenities, then schedule follow-ups by stage.', '{read report rows,extract project leads,schedule follow-ups}', 'Runs automatically');

do $$
declare t text;
begin
  foreach t in array array['lead_import','project_lead','comment'] loop
    execute format('create trigger touch before insert or update on cac.%I for each row execute function cac.touch()', t);
  end loop;
  foreach t in array array['lead_import','project_lead','comment','mail_message'] loop
    execute format('alter table cac.%I enable row level security', t);
    execute format('revoke all on cac.%I from anon, authenticated', t);
    execute format('grant select on cac.%I to authenticated', t);
    execute format('grant all on cac.%I to service_role', t);
    execute format('create policy "staff read" on cac.%I for select to authenticated using (cac.is_staff())', t);
  end loop;
end $$;

-- ── Settings ───────────────────────────────────────────────────────────────
-- lead_cadence: days until each follow-up step, counted from the previous step.
--   early = prelaunch / excavation (introduce to the architect, revisit later)
--   mid   = plinth / slabs in progress
--   late  = RCC completed / finishing (pool and tile decisions are close)

alter table cac.setting drop constraint setting_key_check;
alter table cac.setting add constraint setting_key_check check (key in ('review_url','response_target_minutes','user_hourly_run_limit','workspace_daily_run_limit',
  'lead_mail_query','lead_cadence','lead_owner_outreach','lead_owner_sales',
  'lead_mail_configured','lead_mail_last_poll','lead_mail_last_error','lead_mail_last_result'));
insert into cac.setting (key, value) values
  -- Reports are sent by prathamesh.meraki2025@gmail.com; admins change this in Settings → Lead reports.
  ('lead_mail_query', 'from:prathamesh.meraki2025@gmail.com has:attachment filename:xlsx newer_than:14d'),
  ('lead_cadence', '{"early": [7, 60, 90], "mid": [3, 14, 30, 60], "late": [1, 3, 7, 14]}'),
  ('lead_owner_outreach', ''), ('lead_owner_sales', ''),
  ('lead_mail_configured', 'false'), ('lead_mail_last_poll', ''), ('lead_mail_last_error', ''), ('lead_mail_last_result', '')
on conflict (key) do nothing;

create or replace function cac.setting_value(p_key text)
returns text language sql stable as $$ select value from cac.setting where key = p_key $$;

create or replace function cac.set_setting(p_key text, p_value text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), '{}');
  v_value text := btrim(coalesce(p_value, ''));
  v_plan jsonb; b text;
begin
  if p_key in ('lead_mail_configured','lead_mail_last_poll','lead_mail_last_error','lead_mail_last_result') then perform cac.fail('This setting is updated by the worker.'); end if;
  if p_key = 'review_url' and v_value <> '' and not cac.safe_url(v_value) then perform cac.fail('The review link must be a valid HTTPS URL.'); end if;
  if p_key = 'response_target_minutes' and (v_value !~ '^[0-9]{1,4}$' or v_value::int not between 5 and 1440) then perform cac.fail('Response target must be 5–1440 minutes.'); end if;
  if p_key = 'user_hourly_run_limit' and (v_value !~ '^[0-9]{1,4}$' or v_value::int not between 1 and 500) then perform cac.fail('Hourly runs per person must be 1–500.'); end if;
  if p_key = 'workspace_daily_run_limit' and (v_value !~ '^[0-9]{1,5}$' or v_value::int not between 1 and 10000) then perform cac.fail('Daily runs for the workspace must be 1–10000.'); end if;
  if p_key = 'lead_mail_query' and char_length(v_value) not between 3 and 500 then perform cac.fail('Enter a Gmail search of up to 500 characters, for example: from:reports@example.com has:attachment filename:xlsx'); end if;
  if p_key in ('lead_owner_outreach','lead_owner_sales') and v_value <> '' and not exists (select 1 from cac.staff where name = v_value and active) then
    perform cac.fail('Choose an active staff member, or leave it blank for the Sales queue.');
  end if;
  if p_key = 'lead_cadence' then
    begin v_plan := v_value::jsonb; exception when others then perform cac.fail('The follow-up schedule must be valid JSON.'); end;
    foreach b in array array['early','mid','late'] loop
      if jsonb_typeof(v_plan->b) is distinct from 'array' or jsonb_array_length(v_plan->b) not between 1 and 8
         or exists (select 1 from jsonb_array_elements(v_plan->b) d where jsonb_typeof(d) <> 'number' or d::text !~ '^[0-9]{1,3}$' or d::text::int > 365) then
        perform cac.fail(format('The %s schedule needs 1–8 whole numbers of days (0–365).', b));
      end if;
    end loop;
    v_value := v_plan::text;
  end if;
  update cac.setting set value = v_value, updated_at = now() where key = p_key;
  if not found then perform cac.fail('Unknown setting.'); end if;
  perform cac.log(v_actor.user_id, 'setting.updated', p_key, jsonb_build_object('value', v_value));
  return (select jsonb_object_agg(key, value) from cac.setting);
end $$;

-- ── Follow-up schedule ─────────────────────────────────────────────────────

create or replace function cac.lead_key(p_project text, p_builder text)
returns text language sql immutable as $$
  select regexp_replace(lower(coalesce(p_project, '') || '|' || coalesce(p_builder, '')), '[^a-z0-9|]', '', 'g');
$$;

create or replace function cac.lead_plan(p_bucket text)
returns int[] language sql stable as $$
  select coalesce(array(select d::int from jsonb_array_elements_text(cac.setting_value('lead_cadence')::jsonb -> p_bucket) d), '{}');
$$;

create or replace function cac.lead_owner(p_bucket text)
returns text language sql stable as $$
  select coalesce(nullif(cac.setting_value(case when p_bucket = 'early' then 'lead_owner_outreach' else 'lead_owner_sales' end), ''), 'Sales');
$$;

create or replace function cac.lead_step_name(p_bucket text, p_step int, p_project text)
returns text language sql immutable as $$
  select case
    when p_step = 1 and p_bucket = 'early' then 'Introduce Crystal Pools to the architect'
    when p_step = 1 and p_bucket = 'late' then 'Call the purchase manager: pool and tile decisions are close'
    when p_step = 1 then 'Call the purchase manager'
    when p_bucket = 'early' then 'Check design progress with the architect'
    else 'Follow up with the purchase manager' end || ' · ' || p_project;
$$;

-- Opens follow-up step p_step for a lead, due p_due (default: the plan's days
-- from today). Returns the task, or null when the plan has no more steps.
create or replace function cac.schedule_lead_step(p_actor uuid, p_lead uuid, p_step int, p_due date default null, p_prefix text default '')
returns jsonb language plpgsql as $$
declare
  v_lead cac.project_lead;
  v_plan int[];
  v_task jsonb;
  v_who text; v_architect text;
begin
  select * into v_lead from cac.project_lead where id = p_lead;
  v_plan := cac.lead_plan(v_lead.stage_bucket);
  if p_due is null and p_step > cardinality(v_plan) then
    perform cac.put('project_lead', jsonb_build_object('id', p_lead, 'next_follow_up', null));
    return null;
  end if;
  -- Who to call, with numbers, so the task is usable from My work alone.
  select string_agg(concat_ws(' · ', nullif(c->>'name', '') || coalesce(' (' || nullif(c->>'role', '') || ')', ''), nullif(c->>'phone', ''), nullif(c->>'email', '')), E'\n')
    into v_who from jsonb_array_elements(v_lead.contacts) c;
  -- Early-stage projects start with the architect; others fall back to them when no contact was listed.
  v_architect := nullif(concat_ws(' · ', nullif(v_lead.architect->>'firm', ''), nullif(v_lead.architect->>'name', ''), v_lead.architect->'phones'->>0, v_lead.architect->'emails'->>0), '');
  if v_architect is not null and (v_lead.stage_bucket = 'early' or v_who is null) then
    v_who := concat_ws(E'\n', 'Architect: ' || v_architect, v_who);
  end if;
  v_task := cac.put('task', jsonb_build_object('name', p_prefix || cac.lead_step_name(v_lead.stage_bucket, p_step, v_lead.name), 'project_lead_id', p_lead,
    'owner', v_lead.owner, 'due_date', coalesce(p_due, current_date + v_plan[p_step]), 'category', 'lead_followup', 'status', 'open',
    'notes', concat_ws(E'\n', v_lead.stage || coalesce(' · possession ' || nullif(v_lead.possession, ''), ''), v_who), 'created_by', p_actor));
  perform cac.put('project_lead', jsonb_build_object('id', p_lead, 'follow_up_step', p_step, 'next_follow_up', v_task->>'due_date'));
  return v_task;
end $$;

create or replace function cac.cancel_lead_tasks(p_actor uuid, p_lead uuid, p_reason text)
returns void language sql as $$
  update cac.task set status = 'cancelled', cancel_reason = p_reason, completed_by = p_actor, completed_at = now()
  where project_lead_id = p_lead and status in ('open','paused');
$$;

-- Completing a lead follow-up from the Tasks page opens the next step.
create or replace function cac.on_lead_task_done()
returns trigger language plpgsql as $$
declare v_lead cac.project_lead;
begin
  select * into v_lead from cac.project_lead where id = new.project_lead_id;
  if v_lead.status in ('New','Contacted','Meeting','Interested')
     and not exists (select 1 from cac.task where project_lead_id = new.project_lead_id and status = 'open' and id <> new.id) then
    perform cac.schedule_lead_step(coalesce(new.completed_by, new.created_by), new.project_lead_id, v_lead.follow_up_step + 1);
  end if;
  return null;
end $$;
create trigger on_lead_task_done after update of status on cac.task for each row
  when (old.status = 'open' and new.status = 'completed' and new.project_lead_id is not null and new.category = 'lead_followup')
  execute function cac.on_lead_task_done();

-- ── Receiving reports ──────────────────────────────────────────────────────

-- Gmail imports run as the longest-serving active admin.
create or replace function cac.lead_import_actor()
returns uuid language sql stable as $$
  select user_id from cac.staff where active and role = 'admin' order by created_at limit 1;
$$;

-- Records a report file once (by SHA-256) and queues its extraction run.
create or replace function cac.create_lead_import(p_actor uuid, p_values jsonb)
returns jsonb language plpgsql as $$
declare
  v_existing cac.lead_import;
  v_import jsonb;
  v_job uuid := gen_random_uuid();
  v_sheets jsonb := p_values->'sheets';
  v_error text := left(nullif(btrim(coalesce(p_values->>'error', '')), ''), 500);
  v_rows int := 0;
begin
  if coalesce(p_values->>'sha256', '') !~ '^[0-9a-f]{64}$' then perform cac.fail('The report file fingerprint is missing.'); end if;
  select * into v_existing from cac.lead_import where sha256 = p_values->>'sha256';
  if found then return (to_jsonb(v_existing) - 'sheets') || '{"duplicate": true}'; end if;
  if v_error is null then
    if jsonb_typeof(v_sheets) is distinct from 'array' or jsonb_array_length(v_sheets) = 0
       or exists (select 1 from jsonb_array_elements(v_sheets) s where jsonb_typeof(s->'rows') is distinct from 'array') then
      v_error := 'The file has no readable sheets.';
    elsif octet_length(v_sheets::text) > 3000000 then
      v_error := 'The report is too large (3 MB of cell text maximum).';
    else
      select coalesce(sum(jsonb_array_length(s->'rows')), 0) into v_rows from jsonb_array_elements(v_sheets) s;
    end if;
  end if;
  v_import := cac.put('lead_import', jsonb_build_object('name', left(coalesce(nullif(btrim(p_values->>'name'), ''), 'Lead report.xlsx'), 200),
    'source', p_values->>'source', 'sha256', p_values->>'sha256', 'mail_message_id', p_values->>'mail_message_id',
    'mail_from', left(p_values->>'mail_from', 300), 'mail_subject', left(p_values->>'mail_subject', 300), 'received_at', nullif(p_values->>'received_at', ''),
    'sheets', case when v_error is null then v_sheets end, 'row_count', v_rows, 'error', v_error,
    'status', case when v_error is null then 'queued' else 'failed' end, 'job_id', case when v_error is null then v_job end, 'created_by', p_actor));
  if v_error is null then
    insert into cac.job (id, dedupe, agent, target_id, target_kind, input, actor)
    values (v_job, 'leadimport:' || (p_values->>'sha256'), 'leadimport', (v_import->>'id')::uuid, 'lead_import',
      jsonb_build_object('target_version', (v_import->>'record_version')::int), p_actor);
  end if;
  perform cac.log(p_actor, 'leads.report_received', v_import->>'id', jsonb_build_object('source', p_values->>'source', 'name', v_import->>'name', 'error', v_error));
  return v_import - 'sheets';
end $$;

-- Staff upload: the browser reads the .xlsx and sends its cell text.
create or replace function cac.upload_lead_report(p_name text, p_sha256 text, p_sheets jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
begin
  if (select count(*) from cac.job where (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)
     >= (select value::int from cac.setting where key = 'workspace_daily_run_limit') then
    perform cac.fail('The workspace has reached today''s limit for assistant runs. An admin can raise it in Settings.', 'P0429');
  end if;
  return cac.create_lead_import(v_actor.user_id, jsonb_build_object('source', 'upload', 'name', p_name, 'sha256', lower(coalesce(p_sha256, '')), 'sheets', p_sheets));
end $$;

-- Worker: is a Gmail check due? Claims the 15-minute slot, so two workers never both poll.
create or replace function cac.mail_poll_begin(p_configured boolean)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_last text;
begin
  update cac.setting set value = p_configured::text, updated_at = now() where key = 'lead_mail_configured' and value <> p_configured::text;
  if not p_configured then return jsonb_build_object('due', false); end if;
  select value into v_last from cac.setting where key = 'lead_mail_last_poll' for update;
  if v_last <> '' and v_last::timestamptz > now() - interval '15 minutes' then return jsonb_build_object('due', false); end if;
  update cac.setting set value = now()::text, updated_at = now() where key = 'lead_mail_last_poll';
  return jsonb_build_object('due', true, 'query', cac.setting_value('lead_mail_query'));
end $$;

create or replace function cac.mail_known(p_ids jsonb)
returns jsonb language sql stable security definer set search_path = cac, public as $$
  select coalesce(jsonb_agg(id), '[]') from cac.mail_message where id in (select jsonb_array_elements_text(case when jsonb_typeof(p_ids) = 'array' then p_ids else '[]' end));
$$;

-- Worker: records one email and its report files in one transaction.
create or replace function cac.mail_record_message(p_id text, p_from text, p_subject text, p_received_at timestamptz, p_files jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor uuid := cac.lead_import_actor();
  f jsonb;
  v_imports jsonb := '[]';
begin
  if exists (select 1 from cac.mail_message where id = p_id) then return jsonb_build_object('duplicate', true); end if;
  if v_actor is null then perform cac.fail('Add an active CAC admin before importing lead reports.'); end if;
  for f in select * from jsonb_array_elements(case when jsonb_typeof(p_files) = 'array' then p_files else '[]' end) loop
    v_imports := v_imports || jsonb_build_array(cac.create_lead_import(v_actor, f || jsonb_build_object('source', 'gmail', 'mail_message_id', p_id,
      'mail_from', p_from, 'mail_subject', p_subject, 'received_at', p_received_at)));
  end loop;
  insert into cac.mail_message (id, mail_from, subject, received_at, files) values (p_id, left(p_from, 300), left(p_subject, 300), p_received_at, jsonb_array_length(v_imports));
  return jsonb_build_object('imports', v_imports);
end $$;

create or replace function cac.mail_poll_end(p_error text, p_summary text)
returns void language sql security definer set search_path = cac, public as $$
  update cac.setting set value = left(coalesce(p_error, ''), 500), updated_at = now() where key = 'lead_mail_last_error';
  update cac.setting set value = left(p_summary, 300), updated_at = now() where key = 'lead_mail_last_result' and p_summary is not null;
$$;

-- Staff: "Check Gmail now" (the next worker pass polls immediately).
create or replace function cac.request_mail_check()
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
begin
  if cac.setting_value('lead_mail_configured') <> 'true' then perform cac.fail('Gmail is not connected yet. See Settings → Lead reports.'); end if;
  update cac.setting set value = '', updated_at = now() where key = 'lead_mail_last_poll';
  perform cac.log(v_actor.user_id, 'leads.mail_check_requested', 'gmail');
  return jsonb_build_object('ok', true);
end $$;

-- Worker: saves the extracted leads. Lead reports are internal data, so they
-- update the list directly; outreach to these contacts still goes through review.
create or replace function cac.complete_lead_import(p_job uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_job cac.job;
  v_actor cac.staff;
  v_import jsonb;
  l jsonb;
  v_lead cac.project_lead;
  v_saved jsonb;
  v_fields jsonb;
  v_rank jsonb := '{"early": 1, "mid": 2, "late": 3}';
  v_created int := 0; v_updated int := 0; v_advanced int := 0; v_skipped int := 0;
  v_seen text[] := '{}';
  v_key text;
begin
  select * into v_job from cac.job where id = p_job for update;
  if not found or v_job.status <> 'running' or v_job.analysis is null or v_job.agent <> 'leadimport' then perform cac.fail('Run is not ready to complete.'); end if;
  v_import := cac.get('lead_import', v_job.target_id, true);
  if v_import is null or (v_import->>'record_version')::int <> (v_job.input->>'target_version')::int then perform cac.fail('Report changed during analysis. Start a fresh run.'); end if;
  v_actor := cac.require_role(v_job.actor, array['sales']);
  if jsonb_typeof(v_job.analysis->'leads') is distinct from 'array' then perform cac.fail('The analysis has no leads list.'); end if;

  for l in select * from jsonb_array_elements(v_job.analysis->'leads') loop
    v_key := cac.lead_key(l->>'project_name', l->'builder'->>'name');
    if cac.blank(l, 'project_name') or coalesce(l->>'stage_bucket', '') not in ('early','mid','late') or coalesce(l->>'priority', '') not in ('Hot','Warm','Cold')
       or v_key = any(v_seen) then
      v_skipped := v_skipped + 1; continue;
    end if;
    v_seen := v_seen || v_key;
    v_fields := jsonb_build_object('name', left(btrim(l->>'project_name'), 160), 'dedupe_key', v_key,
      'project_type', left(nullif(btrim(l->>'project_type'), ''), 80),
      'builder', case when jsonb_typeof(l->'builder') = 'object' then l->'builder' else '{}' end,
      'architect', case when jsonb_typeof(l->'architect') = 'object' then l->'architect' else '{}' end,
      'contacts', case when jsonb_typeof(l->'contacts') = 'array' then l->'contacts' else '[]' end,
      'landmark', left(nullif(btrim(l->>'landmark'), ''), 300), 'area', left(nullif(btrim(l->>'area'), ''), 80), 'pincode', left(nullif(btrim(l->>'pincode'), ''), 6),
      'details', left(nullif(btrim(l->>'details'), ''), 300),
      'towers', case when jsonb_typeof(l->'towers') = 'number' then l->'towers' end, 'units', case when jsonb_typeof(l->'units') = 'number' then l->'units' end,
      'stage', left(nullif(btrim(l->>'stage'), ''), 120), 'stage_bucket', l->>'stage_bucket', 'possession', left(nullif(btrim(l->>'possession'), ''), 40),
      'products', case when jsonb_typeof(l->'products') = 'array' then l->'products' else '[]' end,
      'pool_mentioned', coalesce(l->'pool_mentioned' = 'true', false),
      'fit', case when jsonb_typeof(l->'fit') = 'array' then l->'fit' else '[]' end,
      'priority', l->>'priority', 'function_area', left(l->>'function_area', 80),
      'import_id', v_import->>'id', 'report_serial', case when jsonb_typeof(l->'serial') = 'number' then l->'serial' end);

    select * into v_lead from cac.project_lead where dedupe_key = v_key for update;
    if not found then
      v_saved := cac.put('project_lead', v_fields || jsonb_build_object('owner', cac.lead_owner(l->>'stage_bucket'), 'status', 'New', 'created_by', v_actor.user_id,
        'history', jsonb_build_array(jsonb_build_object('at', now(), 'report', v_import->>'name', 'stage', l->>'stage', 'possession', l->>'possession'))));
      perform cac.schedule_lead_step(v_actor.user_id, (v_saved->>'id')::uuid, 1);
      v_created := v_created + 1;
    else
      v_saved := cac.put('project_lead', v_fields || jsonb_build_object('id', v_lead.id,
        -- A lead still with the default owner for its old stage moves to the default owner for its new stage.
        'owner', case when v_lead.owner = cac.lead_owner(v_lead.stage_bucket) then cac.lead_owner(l->>'stage_bucket') else v_lead.owner end,
        'history', v_lead.history || case when v_lead.stage is distinct from v_fields->>'stage' or v_lead.possession is distinct from v_fields->>'possession'
          then jsonb_build_array(jsonb_build_object('at', now(), 'report', v_import->>'name', 'stage', l->>'stage', 'possession', l->>'possession')) else '[]' end));
      if (v_rank->>(l->>'stage_bucket'))::int > (v_rank->>v_lead.stage_bucket)::int and v_lead.status in ('New','Contacted','Meeting','Interested') then
        perform cac.cancel_lead_tasks(v_actor.user_id, v_lead.id, 'Construction stage advanced');
        perform cac.schedule_lead_step(v_actor.user_id, v_lead.id, 1, null, 'Stage advanced: ');
        perform cac.put('comment', jsonb_build_object('name', v_lead.name, 'target_kind', 'project_lead', 'target_id', v_lead.id, 'kind', 'system',
          'body', format('%s: construction stage moved from "%s" to "%s". Follow-ups restarted.', v_import->>'name', coalesce(v_lead.stage, 'not recorded'), l->>'stage')));
        v_advanced := v_advanced + 1;
      end if;
      v_updated := v_updated + 1;
    end if;
  end loop;

  perform cac.put('lead_import', jsonb_build_object('id', v_import->>'id', 'status', 'imported',
    'result', jsonb_build_object('created', v_created, 'updated', v_updated, 'advanced', v_advanced, 'skipped', v_skipped, 'missing', coalesce(v_job.analysis->'missing', '[]'))));
  update cac.job set status = 'completed', step = 'completed', completed_at = now(), locked_until = null,
    trace = trace || jsonb_build_array(jsonb_build_object('step', 'leads_saved', 'at', now(), 'created', v_created, 'updated', v_updated))
    where id = p_job returning * into v_job;
  perform cac.log(v_actor.user_id, 'leads.imported', v_import->>'id', jsonb_build_object('created', v_created, 'updated', v_updated, 'advanced', v_advanced, 'skipped', v_skipped));
  return to_jsonb(v_job);
end $$;

-- ── Working a lead ─────────────────────────────────────────────────────────

create or replace function cac.add_comment(p_kind text, p_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales','engineer','commercial','project']);
  v_target jsonb;
  v_result jsonb;
begin
  if p_kind not in ('project_lead','opportunity','customer','prospect') then perform cac.fail('Comments are not available on this record.'); end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then perform cac.fail('Write a comment of up to 4,000 characters.'); end if;
  v_target := cac.related(p_kind, p_id);
  v_result := cac.put('comment', jsonb_build_object('name', left(v_target->>'name', 160), 'target_kind', p_kind, 'target_id', p_id, 'kind', 'note', 'body', btrim(p_body), 'created_by', v_actor.user_id));
  perform cac.log(v_actor.user_id, 'comment.added', p_id::text, jsonb_build_object('kind', p_kind));
  return v_result;
end $$;

-- Records a call or visit and schedules the next step: a retry for no answer or
-- a call-back, otherwise the next step of the stage's plan (or the chosen date).
create or replace function cac.log_lead_contact(p_lead uuid, p_outcome text, p_note text default '', p_next date default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
  v_lead cac.project_lead;
  v_status text;
  v_open uuid[];
  v_next jsonb;
begin
  select * into v_lead from cac.project_lead where id = p_lead for update;
  if not found then perform cac.fail('A valid project lead is required.'); end if;
  if v_lead.status not in ('New','Contacted','Meeting','Interested') then perform cac.fail('Reopen the lead before logging contact.'); end if;
  if p_outcome not in ('Reached','No answer','Call back later','Meeting booked','Interested','Not relevant') then perform cac.fail('Choose the outcome of the call or visit.'); end if;
  if p_next is not null and p_next < current_date then perform cac.fail('The next follow-up cannot be in the past.'); end if;
  if char_length(coalesce(p_note, '')) > 3000 then perform cac.fail('Keep the note under 3,000 characters.'); end if;
  v_status := case p_outcome when 'Reached' then case when v_lead.status = 'New' then 'Contacted' else v_lead.status end
    when 'Meeting booked' then 'Meeting' when 'Interested' then 'Interested' when 'Not relevant' then 'Not relevant' else v_lead.status end;
  perform cac.put('comment', jsonb_build_object('name', v_lead.name, 'target_kind', 'project_lead', 'target_id', p_lead, 'kind', 'contact',
    'body', p_outcome || coalesce(': ' || nullif(btrim(p_note), ''), ''), 'created_by', v_actor.user_id));
  perform cac.put('project_lead', jsonb_build_object('id', p_lead, 'status', v_status, 'last_contact_at', now(), 'last_outcome', p_outcome,
    'close_reason', case when v_status = 'Not relevant' then nullif(btrim(p_note), '') end));
  select coalesce(array_agg(id), '{}') into v_open from cac.task where project_lead_id = p_lead and status = 'open';
  if v_status = 'Not relevant' then
    perform cac.cancel_lead_tasks(v_actor.user_id, p_lead, 'Lead closed: not relevant');
    perform cac.put('project_lead', jsonb_build_object('id', p_lead, 'next_follow_up', null));
  else
    -- Open the next step first, so completing the current task does not schedule another.
    if p_outcome in ('No answer','Call back later') then
      v_next := cac.schedule_lead_step(v_actor.user_id, p_lead, greatest(v_lead.follow_up_step, 1),
        coalesce(p_next, current_date + case when p_outcome = 'No answer' then 2 else 7 end), case when p_outcome = 'No answer' then 'Retry: ' else 'Call back: ' end);
    else
      v_next := cac.schedule_lead_step(v_actor.user_id, p_lead, v_lead.follow_up_step + 1, p_next);
    end if;
    update cac.task set status = 'completed', completed_by = v_actor.user_id, completed_at = now() where id = any(v_open);
  end if;
  perform cac.log(v_actor.user_id, 'lead.contact_logged', p_lead::text, jsonb_build_object('outcome', p_outcome));
  return jsonb_build_object('lead', cac.get('project_lead', p_lead), 'next_task', v_next);
end $$;

-- Close (Lost / Not relevant) with a reason, or reopen (status Open).
create or replace function cac.set_lead_status(p_lead uuid, p_status text, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
  v_lead cac.project_lead;
begin
  select * into v_lead from cac.project_lead where id = p_lead for update;
  if not found then perform cac.fail('A valid project lead is required.'); end if;
  if v_lead.status = 'Converted' then perform cac.fail('This lead is already an opportunity. Work it in the sales pipeline.'); end if;
  if p_status in ('Lost','Not relevant') then
    if char_length(btrim(coalesce(p_reason, ''))) < 3 then perform cac.fail('Give a short reason for closing the lead.'); end if;
    perform cac.cancel_lead_tasks(v_actor.user_id, p_lead, 'Lead closed: ' || lower(p_status));
    perform cac.put('project_lead', jsonb_build_object('id', p_lead, 'status', p_status, 'close_reason', btrim(p_reason), 'next_follow_up', null));
    perform cac.put('comment', jsonb_build_object('name', v_lead.name, 'target_kind', 'project_lead', 'target_id', p_lead, 'kind', 'system', 'body', format('Closed as %s: %s', p_status, btrim(p_reason)), 'created_by', v_actor.user_id));
  elsif p_status = 'Open' then
    if v_lead.status not in ('Lost','Not relevant') then perform cac.fail('This lead is already open.'); end if;
    perform cac.put('project_lead', jsonb_build_object('id', p_lead, 'status', case when v_lead.last_contact_at is null then 'New' else 'Contacted' end, 'close_reason', null));
    perform cac.schedule_lead_step(v_actor.user_id, p_lead, greatest(v_lead.follow_up_step, 1), current_date + 1, 'Reopened: ');
    perform cac.put('comment', jsonb_build_object('name', v_lead.name, 'target_kind', 'project_lead', 'target_id', p_lead, 'kind', 'system', 'body', 'Reopened' || coalesce(': ' || nullif(btrim(p_reason), ''), ''), 'created_by', v_actor.user_id));
  else
    perform cac.fail('Choose Lost, Not relevant or Open.');
  end if;
  perform cac.log(v_actor.user_id, 'lead.status_changed', p_lead::text, jsonb_build_object('status', p_status));
  return cac.get('project_lead', p_lead);
end $$;

create or replace function cac.assign_project_lead(p_lead uuid, p_owner text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
  v_owner text := btrim(coalesce(p_owner, ''));
begin
  perform cac.related('project_lead', p_lead, true);
  if v_owner not in ('Sales','Marketing') and not exists (select 1 from cac.staff where name = v_owner and active) then
    perform cac.fail('Choose an active staff member, or the Sales or Marketing queue.');
  end if;
  update cac.task set owner = v_owner where project_lead_id = p_lead and status in ('open','paused');
  perform cac.log(v_actor.user_id, 'lead.assigned', p_lead::text, jsonb_build_object('owner', v_owner));
  return cac.put('project_lead', jsonb_build_object('id', p_lead, 'owner', v_owner));
end $$;

-- Turns a lead into customer (the builder), site, contact and an opportunity in the pipeline.
-- p_contact is the index of the person in the lead's contacts list (null: no contact).
create or replace function cac.convert_project_lead(p_lead uuid, p_contact int default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
  v_lead cac.project_lead;
  v_person jsonb; v_customer jsonb; v_site jsonb; v_contact jsonb; v_opp jsonb;
  v_builder text; v_email text; v_phone text;
begin
  select * into v_lead from cac.project_lead where id = p_lead for update;
  if not found then perform cac.fail('A valid project lead is required.'); end if;
  if v_lead.converted_opportunity_id is not null then perform cac.fail('This lead already has an opportunity.', 'P0409'); end if;
  if v_lead.status in ('Lost','Not relevant') then perform cac.fail('Reopen the lead before converting it.'); end if;
  if p_contact is not null and (p_contact < 0 or p_contact >= jsonb_array_length(v_lead.contacts)) then perform cac.fail('Choose one of the lead''s contacts.'); end if;
  v_person := case when p_contact is not null then v_lead.contacts->p_contact end;
  v_builder := coalesce(nullif(btrim(v_lead.builder->>'name'), ''), v_lead.name);
  v_email := nullif(v_lead.builder->'emails'->>0, '');
  v_phone := nullif(v_lead.builder->'phones'->>0, '');

  -- The builder may already be a customer (several projects, or an earlier enquiry).
  select to_jsonb(c) into v_customer from cac.customer c
    where lower(btrim(c.name)) = lower(v_builder)
       or (v_email is not null and lower(btrim(c.email)) = lower(v_email))
       or (char_length(coalesce(cac.normalize_phone(v_phone), '')) = 10 and cac.normalize_phone(c.phone) = cac.normalize_phone(v_phone))
    order by c.created_at limit 1;
  if v_customer is null then
    v_customer := cac.put('customer', jsonb_build_object('name', v_builder, 'segment', 'Developer', 'email', v_email, 'phone', v_phone,
      'notes', concat_ws(E'\n', 'Created from a project lead report.', nullif(v_lead.builder->>'address', '')), 'created_by', v_actor.user_id));
  end if;
  if (v_customer->>'suppressed')::boolean then perform cac.fail('This customer has opted out.'); end if;
  v_site := cac.put('site', jsonb_build_object('name', v_lead.name || coalesce(' · ' || v_lead.area, ''), 'customer_id', v_customer->>'id',
    'location', v_lead.area, 'address', v_lead.landmark, 'notes', concat_ws(E'\n', v_lead.details, v_lead.stage, 'Possession ' || v_lead.possession), 'created_by', v_actor.user_id));
  if v_person is not null and nullif(btrim(v_person->>'name'), '') is not null then
    v_contact := cac.put('contact', jsonb_build_object('name', v_person->>'name', 'customer_id', v_customer->>'id', 'email', nullif(v_person->>'email', ''),
      'phone', nullif(v_person->>'phone', ''), 'position', nullif(v_person->>'role', ''), 'permission', 'Not recorded', 'created_by', v_actor.user_id));
  end if;
  v_opp := cac.put('opportunity', jsonb_build_object('name', v_lead.name || ' · ' || case when v_lead.pool_mentioned then 'swimming pool' else 'pool, tiles and FRP' end,
    'customer_id', v_customer->>'id', 'site_id', v_site->>'id', 'contact_id', v_contact->>'id', 'route', 'Commercial', 'source', 'Project lead report',
    'owner_id', v_actor.user_id, 'location', v_lead.area,
    'pool_type', case when v_lead.pool_mentioned then 'Swimming pool (listed in project amenities)' end,
    'timeline', case when v_lead.possession is not null then 'Possession ' || v_lead.possession end,
    'notes', concat_ws(E'\n', 'From the project lead report.', 'Stage: ' || v_lead.stage, v_lead.details, 'Amenities: ' || (select string_agg(p, ', ') from jsonb_array_elements_text(v_lead.products) p),
      'Architect: ' || nullif(concat_ws(' · ', nullif(v_lead.architect->>'firm', ''), nullif(v_lead.architect->>'name', '')), '')),
    'next_action', 'Confirm requirements and the decision-maker', 'next_action_date', current_date + 2, 'created_by', v_actor.user_id));
  -- The lead was already contacted from the lead list: that is the human response.
  if v_lead.last_contact_at is not null then
    perform cac.put('activity', jsonb_build_object('name', 'Contacted from the project lead list', 'opportunity_id', v_opp->>'id', 'type', 'Human response',
      'channel', 'Phone', 'direction', 'Outbound', 'notes', 'Last outcome: ' || coalesce(v_lead.last_outcome, 'recorded') || '. See the lead''s comments for the history.', 'created_by', v_actor.user_id));
  end if;
  perform cac.cancel_lead_tasks(v_actor.user_id, p_lead, 'Converted to an opportunity');
  perform cac.put('project_lead', jsonb_build_object('id', p_lead, 'status', 'Converted', 'converted_opportunity_id', v_opp->>'id', 'next_follow_up', null));
  perform cac.put('comment', jsonb_build_object('name', v_lead.name, 'target_kind', 'project_lead', 'target_id', p_lead, 'kind', 'system',
    'body', 'Converted to opportunity ' || (v_opp->>'name'), 'created_by', v_actor.user_id));
  perform cac.log(v_actor.user_id, 'lead.converted', p_lead::text, jsonb_build_object('opportunityId', v_opp->>'id'));
  return v_opp;
end $$;

-- ── Workspace snapshot and backup (with the new tables) ────────────────────

create or replace function cac.workspace_state()
returns jsonb language plpgsql stable security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.actor(auth.uid());
  v_records jsonb := '{}';
  k text;
  v jsonb;
begin
  foreach k in array array['customer','contact','site','prospect','opportunity','activity','task','survey','rate','portfolio','campaign','project','change','payment','maintenance','quote','draft','approval','revision','attachment','appointment','service_visit','review_request','knowledge','briefing','project_lead','lead_import','comment'] loop
    -- Report cell text stays in the database; the app only needs the import summary.
    execute format('select coalesce(jsonb_agg(to_jsonb(t) - ''sheets'' order by t.created_at desc), ''[]'') from cac.%I t', k) into v;
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

create or replace function cac.export_workspace()
returns jsonb language plpgsql stable security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), '{}');
  v_out jsonb := '{}';
  k text; v jsonb;
begin
  foreach k in array array['staff','customer','contact','site','prospect','campaign','opportunity','activity','task','survey','rate','portfolio','quote','revision',
    'project','change','payment','maintenance','draft','approval','attachment','lead_link','appointment','service_visit','review_request','knowledge','briefing','setting','job','event',
    'project_lead','lead_import','comment','mail_message'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]'') from cac.%I t', k) into v;
    v_out := v_out || jsonb_build_object(k, v);
  end loop;
  return jsonb_build_object('exported_at', now(), 'exported_by', v_actor.email, 'schema_migrations', (select jsonb_agg(name order by name) from cac.schema_migrations), 'tables', v_out,
    'note', 'Survey photo files stay in the cac-survey-photos Storage bucket; attachment rows list their paths. Passwords are never exported.');
end $$;

-- ── Grants: new functions are not callable until granted ───────────────────

do $$
declare fn record;
begin
  for fn in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'cac'::regnamespace
    and p.proname in ('setting_value','lead_key','lead_plan','lead_owner','lead_step_name','schedule_lead_step','cancel_lead_tasks','on_lead_task_done','lead_import_actor',
      'create_lead_import','upload_lead_report','mail_poll_begin','mail_known','mail_record_message','mail_poll_end','request_mail_check','complete_lead_import',
      'add_comment','log_lead_contact','set_lead_status','assign_project_lead','convert_project_lead') loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn.sig);
  end loop;
end $$;

grant execute on function
  cac.upload_lead_report(text, text, jsonb), cac.request_mail_check(), cac.add_comment(text, uuid, text),
  cac.log_lead_contact(uuid, text, text, date), cac.set_lead_status(uuid, text, text), cac.assign_project_lead(uuid, text), cac.convert_project_lead(uuid, int)
to authenticated;

grant execute on function
  cac.mail_poll_begin(boolean), cac.mail_known(jsonb), cac.mail_record_message(text, text, text, timestamptz, jsonb), cac.mail_poll_end(text, text), cac.complete_lead_import(uuid)
to service_role;
