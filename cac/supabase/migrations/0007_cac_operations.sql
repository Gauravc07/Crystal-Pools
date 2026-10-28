-- ============================================================================
-- CAC operations hardening:
--   * forced password change for accounts created with a temporary password
--   * manual sending: staff send approved text from their own WhatsApp/email,
--     then record it (channel, who, when); counts as the human response
--   * duplicate customer protection (email / phone)
--   * task cancellation with a reason
--   * admin full-workspace backup export
-- ============================================================================

-- ── Accounts ───────────────────────────────────────────────────────────────

alter table cac.staff add column must_change_password boolean not null default false;
-- Accounts whose temporary password was shared outside the app must choose their own.
update cac.staff set must_change_password = true where email = 'g@gmail.com';

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
  if p_role not in ('admin','sales','engineer','commercial','project','viewer') then perform cac.fail('Invalid role.'); end if;
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
  -- A password chosen by someone else is temporary: the person must replace it at first sign-in.
  insert into cac.staff (user_id, name, email, role, must_change_password) values (v_id, v_name, v_email, p_role, v_new) returning * into v_staff;
  return to_jsonb(v_staff);
end $$;

-- The setup script's first admin chose their own password (CAC_ADMIN_PASSWORD), so no forced change.
create or replace function cac.bootstrap_admin(p_email text, p_name text, p_password text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_existing cac.staff; v_staff jsonb;
begin
  select * into v_existing from cac.staff where email = lower(btrim(p_email));
  if found then return to_jsonb(v_existing); end if;
  if exists (select 1 from cac.staff where role = 'admin' and active) then perform cac.fail('An active CAC admin already exists. Add staff from Settings.'); end if;
  v_staff := cac.ensure_staff(p_email, p_name, 'admin', p_password);
  update cac.staff set must_change_password = false where user_id = (v_staff->>'user_id')::uuid;
  return v_staff || '{"must_change_password": false}';
end $$;

-- Called by the app right after the signed-in person has changed their password in Supabase Auth.
create or replace function cac.password_changed()
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.actor(auth.uid());
begin
  update cac.staff set must_change_password = false where user_id = v_actor.user_id;
  perform cac.log(v_actor.user_id, 'user.password_changed', v_actor.user_id::text);
  return jsonb_build_object('ok', true);
end $$;

-- ── Duplicate customers ────────────────────────────────────────────────────

create or replace function cac.normalize_phone(p text)
returns text language sql immutable as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 10), '');
$$;

create or replace function cac.guard_duplicate_customer()
returns trigger language plpgsql as $$
declare v_name text;
begin
  if nullif(btrim(new.email), '') is not null then
    select name into v_name from cac.customer where id <> new.id and lower(btrim(email)) = lower(btrim(new.email)) limit 1;
    if found then perform cac.fail(format('A customer with this email already exists: %s. Add a site or opportunity to that customer instead.', v_name), '23505'); end if;
  end if;
  if char_length(coalesce(cac.normalize_phone(new.phone), '')) = 10 then
    select name into v_name from cac.customer where id <> new.id and cac.normalize_phone(phone) = cac.normalize_phone(new.phone) limit 1;
    if found then perform cac.fail(format('A customer with this phone number already exists: %s.', v_name), '23505'); end if;
  end if;
  return new;
end $$;
create trigger guard_duplicate_customer before insert or update of email, phone on cac.customer for each row execute function cac.guard_duplicate_customer();

-- ── Tasks: cancellation ────────────────────────────────────────────────────

alter table cac.task drop constraint task_status_check;
alter table cac.task add constraint task_status_check check (status in ('open','paused','completed','cancelled'));
alter table cac.task add column cancel_reason text;

create or replace function cac.cancel_task(p_task uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['sales','engineer','commercial','project']);
  v_task jsonb := cac.related('task', p_task, true);
  v_result jsonb;
begin
  if v_task->>'status' not in ('open','paused') then perform cac.fail('Only open or paused tasks can be cancelled.'); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then perform cac.fail('Give a short reason for cancelling.'); end if;
  v_result := cac.put('task', jsonb_build_object('id', p_task, 'status', 'cancelled', 'cancel_reason', btrim(p_reason), 'completed_by', v_actor.user_id, 'completed_at', now()));
  perform cac.log(v_actor.user_id, 'task.cancelled', p_task::text, jsonb_build_object('reason', btrim(p_reason)));
  return v_result;
end $$;

-- ── Manual sending ─────────────────────────────────────────────────────────
-- CAC never sends anything itself. Staff open the approved text in their own
-- WhatsApp or email, send it, then record it here.

alter table cac.draft add column sent_at timestamptz, add column sent_channel text, add column sent_by uuid;
alter table cac.quote add column sent_at timestamptz, add column sent_channel text, add column sent_by uuid;
alter table cac.review_request add column sent_at timestamptz, add column sent_channel text, add column sent_by uuid;

create or replace function cac.mark_sent(p_kind text, p_id uuid, p_channel text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), case when p_kind = 'review_request' then array['sales','project'] else array['sales','commercial'] end);
  v_target jsonb; v_opp jsonb; v_result jsonb;
begin
  if p_kind not in ('quote','draft','review_request') then perform cac.fail('Select an approved quotation, message or review request.'); end if;
  if p_channel not in ('WhatsApp','Email','Phone','In person') then perform cac.fail('Choose how it was sent: WhatsApp, Email, Phone or In person.'); end if;
  v_target := cac.related(p_kind, p_id, true);
  if not cac.blank(v_target, 'sent_at') then return v_target; end if;

  if p_kind = 'review_request' then
    if v_target->>'status' <> 'to_send' then perform cac.fail('This review request was already sent.'); end if;
    if (select suppressed from cac.customer where id = (v_target->>'customer_id')::uuid) then perform cac.fail('This customer has opted out.'); end if;
    if (select value from cac.setting where key = 'review_url') = '' then perform cac.fail('Set the Google review link in Settings first.'); end if;
    v_result := cac.put('review_request', jsonb_build_object('id', p_id, 'status', 'sent', 'simulated_at', now(), 'sent_at', now(), 'sent_channel', p_channel, 'sent_by', v_actor.user_id));
  else
    if p_kind = 'draft' and v_target->>'agent' not in ('outreach','followup') then perform cac.fail('Internal briefs cannot be sent.'); end if;
    if v_target->>'status' <> 'approved' then perform cac.fail('Approval is required before sending.'); end if;
    if (select suppressed from cac.prospect where id = nullif(v_target->>'prospect_id', '')::uuid) then perform cac.fail('This recipient has opted out.'); end if;
    v_opp := cac.get('opportunity', nullif(v_target->>'opportunity_id', '')::uuid);
    if v_opp is not null and ((v_opp->>'suppressed')::boolean
        or (select suppressed from cac.customer where id = (v_opp->>'customer_id')::uuid)
        or coalesce((select permission = 'Opted out' from cac.contact where id = nullif(v_opp->>'contact_id', '')::uuid), false)) then
      perform cac.fail('This customer has opted out.');
    end if;
    -- simulated_at doubles as "delivery recorded" for the existing pipeline gate.
    v_result := cac.put(p_kind, jsonb_build_object('id', p_id, 'sent_at', now(), 'sent_channel', p_channel, 'sent_by', v_actor.user_id,
      'simulated_at', coalesce(nullif(v_target->>'simulated_at', '')::timestamptz, now())));
    if v_opp is not null then
      -- Sending counts as the human response (speed to lead) and schedules one follow-up.
      perform cac.put('activity', jsonb_build_object('name', case when p_kind = 'quote' then 'Quotation sent' else 'Message sent' end, 'opportunity_id', v_opp->>'id',
        'type', 'Human response', 'channel', case when p_channel = 'In person' then 'Site' else p_channel end, 'direction', 'Outbound',
        'notes', left(coalesce(v_target->>'body', v_target->>'name'), 2000), 'created_by', v_actor.user_id));
      if v_target->>'simulated_at' is null then
        perform cac.put('task', jsonb_build_object('name', case when p_kind = 'quote' then 'Follow up on sent quotation' else 'Follow up on sent message' end,
          'opportunity_id', v_opp->>'id', 'owner', (select name from cac.staff where user_id = (v_opp->>'owner_id')::uuid), 'due_date', current_date + 3,
          'status', 'open', 'category', 'generic_followup', 'created_by', v_actor.user_id));
      end if;
    end if;
  end if;
  perform cac.log(v_actor.user_id, 'delivery.sent_manually', p_id::text, jsonb_build_object('kind', p_kind, 'channel', p_channel));
  return v_result;
end $$;

-- ── Backup ─────────────────────────────────────────────────────────────────

create or replace function cac.export_workspace()
returns jsonb language plpgsql stable security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), '{}');
  v_out jsonb := '{}';
  k text; v jsonb;
begin
  foreach k in array array['staff','customer','contact','site','prospect','campaign','opportunity','activity','task','survey','rate','portfolio','quote','revision',
    'project','change','payment','maintenance','draft','approval','attachment','lead_link','appointment','service_visit','review_request','knowledge','briefing','setting','job','event'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]'') from cac.%I t', k) into v;
    v_out := v_out || jsonb_build_object(k, v);
  end loop;
  return jsonb_build_object('exported_at', now(), 'exported_by', v_actor.email, 'schema_migrations', (select jsonb_agg(name order by name) from cac.schema_migrations), 'tables', v_out,
    'note', 'Survey photo files stay in the cac-survey-photos Storage bucket; attachment rows list their paths. Passwords are never exported.');
end $$;

-- The setup runner creates cac.schema_migrations; tests and fresh installs may not have it yet.
create table if not exists cac.schema_migrations (name text primary key, applied_at timestamptz not null default now());

-- ── Grants (lock down, then grant entry points) ────────────────────────────

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
  cac.set_setting(text, text), cac.request_review(uuid), cac.update_review(uuid, text, int), cac.launch_lifecycle(text, text),
  cac.password_changed(), cac.cancel_task(uuid, text), cac.mark_sent(text, uuid, text), cac.export_workspace()
to authenticated;

grant execute on function
  cac.claim_job(), cac.save_analysis(uuid, jsonb), cac.fail_job(uuid, text, boolean), cac.complete_job(uuid),
  cac.worker_heartbeat(text, boolean), cac.bootstrap_admin(text, text, text), cac.seed_demo(uuid)
to service_role;
