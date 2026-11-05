// End-to-end smoke test of the real staff app against the real CAC SQL.
// Playwright answers the app's Supabase requests (Auth and PostgREST RPC) from
// an in-process PGlite database, so no Supabase project or network access is
// needed. Screenshots and a sample proposal PDF go to cac/test-results/.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { setup, call } from './helpers/db.mjs';

const SUPABASE = 'http://fake-supabase.test';
process.env.VITE_CAC_SUPABASE_URL = SUPABASE;
process.env.VITE_CAC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
const output = fileURLToPath(new URL('../test-results/', import.meta.url)); mkdirSync(output, { recursive: true });

const { db, one } = await setup(null);

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
  const navTexts = async () => (await page.locator('aside.sidebar nav button').allInnerTexts()).map(t => t.trim());
  const signIn = async (email, password) => { await page.getByLabel('Email address').fill(email); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Enter workspace' }).click(); };
  const signOut = async () => { await page.locator('aside.sidebar').getByTitle('Sign out').click(); await page.getByRole('button', { name: 'Enter workspace' }).waitFor(); };
  const sidebar = name => page.locator('aside.sidebar').getByRole('button', { name });

  // Admin: wrong password, then the workspace with only Quotations, Requirements, Drawings vault and Settings.
  await page.goto(appUrl);
  await signIn('admin@cac.test', 'wrong-password');
  await page.getByText('Email or password is incorrect.').first().waitFor();
  await signIn('admin@cac.test', 'cac-test-password');
  await page.getByRole('heading', { name: 'Every quotation, in one place.' }).waitFor();
  assert.deepEqual(await navTexts(), ['Quotations', 'Requirements', 'Drawings vault', 'Settings']);
  await page.getByText('No FRP proposals yet.').waitFor();
  await page.screenshot({ path: output + 'quotations-desktop.png', fullPage: true, animations: 'disabled' });

  // Settings: account, staff, FRP price list. Confirm the prices and add a field staff login.
  await sidebar('Settings').click();
  await page.getByRole('heading', { name: 'My account' }).waitFor();
  await page.getByRole('heading', { name: 'People & permissions' }).waitFor();
  await page.getByRole('heading', { name: 'FRP price list' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + 'frp-price-list.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Save and confirm prices' }).click();
  await page.getByText('FRP price list saved and confirmed.').first().waitFor();
  await page.getByRole('button', { name: 'Add staff member' }).click();
  const staffDialog = page.getByRole('dialog', { name: 'Add staff member' });
  await staffDialog.getByLabel('Full name').fill('Sagar Kale');
  await staffDialog.getByLabel('Email').fill('sagar@cac.test');
  await staffDialog.getByLabel(/Initial password/).fill('temporary-pass-123');
  await staffDialog.getByLabel('Role').selectOption('field');
  await staffDialog.getByRole('button', { name: 'Add staff member' }).click();
  await page.getByText('Staff member added.').first().waitFor();
  assert.equal((await one(`select role from cac.staff where email = 'sagar@cac.test'`)).role, 'field');

  // Field staff: choose their own password, then see only Requirements.
  await signOut();
  await signIn('sagar@cac.test', 'temporary-pass-123');
  await page.getByRole('heading', { name: /Choose your\s*own password/ }).waitFor();
  await page.getByLabel('New password (12+ characters)').fill('field-password-123');
  await page.getByLabel('Repeat new password').fill('field-password-123');
  await page.getByRole('button', { name: 'Save password' }).click();
  await page.getByRole('heading', { name: 'Every customer visit, ready to quote.' }).waitFor();
  assert.deepEqual(await navTexts(), ['Requirements', 'Settings']);

  // The requirement form, with the agent's live summary (no prices for field staff).
  await page.getByRole('button', { name: 'New requirement' }).click();
  const form = page.getByRole('dialog', { name: 'New requirement' });
  await form.getByLabel('Customer name').fill('Mr Nilesh Shukla');
  await form.getByLabel('Phone').fill('98220 12345');
  await form.getByLabel('Site location (town or city)').fill('Mahabaleshwar');
  await form.getByLabel('Referred by (optional)').fill('Architect Mehta');
  await form.getByLabel('Length (ft)').fill('30');
  await form.getByLabel('Width (ft)').fill('12');
  await form.getByLabel('Depth (ft)').fill('4.4');
  await form.getByText('729.6 sq ft').waitFor();
  await form.getByText('4 ft deep · 41,760 L').waitFor();
  await form.getByText('650Ø · 100 kg · 2 hp').waitFor();
  assert.equal(await form.getByText('Package price from the FRP price list').count(), 0, 'Field staff do not see prices');
  await form.screenshot({ path: output + 'frp-requirement-form.png', animations: 'disabled' });
  await form.getByRole('button', { name: 'Submit requirement' }).click();
  await page.getByText(/The FRP quotation agent prepared FRP\/SK\/\d{2}\/[A-Z][a-z]{2}\/01 for approval/).first().waitFor();
  const reqSheet = page.getByRole('dialog', { name: 'Mr Nilesh Shukla' });
  await reqSheet.getByText('Waiting for approval').first().waitFor();
  await reqSheet.getByRole('button', { name: 'Close dialog' }).click();

  // The office approves the agent's proposal and prints it.
  await signOut();
  await signIn('admin@cac.test', 'cac-test-password');
  await page.getByRole('button', { name: /Mr Nilesh Shukla/ }).first().click();
  const sheet = page.getByRole('dialog', { name: /^FRP\/SK\// });
  await sheet.getByText('What the agent did').waitFor();
  await sheet.screenshot({ path: output + 'frp-quotation-review.png', animations: 'disabled' });
  await sheet.getByText('Architect Mehta').waitFor();
  // The office changes a price; the agent regenerates; the office sends it to the site user with a remark.
  await sheet.getByRole('button', { name: 'Edit prices' }).click();
  await sheet.getByLabel('Rate for Installation and testing (labour)').fill('45000');
  await sheet.getByText('You changed 1 price. Regenerate the quotation to apply it, then send it to Sagar Kale with a remark.').waitFor();
  assert.ok(await sheet.getByRole('button', { name: 'Approve and send' }).isDisabled(), 'Approval waits for the regenerated quotation');
  await sheet.screenshot({ path: output + 'frp-edit-prices.png', animations: 'disabled' });
  await sheet.getByRole('button', { name: 'Regenerate quotation' }).click();
  await page.getByText(/regenerated the quotation as FRP\/SK\/.+-R1 at ₹7,23,680 \+ GST/).first().waitFor();
  const regenerated = page.getByRole('dialog', { name: /^FRP\/SK\/.+-R1$/ });
  await regenerated.getByText(/^Changes from FRP\/SK\//).waitFor();
  await regenerated.getByText('Installation and testing (labour): ₹50,000 → ₹45,000 per job').waitFor();
  const remark = regenerated.getByLabel('Remark for Sagar Kale (optional)');
  assert.match(await remark.inputValue(), /Revised: Installation and testing \(labour\)\. Package price ₹7,23,680 \+ GST \(was ₹7,28,680\)\./);
  await remark.fill('Installation reduced to ₹45,000 as agreed with the customer.');
  await regenerated.screenshot({ path: output + 'frp-send-to-site-user.png', animations: 'disabled' });
  await regenerated.getByRole('button', { name: 'Approve and send to Sagar Kale' }).click();
  await page.getByText(/approved and sent to Sagar Kale/).first().waitFor();
  await sheet.getByText('Approved', { exact: true }).first().waitFor();
  await sheet.getByText('Installation reduced to ₹45,000 as agreed with the customer.').waitFor();
  await sheet.getByRole('button', { name: 'Open proposal' }).click();
  const viewer = page.getByRole('dialog', { name: /^Proposal FRP\// });
  await viewer.locator('.fp-page').nth(3).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await viewer.locator('.fp-page').count(), 4);
  assert.equal(await viewer.locator('.fp-draft').count(), 0, 'Approved proposals carry no draft mark');
  await viewer.getByText('₹7,23,680').first().waitFor();
  // Whole A4 pages, without the viewer toolbar.
  await page.setViewportSize({ width: 1440, height: 1300 });
  const hideToolbar = await page.addStyleTag({ content: '.fp-toolbar{visibility:hidden}' });
  for (let i = 0; i < 4; i++) await viewer.locator('.fp-page').nth(i).screenshot({ path: output + 'frp-proposal-page-' + (i + 1) + '.png', animations: 'disabled' });
  const overflow = await viewer.locator('.fp-page').evaluateAll(pages => pages.map(p => Math.max(...[...p.querySelectorAll('*')].filter(el => !el.closest('defs')).map(el => el.getBoundingClientRect().bottom)) - p.getBoundingClientRect().bottom));
  assert.ok(overflow.every(px => px <= 1), 'Proposal content overflows its page: ' + overflow);
  await page.pdf({ path: output + 'frp-proposal.pdf', printBackground: true, preferCSSPageSize: true });
  await hideToolbar.evaluate(el => el.remove());
  await page.setViewportSize({ width: 1440, height: 1050 });
  await viewer.getByRole('button', { name: 'Close proposal' }).click();
  await sheet.getByRole('button', { name: 'Close dialog' }).click();

  // Drawings vault: a drawing for the requirement; its client defaults to the customer and site.
  const requirement = await one(`select number from cac.frp_requirement`);
  await sidebar('Drawings vault').click();
  await page.getByRole('heading', { name: 'Every drawing, every revision, checked.' }).waitFor();
  await page.getByRole('button', { name: 'New drawing' }).click();
  const drawingDialog = page.getByRole('dialog', { name: 'New drawing' });
  await drawingDialog.getByLabel('Title', { exact: true }).fill('FRP shell shop drawing');
  await drawingDialog.getByLabel('Discipline', { exact: true }).selectOption('FRP');
  await drawingDialog.getByLabel('FRP requirement (optional)').selectOption({ label: `${requirement.number} · Mr Nilesh Shukla · Mahabaleshwar` });
  await drawingDialog.getByRole('button', { name: 'Create drawing' }).click();
  const drawingSheet = page.getByRole('dialog', { name: 'FRP shell shop drawing' });
  await drawingSheet.getByText('Upload R0').waitFor();
  await drawingSheet.getByText('Mr Nilesh Shukla · Mahabaleshwar', { exact: true }).waitFor();
  await page.screenshot({ path: output + 'drawing.png', animations: 'disabled' });
  await drawingSheet.getByRole('button', { name: 'Close dialog' }).click();
  assert.match((await one(`select number from cac.drawing`)).number, /^DRG\/\d{2}-\d{2}\/0001$/);
  await page.getByRole('button', { name: 'FRP shell shop drawing' }).waitFor();

  // Mobile layout.
  await sidebar('Quotations').click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: output + 'quotations-mobile.png', fullPage: true, animations: 'disabled' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile page should not overflow horizontally');
  assert.ok(await page.locator('aside.sidebar').evaluate(el => el.getBoundingClientRect().right <= 1), 'Mobile navigation should be offscreen when closed');
  await page.getByRole('button', { name: 'Open navigation' }).click(); await sidebar('Drawings vault').click();
  await page.getByRole('heading', { name: 'Every drawing, every revision, checked.' }).waitFor();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('aside.sidebar').getByTitle('Sign out').click();
  await page.getByRole('button', { name: 'Enter workspace' }).waitFor();

  // Field staff open the approved proposal, and the form works on a phone.
  await signIn('sagar@cac.test', 'field-password-123');
  await page.getByRole('button', { name: /Mr Nilesh Shukla/ }).first().click();
  await page.getByRole('dialog', { name: 'Mr Nilesh Shukla' }).getByText('Remark from the office:').waitFor();
  await page.getByRole('dialog', { name: 'Mr Nilesh Shukla' }).getByText('Installation reduced to ₹45,000 as agreed with the customer.').waitFor();
  await page.getByRole('dialog', { name: 'Mr Nilesh Shukla' }).screenshot({ path: output + 'frp-remark-for-site-user.png', animations: 'disabled' });
  await page.getByRole('dialog', { name: 'Mr Nilesh Shukla' }).getByRole('button', { name: 'Open quotation' }).click();
  await page.getByRole('dialog', { name: /^Proposal FRP\// }).locator('.fp-page').first().waitFor();
  await page.getByRole('button', { name: 'Close proposal' }).click();
  await page.getByRole('dialog', { name: 'Mr Nilesh Shukla' }).getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'New requirement' }).click();
  await page.getByRole('dialog', { name: 'New requirement' }).getByLabel('Length (ft)').waitFor();
  await page.screenshot({ path: output + 'frp-requirement-mobile.png', animations: 'disabled' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Requirement form should not overflow on a phone');
  await page.getByRole('dialog', { name: 'New requirement' }).getByRole('button', { name: 'Cancel' }).click();

  assert.deepEqual(errors, []);
  console.log('Browser smoke passed: sign-in (incl. wrong password), Quotations + Requirements + Drawings vault + Settings only, price list confirmation, field staff added from Settings with a forced password change, requirement form with "Referred by" and the agent summary, office price edit, regeneration, approval sent with a remark, 4-page proposal and PDF, drawing linked to a requirement, mobile layouts.');
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
