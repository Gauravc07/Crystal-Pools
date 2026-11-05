// Checks that a CAC installation is ready to use and says how to fix what is not.
// Usage: npm --prefix cac run doctor   (read-only checks)
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const env = process.env;
const results = [];
const report = (status, check, detail = '') => results.push({ status, check, detail });

// 1. Configuration
const url = env.VITE_CAC_SUPABASE_URL, key = env.VITE_CAC_SUPABASE_PUBLISHABLE_KEY;
for (const [name, value] of [['VITE_CAC_SUPABASE_URL', url], ['VITE_CAC_SUPABASE_PUBLISHABLE_KEY', key], ['CAC_SUPABASE_DB_URL', env.CAC_SUPABASE_DB_URL]]) {
  if (value) report('PASS', `${name} is set`);
  else report('FAIL', `${name} is not set`, 'Add it to cac/.env (see .env.example).');
}
if (key && /^sb_secret_|service_role/.test(key)) report('FAIL', 'The browser key looks like a SECRET key', 'VITE_CAC_SUPABASE_PUBLISHABLE_KEY must be the publishable/anon key. Rotate the secret key if this was deployed.');
const ref = url ? new URL(url).hostname.split('.')[0] : '<project-ref>';

// 2. Database, migrations, staff, price list
if (env.CAC_SUPABASE_DB_URL) {
  const client = new pg.Client({ connectionString: env.CAC_SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
    report('PASS', 'Database connection');
    const files = readdirSync(fileURLToPath(new URL('../supabase/migrations/', import.meta.url))).filter(f => f.endsWith('.sql')).sort();
    const applied = await client.query('select name from cac.schema_migrations').then(r => new Set(r.rows.map(x => x.name)), () => new Set());
    const pending = files.filter(f => !applied.has(f));
    report(pending.length ? 'FAIL' : 'PASS', pending.length ? `Migrations not applied: ${pending.join(', ')}` : `All ${files.length} migrations applied`, pending.length ? 'Run: npm --prefix cac run setup' : '');
    if (!pending.length) {
      const s = (await client.query(`select
        (select count(*) from cac.staff where active and role = 'admin')::int admins,
        (select count(*) from cac.staff where active)::int staff,
        (select prices_confirmed_at from cac.frp_config where id = 1) confirmed,
        (select count(*) from cac.frp_quote where status = 'draft')::int waiting,
        (select count(*) from pg_proc p where pronamespace = 'cac'::regnamespace and has_function_privilege('anon', p.oid, 'execute'))::int anon_functions`)).rows[0];
      report(s.admins ? 'PASS' : 'FAIL', `${s.admins} active admin(s), ${s.staff} active staff`, s.admins ? '' : 'Set CAC_ADMIN_EMAIL and run npm --prefix cac run setup.');
      report(s.anon_functions ? 'FAIL' : 'PASS', s.anon_functions ? `${s.anon_functions} CAC functions are callable by signed-out visitors` : 'Signed-out visitors cannot call CAC functions');
      report(s.confirmed ? 'PASS' : 'WARN', s.confirmed ? `FRP price list confirmed ${new Date(s.confirmed).toLocaleDateString('en-IN')}` : 'FRP price list not confirmed yet',
        s.confirmed ? '' : 'An admin or commercial user checks the rates in Settings → FRP price list and saves them. Until then no quotation can be approved.');
      report('INFO', `${s.waiting} FRP quotation(s) waiting for approval`);
    }
  } catch (error) {
    report('FAIL', 'Database check failed', error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

// 3. Data API exposure (what the browser app uses)
if (url && key) {
  try {
    const response = await fetch(`${url}/rest/v1/rpc/is_staff`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', 'Content-Profile': 'cac' }, body: '{}', signal: AbortSignal.timeout(15000) });
    const body = await response.json().catch(() => ({}));
    if (body.code === 'PGRST106') report('FAIL', 'The cac schema is not exposed to the Data API', `Add "cac" under Exposed schemas: https://supabase.com/dashboard/project/${ref}/settings/api`);
    else if (response.ok || ['42501', 'PGRST202'].includes(body.code) || response.status === 401) report('PASS', 'Data API reaches the cac schema');
    else report('WARN', `Data API answered HTTP ${response.status}`, body.message || '');
  } catch (error) {
    report('FAIL', 'Could not reach the Supabase Data API', error.message);
  }
}

const icon = { PASS: '✔', WARN: '!', FAIL: '✖', INFO: '·' };
for (const r of results) console.log(`${icon[r.status]} ${r.status.padEnd(4)} ${r.check}${r.detail ? `\n         ${r.detail}` : ''}`);
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(failed ? `\n${failed} problem(s) to fix.` : '\nCAC is ready.');
process.exitCode = failed ? 1 : 0;
