// Checks that a CAC installation is ready to use and says how to fix what is not.
// Usage: npm --prefix cac run doctor            (read-only checks, no AI cost)
//        npm --prefix cac run doctor -- --ping-ai   (also sends one tiny AI request)
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { providerOptions, aiConfigured } from '../supabase/functions/_shared/analysis.js';
import { gmailOptions, gmailConfigured, gmailAccessToken } from '../supabase/functions/_shared/mail.js';

const env = process.env;
const results = [];
const report = (status, check, detail = '') => results.push({ status, check, detail });
const pingAi = process.argv.includes('--ping-ai');

// 1. Configuration
const url = env.VITE_CAC_SUPABASE_URL, key = env.VITE_CAC_SUPABASE_PUBLISHABLE_KEY;
for (const [name, value, required] of [['VITE_CAC_SUPABASE_URL', url, true], ['VITE_CAC_SUPABASE_PUBLISHABLE_KEY', key, true], ['CAC_SUPABASE_DB_URL', env.CAC_SUPABASE_DB_URL, true], ['CAC_SUPABASE_SECRET_KEY', env.CAC_SUPABASE_SECRET_KEY, false]]) {
  if (value) report('PASS', `${name} is set`);
  else report(required ? 'FAIL' : 'WARN', `${name} is not set`, required ? 'Add it to cac/.env (see .env.example).' : 'Only needed for the local worker (npm run worker / dev).');
}
if (key && /^sb_secret_|service_role/.test(key)) report('FAIL', 'The browser key looks like a SECRET key', 'VITE_CAC_SUPABASE_PUBLISHABLE_KEY must be the publishable/anon key. Rotate the secret key if this was deployed.');
const ref = url ? new URL(url).hostname.split('.')[0] : '<project-ref>';

// 2. Database, migrations, staff, settings, worker
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
        (select jsonb_object_agg(key, value) from cac.setting) settings,
        (select to_jsonb(w) from cac.worker_status w) worker,
        (select count(*) from cac.job where status = 'queued' and available_at < now() - interval '5 minutes')::int stuck,
        (select count(*) from cac.job where status = 'failed' and created_at > now() - interval '1 day')::int failed_today,
        (select count(*) from pg_proc p where pronamespace = 'cac'::regnamespace and has_function_privilege('anon', p.oid, 'execute'))::int anon_functions`)).rows[0];
      report(s.admins ? 'PASS' : 'FAIL', `${s.admins} active admin(s), ${s.staff} active staff`, s.admins ? '' : 'Set CAC_ADMIN_EMAIL and run npm --prefix cac run setup.');
      report(s.anon_functions ? 'FAIL' : 'PASS', s.anon_functions ? `${s.anon_functions} CAC functions are callable by signed-out visitors` : 'Signed-out visitors cannot call CAC functions');
      if (!s.worker) report('WARN', 'The worker has never run', 'Run npm --prefix cac run dev (local worker) or deploy cac-worker: npm --prefix cac run deploy:worker.');
      else {
        const minutes = Math.round((Date.now() - new Date(s.worker.last_seen)) / 60000);
        report(minutes <= 10 ? 'PASS' : 'WARN', `Worker last seen ${minutes} min ago (${s.worker.mode}${s.worker.mode !== 'demo' && !s.worker.ai_configured ? ', API key missing' : ''})`,
          minutes > 10 ? 'Assistant runs wait until a worker runs. Keep npm run dev open, deploy cac-worker, or schedule it (supabase/cron.example.sql).' : '');
      }
      if (s.stuck) report('WARN', `${s.stuck} run(s) queued for over 5 minutes`, 'No worker is processing the queue.');
      if (s.failed_today) report('WARN', `${s.failed_today} assistant run(s) failed in the last day`, 'See Agent studio for each reason.');
      report(s.settings.review_url ? 'PASS' : 'WARN', s.settings.review_url ? 'Google review link set' : 'Google review link not set', s.settings.review_url ? '' : 'Admin: Settings → Business settings.');
      report('INFO', `Run limits: ${s.settings.user_hourly_run_limit}/person/hour, ${s.settings.workspace_daily_run_limit}/day`);
      if (s.settings.lead_mail_configured !== 'true') report('INFO', 'Lead reports: the worker has no Gmail connection (uploads still work)', 'Run npm --prefix cac run gmail:auth, then npm --prefix cac run deploy:worker.');
      else report(s.settings.lead_mail_last_error ? 'WARN' : 'PASS', `Lead reports: worker reads Gmail (last check ${s.settings.lead_mail_last_poll || 'not yet'})`, s.settings.lead_mail_last_error || s.settings.lead_mail_last_result || '');
    }
  } catch (error) {
    report('FAIL', 'Database check failed', error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

// 3. Data API exposure (what the browser app and worker use)
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

// 4. AI provider (local configuration; the deployed worker uses Supabase secrets)
const ai = providerOptions(k => env[k]);
if (ai.mode === 'demo') report('INFO', 'AI: demo rules (no provider, no cost)');
else if (!aiConfigured(ai)) report('FAIL', `AI mode ${ai.mode} but its key is missing`, ai.mode === 'huggingface' ? 'Set HF_TOKEN in cac/.env.' : ai.mode === 'anthropic' ? 'Set ANTHROPIC_API_KEY in cac/.env.' : 'Set OPENAI_API_KEY in cac/.env.');
else if (ai.mode === 'anthropic') {
  // Looking up the model is free: it checks the key and that the model is available to it.
  try {
    const response = await fetch(`https://api.anthropic.com/v1/models/${ai.anthropic.model}`, { headers: { 'x-api-key': ai.anthropic.apiKey, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(15000) });
    report(response.ok ? 'PASS' : 'FAIL', response.ok ? `AI: Claude ${ai.anthropic.model} (key valid)` : `Anthropic answered HTTP ${response.status} for ${ai.anthropic.model}`, response.status === 401 ? 'ANTHROPIC_API_KEY was rejected.' : response.status === 404 ? 'Check CAC_ANTHROPIC_MODEL.' : '');
  } catch (error) {
    report('FAIL', 'Could not reach the Claude API', error.message);
  }
}
else if (ai.mode === 'huggingface') {
  try {
    const who = await fetch('https://huggingface.co/api/whoami-v2', { headers: { Authorization: `Bearer ${ai.huggingface.token}` }, signal: AbortSignal.timeout(15000) });
    if (!who.ok) report('FAIL', `Hugging Face rejected HF_TOKEN (HTTP ${who.status})`, 'Create a fine-grained token with "Make calls to Inference Providers".');
    else report('PASS', `Hugging Face token valid for ${(await who.json()).name}`, `Model ${ai.huggingface.model}; fallbacks ${ai.huggingface.fallbacks.join(', ') || 'none'}`);
    if (pingAi && who.ok) {
      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${ai.huggingface.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ai.huggingface.model, messages: [{ role: 'user', content: 'Reply with the single word: ok' }], max_tokens: 5 }), signal: AbortSignal.timeout(60000),
      });
      report(response.ok ? 'PASS' : 'FAIL', `Test request to ${ai.huggingface.model}: HTTP ${response.status}`,
        response.status === 402 ? 'No inference credits: purchase credits or use HF PRO (free accounts have none).' : response.ok ? '' : (await response.text()).slice(0, 200));
    }
  } catch (error) {
    report('FAIL', 'Could not reach Hugging Face', error.message);
  }
} else report('PASS', `AI: OpenAI ${ai.openai.model} (key set)`);

// 5. Gmail for lead reports (local configuration; refreshing a token is free and read-only)
const gmail = gmailOptions(k => env[k]);
if (!gmailConfigured(gmail)) report('INFO', 'Gmail lead reports: not configured locally', gmail.clientId ? 'Run npm --prefix cac run gmail:auth to add GMAIL_REFRESH_TOKEN.' : 'Optional: set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET, then run gmail:auth.');
else {
  try {
    const token = await gmailAccessToken(gmail);
    const profile = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }).then(r => r.json());
    report(profile.emailAddress ? 'PASS' : 'FAIL', profile.emailAddress ? `Gmail connected: ${profile.emailAddress}` : 'Gmail token works but the mailbox could not be read', profile.emailAddress ? '' : 'Run gmail:auth again and allow reading email.');
  } catch (error) {
    report('FAIL', 'Gmail sign-in failed', error.message);
  }
}

const icon = { PASS: '✔', WARN: '!', FAIL: '✖', INFO: '·' };
for (const r of results) console.log(`${icon[r.status]} ${r.status.padEnd(4)} ${r.check}${r.detail ? `\n         ${r.detail}` : ''}`);
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(failed ? `\n${failed} problem(s) to fix.` : '\nCAC is ready.');
process.exitCode = failed ? 1 : 0;
