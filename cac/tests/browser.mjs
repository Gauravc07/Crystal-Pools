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
import { report } from './helpers/xlsx.mjs';
import { runAll } from '../supabase/functions/_shared/worker.js';

const SUPABASE = 'http://fake-supabase.test';
process.env.VITE_CAC_SUPABASE_URL = SUPABASE;
process.env.VITE_CAC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
const output = fileURLToPath(new URL('../test-results/', import.meta.url)); mkdirSync(output, { recursive: true });

const { db, one } = await setup(null);
// Show every section so the whole app is exercised; hiding one is tested below.
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
  await page.getByRole('heading', { name: 'A clearer path to your next project.' }).waitFor();
  await page.getByRole('heading', { name: 'What needs attention' }).waitFor();
  await page.screenshot({ path: `${output}dashboard-desktop.png`, fullPage: true, animations: 'disabled' });

  for (const label of ['My work', 'Prospect discovery', 'Lead inbox', 'Project leads', 'Sales pipeline', 'Outreach', 'Appointments', 'Approvals', 'Agent studio', 'Customers & sites', 'Surveys & quotes', 'Projects', 'Drawings vault', 'Warehouse & inventory', 'Maintenance', 'Lifecycle lists', 'Reviews', 'Tasks & activity', 'Reports', 'Approved library', 'Audit trail', 'Settings']) {
    await page.locator('aside.sidebar').getByRole('button', { name: label, exact: label !== 'Approvals' }).click(); await page.locator('main h1').waitFor();
  }
  await page.getByText('Not in this Supabase project').or(page.getByText('Available · import from Lead inbox')).first().waitFor();

  // Website enquiry wiring: public.leads → lead inbox, once.
  await page.locator('aside.sidebar').getByRole('button', { name: 'Lead inbox' }).click();
  await page.getByRole('button', { name: 'Import website enquiries' }).click();
  await page.getByText('1 website enquiry added to the inbox.').waitFor();
  await page.getByRole('button', { name: 'Website visitor · Residential pool' }).waitFor();

  // Project lead report: upload → worker reads it → leads with follow-ups; log a call and comment.
  await page.locator('aside.sidebar').getByRole('button', { name: 'Project leads' }).click();
  await page.locator('input[type=file][accept^=".xlsx"]').setInputFiles({ name: 'pune-report.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(report()) });
  await page.getByText('Report received.').waitFor();
  await page.getByRole('button', { name: 'NEEL PRABHA', exact: true }).click({ timeout: 20000 });
  await page.getByText('Call the purchase manager: pool and tile decisions are close · NEEL PRABHA').waitFor();
  await page.getByRole('button', { name: 'Log call or visit' }).click();
  const callDialog = page.getByRole('dialog', { name: 'Log a call or visit' });
  await callDialog.getByLabel('Outcome').selectOption('Reached');
  await callDialog.getByLabel('Notes').fill('Spoke to the director; pool tender next month.');
  await callDialog.getByRole('button', { name: 'Save changes' }).click(); await callDialog.waitFor({ state: 'hidden' });
  await page.getByText(/Logged\. Next follow-up/).waitFor();
  await page.getByLabel('Add a comment').fill('Send the clubhouse pool portfolio before the call.');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await page.locator('.comment', { hasText: 'Send the clubhouse pool portfolio' }).waitFor();
  await page.screenshot({ path: `${output}project-lead.png`, fullPage: true, animations: 'disabled' });
  await page.keyboard.press('Escape');
  assert.equal((await one(`select count(*)::int as n from cac.project_lead`)).n, 3);
  assert.equal((await one(`select status from cac.project_lead where name = 'NEEL PRABHA'`)).status, 'Contacted');
  assert.equal((await one(`select count(*)::int as n from cac.comment c join cac.project_lead l on l.id = c.target_id where l.name = 'NEEL PRABHA'`)).n, 2);
  await page.screenshot({ path: `${output}project-leads.png`, fullPage: true, animations: 'disabled' });

  // Create an enquiry through the form (owner is a staff id).
  await page.locator('aside.sidebar').getByRole('button', { name: 'Overview', exact: true }).click(); await page.getByRole('button', { name: 'New enquiry', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Opportunity name', { exact: true }).fill('Browser test opportunity');
  await dialog.getByLabel('Customer', { exact: true }).selectOption({ label: 'Sahyadri Retreat (demo)' });
  await dialog.getByLabel('Site', { exact: true }).selectOption({ label: 'Lonavala resort · west garden' });
  await dialog.getByLabel('Customer route', { exact: true }).selectOption('Commercial');
  await dialog.getByLabel('Enquiry source', { exact: true }).selectOption('Phone');
  await dialog.getByLabel('Staff owner', { exact: true }).selectOption({ label: 'Pilot owner' });
  await dialog.getByRole('button', { name: 'Save changes' }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.ok(await one(`select id from cac.opportunity where name = 'Browser test opportunity'`));

  // Contextual follow-up runs through the queue and the worker function.
  await page.getByRole('button', { name: /Keep the conversation moving/ }).click();
  const run = page.getByRole('dialog');
  await run.getByLabel('Select opportunity').selectOption({ label: 'Sahyadri · resort pool' });
  await run.getByRole('button', { name: 'Use the heating + December example' }).click();
  await run.getByRole('button', { name: 'Run workflow', exact: true }).click(); await run.waitFor({ state: 'hidden' });
  await page.locator('aside.sidebar').getByRole('button', { name: 'Agent studio' }).click();
  await page.getByText('waiting approval', { exact: true }).waitFor({ timeout: 15000 });
  assert.equal((await one('select heating_requested from cac.revision')).heating_requested, true);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${output}agent-studio.png`, fullPage: true, animations: 'disabled' });

  await page.locator('aside.sidebar').getByRole('button', { name: 'Approvals' }).click();
  await page.getByRole('button', { name: 'Review', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.ok((await one(`select count(*)::int as n from cac.approval where status = 'approved'`)).n >= 1);

  // Manual sending: staff send the approved reply themselves, then record it.
  await page.locator('aside.sidebar').getByRole('button', { name: 'Outreach' }).click();
  await page.getByRole('button', { name: /Contextual follow-up · Sahyadri/ }).first().click();
  await page.getByRole('link', { name: 'Open email' }).waitFor();
  await page.getByRole('button', { name: 'Record as sent' }).click();
  const sendDialog = page.getByRole('dialog', { name: 'Record how it was sent' });
  await sendDialog.getByLabel('Sent by').selectOption('Email');
  await sendDialog.getByRole('button', { name: 'Save changes' }).click(); await sendDialog.waitFor({ state: 'hidden' });
  await page.getByText(/Sent by Email/).waitFor();
  await page.keyboard.press('Escape');
  assert.equal((await one(`select sent_channel from cac.draft where agent = 'followup' and status = 'approved'`)).sent_channel, 'Email');

  // Lifecycle list → follow-up tasks (seed AMC renews in 25 days).
  await page.locator('aside.sidebar').getByRole('button', { name: 'Lifecycle lists' }).click();
  await page.locator('.lifecycle-card', { hasText: 'AMC renewals in 30 days' }).getByRole('button', { name: 'Create follow-up tasks' }).click();
  await page.getByText('1 follow-up task created.').waitFor();
  assert.equal((await one(`select count(*)::int as n from cac.task where lifecycle_key like 'amc_renewal:%'`)).n, 1);

  // Owner assistant: question → worker → plan in Approvals → approval creates tasks.
  await page.locator('aside.sidebar').getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByLabel('Question for the owner assistant').fill('What is slipping this week?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.getByText('Working on it.').waitFor();
  await page.locator('aside.sidebar').getByRole('button', { name: 'Approvals' }).click();
  await page.locator('.review-card', { hasText: 'Owner assistant' }).getByRole('button', { name: 'Review' }).click({ timeout: 15000 });
  await page.getByRole('dialog').getByText('Plan for: What is slipping this week?').first().waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.ok((await one(`select count(*)::int as n from cac.task where category = 'operator'`)).n >= 1);

  // Book and confirm a site visit from the opportunity.
  await page.locator('aside.sidebar').getByRole('button', { name: 'Sales pipeline' }).click();
  await page.getByRole('button', { name: /Meadow · private pool/ }).click();
  await page.getByRole('button', { name: 'Book appointment' }).click();
  const booking = page.getByRole('dialog', { name: 'New appointment' });
  await booking.getByLabel('Appointment type', { exact: true }).selectOption('Site visit');
  await booking.getByLabel('Date and time', { exact: true }).fill(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) + 'T11:00');
  await booking.getByRole('button', { name: 'Save changes' }).click(); await booking.waitFor({ state: 'hidden' });
  await page.keyboard.press('Escape');
  await page.locator('aside.sidebar').getByRole('button', { name: 'Appointments' }).click();
  await page.locator('.agenda-item', { hasText: 'Consultation · Meadow' }).waitFor();
  await page.locator('table').getByRole('button', { name: /Consultation · Meadow/ }).click();
  await page.getByRole('button', { name: 'Customer confirmed' }).click();
  await page.getByText('Appointment confirmed.').waitFor();
  await page.keyboard.press('Escape');
  assert.equal((await one(`select visit_confirmed from cac.opportunity where name = 'Meadow · private pool'`)).visit_confirmed, true);

  // Warehouse & inventory: add an item through the form; it appears in Items and Stock.
  await page.locator('aside.sidebar').getByRole('button', { name: 'Warehouse & inventory' }).click();
  await page.locator('.tabs').getByRole('button', { name: /^Items/ }).click();
  await page.getByRole('button', { name: 'Add item' }).click();
  const itemDialog = page.getByRole('dialog', { name: 'Add item' });
  await itemDialog.getByLabel('Item name', { exact: true }).fill('Pool pump 1 HP');
  await itemDialog.getByLabel('SKU (code)', { exact: true }).fill('pmp-10');
  await itemDialog.getByLabel('Category', { exact: true }).selectOption('Filtration & pumps');
  await itemDialog.getByLabel('Unit', { exact: true }).selectOption('nos');
  await itemDialog.getByLabel('Reorder level', { exact: true }).fill('2');
  await itemDialog.getByRole('button', { name: 'Save' }).click(); await itemDialog.waitFor({ state: 'hidden' });
  await page.getByText('PMP-10').first().waitFor();
  await page.locator('.tabs').getByRole('button', { name: /^Stock\s*\d+$/ }).click();
  await page.getByText('Pool pump 1 HP').first().waitFor();
  await page.screenshot({ path: `${output}inventory.png`, fullPage: true, animations: 'disabled' });
  assert.equal((await one(`select sku from cac.inv_item where name = 'Pool pump 1 HP'`)).sku, 'PMP-10');

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

  // Sections an admin hides leave the navigation (records are kept).
  await page.locator('aside.sidebar').getByRole('button', { name: 'Settings' }).click();
  await page.locator('.section-toggles label', { hasText: 'Lifecycle lists' }).locator('input').click();
  await page.getByText('Workspace sections updated.').waitFor();
  assert.equal(await page.locator('aside.sidebar').getByRole('button', { name: 'Lifecycle lists' }).count(), 0);
  await page.locator('aside.sidebar').getByRole('button', { name: 'Agent studio' }).click();
  await page.getByRole('heading', { name: 'How the assistants run' }).waitFor();
  await page.getByText('Free rules: no AI credits are used').waitFor();

  // Admin business settings and reports.
  await page.locator('aside.sidebar').getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Google review link').fill('https://g.page/r/crystal-pools/review');
  await page.getByRole('button', { name: 'Save link' }).click(); await page.getByText('Review link saved.').waitFor();
  await page.locator('aside.sidebar').getByRole('button', { name: 'Reports' }).click();
  await page.getByRole('heading', { name: 'Conversion by enquiry source' }).waitFor();
  await page.screenshot({ path: `${output}reports.png`, fullPage: true, animations: 'disabled' });

  await page.locator('aside.sidebar').getByRole('button', { name: 'Overview', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}dashboard-mobile.png`, fullPage: true, animations: 'disabled' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile page should not overflow horizontally');
  assert.ok(await page.locator('aside.sidebar').evaluate(el => el.getBoundingClientRect().right <= 1), 'Mobile navigation should be offscreen when closed');
  await page.getByRole('button', { name: 'Open navigation' }).click(); await page.locator('aside.sidebar').getByRole('button', { name: 'Prospect discovery' }).click();
  await page.getByRole('heading', { name: 'Prospects', exact: true }).waitFor();

  await page.locator('aside.sidebar').getByRole('button', { name: 'Open navigation' }).or(page.getByRole('button', { name: 'Open navigation' })).first().click();
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
  await page.getByRole('heading', { name: 'A clearer path to your next project.' }).waitFor();
  assert.equal((await one(`select must_change_password from cac.staff where email = 'new.staff@cac.test'`)).must_change_password, false);
  assert.deepEqual(errors, []);
  console.log('Browser smoke passed: sign-in (incl. wrong password), forced password change, 22 sections, inventory item, drawing, project lead report upload + call log + comment, manual sending, lifecycle tasks, owner assistant plan → tasks, appointment booking + confirmation, review link setting, reports, website enquiry import, enquiry creation, queued workflow + worker, approval, mobile navigation, sign-out.');
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
