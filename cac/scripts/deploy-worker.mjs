// Deploys the cac-worker Edge Function and copies the AI settings from
// cac/.env into Supabase function secrets. Needs `npx supabase login` once.
// Usage: npm --prefix cac run deploy:worker
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const url = process.env.VITE_CAC_SUPABASE_URL;
if (!url) { console.error('Set VITE_CAC_SUPABASE_URL in cac/.env first.'); process.exit(1); }
const ref = new URL(url).hostname.split('.')[0];
const cwd = fileURLToPath(new URL('..', import.meta.url));
const run = args => {
  const result = spawnSync('npx', ['--yes', 'supabase', ...args, '--project-ref', ref], { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) { console.error(`\nFailed: supabase ${args[0]} ${args[1]}. If you are not logged in, run: npx supabase login`); process.exit(result.status || 1); }
};

run(['functions', 'deploy', 'cac-worker', '--no-verify-jwt']);

// Only non-empty values are sent; keys never go into source control or the browser.
const names = ['CAC_AI_MODE', 'ANTHROPIC_API_KEY', 'CAC_ANTHROPIC_MODEL', 'HF_TOKEN', 'CAC_HF_MODEL', 'CAC_HF_FALLBACK_MODELS', 'CAC_HF_VISION_MODEL', 'CAC_HF_BILL_TO', 'OPENAI_API_KEY', 'CAC_OPENAI_MODEL', 'CAC_APP_ORIGIN', 'CAC_WORKER_SECRET', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'];
const secrets = names.filter(n => process.env[n]).map(n => `${n}=${process.env[n]}`);
if (!process.env.CAC_WORKER_SECRET) {
  const generated = randomBytes(24).toString('hex');
  secrets.push(`CAC_WORKER_SECRET=${generated}`);
  console.log(`\nGenerated CAC_WORKER_SECRET for scheduled runs. Add it to cac/.env and supabase/cron.example.sql:\nCAC_WORKER_SECRET=${generated}`);
}
// Secrets go through a short-lived private file, not command-line arguments (visible to other processes).
const file = join(mkdtempSync(join(tmpdir(), 'cac-secrets-')), '.env');
writeFileSync(file, secrets.join('\n') + '\n', { mode: 0o600 });
try { run(['secrets', 'set', '--env-file', file]); } finally { rmSync(dirname(file), { recursive: true, force: true }); }
console.log(`\ncac-worker deployed to ${ref} with: ${secrets.map(s => s.split('=')[0]).join(', ')}`);
