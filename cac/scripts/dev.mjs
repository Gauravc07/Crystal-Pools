// Starts the staff app (Vite) and, when CAC_SUPABASE_SECRET_KEY is set in
// cac/.env, a local queue worker. Data, auth and rules live in Supabase.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const cwd = fileURLToPath(new URL('..', import.meta.url));
const vite = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const env = existsSync(join(cwd, '.env')) ? readFileSync(join(cwd, '.env'), 'utf8') : '';
const children = [spawn(process.execPath, [vite, '--config', 'vite.config.mjs'], { cwd, stdio: 'inherit' })];
if (/^CAC_SUPABASE_SECRET_KEY=\S+/m.test(env)) children.push(spawn(process.execPath, ['--env-file=.env', 'scripts/worker.mjs'], { cwd, stdio: 'inherit' }));
else console.log('No CAC_SUPABASE_SECRET_KEY in cac/.env: workflow runs are processed by the deployed cac-worker function.');
let closing = false;
function stop(code = 0) { if (closing) return; closing = true; children.forEach(child => child.kill()); process.exitCode = code; }
for (const child of children) { child.on('error', error => { console.error(error.message); stop(1); }); child.on('exit', code => stop(code || 0)); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
