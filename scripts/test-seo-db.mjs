// Applies every website migration to an in-process Postgres and checks the SEO permission rules.
// Touches no real database. Usage: node scripts/test-seo-db.mjs   (needs cac dependencies installed)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(path.resolve('cac/package.json'));
const pgliteEntry = require.resolve('@electric-sql/pglite');
const { PGlite } = await import(pathToFileURL(pgliteEntry).href);
let pgcrypto;
try {
  const entry = pgliteEntry.replace(/index\.(c?js)$/, 'contrib/pgcrypto.js');
  if (fs.existsSync(entry)) pgcrypto = (await import(pathToFileURL(entry).href)).pgcrypto;
} catch { /* not bundled: migrations stub what they need below */ }

const db = new PGlite({ extensions: pgcrypto ? { pgcrypto } : {} });

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage; create schema extensions;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, encrypted_password text,
    raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}', aud text, role text,
    email_confirmed_at timestamptz, instance_id uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
    confirmation_token text default '', recovery_token text default '', email_change text default '', email_change_token_new text default '');
  create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid, provider text, provider_id text,
    identity_data jsonb, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
if (pgcrypto) await db.exec(`create extension if not exists pgcrypto with schema extensions;`);
else await db.exec(`create function extensions.gen_random_bytes(int) returns bytea language sql as $$ select decode(repeat('ab', $1), 'hex') $$;
  create function extensions.crypt(text, text) returns text language sql as $$ select $1 $$;
  create function extensions.gen_salt(text) returns text language sql as $$ select 'x' $$;`);

const dir = 'supabase/migrations';
for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.sql')).sort()) {
  try {
    await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  } catch (e) {
    throw new Error(`${f}: ${e.message}`);
  }
}
console.log('all migrations applied');

const ids = { admin: '00000000-0000-0000-0000-000000000001', seo: '00000000-0000-0000-0000-000000000002', editor: '00000000-0000-0000-0000-000000000003' };
for (const [name, id] of Object.entries(ids)) await db.query(`insert into auth.users (id, email) values ($1, $2) on conflict do nothing`, [id, `${name}@x.test`]);
await db.exec(`alter table public.profiles disable trigger all;`);
for (const [name, id] of Object.entries(ids)) {
  await db.query(
    `insert into public.profiles (id, email, full_name, role, permissions) values ($1, $2, $3, $4, $5)
     on conflict (id) do update set role = excluded.role, permissions = excluded.permissions`,
    [id, `${name}@x.test`, name, name === 'admin' ? 'super_admin' : 'editor', name === 'seo' ? ['seo'] : name === 'editor' ? ['blogs'] : []],
  );
}
await db.exec(`alter table public.profiles enable trigger all;`);
await db.exec(`insert into public.blogs (id, title, slug, excerpt, content, status, published_at)
  values ('10000000-0000-0000-0000-000000000001', 'P', 'p-one', 'e', '<p>x</p>', 'published', now() - interval '1 day') on conflict do nothing;`);

async function as(who, fn) {
  const role = who === 'anon' ? 'anon' : 'authenticated';
  await db.exec(`set request.uid = '${who === 'anon' ? '' : ids[who]}'; set role ${role};`);
  try { return await fn(); } finally { await db.exec(`reset role; set request.uid = '';`); }
}
const denied = async (who, sql, params) => {
  let failed = false;
  let rows = 0;
  await as(who, async () => {
    try { rows = (await db.query(sql, params)).affectedRows ?? 0; } catch { failed = true; }
  });
  assert.ok(failed || rows === 0, `${who} should not be able to run: ${sql}`);
};
const allowed = (who, sql, params) => as(who, () => db.query(sql, params));

// Seeded city pages are drafts and invisible to the public
assert.equal((await db.query(`select count(*)::int c from public.city_pages`)).rows[0].c, 6);
assert.equal((await as('anon', () => db.query(`select * from public.city_pages`))).rows.length, 0, 'drafts hidden from visitors');

// SEO team
await allowed('seo', `insert into public.page_content (page, key, value) values ('home', 'seo.title', '"T"')`);
await denied('seo', `insert into public.page_content (page, key, value) values ('home', 'hero.lead', '"X"')`);
await allowed('seo', `select public.set_blog_seo('10000000-0000-0000-0000-000000000001', 'New title', 'New desc')`);
assert.equal((await db.query(`select meta_title from public.blogs where slug = 'p-one'`)).rows[0].meta_title, 'New title');
await allowed('seo', `select public.set_google_settings('G-ABC1234', '', '')`);
assert.equal((await db.query(`select ga_measurement_id g from public.site_settings`)).rows[0].g, 'G-ABC1234');
await denied('seo', `update public.site_settings set phone = 'x'`);
await denied('seo', `update public.blogs set title = 'hacked' where slug = 'p-one'`);
await allowed('seo', `insert into public.seo_redirects (from_path, to_path) values ('/old', '/about')`);
await allowed('seo', `update public.city_pages set is_published = true, intro = 'i' where slug = 'nashik'`);
await allowed('seo', `insert into public.seo_monthly (month, review_count) values ('2026-11-01', 12)`);

// Published data is public; bad data is refused
assert.equal((await as('anon', () => db.query(`select slug from public.city_pages`))).rows.length, 1);
assert.equal((await as('anon', () => db.query(`select from_path from public.seo_redirects`))).rows.length, 1);
await denied('seo', `insert into public.seo_redirects (from_path, to_path) values ('/LOUD', '/about')`);
await denied('seo', `insert into public.seo_redirects (from_path, to_path) values ('/same', '/same')`);
await denied('seo', `insert into public.seo_monthly (month) values ('2026-11-15')`);

// A blogs-only editor and anonymous visitors get none of this
await denied('editor', `insert into public.page_content (page, key, value) values ('about', 'seo.title', '"T"')`);
await denied('editor', `insert into public.seo_redirects (from_path, to_path) values ('/e', '/about')`);
await denied('editor', `select public.set_google_settings('', '', '')`);
await denied('editor', `select public.set_blog_seo('10000000-0000-0000-0000-000000000001', 'x', 'y')`);
await denied('editor', `select * from public.seo_lead_counts(12)`);
await denied('anon', `select public.set_google_settings('', '', '')`);
await denied('anon', `select * from public.seo_lead_counts(12)`);
await denied('anon', `insert into public.seo_redirects (from_path, to_path) values ('/a', '/about')`);
assert.equal((await as('anon', () => db.query(`select * from public.seo_monthly`))).rows.length, 0);
assert.equal((await as('editor', () => db.query(`select * from public.seo_monthly`))).rows.length, 0);

// Visitors can still submit leads, with or without source details, and still can't read them
await allowed('anon', `insert into public.leads (name, email, message) values ('A', 'a@x.test', 'hello')`);
await allowed('anon', `insert into public.leads (name, email, message, traffic_source, landing_page) values ('B', 'b@x.test', 'hi', 'google_search', '/')`);
assert.equal((await as('anon', () => db.query(`select * from public.leads`))).rows.length, 0);

// Counts reach the SEO team; the leads themselves don't
const counts = (await as('seo', () => db.query(`select * from public.seo_lead_counts(12)`))).rows;
assert.equal(counts.reduce((n, r) => n + Number(r.leads), 0), 2);
assert.ok(counts.some(r => r.source === 'google_search'));
assert.equal((await as('seo', () => db.query(`select * from public.leads`))).rows.length, 0);

// Super Admin keeps full access, and existing defaults are unchanged
await allowed('admin', `update public.site_settings set founding_year = '1993', est_label = 'EST 1993'`);
await allowed('admin', `insert into public.page_content (page, key, value) values ('about', 'hero.title', '"Y"')`);
const facts = (await db.query(`select column_default d from information_schema.columns where table_name = 'site_settings' and column_name = 'est_label'`)).rows[0].d;
assert.match(facts, /EST 2000/);

console.log('all SEO permission checks passed');
