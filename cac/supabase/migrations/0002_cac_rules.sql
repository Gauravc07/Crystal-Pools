-- ============================================================================
-- CAC business rules. Every staff action is one transaction in one function.
-- Callers are identified by auth.uid(); the worker passes the run's actor.
-- ============================================================================

-- ── Helpers ────────────────────────────────────────────────────────────────

create or replace function cac.fail(p_message text, p_code text default 'P0001')
returns void language plpgsql as $$
begin
  raise exception using message = p_message, errcode = p_code;
end $$;

create or replace function cac.stages()
returns text[] language sql immutable as $$
  select array['New enquiry','Contacted','Qualified','Site visit scheduled','Survey complete','Estimate sent','Detailed proposal','Negotiation','Won','Execution','Handover','Maintenance','Deferred','Lost'];
$$;

-- Active staff row for a user, or a sign-in error.
create or replace function cac.actor(p_user uuid)
returns cac.staff language plpgsql stable as $$
declare v cac.staff;
begin
  select * into v from cac.staff where user_id = p_user and active;
  if not found then perform cac.fail('Sign in to the CAC workspace with an active staff account.', '42501'); end if;
  return v;
end $$;

create or replace function cac.require_role(p_user uuid, p_roles text[])
returns cac.staff language plpgsql stable as $$
declare v cac.staff := cac.actor(p_user);
begin
  if v.role <> 'admin' and not v.role = any(p_roles) then
    perform cac.fail('Your role cannot perform this action.', '42501');
  end if;
  return v;
end $$;

create or replace function cac.log(p_actor uuid, p_action text, p_target text, p_detail jsonb default '{}')
returns void language sql as $$
  insert into cac.event (actor, action, target, detail) values (p_actor, p_action, coalesce(p_target, ''), coalesce(p_detail, '{}'));
$$;

create or replace function cac.columns(p_kind text)
returns text[] language sql stable as $$
  select array_agg(attname::text order by attnum) from pg_attribute
  where attrelid = format('cac.%I', p_kind)::regclass and attnum > 0 and not attisdropped and attgenerated = '';
$$;

create or replace function cac.get(p_kind text, p_id uuid, p_lock boolean default false)
returns jsonb language plpgsql as $$
declare v jsonb;
begin
  if p_id is null then return null; end if;
  execute format('select to_jsonb(t) from cac.%I t where id = $1 %s', p_kind, case when p_lock then 'for update' else '' end) into v using p_id;
  return v;
end $$;

create or replace function cac.related(p_kind text, p_id uuid, p_lock boolean default false)
returns jsonb language plpgsql as $$
declare v jsonb := cac.get(p_kind, p_id, p_lock);
begin
  if v is null then perform cac.fail(format('A valid %s record is required.', p_kind)); end if;
  return v;
end $$;

-- Insert or update one record from JSON (like an ORM "save"). Only keys that
-- are present are written, so column defaults apply on insert.
create or replace function cac.put(p_kind text, p_values jsonb)
returns jsonb language plpgsql as $$
declare
  v_cols text[] := cac.columns(p_kind);
  v_id uuid := nullif(p_values->>'id', '')::uuid;
  v_keys text[];
  v_list text;
  v_row jsonb;
begin
  select coalesce(array_agg(k), '{}') into v_keys from jsonb_object_keys(p_values) k
    where k not in ('id','created_at','updated_at','record_version','website_host');
  if exists (select 1 from unnest(v_keys) k where k <> all(v_cols)) then
    raise exception 'cac.put: unknown % field(s) %', p_kind, (select string_agg(k, ', ') from unnest(v_keys) k where k <> all(v_cols));
  end if;
  if v_id is not null and cac.get(p_kind, v_id) is not null then
    if cardinality(v_keys) = 0 then return cac.get(p_kind, v_id); end if;
    v_list := (select string_agg(format('%I', k), ',') from unnest(v_keys) k);
    execute format('update cac.%I as t set (%s) = (select %s from jsonb_populate_record(null::cac.%I, $1)) where t.id = $2 returning to_jsonb(t.*)', p_kind, v_list, v_list, p_kind)
      into v_row using p_values, v_id;
  else
    v_keys := v_keys || array['id'];
    v_list := (select string_agg(format('%I', k), ',') from unnest(v_keys) k);
    execute format('insert into cac.%I as t (%s) select %s from jsonb_populate_record(null::cac.%I, $1) returning to_jsonb(t.*)', p_kind, v_list, v_list, p_kind)
      into v_row using p_values || jsonb_build_object('id', coalesce(v_id, gen_random_uuid()));
  end if;
  return v_row;
end $$;

create or replace function cac.safe_url(p text)
returns boolean language sql immutable as $$
  select p ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^\s]*)?$';
$$;

create or replace function cac.blank(p jsonb, p_key text)
returns boolean language sql immutable as $$
  select p->p_key is null or jsonb_typeof(p->p_key) = 'null' or btrim(p->>p_key) = '';
$$;

create or replace function cac.require_fields(p jsonb, p_fields text[])
returns void language plpgsql as $$
declare f text;
begin
  foreach f in array p_fields loop
    if cac.blank(p, f) then perform cac.fail(format('%s is required.', replace(f, '_', ' '))); end if;
  end loop;
end $$;

-- ── Generic record writes ──────────────────────────────────────────────────

create or replace function cac.editable_fields(p_kind text)
returns text[] language sql immutable as $$
  select case p_kind
    when 'customer'    then array['name','segment','email','phone','notes']
    when 'contact'     then array['name','customer_id','email','phone','position','permission']
    when 'site'        then array['name','customer_id','location','address','notes']
    when 'prospect'    then array['name','segment','location','website','source_url','evidence','contact','service','existing_pool','open_questions','research_date']
    when 'opportunity' then array['name','customer_id','site_id','contact_id','route','source','owner_id','location','pool_type','budget','timeline','decision_maker','notes','next_action','next_action_date','visit_date','visit_confirmed','agreement_ref','loss_reason']
    when 'activity'    then array['name','opportunity_id','type','notes']
    when 'task'        then array['name','opportunity_id','owner','due_date','notes']
    when 'survey'      then array['name','opportunity_id','length','width','depth','access','electrical','drainage','photos','notes']
    when 'rate'        then array['name','unit','price','tax','scope']
    when 'portfolio'   then array['name','segment','description','source_url']
    when 'campaign'    then array['name','type','region','notes','cost','effort_hours']
    when 'project'     then array['name','opportunity_id','milestones','site_updates','handover_checklist']
    when 'change'      then array['name','project_id','scope','amount','customer_approval']
    when 'payment'     then array['name','opportunity_id','amount','reference','received_on']
    when 'maintenance' then array['name','customer_id','site_id','equipment','warranty_date','service_history','next_service','renewal_date','referral']
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
  k text; v jsonb; f text; n numeric; d date;
  v_con text; v_col text;
begin
  if v_fields is null then perform cac.fail('Unknown record type.'); end if;
  v_actor := cac.require_role(p_user, cac.writer_roles(p_kind));
  if p_values is null or jsonb_typeof(p_values) <> 'object' then perform cac.fail('Send the record fields as an object.'); end if;

  if p_id is not null then
    v_old := cac.related(p_kind, p_id, true);
    if v_old->>'status' in ('approved','verified') and p_kind in ('survey','rate','portfolio','change','payment','prospect') then
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

  foreach f in array array['amount','price','tax','budget','cost','effort_hours','length','width','depth'] loop
    if not cac.blank(v_rec, f) then
      if (v_rec->>f) !~ '^[0-9]+(\.[0-9]+)?$' then perform cac.fail(format('%s must be a valid non-negative number.', replace(f, '_', ' '))); end if;
      n := (v_rec->>f)::numeric;
      if n > 1e10 then perform cac.fail(format('%s must be a valid non-negative number.', replace(f, '_', ' '))); end if;
    end if;
  end loop;
  foreach f in array array['due_date','renewal_date','next_service','next_action_date','visit_date','research_date','warranty_date','received_on'] loop
    if not cac.blank(v_rec, f) then
      begin d := (v_rec->>f)::date;
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
  for f, k in select * from (values ('customer_id','customer'),('site_id','site'),('contact_id','contact'),('opportunity_id','opportunity'),('project_id','project')) x(a,b) loop
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

create or replace function cac.write_record(p_kind text, p_values jsonb, p_id uuid default null)
returns jsonb language sql security definer set search_path = cac, public as $$
  select cac.write_record_as(auth.uid(), p_kind, p_values, p_id);
$$;

-- ── Approvals ──────────────────────────────────────────────────────────────

create or replace function cac.request_approval(p_actor uuid, p_kind text, p_target jsonb, p_type text, p_role text, p_summary text, p_payload jsonb default '{}')
returns jsonb language plpgsql as $$
declare v_existing uuid;
begin
  select id into v_existing from cac.approval where target_id = (p_target->>'id')::uuid and type = p_type and status = 'pending';
  return cac.put('approval', jsonb_build_object(
    'id', v_existing, 'name', p_summary, 'target_id', p_target->>'id', 'target_kind', p_kind, 'type', p_type, 'role', p_role,
    'payload', coalesce(p_payload, '{}'), 'target_version', (p_target->>'record_version')::int, 'created_by', p_actor));
end $$;

create or replace function cac.submit_record(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_config text[] := case p_kind
    when 'prospect' then array['sales','prospect'] when 'survey' then array['engineer','survey']
    when 'rate' then array['commercial','catalogue'] when 'portfolio' then array['sales','catalogue']
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

create or replace function cac.decide(p_approval uuid, p_decision text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_item jsonb := cac.related('approval', p_approval, true);
  v_actor cac.staff;
  v_kind text := v_item->>'target_kind';
  v_target jsonb;
  v_updated jsonb;
  v_extracted jsonb;
  v_fields jsonb := '{}';
  v_next jsonb;
  q text;
  v_job cac.job;
begin
  v_actor := cac.require_role(auth.uid(), array[v_item->>'role']);
  if v_item->>'status' <> 'pending' then perform cac.fail('This review has already been resolved.', 'P0409'); end if;
  if p_decision not in ('approved','rejected') then perform cac.fail('Choose approve or reject.'); end if;
  if p_decision = 'rejected' and btrim(coalesce(p_note, '')) = '' then perform cac.fail('Include a reason for rejection.'); end if;
  v_target := cac.get(v_kind, (v_item->>'target_id')::uuid, true);
  if v_target is null then perform cac.fail('Review target no longer exists.', 'P0404'); end if;
  if p_decision = 'approved' and (v_target->>'record_version')::int <> (v_item->>'target_version')::int then
    perform cac.fail('Record changed since submission. Reject this review and resubmit.', 'P0409');
  end if;

  perform cac.put('approval', jsonb_build_object('id', p_approval, 'status', p_decision, 'note', p_note, 'reviewed_by', v_actor.user_id, 'reviewed_at', now()));

  if p_decision = 'approved' then
    if v_item->>'type' = 'quote_engineering' then
      v_updated := cac.put('quote', jsonb_build_object('id', v_target->>'id', 'engineering_approved_by', v_actor.user_id));
      v_next := cac.request_approval(v_actor.user_id, 'quote', v_updated, 'quote_commercial', 'commercial', 'Approve price · ' || (v_target->>'name'));
    elsif v_item->>'type' = 'qualification' then
      v_extracted := coalesce(v_item->'payload'->'extracted', '{}');
      foreach q in array array['location','pool_type','budget','timeline','decision_maker'] loop
        -- Proposed values fill only empty fields; staff-entered values are preserved.
        if cac.blank(v_target, q) and not cac.blank(v_extracted, q) then v_fields := v_fields || jsonb_build_object(q, v_extracted->q); end if;
      end loop;
      perform cac.put('opportunity', v_fields || jsonb_build_object('id', v_target->>'id', 'qualification_reviewed', true, 'qualification', v_item->'payload'));
    elsif v_kind = 'draft' then
      perform cac.put('draft', jsonb_build_object('id', v_target->>'id', 'status', 'approved'));
    else
      perform cac.put(v_kind, jsonb_build_object('id', v_target->>'id', 'status', case when v_item->>'type' in ('survey','payment') then 'verified' else 'approved' end, 'approved_by', v_actor.user_id, 'approved_at', now()));
      if v_item->>'type' = 'change' then
        perform cac.put('task', jsonb_build_object('name', 'Bill approved change · ' || (v_target->>'name'), 'opportunity_id', (select opportunity_id from cac.project where id = (v_target->>'project_id')::uuid),
          'change_id', v_target->>'id', 'owner', 'Commercial review', 'due_date', current_date, 'status', 'open', 'category', 'billing', 'created_by', v_actor.user_id));
      end if;
    end if;
  elsif v_kind in ('quote','draft') then
    perform cac.put(v_kind, jsonb_build_object('id', v_target->>'id', 'status', 'rejected'));
  end if;

  for v_job in select * from cac.job where approval_id = p_approval loop
    if v_next is not null then
      update cac.job set approval_id = (v_next->>'id')::uuid, status = 'waiting_approval', step = 'commercial_review' where id = v_job.id;
    else
      update cac.job set status = case when p_decision = 'approved' then 'completed' else 'rejected' end, step = 'review_resolved', completed_at = now() where id = v_job.id;
    end if;
  end loop;

  perform cac.log(v_actor.user_id, 'approval.' || p_decision, v_item->>'target_id', jsonb_build_object('approvalId', p_approval, 'note', p_note));
  return cac.get('approval', p_approval);
end $$;

-- ── Pipeline stage gates ───────────────────────────────────────────────────

create or replace function cac.transition(p_opportunity uuid, p_stage text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales','project']);
  v_opp jsonb := cac.related('opportunity', p_opportunity, true);
  v_index int := array_position(cac.stages(), p_stage) - 1;
  v_result jsonb;
begin
  if v_index is null then perform cac.fail('Unknown stage.'); end if;
  if p_stage not in ('New enquiry','Deferred','Lost') then
    if not exists (select 1 from cac.activity where opportunity_id = p_opportunity and type = 'Human response') then perform cac.fail('Record a human response first.'); end if;
    if cac.blank(v_opp, 'next_action_date') and not exists (select 1 from cac.task where opportunity_id = p_opportunity and status = 'open') then perform cac.fail('Schedule the next action first.'); end if;
  end if;
  if v_index between 2 and 11 then
    perform cac.require_fields(v_opp, array['location','pool_type','budget','timeline','decision_maker']);
    if not (v_opp->>'qualification_reviewed')::boolean then perform cac.fail('Sales must approve qualification first.'); end if;
  end if;
  if p_stage = 'Site visit scheduled' then
    perform cac.require_fields(v_opp, array['visit_date']);
    if not (v_opp->>'visit_confirmed')::boolean then perform cac.fail('Record customer confirmation of the site visit.'); end if;
  end if;
  if v_index between 4 and 11 and not exists (select 1 from cac.survey where opportunity_id = p_opportunity and status = 'verified') then
    perform cac.fail('A verified survey is required.');
  end if;
  if v_index between 5 and 11 and not exists (select 1 from cac.quote where opportunity_id = p_opportunity and status = 'approved' and simulated_at is not null) then
    perform cac.fail('Approve a quotation and simulate delivery first.');
  end if;
  if v_index between 8 and 11 then
    perform cac.require_fields(v_opp, array['agreement_ref']);
    if not exists (select 1 from cac.payment where opportunity_id = p_opportunity and status = 'verified' and amount > 0) then perform cac.fail('A verified advance payment is required.'); end if;
  end if;
  if p_stage in ('Execution','Handover','Maintenance') and not exists (select 1 from cac.project where opportunity_id = p_opportunity) then
    perform cac.fail('Create the project handover first.');
  end if;
  if p_stage in ('Handover','Maintenance') and not exists (select 1 from cac.project where opportunity_id = p_opportunity and status = 'completed') then
    perform cac.fail('Complete the project handover checklist first.');
  end if;
  if p_stage = 'Lost' then perform cac.require_fields(v_opp, array['loss_reason']); end if;
  if p_stage = 'Deferred' then perform cac.require_fields(v_opp, array['next_action_date']); end if;
  v_result := cac.put('opportunity', jsonb_build_object('id', p_opportunity, 'stage', p_stage));
  perform cac.log(v_actor.user_id, 'opportunity.stage_changed', p_opportunity::text, jsonb_build_object('from', v_opp->>'stage', 'to', p_stage));
  return v_result;
end $$;

-- ── Quotations ─────────────────────────────────────────────────────────────

-- Each line is rounded to paise before summing, so printed lines always add up.
create or replace function cac.quote_totals(p_items jsonb)
returns jsonb language plpgsql immutable as $$
declare
  v_item jsonb; v_lines jsonb := '[]'; v_sub bigint := 0; v_tax bigint := 0;
  v_line_sub bigint; v_line_tax bigint; v_qty numeric;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 1e6 then perform cac.fail('Quote quantities must be greater than zero.'); end if;
    v_line_sub := round(round((v_item->>'price')::numeric * 100) * v_qty);
    v_line_tax := round(v_line_sub * (v_item->>'tax')::numeric / 100);
    v_sub := v_sub + v_line_sub; v_tax := v_tax + v_line_tax;
    v_lines := v_lines || jsonb_build_array(v_item || jsonb_build_object('subtotal', v_line_sub / 100.0, 'tax_amount', v_line_tax / 100.0, 'total', (v_line_sub + v_line_tax) / 100.0));
  end loop;
  return jsonb_build_object('items', v_lines, 'subtotal', v_sub / 100.0, 'tax', v_tax / 100.0, 'total', (v_sub + v_tax) / 100.0);
end $$;

create or replace function cac.create_quote_as(p_user uuid, p_input jsonb)
returns jsonb language plpgsql as $$
declare
  v_actor cac.staff := cac.require_role(p_user, array['commercial','engineer']);
  v_opp jsonb; v_survey jsonb; v_previous jsonb; v_rate jsonb; v_item jsonb;
  v_items jsonb := '[]'; v_qty numeric; v_version int; v_quote jsonb;
begin
  v_opp := cac.related('opportunity', nullif(p_input->>'opportunity_id', '')::uuid, true);
  v_survey := cac.related('survey', nullif(p_input->>'survey_id', '')::uuid);
  if v_survey->>'opportunity_id' <> v_opp->>'id' or v_survey->>'status' <> 'verified' then perform cac.fail('A verified survey for this opportunity is required.'); end if;
  if jsonb_typeof(p_input->'items') <> 'array' or jsonb_array_length(p_input->'items') not between 1 and 100 then perform cac.fail('Add 1–100 approved rate-card items.'); end if;
  perform cac.require_fields(p_input, array['scope','exclusions','terms']);
  for v_item in select * from jsonb_array_elements(p_input->'items') loop
    v_rate := cac.related('rate', nullif(v_item->>'rate_id', '')::uuid);
    if v_rate->>'status' <> 'approved' then perform cac.fail('Only approved rates may be used.'); end if;
    begin v_qty := (v_item->>'quantity')::numeric; exception when others then v_qty := null; end;
    v_items := v_items || jsonb_build_array(jsonb_build_object('rate_id', v_rate->>'id', 'name', v_rate->>'name', 'unit', v_rate->>'unit', 'price', (v_rate->>'price')::numeric, 'tax', (v_rate->>'tax')::numeric, 'quantity', v_qty));
  end loop;
  if not cac.blank(p_input, 'previous_id') then
    v_previous := cac.related('quote', (p_input->>'previous_id')::uuid);
    if v_previous->>'opportunity_id' <> v_opp->>'id' then perform cac.fail('Quote revision must belong to the same opportunity.'); end if;
  end if;
  select count(*) + 1 into v_version from cac.quote where opportunity_id = (v_opp->>'id')::uuid;
  v_quote := cac.put('quote', cac.quote_totals(v_items) || jsonb_build_object(
    'name', format('%s · v%s', v_opp->>'name', v_version), 'opportunity_id', v_opp->>'id', 'site_id', v_opp->>'site_id', 'survey_id', v_survey->>'id',
    'version', v_version, 'previous_id', v_previous->>'id', 'status', 'pending', 'scope', p_input->>'scope', 'exclusions', p_input->>'exclusions',
    'terms', p_input->>'terms', 'created_by', v_actor.user_id));
  perform cac.request_approval(v_actor.user_id, 'quote', v_quote, 'quote_engineering', 'engineer', 'Verify scope · ' || (v_quote->>'name'));
  perform cac.log(v_actor.user_id, 'quote.created', v_quote->>'id', jsonb_build_object('version', v_version, 'total', v_quote->'total'));
  return v_quote;
end $$;

create or replace function cac.create_quote(p_input jsonb)
returns jsonb language sql security definer set search_path = cac, public as $$
  select cac.create_quote_as(auth.uid(), p_input);
$$;

-- ── Record actions ─────────────────────────────────────────────────────────

create or replace function cac.complete_task(p_task uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales','engineer','commercial','project']);
  v_task jsonb := cac.related('task', p_task, true);
  v_result jsonb;
begin
  if v_task->>'status' <> 'open' then perform cac.fail('Only open tasks can be completed.'); end if;
  v_result := cac.put('task', jsonb_build_object('id', p_task, 'status', 'completed', 'completed_by', v_actor.user_id, 'completed_at', now()));
  perform cac.log(v_actor.user_id, 'task.completed', p_task::text);
  return v_result;
end $$;

create or replace function cac.complete_project(p_project uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['project']);
  v_project jsonb := cac.related('project', p_project, true);
  v_result jsonb;
begin
  if cac.blank(v_project, 'handover_checklist') or cac.blank(v_project, 'milestones') then perform cac.fail('Record completed milestones and a handover checklist first.'); end if;
  v_result := cac.put('project', jsonb_build_object('id', p_project, 'status', 'completed', 'completed_by', v_actor.user_id));
  perform cac.log(v_actor.user_id, 'project.completed', p_project::text);
  return v_result;
end $$;

create or replace function cac.suppress_prospect(p_prospect uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
  v_result jsonb;
begin
  perform cac.related('prospect', p_prospect, true);
  v_result := cac.put('prospect', jsonb_build_object('id', p_prospect, 'suppressed', true));
  perform cac.log(v_actor.user_id, 'prospect.opted_out', p_prospect::text);
  return v_result;
end $$;

create or replace function cac.bill_change(p_change uuid, p_invoice_ref text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['commercial']);
  v_change jsonb := cac.related('change', p_change, true);
  v_result jsonb;
begin
  if v_change->>'status' <> 'approved' then perform cac.fail('Approve the change and customer reference before billing.'); end if;
  if btrim(coalesce(p_invoice_ref, '')) = '' then perform cac.fail('An invoice reference is required.'); end if;
  if not cac.blank(v_change, 'invoice_ref') then perform cac.fail('This change already has an invoice reference.', 'P0409'); end if;
  v_result := cac.put('change', jsonb_build_object('id', p_change, 'billing_status', 'Billed', 'invoice_ref', btrim(p_invoice_ref), 'billed_at', now(), 'billed_by', v_actor.user_id));
  update cac.task set status = 'completed', completed_at = now(), completed_by = v_actor.user_id where change_id = p_change and status = 'open';
  perform cac.log(v_actor.user_id, 'change.billed', p_change::text, jsonb_build_object('invoiceRef', btrim(p_invoice_ref)));
  return v_result;
end $$;

-- Records a local delivery simulation. Nothing is sent to anyone.
create or replace function cac.simulate_delivery(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales','commercial']);
  v_target jsonb; v_opp jsonb; v_result jsonb;
begin
  if p_kind not in ('quote','draft') then perform cac.fail('Select an approved quotation or outreach draft.'); end if;
  v_target := cac.related(p_kind, p_id, true);
  if p_kind = 'draft' and v_target->>'agent' not in ('outreach','followup') then perform cac.fail('Internal briefs cannot be sent.'); end if;
  if v_target->>'status' <> 'approved' then perform cac.fail('Approval is required before simulated delivery.'); end if;
  if (select suppressed from cac.prospect where id = nullif(v_target->>'prospect_id', '')::uuid) then perform cac.fail('This recipient has opted out.'); end if;
  v_opp := cac.get('opportunity', nullif(v_target->>'opportunity_id', '')::uuid);
  if v_opp is not null and ((v_opp->>'suppressed')::boolean
      or (select suppressed from cac.customer where id = (v_opp->>'customer_id')::uuid)
      or coalesce((select permission = 'Opted out' from cac.contact where id = nullif(v_opp->>'contact_id', '')::uuid), false)) then
    perform cac.fail('This customer has opted out.');
  end if;
  if not cac.blank(v_target, 'simulated_at') then return v_target; end if;
  v_result := cac.put(p_kind, jsonb_build_object('id', p_id, 'simulated_at', now()));
  if v_opp is not null then
    perform cac.put('task', jsonb_build_object('name', 'Follow up on approved quotation / reply', 'opportunity_id', v_opp->>'id',
      'owner', (select name from cac.staff where user_id = (v_opp->>'owner_id')::uuid), 'due_date', current_date + 3, 'status', 'open', 'category', 'generic_followup', 'created_by', v_actor.user_id));
  end if;
  perform cac.log(v_actor.user_id, 'delivery.simulated', p_id::text, '{"externalSend": false}');
  return v_result;
end $$;
