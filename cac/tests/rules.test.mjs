import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, as, call } from './helpers/db.mjs';
import { parseCsv } from '../src/schema.js';

const quoteInput = ids => ({ opportunity_id: ids.opportunity, survey_id: ids.survey, items: [{ rate_id: ids.rate, quantity: 2.5 }], scope: 'Test scope', exclusions: 'Heating excluded', terms: 'Test terms' });

test('quote totals round each line to paise, including decimal quantities', async t => {
  const { db } = await setup(t, { seed: false });
  const totals = (await db.query(`select cac.quote_totals($1) as r`, [JSON.stringify([{ price: 99.99, tax: 18, quantity: 2.5 }])])).rows[0].r;
  assert.deepEqual(totals, { items: [{ price: 99.99, tax: 18, quantity: 2.5, subtotal: 249.98, tax_amount: 45, total: 294.98 }], subtotal: 249.98, tax: 45, total: 294.98 });
  await assert.rejects(db.query(`select cac.quote_totals($1)`, [JSON.stringify([{ price: 100, tax: 18, quantity: -1 }])]), /quantities/);
});

test('staff can read but never write tables directly; non-staff see nothing', async t => {
  const { db, admin, rpc } = await setup(t);
  await assert.rejects(as(db, { user: admin }, tx => tx.query(`insert into cac.customer (name) values ('Direct write')`)), /permission denied/);
  await assert.rejects(as(db, { user: admin }, tx => tx.query(`update cac.quote set total = 1`)), /permission denied/);
  assert.equal((await as(db, { user: admin }, tx => tx.query('select count(*)::int as n from cac.customer'))).rows[0].n, 2);
  // A website admin (auth user without a cac.staff row) gets no rows and no workspace.
  await db.query(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'website@admin.test')`);
  const outsider = '00000000-0000-0000-0000-0000000000aa';
  assert.equal((await as(db, { user: outsider }, tx => tx.query('select count(*)::int as n from cac.customer'))).rows[0].n, 0);
  await assert.rejects(call(db, 'workspace_state', {}, { user: outsider }), /active staff account/);
  await assert.rejects(call(db, 'workspace_state', {}, { role: 'anon' }), /permission denied/);
  // Worker functions are service-role only.
  await assert.rejects(call(db, 'claim_job', {}, { user: admin }), /permission denied/);
  // Internal helpers (which skip role checks) are not callable at all.
  await assert.rejects(call(db, 'put', { p_kind: 'customer', p_values: { name: 'Bypass' } }, { user: admin }), /permission denied for function/);
  await assert.rejects(call(db, 'write_record_as', { p_user: admin, p_kind: 'customer', p_values: { name: 'Bypass' } }, { user: admin }), /permission denied for function/);
  assert.equal((await rpc('viewer', 'workspace_state')).user.role, 'viewer');
});

test('role enforcement and approval fields cannot be written through generic records', async t => {
  const { ids, rpc, one } = await setup(t);
  await assert.rejects(rpc('viewer', 'write_record', { p_kind: 'customer', p_values: { name: 'Forbidden' } }), /role/);
  const rate = await rpc('commercial', 'write_record', { p_kind: 'rate', p_values: { name: 'Unapproved heater', unit: 'each', price: 100, tax: 18, scope: 'Test', status: 'approved' } });
  assert.equal(rate.status, 'draft');
  await assert.rejects(rpc('commercial', 'create_quote', { p_input: { ...quoteInput(ids), items: [{ rate_id: rate.id, quantity: 1 }] } }), /approved rates/);
  await assert.rejects(rpc('commercial', 'write_record', { p_kind: 'rate', p_values: { price: 1 }, p_id: ids.rate }), /immutable/);
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'customer', p_values: { name: 'Bad', segment: 'Spaceport' } }), /Segment has an invalid value/);
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'opportunity', p_values: { budget: 'lots' }, p_id: ids.opportunity }), /budget must be a valid/);
  assert.equal((await one(`select count(*)::int as n from cac.rate where name = 'Unapproved heater' and status = 'draft'`)).n, 1);
});

test('quote scope and price require separate role reviews; revisions preserve the original', async t => {
  const { ids, rpc, one } = await setup(t);
  const quote = await rpc('engineer', 'create_quote', { p_input: quoteInput(ids) });
  assert.equal(quote.version, 2); assert.equal(quote.status, 'pending'); assert.equal(Number(quote.total), 42775);
  const engineering = await one(`select id from cac.approval where target_id = $1`, [quote.id]);
  await assert.rejects(rpc('sales', 'decide', { p_approval: engineering.id, p_decision: 'approved' }), /role/);
  await rpc('engineer', 'decide', { p_approval: engineering.id, p_decision: 'approved' });
  assert.equal((await one(`select status from cac.quote where id = $1`, [quote.id])).status, 'pending');
  const commercial = await one(`select id from cac.approval where target_id = $1 and type = 'quote_commercial'`, [quote.id]);
  await rpc('commercial', 'decide', { p_approval: commercial.id, p_decision: 'approved' });
  assert.equal((await one(`select status from cac.quote where id = $1`, [quote.id])).status, 'approved');
  const next = await rpc('commercial', 'create_quote', { p_input: { ...quoteInput(ids), previous_id: quote.id } });
  assert.equal(next.version, 3); assert.equal(next.previous_id, quote.id);
  assert.equal(Number((await one(`select total from cac.quote where id = $1`, [quote.id])).total), Number(quote.total));
  await assert.rejects(rpc('admin', 'decide', { p_approval: commercial.id, p_decision: 'approved' }), /already been/);
});

test('a stale approval cannot approve changed evidence but can be rejected', async t => {
  const { rpc, one, db } = await setup(t);
  const prospect = await one(`select id from cac.prospect where name = 'Studio Terrain (demo)'`);
  const review = await rpc('sales', 'submit_record', { p_kind: 'prospect', p_id: prospect.id });
  await db.query(`update cac.prospect set evidence = 'Changed source' where id = $1`, [prospect.id]);
  await assert.rejects(rpc('sales', 'decide', { p_approval: review.id, p_decision: 'approved' }), /changed/);
  await assert.rejects(rpc('sales', 'decide', { p_approval: review.id, p_decision: 'rejected' }), /reason/);
  assert.equal((await rpc('sales', 'decide', { p_approval: review.id, p_decision: 'rejected', p_note: 'Source changed; resubmit.' })).status, 'rejected');
});

test('won stage is blocked without a recorded agreement and verified advance', async t => {
  const { ids, rpc } = await setup(t);
  await assert.rejects(rpc('sales', 'transition', { p_opportunity: ids.opportunity, p_stage: 'Won' }), /agreement ref is required/);
  await rpc('sales', 'write_record', { p_kind: 'opportunity', p_values: { agreement_ref: 'WO-001' }, p_id: ids.opportunity });
  await assert.rejects(rpc('sales', 'transition', { p_opportunity: ids.opportunity, p_stage: 'Won' }), /advance/);
  const payment = await rpc('commercial', 'write_record', { p_kind: 'payment', p_values: { name: 'Advance', opportunity_id: ids.opportunity, amount: 50000, reference: 'BANK-TEST', received_on: '2026-10-09' } });
  const review = await rpc('commercial', 'submit_record', { p_kind: 'payment', p_id: payment.id });
  await rpc('commercial', 'decide', { p_approval: review.id, p_decision: 'approved' });
  assert.equal((await rpc('sales', 'transition', { p_opportunity: ids.opportunity, p_stage: 'Won' })).stage, 'Won');
  // Handover now possible, and projects need a won opportunity.
  await assert.rejects(rpc('project', 'write_record', { p_kind: 'project', p_values: { name: 'Too early', opportunity_id: (await rpc('sales', 'workspace_state')).records.opportunity.find(o => o.stage !== 'Won').id } }), /won opportunity/);
  assert.ok((await rpc('project', 'write_record', { p_kind: 'project', p_values: { name: 'Resort build', opportunity_id: ids.opportunity } })).id);
});

test('early stages require a human response, qualification review and a confirmed visit', async t => {
  const { ids, rpc } = await setup(t);
  const opp = ids.villaOpportunity;
  await assert.rejects(rpc('sales', 'transition', { p_opportunity: opp, p_stage: 'Contacted' }), /human response/);
  await rpc('sales', 'write_record', { p_kind: 'activity', p_values: { name: 'Called owner', opportunity_id: opp, type: 'Human response' } });
  assert.equal((await rpc('sales', 'transition', { p_opportunity: opp, p_stage: 'Contacted' })).stage, 'Contacted');
  await assert.rejects(rpc('sales', 'transition', { p_opportunity: opp, p_stage: 'Qualified' }), /decision maker is required/);
  await rpc('sales', 'write_record', { p_kind: 'opportunity', p_values: { decision_maker: 'Owner' }, p_id: opp });
  await assert.rejects(rpc('sales', 'transition', { p_opportunity: opp, p_stage: 'Qualified' }), /approve qualification/);
  await assert.rejects(rpc('sales', 'transition', { p_opportunity: opp, p_stage: 'Lost' }), /loss reason is required/);
});

test('website dedupe, site ownership and residential research restrictions', async t => {
  const { ids, rpc } = await setup(t);
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'prospect', p_values: { name: 'Copy', segment: 'Hotel', location: 'Pune', website: 'https://www.canopy.example.invalid/about' } }), /already exists/);
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'prospect', p_values: { name: 'Person', website: 'https://example.com', location: 'Pune', segment: 'Residential' } }), /commercial organisations/);
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'prospect', p_values: { name: 'Insecure', website: 'http://example.com', location: 'Pune', segment: 'Hotel' } }), /HTTPS/);
  const other = (await rpc('sales', 'workspace_state')).records.customer.find(c => c.id !== ids.customer);
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'opportunity', p_values: { customer_id: other.id }, p_id: ids.opportunity }), /Site must belong|cannot change/);
});

test('qualification changes invalidate review and downstream site changes are rejected', async t => {
  const { ids, rpc } = await setup(t);
  // The app saves the whole record; unchanged values (e.g. 2400000 vs 2400000.00) keep the review.
  const current = (await rpc('sales', 'workspace_state')).records.opportunity.find(o => o.id === ids.opportunity);
  const resaved = await rpc('sales', 'write_record', { p_kind: 'opportunity', p_values: { ...current, budget: 2400000, next_action: 'Call Tuesday' }, p_id: ids.opportunity });
  assert.equal(resaved.qualification_reviewed, true); assert.equal(resaved.stage, 'Estimate sent');
  const updated = await rpc('sales', 'write_record', { p_kind: 'opportunity', p_values: { budget: 3000000 }, p_id: ids.opportunity });
  assert.equal(updated.qualification_reviewed, false);
  const notes = await rpc('sales', 'write_record', { p_kind: 'opportunity', p_values: { notes: 'Only notes changed' }, p_id: ids.villaOpportunity });
  assert.equal(notes.qualification_reviewed, false);
  const site = await rpc('sales', 'write_record', { p_kind: 'site', p_values: { name: 'Second site', customer_id: ids.customer, location: 'Pune' } });
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'opportunity', p_values: { site_id: site.id }, p_id: ids.opportunity }), /cannot change/);
});

test('approved changes create a billing task and invoice recording closes it', async t => {
  const { ids, rpc, one, db, admin } = await setup(t);
  const project = (await db.query(`select cac.put('project', jsonb_build_object('name', 'Test project', 'opportunity_id', $1::uuid, 'created_by', $2::uuid)) as p`, [ids.opportunity, admin])).rows[0].p;
  const change = await rpc('project', 'write_record', { p_kind: 'change', p_values: { name: 'Approved additional works', project_id: project.id, scope: 'Test scope', amount: 1000, customer_approval: 'CUSTOMER-TEST' } });
  assert.equal(change.billing_status, 'Not billed');
  await assert.rejects(rpc('commercial', 'bill_change', { p_change: change.id, p_invoice_ref: 'INV-TEST' }), /Approve the change/);
  const review = await rpc('project', 'submit_record', { p_kind: 'change', p_id: change.id });
  await rpc('project', 'decide', { p_approval: review.id, p_decision: 'approved' });
  assert.equal((await one(`select status from cac.task where change_id = $1`, [change.id])).status, 'open');
  assert.equal((await rpc('commercial', 'bill_change', { p_change: change.id, p_invoice_ref: 'INV-TEST' })).billing_status, 'Billed');
  assert.equal((await one(`select status from cac.task where change_id = $1`, [change.id])).status, 'completed');
  await assert.rejects(rpc('commercial', 'bill_change', { p_change: change.id, p_invoice_ref: 'INV-2' }), /already has/);
});

test('unapproved drafts and opted-out customers cannot be simulated', async t => {
  const { ids, rpc, db } = await setup(t);
  const draft = (await db.query(`select cac.put('draft', jsonb_build_object('name','Pending draft','agent','followup','target_id',$1::uuid,'target_kind','opportunity','opportunity_id',$1::uuid,'body','Hi','status','pending')) as d`, [ids.opportunity])).rows[0].d;
  await assert.rejects(rpc('sales', 'simulate_delivery', { p_kind: 'draft', p_id: draft.id }), /Approval is required/);
  await db.query(`update cac.customer set suppressed = true where id = $1`, [ids.customer]);
  await assert.rejects(rpc('sales', 'simulate_delivery', { p_kind: 'quote', p_id: ids.quote }), /opted out/);
});

test('simulating an approved quote is idempotent and schedules one follow-up', async t => {
  const { ids, rpc, db, one } = await setup(t);
  await db.query(`update cac.quote set simulated_at = null where id = $1`, [ids.quote]);
  const first = await rpc('commercial', 'simulate_delivery', { p_kind: 'quote', p_id: ids.quote });
  const again = await rpc('commercial', 'simulate_delivery', { p_kind: 'quote', p_id: ids.quote });
  assert.equal(first.simulated_at, again.simulated_at);
  assert.equal((await one(`select count(*)::int as n from cac.task where opportunity_id = $1 and name like 'Follow up on approved%'`, [ids.opportunity])).n, 1);
  assert.equal((await one(`select count(*)::int as n from cac.event where action = 'delivery.simulated' and detail->>'externalSend' = 'false'`)).n, 1);
});

test('survey photos: storage policy, registration from Storage metadata, immutable after verification', async t => {
  const { ids, rpc, db, staff, one } = await setup(t);
  const survey = await rpc('engineer', 'write_record', { p_kind: 'survey', p_values: { name: 'Photo survey', opportunity_id: ids.opportunity } });
  const path = `${survey.id}/a1b2c3.png`;
  const upload = (user, name, mime = 'image/png') => as(db, { user }, tx => tx.query(`insert into storage.objects (bucket_id, name, metadata) values ('cac-survey-photos', $1, $2)`, [name, JSON.stringify({ mimetype: mime, size: 2048 })]));
  await assert.rejects(upload(staff.sales, path), /row-level security/);
  await assert.rejects(upload(staff.engineer, `${survey.id}/../escape.png`), /row-level security/);
  await assert.rejects(upload(staff.engineer, `${ids.survey}/x.png`), /row-level security/); // verified survey
  await upload(staff.engineer, path);
  await assert.rejects(rpc('engineer', 'register_photo', { p_survey: survey.id, p_path: `${survey.id}/missing.png`, p_name: 'missing.png' }), /Upload the photo/);
  const attachment = await rpc('engineer', 'register_photo', { p_survey: survey.id, p_path: path, p_name: 'pool-edge.png' });
  assert.equal(attachment.mime, 'image/png'); assert.equal(attachment.size, 2048);
  assert.match((await one(`select photos from cac.survey where id = $1`, [survey.id])).photos, /pool-edge\.png/);
  await upload(staff.engineer, `${survey.id}/svg1.png`, 'image/svg+xml');
  await assert.rejects(rpc('engineer', 'register_photo', { p_survey: survey.id, p_path: `${survey.id}/svg1.png`, p_name: 'bad.svg' }), /PNG, JPEG or WebP/);
  await db.query(`update cac.survey set status = 'verified' where id = $1`, [survey.id]);
  await assert.rejects(upload(staff.engineer, `${survey.id}/later.png`), /row-level security/);
  await assert.rejects(rpc('engineer', 'register_photo', { p_survey: survey.id, p_path: path, p_name: 'again.png' }), /immutable/);
});

test('approved prospects convert once into a customer, site and owned opportunity', async t => {
  const { rpc, one, staff } = await setup(t);
  const prospect = await one(`select id from cac.prospect where name = 'Studio Terrain (demo)'`);
  await assert.rejects(rpc('sales', 'convert_prospect', { p_prospect: prospect.id }), /Approve the prospect/);
  const review = await rpc('sales', 'submit_record', { p_kind: 'prospect', p_id: prospect.id });
  await rpc('sales', 'decide', { p_approval: review.id, p_decision: 'approved' });
  const opp = await rpc('sales', 'convert_prospect', { p_prospect: prospect.id });
  assert.equal(opp.route, 'Referral'); assert.equal(opp.source, 'Prospect research'); assert.equal(opp.owner_id, staff.sales); assert.equal(opp.stage, 'New enquiry');
  assert.equal((await one(`select converted_opportunity_id from cac.prospect where id = $1`, [prospect.id])).converted_opportunity_id, opp.id);
  await assert.rejects(rpc('sales', 'convert_prospect', { p_prospect: prospect.id }), /already has/);
});

test('website enquiries import once into the lead inbox without touching public.leads', async t => {
  const { rpc, db, one } = await setup(t);
  await db.query(`insert into public.leads (name, email, project_type, message, source_page) values
    ('Asha Rao', 'asha@example.invalid', 'Residential pool', 'We want a pool at our Pune villa.', '/contact'),
    ('Coastline Resort', 'gm@example.invalid', 'Resort renovation', 'Renovate our resort pool.', '/commercial')`);
  assert.equal((await rpc('sales', 'import_website_leads')).created, 2);
  assert.equal((await rpc('sales', 'import_website_leads')).created, 0);
  const resort = await one(`select o.route, o.source, c.segment from cac.opportunity o join cac.customer c on c.id = o.customer_id where o.name like 'Coastline Resort%'`);
  assert.deepEqual(resort, { route: 'Commercial', source: 'Website form', segment: 'Resort' });
  assert.equal((await one(`select count(*)::int as n from public.leads where status = 'new'`)).n, 2);
  await assert.rejects(rpc('engineer', 'import_website_leads'), /role/);
});

test('CSV import saves valid rows and reports invalid ones', async t => {
  const { rpc } = await setup(t);
  const report = await rpc('sales', 'import_rows', { p_kind: 'customer', p_rows: [{ name: 'Lagoon Club', segment: 'Club' }, { name: '' }, { name: 'Odd', segment: 'Moon' }] });
  assert.equal(report.created, 1); assert.deepEqual(report.errors.map(e => e.row), [3, 4]);
  assert.deepEqual(parseCsv('name,notes\r\n"Acme, Inc","Line 1\nLine ""2"""\r\n'), [{ name: 'Acme, Inc', notes: 'Line 1\nLine "2"' }]);
  assert.throws(() => parseCsv('name,notes\na,"unfinished'), /unclosed/);
});

test('staff management: admin only, links existing accounts, keeps one active admin', async t => {
  const { rpc, admin, db, one } = await setup(t);
  await assert.rejects(rpc('sales', 'create_staff', { p_email: 'x@cac.test', p_name: 'X', p_role: 'sales', p_password: 'long-enough-password' }), /role/);
  await assert.rejects(rpc('admin', 'create_staff', { p_email: 'short@cac.test', p_name: 'Short', p_role: 'sales', p_password: 'short' }), /12–256/);
  const created = await rpc('admin', 'create_staff', { p_email: 'New.Estimator@cac.test', p_name: 'Estimator', p_role: 'engineer', p_password: 'long-enough-password' });
  assert.equal(created.email, 'new.estimator@cac.test');
  assert.ok((await one(`select encrypted_password like '$2%' as ok from auth.users where id = $1`, [created.user_id])).ok);
  await db.query(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000bb', 'webadmin@site.test')`);
  assert.equal((await rpc('admin', 'create_staff', { p_email: 'webadmin@site.test', p_name: 'Web admin', p_role: 'viewer' })).user_id, '00000000-0000-0000-0000-0000000000bb');
  await assert.rejects(rpc('admin', 'set_staff', { p_user: admin, p_role: 'sales', p_active: true }), /one active admin/);
});
