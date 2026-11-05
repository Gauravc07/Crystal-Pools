-- ============================================================================
-- FRP quotations, second round:
-- * The office (admin or commercial) can change any price on a quotation. The
--   agent then regenerates it as a new version, and the office sends it to the
--   site user who took the requirement, with a remark.
-- * Requirement forms record who referred the customer.
-- * Fix: the 100th proposal of a month no longer clashes with the 10th.
-- Office prices belong to the requirement (frp_requirement.price_overrides), so
-- later versions keep them: a resubmitted requirement or a re-run of the agent.
-- ============================================================================

alter table cac.frp_requirement
  add column referred_by text check (referred_by is null or char_length(referred_by) between 1 and 120),
  add column price_overrides jsonb not null default '{}'::jsonb;  -- {price-list code: rate} set by the office for this customer
alter table cac.frp_quote add column remark text;                   -- the office's remark, sent to the site user with the approved quotation

-- ── The agent, with office prices ──────────────────────────────────────────
-- Same rules as before (see 0012). p_rates replaces price-list rates for this
-- quotation only; each line keeps the list rate beside it and is marked "edited".
drop function cac.frp_build(jsonb);
create function cac.frp_build(p jsonb, p_rates jsonb default '{}')
returns jsonb language plpgsql stable as $$
declare
  t jsonb := (select terms from cac.frp_config where id = 1);
  v_rates jsonb := coalesce(p_rates, '{}');
  v_l numeric := (p->>'length_ft')::numeric;
  v_w numeric := (p->>'width_ft')::numeric;
  v_d numeric := (p->>'depth_ft')::numeric;
  v_size numeric := (p->>'tile_size_in')::numeric;
  v_water numeric; v_area numeric; v_surface numeric; v_litres numeric; v_flow numeric;
  v_auto text[] := '{}';
  v_filter text; v_cap numeric; v_media numeric; v_pump numeric;
  v_lights int; v_skimmers int; v_jets int; v_drains int; v_suction int; v_ladders int; v_hose int;
  v_dispenser boolean := coalesce((p->>'dispenser')::boolean, false);
  v_round numeric := coalesce((t->>'round_to')::numeric, 10);
  v_lines jsonb := '[]'; v_issues jsonb := '[]'; v_upgrades jsonb;
  v_sub numeric := 0; v_amount numeric; v_rate numeric;
  v_line record; r cac.frp_price;
begin
  v_water := round(v_d - (t->>'freeboard_ft')::numeric, 2);
  if v_water < 1 then perform cac.fail('The pool must hold at least 1 ft of water. Increase the depth.'); end if;
  v_area := round(v_l * v_w + 2 * (v_l + v_w) * v_d, 2);
  v_surface := round(v_l * v_w, 2);
  v_litres := round(v_l * v_w * v_water * (t->>'litres_per_cft')::numeric);
  v_flow := round(v_litres / 1000.0 / (t->>'turnover_hours')::numeric, 2);

  v_filter := p->>'filter';
  if v_filter is null then v_filter := case when v_flow <= 16 then '650' else '700' end; v_auto := v_auto || 'filter'::text; end if;
  v_cap := case v_filter when '650' then 16 else 20 end;
  v_media := (p->>'media_kg')::numeric;
  if v_media is null then v_media := case v_filter when '650' then 100 else 250 end; v_auto := v_auto || 'media_kg'::text; end if;
  v_pump := (p->>'pump_hp')::numeric;
  if v_pump is null then v_pump := case when v_flow <= 9 then 1.5 else 2 end; v_auto := v_auto || 'pump_hp'::text; end if;
  v_lights := (p->>'lights')::int;
  if v_lights is null then v_lights := greatest(2, ceil(v_surface / 90)::int); v_lights := v_lights + v_lights % 2; v_auto := v_auto || 'lights'::text; end if;
  v_skimmers := (p->>'skimmers')::int;
  if v_skimmers is null then v_skimmers := case when v_surface <= 450 then 1 else 2 end; v_auto := v_auto || 'skimmers'::text; end if;
  v_jets := (p->>'jets')::int;
  if v_jets is null then v_jets := case when v_litres <= 50000 then 1 else 2 end; v_auto := v_auto || 'jets'::text; end if;
  v_drains := (p->>'drains')::int;
  if v_drains is null then v_drains := 1; v_auto := v_auto || 'drains'::text; end if;
  v_suction := (p->>'suction_points')::int;
  if v_suction is null then v_suction := 0; v_auto := v_auto || 'suction_points'::text; end if;
  v_ladders := (p->>'ladders')::int;
  if v_ladders is null then v_ladders := 1; v_auto := v_auto || 'ladders'::text; end if;
  v_hose := (p->>'hose_m')::int;
  if v_hose is null then v_hose := case when v_l <= 30 then 9 when v_l <= 40 then 11 else 15 end; v_auto := v_auto || 'hose_m'::text; end if;

  if v_flow > v_cap then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object('level', 'warn', 'text',
      format('The pool needs about %s m³/h of filtration for a %s-hour turnover, more than the %sØ filter handles (%s m³/h). Ask an engineer to size the filtration.',
        trim_scale(v_flow), trim_scale((t->>'turnover_hours')::numeric), v_filter, v_cap)));
  end if;

  for v_line in select x.code, x.qty from (values
      (1, 'shell', v_area), (2, 'filter_' || v_filter, 1::numeric), (3, 'media', v_media),
      (4, case when v_pump = 2 then 'pump_2' else 'pump_1_5' end, 1), (5, 'skimmer', v_skimmers), (6, 'jet', v_jets),
      (7, 'drain', v_drains), (8, 'suction', v_suction), (9, 'ladder', v_ladders), (10, 'light', v_lights),
      (11, 'driver', case when v_lights > 0 then 1 else 0 end), (12, 'remote', case when v_lights > 0 then 1 else 0 end),
      (13, 'plumbing', 1), (14, 'kit', 1), (15, 'dispenser', case when v_dispenser then 1 else 0 end), (16, 'install', 1)
    ) x(n, code, qty) where x.qty > 0 order by x.n loop
    select * into r from cac.frp_price where code = v_line.code;
    v_rate := coalesce((v_rates->>v_line.code)::numeric, r.rate);
    if r.code is null or v_rate is null then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('level', 'block', 'text', format('The FRP price list has no rate for %s.', coalesce(r.name, v_line.code))));
      v_amount := 0;
    else
      v_amount := round(v_line.qty * v_rate, 2);
    end if;
    v_sub := v_sub + v_amount;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('code', v_line.code, 'name', coalesce(r.name, v_line.code), 'unit', r.unit,
      'qty', v_line.qty, 'rate', v_rate, 'list_rate', r.rate, 'edited', v_rates ? v_line.code, 'amount', v_amount));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('code', f.code, 'title', f.name, 'text', f.description, 'unit', f.unit, 'rate', x.rate,
      'list_rate', f.rate, 'edited', v_rates ? f.code,
      'price', case when x.rate is null then null else round(x.rate * case when f.unit = 'sq ft' then v_surface else 1 end / v_round) * v_round end)
      order by f.sort), '[]')
    into v_upgrades from cac.frp_price f cross join lateral (select coalesce((v_rates->>f.code)::numeric, f.rate) as rate) x
    where f.grp = 'upgrade' and f.code in (select jsonb_array_elements_text(coalesce(p->'upgrades', '[]')));

  return jsonb_build_object(
    'pool', jsonb_build_object('length_ft', v_l, 'width_ft', v_w, 'depth_ft', v_d, 'water_depth_ft', v_water,
      'area_sqft', v_area, 'surface_sqft', v_surface, 'volume_l', v_litres,
      'tile_colour', p->>'tile_colour', 'tile_size_in', v_size,
      'tiles_long', floor(v_l * 12 / v_size), 'tiles_wide', floor(v_w * 12 / v_size)),
    'equipment', jsonb_build_object('filter', v_filter, 'filter_capacity_m3h', v_cap, 'media_kg', v_media, 'pump_hp', v_pump,
      'lights', v_lights, 'skimmers', v_skimmers, 'jets', v_jets, 'drains', v_drains, 'suction_points', v_suction,
      'ladders', v_ladders, 'hose_m', v_hose, 'dispenser', v_dispenser),
    'auto', to_jsonb(v_auto), 'flow_m3h', v_flow, 'turnover_hours', (t->>'turnover_hours')::numeric,
    'upgrades', v_upgrades, 'notes', p->>'notes',
    'lines', v_lines, 'issues', v_issues, 'subtotal', v_sub, 'total', round(v_sub / v_round) * v_round,
    'terms', t);
end $$;

-- FRP/<initials>/<yy>/<Mon>/<nn>, numbered per month. Fix: past the 99th proposal of a month
-- the number grows to three digits (lpad alone cut "100" to "10", which clashed with the tenth).
create or replace function cac.frp_next_ref(p_name text)
returns text language plpgsql as $$
declare
  v_d date := (now() at time zone 'Asia/Kolkata')::date;
  v_words text[] := regexp_split_to_array(btrim(regexp_replace(coalesce(p_name, ''), '[^A-Za-z ]', '', 'g')), '\s+');
  v_initials text := upper(coalesce(left(v_words[1], 1), '') || coalesce(left(v_words[2], 1), ''));
  v_key text := to_char(v_d, 'YY') || '-' || to_char(v_d, 'Mon');
  v_n int;
begin
  if v_initials = '' then v_initials := 'CP'; end if;
  insert into cac.doc_counter (prefix, fy, n) values ('FRP', v_key, 1)
    on conflict (prefix, fy) do update set n = cac.doc_counter.n + 1 returning n into v_n;
  return format('FRP/%s/%s/%s/%s', v_initials, to_char(v_d, 'YY'), to_char(v_d, 'Mon'), case when v_n < 100 then lpad(v_n::text, 2, '0') else v_n::text end);
end $$;

-- Runs the agent for a requirement (with its office prices) and saves the next proposal version.
create or replace function cac.frp_generate(p_requirement uuid, p_actor uuid)
returns jsonb language plpgsql as $$
declare
  v_req cac.frp_requirement;
  v_staff cac.staff;
  v_prev cac.frp_quote;
  v_build jsonb;
  v_version int;
  v_ref text;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_quote jsonb;
begin
  select * into v_req from cac.frp_requirement where id = p_requirement for update;
  if not found then perform cac.fail('Requirement not found.', 'P0404'); end if;
  select * into v_staff from cac.staff where user_id = v_req.created_by;
  v_build := cac.frp_build(v_req.details, v_req.price_overrides);
  select * into v_prev from cac.frp_quote where requirement_id = p_requirement order by version desc limit 1;
  v_version := coalesce(v_prev.version, 0) + 1;
  v_ref := case when v_prev.id is null then cac.frp_next_ref(v_staff.name)
                else split_part(v_prev.reference, '-R', 1) || '-R' || (v_version - 1) end;
  update cac.frp_quote set status = 'superseded' where requirement_id = p_requirement and status <> 'superseded';
  v_quote := cac.put('frp_quote', jsonb_build_object(
    'name', format('%s · %s · %s × %s ft', v_req.customer_name, v_req.location, trim_scale((v_build#>>'{pool,length_ft}')::numeric), trim_scale((v_build#>>'{pool,width_ft}')::numeric)),
    'reference', v_ref, 'requirement_id', p_requirement, 'version', v_version,
    'quote_date', v_today, 'valid_till', v_today + (v_build#>>'{terms,validity_days}')::int,
    'proposal', (v_build - 'lines' - 'issues' - 'subtotal' - 'total') || jsonb_build_object(
      'customer', jsonb_build_object('name', v_req.customer_name, 'location', v_req.location, 'phone', v_req.phone, 'email', v_req.email, 'address', v_req.address),
      'requirement_number', v_req.number,
      'prepared_by', jsonb_build_object('name', v_staff.name, 'user_id', v_req.created_by)),
    'lines', v_build->'lines', 'issues', v_build->'issues', 'subtotal', v_build->'subtotal', 'total', v_build->'total',
    'payments', cac.frp_payments((v_build->>'total')::numeric, v_build#>'{terms,payment}'),
    'status', 'draft', 'created_by', p_actor));
  update cac.frp_requirement set quote_id = (v_quote->>'id')::uuid, status = 'submitted', return_note = null where id = p_requirement;
  perform cac.log(p_actor, 'frp.quote_prepared', v_quote->>'id', jsonb_build_object('agent', 'FRP quotation agent', 'reference', v_ref,
    'requirement', v_req.number, 'total', v_quote->'total', 'auto', v_build->'auto', 'office_prices', v_req.price_overrides));
  return v_quote;
end $$;

-- ── Staff actions ──────────────────────────────────────────────────────────

-- As in 0012, plus "Referred by" (optional: an architect, an existing customer, an advert…).
create or replace function cac.submit_frp_requirement(p_values jsonb, p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['field','sales','commercial']);
  v_old cac.frp_requirement;
  v_name text := btrim(coalesce(p_values->>'customer_name', ''));
  v_phone text := btrim(coalesce(p_values->>'phone', ''));
  v_email text := lower(btrim(coalesce(p_values->>'email', '')));
  v_location text := btrim(coalesce(p_values->>'location', ''));
  v_address text := btrim(coalesce(p_values->>'address', ''));
  v_referred text := btrim(coalesce(p_values->>'referred_by', ''));
  v_visit date;
  v_details jsonb;
  v_req jsonb;
  v_quote jsonb;
begin
  if coalesce(nullif(p_values->>'type', ''), 'frp_pool') <> 'frp_pool' then perform cac.fail('Choose the requirement type.'); end if;
  if char_length(v_name) not between 2 and 120 then perform cac.fail('Enter the customer name (2–120 characters).'); end if;
  if v_phone !~ '^\+?[0-9][0-9 ()-]{6,22}$' or char_length(regexp_replace(v_phone, '\D', '', 'g')) not between 10 and 13 then
    perform cac.fail('Enter the customer phone number (10 digits, or with the country code).');
  end if;
  if v_email <> '' and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then perform cac.fail('Enter a valid email address, or leave it blank.'); end if;
  if char_length(v_location) not between 2 and 80 then perform cac.fail('Enter the site location (town or city).'); end if;
  if char_length(v_address) > 500 then perform cac.fail('Keep the site address under 500 characters.'); end if;
  if char_length(v_referred) > 120 then perform cac.fail('Keep "Referred by" under 120 characters.'); end if;
  if not cac.blank(p_values, 'visit_date') then
    if (p_values->>'visit_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then perform cac.fail('Enter a valid visit date.'); end if;
    begin v_visit := (p_values->>'visit_date')::date; exception when others then perform cac.fail('Enter a valid visit date.'); end;
  end if;
  v_details := cac.frp_details(p_values->'details');
  if p_id is not null then
    select * into v_old from cac.frp_requirement where id = p_id for update;
    if not found then perform cac.fail('Requirement not found.', 'P0404'); end if;
    if v_actor.role = 'field' and v_old.created_by <> v_actor.user_id then perform cac.fail('You can only change your own requirements.', '42501'); end if;
  end if;
  v_req := cac.put('frp_requirement', jsonb_build_object(
      'id', p_id, 'name', v_name || ' · ' || v_location, 'number', coalesce(v_old.number, cac.next_no('REQ')), 'type', 'frp_pool',
      'customer_name', v_name, 'phone', v_phone, 'email', nullif(v_email, ''), 'location', v_location, 'address', nullif(v_address, ''),
      'referred_by', nullif(v_referred, ''), 'visit_date', v_visit, 'details', v_details, 'status', 'submitted', 'return_note', null)
    || case when p_id is null then jsonb_build_object('created_by', v_actor.user_id) else '{}'::jsonb end);
  perform cac.log(v_actor.user_id, case when p_id is null then 'frp.requirement_submitted' else 'frp.requirement_changed' end, v_req->>'id',
    jsonb_build_object('number', v_req->>'number'));
  v_quote := cac.frp_generate((v_req->>'id')::uuid, v_actor.user_id);
  return jsonb_build_object('requirement', cac.get('frp_requirement', (v_req->>'id')::uuid), 'quote', v_quote);
end $$;

-- Admin or commercial: change prices on a quotation and regenerate it as a new version.
-- p_rates is {price-list code: rate}: package items or optional upgrades. A blank or null
-- rate (or the list rate itself) goes back to the price list. Codes left out keep their
-- current office price. The new version waits for approval, which sends it to the site user.
create or replace function cac.regenerate_frp_quote(p_quote uuid, p_rates jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['commercial']);
  v_q cac.frp_quote;
  v_req cac.frp_requirement;
  v_rates jsonb;
  v_key text; v_val jsonb; v_text text;
  v_row cac.frp_price;
  v_new jsonb;
begin
  select * into v_q from cac.frp_quote where id = p_quote for update;
  if not found then perform cac.fail('Quotation not found.', 'P0404'); end if;
  if v_q.status not in ('draft','approved') then perform cac.fail('Open the latest version of this quotation to change its prices.'); end if;
  if p_rates is null or jsonb_typeof(p_rates) <> 'object' then perform cac.fail('Send the changed prices as price-list items with rates.'); end if;
  select * into v_req from cac.frp_requirement where id = v_q.requirement_id for update;
  v_rates := v_req.price_overrides;
  for v_key, v_val in select key, value from jsonb_each(p_rates) loop
    select * into v_row from cac.frp_price where code = v_key;
    if not found then perform cac.fail('Unknown price-list item.'); end if;
    v_text := btrim(coalesce(v_val #>> '{}', ''));
    if v_text = '' then
      v_rates := v_rates - v_key;
    elsif v_text !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then
      perform cac.fail(format('The rate for %s must be a number in rupees.', v_row.name));
    elsif v_text::numeric = v_row.rate then
      v_rates := v_rates - v_key;
    else
      v_rates := v_rates || jsonb_build_object(v_key, v_text::numeric);
    end if;
  end loop;
  if v_rates = v_req.price_overrides then perform cac.fail('No price changed. Change a rate, then regenerate.'); end if;
  update cac.frp_requirement set price_overrides = v_rates where id = v_req.id;
  v_new := cac.frp_generate(v_req.id, v_actor.user_id);
  perform cac.log(v_actor.user_id, 'frp.prices_edited', v_new->>'id', jsonb_build_object('reference', v_new->>'reference', 'replaces', v_q.reference,
    'office_prices', v_rates, 'total', v_new->'total', 'previous_total', v_q.total));
  return v_new;
end $$;

-- Admin or commercial: approve the proposal and send it to the site user (with an optional
-- remark), or send the requirement back with a note of what needs to change.
create or replace function cac.review_frp_quote(p_quote uuid, p_decision text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['commercial']);
  v_q cac.frp_quote;
  v_cfg cac.frp_config;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_note text := btrim(coalesce(p_note, ''));
  v_block text;
  v_result jsonb;
begin
  select * into v_q from cac.frp_quote where id = p_quote for update;
  if not found then perform cac.fail('Quotation not found.', 'P0404'); end if;
  if v_q.status <> 'draft' then perform cac.fail('Only a quotation waiting for approval can be approved or sent back.'); end if;
  if char_length(v_note) > 1000 then perform cac.fail('Keep the remark under 1,000 characters.'); end if;
  if p_decision = 'approved' then
    select * into v_cfg from cac.frp_config where id = 1;
    if v_cfg.prices_confirmed_at is null then perform cac.fail('Confirm the FRP price list in Settings before approving quotations.'); end if;
    if v_q.created_at < v_cfg.prices_confirmed_at then
      perform cac.fail('The FRP price list changed after this quotation was prepared. Re-run the agent to reprice it, then approve.');
    end if;
    select i->>'text' into v_block from jsonb_array_elements(v_q.issues) i where i->>'level' = 'block' limit 1;
    if v_block is not null then perform cac.fail(v_block || ' Add it in Settings, then re-run the agent.'); end if;
    v_result := cac.put('frp_quote', jsonb_build_object('id', p_quote, 'status', 'approved', 'approved_by', v_actor.user_id, 'approved_at', now(),
      'quote_date', v_today, 'valid_till', v_today + (v_q.proposal#>>'{terms,validity_days}')::int, 'remark', nullif(v_note, '')));
    update cac.frp_requirement set status = 'approved', return_note = null where id = v_q.requirement_id;
  elsif p_decision = 'returned' then
    if char_length(v_note) < 3 then perform cac.fail('Write what needs to change.'); end if;
    v_result := cac.put('frp_quote', jsonb_build_object('id', p_quote, 'status', 'returned'));
    update cac.frp_requirement set status = 'returned', return_note = v_note where id = v_q.requirement_id;
  else
    perform cac.fail('Choose approve or send back.');
  end if;
  perform cac.log(v_actor.user_id, 'frp.quote_' || p_decision, p_quote::text, jsonb_build_object('reference', v_q.reference, 'note', nullif(v_note, '')));
  return v_result;
end $$;

-- ── Workspace snapshot ─────────────────────────────────────────────────────
-- As in 0013; field staff do not get the office prices on their requirements.
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
        'frp_requirement', (select coalesce(jsonb_agg(to_jsonb(t) - 'price_overrides' order by t.created_at desc), '[]') from cac.frp_requirement t where t.created_by = v_actor.user_id),
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

-- ── Grants ─────────────────────────────────────────────────────────────────
-- Replaced functions keep their grants; the two new ones start closed.
revoke all on function cac.frp_build(jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function cac.regenerate_frp_quote(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function cac.regenerate_frp_quote(uuid, jsonb) to authenticated;
