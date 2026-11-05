// Prepares a Supabase project for CAC:
//   1. applies cac/supabase/migrations/*.sql once each (tracked in cac.schema_migrations)
//   2. creates the first CAC admin (CAC_ADMIN_EMAIL / CAC_ADMIN_PASSWORD)
// Usage: npm --prefix cac run setup   (reads cac/.env)
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const url = process.env.CAC_SUPABASE_DB_URL;
if (!url) {
  console.error('Set CAC_SUPABASE_DB_URL in cac/.env (Supabase → Connect → Session pooler).');
  process.exit(1);
}
const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query(`create schema if not exists cac;
    create table if not exists cac.schema_migrations (name text primary key, applied_at timestamptz not null default now());`);
  const applied = new Set((await client.query('select name from cac.schema_migrations')).rows.map(r => r.name));
  for (const file of files) {
    if (applied.has(file)) continue;
    process.stdout.write(`Applying ${file} ... `);
    await client.query('begin');
    try {
      await client.query(readFileSync(dir + file, 'utf8'));
      await client.query('insert into cac.schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log('done');
    } catch (error) {
      await client.query('rollback');
      console.log('FAILED');
      throw error;
    }
  }
  console.log('CAC schema is up to date.');

  const email = process.env.CAC_ADMIN_EMAIL;
  if (email) {
    const { rows } = await client.query('select cac.bootstrap_admin($1, $2, $3) as staff', [email, process.env.CAC_ADMIN_NAME || 'CAC admin', process.env.CAC_ADMIN_PASSWORD || null]);
    const admin = rows[0].staff;
    console.log(`Admin ready: ${admin.email}`);
  } else {
    console.log('CAC_ADMIN_EMAIL not set: no admin created. Set it to create the first CAC admin.');
  }
} finally {
  await client.end();
}
