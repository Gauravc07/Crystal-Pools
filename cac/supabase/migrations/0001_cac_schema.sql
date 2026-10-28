-- ============================================================================
-- Crystal Pools CAC (customer acquisition & operations) — schema
--
-- Everything lives in the dedicated `cac` schema. Nothing here reads or changes
-- the website's tables except `cac.import_website_leads()` (0004), which only
-- READS public.leads when that table exists in the same project.
--
-- Security model:
--   * Staff are Supabase Auth users WITH an active row in cac.staff.
--     A website admin account alone grants no CAC access.
--   * Staff may SELECT every cac table (RLS). Nobody may INSERT/UPDATE/DELETE
--     directly: all writes go through security-definer functions that enforce
--     roles, stage gates and approvals inside one transaction.
--   * The workflow worker (Edge Function) uses the service role and may call
--     only the worker functions.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists cac;
-- Function EXECUTE grants are locked down explicitly at the end of 0004.

-- ── Staff ──────────────────────────────────────────────────────────────────

create table cac.staff (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null unique,
  role        text not null check (role in ('admin','sales','engineer','commercial','project','viewer')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Workflow catalogue (static reference data) ─────────────────────────────

create table cac.agent (
  id          text primary key,
  sort        int not null,
  name        text not null,
  kind        text not null,
  role        text not null,
  description text not null,
  tools       text[] not null,
  phase       text not null
);

insert into cac.agent values
  ('research',      1, 'Prospect research',       'prospect',    'sales',      'Build an evidence-backed brief and separate facts from possible opportunities.', '{read prospect,research public sources,draft research brief}', 'Launch first'),
  ('qualification', 2, 'Enquiry qualification',   'opportunity', 'sales',      'Extract requirements and prepare questions for the missing details.', '{read enquiry,extract requirements,request qualification review}', 'Launch first'),
  ('followup',      3, 'Contextual follow-up',    'opportunity', 'sales',      'Interpret a reply, pause generic reminders and route the next action.', '{read reply and quote,create review task,draft revision}', 'Launch first'),
  ('outreach',      4, 'Personalised outreach',   'prospect',    'sales',      'Draft an introduction using approved research and portfolio examples.', '{read approved research,read approved portfolio,draft message}', 'Review required'),
  ('sales',         5, 'Sales assistant',         'opportunity', 'sales',      'Prepare a meeting brief and a proposed next action.', '{read opportunity,read activity,draft brief}', 'Review required'),
  ('survey',        6, 'Site-survey assistant',   'survey',      'engineer',   'Structure site notes and flag missing measurements and observations.', '{read survey notes,list missing fields,request engineer review}', 'Review required'),
  ('proposal',      7, 'Proposal assistant',      'opportunity', 'commercial', 'Assemble a priced draft from a verified survey and approved rate cards.', '{read verified survey,read approved rates,calculate draft}', 'Review required'),
  ('project',       8, 'Project coordination',    'project',     'project',    'Summarise site updates and flag scope changes for a project manager.', '{read project updates,draft coordination task}', 'Review required'),
  ('maintenance',   9, 'Maintenance assistant',   'maintenance', 'commercial', 'Review service history and prepare a renewal recommendation.', '{read service history,draft renewal recommendation}', 'Review required');

-- ── Business records ───────────────────────────────────────────────────────
-- Every record table shares: id, name, status, created_by, created_at,
-- updated_at, record_version (bumped by trigger; approvals pin a version).

create table cac.customer (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text check (segment in ('Residential','Hotel','Resort','Developer','Architect','Club','Contractor')),
  email text, phone text, notes text,
  suppressed boolean not null default false,
  status text not null default 'draft',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.contact (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_id uuid not null references cac.customer(id),
  email text, phone text, position text,
  permission text check (permission in ('Not recorded','Inbound enquiry','Business email permitted','Opted out')),
  status text not null default 'draft',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.site (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_id uuid not null references cac.customer(id),
  location text, address text, notes text,
  status text not null default 'draft',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.prospect (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text not null check (segment in ('Hotel','Resort','Developer','Architect','Club','Contractor')),
  location text not null,
  website text not null,
  -- Duplicate key: hostname without "www."
  website_host text generated always as (lower(regexp_replace(substring(website from '^https://([^/:?#]+)'), '^www\.', ''))) stored unique,
  source_url text, evidence text, contact text, service text,
  existing_pool text not null default 'Unknown' check (existing_pool in ('Unknown','Confirmed','None found')),
  open_questions text,
  research_date date,
  research jsonb,
  suppressed boolean not null default false,
  converted_opportunity_id uuid,
  status text not null default 'draft',
  approved_by uuid, approved_at timestamptz,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.campaign (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('Commercial project introduction','Existing-pool service enquiry','Architect/contractor partnership')),
  region text, notes text,
  cost numeric(14,2), effort_hours numeric(10,2),
  status text not null default 'draft',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.opportunity (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_id uuid not null references cac.customer(id),
  site_id uuid not null references cac.site(id),
  contact_id uuid references cac.contact(id),
  prospect_id uuid references cac.prospect(id),
  lead_id uuid,  -- public.leads id when created from a website enquiry
  route text not null check (route in ('Residential','Commercial','Referral')),
  source text not null,
  owner_id uuid not null references cac.staff(user_id),
  stage text not null default 'New enquiry' check (stage in ('New enquiry','Contacted','Qualified','Site visit scheduled','Survey complete','Estimate sent','Detailed proposal','Negotiation','Won','Execution','Handover','Maintenance','Deferred','Lost')),
  location text, pool_type text, budget numeric(14,2), timeline text, decision_maker text,
  notes text, next_action text, next_action_date date,
  visit_date date, visit_confirmed boolean not null default false,
  agreement_ref text, loss_reason text,
  qualification_reviewed boolean not null default false,
  qualification jsonb,
  suppressed boolean not null default false,
  status text not null default 'draft',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

alter table cac.prospect add constraint prospect_converted_fk foreign key (converted_opportunity_id) references cac.opportunity(id);

create table cac.activity (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opportunity_id uuid not null references cac.opportunity(id),
  type text check (type in ('Human response','Customer reply','Call','Meeting','Site update','Note')),
  notes text, run_id uuid,
  status text not null default 'recorded',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.survey (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opportunity_id uuid not null references cac.opportunity(id),
  length numeric(8,2), width numeric(8,2), depth numeric(8,2),
  access text, electrical text, drainage text, photos text, notes text,
  status text not null default 'draft',
  approved_by uuid, approved_at timestamptz,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.rate (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text check (unit in ('m²','m³','m','each','lot','month')),
  price numeric(14,2), tax numeric(5,2) check (tax between 0 and 100), scope text,
  status text not null default 'draft',
  approved_by uuid, approved_at timestamptz,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.portfolio (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text check (segment in ('Residential','Hotel','Resort','Developer','Architect','Club')),
  description text, source_url text,
  status text not null default 'draft',
  approved_by uuid, approved_at timestamptz,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.quote (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opportunity_id uuid not null references cac.opportunity(id),
  site_id uuid not null references cac.site(id),
  survey_id uuid not null references cac.survey(id),
  version int not null,
  previous_id uuid references cac.quote(id),
  scope text not null, exclusions text not null, terms text not null,
  items jsonb not null,
  subtotal numeric(14,2) not null, tax numeric(14,2) not null, total numeric(14,2) not null,
  simulated_at timestamptz,
  engineering_approved_by uuid, approved_by uuid, approved_at timestamptz,
  status text not null default 'pending',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1,
  unique (opportunity_id, version)
);

create table cac.revision (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opportunity_id uuid not null references cac.opportunity(id),
  site_id uuid references cac.site(id),
  previous_quote_id uuid references cac.quote(id),
  heating_requested boolean not null default false,
  tentative_start text, requested_change text,
  missing jsonb not null default '[]',
  run_id uuid,
  status text not null default 'needs_estimation',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.project (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opportunity_id uuid not null references cac.opportunity(id),
  milestones text, site_updates text, handover_checklist text,
  completed_by uuid,
  status text not null default 'draft',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.change (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid not null references cac.project(id),
  scope text not null,
  amount numeric(14,2),
  customer_approval text,
  billing_status text not null default 'Not billed' check (billing_status in ('Not billed','Billed')),
  invoice_ref text, billed_at timestamptz, billed_by uuid,
  status text not null default 'draft',
  approved_by uuid, approved_at timestamptz,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.payment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opportunity_id uuid not null references cac.opportunity(id),
  amount numeric(14,2), reference text, received_on date,
  status text not null default 'draft',
  approved_by uuid, approved_at timestamptz,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.maintenance (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_id uuid not null references cac.customer(id),
  site_id uuid not null references cac.site(id),
  equipment text, warranty_date date, service_history text,
  next_service date, renewal_date date not null, referral text,
  status text not null default 'draft',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.task (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opportunity_id uuid references cac.opportunity(id),
  owner text not null,          -- staff name or a role queue such as "Estimator / engineer"
  due_date date not null,
  notes text,
  category text,                -- generic_followup | contextual | estimation | billing
  pause_reason text,
  revision_id uuid references cac.revision(id),
  change_id uuid references cac.change(id),
  completed_by uuid, completed_at timestamptz,
  status text not null default 'open' check (status in ('open','paused','completed')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.draft (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  agent text not null references cac.agent(id),
  target_id uuid not null,
  target_kind text not null,
  opportunity_id uuid references cac.opportunity(id),
  prospect_id uuid references cac.prospect(id),
  campaign_id uuid references cac.campaign(id),
  body text not null,
  analysis jsonb,
  run_id uuid,
  simulated_at timestamptz,
  status text not null default 'pending',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.approval (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_id uuid not null,
  target_kind text not null,
  type text not null,
  role text not null,
  payload jsonb not null default '{}',
  target_version int not null,
  note text, reviewed_by uuid, reviewed_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);
create unique index approval_one_pending on cac.approval (target_id, type) where status = 'pending';

create table cac.attachment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  survey_id uuid not null references cac.survey(id),
  path text not null unique,    -- object name in the private "cac-survey-photos" bucket
  mime text not null check (mime in ('image/png','image/jpeg','image/webp')),
  size int not null check (size between 1 and 2097152),
  status text not null default 'stored',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), record_version int not null default 1
);

create table cac.lead_link (
  lead_id uuid primary key,
  opportunity_id uuid not null references cac.opportunity(id),
  created_at timestamptz not null default now()
);

-- ── Workflow jobs, worker status, audit ────────────────────────────────────

create table cac.job (
  id uuid primary key default gen_random_uuid(),
  dedupe text not null unique,
  agent text not null references cac.agent(id),
  target_id uuid not null,
  target_kind text not null,
  input jsonb not null,
  actor uuid not null references cac.staff(user_id),
  status text not null default 'queued' check (status in ('queued','running','waiting_approval','completed','rejected','failed')),
  step text not null default 'queued',
  attempts int not null default 0,
  max_attempts int not null default 3,
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  analysis jsonb,
  approval_id uuid,
  error text,
  trace jsonb not null default '[]',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_queue on cac.job (status, available_at);

create table cac.worker_status (
  id int primary key default 1 check (id = 1),
  mode text not null,
  ai_configured boolean not null,
  last_seen timestamptz not null default now()
);

create table cac.event (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  target text not null,
  detail jsonb not null default '{}'
);

-- ── Indexes on relationships ───────────────────────────────────────────────

create index on cac.contact (customer_id);
create index on cac.site (customer_id);
create index on cac.opportunity (customer_id);
create index on cac.opportunity (stage);
create index on cac.activity (opportunity_id);
create index on cac.task (opportunity_id, status);
create index on cac.survey (opportunity_id);
create index on cac.quote (opportunity_id);
create index on cac.revision (opportunity_id);
create index on cac.project (opportunity_id);
create index on cac.change (project_id);
create index on cac.payment (opportunity_id);
create index on cac.draft (target_id);
create index on cac.approval (target_id);
create index on cac.attachment (survey_id);

-- ── Timestamps and record versions ─────────────────────────────────────────

create or replace function cac.touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    if tg_table_name <> 'job' then new.record_version := old.record_version + 1; end if;
  elsif tg_table_name <> 'job' then
    new.record_version := 1;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['customer','contact','site','prospect','campaign','opportunity','activity','survey','rate','portfolio','quote','revision','project','change','payment','maintenance','task','draft','approval','attachment','job']
  loop
    execute format('create trigger touch before insert or update on cac.%I for each row execute function cac.touch()', t);
  end loop;
end $$;

-- ── Access ─────────────────────────────────────────────────────────────────

create or replace function cac.is_staff()
returns boolean language sql stable security definer set search_path = cac as $$
  select exists (select 1 from cac.staff where user_id = auth.uid() and active);
$$;

grant usage on schema cac to authenticated, service_role;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'cac'
  loop
    execute format('alter table cac.%I enable row level security', t);
    execute format('revoke all on cac.%I from anon, authenticated', t);
    execute format('grant select on cac.%I to authenticated', t);
    execute format('grant all on cac.%I to service_role', t);
    execute format('create policy "staff read" on cac.%I for select to authenticated using (cac.is_staff())', t);
  end loop;
end $$;

grant execute on function cac.is_staff() to authenticated, service_role;
