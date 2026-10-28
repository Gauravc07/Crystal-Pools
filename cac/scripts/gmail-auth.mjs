// Connects the mailbox that receives the project lead reports. Opens Google
// sign-in in the browser (read-only Gmail access), then saves the refresh token
// to cac/.env as GMAIL_REFRESH_TOKEN. Run `npm run deploy:worker` afterwards so
// the hosted worker gets it too.
// Needs GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET (Google Cloud → APIs & Services →
// Credentials → OAuth client ID, type "Desktop app", with the Gmail API enabled).
// Usage: npm --prefix cac run gmail:auth
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const clientId = process.env.GMAIL_CLIENT_ID, clientSecret = process.env.GMAIL_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in cac/.env first (Google Cloud OAuth client, type "Desktop app").');
  process.exit(1);
}
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
const verifier = randomBytes(32).toString('base64url');
const state = randomBytes(16).toString('hex');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/') { res.writeHead(404).end(); return; }
  const finish = (status, message) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(message); server.close(); };
  if (url.searchParams.get('state') !== state) return finish(400, 'Sign-in did not match this request. Run gmail:auth again.');
  if (url.searchParams.get('error')) { console.error(`Google sign-in was cancelled: ${url.searchParams.get('error')}`); process.exitCode = 1; return finish(400, 'Sign-in cancelled. You can close this tab.'); }
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: url.searchParams.get('code'), client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }),
    });
    const tokens = await response.json();
    if (!tokens.refresh_token) throw new Error(tokens.error_description || tokens.error || 'Google returned no refresh token. Remove the app at myaccount.google.com/permissions and try again.');
    if (!String(tokens.scope || '').includes(SCOPE)) throw new Error('Read access to Gmail was not granted. Run gmail:auth again and tick "Read your email messages".');
    const profile = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then(r => r.json());
    const env = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
    const line = `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`;
    writeFileSync(envFile, /^GMAIL_REFRESH_TOKEN=.*$/m.test(env) ? env.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, line) : `${env.replace(/\s*$/, '\n')}${line}\n`);
    console.log(`\nConnected ${profile.emailAddress}. GMAIL_REFRESH_TOKEN saved to cac/.env.`);
    console.log('Next: npm --prefix cac run deploy:worker   (the local worker in npm run dev picks it up on restart)');
    finish(200, `Connected ${profile.emailAddress} to Crystal Pools CAC. You can close this tab.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    finish(500, `Could not connect Gmail: ${error.message}`);
  }
});

let redirect;
server.listen(0, '127.0.0.1', () => {
  redirect = `http://127.0.0.1:${server.address().port}/`;
  const auth = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
  })}`;
  console.log(`Sign in with the mailbox that receives the reports:\n${auth}\n`);
  const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', `"${auth}"`]] : [process.platform === 'darwin' ? 'open' : 'xdg-open', [auth]];
  spawn(opener[0], opener[1], { stdio: 'ignore', detached: true, shell: process.platform === 'win32', windowsVerbatimArguments: true }).on('error', () => {}).unref();
});
