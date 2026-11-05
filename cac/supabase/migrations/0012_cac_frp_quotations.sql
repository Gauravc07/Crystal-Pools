-- ============================================================================
-- CAC requirement forms and the FRP quotation agent.
--
--   * new role "field": staff who visit customers. They fill requirement forms
--     and see only their own requirements and the approved quotations made from
--     them. Every other CAC table and file is closed to them.
--   * requirement forms (REQ/<FY>/0001). The first type is "FRP pool": customer,
--     pool size, tile print, equipment choices (or "let the agent choose"),
--     optional upgrades the customer asked about, and notes.
--   * the FRP quotation agent runs inside the database the moment a requirement
--     is submitted: it calculates the fiberglass surface, water volume and
--     filtration flow, chooses the equipment the employee left to it, prices
--     everything from the FRP price list and drafts the proposal
--     (FRP/<initials>/<yy>/<Mon>/<nn>). No worker, no AI model, no credits.
--   * admin or commercial approve the proposal, give a special price, re-run the
--     agent after a price change, or send the requirement back with a note.
--     Approval needs a confirmed price list; approving re-dates the proposal.
-- Nothing existing changes behaviour except that field staff are excluded from
-- direct table reads (cac.is_staff) and get a trimmed workspace snapshot.
-- ============================================================================

-- ── Field role ─────────────────────────────────────────────────────────────

alter table cac.staff drop constraint staff_role_check;
alter table cac.staff add constraint staff_role_check check (role in ('admin','sales','engineer','commercial','project','store','field','viewer'));

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
  if p_role not in ('admin','sales','engineer','commercial','project','store','field','viewer') then perform cac.fail('Invalid role.'); end if;
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
  if p_role not in ('admin','sales','engineer','commercial','project','store','field','viewer') then perform cac.fail('Invalid role.'); end if;
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

-- Row-level read access (every CAC table, survey photos, drawings) is for office
-- staff. Field staff read their own requirements through cac.workspace_state().
create or replace function cac.is_staff()
returns boolean language sql stable security definer set search_path = cac as $$
  select exists (select 1 from cac.staff where user_id = auth.uid() and active and role <> 'field');
$$;

-- ── Tables ─────────────────────────────────────────────────────────────────

-- The FRP price list. Package items are always priced; an upgrade without a
-- rate shows "Price on request" on the proposal.
create table cac.frp_price (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  sort int not null,
  grp text not null check (grp in ('package','upgrade')),
  name text not null,           -- price-list name; the customer-facing title for upgrades
  unit text not null,
  rate numeric(12,2) check (rate is null or rate >= 0),
  description text,             -- customer-facing text for upgrades
  note text,                    -- where the default rate came from
  updated_by uuid, updated_at timestamptz not null default now()
);

-- Proposal terms, company details and the agent's engineering constants.
create table cac.frp_config (
  id int primary key default 1 check (id = 1),
  terms jsonb not null,
  prices_confirmed_at timestamptz,
  prices_confirmed_by uuid,
  updated_at timestamptz not null default now()
);

create table cac.frp_requirement (
  id uuid primary key default gen_random_uuid(),
  name text not null,                         -- "<customer> · <location>"
  number text not null unique,                -- REQ/<FY>/0001
  type text not null default 'frp_pool' check (type in ('frp_pool')),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  phone text not null,
  email text,
  location text not null,
  address text,
  visit_date date,
  details jsonb not null,                     -- cleaned by cac.frp_details(); null equipment = agent decides
  status text not null default 'submitted' check (status in ('submitted','returned','approved')),
  return_note text,
  quote_id uuid,                              -- latest proposal
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.frp_quote (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reference text not null unique,             -- FRP/<initials>/<yy>/<Mon>/<nn>, revisions add -R1, -R2
  requirement_id uuid not null references cac.frp_requirement(id),
  version int not null,
  quote_date date not null,
  valid_till date not null,
  proposal jsonb not null,                    -- snapshot of everything the document shows
  lines jsonb not null,                       -- internal price build-up
  issues jsonb not null default '[]',         -- [{level: block|warn, text}]
  subtotal numeric(14,2) not null,
  total numeric(14,2) not null,               -- package price before GST
  payments jsonb not null,                    -- [{percent, amount}]
  special_price numeric(14,2),
  special_reason text,
  status text not null default 'draft' check (status in ('draft','approved','returned','superseded')),
  approved_by uuid, approved_at timestamptz,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1,
  unique (requirement_id, version)
);
create index on cac.frp_quote (requirement_id);
create index on cac.frp_requirement (created_by);

do $$
declare t text;
begin
  foreach t in array array['frp_requirement','frp_quote'] loop
    execute format('create trigger touch before insert or update on cac.%I for each row execute function cac.touch()', t);
  end loop;
  foreach t in array array['frp_price','frp_config','frp_requirement','frp_quote'] loop
    execute format('alter table cac.%I enable row level security', t);
    execute format('revoke all on cac.%I from anon, authenticated', t);
    execute format('grant select on cac.%I to authenticated', t);
    execute format('grant all on cac.%I to service_role', t);
    execute format('create policy "staff read" on cac.%I for select to authenticated using (cac.is_staff())', t);
  end loop;
end $$;

-- ── Default price list and terms ───────────────────────────────────────────
-- Rates come from the Crystal Pools quotations to Mr Vishal Lakhani (Dec 2025)
-- and Mr Nikhil Kulkarni (Jan 2026) where those quotes priced the item; the
-- rest are estimates. The shell rate is set so that, with these rates, the
-- Mr Nilesh Shukla proposal (30 × 12 × 4.4 ft, Oct 2026) totals ₹7,28,680.
-- Proposals cannot be approved until an admin or commercial confirms the list.

insert into cac.frp_price (code, sort, grp, name, unit, rate, description, note) values
  ('shell',      1, 'package', 'FRP pool shell (multilayer glass fibre, ISO NPG gel coat, tile print)', 'sq ft', 735.86, null,
   'Calculated so the Mr Nilesh Shukla proposal totals ₹7,28,680 with the other default rates. Set your real rate.'),
  ('filter_650', 2, 'package', 'Sand filter 650Ø with multiport valve', 'no', 27500, null, 'Estimate. The 700Ø filter was ₹32,500 in the Vishal Lakhani quote.'),
  ('filter_700', 3, 'package', 'Sand filter 700Ø with multiport valve', 'no', 32500, null, 'Vishal Lakhani quote, Dec 2025.'),
  ('media',      4, 'package', 'Filter media (high-density quartz silica)', 'kg', 20, null, 'Vishal Lakhani quote, Dec 2025.'),
  ('pump_1_5',   5, 'package', 'Re-circulation pump 1.5 hp', 'no', 24500, null, 'Estimate.'),
  ('pump_2',     6, 'package', 'Re-circulation pump 2 hp', 'no', 28500, null, 'Vishal Lakhani quote, Dec 2025.'),
  ('skimmer',    7, 'package', 'Standard wall skimmer', 'no', 6500, null, 'Vishal Lakhani quote, Dec 2025.'),
  ('jet',        8, 'package', 'Turbo jet nozzle with air nozzle', 'no', 3500, null, 'Estimate, priced like the hydro-massage nozzle in the Vishal Lakhani quote.'),
  ('drain',      9, 'package', 'Drain point', 'no', 2500, null, 'Vishal Lakhani quote, Dec 2025.'),
  ('suction',   10, 'package', 'Suction point', 'no', 950, null, 'Vishal Lakhani quote, Dec 2025.'),
  ('ladder',    11, 'package', 'SS ladder, 4 steps', 'no', 16500, null, 'Vishal Lakhani quote, Dec 2025.'),
  ('light',     12, 'package', 'Underwater ABS LED light, RGB colour', 'no', 4500, null, 'The warm-white light price in the Vishal Lakhani quote. Check the RGB price.'),
  ('driver',    13, 'package', 'Rain-proof light driver', 'no', 2800, null, 'Vishal Lakhani quote, Dec 2025.'),
  ('remote',    14, 'package', 'RGB remote and controller', 'set', 3500, null, 'Estimate.'),
  ('plumbing',  15, 'package', 'Plumbing material and electric cable', 'lot', 15000, null, 'Estimate.'),
  ('kit',       16, 'package', 'Maintenance kit (brush, suction head, hose, pole, deep net, test kit)', 'set', 15500, null, 'Nikhil Kulkarni quote, Jan 2026.'),
  ('dispenser', 17, 'package', '7" chemical dispenser with chemicals', 'no', 2500, null, 'Estimate.'),
  ('install',   18, 'package', 'Installation and testing (labour)', 'job', 50000, null, 'Estimate.'),
  ('water_descent_4ft', 31, 'upgrade', '4 ft water descent', 'no', null, 'A graceful curtain of falling water with remote controller and driver.',
   'The Jaiswal quote (Mar 2026) priced it at ₹20,400 with LED light and remote. Leave blank to show "Price on request".'),
  ('water_descent_1ft', 32, 'upgrade', '1 ft water descent', 'no', null, 'A slim curtain of falling water with LED light and remote.',
   'The Jaiswal quote priced it at ₹10,800 each.'),
  ('heat_pump', 33, 'upgrade', 'Heat pump system', 'no', null, 'Warm water for longer swimming seasons and cooler evenings.', null),
  ('lion',      34, 'upgrade', 'FRP Singapore Lion fountain', 'no', null, 'A striking statement feature at the edge of your pool.', null),
  ('dolphin',   35, 'upgrade', 'Dolphin fountain', 'no', null, 'Playful and elegant. Available in 2 ft, 3 ft or 4 ft.', null),
  ('swan',      36, 'upgrade', 'Swan fountain', 'no', null, 'A graceful sculpture that brings the pool edge to life.', null),
  ('sea_horse', 37, 'upgrade', 'Sea horse fountain', 'no', null, 'A 4 ft sea horse sculpture with a gentle water feature.', null),
  ('jacuzzi',   38, 'upgrade', '4-seater jacuzzi', 'no', null,
   'Turn your pool into a spa: 6 hydro-massage swirl-jet nozzles, 2 air controllers, a 3 hp high-pressure spa pump and all jacuzzi plumbing.', null),
  ('pool_cover', 39, 'upgrade', 'Pool cover', 'sq ft', null, 'Keeps leaves and dust out, and reduces heat and water loss.',
   'Priced per sq ft of water surface. The Jaiswal quote was ₹31,350 for 261 sq ft (about ₹120 per sq ft).');

insert into cac.frp_config (id, terms) values (1, '{
  "validity_days": 15,
  "delivery_days": 28,
  "payment": [50, 40, 10],
  "warranty": {"shell": 10, "filter": 5, "pump": 1},
  "freeboard_ft": 0.4,
  "litres_per_cft": 29,
  "turnover_hours": 4,
  "round_to": 10,
  "company": {
    "name": "Crystal Swimming Pools (India) Pvt. Ltd",
    "address": "Sr. No. 10/1/1, Shed No. 3, Nr. Kailash Jeevan Factory, Dhayari, Pune 411041",
    "phone": "7507899555",
    "email": "sales@crystalpools.in",
    "website": "crystalpools.in",
    "years": "26+",
    "clients": "3,000+",
    "factory": "Shive"
  }
}'::jsonb);

-- ── The agent ──────────────────────────────────────────────────────────────

-- A number from the form, or null when blank (the agent decides).
create or replace function cac.frp_num(p jsonb, p_key text, p_label text, p_min numeric, p_max numeric, p_whole boolean default false)
returns numeric language plpgsql immutable as $$
declare v numeric;
begin
  if p is null or cac.blank(p, p_key) then return null; end if;
  if (p->>p_key) !~ (case when p_whole then '^[0-9]{1,6}$' else '^[0-9]{1,6}(\.[0-9]{1,3})?$' end) then
    perform cac.fail(format('%s must be a %s.', p_label, case when p_whole then 'whole number' else 'number' end));
  end if;
  v := (p->>p_key)::numeric;
  if v < p_min or v > p_max then perform cac.fail(format('%s must be between %s and %s.', p_label, trim_scale(p_min), trim_scale(p_max))); end if;
  return v;
end $$;

-- Validates and normalises the FRP pool part of a requirement form.
create or replace function cac.frp_details(p jsonb)
returns jsonb language plpgsql stable as $$
declare
  v_l numeric; v_w numeric; v_d numeric; v_swap numeric;
  v_colour text; v_size numeric; v_filter text; v_pump numeric; v_hose numeric;
  v_upgrades jsonb := '[]';
  v_notes text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform cac.fail('Fill in the pool details.'); end if;
  v_l := cac.frp_num(p, 'length_ft', 'Pool length (ft)', 6, 60);
  v_w := cac.frp_num(p, 'width_ft', 'Pool width (ft)', 4, 30);
  v_d := cac.frp_num(p, 'depth_ft', 'Pool depth (ft)', 2.5, 10);
  if v_l is null or v_w is null or v_d is null then perform cac.fail('Enter the pool length, width and depth in feet.'); end if;
  -- Length is the longer side.
  if v_w > v_l then v_swap := v_l; v_l := v_w; v_w := v_swap; end if;
  v_colour := coalesce(nullif(btrim(p->>'tile_colour'), ''), 'Dark blue');
  if v_colour not in ('Dark blue','Light blue','Aqua','Mixed blue mosaic') then perform cac.fail('Choose the tile print colour.'); end if;
  v_size := coalesce(cac.frp_num(p, 'tile_size_in', 'Tile size (in)', 1, 2), 2);
  if v_size not in (1, 2) then perform cac.fail('Tile size must be 1 × 1 in or 2 × 2 in.'); end if;
  v_filter := nullif(btrim(coalesce(p->>'filter', '')), '');
  if v_filter is not null and v_filter not in ('650','700') then perform cac.fail('Choose a 650Ø or 700Ø sand filter, or let the agent choose.'); end if;
  v_pump := cac.frp_num(p, 'pump_hp', 'Pump (hp)', 1.5, 2);
  if v_pump is not null and v_pump not in (1.5, 2) then perform cac.fail('Choose a 1.5 hp or 2 hp pump, or let the agent choose.'); end if;
  v_hose := cac.frp_num(p, 'hose_m', 'Suction hose (m)', 9, 15, true);
  if v_hose is not null and v_hose not in (9, 11, 15) then perform cac.fail('Choose a 9 m, 11 m or 15 m suction hose, or let the agent choose.'); end if;
  if coalesce(p->>'dispenser', 'false') not in ('true','false') then perform cac.fail('Chemical dispenser must be yes or no.'); end if;
  if p->'upgrades' is not null and jsonb_typeof(p->'upgrades') not in ('array','null') then perform cac.fail('Optional upgrades must be a list.'); end if;
  if jsonb_typeof(p->'upgrades') = 'array' then
    if exists (select 1 from jsonb_array_elements(p->'upgrades') e
               where jsonb_typeof(e) <> 'string' or e #>> '{}' not in (select code from cac.frp_price where grp = 'upgrade')) then
      perform cac.fail('Choose optional upgrades from the list.');
    end if;
    select coalesce(jsonb_agg(code order by sort), '[]') into v_upgrades from cac.frp_price
      where grp = 'upgrade' and code in (select jsonb_array_elements_text(p->'upgrades'));
  end if;
  v_notes := btrim(coalesce(p->>'notes', ''));
  if char_length(v_notes) > 2000 then perform cac.fail('Keep the notes under 2,000 characters.'); end if;
  return jsonb_build_object(
    'length_ft', v_l, 'width_ft', v_w, 'depth_ft', v_d, 'tile_colour', v_colour, 'tile_size_in', v_size,
    'filter', v_filter, 'pump_hp', v_pump,
    'media_kg', cac.frp_num(p, 'media_kg', 'Filter media (kg)', 25, 1000, true),
    'lights', cac.frp_num(p, 'lights', 'Underwater lights', 0, 20, true),
    'skimmers', cac.frp_num(p, 'skimmers', 'Skimmers', 1, 4, true),
    'jets', cac.frp_num(p, 'jets', 'Jet nozzles', 0, 10, true),
    'drains', cac.frp_num(p, 'drains', 'Drain points', 0, 4, true),
    'suction_points', cac.frp_num(p, 'suction_points', 'Suction points', 0, 4, true),
    'ladders', cac.frp_num(p, 'ladders', 'Ladders', 0, 4, true),
    'hose_m', v_hose,
    'dispenser', coalesce((p->>'dispenser')::boolean, false),
    'upgrades', v_upgrades,
    'notes', nullif(v_notes, ''));
end $$;

-- The FRP quotation agent: sizes, equipment and price from the cleaned details.
-- Rules (each only when the employee left the choice to the agent):
--   water depth = depth − freeboard; surface = L×W + 2(L+W)×depth; litres = L×W×water × litres/cu ft
--   flow = volume ÷ turnover hours; filter 650Ø up to 16 m³/h, else 700Ø (20 m³/h)
--   media 100 kg (650Ø) or 250 kg (700Ø); pump 1.5 hp up to 9 m³/h, else 2 hp
--   lights: one per 90 sq ft of water surface, at least 2, an even number
--   skimmers 1 (2 above 450 sq ft); jets 1 (2 above 50,000 L); 1 drain; 1 ladder; no suction point
--   hose 9 m up to 30 ft long, 11 m up to 40 ft, else 15 m
--   package price = sum of priced lines, rounded to the nearest round_to (₹10)
create or replace function cac.frp_build(p jsonb)
returns jsonb language plpgsql stable as $$
declare
  t jsonb := (select terms from cac.frp_config where id = 1);
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
  v_sub numeric := 0; v_amount numeric;
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
    if r.code is null or r.rate is null then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('level', 'block', 'text', format('The FRP price list has no rate for %s.', coalesce(r.name, v_line.code))));
      v_amount := 0;
    else
      v_amount := round(v_line.qty * r.rate, 2);
    end if;
    v_sub := v_sub + v_amount;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('code', v_line.code, 'name', coalesce(r.name, v_line.code), 'unit', r.unit,
      'qty', v_line.qty, 'rate', r.rate, 'amount', v_amount));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('code', f.code, 'title', f.name, 'text', f.description, 'unit', f.unit, 'rate', f.rate,
      'price', case when f.rate is null then null else round(f.rate * case when f.unit = 'sq ft' then v_surface else 1 end / v_round) * v_round end)
      order by f.sort), '[]')
    into v_upgrades from cac.frp_price f
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

-- Payment stages: every stage but the last is rounded to the rupee; the last takes the remainder.
create or replace function cac.frp_payments(p_total numeric, p_split jsonb)
returns jsonb language plpgsql immutable as $$
declare
  v jsonb := '[]';
  n int := jsonb_array_length(p_split);
  v_pct numeric; v_amount numeric; v_used numeric := 0;
begin
  for i in 0 .. n - 1 loop
    v_pct := (p_split->>i)::numeric;
    v_amount := case when i = n - 1 then p_total - v_used else round(p_total * v_pct / 100) end;
    v_used := v_used + v_amount;
    v := v || jsonb_build_array(jsonb_build_object('percent', v_pct, 'amount', v_amount));
  end loop;
  return v;
end $$;

-- FRP/<initials of the person who took the requirement>/<yy>/<Mon>/<nn>, numbered per month.
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
  return format('FRP/%s/%s/%s/%s', v_initials, to_char(v_d, 'YY'), to_char(v_d, 'Mon'), lpad(v_n::text, 2, '0'));
end $$;

-- Runs the agent for a requirement and saves the result as its next proposal version.
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
  v_build := cac.frp_build(v_req.details);
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
    'requirement', v_req.number, 'total', v_quote->'total', 'auto', v_build->'auto'));
  return v_quote;
end $$;

-- ── Staff actions ──────────────────────────────────────────────────────────

-- Field, sales and commercial staff (and admins) submit a requirement, or change
-- one (field staff only their own). Every submission runs the agent at once.
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
      'visit_date', v_visit, 'details', v_details, 'status', 'submitted', 'return_note', null)
    || case when p_id is null then jsonb_build_object('created_by', v_actor.user_id) else '{}'::jsonb end);
  perform cac.log(v_actor.user_id, case when p_id is null then 'frp.requirement_submitted' else 'frp.requirement_changed' end, v_req->>'id',
    jsonb_build_object('number', v_req->>'number'));
  v_quote := cac.frp_generate((v_req->>'id')::uuid, v_actor.user_id);
  return jsonb_build_object('requirement', cac.get('frp_requirement', (v_req->>'id')::uuid), 'quote', v_quote);
end $$;

-- What the agent would prepare, without saving anything (the form's live summary).
-- Field staff see sizes and equipment, not prices.
create or replace function cac.preview_frp(p_details jsonb)
returns jsonb language plpgsql stable security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['field','sales','commercial']);
  v_build jsonb := cac.frp_build(cac.frp_details(p_details));
begin
  if v_actor.role = 'field' then
    return (v_build - 'lines' - 'subtotal' - 'total') || jsonb_build_object('upgrades',
      (select coalesce(jsonb_agg(u - 'rate' - 'price'), '[]') from jsonb_array_elements(v_build->'upgrades') u),
      'issues', (select coalesce(jsonb_agg(i), '[]') from jsonb_array_elements(v_build->'issues') i where i->>'level' = 'warn'));
  end if;
  return v_build;
end $$;

-- Admin or commercial: approve the proposal, or send the requirement back with a note.
create or replace function cac.review_frp_quote(p_quote uuid, p_decision text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['commercial']);
  v_q cac.frp_quote;
  v_cfg cac.frp_config;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_block text;
  v_result jsonb;
begin
  select * into v_q from cac.frp_quote where id = p_quote for update;
  if not found then perform cac.fail('Quotation not found.', 'P0404'); end if;
  if v_q.status <> 'draft' then perform cac.fail('Only a quotation waiting for approval can be approved or sent back.'); end if;
  if p_decision = 'approved' then
    select * into v_cfg from cac.frp_config where id = 1;
    if v_cfg.prices_confirmed_at is null then perform cac.fail('Confirm the FRP price list in Settings before approving quotations.'); end if;
    if v_q.created_at < v_cfg.prices_confirmed_at then
      perform cac.fail('The FRP price list changed after this quotation was prepared. Re-run the agent to reprice it, then approve.');
    end if;
    select i->>'text' into v_block from jsonb_array_elements(v_q.issues) i where i->>'level' = 'block' limit 1;
    if v_block is not null then perform cac.fail(v_block || ' Add it in Settings, then re-run the agent.'); end if;
    v_result := cac.put('frp_quote', jsonb_build_object('id', p_quote, 'status', 'approved', 'approved_by', v_actor.user_id, 'approved_at', now(),
      'quote_date', v_today, 'valid_till', v_today + (v_q.proposal#>>'{terms,validity_days}')::int));
    update cac.frp_requirement set status = 'approved', return_note = null where id = v_q.requirement_id;
  elsif p_decision = 'returned' then
    if char_length(btrim(coalesce(p_note, ''))) < 3 then perform cac.fail('Write what needs to change.'); end if;
    v_result := cac.put('frp_quote', jsonb_build_object('id', p_quote, 'status', 'returned'));
    update cac.frp_requirement set status = 'returned', return_note = left(btrim(p_note), 1000) where id = v_q.requirement_id;
  else
    perform cac.fail('Choose approve or send back.');
  end if;
  perform cac.log(v_actor.user_id, 'frp.quote_' || p_decision, p_quote::text, jsonb_build_object('reference', v_q.reference, 'note', nullif(btrim(coalesce(p_note, '')), '')));
  return v_result;
end $$;

-- Admin or commercial: a negotiated package price (or null to go back to the price-list total).
create or replace function cac.set_frp_special_price(p_quote uuid, p_price numeric, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['commercial']);
  v_q cac.frp_quote;
  v_round numeric;
  v_total numeric;
  v_result jsonb;
begin
  select * into v_q from cac.frp_quote where id = p_quote for update;
  if not found then perform cac.fail('Quotation not found.', 'P0404'); end if;
  if v_q.status <> 'draft' then perform cac.fail('Only a quotation waiting for approval can be repriced.'); end if;
  v_round := coalesce((v_q.proposal#>>'{terms,round_to}')::numeric, 10);
  if p_price is null then
    v_total := round(v_q.subtotal / v_round) * v_round;
  else
    if p_price <= 0 or p_price > 1e9 then perform cac.fail('Enter a package price greater than zero.'); end if;
    if char_length(btrim(coalesce(p_reason, ''))) < 3 then perform cac.fail('Give a reason for the special price.'); end if;
    v_total := round(p_price);
  end if;
  v_result := cac.put('frp_quote', jsonb_build_object('id', p_quote, 'total', v_total,
    'special_price', case when p_price is null then null else v_total end,
    'special_reason', case when p_price is null then null else left(btrim(p_reason), 300) end,
    'payments', cac.frp_payments(v_total, v_q.proposal#>'{terms,payment}')));
  perform cac.log(v_actor.user_id, 'frp.special_price', p_quote::text, jsonb_build_object('reference', v_q.reference, 'total', v_total, 'reason', p_reason));
  return v_result;
end $$;

-- Admin or commercial: run the agent again (for example after the price list changed).
create or replace function cac.rerun_frp_agent(p_requirement uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), array['commercial']);
begin
  return cac.frp_generate(p_requirement, v_actor.user_id);
end $$;

-- Admin or commercial: change rates and terms. Saving confirms the price list.
create or replace function cac.save_frp_prices(p_prices jsonb, p_terms jsonb default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['commercial']);
  v_item jsonb;
  v_row cac.frp_price;
  v_rate numeric;
  v_terms jsonb := (select terms from cac.frp_config where id = 1);
  t jsonb := p_terms;
  c jsonb;
  v_int text := '^[0-9]{1,4}$';
begin
  if p_prices is not null and jsonb_typeof(p_prices) <> 'array' then perform cac.fail('Prices must be a list.'); end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_prices, '[]')) loop
    select * into v_row from cac.frp_price where code = v_item->>'code' for update;
    if not found then perform cac.fail('Unknown price-list item.'); end if;
    if cac.blank(v_item, 'rate') then
      if v_row.grp = 'package' then perform cac.fail(format('Enter a rate for %s.', v_row.name)); end if;
      v_rate := null;
    else
      if (v_item->>'rate') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then perform cac.fail(format('The rate for %s must be a number in rupees.', v_row.name)); end if;
      v_rate := (v_item->>'rate')::numeric;
      if v_row.grp = 'package' and v_rate <= 0 then perform cac.fail(format('The rate for %s must be more than zero.', v_row.name)); end if;
    end if;
    update cac.frp_price set rate = v_rate, updated_by = v_actor.user_id, updated_at = now() where code = v_row.code;
  end loop;

  if t is not null then
    if jsonb_typeof(t) <> 'object' then perform cac.fail('Terms must be an object.'); end if;
    if coalesce(t->>'validity_days', '') !~ v_int or (t->>'validity_days')::int not between 1 and 90 then perform cac.fail('Validity must be 1–90 days.'); end if;
    if coalesce(t->>'delivery_days', '') !~ v_int or (t->>'delivery_days')::int not between 1 and 365 then perform cac.fail('Delivery must be 1–365 working days.'); end if;
    if jsonb_typeof(t->'payment') is distinct from 'array' or jsonb_array_length(t->'payment') <> 3
       or exists (select 1 from jsonb_array_elements_text(t->'payment') x where x !~ '^[0-9]{1,3}$')
       or (select sum(x::int) from jsonb_array_elements_text(t->'payment') x) <> 100
       or (t->'payment'->>0)::int = 0 then
      perform cac.fail('The three payment stages must be whole percentages that add up to 100.');
    end if;
    if jsonb_typeof(t->'warranty') is distinct from 'object'
       or exists (select 1 from unnest(array['shell','filter','pump']) k where coalesce(t->'warranty'->>k, '') !~ '^[0-9]{1,2}$') then
      perform cac.fail('Warranty years must be whole numbers (0–99).');
    end if;
    if coalesce(t->>'freeboard_ft', '') !~ '^[0-9](\.[0-9]{1,2})?$' or (t->>'freeboard_ft')::numeric > 2 then perform cac.fail('Water level below the edge must be 0–2 ft.'); end if;
    if coalesce(t->>'litres_per_cft', '') !~ '^[0-9]{2}(\.[0-9]{1,3})?$' or (t->>'litres_per_cft')::numeric not between 20 and 40 then perform cac.fail('Litres per cubic foot must be 20–40.'); end if;
    if coalesce(t->>'turnover_hours', '') !~ '^[0-9]{1,2}(\.[0-9])?$' or (t->>'turnover_hours')::numeric not between 1 and 24 then perform cac.fail('Turnover must be 1–24 hours.'); end if;
    if coalesce(t->>'round_to', '') not in ('1','10','100','1000') then perform cac.fail('Round the package price to 1, 10, 100 or 1,000 rupees.'); end if;
    c := t->'company';
    if jsonb_typeof(c) is distinct from 'object' then perform cac.fail('Company details are missing.'); end if;
    if char_length(btrim(coalesce(c->>'name', ''))) not between 2 and 120 then perform cac.fail('Enter the company name.'); end if;
    if char_length(btrim(coalesce(c->>'address', ''))) not between 5 and 300 then perform cac.fail('Enter the company address.'); end if;
    if coalesce(c->>'phone', '') !~ '^\+?[0-9][0-9 -]{5,20}$' then perform cac.fail('Enter the company phone number.'); end if;
    if coalesce(c->>'email', '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then perform cac.fail('Enter the company email.'); end if;
    if char_length(btrim(coalesce(c->>'website', ''))) > 100 or char_length(btrim(coalesce(c->>'years', ''))) > 20
       or char_length(btrim(coalesce(c->>'clients', ''))) > 20 or char_length(btrim(coalesce(c->>'factory', ''))) > 60 then
      perform cac.fail('Keep the website, years, clients and factory short.');
    end if;
    v_terms := jsonb_build_object(
      'validity_days', (t->>'validity_days')::int, 'delivery_days', (t->>'delivery_days')::int,
      'payment', (select jsonb_agg(x::int) from jsonb_array_elements_text(t->'payment') x),
      'warranty', jsonb_build_object('shell', (t->'warranty'->>'shell')::int, 'filter', (t->'warranty'->>'filter')::int, 'pump', (t->'warranty'->>'pump')::int),
      'freeboard_ft', (t->>'freeboard_ft')::numeric, 'litres_per_cft', (t->>'litres_per_cft')::numeric,
      'turnover_hours', (t->>'turnover_hours')::numeric, 'round_to', (t->>'round_to')::int,
      'company', jsonb_build_object('name', btrim(c->>'name'), 'address', btrim(c->>'address'), 'phone', btrim(c->>'phone'),
        'email', lower(btrim(c->>'email')), 'website', btrim(coalesce(c->>'website', '')), 'years', btrim(coalesce(c->>'years', '')),
        'clients', btrim(coalesce(c->>'clients', '')), 'factory', btrim(coalesce(c->>'factory', '')))
    );
  end if;

  update cac.frp_config set terms = v_terms, prices_confirmed_at = now(), prices_confirmed_by = v_actor.user_id, updated_at = now() where id = 1;
  perform cac.log(v_actor.user_id, 'frp.prices_confirmed', 'frp_price', jsonb_build_object('items', jsonb_array_length(coalesce(p_prices, '[]')), 'terms', p_terms is not null));
  return jsonb_build_object('prices', (select jsonb_agg(to_jsonb(f) order by f.sort) from cac.frp_price f), 'config', (select to_jsonb(x) from cac.frp_config x));
end $$;

-- ── Workspace snapshot and backup ──────────────────────────────────────────

create or replace function cac.workspace_state()
returns jsonb language plpgsql stable security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.actor(auth.uid());
  v_kinds text[] := array['customer','contact','site','prospect','opportunity','activity','task','survey','rate','portfolio','campaign','project','change','payment','maintenance','quote','draft','approval','revision','attachment','appointment','service_visit','review_request','knowledge','briefing','project_lead','lead_import','comment',
                          'drawing','drawing_revision','inv_item','warehouse','stock_level','vendor','purchase_order','goods_receipt','material_request','stock_adjustment','stock_move'];
  v_records jsonb := '{}';
  k text;
  v jsonb;
begin
  -- Field staff: their own requirements and the approved proposals made from them, nothing else.
  if v_actor.role = 'field' then
    select jsonb_object_agg(x, '[]'::jsonb) into v_records from unnest(v_kinds) x;
    return jsonb_build_object(
      'user', to_jsonb(v_actor),
      'users', jsonb_build_array(to_jsonb(v_actor)),
      'records', v_records || jsonb_build_object(
        'frp_requirement', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]') from cac.frp_requirement t where t.created_by = v_actor.user_id),
        'frp_quote', (select coalesce(jsonb_agg(to_jsonb(q) - 'lines' - 'subtotal' - 'issues' order by q.created_at desc), '[]')
                      from cac.frp_quote q join cac.frp_requirement t on t.id = q.requirement_id
                      where t.created_by = v_actor.user_id and q.status = 'approved')),
      'frp', jsonb_build_object('prices', (select coalesce(jsonb_agg(to_jsonb(f) - 'rate' - 'note' - 'updated_by' order by f.sort), '[]') from cac.frp_price f), 'config', null),
      'jobs', '[]'::jsonb, 'events', '[]'::jsonb, 'agents', '[]'::jsonb, 'stages', to_jsonb(cac.stages()),
      'settings', '{}'::jsonb, 'metrics', '{}'::jsonb, 'lifecycle', '{}'::jsonb, 'usage', '{}'::jsonb,
      'config', jsonb_build_object('outbound', 'disabled', 'database', 'Supabase · cac schema', 'worker', null, 'website_leads', false, 'photo_bucket', null));
  end if;

  foreach k in array v_kinds || array['frp_requirement','frp_quote'] loop
    -- Report cell text stays in the database; the ledger loads its latest 1,000 entries.
    execute format('select coalesce(jsonb_agg(r order by r->>''created_at'' desc), ''[]'') from (select to_jsonb(t) - ''sheets'' r from cac.%I t order by t.created_at desc %s) s',
      k, case when k = 'stock_move' then 'limit 1000' else '' end) into v;
    v_records := v_records || jsonb_build_object(k, v);
  end loop;
  return jsonb_build_object(
    'user', to_jsonb(v_actor),
    'users', (select coalesce(jsonb_agg(to_jsonb(s) order by s.name), '[]') from cac.staff s),
    'records', v_records,
    'frp', jsonb_build_object('prices', (select coalesce(jsonb_agg(to_jsonb(f) order by f.sort), '[]') from cac.frp_price f), 'config', (select to_jsonb(c) from cac.frp_config c)),
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
    'project_lead','lead_import','comment','mail_message',
    'drawing','drawing_revision','inv_item','warehouse','stock_level','vendor','purchase_order','goods_receipt','material_request','stock_adjustment','stock_move','doc_counter',
    'frp_price','frp_config','frp_requirement','frp_quote'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]'') from cac.%I t', k) into v;
    v_out := v_out || jsonb_build_object(k, v);
  end loop;
  return jsonb_build_object('exported_at', now(), 'exported_by', v_actor.email, 'schema_migrations', (select jsonb_agg(name order by name) from cac.schema_migrations), 'tables', v_out,
    'note', 'Survey photos and drawing files stay in the cac-survey-photos and cac-drawings Storage buckets; attachment and drawing_revision rows list their paths. Passwords are never exported.');
end $$;

-- ── Grants ─────────────────────────────────────────────────────────────────

do $$
declare fn record;
begin
  for fn in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'cac'::regnamespace
    and p.proname in ('frp_num','frp_details','frp_build','frp_payments','frp_next_ref','frp_generate',
      'submit_frp_requirement','preview_frp','review_frp_quote','set_frp_special_price','rerun_frp_agent','save_frp_prices') loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn.sig);
  end loop;
end $$;

grant execute on function
  cac.submit_frp_requirement(jsonb, uuid), cac.preview_frp(jsonb), cac.review_frp_quote(uuid, text, text),
  cac.set_frp_special_price(uuid, numeric, text), cac.rerun_frp_agent(uuid), cac.save_frp_prices(jsonb, jsonb)
to authenticated;
