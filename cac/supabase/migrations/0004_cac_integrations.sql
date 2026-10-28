-- ============================================================================
-- CAC integrations: survey photo storage, website enquiry import, prospect
-- conversion, CSV import, staff management, workspace snapshot, demo seed and
-- function grants.
-- ============================================================================

-- ── Survey photos (private Storage bucket) ─────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cac-survey-photos', 'cac-survey-photos', false, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Object names are "<survey id>/<random>.<ext>". Engineers may add photos to an
-- unverified survey, at most 12 per survey. Photos cannot be replaced or deleted.
create or replace function cac.can_upload_photo(p_name text)
returns boolean language plpgsql stable security definer set search_path = cac, public as $$
declare v_survey uuid;
begin
  if p_name !~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,80}\.(png|jpe?g|webp)$' then return false; end if;
  v_survey := split_part(p_name, '/', 1)::uuid;
  return exists (select 1 from cac.staff where user_id = auth.uid() and active and role in ('admin','engineer'))
     and exists (select 1 from cac.survey where id = v_survey and status <> 'verified')
     and (select count(*) from cac.attachment where survey_id = v_survey) < 12;
end $$;

create policy "cac: staff read survey photos" on storage.objects for select to authenticated
  using (bucket_id = 'cac-survey-photos' and cac.is_staff());
create policy "cac: engineers upload survey photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'cac-survey-photos' and cac.can_upload_photo(name));

-- Records an uploaded object against its survey. MIME type and size come from
-- Storage's own metadata, not from the browser.
create or replace function cac.register_photo(p_survey uuid, p_path text, p_name text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['engineer']);
  v_survey jsonb := cac.related('survey', p_survey, true);
  v_meta jsonb;
  v_attachment jsonb;
begin
  if v_survey->>'status' = 'verified' then perform cac.fail('Verified survey photos are immutable. Create a new survey for changes.'); end if;
  if split_part(coalesce(p_path, ''), '/', 1) <> p_survey::text then perform cac.fail('Photo path does not belong to this survey.'); end if;
  if char_length(coalesce(p_name, '')) not between 1 and 200 then perform cac.fail('Photo name must be 1–200 characters.'); end if;
  select metadata into v_meta from storage.objects where bucket_id = 'cac-survey-photos' and name = p_path;
  if v_meta is null then perform cac.fail('Upload the photo before registering it.'); end if;
  if (select count(*) from cac.attachment where survey_id = p_survey) >= 12 then perform cac.fail('A survey supports at most 12 photos.'); end if;
  begin
    v_attachment := cac.put('attachment', jsonb_build_object('name', p_name, 'survey_id', p_survey, 'path', p_path,
      'mime', v_meta->>'mimetype', 'size', (v_meta->>'size')::int, 'created_by', v_actor.user_id));
  exception when check_violation then
    perform cac.fail('Use a PNG, JPEG or WebP image smaller than 2 MB.');
  end;
  perform cac.put('survey', jsonb_build_object('id', p_survey, 'photos', concat_ws(E'\n', nullif(v_survey->>'photos', ''), format('%s (%s)', p_name, v_attachment->>'id'))));
  perform cac.log(v_actor.user_id, 'survey.photo_uploaded', p_survey::text, jsonb_build_object('attachmentId', v_attachment->>'id'));
  return v_attachment;
end $$;

-- ── CSV import (each row validated and saved independently) ────────────────

create or replace function cac.import_rows(p_kind text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
  v_row jsonb; v_index int := 0; v_created int := 0; v_errors jsonb := '[]';
begin
  if p_kind not in ('customer','prospect') or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 200 then
    perform cac.fail('Import 1–200 customer or prospect rows.');
  end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    begin
      perform cac.write_record_as(v_actor.user_id, p_kind, v_row);
      v_created := v_created + 1;
    exception when others then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_index + 1, 'error', sqlerrm));
    end;
  end loop;
  perform cac.log(v_actor.user_id, 'csv.imported', p_kind, jsonb_build_object('created', v_created, 'errors', jsonb_array_length(v_errors)));
  return jsonb_build_object('created', v_created, 'errors', v_errors);
end $$;

-- ── Approved prospect → customer, site and opportunity ─────────────────────

create or replace function cac.convert_prospect(p_prospect uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
  v_prospect jsonb := cac.related('prospect', p_prospect, true);
  v_customer jsonb; v_site jsonb; v_opp jsonb;
begin
  if v_prospect->>'status' <> 'approved' then perform cac.fail('Approve the prospect research before converting it.'); end if;
  if (v_prospect->>'suppressed')::boolean then perform cac.fail('This prospect has opted out.'); end if;
  if not cac.blank(v_prospect, 'converted_opportunity_id') then perform cac.fail('This prospect already has an opportunity.', 'P0409'); end if;
  v_customer := cac.put('customer', jsonb_build_object('name', v_prospect->>'name', 'segment', v_prospect->>'segment',
    'notes', format('Converted from prospect research. Website: %s', v_prospect->>'website'), 'created_by', v_actor.user_id));
  v_site := cac.put('site', jsonb_build_object('name', format('%s · %s', v_prospect->>'name', v_prospect->>'location'), 'customer_id', v_customer->>'id',
    'location', v_prospect->>'location', 'notes', 'Site to confirm with the customer.', 'created_by', v_actor.user_id));
  v_opp := cac.put('opportunity', jsonb_build_object('name', format('%s · %s', v_prospect->>'name', coalesce(nullif(v_prospect->>'service', ''), 'commercial enquiry')),
    'customer_id', v_customer->>'id', 'site_id', v_site->>'id', 'prospect_id', p_prospect,
    'route', case when v_prospect->>'segment' in ('Architect','Contractor') then 'Referral' else 'Commercial' end,
    'source', 'Prospect research', 'owner_id', v_actor.user_id, 'location', v_prospect->>'location',
    'notes', format(E'Evidence: %s\nSource: %s\nExisting pool: %s\nOpen questions: %s', v_prospect->>'evidence', v_prospect->>'source_url', v_prospect->>'existing_pool', coalesce(v_prospect->>'open_questions', 'None recorded')),
    'next_action', 'Confirm interest and the decision-maker', 'next_action_date', current_date + 2, 'created_by', v_actor.user_id));
  perform cac.put('prospect', jsonb_build_object('id', p_prospect, 'converted_opportunity_id', v_opp->>'id'));
  perform cac.log(v_actor.user_id, 'prospect.converted', p_prospect::text, jsonb_build_object('opportunityId', v_opp->>'id'));
  return v_opp;
end $$;

-- ── Website enquiries (public.leads) → lead inbox ──────────────────────────
-- Reads the website's contact-form table when it is in the same project. The
-- website's lead rows are never modified; cac.lead_link prevents duplicates.

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
  for v_lead in execute 'select l.id, l.name, l.email, l.phone, l.project_type, l.message, l.source_page from public.leads l
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
      'customer_id', v_customer->>'id', 'site_id', v_site->>'id', 'lead_id', v_lead.id,
      'route', case when v_commercial then 'Commercial' else 'Residential' end, 'source', 'Website form', 'owner_id', v_actor.user_id,
      'notes', format(E'%s\n\nSubmitted from: %s', v_lead.message, coalesce(nullif(v_lead.source_page, ''), 'website')),
      'next_action', 'Respond to the website enquiry', 'next_action_date', current_date, 'created_by', v_actor.user_id));
    insert into cac.lead_link (lead_id, opportunity_id) values (v_lead.id, (v_opp->>'id')::uuid);
    v_count := v_count + 1;
  end loop;
  perform cac.log(v_actor.user_id, 'website.leads_imported', 'public.leads', jsonb_build_object('created', v_count));
  return jsonb_build_object('created', v_count);
end $$;

-- ── Staff management ───────────────────────────────────────────────────────

-- Links an existing Supabase Auth user by email, or creates one with the given
-- password (same approach as the website's admin_create_user).
create or replace function cac.ensure_staff(p_email text, p_name text, p_role text, p_password text)
returns jsonb language plpgsql set search_path = cac, public, extensions as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_staff cac.staff;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then perform cac.fail('Enter a valid email address.'); end if;
  if v_name = '' then perform cac.fail('Name is required.'); end if;
  if p_role not in ('admin','sales','engineer','commercial','project','viewer') then perform cac.fail('Invalid role.'); end if;
  if exists (select 1 from cac.staff where email = v_email) then perform cac.fail('This email is already a staff member.', 'P0409'); end if;
  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    if char_length(coalesce(p_password, '')) not between 12 and 256 then perform cac.fail('Provide a 12–256 character initial password.'); end if;
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb, jsonb_build_object('full_name', v_name), now(), now(), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now());
  end if;
  insert into cac.staff (user_id, name, email, role) values (v_id, v_name, v_email, p_role) returning * into v_staff;
  return to_jsonb(v_staff);
end $$;

create or replace function cac.create_staff(p_email text, p_name text, p_role text, p_password text default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), '{}');
  v_staff jsonb := cac.ensure_staff(p_email, p_name, p_role, p_password);
begin
  perform cac.log(v_actor.user_id, 'user.created', v_staff->>'user_id', jsonb_build_object('role', p_role));
  return v_staff;
end $$;

create or replace function cac.set_staff(p_user uuid, p_role text, p_active boolean)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), '{}');
  v_staff cac.staff;
begin
  if p_role not in ('admin','sales','engineer','commercial','project','viewer') then perform cac.fail('Invalid role.'); end if;
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

-- Setup script only (service role): first admin for an empty workspace.
create or replace function cac.bootstrap_admin(p_email text, p_name text, p_password text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_existing cac.staff;
begin
  select * into v_existing from cac.staff where email = lower(btrim(p_email));
  if found then return to_jsonb(v_existing); end if;
  if exists (select 1 from cac.staff where role = 'admin' and active) then perform cac.fail('An active CAC admin already exists. Add staff from Settings.'); end if;
  return cac.ensure_staff(p_email, p_name, 'admin', p_password);
end $$;

-- ── Workspace snapshot for the staff app ───────────────────────────────────

create or replace function cac.workspace_state()
returns jsonb language plpgsql stable security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.actor(auth.uid());
  v_records jsonb := '{}';
  k text;
  v jsonb;
begin
  foreach k in array array['customer','contact','site','prospect','opportunity','activity','task','survey','rate','portfolio','campaign','project','change','payment','maintenance','quote','draft','approval','revision','attachment'] loop
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
    'config', jsonb_build_object(
      'outbound', 'disabled',
      'database', 'Supabase · cac schema',
      'worker', (select to_jsonb(w) from cac.worker_status w),
      'website_leads', to_regclass('public.leads') is not null,
      'photo_bucket', 'cac-survey-photos'));
end $$;

-- ── Demo data (setup script only; synthetic records) ───────────────────────

create or replace function cac.seed_demo(p_admin uuid)
returns void language plpgsql security definer set search_path = cac, public as $$
declare
  v_customer jsonb; v_villa jsonb; v_site jsonb; v_villa_site jsonb; v_opp jsonb; v_survey jsonb;
  v_rate1 jsonb; v_rate2 jsonb; v_prospect jsonb; v_portfolio jsonb;
begin
  perform cac.actor(p_admin);
  if exists (select 1 from cac.customer) then return; end if;
  v_customer := cac.put('customer', jsonb_build_object('name', 'Sahyadri Retreat (demo)', 'segment', 'Resort', 'email', 'projects@example.invalid', 'notes', 'Synthetic commercial customer for pilot testing.', 'created_by', p_admin));
  v_villa := cac.put('customer', jsonb_build_object('name', 'Meadow Villa (demo)', 'segment', 'Residential', 'email', 'owner@example.invalid', 'created_by', p_admin));
  v_site := cac.put('site', jsonb_build_object('name', 'Lonavala resort · west garden', 'customer_id', v_customer->>'id', 'location', 'Lonavala', 'address', 'Demo site, Maharashtra', 'created_by', p_admin));
  v_villa_site := cac.put('site', jsonb_build_object('name', 'Pune villa', 'customer_id', v_villa->>'id', 'location', 'Pune', 'created_by', p_admin));
  v_opp := cac.put('opportunity', jsonb_build_object('name', 'Sahyadri · resort pool', 'customer_id', v_customer->>'id', 'site_id', v_site->>'id', 'route', 'Commercial', 'source', 'Referral',
    'owner_id', p_admin, 'location', 'Lonavala', 'pool_type', 'Overflow pool', 'budget', 2400000, 'timeline', 'December, year to confirm', 'decision_maker', 'Property owner',
    'stage', 'Estimate sent', 'qualification_reviewed', true, 'next_action', 'Review heating request', 'next_action_date', current_date + 1,
    'notes', 'Demo customer is evaluating a pool for the west garden.', 'created_by', p_admin));
  perform cac.put('opportunity', jsonb_build_object('name', 'Meadow · private pool', 'customer_id', v_villa->>'id', 'site_id', v_villa_site->>'id', 'route', 'Residential', 'source', 'Manual enquiry',
    'owner_id', p_admin, 'location', 'Pune', 'pool_type', 'Skimmer pool', 'budget', 1200000, 'timeline', 'To confirm', 'next_action', 'Arrange an introductory call',
    'next_action_date', current_date + 1, 'notes', 'We are planning a pool at our Pune villa. Please share the process.', 'created_by', p_admin));
  perform cac.put('activity', jsonb_build_object('name', 'Initial consultation', 'opportunity_id', v_opp->>'id', 'type', 'Human response', 'notes', 'Discussed site access and the initial pool scope.', 'created_by', p_admin));
  perform cac.put('task', jsonb_build_object('name', 'Generic quotation follow-up', 'opportunity_id', v_opp->>'id', 'owner', (select name from cac.staff where user_id = p_admin), 'due_date', current_date - 1, 'category', 'generic_followup', 'created_by', p_admin));
  v_survey := cac.put('survey', jsonb_build_object('name', 'West garden survey (demo)', 'opportunity_id', v_opp->>'id', 'length', 12, 'width', 6, 'depth', 1.4,
    'access', 'Engineer verified demo access', 'electrical', 'Pending equipment selection; no heater specified', 'drainage', 'Demo drainage observation',
    'photos', 'Synthetic survey placeholder, replace before real use', 'notes', 'Demo measurements only.', 'status', 'verified', 'approved_by', p_admin, 'approved_at', now(), 'created_by', p_admin));
  v_rate1 := cac.put('rate', jsonb_build_object('name', 'Pool civil works · DEMO RATE', 'unit', 'm²', 'price', 14500, 'tax', 18, 'scope', 'Illustrative civil works only; replace with approved company rates.', 'status', 'approved', 'approved_by', p_admin, 'approved_at', now(), 'created_by', p_admin));
  v_rate2 := cac.put('rate', jsonb_build_object('name', 'Waterproofing · DEMO RATE', 'unit', 'm²', 'price', 1850, 'tax', 18, 'scope', 'Illustrative waterproofing rate only.', 'status', 'approved', 'approved_by', p_admin, 'approved_at', now(), 'created_by', p_admin));
  perform cac.put('quote', cac.quote_totals(jsonb_build_array(
      jsonb_build_object('rate_id', v_rate1->>'id', 'name', v_rate1->>'name', 'unit', 'm²', 'price', 14500, 'tax', 18, 'quantity', 72),
      jsonb_build_object('rate_id', v_rate2->>'id', 'name', v_rate2->>'name', 'unit', 'm²', 'price', 1850, 'tax', 18, 'quantity', 72)))
    || jsonb_build_object('name', 'Sahyadri · resort pool · v1', 'opportunity_id', v_opp->>'id', 'site_id', v_site->>'id', 'survey_id', v_survey->>'id', 'version', 1, 'status', 'approved',
      'scope', 'Demonstration pool civil works and waterproofing.', 'exclusions', 'Heating, equipment sizing and electrical supply are excluded.',
      'terms', 'Illustrative terms. Commercial owner must replace these before use.', 'simulated_at', now(), 'engineering_approved_by', p_admin, 'approved_by', p_admin, 'approved_at', now(), 'created_by', p_admin));
  perform cac.put('prospect', jsonb_build_object('name', 'Canopy Hospitality (demo)', 'segment', 'Hotel', 'location', 'Pune', 'website', 'https://canopy.example.invalid', 'source_url', 'https://canopy.example.invalid',
    'evidence', 'Synthetic expansion announcement for testing only.', 'service', 'Commercial construction', 'research_date', current_date, 'contact', 'Published business contact to verify', 'created_by', p_admin));
  perform cac.put('prospect', jsonb_build_object('name', 'Studio Terrain (demo)', 'segment', 'Architect', 'location', 'Mumbai', 'website', 'https://terrain.example.invalid', 'source_url', 'https://terrain.example.invalid',
    'evidence', 'Synthetic landscape practice for referral testing.', 'service', 'Referral partnership', 'research_date', current_date, 'contact', 'Published business contact to verify', 'created_by', p_admin));
  v_prospect := cac.put('prospect', jsonb_build_object('name', 'Western Hills Resort (demo)', 'segment', 'Resort', 'location', 'Lonavala', 'website', 'https://western.example.invalid', 'source_url', 'https://western.example.invalid',
    'evidence', 'Synthetic resort record. Existing pool status is unknown.', 'service', 'Service enquiry', 'research_date', current_date, 'contact', 'Published business contact to verify', 'created_by', p_admin));
  v_portfolio := cac.put('portfolio', jsonb_build_object('name', 'Commercial pool capability · DEMO', 'segment', 'Resort', 'description', 'Illustrative capability statement for pilot messages. Replace with verified Crystal Pools project material.',
    'source_url', 'https://example.invalid/portfolio', 'status', 'approved', 'approved_by', p_admin, 'approved_at', now(), 'created_by', p_admin));
  perform cac.put('campaign', jsonb_build_object('name', 'Western Maharashtra · commercial pilot', 'type', 'Commercial project introduction', 'region', 'Pune–Mumbai (serviceability to confirm)', 'cost', 0, 'effort_hours', 0, 'notes', 'Synthetic contacts only.', 'created_by', p_admin));
  perform cac.put('maintenance', jsonb_build_object('name', 'Demo resort · annual care', 'customer_id', v_customer->>'id', 'site_id', v_site->>'id', 'equipment', 'Demo filtration asset; model to verify',
    'warranty_date', current_date + 180, 'service_history', 'Demo: filter inspection recorded, no technical fault established.', 'next_service', current_date + 7, 'renewal_date', current_date + 25, 'created_by', p_admin));
  perform cac.request_approval(p_admin, 'prospect', v_prospect, 'prospect', 'sales', 'Review Western Hills Resort for outreach');
  perform cac.log(p_admin, 'pilot.seeded', 'cac', jsonb_build_object('synthetic', true, 'portfolioId', v_portfolio->>'id'));
end $$;

-- ── Function grants ────────────────────────────────────────────────────────
-- Postgres grants EXECUTE on every new function to PUBLIC, and a per-schema
-- ALTER DEFAULT PRIVILEGES cannot remove that. Revoke everything, then grant
-- only the staff entry points and the worker entry points.

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
  cac.create_staff(text, text, text, text), cac.set_staff(uuid, text, boolean)
to authenticated;

grant execute on function
  cac.claim_job(), cac.save_analysis(uuid, jsonb), cac.fail_job(uuid, text, boolean), cac.complete_job(uuid),
  cac.worker_heartbeat(text, boolean), cac.bootstrap_admin(text, text, text), cac.seed_demo(uuid)
to service_role;
