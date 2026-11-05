// A private sandbox for trying CAC (the FRP quotation agent and the drawings vault) without a
// Supabase project: the real staff app runs in Vite and talks to a small local
// stand-in for Supabase Auth and the Data API, backed by an in-memory Postgres
// (PGlite) with every CAC migration applied. Nothing reaches your live project.
// Data lives only while this runs; stopping it (Ctrl+C) discards everything.
// Usage: npm --prefix cac run sandbox
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer as createVite } from 'vite';
import { setup, call } from '../tests/helpers/db.mjs';

const API_PORT = Number(process.env.CAC_SANDBOX_API_PORT || 54329);
const APP_PORT = Number(process.env.CAC_SANDBOX_PORT || 5190);
const PASSWORD = 'cac-test-password';

console.log('Preparing the sandbox database (all migrations, one login per role)…');
const { db, one } = await setup(null);
await db.query(`select cac.ensure_staff('sagar@cac.test', 'Sagar Kale', 'field', $1)`, [PASSWORD]);
await db.query(`update cac.staff set must_change_password = false`);

// ── Supabase stand-in (Auth and RPC) ───────────────────────────────────────
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const session = user => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp })}.sandbox`;
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: `refresh.${user.id}`, user: authUser(user) };
};
const authUser = user => ({ id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() });
const subOf = req => { const token = req.headers.authorization?.replace('Bearer ', ''); try { return token?.split('.').length === 3 ? JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub : null; } catch { return null; } };

const api = createHttpServer(async (req, res) => {
  const reply = (status, body) => { res.writeHead(status, { ...headers, 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); return res.end(); }
  const url = new URL(req.url, `http://127.0.0.1:${API_PORT}`);
  let body = {};
  try { const raw = await new Promise(resolve => { let d = ''; req.on('data', c => { d += c; }); req.on('end', () => resolve(d)); }); body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
  const sub = subOf(req);
  try {
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const user = await one(`select id, email from auth.users where id::text = $1`, [String(body.refresh_token || '').replace('refresh.', '')]);
        return user ? reply(200, session(user)) : reply(400, { error: 'invalid_grant', error_description: 'Session expired', code: 'refresh_token_not_found', msg: 'Session expired' });
      }
      const user = await one(`select id, email from auth.users where email = lower($1) and encrypted_password = extensions.crypt($2, encrypted_password)`, [body.email || '', body.password || '']);
      return user ? reply(200, session(user)) : reply(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    if (url.pathname === '/auth/v1/logout') { res.writeHead(204, headers); return res.end(); }
    if (url.pathname === '/auth/v1/recover') return reply(200, {});
    if (url.pathname === '/auth/v1/user') {
      if (!sub) return reply(401, { code: 'no_session', msg: 'Not signed in' });
      if (req.method === 'PUT' && body.password) await db.query(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf', 4)) where id = $1`, [sub, body.password]);
      return reply(200, authUser(await one(`select id, email from auth.users where id = $1`, [sub])));
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      try { return reply(200, await call(db, url.pathname.split('/').pop(), body, { user: sub })); }
      catch (error) { return reply(400, { code: error.code, message: error.message, details: null, hint: null }); }
    }
    return reply(404, { message: `The sandbox does not support ${url.pathname} (drawing file uploads need a real Supabase project).` });
  } catch (error) {
    return reply(500, { message: error.message });
  }
});
await new Promise(resolve => api.listen(API_PORT, '127.0.0.1', resolve));

// ── The staff app, pointed at the stand-in ─────────────────────────────────
process.env.VITE_CAC_SUPABASE_URL = `http://127.0.0.1:${API_PORT}`;
process.env.VITE_CAC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sandbox';
const vite = await createVite({ configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)), server: { port: APP_PORT, strictPort: false }, logLevel: 'warn' });
await vite.listen();
const appUrl = vite.resolvedUrls.local[0];

console.log(`
CAC sandbox is running at ${appUrl}
(In-memory data. Nothing is sent to your live Supabase project. Ctrl+C stops it and discards everything.)

Sign in with any of these (password for all: ${PASSWORD}):
  Field staff (customer visits)   sagar@cac.test
  Admin                           admin@cac.test
  Commercial (prices, approval)   commercial@cac.test
  Sales                           sales@cac.test
  Engineer (checks drawings)      engineer@cac.test
`);
const stop = async () => { await vite.close(); api.close(); await db.close(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
