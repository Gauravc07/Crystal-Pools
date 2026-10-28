-- ============================================================================
-- CAC controls, aligned with the Crystal Pools lead flow:
--   * each assistant can be turned on or off by an admin; a turned-off
--     assistant cannot be queued (upload, Gmail, Run, Read again, any workflow)
--   * paid AI is a switch (setting ai_enabled, off by default): while it is off
--     the worker uses the free rules whatever its provider configuration
--   * admins choose which workspace sections are shown (hidden_modules); hidden
--     sections keep their data and can be shown again
--   * follow-ups follow the lead flow: Day 1, Day 3, Day 7, then monthly
-- ============================================================================

alter table cac.agent add column active boolean not null default true;
-- Prospect research and campaign drafting are outside the lead flow (and use AI).
update cac.agent set active = false where id in ('research', 'outreach');

alter table cac.setting drop constraint setting_key_check;
alter table cac.setting add constraint setting_key_check check (key in ('review_url','response_target_minutes','user_hourly_run_limit','workspace_daily_run_limit',
  'lead_mail_query','lead_cadence','lead_owner_outreach','lead_owner_sales',
  'lead_mail_configured','lead_mail_last_poll','lead_mail_last_error','lead_mail_last_result',
  'ai_enabled','hidden_modules'));
insert into cac.setting (key, value) values ('ai_enabled', 'false'), ('hidden_modules', 'prospect,outreach,lifecycle') on conflict (key) do nothing;

-- Day 1, Day 3, Day 7, then a monthly reconnect (days are counted from the previous step).
-- Early-stage projects: introduce Crystal Pools to the architect on day 1, then reconnect monthly.
update cac.setting set value = '{"early": [1, 30, 30], "mid": [1, 2, 4, 30], "late": [1, 2, 4, 30]}', updated_at = now()
  where key = 'lead_cadence' and value::jsonb = '{"early": [7, 60, 90], "mid": [3, 14, 30, 60], "late": [1, 3, 7, 14]}'::jsonb;

create or replace function cac.sections()
returns text[] language sql immutable as $$
  select array['mywork','prospect','inbox','leads','pipeline','outreach','appointment','approval','agents','customers','survey','project','maintenance','lifecycle','reviews','task','reports','library'];
$$;

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
  if p_key = 'ai_enabled' and v_value not in ('true','false') then perform cac.fail('Paid AI must be on (true) or off (false).'); end if;
  if p_key = 'hidden_modules' then
    if exists (select 1 from unnest(string_to_array(v_value, ',')) m where btrim(m) <> '' and btrim(m) <> all(cac.sections())) then perform cac.fail('Unknown workspace section.'); end if;
    v_value := coalesce((select string_agg(distinct btrim(m), ',') from unnest(string_to_array(v_value, ',')) m where btrim(m) <> ''), '');
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

-- Admin: turn one assistant on or off.
create or replace function cac.set_agent_active(p_agent text, p_active boolean)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), '{}'); v_agent cac.agent;
begin
  update cac.agent set active = coalesce(p_active, false) where id = p_agent returning * into v_agent;
  if not found then perform cac.fail('Unknown assistant.'); end if;
  perform cac.log(v_actor.user_id, case when v_agent.active then 'agent.turned_on' else 'agent.turned_off' end, p_agent);
  return to_jsonb(v_agent);
end $$;

-- Every run (staff workflows, uploads, Gmail reports, Read again) is a cac.job row,
-- so a turned-off assistant is enforced here once for all of them.
create or replace function cac.guard_agent_active()
returns trigger language plpgsql as $$
declare v_agent cac.agent;
begin
  select * into v_agent from cac.agent where id = new.agent;
  if not v_agent.active then perform cac.fail(format('The %s assistant is turned off. An admin can turn it on in Agent studio.', v_agent.name), '42501'); end if;
  return new;
end $$;
create trigger guard_agent_active before insert on cac.job for each row execute function cac.guard_agent_active();

-- Worker: which AI to use. Paid AI only when an admin has switched it on.
create or replace function cac.worker_config()
returns jsonb language sql stable security definer set search_path = cac, public as $$
  select jsonb_build_object('ai_enabled', cac.setting_value('ai_enabled') = 'true');
$$;

-- Gmail is only checked while the lead report reader is on.
create or replace function cac.mail_poll_begin(p_configured boolean)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_last text;
begin
  update cac.setting set value = p_configured::text, updated_at = now() where key = 'lead_mail_configured' and value <> p_configured::text;
  if not p_configured or not (select active from cac.agent where id = 'leadimport') then return jsonb_build_object('due', false); end if;
  select value into v_last from cac.setting where key = 'lead_mail_last_poll' for update;
  if v_last <> '' and v_last::timestamptz > now() - interval '15 minutes' then return jsonb_build_object('due', false); end if;
  update cac.setting set value = now()::text, updated_at = now() where key = 'lead_mail_last_poll';
  return jsonb_build_object('due', true, 'query', cac.setting_value('lead_mail_query'));
end $$;

create or replace function cac.request_mail_check()
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), array['sales']);
begin
  if not (select active from cac.agent where id = 'leadimport') then
    perform cac.fail('The Lead report reader assistant is turned off. An admin can turn it on in Agent studio.', '42501');
  end if;
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
    and p.proname in ('sections','set_agent_active','guard_agent_active','worker_config') loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn.sig);
  end loop;
end $$;
grant execute on function cac.set_agent_active(text, boolean) to authenticated;
grant execute on function cac.worker_config() to service_role;
