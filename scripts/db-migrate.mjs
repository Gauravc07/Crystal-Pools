// Applies supabase/migrations/*.sql in filename order, once each.
// Usage: npm run db:migrate   (reads SUPABASE_DB_URL from .env)
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL is not set in .env');
  process.exit(1);
}

const dir = path.resolve('supabase/migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query(`
    create table if not exists public._migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
    alter table public._migrations enable row level security;
  `);
  const { rows } = await client.query('select name from public._migrations');
  const applied = new Set(rows.map(r => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    process.stdout.write(`Applying ${file} ... `);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into public._migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log('done');
    } catch (err) {
      await client.query('rollback');
      console.log('FAILED');
      throw err;
    }
  }
  console.log('Database is up to date.');
} finally {
  await client.end();
}
