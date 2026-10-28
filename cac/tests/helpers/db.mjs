// In-process Postgres (PGlite) with the small slice of Supabase the CAC
// migrations rely on: auth.users/identities, auth.uid(), storage buckets and
// objects, and the anon/authenticated/service_role roles. Tests call the real
// SQL functions exactly as PostgREST would (as `authenticated` with JWT claims).
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrations = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));

const supabaseStubs = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema extensions; create schema auth; create schema storage;
  grant usage on schema auth, storage to anon, authenticated, service_role;
  create table auth.users (
    instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text, email_confirmed_at timestamptz,
    raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
    confirmation_token text, recovery_token text, email_change_token_new text, email_change text);
  create table auth.identities (provider_id text, user_id uuid, identity_data jsonb, provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub', '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz default now(), unique (bucket_id, name));
  alter table storage.objects enable row level security;
  grant select, insert on storage.objects to authenticated;
  create table public.leads (id uuid primary key default gen_random_uuid(), name text not null, email text not null, phone text not null default '',
    project_type text not null default '', message text not null, source_page text not null default '', status text not null default 'new', created_at timestamptz not null default now());
`;

let template;
async function buildTemplate() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(supabaseStubs);
  for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
    try { await db.exec(readFileSync(migrations + file, 'utf8')); }
    catch (error) { throw new Error(`${file}: ${error.message}`); }
  }
  return db;
}

const encode = value => value !== null && typeof value === 'object' ? JSON.stringify(value) : value;

// Runs fn(tx) as the given Supabase role and user, the way PostgREST does.
export async function as(db, { role = 'authenticated', user = null } = {}, fn) {
  return db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [user ? JSON.stringify({ sub: user, role }) : '']);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

// Calls cac.<name>(named args) and returns the decoded result.
export async function call(db, name, args = {}, identity = {}) {
  const keys = Object.keys(args);
  const sql = `select to_jsonb(cac.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})) as result`;
  return as(db, identity, async tx => (await tx.query(sql, keys.map(k => encode(args[k])))).rows[0].result);
}

// A fake supabase-js client (rpc + storage.download) for the shared worker.
export function serviceClient(db) {
  return {
    async rpc(name, args = {}) {
      try { return { data: await call(db, name, args, { role: 'service_role' }), error: null }; }
      catch (error) { return { data: null, error: { message: error.message, code: error.code } }; }
    },
    storage: { from: () => ({ download: async () => ({ data: new Blob([new Uint8Array([137, 80, 78, 71])]), error: null }) }) },
  };
}

export async function setup(t, { seed = true } = {}) {
  template ??= buildTemplate();
  const db = await (await template).clone();
  t?.after(() => db.close());
  const admin = (await call(db, 'bootstrap_admin', { p_email: 'admin@cac.test', p_name: 'Pilot owner', p_password: 'cac-test-password' }, { role: 'service_role' })).user_id;
  if (seed) await call(db, 'seed_demo', { p_admin: admin }, { role: 'service_role' });
  const staff = {};
  for (const role of ['sales', 'engineer', 'commercial', 'project', 'viewer']) {
    staff[role] = (await db.query(`select (cac.ensure_staff($1, $2, $3, 'cac-test-password')->>'user_id') as id`, [`${role}@cac.test`, `${role} user`, role])).rows[0].id;
  }
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const ids = seed ? {
    opportunity: (await one(`select id from cac.opportunity where name = 'Sahyadri · resort pool'`)).id,
    villaOpportunity: (await one(`select id from cac.opportunity where name = 'Meadow · private pool'`)).id,
    customer: (await one(`select id from cac.customer where name = 'Sahyadri Retreat (demo)'`)).id,
    site: (await one(`select id from cac.site where name = 'Lonavala resort · west garden'`)).id,
    survey: (await one(`select id from cac.survey limit 1`)).id,
    quote: (await one(`select id from cac.quote limit 1`)).id,
    rate: (await one(`select id from cac.rate where status = 'approved' order by name limit 1`)).id,
  } : {};
  // Shorthand: run a CAC function as a staff member ("admin" or a role name).
  const rpc = (who, name, args) => call(db, name, args, { user: who === 'admin' ? admin : staff[who] });
  return { db, admin, staff, ids, rpc, one, all: async (sql, params) => (await db.query(sql, params)).rows };
}
