// End-to-end smoke test of the real staff app against the real CAC SQL.
// Playwright answers the app's Supabase requests (Auth, PostgREST RPC and the
// cac-worker function) from an in-process PGlite database, so no Supabase
// project or network access is needed. Screenshots go to cac/test-results/.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { setup, call, serviceClient } from './helpers/db.mjs';
import { runAll } from '../supabase/functions/_shared/worker.js';

const SUPABASE = 'http://fake-supabase.test';
process.env.VITE_CAC_SUPABASE_URL = SUPABASE;
process.env.VITE_CAC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
const output = fileURLToPath(new URL('../test-results/', import.meta.url)); mkdirSync(output, { recursive: true });

const { db, one } = await setup(null);
// The admin "hidden sections" setting no longer affects the navigation; keep it empty.
await db.query(`update cac.setting set value = '' where key = 'hidden_modules'`);
await db.query(`insert into public.leads (name, email, project_type, message) values ('Website visitor', 'visitor@example.invalid', 'Residential pool', 'Please call me about a villa pool.')`);

const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
async function handle(route) {
  const request = route.request();
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const url = new URL(request.url());
  const reply = (status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const token = request.headers().authorization?.replace('Bearer ', '');
  const sub = token?.split('.').length === 3 ? JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub : null;
  if (url.pathname === '/auth/v1/token') {
    const { email, password } = request.postDataJSON();
    const user = await one(`select id, email from auth.users where email = $1 and encrypted_password = extensions.crypt($2, encrypted_password)`, [email, password]);
    if (!user) return reply(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' });
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email, role: 'authenticated', aud: 'authenticated', exp })}.sig`;
    return reply(200, { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh', user: { id: user.id, email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() } });
  }
  if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
  if (url.pathname === '/auth/v1/user' && request.method() === 'PUT') {
    const { password } = request.postDataJSON();
    await db.query(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf', 4)) where id = $1`, [sub, password]);
    const user = await one(`select id, email from auth.users where id = $1`, [sub]);
    return reply(200, { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() });
  }
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    try { return reply(200, await call(db, url.pathname.split('/').pop(), request.postDataJSON() || {}, { user: sub })); }
    catch (error) { return reply(400, { code: error.code, message: error.message, details: null, hint: null }); }
  }
  if (url.pathname === '/functions/v1/cac-worker') {
    await call(db, 'worker_heartbeat', { p_mode: 'demo', p_ai_configured: false }, { role: 'service_role' });
    return reply(200, { processed: (await runAll(serviceClient(db))).length });
  }
  return reply(404, { message: `Not handled by the test: ${url.pathname}` });
}

const vite = await createServer({ configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)), server: { port: 5195, strictPort: false }, logLevel: 'error' });
await vite.listen();
const appUrl = vite.resolvedUrls.local[0];
let browser;
try {
  // CAC_TEST_BROWSER: msedge (default), chrome, or chromium (Playwright's bundled browser, used in CI).
  const channel = process.env.CAC_TEST_BROWSER || 'msedge';
  browser = await chromium.launch({ ...(channel === 'chromium' ? {} : { channel }), headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route(`${SUPABASE}/**`, handle);
  await page.goto(appUrl);
  await page.getByLabel('Email address').fill('admin@cac.test');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await page.getByText('Email or password is incorrect.').first().waitFor();
  await page.getByLabel('Password', { exact: true }).fill('cac-test-password');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await page.getByRole('heading', { name: 'Every quotation, in one place.' }).waitFor();
  await page.screenshot({ path: `${output}quotations-desktop.png`, fullPage: true, animations: 'disabled' });

  // Only Quotations, Drawings vault and Settings are in the navigation; every other section is hidden.
  const nav = await page.locator('aside.sidebar nav button').allInnerTexts();
  assert.deepEqual(nav.map(t => t.trim()), ['Quotations', 'Drawings vault', 'Settings']);
  assert.equal(await page.getByRole('button', { name: 'Pending approvals' }).count(), 0);

  // Quotations: the list loads and the builder opens.
  await page.getByRole('button', { name: 'Build quotation' }).click();
  const quoteDialog = page.getByRole('dialog');
  await quoteDialog.getByRole('heading', { name: 'Build a quotation' }).waitFor();
  await quoteDialog.getByRole('button', { name: 'Cancel' }).click(); await quoteDialog.waitFor({ state: 'hidden' });

  // Drawings vault: create a drawing for an opportunity; its sheet offers the first revision.
  await page.locator('aside.sidebar').getByRole('button', { name: 'Drawings vault' }).click();
  await page.getByRole('button', { name: 'New drawing' }).click();
  const drawingDialog = page.getByRole('dialog', { name: 'New drawing' });
  await drawingDialog.getByLabel('Title', { exact: true }).fill('Pool general arrangement');
  await drawingDialog.getByLabel('Discipline', { exact: true }).selectOption('Structural (RCC)');
  await drawingDialog.getByLabel('Opportunity', { exact: true }).selectOption({ label: 'Sahyadri · resort pool' });
  await drawingDialog.getByRole('button', { name: 'Create drawing' }).click();
  await page.getByRole('dialog', { name: 'Pool general arrangement' }).getByText('Upload R0').waitFor();
  await page.screenshot({ path: `${output}drawing.png`, fullPage: false, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Pool general arrangement' }).getByRole('button', { name: 'Close dialog' }).click();
  assert.match((await one(`select number from cac.drawing`)).number, /^DRG\/\d{2}-\d{2}\/0001$/);

  // Settings keeps only the account and staff management.
  await page.locator('aside.sidebar').getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('heading', { name: 'My account' }).waitFor();
  await page.getByRole('heading', { name: 'People & permissions' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Workspace sections' }).count(), 0);

  // Mobile layout.
  await page.locator('aside.sidebar').getByRole('button', { name: 'Quotations' }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}quotations-mobile.png`, fullPage: true, animations: 'disabled' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile page should not overflow horizontally');
  assert.ok(await page.locator('aside.sidebar').evaluate(el => el.getBoundingClientRect().right <= 1), 'Mobile navigation should be offscreen when closed');
  await page.getByRole('button', { name: 'Open navigation' }).click(); await page.locator('aside.sidebar').getByRole('button', { name: 'Drawings vault' }).click();
  await page.getByRole('heading', { name: 'Every drawing, every revision, checked.' }).waitFor();

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('aside.sidebar').getByTitle('Sign out').click();
  await page.getByRole('button', { name: 'Enter workspace' }).waitFor();

  // A new staff member with a temporary password must choose their own before using CAC.
  await db.query(`select cac.ensure_staff('new.staff@cac.test', 'New staff', 'sales', 'temporary-pass-123')`);
  await page.getByLabel('Email address').fill('new.staff@cac.test');
  await page.getByLabel('Password', { exact: true }).fill('temporary-pass-123');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await page.getByRole('heading', { name: /Choose your\s*own password/ }).waitFor();
  await page.getByLabel('New password (12+ characters)').fill('my-own-password-456');
  await page.getByLabel('Repeat new password').fill('my-own-password-456');
  await page.getByRole('button', { name: 'Save password' }).click();
  await page.getByRole('heading', { name: 'Every quotation, in one place.' }).waitFor();
  assert.equal((await one(`select must_change_password from cac.staff where email = 'new.staff@cac.test'`)).must_change_password, false);
  assert.deepEqual(errors, []);
  console.log('Browser smoke passed: sign-in (incl. wrong password), only Quotations + Drawings vault + Settings shown, quotation builder opens, drawing created, settings trimmed, mobile navigation, sign-out, forced password change.');
  console.log(`Screenshots: ${output}`);
} catch (error) {
  // Keep evidence for CI and local debugging.
  for (const p of browser?.contexts().flatMap(c => c.pages()) || []) await p.screenshot({ path: `${output}failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  await vite.close();
  await db.close();
}
