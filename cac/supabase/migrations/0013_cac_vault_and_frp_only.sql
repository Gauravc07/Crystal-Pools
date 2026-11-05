-- ============================================================================
-- CAC is reduced to two parts: the drawings vault and the FRP quotation agent
-- (requirement forms, FRP proposals, FRP price list).
--
-- Kept tables: staff, event (audit log), doc_counter (document numbers),
--   schema_migrations, drawing, drawing_revision, frp_price, frp_config,
--   frp_requirement, frp_quote.
-- Dropped: every other CAC table (leads, pipeline, quotes from rate cards,
--   surveys, projects, maintenance, inventory, AI assistants and their queue,
--   Gmail lead reports, settings) and every function that served them.
-- Drawings no longer hang off opportunities, sites or projects: each drawing
--   names its client or site, and can be linked to an FRP requirement.
-- The "store" role goes with inventory (any store staff become viewers).
-- The weekly cac-worker cron job is unscheduled; survey-photo storage policies
--   are removed (the empty bucket is deleted where Supabase allows it).
-- ============================================================================

-- ── Drawings: client or site name, optional FRP requirement ────────────────

alter table cac.drawing add column client text, add column requirement_id uuid references cac.frp_requirement(id);
update cac.drawing d set client = left(coalesce(
  (select name from cac.project where id = d.project_id),
  (select name from cac.opportunity where id = d.opportunity_id),
  (select name from cac.site where id = d.site_id), 'Not recorded'), 160);
-- Dropping the columns also drops their foreign keys and the "attach to one of them" check.
alter table cac.drawing drop column opportunity_id, drop column site_id, drop column project_id;
alter table cac.drawing alter column client set not null;
alter table cac.drawing add constraint drawing_client_check check (char_length(client) between 2 and 160);
create index on cac.drawing (requirement_id);

-- ── Storage and schedules that served removed features ─────────────────────

drop policy if exists "cac: engineers upload survey photos" on storage.objects;
drop policy if exists "cac: staff read survey photos" on storage.objects;
do $$
begin
  if not exists (select 1 from storage.objects where bucket_id = 'cac-survey-photos') then
    begin
      delete from storage.buckets where id = 'cac-survey-photos';
    exception when others then
      null;  -- some Supabase versions only allow deleting buckets through the Storage API
    end;
  end if;
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cac-worker';
  end if;
end $$;

-- ── Tables ─────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'customer','contact','site','prospect','campaign','opportunity','activity','task','survey','rate','portfolio','quote','revision',
    'project','change','payment','maintenance','draft','approval','attachment','lead_link','appointment','service_visit','review_request',
    'knowledge','briefing','project_lead','lead_import','comment','mail_message',
    'inv_item','warehouse','stock_level','vendor','purchase_order','goods_receipt','material_request','stock_adjustment','stock_move',
    'agent','job','worker_status','setting'] loop
    execute format('drop table if exists cac.%I cascade', t);
  end loop;
end $$;

-- ── Functions: keep only what the vault, the FRP agent and staff accounts use ─

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
    where p.pronamespace = 'cac'::regnamespace and p.proname <> all (array[
      -- shared helpers
      'actor','blank','columns','fail','get','log','next_no','num','put','related','require_role','touch','is_staff',
      -- staff accounts and the workspace
      'bootstrap_admin','create_staff','ensure_staff','set_staff','password_changed','workspace_state','export_workspace',
      -- drawings vault
      'can_upload_drawing','create_drawing','add_drawing_revision','submit_drawing_revision','review_drawing_revision',
      -- FRP quotation agent
      'frp_num','frp_details','frp_build','frp_payments','frp_next_ref','frp_generate',
      'submit_frp_requirement','preview_frp','review_frp_quote','set_frp_special_price','rerun_frp_agent','save_frp_prices']) loop
    execute format('drop function if exists %s cascade', f.sig);
  end loop;
end $$;

-- ── Roles ──────────────────────────────────────────────────────────────────

update cac.staff set role = 'viewer' where role = 'store';
alter table cac.staff drop constraint staff_role_check;
alter table cac.staff add constraint staff_role_check check (role in ('admin','sales','engineer','commercial','project','field','viewer'));

create or replace function cac.ensure_staff(p_email text, p_name text, p_role text, p_password text)
returns jsonb language plpgsql set search_path = cac, public, extensions as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_new boolean := false;
  v_staff cac.staff;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then perform cac.fail('Enter a valid email address.'); end if;
  if v_name = '' then perform cac.fail('Name is required.'); end if;
  if p_role not in ('admin','sales','engineer','commercial','project','field','viewer') then perform cac.fail('Invalid role.'); end if;
  if exists (select 1 from cac.staff where email = v_email) then perform cac.fail('This email is already a staff member.', 'P0409'); end if;
  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    if char_length(coalesce(p_password, '')) not between 12 and 256 then perform cac.fail('Provide a 12–256 character initial password.'); end if;
    v_id := gen_random_uuid();
    v_new := true;
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb, jsonb_build_object('full_name', v_name), now(), now(), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now());
  end if;
  insert into cac.staff (user_id, name, email, role, must_change_password) values (v_id, v_name, v_email, p_role, v_new) returning * into v_staff;
  return to_jsonb(v_staff);
end $$;

create or replace function cac.set_staff(p_user uuid, p_role text, p_active boolean)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), '{}');
  v_staff cac.staff;
begin
  if p_role not in ('admin','sales','engineer','commercial','project','field','viewer') then perform cac.fail('Invalid role.'); end if;
  select * into v_staff from cac.staff where user_id = p_user for update;
  if not found then perform cac.fail('Staff member not found.', 'P0404'); end if;
  if v_staff.role = 'admin' and v_staff.active and (p_role <> 'admin' or not p_active)
     and not exists (select 1 from cac.staff where role = 'admin' and active and user_id <> p_user) then
    perform cac.fail('At least one active admin is required.');
  end if;
  update cac.staff set role = p_role, active = p_active where user_id = p_user returning * into v_staff;
  perform cac.log(v_actor.user_id, 'user.updated', p_user::text, jsonb_build_object('role', p_role, 'active', p_active));
  return to_jsonb(v_staff);
end $$;

-- ── Drawings vault ─────────────────────────────────────────────────────────

create or replace function cac.create_drawing(p_values jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['engineer','project','sales']);
  v_client text := btrim(coalesce(p_values->>'client', ''));
  v_req_id uuid;
  v_req cac.frp_requirement;
  v_result jsonb;
begin
  if cac.blank(p_values, 'name') or char_length(p_values->>'name') > 200 then perform cac.fail('Give the drawing a title (up to 200 characters).'); end if;
  if coalesce(p_values->>'discipline', '') not in ('Architectural','Structural (RCC)','Filtration & plumbing','Electrical','Tiling & finishes','FRP','Landscape','Shop drawing','As-built','Other') then
    perform cac.fail('Choose the drawing discipline.');
  end if;
  if not cac.blank(p_values, 'requirement_id') then
    begin v_req_id := (p_values->>'requirement_id')::uuid; exception when others then perform cac.fail('Choose a requirement from the list.'); end;
    select * into v_req from cac.frp_requirement where id = v_req_id;
    if not found then perform cac.fail('Choose a requirement from the list.'); end if;
    if v_client = '' then v_client := v_req.customer_name || ' · ' || v_req.location; end if;
  end if;
  if char_length(v_client) not between 2 and 160 then perform cac.fail('Enter the client or site, or choose a requirement.'); end if;
  v_result := cac.put('drawing', jsonb_build_object('name', btrim(p_values->>'name'), 'number', cac.next_no('DRG'), 'discipline', p_values->>'discipline',
    'client', v_client, 'requirement_id', v_req_id, 'notes', left(nullif(btrim(p_values->>'notes'), ''), 4000), 'status', 'draft', 'created_by', v_actor.user_id));
  perform cac.log(v_actor.user_id, 'drawing.created', v_result->>'id', jsonb_build_object('number', v_result->>'number'));
  return v_result;
end $$;

-- ── Workspace snapshot and backup ──────────────────────────────────────────

create or replace function cac.workspace_state()
returns jsonb language plpgsql stable security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.actor(auth.uid());
begin
  -- Field staff: their own requirements and the approved proposals made from them, nothing else.
  if v_actor.role = 'field' then
    return jsonb_build_object(
      'user', to_jsonb(v_actor),
      'users', jsonb_build_array(to_jsonb(v_actor)),
      'records', jsonb_build_object(
        'drawing', '[]'::jsonb, 'drawing_revision', '[]'::jsonb,
        'frp_requirement', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]') from cac.frp_requirement t where t.created_by = v_actor.user_id),
        'frp_quote', (select coalesce(jsonb_agg(to_jsonb(q) - 'lines' - 'subtotal' - 'issues' order by q.created_at desc), '[]')
                      from cac.frp_quote q join cac.frp_requirement t on t.id = q.requirement_id
                      where t.created_by = v_actor.user_id and q.status = 'approved')),
      'frp', jsonb_build_object('prices', (select coalesce(jsonb_agg(to_jsonb(f) - 'rate' - 'note' - 'updated_by' order by f.sort), '[]') from cac.frp_price f), 'config', null));
  end if;
  return jsonb_build_object(
    'user', to_jsonb(v_actor),
    'users', (select coalesce(jsonb_agg(to_jsonb(s) order by s.name), '[]') from cac.staff s),
    'records', jsonb_build_object(
      'drawing', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]') from cac.drawing t),
      'drawing_revision', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]') from cac.drawing_revision t),
      'frp_requirement', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]') from cac.frp_requirement t),
      'frp_quote', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]') from cac.frp_quote t)),
    'frp', jsonb_build_object('prices', (select coalesce(jsonb_agg(to_jsonb(f) order by f.sort), '[]') from cac.frp_price f), 'config', (select to_jsonb(c) from cac.frp_config c)));
end $$;

create or replace function cac.export_workspace()
returns jsonb language plpgsql stable security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), '{}');
  v_out jsonb := '{}';
  k text; v jsonb;
begin
  foreach k in array array['staff','event','doc_counter','drawing','drawing_revision','frp_price','frp_config','frp_requirement','frp_quote'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]'') from cac.%I t', k) into v;
    v_out := v_out || jsonb_build_object(k, v);
  end loop;
  return jsonb_build_object('exported_at', now(), 'exported_by', v_actor.email, 'schema_migrations', (select jsonb_agg(name order by name) from cac.schema_migrations), 'tables', v_out,
    'note', 'Drawing files stay in the cac-drawings Storage bucket; drawing_revision rows list their paths. Passwords are never exported.');
end $$;
