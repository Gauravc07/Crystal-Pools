-- ============================================================================
-- CAC engagement layer (ideas adapted from Podium's dealership platform):
--   * speed to lead: enquiry time, first human response, response target
--   * one conversation log: channel + direction on activities, missed calls
--   * appointments: consultations, site and service visits, reminders, no-shows
--   * service visits: recommendations and declined-service follow-up
--   * review requests after handover
--   * lifecycle lists: warranty, AMC renewal, service overdue, first service,
--     dormant enquiries, lost/deferred re-engagement, equipment advisories
--   * knowledge base used by the assistants
--   * owner assistant: plan from live metrics, tasks created on approval
-- Functions changed here are redefined in full; 0001–0004 are already applied.
-- ============================================================================

-- ── Columns on existing tables ─────────────────────────────────────────────

alter table cac.opportunity add column enquiry_at timestamptz;
update cac.opportunity set enquiry_at = created_at;
alter table cac.opportunity alter column enquiry_at set default now(), alter column enquiry_at set not null;

alter table cac.activity add column channel text check (channel in ('Phone','WhatsApp','Email','Website','Walk-in','Site','Other'));
alter table cac.activity add column direction text check (direction in ('Inbound','Outbound'));
alter table cac.activity drop constraint activity_type_check;
alter table cac.activity add constraint activity_type_check check (type in ('Human response','Customer reply','Missed call','Call','Meeting','Site update','Note'));

-- ── New tables ─────────────────────────────────────────────────────────────

create table cac.setting (
  key text primary key check (key in ('review_url','response_target_minutes')),
  value text not null,
  updated_at timestamptz not null default now()
);
insert into cac.setting (key, value) values ('review_url', ''), ('response_target_minutes', '60');

create table cac.appointment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opportunity_id uuid references cac.opportunity(id),
  maintenance_id uuid references cac.maintenance(id),
  type text not null check (type in ('Consultation','Site visit','Service visit','Handover')),
  starts_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes between 15 and 720),
  location text, assigned_to text, notes text, outcome text,
  rescheduled_from timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','no_show','cancelled')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1,
  check (opportunity_id is not null or maintenance_id is not null)
);
create index on cac.appointment (starts_at);

create table cac.service_visit (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  maintenance_id uuid not null references cac.maintenance(id),
  visit_date date not null,
  technician text, work_done text, water_readings text, recommendations text,
  decision text not null default 'None' check (decision in ('None','Pending','Accepted','Declined')),
  status text not null default 'recorded',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);
create index on cac.service_visit (maintenance_id);

create table cac.review_request (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid not null unique references cac.project(id),
  customer_id uuid not null references cac.customer(id),
  body text not null,
  rating int check (rating between 1 and 5),
  simulated_at timestamptz, received_at timestamptz,
  status text not null default 'to_send' check (status in ('to_send','sent','received','declined')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.knowledge (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text check (category in ('FAQ','Policy','Process','Service area','Objection')),
  content text,
  status text not null default 'draft',
  approved_by uuid, approved_at timestamptz,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.briefing (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 500),
  status text not null default 'asked',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

alter table cac.task add column appointment_id uuid references cac.appointment(id);
alter table cac.task add column maintenance_id uuid references cac.maintenance(id);
alter table cac.task add column lifecycle_key text;
create index on cac.task (lifecycle_key) where lifecycle_key is not null;

insert into cac.agent values
  ('operator', 10, 'Owner assistant', 'briefing', 'admin', 'Answer an owner question from live workspace metrics and propose a prioritised plan. Approved actions become tasks.', '{read workspace metrics,build plan,create tasks after approval}', 'Review required');

do $$
declare t text;
begin
  foreach t in array array['appointment','service_visit','review_request','knowledge','briefing'] loop
    execute format('create trigger touch before insert or update on cac.%I for each row execute function cac.touch()', t);
  end loop;
  foreach t in array array['setting','appointment','service_visit','review_request','knowledge','briefing'] loop
    execute format('alter table cac.%I enable row level security', t);
    execute format('revoke all on cac.%I from anon, authenticated', t);
    execute format('grant select on cac.%I to authenticated', t);
    execute format('grant all on cac.%I to service_role', t);
    execute format('create policy "staff read" on cac.%I for select to authenticated using (cac.is_staff())', t);
  end loop;
end $$;

-- ── Generic record writes (redefined with the new record types) ────────────

create or replace function cac.editable_fields(p_kind text)
returns text[] language sql immutable as $$
  select case p_kind
    when 'customer'      then array['name','segment','email','phone','notes']
    when 'contact'       then array['name','customer_id','email','phone','position','permission']
    when 'site'          then array['name','customer_id','location','address','notes']
    when 'prospect'      then array['name','segment','location','website','source_url','evidence','contact','service','existing_pool','open_questions','research_date']
    when 'opportunity'   then array['name','customer_id','site_id','contact_id','route','source','owner_id','enquiry_at','location','pool_type','budget','timeline','decision_maker','notes','next_action','next_action_date','visit_date','visit_confirmed','agreement_ref','loss_reason']
    when 'activity'      then array['name','opportunity_id','type','channel','direction','notes']
    when 'task'          then array['name','opportunity_id','owner','due_date','notes']
    when 'survey'        then array['name','opportunity_id','length','width','depth','access','electrical','drainage','photos','notes']
    when 'rate'          then array['name','unit','price','tax','scope']
    when 'portfolio'     then array['name','segment','description','source_url']
    when 'campaign'      then array['name','type','region','notes','cost','effort_hours']
    when 'project'       then array['name','opportunity_id','milestones','site_updates','handover_checklist']
    when 'change'        then array['name','project_id','scope','amount','customer_approval']
    when 'payment'       then array['name','opportunity_id','amount','reference','received_on']
    when 'maintenance'   then array['name','customer_id','site_id','equipment','warranty_date','service_history','next_service','renewal_date','referral']
    when 'appointment'   then array['name','opportunity_id','maintenance_id','type','starts_at','duration_minutes','location','assigned_to','notes']
    when 'service_visit' then array['name','maintenance_id','visit_date','technician','work_done','water_readings','recommendations','decision']
    when 'knowledge'     then array['name','category','content']
    when 'briefing'      then array['name']
  end;
$$;

create or replace function cac.writer_roles(p_kind text)
returns text[] language sql immutable as $$
  select case p_kind
    when 'customer' then array['sales'] when 'contact' then array['sales'] when 'site' then array['sales','engineer']
    when 'prospect' then array['sales'] when 'opportunity' then array['sales'] when 'activity' then array['sales','engineer','project']
    when 'task' then array['sales','engineer','commercial','project'] when 'survey' then array['engineer'] when 'rate' then array['commercial']
    when 'portfolio' then array['sales'] when 'campaign' then array['sales'] when 'project' then array['project']
    when 'change' then array['project'] when 'payment' then array['commercial'] when 'maintenance' then array['project','sales']
    when 'appointment' then array['sales','engineer','project'] when 'service_visit' then array['project','engineer']
    when 'knowledge' then array['sales'] when 'briefing' then '{}'::text[]
  end;
$$;

create or replace function cac.write_record_as(p_user uuid, p_kind text, p_values jsonb, p_id uuid default null)
returns jsonb language plpgsql as $$
declare
  v_fields text[] := cac.editable_fields(p_kind);
  v_actor cac.staff;
  v_old jsonb;
  v_clean jsonb := '{}';
  v_rec jsonb;
  v_result jsonb;
  k text; v jsonb; f text; n numeric; d date; ts timestamptz;
  v_con text; v_col text;
begin
  if v_fields is null then perform cac.fail('Unknown record type.'); end if;
  v_actor := cac.require_role(p_user, cac.writer_roles(p_kind));
  if p_values is null or jsonb_typeof(p_values) <> 'object' then perform cac.fail('Send the record fields as an object.'); end if;

  if p_id is not null then
    v_old := cac.related(p_kind, p_id, true);
    if v_old->>'status' in ('approved','verified') and p_kind in ('survey','rate','portfolio','change','payment','prospect','knowledge') then
      perform cac.fail('Approved records are immutable. Create a new record for changes.');
    end if;
  end if;

  -- Only whitelisted, scalar fields. Status, stage and approval fields cannot be written here.
  for k, v in select * from jsonb_each(p_values) loop
    if k = any(v_fields) then
      if jsonb_typeof(v) not in ('string','number','boolean','null') then perform cac.fail(format('Invalid %s.', replace(k, '_', ' '))); end if;
      if jsonb_typeof(v) = 'string' and char_length(v #>> '{}') > 20000 then perform cac.fail(format('%s is too long.', replace(k, '_', ' '))); end if;
      if jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '' then v := 'null'; end if;
      v_clean := v_clean || jsonb_build_object(k, v);
    end if;
  end loop;
  v_rec := coalesce(v_old, '{}') || v_clean;

  foreach f in array array['amount','price','tax','budget','cost','effort_hours','length','width','depth','duration_minutes'] loop
    if not cac.blank(v_rec, f) then
      if (v_rec->>f) !~ '^[0-9]+(\.[0-9]+)?$' then perform cac.fail(format('%s must be a valid non-negative number.', replace(f, '_', ' '))); end if;
      n := (v_rec->>f)::numeric;
      if n > 1e10 then perform cac.fail(format('%s must be a valid non-negative number.', replace(f, '_', ' '))); end if;
    end if;
  end loop;
  if not cac.blank(v_rec, 'duration_minutes') and ((v_rec->>'duration_minutes')::numeric % 1 <> 0 or (v_rec->>'duration_minutes')::numeric not between 15 and 720) then
    perform cac.fail('duration minutes must be a whole number from 15 to 720.');
  end if;
  foreach f in array array['due_date','renewal_date','next_service','next_action_date','visit_date','research_date','warranty_date','received_on'] loop
    if not cac.blank(v_rec, f) then
      begin d := (v_rec->>f)::date;
      exception when others then perform cac.fail(format('Invalid %s.', replace(f, '_', ' ')));
      end;
    end if;
  end loop;
  foreach f in array array['starts_at','enquiry_at'] loop
    if not cac.blank(v_rec, f) then
      begin ts := (v_rec->>f)::timestamptz;
      exception when others then perform cac.fail(format('Invalid %s.', replace(f, '_', ' ')));
      end;
    end if;
  end loop;
  if v_rec ? 'visit_confirmed' and jsonb_typeof(v_rec->'visit_confirmed') not in ('boolean','null') then
    perform cac.fail('visit confirmed must be true or false.');
  end if;

  if p_kind = 'opportunity' and v_old is not null then
    if (v_rec->>'customer_id' is distinct from v_old->>'customer_id' or v_rec->>'site_id' is distinct from v_old->>'site_id')
       and (exists (select 1 from cac.survey where opportunity_id = p_id) or exists (select 1 from cac.quote where opportunity_id = p_id) or exists (select 1 from cac.project where opportunity_id = p_id)) then
      perform cac.fail('Customer and site cannot change after a survey, quotation or project exists. Create a separate opportunity.');
    end if;
    if (v_rec->>'budget')::numeric is distinct from (v_old->>'budget')::numeric
       or exists (select 1 from unnest(array['location','pool_type','timeline','decision_maker']) q
                  where coalesce(v_rec->>q, '') is distinct from coalesce(v_old->>q, '')) then
      v_rec := v_rec || '{"qualification_reviewed": false}';
    end if;
  end if;

  perform cac.require_fields(v_rec, array['name']);
  foreach f in array array['website','source_url'] loop
    if not cac.blank(v_rec, f) and not cac.safe_url(v_rec->>f) then perform cac.fail(format('%s must be a valid HTTPS URL.', replace(f, '_', ' '))); end if;
  end loop;
  for f, k in select * from (values ('customer_id','customer'),('site_id','site'),('contact_id','contact'),('opportunity_id','opportunity'),('project_id','project'),('maintenance_id','maintenance')) x(a,b) loop
    if not cac.blank(v_rec, f) then perform cac.related(k, (v_rec->>f)::uuid); end if;
  end loop;
  if not cac.blank(v_rec, 'site_id') and (select customer_id::text from cac.site where id = (v_rec->>'site_id')::uuid) is distinct from v_rec->>'customer_id' then
    perform cac.fail('Site must belong to the selected customer.');
  end if;
  if not cac.blank(v_rec, 'contact_id') and (select customer_id::text from cac.contact where id = (v_rec->>'contact_id')::uuid) is distinct from v_rec->>'customer_id' then
    perform cac.fail('Contact must belong to the selected customer.');
  end if;

  if p_kind = 'opportunity' then
    perform cac.require_fields(v_rec, array['customer_id','site_id','source','owner_id','route']);
    if v_rec->>'route' not in ('Residential','Commercial','Referral') then perform cac.fail('Choose a valid customer route.'); end if;
    if not exists (select 1 from cac.staff where user_id::text = v_rec->>'owner_id' and active) then perform cac.fail('Choose an existing staff owner.'); end if;
  end if;
  if p_kind in ('contact','site','maintenance') then perform cac.require_fields(v_rec, array['customer_id']); end if;
  if p_kind = 'maintenance' then perform cac.require_fields(v_rec, array['site_id','renewal_date']); end if;
  if p_kind in ('survey','activity','payment','project') then perform cac.require_fields(v_rec, array['opportunity_id']); end if;
  if p_kind = 'change' then perform cac.require_fields(v_rec, array['project_id','scope']); end if;
  if p_kind = 'task' then perform cac.require_fields(v_rec, array['owner','due_date']); end if;
  if p_kind = 'appointment' then
    perform cac.require_fields(v_rec, array['type','starts_at']);
    if cac.blank(v_rec, 'opportunity_id') and cac.blank(v_rec, 'maintenance_id') then perform cac.fail('Link the appointment to an opportunity or a maintenance contract.'); end if;
    if v_old is not null and v_old->>'status' in ('completed','no_show','cancelled') then perform cac.fail('Closed appointments cannot be edited. Create a new appointment.'); end if;
    if v_old is not null and (v_rec->>'starts_at')::timestamptz is distinct from (v_old->>'starts_at')::timestamptz then perform cac.fail('Use Reschedule to change the time.'); end if;
  end if;
  if p_kind = 'service_visit' then perform cac.require_fields(v_rec, array['maintenance_id','visit_date']); end if;
  if p_kind = 'knowledge' then perform cac.require_fields(v_rec, array['category','content']); end if;
  if p_kind = 'prospect' then
    perform cac.require_fields(v_rec, array['segment','location','website']);
    if v_rec->>'segment' not in ('Hotel','Resort','Developer','Architect','Club','Contractor') then
      perform cac.fail('Research supports commercial organisations and referral partners only.');
    end if;
    if exists (select 1 from cac.prospect where id is distinct from p_id
               and website_host = lower(regexp_replace(substring(v_rec->>'website' from '^https://([^/:?#]+)'), '^www\.', ''))) then
      perform cac.fail('A prospect with this website already exists.', '23505');
    end if;
  end if;
  if p_kind = 'rate' then
    perform cac.require_fields(v_rec, array['price','unit','tax','scope']);
    if (v_rec->>'tax')::numeric > 100 then perform cac.fail('Tax must be between 0 and 100.'); end if;
  end if;
  if p_kind = 'project' and v_old is null and (select stage from cac.opportunity where id = (v_rec->>'opportunity_id')::uuid) <> 'Won' then
    perform cac.fail('Project handover requires a won opportunity with a verified advance.');
  end if;

  begin
    if v_old is null then
      -- Blank fields are simply omitted on insert so column defaults apply.
      v_result := cac.put(p_kind, jsonb_strip_nulls(v_rec) || jsonb_build_object('created_by', v_actor.user_id));
    else
      v_result := cac.put(p_kind, v_clean || jsonb_build_object('id', p_id)
        || case when v_rec->'qualification_reviewed' is distinct from v_old->'qualification_reviewed' then jsonb_build_object('qualification_reviewed', false) else '{}' end);
    end if;
  exception
    when check_violation then
      get stacked diagnostics v_con = constraint_name;
      perform cac.fail(format('%s has an invalid value.', initcap(replace(regexp_replace(v_con, '^' || p_kind || '_(.*)_check$', '\1'), '_', ' '))));
    when not_null_violation then
      get stacked diagnostics v_col = column_name;
      perform cac.fail(format('%s is required.', replace(v_col, '_', ' ')));
  end;
  perform cac.log(v_actor.user_id, case when v_old is null then 'record.created' else 'record.updated' end, v_result->>'id', jsonb_build_object('kind', p_kind));
  return v_result;
end $$;

create or replace function cac.submit_record(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_config text[] := case p_kind
    when 'prospect' then array['sales','prospect'] when 'survey' then array['engineer','survey']
    when 'rate' then array['commercial','catalogue'] when 'portfolio' then array['sales','catalogue']
    when 'knowledge' then array['sales','catalogue']
    when 'payment' then array['commercial','payment'] when 'change' then array['project','change'] end;
  v_actor cac.staff; v_target jsonb; v_result jsonb; f text;
begin
  if v_config is null then perform cac.fail('This record does not use submission approvals.'); end if;
  v_actor := cac.require_role(auth.uid(), array[v_config[1]]);
  v_target := cac.related(p_kind, p_id, true);
  if v_target->>'status' in ('approved','verified') then perform cac.fail('This record is already approved.'); end if;
  if p_kind = 'prospect' then perform cac.require_fields(v_target, array['evidence','source_url','research_date']); end if;
  if p_kind = 'survey' then
    perform cac.require_fields(v_target, array['length','width','depth','access','electrical','drainage','photos']);
    foreach f in array array['length','width','depth'] loop
      if (v_target->>f)::numeric <= 0 then perform cac.fail('Survey dimensions must be greater than zero.'); end if;
    end loop;
  end if;
  if p_kind = 'payment' then
    perform cac.require_fields(v_target, array['reference','received_on','amount']);
    if (v_target->>'amount')::numeric <= 0 then perform cac.fail('Payment amount must be greater than zero.'); end if;
  end if;
  if p_kind = 'change' then perform cac.require_fields(v_target, array['customer_approval','amount']); end if;
  v_result := cac.request_approval(v_actor.user_id, p_kind, v_target, v_config[2], v_config[1], 'Review ' || (v_target->>'name'));
  perform cac.log(v_actor.user_id, 'approval.requested', p_id::text);
  return v_result;
end $$;

-- ── Conversations: missed calls become same-day callbacks ──────────────────

create or replace function cac.on_activity()
returns trigger language plpgsql as $$
begin
  if new.type = 'Missed call' then
    insert into cac.task (name, opportunity_id, owner, due_date, category, notes, created_by)
    select 'Call back · ' || o.name, o.id, coalesce(s.name, 'Sales'), current_date, 'callback', coalesce(new.notes, 'Missed call'), new.created_by
    from cac.opportunity o left join cac.staff s on s.user_id = o.owner_id where o.id = new.opportunity_id;
  end if;
  return new;
end $$;
create trigger on_activity after insert on cac.activity for each row execute function cac.on_activity();

-- ── Appointments ───────────────────────────────────────────────────────────

-- Keeps exactly one open reminder task per upcoming appointment (due the day before, IST).
create or replace function cac.on_appointment()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at or new.status is distinct from old.status then
    update cac.task set status = 'completed', completed_at = now(), notes = concat_ws(E'\n', notes, 'Closed: appointment changed.')
      where appointment_id = new.id and category = 'appointment_reminder' and status = 'open';
    if new.status in ('scheduled','confirmed') and new.starts_at > now() then
      insert into cac.task (name, opportunity_id, maintenance_id, appointment_id, owner, due_date, category, notes, created_by)
      values ('Remind customer · ' || new.name, new.opportunity_id, new.maintenance_id, new.id, coalesce(nullif(new.assigned_to, ''), 'Sales'),
        greatest(current_date, (new.starts_at at time zone 'Asia/Kolkata')::date - 1), 'appointment_reminder',
        format('%s on %s. Confirm attendance; outbound delivery is simulated.', new.type, to_char(new.starts_at at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI')), new.created_by);
    end if;
  end if;
  return new;
end $$;
create trigger on_appointment after insert or update on cac.appointment for each row execute function cac.on_appointment();

create or replace function cac.set_appointment_status(p_appointment uuid, p_status text, p_outcome text default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales','engineer','project']);
  v_appt jsonb := cac.related('appointment', p_appointment, true);
  v_result jsonb;
  v_owner text;
begin
  if p_status not in ('confirmed','completed','no_show','cancelled') then perform cac.fail('Choose confirmed, completed, no-show or cancelled.'); end if;
  if v_appt->>'status' not in ('scheduled','confirmed') then perform cac.fail('This appointment is already closed.'); end if;
  if p_status = 'confirmed' and v_appt->>'status' = 'confirmed' then perform cac.fail('This appointment is already confirmed.'); end if;
  v_result := cac.put('appointment', jsonb_build_object('id', p_appointment, 'status', p_status, 'outcome', nullif(btrim(coalesce(p_outcome, '')), '')));
  v_owner := coalesce(nullif(v_appt->>'assigned_to', ''), (select s.name from cac.opportunity o join cac.staff s on s.user_id = o.owner_id where o.id = nullif(v_appt->>'opportunity_id', '')::uuid), 'Sales');
  if p_status = 'confirmed' and v_appt->>'type' = 'Site visit' and not cac.blank(v_appt, 'opportunity_id') then
    perform cac.put('opportunity', jsonb_build_object('id', v_appt->>'opportunity_id', 'visit_date', ((v_appt->>'starts_at')::timestamptz at time zone 'Asia/Kolkata')::date, 'visit_confirmed', true));
  elsif p_status = 'no_show' then
    perform cac.put('task', jsonb_build_object('name', format('Re-engage after missed %s · %s', lower(v_appt->>'type'), v_appt->>'name'), 'opportunity_id', v_appt->>'opportunity_id',
      'maintenance_id', v_appt->>'maintenance_id', 'appointment_id', p_appointment, 'owner', v_owner, 'due_date', current_date + 1, 'category', 'no_show',
      'notes', 'Offer a new time. Do not assume the customer has lost interest.', 'created_by', v_actor.user_id));
  elsif p_status = 'completed' and v_appt->>'type' = 'Service visit' and not cac.blank(v_appt, 'maintenance_id') then
    perform cac.put('task', jsonb_build_object('name', 'Record service visit outcome · ' || (v_appt->>'name'), 'maintenance_id', v_appt->>'maintenance_id', 'appointment_id', p_appointment,
      'owner', v_owner, 'due_date', current_date, 'category', 'service_record', 'created_by', v_actor.user_id));
  end if;
  perform cac.log(v_actor.user_id, 'appointment.' || p_status, p_appointment::text);
  return v_result;
end $$;

create or replace function cac.reschedule_appointment(p_appointment uuid, p_starts_at timestamptz)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales','engineer','project']);
  v_appt jsonb := cac.related('appointment', p_appointment, true);
  v_result jsonb;
begin
  if v_appt->>'status' not in ('scheduled','confirmed') then perform cac.fail('Only open appointments can be rescheduled.'); end if;
  if p_starts_at is null or p_starts_at <= now() then perform cac.fail('Choose a future date and time.'); end if;
  v_result := cac.put('appointment', jsonb_build_object('id', p_appointment, 'starts_at', p_starts_at, 'rescheduled_from', v_appt->>'starts_at', 'status', 'scheduled'));
  if v_appt->>'type' = 'Site visit' and not cac.blank(v_appt, 'opportunity_id') then
    perform cac.put('opportunity', jsonb_build_object('id', v_appt->>'opportunity_id', 'visit_confirmed', false));
  end if;
  perform cac.log(v_actor.user_id, 'appointment.rescheduled', p_appointment::text, jsonb_build_object('from', v_appt->>'starts_at', 'to', p_starts_at));
  return v_result;
end $$;

-- ── Service visits: history and declined-recommendation follow-up ──────────

create or replace function cac.on_service_visit()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update cac.maintenance set service_history = concat_ws(E'\n', nullif(service_history, ''),
      format('%s: %s%s', to_char(new.visit_date, 'DD Mon YYYY'), coalesce(new.work_done, 'Service visit'), case when new.technician is not null then ' (' || new.technician || ')' else '' end))
      where id = new.maintenance_id;
  end if;
  if new.decision = 'Declined' and (tg_op = 'INSERT' or old.decision is distinct from 'Declined') then
    insert into cac.task (name, maintenance_id, owner, due_date, category, notes, created_by)
    select 'Follow up declined recommendation · ' || m.name, m.id, 'Service team', new.visit_date + 30, 'declined_service',
      'Declined: ' || coalesce(new.recommendations, 'recommendation not recorded') || E'\nCheck whether the customer would now like it scheduled.', new.created_by
    from cac.maintenance m where m.id = new.maintenance_id;
  end if;
  return new;
end $$;
create trigger on_service_visit after insert or update of decision on cac.service_visit for each row execute function cac.on_service_visit();

-- ── Settings ───────────────────────────────────────────────────────────────

create or replace function cac.set_setting(p_key text, p_value text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), '{}');
begin
  if p_key = 'review_url' and btrim(coalesce(p_value, '')) <> '' and not cac.safe_url(btrim(p_value)) then perform cac.fail('The review link must be a valid HTTPS URL.'); end if;
  if p_key = 'response_target_minutes' and (coalesce(p_value, '') !~ '^[0-9]{1,4}$' or p_value::int not between 5 and 1440) then perform cac.fail('Response target must be 5–1440 minutes.'); end if;
  update cac.setting set value = btrim(coalesce(p_value, '')), updated_at = now() where key = p_key;
  if not found then perform cac.fail('Unknown setting.'); end if;
  perform cac.log(v_actor.user_id, 'setting.updated', p_key, jsonb_build_object('value', btrim(coalesce(p_value, ''))));
  return (select jsonb_object_agg(key, value) from cac.setting);
end $$;

-- ── Review requests ────────────────────────────────────────────────────────

create or replace function cac.create_review_request(p_actor uuid, p_project uuid)
returns jsonb language plpgsql as $$
declare
  v_project jsonb := cac.related('project', p_project);
  v_customer uuid := (select customer_id from cac.opportunity where id = (v_project->>'opportunity_id')::uuid);
  v_url text := (select value from cac.setting where key = 'review_url');
  v_existing jsonb;
begin
  select to_jsonb(r) into v_existing from cac.review_request r where r.project_id = p_project;
  if v_existing is not null then return v_existing; end if;
  return cac.put('review_request', jsonb_build_object('name', 'Review request · ' || (v_project->>'name'), 'project_id', p_project, 'customer_id', v_customer,
    'body', format(E'Thank you for choosing Crystal Pools for %s. If you are happy with the work, would you share a short review? It helps other families and businesses find us.\n%s',
      v_project->>'name', coalesce(nullif(v_url, ''), '[review link to be set in Settings]')), 'created_by', p_actor));
end $$;

create or replace function cac.request_review(p_project uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), array['sales','project']);
begin
  if (select status from cac.project where id = p_project) is distinct from 'completed' then perform cac.fail('Request a review after the project handover is complete.'); end if;
  return cac.create_review_request(v_actor.user_id, p_project);
end $$;

create or replace function cac.update_review(p_review uuid, p_status text, p_rating int default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales','project']);
  v_review jsonb := cac.related('review_request', p_review, true);
  v_result jsonb;
begin
  if p_status = 'sent' then
    if v_review->>'status' <> 'to_send' then perform cac.fail('This review request was already sent.'); end if;
    if (select suppressed from cac.customer where id = (v_review->>'customer_id')::uuid) then perform cac.fail('This customer has opted out.'); end if;
    if (select value from cac.setting where key = 'review_url') = '' then perform cac.fail('Set the Google review link in Settings first.'); end if;
    v_result := cac.put('review_request', jsonb_build_object('id', p_review, 'status', 'sent', 'simulated_at', now()));
  elsif p_status = 'received' then
    if p_rating is null or p_rating not between 1 and 5 then perform cac.fail('Record a rating from 1 to 5.'); end if;
    v_result := cac.put('review_request', jsonb_build_object('id', p_review, 'status', 'received', 'rating', p_rating, 'received_at', now()));
  elsif p_status = 'declined' then
    v_result := cac.put('review_request', jsonb_build_object('id', p_review, 'status', 'declined'));
  else
    perform cac.fail('Choose sent, received or declined.');
  end if;
  perform cac.log(v_actor.user_id, 'review.' || p_status, p_review::text, jsonb_build_object('rating', p_rating, 'externalSend', false));
  return v_result;
end $$;

-- Project completion now also prepares the review request.
create or replace function cac.complete_project(p_project uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['project']);
  v_project jsonb := cac.related('project', p_project, true);
  v_result jsonb;
begin
  if cac.blank(v_project, 'handover_checklist') or cac.blank(v_project, 'milestones') then perform cac.fail('Record completed milestones and a handover checklist first.'); end if;
  v_result := cac.put('project', jsonb_build_object('id', p_project, 'status', 'completed', 'completed_by', v_actor.user_id));
  perform cac.create_review_request(v_actor.user_id, p_project);
  perform cac.log(v_actor.user_id, 'project.completed', p_project::text);
  return v_result;
end $$;

-- ── Lifecycle lists ────────────────────────────────────────────────────────

create or replace function cac.lifecycle_targets(p_kind text, p_pattern text default null)
returns table (target_id uuid, target_kind text, opportunity_id uuid, maintenance_id uuid, name text, reason text, owner text)
language sql stable as $$
  select m.id, 'maintenance', null::uuid, m.id, m.name, 'Warranty ends ' || to_char(m.warranty_date, 'DD Mon YYYY'), 'Service team'
    from cac.maintenance m join cac.customer c on c.id = m.customer_id
    where p_kind = 'warranty_expiring' and not c.suppressed and m.warranty_date between current_date and current_date + 60
  union all
  select m.id, 'maintenance', null, m.id, m.name, 'AMC renews ' || to_char(m.renewal_date, 'DD Mon YYYY'), 'Commercial review'
    from cac.maintenance m join cac.customer c on c.id = m.customer_id
    where p_kind = 'amc_renewal' and not c.suppressed and m.renewal_date between current_date and current_date + 30
  union all
  select m.id, 'maintenance', null, m.id, m.name, 'Service was due ' || to_char(m.next_service, 'DD Mon YYYY'), 'Service team'
    from cac.maintenance m join cac.customer c on c.id = m.customer_id
    where p_kind = 'service_overdue' and not c.suppressed and m.next_service < current_date
  union all
  select p.id, 'project', o.id, null, p.name, 'Handover complete; no maintenance contract for this site yet', coalesce(s.name, 'Sales')
    from cac.project p join cac.opportunity o on o.id = p.opportunity_id join cac.customer c on c.id = o.customer_id left join cac.staff s on s.user_id = o.owner_id
    where p_kind = 'first_service' and p.status = 'completed' and not c.suppressed and not o.suppressed
      and not exists (select 1 from cac.maintenance m where m.site_id = o.site_id)
  union all
  select o.id, 'opportunity', o.id, null, o.name, 'No conversation logged for 14+ days at ' || o.stage, coalesce(s.name, 'Sales')
    from cac.opportunity o join cac.customer c on c.id = o.customer_id left join cac.staff s on s.user_id = o.owner_id
    where p_kind = 'dormant_enquiries' and o.stage in ('New enquiry','Contacted','Qualified','Site visit scheduled') and not o.suppressed and not c.suppressed
      and coalesce((select max(a.created_at) from cac.activity a where a.opportunity_id = o.id), o.enquiry_at) < now() - interval '14 days'
  union all
  select o.id, 'opportunity', o.id, null, o.name,
      case when o.stage = 'Deferred' then 'Deferred follow-up date reached' else 'Lost 90+ days ago: ' || coalesce(o.loss_reason, 'reason not recorded') end, coalesce(s.name, 'Sales')
    from cac.opportunity o join cac.customer c on c.id = o.customer_id left join cac.staff s on s.user_id = o.owner_id
    where p_kind = 'lost_reengage' and not o.suppressed and not c.suppressed
      and ((o.stage = 'Deferred' and o.next_action_date <= current_date) or (o.stage = 'Lost' and o.updated_at < now() - interval '90 days'))
  union all
  select m.id, 'maintenance', null, m.id, m.name, 'Equipment matches "' || p_pattern || '": ' || left(m.equipment, 120), 'Service team'
    from cac.maintenance m join cac.customer c on c.id = m.customer_id
    where p_kind = 'equipment_advisory' and char_length(btrim(coalesce(p_pattern, ''))) >= 3 and not c.suppressed
      and m.equipment ilike '%' || replace(replace(btrim(p_pattern), '%', ''), '_', '') || '%';
$$;

create or replace function cac.lifecycle_catalogue()
returns table (kind text, label text, description text, message text)
language sql immutable as $$
  values
    ('warranty_expiring', 'Warranty expiring in 60 days', 'Offer an inspection before cover ends.', 'Your pool equipment warranty ends soon. Would you like a check-up before it expires?'),
    ('amc_renewal', 'AMC renewals in 30 days', 'Prepare the renewal with service history.', 'Your annual maintenance contract is due for renewal. Can we share the renewal details?'),
    ('service_overdue', 'Service overdue', 'Book the visit that was due.', 'Your pool is due for its scheduled service. Which day suits you?'),
    ('first_service', 'First service after handover', 'Offer care for newly handed-over pools.', 'Congratulations on your new pool. Shall we schedule its first service and discuss a care plan?'),
    ('dormant_enquiries', 'Dormant enquiries', 'Open enquiries with no conversation in 14 days.', 'We wanted to check whether you are still planning your pool, and whether we can help with the next step.'),
    ('lost_reengage', 'Lost or deferred, worth revisiting', 'Deferred dates reached, or lost 90+ days ago.', 'You spoke with us earlier about a pool project. Would it be useful to revisit it now?'),
    ('equipment_advisory', 'Equipment advisory', 'Contracts whose equipment matches a model or part.', 'We have an advisory for equipment installed at your pool. Can we arrange a check?');
$$;

create or replace function cac.lifecycle_summary()
returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object('kind', c.kind, 'label', c.label, 'description', c.description,
    'count', case when c.kind = 'equipment_advisory' then null else (select count(*) from cac.lifecycle_targets(c.kind)) end,
    'open_tasks', (select count(*) from cac.task t where t.category = 'lifecycle' and t.lifecycle_key like c.kind || ':%' and t.status = 'open')))
  from cac.lifecycle_catalogue() c;
$$;

create or replace function cac.launch_lifecycle(p_kind text, p_pattern text default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales','project','commercial']);
  v_meta record;
  v_target record;
  v_created int := 0; v_skipped int := 0;
begin
  select * into v_meta from cac.lifecycle_catalogue() c where c.kind = p_kind;
  if not found then perform cac.fail('Unknown lifecycle list.'); end if;
  if p_kind = 'equipment_advisory' and char_length(btrim(coalesce(p_pattern, ''))) < 3 then perform cac.fail('Enter at least 3 characters of the equipment model or part.'); end if;
  for v_target in select * from cac.lifecycle_targets(p_kind, p_pattern) loop
    -- One open follow-up per target and list; opted-out customers are already excluded.
    if exists (select 1 from cac.task where lifecycle_key = p_kind || ':' || v_target.target_id and status in ('open','paused')) then
      v_skipped := v_skipped + 1; continue;
    end if;
    perform cac.put('task', jsonb_build_object('name', v_meta.label || ' · ' || v_target.name, 'opportunity_id', v_target.opportunity_id, 'maintenance_id', v_target.maintenance_id,
      'owner', v_target.owner, 'due_date', current_date, 'category', 'lifecycle', 'lifecycle_key', p_kind || ':' || v_target.target_id,
      'notes', format(E'%s\nSuggested message (review before sending): %s', v_target.reason, v_meta.message), 'created_by', v_actor.user_id));
    v_created := v_created + 1;
  end loop;
  perform cac.log(v_actor.user_id, 'lifecycle.launched', p_kind, jsonb_build_object('created', v_created, 'skipped', v_skipped, 'pattern', p_pattern));
  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end $$;

-- ── Owner metrics (dashboard, reports and the owner assistant) ─────────────

create or replace function cac.owner_metrics()
returns jsonb language sql stable as $$
  with target as (select value::int as minutes from cac.setting where key = 'response_target_minutes'),
  first_reply as (
    select o.id, o.stage, o.suppressed, o.enquiry_at,
      (select min(a.created_at) from cac.activity a where a.opportunity_id = o.id and a.type = 'Human response') as replied_at
    from cac.opportunity o
  ),
  answered as (select extract(epoch from replied_at - enquiry_at) / 60 as minutes from first_reply where replied_at is not null and enquiry_at > now() - interval '90 days')
  select jsonb_build_object(
    'response', jsonb_build_object(
      'target_minutes', (select minutes from target),
      'median_minutes', (select round(percentile_cont(0.5) within group (order by greatest(minutes, 0))::numeric, 1) from answered),
      'within_target_pct', (select round(100.0 * count(*) filter (where minutes <= (select minutes from target)) / nullif(count(*), 0)) from answered),
      'answered_90d', (select count(*) from answered),
      'awaiting', (select count(*) from first_reply where replied_at is null and stage not in ('Lost','Deferred') and not suppressed),
      'awaiting_over_target', (select count(*) from first_reply where replied_at is null and stage not in ('Lost','Deferred') and not suppressed and enquiry_at < now() - make_interval(mins => (select minutes from target))),
      'missed_calls_open', (select count(*) from cac.task where category = 'callback' and status = 'open')),
    'appointments', jsonb_build_object(
      'today', (select count(*) from cac.appointment where status in ('scheduled','confirmed') and (starts_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date),
      'next_7_days', (select count(*) from cac.appointment where status in ('scheduled','confirmed') and starts_at between now() and now() + interval '7 days'),
      'unconfirmed', (select count(*) from cac.appointment where status = 'scheduled' and starts_at between now() and now() + interval '3 days'),
      'show_rate_pct', (select round(100.0 * count(*) filter (where status = 'completed') / nullif(count(*) filter (where status in ('completed','no_show')), 0)) from cac.appointment where starts_at > now() - interval '90 days'),
      'no_show_followups', (select count(*) from cac.task where category = 'no_show' and status = 'open')),
    'reviews', jsonb_build_object(
      'to_send', (select count(*) from cac.review_request where status = 'to_send'),
      'sent', (select count(*) from cac.review_request where status = 'sent'),
      'received', (select count(*) from cac.review_request where status = 'received'),
      'average_rating', (select round(avg(rating)::numeric, 1) from cac.review_request where status = 'received'),
      'link_set', (select value <> '' from cac.setting where key = 'review_url')),
    'service', jsonb_build_object(
      'declined_followups', (select count(*) from cac.task where category = 'declined_service' and status = 'open'),
      'visits_90d', (select count(*) from cac.service_visit where visit_date > current_date - 90)),
    'tasks', jsonb_build_object(
      'open', (select count(*) from cac.task where status = 'open'),
      'overdue', (select count(*) from cac.task where status = 'open' and due_date < current_date),
      'quote_followups', (select count(*) from cac.task where status = 'open' and category = 'generic_followup')),
    'pipeline', jsonb_build_object(
      'open_value', (select coalesce(sum(budget), 0) from cac.opportunity where stage not in ('Won','Execution','Handover','Maintenance','Lost','Deferred') and not suppressed),
      'won_90d', (select count(*) from cac.opportunity where stage in ('Won','Execution','Handover','Maintenance') and updated_at > now() - interval '90 days'),
      'unbilled_changes', (select count(*) from cac.change where status = 'approved' and billing_status <> 'Billed')),
    'lifecycle', (select jsonb_object_agg(c.kind, (select count(*) from cac.lifecycle_targets(c.kind))) from cac.lifecycle_catalogue() c where c.kind <> 'equipment_advisory')
  );
$$;

-- ── Owner assistant: approved actions become tasks ─────────────────────────

create or replace function cac.on_draft_approved()
returns trigger language plpgsql as $$
declare v_action jsonb;
begin
  if new.agent = 'operator' and new.status = 'approved' and old.status is distinct from 'approved' then
    for v_action in select * from jsonb_array_elements(coalesce(new.analysis->'actions', '[]')) limit 8 loop
      insert into cac.task (name, owner, due_date, category, notes, created_by)
      values (left(coalesce(v_action->>'name', 'Owner action'), 200), left(coalesce(nullif(v_action->>'owner', ''), 'Owner'), 80),
        current_date + least(greatest(coalesce((v_action->>'dueInDays')::int, 0), 0), 60), 'operator', left(v_action->>'reason', 1000), new.created_by);
    end loop;
    update cac.briefing set status = 'actioned' where id = new.target_id;
  end if;
  return new;
end $$;
create trigger on_draft_approved after update of status on cac.draft for each row execute function cac.on_draft_approved();

-- ── Worker context: approved knowledge for every run, metrics for the owner assistant

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
      'knowledge', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'category', x.category, 'content', x.content)), '[]') from (select * from cac.knowledge where status = 'approved' order by created_at desc limit 20) x),
      'metrics', case when v_job.agent = 'operator' then cac.owner_metrics() end,
      'images', case when v_job.agent = 'survey' then (select coalesce(jsonb_agg(i), '[]') from (select jsonb_build_object('name', x.name, 'mime', x.mime, 'path', x.path) i from cac.attachment x where x.survey_id = v_job.target_id order by x.created_at limit 4) s) else '[]' end
    ));
  end loop;
end $$;

-- Website enquiries keep their original submission time for speed-to-lead.
create or replace function cac.import_website_leads()
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
  v_lead record;
  v_customer jsonb; v_site jsonb; v_opp jsonb;
  v_commercial boolean;
  v_count int := 0;
begin
  if to_regclass('public.leads') is null then perform cac.fail('The website enquiries table (public.leads) is not in this Supabase project.'); end if;
  for v_lead in execute 'select l.id, l.name, l.email, l.phone, l.project_type, l.message, l.source_page, l.created_at from public.leads l
      where not exists (select 1 from cac.lead_link k where k.lead_id = l.id) order by l.created_at limit 100'
  loop
    v_commercial := coalesce(v_lead.project_type, '') ~* 'commercial|hotel|resort|club|develop';
    select to_jsonb(c) into v_customer from cac.customer c where lower(c.email) = lower(v_lead.email) order by c.created_at limit 1;
    if v_customer is null then
      v_customer := cac.put('customer', jsonb_build_object('name', v_lead.name, 'email', v_lead.email, 'phone', nullif(v_lead.phone, ''),
        'segment', case when v_lead.project_type ~* 'hotel' then 'Hotel' when v_lead.project_type ~* 'resort' then 'Resort' when v_lead.project_type ~* 'club' then 'Club'
                        when v_lead.project_type ~* 'develop' then 'Developer' when not v_commercial then 'Residential' end,
        'notes', 'Created from a website enquiry.', 'created_by', v_actor.user_id));
    end if;
    v_site := cac.put('site', jsonb_build_object('name', v_lead.name || ' · site to confirm', 'customer_id', v_customer->>'id', 'created_by', v_actor.user_id));
    v_opp := cac.put('opportunity', jsonb_build_object('name', format('%s · %s', v_lead.name, coalesce(nullif(v_lead.project_type, ''), 'website enquiry')),
      'customer_id', v_customer->>'id', 'site_id', v_site->>'id', 'lead_id', v_lead.id, 'enquiry_at', v_lead.created_at,
      'route', case when v_commercial then 'Commercial' else 'Residential' end, 'source', 'Website form', 'owner_id', v_actor.user_id,
      'notes', format(E'%s\n\nSubmitted from: %s', v_lead.message, coalesce(nullif(v_lead.source_page, ''), 'website')),
      'next_action', 'Respond to the website enquiry', 'next_action_date', current_date, 'created_by', v_actor.user_id));
    insert into cac.lead_link (lead_id, opportunity_id) values (v_lead.id, (v_opp->>'id')::uuid);
    v_count := v_count + 1;
  end loop;
  perform cac.log(v_actor.user_id, 'website.leads_imported', 'public.leads', jsonb_build_object('created', v_count));
  return jsonb_build_object('created', v_count);
end $$;

-- ── Workspace snapshot (redefined with the new records and metrics) ────────

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
    'jobs', (select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at desc), '[]') from cac.job j),
    'events', (select coalesce(jsonb_agg(e), '[]') from (select to_jsonb(x) e from cac.event x order by x.id desc limit 300) s),
    'agents', (select jsonb_agg(to_jsonb(a) order by a.sort) from cac.agent a),
    'stages', to_jsonb(cac.stages()),
    'settings', (select jsonb_object_agg(key, value) from cac.setting),
    'metrics', cac.owner_metrics(),
    'lifecycle', cac.lifecycle_summary(),
    'config', jsonb_build_object(
      'outbound', 'disabled',
      'database', 'Supabase · cac schema',
      'worker', (select to_jsonb(w) from cac.worker_status w),
      'website_leads', to_regclass('public.leads') is not null,
      'photo_bucket', 'cac-survey-photos'));
end $$;

-- ── Function grants (lock down everything, then grant entry points) ────────

do $$
declare fn record;
begin
  for fn in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'cac'::regnamespace loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn.sig);
  end loop;
end $$;

grant execute on function cac.is_staff() to authenticated, service_role;

grant execute on function
  cac.workspace_state(), cac.write_record(text, jsonb, uuid), cac.submit_record(text, uuid), cac.decide(uuid, text, text),
  cac.transition(uuid, text), cac.create_quote(jsonb), cac.complete_task(uuid), cac.complete_project(uuid),
  cac.suppress_prospect(uuid), cac.bill_change(uuid, text), cac.simulate_delivery(text, uuid),
  cac.enqueue_run(text, uuid, jsonb, text), cac.retry_run(uuid), cac.can_upload_photo(text), cac.register_photo(uuid, text, text),
  cac.import_rows(text, jsonb), cac.convert_prospect(uuid), cac.import_website_leads(),
  cac.create_staff(text, text, text, text), cac.set_staff(uuid, text, boolean),
  cac.set_appointment_status(uuid, text, text), cac.reschedule_appointment(uuid, timestamptz),
  cac.set_setting(text, text), cac.request_review(uuid), cac.update_review(uuid, text, int), cac.launch_lifecycle(text, text)
to authenticated;

grant execute on function
  cac.claim_job(), cac.save_analysis(uuid, jsonb), cac.fail_job(uuid, text, boolean), cac.complete_job(uuid),
  cac.worker_heartbeat(text, boolean), cac.bootstrap_admin(text, text, text), cac.seed_demo(uuid)
to service_role;
