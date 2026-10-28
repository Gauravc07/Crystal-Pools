-- ============================================================================
-- CAC drawings vault, warehouse and inventory, purchasing.
--
-- Drawings vault
--   * drawings (numbered DRG/<FY>/0001) attached to an opportunity, site or
--     project, with a discipline and revisions R0, R1, ...
--   * files live in the private Storage bucket "cac-drawings" (PDF, DWG, DXF,
--     PNG, JPEG, WebP; 50 MB); staff open them through 10-minute signed links
--   * revision workflow draft -> for approval -> approved (or rejected); approving
--     supersedes the previous approved revision; the uploader cannot approve their
--     own revision; approved and superseded revisions are locked
--
-- Warehouse and inventory (moving weighted average cost)
--   * item master (SKU, unit, category, HSN, GST, reorder level and quantity,
--     batch tracking for tile shade lots) and warehouses with bins
--   * an append-only stock ledger: receipts, issues to projects, returns,
--     transfers and approved adjustments; stock can never go negative
--   * vendors and purchase orders (PO/<FY>/0001): Store or Project raises,
--     Commercial approves, and the approver is never the person who raised it;
--     goods receipts (GRN) against approved POs, over-receipt blocked
--   * material requests from projects, issued by the Store
--   * stock adjustments and write-offs post only after Commercial approval
--   * new role "store"
-- Nothing existing changes behaviour; every table is new.
-- ============================================================================

-- ── Store role ─────────────────────────────────────────────────────────────

alter table cac.staff drop constraint staff_role_check;
alter table cac.staff add constraint staff_role_check check (role in ('admin','sales','engineer','commercial','project','store','viewer'));

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
  if p_role not in ('admin','sales','engineer','commercial','project','store','viewer') then perform cac.fail('Invalid role.'); end if;
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
  if p_role not in ('admin','sales','engineer','commercial','project','store','viewer') then perform cac.fail('Invalid role.'); end if;
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

-- ── Document numbers by Indian financial year (April–March) ───────────────

create table cac.doc_counter (prefix text not null, fy text not null, n int not null default 0, primary key (prefix, fy));

create or replace function cac.next_no(p_prefix text)
returns text language plpgsql as $$
declare
  v_d date := (now() at time zone 'Asia/Kolkata')::date;
  v_y int := extract(year from v_d)::int - case when extract(month from v_d) < 4 then 1 else 0 end;
  v_fy text := lpad((v_y % 100)::text, 2, '0') || '-' || lpad(((v_y + 1) % 100)::text, 2, '0');
  v_n int;
begin
  insert into cac.doc_counter (prefix, fy, n) values (p_prefix, v_fy, 1)
    on conflict (prefix, fy) do update set n = cac.doc_counter.n + 1 returning n into v_n;
  return p_prefix || '/' || v_fy || '/' || lpad(v_n::text, 4, '0');
end $$;

-- Strict numeric parsing for JSON input.
create or replace function cac.num(p jsonb, p_key text)
returns numeric language plpgsql immutable as $$
begin
  if p is null or cac.blank(p, p_key) then return null; end if;
  if (p->>p_key) !~ '^-?[0-9]+(\.[0-9]+)?$' or abs((p->>p_key)::numeric) > 1e10 then
    raise exception using message = format('%s must be a number.', initcap(replace(p_key, '_', ' '))), errcode = 'P0001';
  end if;
  return (p->>p_key)::numeric;
end $$;

-- ── Tables ─────────────────────────────────────────────────────────────────

create table cac.drawing (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  number text not null unique,
  discipline text not null check (discipline in ('Architectural','Structural (RCC)','Filtration & plumbing','Electrical','Tiling & finishes','FRP','Landscape','Shop drawing','As-built','Other')),
  opportunity_id uuid references cac.opportunity(id),
  site_id uuid references cac.site(id),
  project_id uuid references cac.project(id),
  notes text,
  latest_revision int,
  approved_revision int,
  status text not null default 'draft' check (status in ('draft','for_approval','approved','rejected','superseded')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1,
  check (opportunity_id is not null or site_id is not null or project_id is not null)
);

create table cac.drawing_revision (
  id uuid primary key default gen_random_uuid(),
  name text not null,                         -- original file name
  drawing_id uuid not null references cac.drawing(id),
  revision int not null check (revision >= 0),
  path text not null unique,                  -- object in the private "cac-drawings" bucket
  mime text not null,
  size bigint not null check (size between 1 and 52428800),
  change_note text,
  submitted_at timestamptz,
  reviewed_by uuid, reviewed_at timestamptz, review_note text,
  status text not null default 'draft' check (status in ('draft','for_approval','approved','rejected','superseded')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1,
  unique (drawing_id, revision)
);

create table cac.inv_item (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9._/-]{0,39}$'),
  category text not null check (category in ('Tiles','Mosaic & murals','Pool chemicals','Filtration & pumps','Lighting','Fittings & plumbing','FRP','Waterproofing','Electrical','Tools & consumables','Other')),
  uom text not null check (uom in ('nos','box','sqm','sqft','kg','ltr','m','set','bag','roll','pair')),
  hsn text check (hsn is null or hsn ~ '^[0-9]{4,8}$'),
  gst_rate numeric(5,2) not null default 18 check (gst_rate in (0, 0.25, 3, 5, 12, 18, 28)),
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  reorder_qty numeric(14,3) not null default 0 check (reorder_qty >= 0),
  batch_tracked boolean not null default false,
  description text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.warehouse (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
  type text not null default 'Warehouse' check (type in ('Warehouse','Site store','Factory','Showroom')),
  address text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

-- On hand by item, warehouse, bin and batch, with its value (moving weighted average cost).
create table cac.stock_level (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references cac.inv_item(id),
  warehouse_id uuid not null references cac.warehouse(id),
  bin text not null default '',
  batch text not null default '',
  qty numeric(14,3) not null default 0 check (qty >= 0),
  value numeric(16,2) not null default 0 check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, warehouse_id, bin, batch)
);

create table cac.vendor (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  contact text, phone text, email text, address text,
  payment_terms text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.purchase_order (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                  -- PO number
  vendor_id uuid not null references cac.vendor(id),
  warehouse_id uuid not null references cac.warehouse(id),
  project_id uuid references cac.project(id),
  expected_date date,
  lines jsonb not null,                       -- [{item_id, sku, item, uom, qty, rate, gst_rate, amount, tax, received}]
  subtotal numeric(16,2) not null, tax numeric(16,2) not null, total numeric(16,2) not null,
  notes text,
  submitted_at timestamptz,
  approved_by uuid, approved_at timestamptz, review_note text, cancel_reason text,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','partially_received','received','rejected','cancelled')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.goods_receipt (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                  -- GRN number
  po_id uuid not null references cac.purchase_order(id),
  warehouse_id uuid not null references cac.warehouse(id),
  received_on date not null,
  delivery_note text,                         -- supplier challan / invoice reference
  lines jsonb not null,                       -- [{item_id, item, qty, rate, batch, bin, value}]
  value numeric(16,2) not null,
  status text not null default 'posted',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.material_request (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                  -- MR number
  project_id uuid references cac.project(id),
  opportunity_id uuid references cac.opportunity(id),
  warehouse_id uuid not null references cac.warehouse(id),
  needed_by date,
  lines jsonb not null,                       -- [{item_id, item, uom, qty, issued}]
  notes text, cancel_reason text,
  status text not null default 'requested' check (status in ('requested','partially_issued','issued','cancelled')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1,
  check (project_id is not null or opportunity_id is not null)
);

create table cac.stock_adjustment (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                  -- ADJ number
  item_id uuid not null references cac.inv_item(id),
  warehouse_id uuid not null references cac.warehouse(id),
  bin text not null default '', batch text not null default '',
  qty_change numeric(14,3) not null check (qty_change <> 0),
  unit_cost numeric(14,4) check (unit_cost is null or unit_cost >= 0),
  reason text not null check (reason in ('Opening stock','Physical count','Damaged','Expired','Lost','Found','Other')),
  note text,
  reviewed_by uuid, reviewed_at timestamptz, review_note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

-- Append-only stock ledger.
create table cac.stock_move (
  id uuid primary key default gen_random_uuid(),
  name text not null,                         -- document number (GRN, ISS, TRF, RET, ADJ)
  type text not null check (type in ('receipt','issue','return','transfer_out','transfer_in','adjustment_in','adjustment_out')),
  item_id uuid not null references cac.inv_item(id),
  warehouse_id uuid not null references cac.warehouse(id),
  bin text not null default '', batch text not null default '',
  qty numeric(14,3) not null check (qty > 0),
  unit_cost numeric(14,4) not null,
  value numeric(16,2) not null,
  balance_qty numeric(14,3) not null,         -- on hand at this location after the move
  po_id uuid references cac.purchase_order(id),
  grn_id uuid references cac.goods_receipt(id),
  request_id uuid references cac.material_request(id),
  adjustment_id uuid references cac.stock_adjustment(id),
  project_id uuid references cac.project(id),
  opportunity_id uuid references cac.opportunity(id),
  note text,
  status text not null default 'posted',
  created_by uuid, created_at timestamptz not null default now()
);
create index on cac.stock_move (item_id, created_at desc);
create index on cac.stock_move (project_id) where project_id is not null;
create index on cac.drawing_revision (drawing_id);
create index on cac.purchase_order (status);

create or replace function cac.stock_move_immutable()
returns trigger language plpgsql as $$
begin
  raise exception using message = 'Stock ledger entries cannot be changed or deleted. Post a correcting adjustment instead.', errcode = 'P0001';
end $$;
create trigger stock_move_immutable before update or delete on cac.stock_move for each row execute function cac.stock_move_immutable();

do $$
declare t text;
begin
  foreach t in array array['drawing','drawing_revision','inv_item','warehouse','vendor','purchase_order','goods_receipt','material_request','stock_adjustment'] loop
    execute format('create trigger touch before insert or update on cac.%I for each row execute function cac.touch()', t);
  end loop;
  foreach t in array array['drawing','drawing_revision','inv_item','warehouse','stock_level','vendor','purchase_order','goods_receipt','material_request','stock_adjustment','stock_move','doc_counter'] loop
    execute format('alter table cac.%I enable row level security', t);
    execute format('revoke all on cac.%I from anon, authenticated', t);
    execute format('grant select on cac.%I to authenticated', t);
    execute format('grant all on cac.%I to service_role', t);
    execute format('create policy "staff read" on cac.%I for select to authenticated using (cac.is_staff())', t);
  end loop;
end $$;

insert into cac.warehouse (name, code, type) values ('Main warehouse', 'WH-01', 'Warehouse');

-- ── Drawings vault ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cac-drawings', 'cac-drawings', false, 52428800, array['application/pdf','image/vnd.dwg','image/vnd.dxf','image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Object names are "<drawing id>/<random>.<ext>". Revisions cannot be replaced or deleted.
create or replace function cac.can_upload_drawing(p_name text)
returns boolean language plpgsql stable security definer set search_path = cac, public as $$
begin
  if p_name !~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,80}\.(pdf|dwg|dxf|png|jpe?g|webp)$' then return false; end if;
  return exists (select 1 from cac.staff where user_id = auth.uid() and active and role in ('admin','engineer','project','sales'))
     and exists (select 1 from cac.drawing where id = split_part(p_name, '/', 1)::uuid)
     and (select count(*) from cac.drawing_revision where drawing_id = split_part(p_name, '/', 1)::uuid) < 100;
end $$;

create policy "cac: staff read drawings" on storage.objects for select to authenticated
  using (bucket_id = 'cac-drawings' and cac.is_staff());
create policy "cac: staff upload drawings" on storage.objects for insert to authenticated
  with check (bucket_id = 'cac-drawings' and cac.can_upload_drawing(name));

create or replace function cac.create_drawing(p_values jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['engineer','project','sales']);
  v_result jsonb;
begin
  if cac.blank(p_values, 'name') or char_length(p_values->>'name') > 200 then perform cac.fail('Give the drawing a title (up to 200 characters).'); end if;
  if coalesce(p_values->>'discipline', '') not in ('Architectural','Structural (RCC)','Filtration & plumbing','Electrical','Tiling & finishes','FRP','Landscape','Shop drawing','As-built','Other') then
    perform cac.fail('Choose the drawing discipline.');
  end if;
  if cac.blank(p_values, 'opportunity_id') and cac.blank(p_values, 'site_id') and cac.blank(p_values, 'project_id') then
    perform cac.fail('Attach the drawing to an opportunity, site or project.');
  end if;
  if not cac.blank(p_values, 'opportunity_id') then perform cac.related('opportunity', (p_values->>'opportunity_id')::uuid); end if;
  if not cac.blank(p_values, 'site_id') then perform cac.related('site', (p_values->>'site_id')::uuid); end if;
  if not cac.blank(p_values, 'project_id') then perform cac.related('project', (p_values->>'project_id')::uuid); end if;
  v_result := cac.put('drawing', jsonb_build_object('name', btrim(p_values->>'name'), 'number', cac.next_no('DRG'), 'discipline', p_values->>'discipline',
    'opportunity_id', nullif(p_values->>'opportunity_id', ''), 'site_id', nullif(p_values->>'site_id', ''), 'project_id', nullif(p_values->>'project_id', ''),
    'notes', left(nullif(btrim(p_values->>'notes'), ''), 4000), 'status', 'draft', 'created_by', v_actor.user_id));
  perform cac.log(v_actor.user_id, 'drawing.created', v_result->>'id', jsonb_build_object('number', v_result->>'number'));
  return v_result;
end $$;

-- Records an uploaded file as the drawing's next revision (R0, R1, ...). Type and size come from Storage.
create or replace function cac.add_drawing_revision(p_drawing uuid, p_path text, p_name text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['engineer','project','sales']);
  v_drawing cac.drawing;
  v_meta jsonb;
  v_rev int;
  v_result jsonb;
begin
  select * into v_drawing from cac.drawing where id = p_drawing for update;
  if not found then perform cac.fail('Drawing not found.', 'P0404'); end if;
  if split_part(coalesce(p_path, ''), '/', 1) <> p_drawing::text then perform cac.fail('File path does not belong to this drawing.'); end if;
  if char_length(coalesce(p_name, '')) not between 1 and 200 then perform cac.fail('File name must be 1–200 characters.'); end if;
  if exists (select 1 from cac.drawing_revision where drawing_id = p_drawing and status in ('draft','for_approval')) then
    perform cac.fail('Finish the open revision first: submit it for approval, or have it reviewed.');
  end if;
  select metadata into v_meta from storage.objects where bucket_id = 'cac-drawings' and name = p_path;
  if v_meta is null then perform cac.fail('Upload the file before registering it.'); end if;
  v_rev := coalesce((select max(revision) + 1 from cac.drawing_revision where drawing_id = p_drawing), 0);
  begin
    v_result := cac.put('drawing_revision', jsonb_build_object('name', p_name, 'drawing_id', p_drawing, 'revision', v_rev, 'path', p_path,
      'mime', v_meta->>'mimetype', 'size', (v_meta->>'size')::bigint, 'change_note', left(nullif(btrim(p_note), ''), 2000), 'status', 'draft', 'created_by', v_actor.user_id));
  exception when check_violation then
    perform cac.fail('Use a PDF, DWG, DXF, PNG, JPEG or WebP file up to 50 MB.');
  end;
  perform cac.put('drawing', jsonb_build_object('id', p_drawing, 'latest_revision', v_rev, 'status', 'draft'));
  perform cac.log(v_actor.user_id, 'drawing.revision_added', p_drawing::text, jsonb_build_object('revision', v_rev));
  return v_result;
end $$;

create or replace function cac.submit_drawing_revision(p_revision uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['engineer','project','sales']);
  v_rev cac.drawing_revision;
  v_result jsonb;
begin
  select * into v_rev from cac.drawing_revision where id = p_revision for update;
  if not found then perform cac.fail('Revision not found.', 'P0404'); end if;
  if v_rev.status <> 'draft' then perform cac.fail('Only a draft revision can be submitted.'); end if;
  v_result := cac.put('drawing_revision', jsonb_build_object('id', p_revision, 'status', 'for_approval', 'submitted_at', now()));
  perform cac.put('drawing', jsonb_build_object('id', v_rev.drawing_id, 'status', 'for_approval'));
  perform cac.log(v_actor.user_id, 'drawing.submitted', v_rev.drawing_id::text, jsonb_build_object('revision', v_rev.revision));
  return v_result;
end $$;

-- Engineers check and approve (admins may too); nobody approves a revision they uploaded.
create or replace function cac.review_drawing_revision(p_revision uuid, p_decision text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['engineer']);
  v_rev cac.drawing_revision;
  v_result jsonb;
begin
  select * into v_rev from cac.drawing_revision where id = p_revision for update;
  if not found then perform cac.fail('Revision not found.', 'P0404'); end if;
  if v_rev.status <> 'for_approval' then perform cac.fail('This revision is not waiting for approval.'); end if;
  if p_decision not in ('approved','rejected') then perform cac.fail('Approve or reject the revision.'); end if;
  if v_rev.created_by = v_actor.user_id then perform cac.fail('A drawing must be checked by someone other than the person who uploaded it.', '42501'); end if;
  if p_decision = 'rejected' and char_length(btrim(coalesce(p_note, ''))) < 3 then perform cac.fail('Say what needs to change.'); end if;
  if p_decision = 'approved' then
    update cac.drawing_revision set status = 'superseded' where drawing_id = v_rev.drawing_id and status = 'approved';
  end if;
  v_result := cac.put('drawing_revision', jsonb_build_object('id', p_revision, 'status', p_decision, 'reviewed_by', v_actor.user_id, 'reviewed_at', now(), 'review_note', nullif(btrim(p_note), '')));
  perform cac.put('drawing', jsonb_build_object('id', v_rev.drawing_id, 'status', p_decision)
    || case when p_decision = 'approved' then jsonb_build_object('approved_revision', v_rev.revision) else '{}' end);
  perform cac.log(v_actor.user_id, 'drawing.' || p_decision, v_rev.drawing_id::text, jsonb_build_object('revision', v_rev.revision));
  return v_result;
end $$;

-- ── Inventory masters ──────────────────────────────────────────────────────

create or replace function cac.save_inv_item(p_values jsonb, p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['store','commercial']);
  v_clean jsonb; v_result jsonb;
begin
  if p_values is null or jsonb_typeof(p_values) <> 'object' then perform cac.fail('Send the item fields as an object.'); end if;
  if p_id is not null then perform cac.related('inv_item', p_id, true); end if;
  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'name', nullif(btrim(p_values->>'name'), ''), 'sku', nullif(upper(btrim(p_values->>'sku')), ''),
    'category', nullif(p_values->>'category', ''), 'uom', nullif(p_values->>'uom', ''), 'hsn', nullif(btrim(p_values->>'hsn'), ''),
    'gst_rate', cac.num(p_values, 'gst_rate'), 'reorder_level', cac.num(p_values, 'reorder_level'), 'reorder_qty', cac.num(p_values, 'reorder_qty'),
    'batch_tracked', case when jsonb_typeof(p_values->'batch_tracked') = 'boolean' then p_values->'batch_tracked' end,
    'description', nullif(btrim(p_values->>'description'), ''),
    'status', case when p_values->>'status' in ('active','inactive') then p_values->>'status' end));
  if p_id is null then perform cac.require_fields(v_clean, array['name','sku','category','uom']); end if;
  if p_id is not null and v_clean ? 'sku' and exists (select 1 from cac.stock_move m where m.item_id = p_id) and v_clean->>'sku' <> (select sku from cac.inv_item where id = p_id) then
    perform cac.fail('The SKU cannot change once stock has moved. Create a new item instead.');
  end if;
  if exists (select 1 from cac.inv_item where sku = v_clean->>'sku' and id is distinct from p_id) then perform cac.fail('An item with this SKU already exists.', '23505'); end if;
  begin
    v_result := cac.put('inv_item', v_clean || case when p_id is null then jsonb_build_object('created_by', v_actor.user_id) else jsonb_build_object('id', p_id) end);
  exception when check_violation then
    perform cac.fail('Check the SKU (capital letters, digits, . _ / -), unit, category, HSN (4–8 digits) and GST rate (0, 0.25, 3, 5, 12, 18 or 28).');
  end;
  perform cac.log(v_actor.user_id, case when p_id is null then 'inventory.item_created' else 'inventory.item_updated' end, v_result->>'id', jsonb_build_object('sku', v_result->>'sku'));
  return v_result;
end $$;

create or replace function cac.save_warehouse(p_values jsonb, p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['store']);
  v_clean jsonb; v_result jsonb;
begin
  if p_id is not null then perform cac.related('warehouse', p_id, true); end if;
  v_clean := jsonb_strip_nulls(jsonb_build_object('name', nullif(btrim(p_values->>'name'), ''), 'code', nullif(upper(btrim(p_values->>'code')), ''),
    'type', nullif(p_values->>'type', ''), 'address', nullif(btrim(p_values->>'address'), ''),
    'status', case when p_values->>'status' in ('active','inactive') then p_values->>'status' end));
  if p_id is null then perform cac.require_fields(v_clean, array['name','code']); end if;
  if v_clean->>'status' = 'inactive' and exists (select 1 from cac.stock_level where warehouse_id = p_id and qty > 0) then
    perform cac.fail('Move or adjust the stock in this warehouse before making it inactive.');
  end if;
  if exists (select 1 from cac.warehouse where code = v_clean->>'code' and id is distinct from p_id) then perform cac.fail('A warehouse with this code already exists.', '23505'); end if;
  begin
    v_result := cac.put('warehouse', v_clean || case when p_id is null then jsonb_build_object('created_by', v_actor.user_id) else jsonb_build_object('id', p_id) end);
  exception when check_violation then
    perform cac.fail('Use a short code of capital letters, digits and dashes (for example WH-02), and a valid type.');
  end;
  perform cac.log(v_actor.user_id, 'inventory.warehouse_saved', v_result->>'id');
  return v_result;
end $$;

create or replace function cac.save_vendor(p_values jsonb, p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['store','commercial']);
  v_clean jsonb; v_result jsonb;
begin
  if p_id is not null then perform cac.related('vendor', p_id, true); end if;
  v_clean := jsonb_strip_nulls(jsonb_build_object('name', nullif(btrim(p_values->>'name'), ''), 'gstin', nullif(upper(btrim(p_values->>'gstin')), ''),
    'contact', nullif(btrim(p_values->>'contact'), ''), 'phone', nullif(btrim(p_values->>'phone'), ''), 'email', nullif(lower(btrim(p_values->>'email')), ''),
    'address', nullif(btrim(p_values->>'address'), ''), 'payment_terms', nullif(btrim(p_values->>'payment_terms'), ''),
    'status', case when p_values->>'status' in ('active','inactive') then p_values->>'status' end));
  if p_id is null then perform cac.require_fields(v_clean, array['name']); end if;
  if v_clean ? 'email' and v_clean->>'email' !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then perform cac.fail('Enter a valid email address.'); end if;
  if v_clean ? 'gstin' and exists (select 1 from cac.vendor where gstin = v_clean->>'gstin' and id is distinct from p_id) then perform cac.fail('A vendor with this GSTIN already exists.', '23505'); end if;
  begin
    v_result := cac.put('vendor', v_clean || case when p_id is null then jsonb_build_object('created_by', v_actor.user_id) else jsonb_build_object('id', p_id) end);
  exception when check_violation then
    perform cac.fail('The GSTIN must be 15 characters (2 digits, then letters and digits).');
  end;
  perform cac.log(v_actor.user_id, 'inventory.vendor_saved', v_result->>'id');
  return v_result;
end $$;

-- ── Stock ledger (moving weighted average) ─────────────────────────────────
-- Inbound moves add quantity and value (at the given unit cost, or the current
-- average when none is given). Outbound moves take value at the current average,
-- so the remaining stock keeps its average cost. Stock never goes negative.

create or replace function cac.post_move(p_actor uuid, p_no text, p_type text, p_item uuid, p_warehouse uuid, p_bin text, p_batch text, p_qty numeric, p_unit_cost numeric, p_refs jsonb default '{}')
returns jsonb language plpgsql as $$
declare
  v_item cac.inv_item;
  v_wh cac.warehouse;
  v_level cac.stock_level;
  v_in boolean := p_type in ('receipt','return','transfer_in','adjustment_in');
  v_bin text := upper(btrim(coalesce(p_bin, '')));
  v_batch text := upper(btrim(coalesce(p_batch, '')));
  v_cost numeric; v_value numeric;
  v_move cac.stock_move;
begin
  select * into v_item from cac.inv_item where id = p_item;
  if not found then perform cac.fail('Choose a valid item.'); end if;
  select * into v_wh from cac.warehouse where id = p_warehouse;
  if not found then perform cac.fail('Choose a valid warehouse.'); end if;
  if v_in and (v_item.status <> 'active' or v_wh.status <> 'active') then perform cac.fail('Inactive items and warehouses cannot receive stock.'); end if;
  if p_qty is null or p_qty <= 0 then perform cac.fail('Quantity must be greater than zero.'); end if;
  if p_qty <> round(p_qty, 3) then perform cac.fail('Use at most 3 decimal places for quantities.'); end if;
  if p_unit_cost is not null and p_unit_cost < 0 then perform cac.fail('Unit cost cannot be negative.'); end if;
  if v_item.batch_tracked and v_batch = '' then perform cac.fail(format('%s is tracked by batch (shade lot): enter the batch.', v_item.name)); end if;
  insert into cac.stock_level (item_id, warehouse_id, bin, batch) values (p_item, p_warehouse, v_bin, v_batch) on conflict do nothing;
  select * into v_level from cac.stock_level where item_id = p_item and warehouse_id = p_warehouse and bin = v_bin and batch = v_batch for update;
  if v_in then
    v_cost := coalesce(p_unit_cost, case when v_level.qty > 0 then v_level.value / v_level.qty end, 0);
    v_value := round(p_qty * v_cost, 2);
    update cac.stock_level set qty = qty + p_qty, value = value + v_value, updated_at = now() where id = v_level.id returning * into v_level;
  else
    if v_level.qty < p_qty then
      perform cac.fail(format('Only %s %s of %s in stock at %s%s%s.', trim(trailing '.' from trim(trailing '0' from v_level.qty::text)), v_item.uom, v_item.name, v_wh.code,
        case when v_bin <> '' then ' bin ' || v_bin else '' end, case when v_batch <> '' then ' batch ' || v_batch else '' end));
    end if;
    v_cost := case when v_level.qty > 0 then v_level.value / v_level.qty else 0 end;
    v_value := case when v_level.qty = p_qty then v_level.value else round(p_qty * v_cost, 2) end;
    update cac.stock_level set qty = qty - p_qty, value = value - v_value, updated_at = now() where id = v_level.id returning * into v_level;
  end if;
  insert into cac.stock_move (name, type, item_id, warehouse_id, bin, batch, qty, unit_cost, value, balance_qty, po_id, grn_id, request_id, adjustment_id, project_id, opportunity_id, note, created_by)
  values (p_no, p_type, p_item, p_warehouse, v_bin, v_batch, p_qty, round(v_cost, 4), v_value, v_level.qty,
    nullif(p_refs->>'po_id', '')::uuid, nullif(p_refs->>'grn_id', '')::uuid, nullif(p_refs->>'request_id', '')::uuid, nullif(p_refs->>'adjustment_id', '')::uuid,
    nullif(p_refs->>'project_id', '')::uuid, nullif(p_refs->>'opportunity_id', '')::uuid, left(nullif(btrim(p_refs->>'note'), ''), 1000), p_actor)
  returning * into v_move;
  return to_jsonb(v_move);
end $$;

-- ── Purchase orders and goods receipts ─────────────────────────────────────

-- Validates PO lines against the item master and prices them (GST from each item).
create or replace function cac.po_lines(p_lines jsonb)
returns jsonb language plpgsql as $$
declare
  l jsonb; v_item cac.inv_item; v_qty numeric; v_rate numeric; v_out jsonb := '[]'; v_seen uuid[] := '{}';
begin
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then perform cac.fail('Add at least one item line.'); end if;
  if jsonb_array_length(p_lines) > 100 then perform cac.fail('A purchase order supports up to 100 lines.'); end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    select * into v_item from cac.inv_item where id = nullif(l->>'item_id', '')::uuid and status = 'active';
    if not found then perform cac.fail('Each line needs an active item.'); end if;
    if v_item.id = any(v_seen) then perform cac.fail(format('%s appears twice. Combine it into one line.', v_item.name)); end if;
    v_seen := v_seen || v_item.id;
    v_qty := cac.num(l, 'qty'); v_rate := cac.num(l, 'rate');
    if v_qty is null or v_qty <= 0 then perform cac.fail(format('Enter a quantity for %s.', v_item.name)); end if;
    if v_rate is null or v_rate < 0 then perform cac.fail(format('Enter a rate for %s.', v_item.name)); end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('item_id', v_item.id, 'sku', v_item.sku, 'item', v_item.name, 'uom', v_item.uom,
      'qty', v_qty, 'rate', v_rate, 'gst_rate', v_item.gst_rate, 'amount', round(v_qty * v_rate, 2), 'tax', round(v_qty * v_rate * v_item.gst_rate / 100, 2), 'received', 0));
  end loop;
  return v_out;
end $$;

-- Store or Project raise purchase orders (draft; editable until submitted).
create or replace function cac.save_purchase_order(p_values jsonb, p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['store','project']);
  v_old cac.purchase_order;
  v_lines jsonb; v_result jsonb;
begin
  if p_id is not null then
    select * into v_old from cac.purchase_order where id = p_id for update;
    if not found then perform cac.fail('Purchase order not found.', 'P0404'); end if;
    if v_old.status not in ('draft','rejected') then perform cac.fail('Only a draft or rejected purchase order can be changed.'); end if;
  end if;
  if not exists (select 1 from cac.vendor where id = nullif(p_values->>'vendor_id', '')::uuid and status = 'active') then perform cac.fail('Choose an active vendor.'); end if;
  if not exists (select 1 from cac.warehouse where id = nullif(p_values->>'warehouse_id', '')::uuid and status = 'active') then perform cac.fail('Choose the warehouse to deliver to.'); end if;
  if not cac.blank(p_values, 'project_id') then perform cac.related('project', (p_values->>'project_id')::uuid); end if;
  if not cac.blank(p_values, 'expected_date') then
    begin perform (p_values->>'expected_date')::date; exception when others then perform cac.fail('Invalid expected date.'); end;
  end if;
  v_lines := cac.po_lines(p_values->'lines');
  v_result := cac.put('purchase_order', jsonb_build_object(
      'vendor_id', p_values->>'vendor_id', 'warehouse_id', p_values->>'warehouse_id', 'project_id', nullif(p_values->>'project_id', ''),
      'expected_date', nullif(p_values->>'expected_date', ''), 'notes', left(nullif(btrim(p_values->>'notes'), ''), 4000), 'lines', v_lines,
      'subtotal', (select sum((x->>'amount')::numeric) from jsonb_array_elements(v_lines) x),
      'tax', (select sum((x->>'tax')::numeric) from jsonb_array_elements(v_lines) x),
      'total', (select sum((x->>'amount')::numeric + (x->>'tax')::numeric) from jsonb_array_elements(v_lines) x),
      'status', 'draft', 'review_note', null)
    || case when p_id is null then jsonb_build_object('name', cac.next_no('PO'), 'created_by', v_actor.user_id) else jsonb_build_object('id', p_id) end);
  perform cac.log(v_actor.user_id, case when p_id is null then 'purchase.po_created' else 'purchase.po_updated' end, v_result->>'id', jsonb_build_object('number', v_result->>'name', 'total', v_result->>'total'));
  return v_result;
end $$;

create or replace function cac.submit_purchase_order(p_po uuid)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), array['store','project']); v_po cac.purchase_order; v_result jsonb;
begin
  select * into v_po from cac.purchase_order where id = p_po for update;
  if not found then perform cac.fail('Purchase order not found.', 'P0404'); end if;
  if v_po.status not in ('draft','rejected') then perform cac.fail('Only a draft purchase order can be submitted.'); end if;
  v_result := cac.put('purchase_order', jsonb_build_object('id', p_po, 'status', 'pending_approval', 'submitted_at', now()));
  perform cac.log(v_actor.user_id, 'purchase.po_submitted', p_po::text);
  return v_result;
end $$;

-- Commercial (Finance) approves against the budget. Control rule: the person who
-- raised the order (and chose the vendor) never approves it.
create or replace function cac.review_purchase_order(p_po uuid, p_decision text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), array['commercial']); v_po cac.purchase_order; v_result jsonb;
begin
  select * into v_po from cac.purchase_order where id = p_po for update;
  if not found then perform cac.fail('Purchase order not found.', 'P0404'); end if;
  if v_po.status <> 'pending_approval' then perform cac.fail('This purchase order is not waiting for approval.'); end if;
  if p_decision not in ('approved','rejected') then perform cac.fail('Approve or reject the purchase order.'); end if;
  if v_po.created_by = v_actor.user_id then perform cac.fail('Control rule: whoever raises a purchase order (and chooses the vendor) cannot approve it.', '42501'); end if;
  if p_decision = 'rejected' and char_length(btrim(coalesce(p_note, ''))) < 3 then perform cac.fail('Give a reason for rejecting.'); end if;
  v_result := cac.put('purchase_order', jsonb_build_object('id', p_po, 'status', p_decision, 'approved_by', case when p_decision = 'approved' then v_actor.user_id end,
    'approved_at', case when p_decision = 'approved' then now() end, 'review_note', nullif(btrim(p_note), '')));
  perform cac.log(v_actor.user_id, 'purchase.po_' || p_decision, p_po::text, jsonb_build_object('total', v_po.total));
  return v_result;
end $$;

create or replace function cac.cancel_purchase_order(p_po uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), array['store','project','commercial']); v_po cac.purchase_order; v_result jsonb;
begin
  select * into v_po from cac.purchase_order where id = p_po for update;
  if not found then perform cac.fail('Purchase order not found.', 'P0404'); end if;
  if v_po.status in ('partially_received','received','cancelled') then perform cac.fail('A purchase order with received goods, or already cancelled, cannot be cancelled.'); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then perform cac.fail('Give a reason for cancelling.'); end if;
  v_result := cac.put('purchase_order', jsonb_build_object('id', p_po, 'status', 'cancelled', 'cancel_reason', btrim(p_reason)));
  perform cac.log(v_actor.user_id, 'purchase.po_cancelled', p_po::text, jsonb_build_object('reason', btrim(p_reason)));
  return v_result;
end $$;

-- Store receives goods against an approved PO. Each line: {item_id, qty, batch, bin}.
-- Stock is valued at the PO rate (GST is recoverable input tax, not stock cost).
create or replace function cac.receive_goods(p_po uuid, p_lines jsonb, p_delivery_note text default '', p_received_on date default null)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['store']);
  v_po cac.purchase_order;
  v_no text := cac.next_no('GRN');
  v_grn jsonb; l jsonb; v_line jsonb; v_qty numeric; v_lines jsonb; v_out jsonb := '[]'; v_value numeric := 0; i int; v_found boolean;
begin
  select * into v_po from cac.purchase_order where id = p_po for update;
  if not found then perform cac.fail('Purchase order not found.', 'P0404'); end if;
  if v_po.status not in ('approved','partially_received') then perform cac.fail('Goods can be received only against an approved purchase order.'); end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then perform cac.fail('Enter the quantities received.'); end if;
  if coalesce(p_received_on, current_date) > current_date then perform cac.fail('The receipt date cannot be in the future.'); end if;
  v_lines := v_po.lines;
  v_grn := cac.put('goods_receipt', jsonb_build_object('name', v_no, 'po_id', p_po, 'warehouse_id', v_po.warehouse_id, 'received_on', coalesce(p_received_on, current_date),
    'delivery_note', left(nullif(btrim(p_delivery_note), ''), 200), 'lines', '[]', 'value', 0, 'created_by', v_actor.user_id));
  for l in select * from jsonb_array_elements(p_lines) loop
    v_qty := cac.num(l, 'qty');
    if v_qty is null or v_qty = 0 then continue; end if;
    v_found := false;
    for i in 0 .. jsonb_array_length(v_lines) - 1 loop
      v_line := v_lines->i;
      if v_line->>'item_id' = l->>'item_id' then
        v_found := true;
        if v_qty < 0 or v_qty > (v_line->>'qty')::numeric - (v_line->>'received')::numeric then
          perform cac.fail(format('%s: you can receive up to %s %s more on this order.', v_line->>'item', (v_line->>'qty')::numeric - (v_line->>'received')::numeric, v_line->>'uom'));
        end if;
        perform cac.post_move(v_actor.user_id, v_no, 'receipt', (v_line->>'item_id')::uuid, v_po.warehouse_id, l->>'bin', l->>'batch', v_qty, (v_line->>'rate')::numeric,
          jsonb_build_object('po_id', p_po, 'grn_id', v_grn->>'id', 'project_id', v_po.project_id));
        v_lines := jsonb_set(v_lines, array[i::text, 'received'], to_jsonb((v_line->>'received')::numeric + v_qty));
        v_out := v_out || jsonb_build_array(jsonb_build_object('item_id', v_line->>'item_id', 'item', v_line->>'item', 'uom', v_line->>'uom', 'qty', v_qty,
          'rate', (v_line->>'rate')::numeric, 'batch', upper(btrim(coalesce(l->>'batch', ''))), 'bin', upper(btrim(coalesce(l->>'bin', ''))), 'value', round(v_qty * (v_line->>'rate')::numeric, 2)));
        v_value := v_value + round(v_qty * (v_line->>'rate')::numeric, 2);
      end if;
    end loop;
    if not v_found then perform cac.fail('A received item is not on this purchase order.'); end if;
  end loop;
  if jsonb_array_length(v_out) = 0 then perform cac.fail('Enter the quantities received.'); end if;
  perform cac.put('goods_receipt', jsonb_build_object('id', v_grn->>'id', 'lines', v_out, 'value', v_value));
  perform cac.put('purchase_order', jsonb_build_object('id', p_po, 'lines', v_lines,
    'status', case when exists (select 1 from jsonb_array_elements(v_lines) x where (x->>'received')::numeric < (x->>'qty')::numeric) then 'partially_received' else 'received' end));
  perform cac.log(v_actor.user_id, 'inventory.goods_received', v_grn->>'id', jsonb_build_object('number', v_no, 'po', v_po.name, 'value', v_value));
  return cac.get('goods_receipt', (v_grn->>'id')::uuid);
end $$;

-- ── Material requests, issues, returns, transfers ──────────────────────────

create or replace function cac.create_material_request(p_values jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['project','engineer','store']);
  l jsonb; v_item cac.inv_item; v_qty numeric; v_lines jsonb := '[]'; v_result jsonb;
begin
  if cac.blank(p_values, 'project_id') and cac.blank(p_values, 'opportunity_id') then perform cac.fail('Choose the project (or opportunity) the material is for.'); end if;
  if not cac.blank(p_values, 'project_id') then perform cac.related('project', (p_values->>'project_id')::uuid); end if;
  if not cac.blank(p_values, 'opportunity_id') then perform cac.related('opportunity', (p_values->>'opportunity_id')::uuid); end if;
  if not exists (select 1 from cac.warehouse where id = nullif(p_values->>'warehouse_id', '')::uuid and status = 'active') then perform cac.fail('Choose the warehouse to issue from.'); end if;
  if jsonb_typeof(p_values->'lines') is distinct from 'array' or jsonb_array_length(p_values->'lines') = 0 then perform cac.fail('Add at least one item line.'); end if;
  for l in select * from jsonb_array_elements(p_values->'lines') loop
    select * into v_item from cac.inv_item where id = nullif(l->>'item_id', '')::uuid and status = 'active';
    if not found then perform cac.fail('Each line needs an active item.'); end if;
    v_qty := cac.num(l, 'qty');
    if v_qty is null or v_qty <= 0 then perform cac.fail(format('Enter a quantity for %s.', v_item.name)); end if;
    if exists (select 1 from jsonb_array_elements(v_lines) x where x->>'item_id' = v_item.id::text) then perform cac.fail(format('%s appears twice. Combine it into one line.', v_item.name)); end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('item_id', v_item.id, 'item', v_item.name, 'uom', v_item.uom, 'qty', v_qty, 'issued', 0));
  end loop;
  if not cac.blank(p_values, 'needed_by') then begin perform (p_values->>'needed_by')::date; exception when others then perform cac.fail('Invalid needed-by date.'); end; end if;
  v_result := cac.put('material_request', jsonb_build_object('name', cac.next_no('MR'), 'project_id', nullif(p_values->>'project_id', ''), 'opportunity_id', nullif(p_values->>'opportunity_id', ''),
    'warehouse_id', p_values->>'warehouse_id', 'needed_by', nullif(p_values->>'needed_by', ''), 'lines', v_lines, 'notes', left(nullif(btrim(p_values->>'notes'), ''), 2000),
    'status', 'requested', 'created_by', v_actor.user_id));
  perform cac.log(v_actor.user_id, 'inventory.material_requested', v_result->>'id', jsonb_build_object('number', v_result->>'name'));
  return v_result;
end $$;

create or replace function cac.cancel_material_request(p_request uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), array['project','engineer','store']); v_mr cac.material_request; v_result jsonb;
begin
  select * into v_mr from cac.material_request where id = p_request for update;
  if not found then perform cac.fail('Material request not found.', 'P0404'); end if;
  if v_mr.status in ('issued','cancelled') then perform cac.fail('This request is already closed.'); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then perform cac.fail('Give a reason for cancelling.'); end if;
  v_result := cac.put('material_request', jsonb_build_object('id', p_request, 'status', 'cancelled', 'cancel_reason', btrim(p_reason)));
  perform cac.log(v_actor.user_id, 'inventory.material_request_cancelled', p_request::text);
  return v_result;
end $$;

-- Store issues material to a project (optionally against a material request).
-- p_values: {item_id, warehouse_id, bin, batch, qty, project_id | opportunity_id | request_id, note}
create or replace function cac.issue_stock(p_values jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['store']);
  v_mr cac.material_request; v_qty numeric := cac.num(p_values, 'qty'); v_lines jsonb; v_line jsonb; i int; v_hit int; v_move jsonb;
  v_project uuid := nullif(p_values->>'project_id', '')::uuid; v_opp uuid := nullif(p_values->>'opportunity_id', '')::uuid; v_wh uuid := nullif(p_values->>'warehouse_id', '')::uuid;
begin
  if not cac.blank(p_values, 'request_id') then
    select * into v_mr from cac.material_request where id = (p_values->>'request_id')::uuid for update;
    if not found then perform cac.fail('Material request not found.', 'P0404'); end if;
    if v_mr.status not in ('requested','partially_issued') then perform cac.fail('This material request is closed.'); end if;
    v_project := coalesce(v_project, v_mr.project_id); v_opp := coalesce(v_opp, v_mr.opportunity_id); v_wh := coalesce(v_wh, v_mr.warehouse_id);
    v_lines := v_mr.lines;
    for i in 0 .. jsonb_array_length(v_lines) - 1 loop
      if v_lines->i->>'item_id' = p_values->>'item_id' then v_hit := i; end if;
    end loop;
    if v_hit is null then perform cac.fail('This item is not on the material request.'); end if;
    v_line := v_lines->v_hit;
    if v_qty > (v_line->>'qty')::numeric - (v_line->>'issued')::numeric then
      perform cac.fail(format('%s: only %s %s remain on this request.', v_line->>'item', (v_line->>'qty')::numeric - (v_line->>'issued')::numeric, v_line->>'uom'));
    end if;
  end if;
  if v_project is null and v_opp is null then perform cac.fail('Choose the project (or opportunity) the material goes to.'); end if;
  if v_project is not null then perform cac.related('project', v_project); end if;
  if v_opp is not null then perform cac.related('opportunity', v_opp); end if;
  v_move := cac.post_move(v_actor.user_id, cac.next_no('ISS'), 'issue', nullif(p_values->>'item_id', '')::uuid, v_wh, p_values->>'bin', p_values->>'batch', v_qty, null,
    jsonb_build_object('project_id', v_project, 'opportunity_id', v_opp, 'request_id', v_mr.id, 'note', p_values->>'note'));
  if v_mr.id is not null then
    v_lines := jsonb_set(v_lines, array[v_hit::text, 'issued'], to_jsonb((v_line->>'issued')::numeric + v_qty));
    perform cac.put('material_request', jsonb_build_object('id', v_mr.id, 'lines', v_lines,
      'status', case when exists (select 1 from jsonb_array_elements(v_lines) x where (x->>'issued')::numeric < (x->>'qty')::numeric) then 'partially_issued' else 'issued' end));
  end if;
  perform cac.log(v_actor.user_id, 'inventory.stock_issued', v_move->>'id', jsonb_build_object('number', v_move->>'name', 'qty', v_qty));
  return v_move;
end $$;

-- Unused material back from a project, valued at the location's current average (or the given cost).
create or replace function cac.return_stock(p_values jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['store']);
  v_project uuid := nullif(p_values->>'project_id', '')::uuid; v_opp uuid := nullif(p_values->>'opportunity_id', '')::uuid;
  v_issued numeric; v_returned numeric; v_cost numeric; v_move jsonb;
begin
  if v_project is null and v_opp is null then perform cac.fail('Choose the project (or opportunity) the material is coming back from.'); end if;
  select coalesce(sum(qty) filter (where type = 'issue'), 0), coalesce(sum(qty) filter (where type = 'return'), 0),
         sum(value) filter (where type = 'issue') / nullif(sum(qty) filter (where type = 'issue'), 0)
    into v_issued, v_returned, v_cost
    from cac.stock_move where item_id = nullif(p_values->>'item_id', '')::uuid
     and (project_id is not distinct from v_project) and (opportunity_id is not distinct from v_opp);
  if cac.num(p_values, 'qty') > v_issued - v_returned then
    perform cac.fail(format('Only %s of this item were issued to this project and not yet returned.', v_issued - v_returned));
  end if;
  v_move := cac.post_move(v_actor.user_id, cac.next_no('RET'), 'return', nullif(p_values->>'item_id', '')::uuid, nullif(p_values->>'warehouse_id', '')::uuid,
    p_values->>'bin', p_values->>'batch', cac.num(p_values, 'qty'), v_cost, jsonb_build_object('project_id', v_project, 'opportunity_id', v_opp, 'note', p_values->>'note'));
  perform cac.log(v_actor.user_id, 'inventory.stock_returned', v_move->>'id');
  return v_move;
end $$;

-- Moves stock between warehouses or bins at its current average cost (same batch).
-- p_values: {item_id, from_warehouse_id, from_bin, to_warehouse_id, to_bin, batch, qty, note}
create or replace function cac.transfer_stock(p_values jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['store']);
  v_no text := cac.next_no('TRF'); v_out jsonb; v_in jsonb;
begin
  if p_values->>'from_warehouse_id' = p_values->>'to_warehouse_id' and upper(btrim(coalesce(p_values->>'from_bin', ''))) = upper(btrim(coalesce(p_values->>'to_bin', ''))) then
    perform cac.fail('Choose a different warehouse or bin to transfer to.');
  end if;
  v_out := cac.post_move(v_actor.user_id, v_no, 'transfer_out', nullif(p_values->>'item_id', '')::uuid, nullif(p_values->>'from_warehouse_id', '')::uuid,
    p_values->>'from_bin', p_values->>'batch', cac.num(p_values, 'qty'), null, jsonb_build_object('note', p_values->>'note'));
  v_in := cac.post_move(v_actor.user_id, v_no, 'transfer_in', nullif(p_values->>'item_id', '')::uuid, nullif(p_values->>'to_warehouse_id', '')::uuid,
    p_values->>'to_bin', p_values->>'batch', cac.num(p_values, 'qty'), (v_out->>'value')::numeric / (v_out->>'qty')::numeric, jsonb_build_object('note', p_values->>'note'));
  perform cac.log(v_actor.user_id, 'inventory.stock_transferred', v_no, jsonb_build_object('qty', v_out->>'qty'));
  return jsonb_build_object('out', v_out, 'in', v_in);
end $$;

-- ── Stock adjustments (posted only after Commercial approval) ──────────────

create or replace function cac.request_adjustment(p_values jsonb)
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.require_role(auth.uid(), array['store']);
  v_change numeric := cac.num(p_values, 'qty_change'); v_cost numeric := cac.num(p_values, 'unit_cost');
  v_item cac.inv_item; v_level cac.stock_level; v_result jsonb;
begin
  select * into v_item from cac.inv_item where id = nullif(p_values->>'item_id', '')::uuid;
  if not found then perform cac.fail('Choose a valid item.'); end if;
  if not exists (select 1 from cac.warehouse where id = nullif(p_values->>'warehouse_id', '')::uuid) then perform cac.fail('Choose a valid warehouse.'); end if;
  if v_change is null or v_change = 0 then perform cac.fail('Enter the quantity to add (positive) or remove (negative).'); end if;
  if coalesce(p_values->>'reason', '') not in ('Opening stock','Physical count','Damaged','Expired','Lost','Found','Other') then perform cac.fail('Choose the reason for the adjustment.'); end if;
  if p_values->>'reason' in ('Other','Physical count') and char_length(btrim(coalesce(p_values->>'note', ''))) < 3 then perform cac.fail('Add a note explaining the adjustment.'); end if;
  if v_item.batch_tracked and btrim(coalesce(p_values->>'batch', '')) = '' then perform cac.fail(format('%s is tracked by batch (shade lot): enter the batch.', v_item.name)); end if;
  select * into v_level from cac.stock_level where item_id = v_item.id and warehouse_id = (p_values->>'warehouse_id')::uuid
    and bin = upper(btrim(coalesce(p_values->>'bin', ''))) and batch = upper(btrim(coalesce(p_values->>'batch', '')));
  if v_change > 0 and v_cost is null and coalesce(v_level.qty, 0) = 0 then perform cac.fail('Enter the unit cost for stock being added where none is held.'); end if;
  if v_change < 0 and -v_change > coalesce(v_level.qty, 0) then perform cac.fail(format('Only %s %s are in stock at this location.', coalesce(v_level.qty, 0), v_item.uom)); end if;
  v_result := cac.put('stock_adjustment', jsonb_build_object('name', cac.next_no('ADJ'), 'item_id', v_item.id, 'warehouse_id', p_values->>'warehouse_id',
    'bin', upper(btrim(coalesce(p_values->>'bin', ''))), 'batch', upper(btrim(coalesce(p_values->>'batch', ''))), 'qty_change', v_change, 'unit_cost', v_cost,
    'reason', p_values->>'reason', 'note', left(nullif(btrim(p_values->>'note'), ''), 1000), 'status', 'pending', 'created_by', v_actor.user_id));
  perform cac.log(v_actor.user_id, 'inventory.adjustment_requested', v_result->>'id', jsonb_build_object('qty_change', v_change));
  return v_result;
end $$;

create or replace function cac.review_adjustment(p_adjustment uuid, p_decision text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = cac, public as $$
declare v_actor cac.staff := cac.require_role(auth.uid(), array['commercial']); v_adj cac.stock_adjustment; v_result jsonb;
begin
  select * into v_adj from cac.stock_adjustment where id = p_adjustment for update;
  if not found then perform cac.fail('Adjustment not found.', 'P0404'); end if;
  if v_adj.status <> 'pending' then perform cac.fail('This adjustment has already been reviewed.'); end if;
  if p_decision not in ('approved','rejected') then perform cac.fail('Approve or reject the adjustment.'); end if;
  if v_adj.created_by = v_actor.user_id then perform cac.fail('Control rule: the person who requested a stock adjustment cannot approve it.', '42501'); end if;
  if p_decision = 'rejected' and char_length(btrim(coalesce(p_note, ''))) < 3 then perform cac.fail('Give a reason for rejecting.'); end if;
  if p_decision = 'approved' then
    perform cac.post_move(v_actor.user_id, v_adj.name, case when v_adj.qty_change > 0 then 'adjustment_in' else 'adjustment_out' end, v_adj.item_id, v_adj.warehouse_id,
      v_adj.bin, v_adj.batch, abs(v_adj.qty_change), case when v_adj.qty_change > 0 then v_adj.unit_cost end,
      jsonb_build_object('adjustment_id', v_adj.id, 'note', v_adj.reason || coalesce(': ' || v_adj.note, '')));
  end if;
  v_result := cac.put('stock_adjustment', jsonb_build_object('id', p_adjustment, 'status', p_decision, 'reviewed_by', v_actor.user_id, 'reviewed_at', now(), 'review_note', nullif(btrim(p_note), '')));
  perform cac.log(v_actor.user_id, 'inventory.adjustment_' || p_decision, p_adjustment::text);
  return v_result;
end $$;

-- ── Sections, workspace snapshot and backup ────────────────────────────────

create or replace function cac.sections()
returns text[] language sql immutable as $$
  select array['mywork','prospect','inbox','leads','pipeline','outreach','appointment','approval','agents','customers','survey','project','drawings','inventory','maintenance','lifecycle','reviews','task','reports','library'];
$$;

create or replace function cac.workspace_state()
returns jsonb language plpgsql stable security definer set search_path = cac, public as $$
declare
  v_actor cac.staff := cac.actor(auth.uid());
  v_records jsonb := '{}';
  k text;
  v jsonb;
begin
  foreach k in array array['customer','contact','site','prospect','opportunity','activity','task','survey','rate','portfolio','campaign','project','change','payment','maintenance','quote','draft','approval','revision','attachment','appointment','service_visit','review_request','knowledge','briefing','project_lead','lead_import','comment',
                           'drawing','drawing_revision','inv_item','warehouse','stock_level','vendor','purchase_order','goods_receipt','material_request','stock_adjustment','stock_move'] loop
    -- Report cell text stays in the database; the ledger loads its latest 1,000 entries.
    execute format('select coalesce(jsonb_agg(r order by r->>''created_at'' desc), ''[]'') from (select to_jsonb(t) - ''sheets'' r from cac.%I t order by t.created_at desc %s) s',
      k, case when k = 'stock_move' then 'limit 1000' else '' end) into v;
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
    'project_lead','lead_import','comment','mail_message',
    'drawing','drawing_revision','inv_item','warehouse','stock_level','vendor','purchase_order','goods_receipt','material_request','stock_adjustment','stock_move','doc_counter'] loop
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
    and p.proname in ('next_no','num','stock_move_immutable','can_upload_drawing','create_drawing','add_drawing_revision','submit_drawing_revision','review_drawing_revision',
      'save_inv_item','save_warehouse','save_vendor','post_move','po_lines','save_purchase_order','submit_purchase_order','review_purchase_order','cancel_purchase_order',
      'receive_goods','create_material_request','cancel_material_request','issue_stock','return_stock','transfer_stock','request_adjustment','review_adjustment','sections') loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn.sig);
  end loop;
end $$;

-- The upload policy calls this as the signed-in user.
grant execute on function cac.can_upload_drawing(text) to authenticated;
grant execute on function
  cac.create_drawing(jsonb), cac.add_drawing_revision(uuid, text, text, text), cac.submit_drawing_revision(uuid), cac.review_drawing_revision(uuid, text, text),
  cac.save_inv_item(jsonb, uuid), cac.save_warehouse(jsonb, uuid), cac.save_vendor(jsonb, uuid),
  cac.save_purchase_order(jsonb, uuid), cac.submit_purchase_order(uuid), cac.review_purchase_order(uuid, text, text), cac.cancel_purchase_order(uuid, text),
  cac.receive_goods(uuid, jsonb, text, date), cac.create_material_request(jsonb), cac.cancel_material_request(uuid, text),
  cac.issue_stock(jsonb), cac.return_stock(jsonb), cac.transfer_stock(jsonb), cac.request_adjustment(jsonb), cac.review_adjustment(uuid, text, text)
to authenticated;
