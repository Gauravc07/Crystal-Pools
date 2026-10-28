import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, serviceClient, as, call } from './helpers/db.mjs';
import { buildXlsx, report, reportRows } from './helpers/xlsx.mjs';
import { readXlsx, sha256Hex } from '../supabase/functions/_shared/xlsx.js';
import { reportBlocks, extractLeads, normalizeLead, stageBucket } from '../supabase/functions/_shared/leads.js';
import { providerOptions } from '../supabase/functions/_shared/analysis.js';
import { pollMail } from '../supabase/functions/_shared/mail.js';
import { runOnce, effectiveOptions } from '../supabase/functions/_shared/worker.js';

const sheetsOf = async options => (await readXlsx(report(options))).sheets;
const dayOffset = (iso, days) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

// Uploads a report as `who`, then runs the worker once (demo rules unless options say otherwise).
async function importReport(ctx, sheets, { who = 'sales', name = 'report.xlsx', options } = {}) {
  const sha = await sha256Hex(new TextEncoder().encode(JSON.stringify(sheets) + name));
  const created = await ctx.rpc(who, 'upload_lead_report', { p_name: name, p_sha256: sha, p_sheets: sheets });
  const run = await runOnce(serviceClient(ctx.db), options);
  return { created, run };
}
const lead = (ctx, name) => ctx.one(`select * from cac.project_lead where name = $1`, [name]);
const openTasks = (ctx, id) => ctx.all(`select name, due_date::text due, owner, notes from cac.task where project_lead_id = $1 and status = 'open'`, [id]);

test('xlsx reader: shared and inline strings, stored and deflated entries, helpful errors', async () => {
  const rows = [['Sr. No.', 'Project'], [1, 'Tom & "Jerry" <Pools>'], ['', 'Line one\nLine two']];
  for (const options of [{}, { deflate: false }, { inline: true }]) {
    const { sheets } = await readXlsx(buildXlsx({ 'Report 1': rows }, options));
    assert.equal(sheets[0].name, 'Report 1');
    assert.deepEqual(sheets[0].rows, [['Sr. No.', 'Project'], ['1', 'Tom & "Jerry" <Pools>'], ['', 'Line one\nLine two']]);
  }
  await assert.rejects(readXlsx(new TextEncoder().encode('ID;Name\n1;x')), /not an \.xlsx file/);
});

test('report rules: blocks, contacts, stage buckets, pool demand and priority', async () => {
  const sheets = await sheetsOf();
  assert.equal(reportBlocks(sheets).length, 3);
  const { leads, missing } = await extractLeads(sheets, { mode: 'demo' });
  assert.deepEqual(missing, []);
  const [riverside, wakad, neel] = leads;
  assert.equal(riverside.builder.name, 'Demo Lifespace Developers Ltd');
  assert.deepEqual(riverside.builder.phones, ['020 4000 1001', '9800000101']);
  assert.deepEqual(riverside.architect, { firm: 'Demo Associates', name: 'Vinay Rao', address: 'Plot No.52, Pune-411038.', phones: ['020 4000 2002'], emails: ['studio@demo-assoc.example'] });
  assert.deepEqual(riverside.contacts[0], { name: 'Mr.Sunil Desai', role: 'Purchase Manager', phone: '', email: 'sunil.desai@demo-lifespace.example' });
  assert.equal(riverside.contacts[1].role, 'Director');
  assert.deepEqual([riverside.area, riverside.pincode, riverside.units, riverside.towers, riverside.possession], ['Mulshi', '412115', 654, 3, 'December 2028']);
  assert.deepEqual([riverside.stage_bucket, riverside.pool_mentioned, riverside.priority], ['early', false, 'Cold']);
  assert.deepEqual(riverside.fit, ['Tiles', 'FRP planters and fountains']);
  // "Swmming Pool" (as misspelt in real reports) still counts as pool demand.
  assert.deepEqual([wakad.stage, wakad.stage_bucket, wakad.pool_mentioned, wakad.priority, wakad.function_area], ['Excavation in Progress', 'early', true, 'Warm', 'Marketing · In-person outreach']);
  assert.deepEqual([neel.stage_bucket, neel.priority, neel.function_area], ['late', 'Hot', 'Sales · Follow-ups and closing']);
  assert.deepEqual(['2nd Slab in Progress', '10th Slabs Completed', 'Plinth in Progress', 'Finishing Stage', 'Excavation in Progress', 'Something new'].map(stageBucket), ['mid', 'mid', 'mid', 'late', 'early', 'mid']);
});

test('contacts and pool demand must appear in the project text: invented values are dropped', () => {
  const source = 'Mr.Sunil Desai | M: 98000 00101 | sunil@demo.example | Landscaped Garden';
  const result = normalizeLead({ project_name: 'X', builder_phones: ['+91 98000 00101', '98000 99999'], builder_emails: ['sunil@demo.example', 'ceo@demo.example'],
    contacts: [{ name: 'Mr.Sunil Desai', role: 'Purchase Manager', phone: '9800000101', email: 'made.up@demo.example' }], products: ['Swimming Pool'], stage: 'RCC Completed' }, source);
  assert.deepEqual(result.builder.phones, ['+91 98000 00101']);
  assert.deepEqual(result.builder.emails, ['sunil@demo.example']);
  assert.deepEqual(result.contacts, [{ name: 'Mr.Sunil Desai', role: 'Purchase Manager', phone: '9800000101', email: '' }]);
  assert.equal(result.pool_mentioned, false);
  assert.equal(normalizeLead({ project_name: '  ' }, source), null);
  // Two people on one line become two contacts, so a later report that lists them separately matches both.
  const pair = normalizeLead({ project_name: 'X', contacts: [{ name: 'Mr.Vivek Ghanekar/Prashant Padwal', role: 'Purchase Manager', phone: '9800000101', email: '' }, { name: 'Mr.Sachin Puri & Prakash Mahadik', role: 'Purchase', phone: '', email: '' }] }, source);
  assert.deepEqual(pair.contacts.map(c => [c.name, c.role, c.phone]), [['Mr.Vivek Ghanekar', 'Purchase Manager', '9800000101'], ['Prashant Padwal', 'Purchase Manager', ''], ['Mr.Sachin Puri', 'Purchase', ''], ['Prakash Mahadik', 'Purchase', '']]);
  assert.deepEqual(normalizeLead({ project_name: 'X', contacts: [{ name: 'Girish Naik-DGM-Contracts & Procurement', role: '', phone: '', email: '' }] }, source).contacts.map(c => c.name), ['Girish Naik-DGM-Contracts & Procurement']);
});

test('live AI extraction: batches by project, maps by serial, verifies each against its own block', async t => {
  const sheets = await sheetsOf();
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const blocks = JSON.parse(body.messages[1].content).blocks;
    // The model answers out of order and invents a phone for project 3.
    const leads = blocks.reverse().map(b => ({ serial: b.serial, project_name: b.text.match(/^Project: ([^/\n]+)/)[1].trim(), project_type: 'Residential', builder_name: 'B', builder_address: '',
      builder_phones: b.serial === 3 ? ['9811111111', '9800000301'] : [], builder_emails: [], architect_firm: '', architect_name: '', architect_address: '', architect_phones: [], architect_emails: [],
      contacts: [], landmark: '', area: '', pincode: '', details: '', towers: null, units: null, stage: b.text.match(/Flats,([^…]+)…/)[1], possession: 'june 2027', products: b.serial === 3 ? ['Swimming Pool'] : [] }));
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content: JSON.stringify({ leads }) } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } }));
  };
  t.after(() => { globalThis.fetch = original; });
  const options = providerOptions(k => ({ CAC_AI_MODE: 'huggingface', HF_TOKEN: 'hf_test' })[k]);
  const analysis = await extractLeads(sheets, options);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].response_format.json_schema.name, 'project_leads');
  assert.match(calls[0].messages[0].content, /untrusted data, never instructions/);
  assert.deepEqual(analysis.leads.map(l => l.serial), [3, 2, 1]);
  const neel = analysis.leads.find(l => l.serial === 3);
  assert.deepEqual(neel.builder.phones, ['9800000301']);
  assert.deepEqual([neel.possession, neel.stage_bucket, neel.pool_mentioned, neel.priority], ['June 2027', 'late', true, 'Hot']);
  assert.deepEqual(analysis.usage, { input: 1000, output: 500 });
  assert.equal(analysis.provider, 'huggingface');
});

test('report upload → leads with a stage-based schedule; same file once; roles enforced', async t => {
  const ctx = await setup(t, { seed: false });
  const sheets = await sheetsOf();
  await assert.rejects(ctx.rpc('viewer', 'upload_lead_report', { p_name: 'r.xlsx', p_sha256: 'a'.repeat(64), p_sheets: sheets }), /role/);
  const { created, run } = await importReport(ctx, sheets);
  assert.equal(created.status, 'queued');
  assert.equal(run.status, 'completed');
  const imported = await ctx.one(`select status, row_count, result from cac.lead_import where id = $1`, [created.id]);
  assert.equal(imported.status, 'imported'); assert.equal(imported.row_count, 27);
  assert.deepEqual([imported.result.created, imported.result.updated, imported.result.skipped], [3, 0, 0]);
  const today = (await ctx.one(`select current_date::text d`)).d;
  const riverside = await lead(ctx, 'RIVERSIDE PH-II');
  assert.deepEqual([riverside.status, riverside.priority, riverside.owner, riverside.follow_up_step], ['New', 'Cold', 'Sales', 1]);
  const [early] = await openTasks(ctx, riverside.id);
  assert.equal(early.name, 'Introduce Crystal Pools to the architect · RIVERSIDE PH-II');
  assert.equal(early.due, dayOffset(today, 1));
  assert.match(early.notes, /Architect: Demo Associates · Vinay Rao · 020 4000 2002/);
  const [late] = await openTasks(ctx, (await lead(ctx, 'NEEL PRABHA')).id);
  assert.equal(late.name, 'Call the purchase manager: pool and tile decisions are close · NEEL PRABHA');
  assert.equal(late.due, dayOffset(today, 1));
  assert.match(late.notes, /Mr\.Sachin Kale \(Director\) · office@demo-vastu\.example/);
  // The same file again is recognised, not re-read.
  const again = await ctx.rpc('sales', 'upload_lead_report', { p_name: 'copy.xlsx', p_sha256: (await ctx.one(`select sha256 from cac.lead_import`)).sha256, p_sheets: sheets });
  assert.equal(again.duplicate, true);
  assert.equal((await ctx.all(`select id from cac.job where agent = 'leadimport'`)).length, 1);
  // The app snapshot carries the leads and import summary, never the cell text.
  const state = await ctx.rpc('sales', 'workspace_state');
  assert.equal(state.records.project_lead.length, 3);
  assert.equal(state.records.lead_import[0].sheets, undefined);
});

test('next month\'s report updates the lead; an advanced stage restarts follow-ups at the faster pace', async t => {
  const ctx = await setup(t, { seed: false });
  await ctx.rpc('admin', 'set_setting', { p_key: 'lead_owner_outreach', p_value: 'sales user' });
  await importReport(ctx, await sheetsOf());
  const before = await lead(ctx, 'RIVERSIDE PH-II');
  assert.equal(before.owner, 'sales user');
  await ctx.rpc('sales', 'add_comment', { p_kind: 'project_lead', p_id: before.id, p_body: 'Architect asked us to call back after plan approval.' });
  const { run } = await importReport(ctx, await sheetsOf({ riversideStage: '2nd Slab in Progress' }), { name: 'november.xlsx' });
  assert.equal(run.status, 'completed');
  assert.equal((await ctx.all(`select id from cac.project_lead`)).length, 3);
  const after = await lead(ctx, 'RIVERSIDE PH-II');
  assert.equal(after.id, before.id);
  assert.deepEqual([after.stage, after.stage_bucket, after.priority, after.owner], ['2nd Slab in Progress', 'mid', 'Warm', 'Sales']);
  assert.deepEqual(after.history.map(h => h.stage), ['Prelaunch', '2nd Slab in Progress']);
  const tasks = await ctx.all(`select name, status, cancel_reason from cac.task where project_lead_id = $1 order by created_at`, [after.id]);
  assert.deepEqual(tasks.map(t => [t.status, t.cancel_reason]), [['cancelled', 'Construction stage advanced'], ['open', null]]);
  assert.match(tasks[1].name, /^Stage advanced: Call the purchase manager · RIVERSIDE/);
  const comments = await ctx.all(`select kind, body from cac.comment where target_id = $1 order by created_at`, [after.id]);
  assert.deepEqual(comments.map(c => c.kind), ['note', 'system']);
  assert.match(comments[1].body, /moved from "Prelaunch" to "2nd Slab in Progress"/);
  // Unchanged projects are updated in place without touching their schedule.
  const neel = await lead(ctx, 'NEEL PRABHA');
  assert.equal(neel.history.length, 1);
  assert.equal((await openTasks(ctx, neel.id)).length, 1);
});

test('logging contact: retries, next steps, completing from Tasks, closing and reopening', async t => {
  const ctx = await setup(t, { seed: false });
  await importReport(ctx, await sheetsOf());
  const { id } = await lead(ctx, 'NEEL PRABHA');
  const today = (await ctx.one(`select current_date::text d`)).d;
  await assert.rejects(ctx.rpc('sales', 'log_lead_contact', { p_lead: id, p_outcome: 'Waved', p_note: '' }), /outcome/);
  await assert.rejects(ctx.rpc('viewer', 'log_lead_contact', { p_lead: id, p_outcome: 'Reached', p_note: '' }), /role/);

  await ctx.rpc('sales', 'log_lead_contact', { p_lead: id, p_outcome: 'No answer', p_note: 'Rang twice' });
  let open = await openTasks(ctx, id);
  assert.equal(open.length, 1);
  assert.match(open[0].name, /^Retry: Call the purchase manager/);
  assert.equal(open[0].due, dayOffset(today, 2));
  assert.equal((await lead(ctx, 'NEEL PRABHA')).status, 'New');

  await ctx.rpc('sales', 'log_lead_contact', { p_lead: id, p_outcome: 'Reached', p_note: 'Pool tender opens next month' });
  open = await openTasks(ctx, id);
  assert.equal(open.length, 1);
  assert.match(open[0].name, /^Follow up with the purchase manager/);
  assert.equal(open[0].due, dayOffset(today, 2)); // lead flow: Day 1, Day 3, Day 7, then monthly (1, 2, 4, 30 days apart)
  const contacted = await lead(ctx, 'NEEL PRABHA');
  assert.deepEqual([contacted.status, contacted.follow_up_step, contacted.last_outcome], ['Contacted', 2, 'Reached']);

  // Completing the follow-up from the Tasks page opens step 3.
  const task = await ctx.one(`select id from cac.task where project_lead_id = $1 and status = 'open'`, [id]);
  await ctx.rpc('sales', 'complete_task', { p_task: task.id });
  open = await openTasks(ctx, id);
  assert.equal(open.length, 1); assert.equal(open[0].due, dayOffset(today, 4));

  await assert.rejects(ctx.rpc('sales', 'log_lead_contact', { p_lead: id, p_outcome: 'Reached', p_note: '', p_next: '2020-01-01' }), /past/);
  await assert.rejects(ctx.rpc('sales', 'set_lead_status', { p_lead: id, p_status: 'Lost', p_reason: '' }), /reason/);
  await ctx.rpc('sales', 'set_lead_status', { p_lead: id, p_status: 'Lost', p_reason: 'Pool given to another contractor' });
  assert.equal((await openTasks(ctx, id)).length, 0);
  await assert.rejects(ctx.rpc('sales', 'log_lead_contact', { p_lead: id, p_outcome: 'Reached', p_note: '' }), /Reopen/);
  await ctx.rpc('sales', 'set_lead_status', { p_lead: id, p_status: 'Open', p_reason: 'Tender reopened' });
  assert.equal((await lead(ctx, 'NEEL PRABHA')).status, 'Contacted');
  assert.match((await openTasks(ctx, id))[0].name, /^Reopened: /);
  const kinds = (await ctx.all(`select kind from cac.comment where target_id = $1 order by created_at`, [id])).map(c => c.kind);
  assert.deepEqual(kinds, ['contact', 'contact', 'system', 'system']);

  await ctx.rpc('sales', 'assign_project_lead', { p_lead: id, p_owner: 'engineer user' });
  assert.equal((await openTasks(ctx, id))[0].owner, 'engineer user');
  await assert.rejects(ctx.rpc('sales', 'assign_project_lead', { p_lead: id, p_owner: 'Nobody' }), /active staff/);
});

test('comments: staff add them to leads and opportunities; viewers and unknown records cannot', async t => {
  const ctx = await setup(t);
  await assert.rejects(ctx.rpc('viewer', 'add_comment', { p_kind: 'opportunity', p_id: ctx.ids.opportunity, p_body: 'Hi' }), /role/);
  await assert.rejects(ctx.rpc('sales', 'add_comment', { p_kind: 'rate', p_id: ctx.ids.rate, p_body: 'Hi' }), /not available/);
  await assert.rejects(ctx.rpc('sales', 'add_comment', { p_kind: 'opportunity', p_id: ctx.ids.opportunity, p_body: '   ' }), /4,000/);
  const comment = await ctx.rpc('engineer', 'add_comment', { p_kind: 'opportunity', p_id: ctx.ids.opportunity, p_body: 'Site has a 3-phase supply.' });
  assert.equal(comment.name, 'Sahyadri · resort pool');
  assert.equal((await ctx.rpc('viewer', 'workspace_state')).records.comment[0].body, 'Site has a 3-phase supply.');
});

test('converting a lead creates customer, site, contact and opportunity; the builder is reused', async t => {
  const ctx = await setup(t, { seed: false });
  const sheets = await sheetsOf();
  // A second project by the same builder.
  sheets[0].rows.push(
    ['Sr. No.', 'Project', 'Builder', 'Architect', 'Other Professional Details'],
    ['4', 'RIVERSIDE PH-III', 'Demo Lifespace Developers Ltd', 'Ar.Vinay Rao', 'Purchase Manager:'],
    ['', 'Project Details: Tower of G+20 Floors with 80 Flats,Finishing Stage……Possession March 2027.']);
  await importReport(ctx, sheets);
  const first = await lead(ctx, 'RIVERSIDE PH-II');
  await ctx.rpc('sales', 'log_lead_contact', { p_lead: first.id, p_outcome: 'Interested', p_note: 'Wants a clubhouse pool quote' });
  await assert.rejects(ctx.rpc('sales', 'convert_project_lead', { p_lead: first.id, p_contact: 9 }), /contacts/);
  const opp = await ctx.rpc('sales', 'convert_project_lead', { p_lead: first.id, p_contact: 0 });
  assert.equal(opp.name, 'RIVERSIDE PH-II · pool, tiles and FRP');
  assert.deepEqual([opp.source, opp.route, opp.stage, opp.timeline], ['Project lead report', 'Commercial', 'New enquiry', 'Possession December 2028']);
  const contact = await ctx.one(`select name, position, email, permission from cac.contact where id = $1`, [opp.contact_id]);
  assert.deepEqual(contact, { name: 'Mr.Sunil Desai', position: 'Purchase Manager', email: 'sunil.desai@demo-lifespace.example', permission: 'Not recorded' });
  assert.equal((await ctx.one(`select type from cac.activity where opportunity_id = $1`, [opp.id])).type, 'Human response');
  const converted = await lead(ctx, 'RIVERSIDE PH-II');
  assert.deepEqual([converted.status, converted.converted_opportunity_id], ['Converted', opp.id]);
  assert.equal((await openTasks(ctx, first.id)).length, 0);
  await assert.rejects(ctx.rpc('sales', 'convert_project_lead', { p_lead: first.id }), /already has an opportunity/);

  const second = await ctx.rpc('sales', 'convert_project_lead', { p_lead: (await lead(ctx, 'RIVERSIDE PH-III')).id });
  assert.equal(second.customer_id, opp.customer_id);
  assert.equal(second.contact_id, null);
  assert.equal((await ctx.all(`select id from cac.activity where opportunity_id = $1`, [second.id])).length, 0);
});

test('Gmail: polls every 15 minutes, reads new .xlsx attachments once, reports errors', async t => {
  const ctx = await setup(t, { seed: false });
  const client = serviceClient(ctx.db);
  const gmail = { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' };
  const file = Buffer.from(report()).toString('base64url');
  const requests = [];
  let tokenError = null;
  const fetchImpl = async (url, init = {}) => {
    requests.push(String(url));
    const reply = body => new Response(JSON.stringify(body), { status: 200 });
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) return tokenError ? new Response(JSON.stringify({ error: tokenError }), { status: 400 }) : reply({ access_token: 'token' });
    assert.equal(init.headers.Authorization, 'Bearer token');
    if (/messages\?/.test(url)) return reply({ messages: [{ id: 'm1' }] });
    if (/messages\/m1\?format=full/.test(url)) return reply({ internalDate: '1793232000000', payload: { headers: [{ name: 'From', value: 'Reports <reports@demo.example>' }, { name: 'Subject', value: 'Pune project report' }],
      parts: [{ mimeType: 'text/plain', body: { size: 10 } }, { filename: 'Pune.xlsx', mimeType: 'application/octet-stream', body: { attachmentId: 'a1', size: 900 } },
      { filename: 'summary.pdf', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: { attachmentId: 'a3', size: 100 } }, { filename: 'old.xls', body: { attachmentId: 'a2', size: 100 } }] } });
    if (/attachments\/a1/.test(url)) return reply({ data: file });
    throw new Error(`Unexpected request ${url}`);
  };

  assert.equal(await pollMail(client, { clientId: '' }, { fetchImpl }), null);
  assert.equal((await ctx.one(`select value from cac.setting where key = 'lead_mail_configured'`)).value, 'false');
  assert.deepEqual(await ctx.rpc('sales', 'request_mail_check'), { ok: true, gmail: false, queued: 0 });

  const first = await pollMail(client, gmail, { fetchImpl });
  assert.deepEqual(first, { messages: 1, files: 2, duplicates: 0 });
  assert.match(requests[1], /q=from%3Aprathamesh\.meraki2025%40gmail\.com%20has%3Aattachment%20filename%3Axlsx%20newer_than%3A14d/);
  const imports = await ctx.all(`select name, source, status, error, mail_from, mail_subject from cac.lead_import order by lower(name)`);
  assert.deepEqual(imports.map(i => [i.name, i.status]), [['old.xls', 'failed'], ['Pune.xlsx', 'queued']]);
  assert.match(imports[0].error, /Old \.xls format/);
  assert.deepEqual([imports[1].source, imports[1].mail_subject], ['gmail', 'Pune project report']);
  // Gmail imports run as the admin; the worker reads them like uploads.
  assert.equal((await runOnce(client)).status, 'completed');
  assert.equal((await ctx.all(`select id from cac.project_lead`)).length, 3);

  // Not due again for 15 minutes, unless staff ask; a message already read is skipped.
  requests.length = 0;
  assert.equal(await pollMail(client, gmail, { fetchImpl }), null);
  assert.equal(requests.length, 0);
  await ctx.rpc('sales', 'request_mail_check');
  assert.deepEqual(await pollMail(client, gmail, { fetchImpl }), { messages: 0, files: 0, duplicates: 0 });
  assert.equal(requests.filter(u => /format=full/.test(u)).length, 0);

  // Revoked access is reported in Settings, not thrown.
  await ctx.rpc('sales', 'request_mail_check');
  tokenError = 'invalid_grant';
  assert.match((await pollMail(client, gmail, { fetchImpl })).error, /revoked or has expired/);
  assert.match((await ctx.one(`select value from cac.setting where key = 'lead_mail_last_error'`)).value, /gmail:auth/);
});

test('lead settings are validated; worker-only settings and functions are protected', async t => {
  const ctx = await setup(t, { seed: false });
  await assert.rejects(ctx.rpc('admin', 'set_setting', { p_key: 'lead_cadence', p_value: '{"early":[7],"mid":[3]}' }), /late schedule/);
  await assert.rejects(ctx.rpc('admin', 'set_setting', { p_key: 'lead_cadence', p_value: 'nope' }), /valid JSON/);
  await assert.rejects(ctx.rpc('admin', 'set_setting', { p_key: 'lead_cadence', p_value: '{"early":[7.5],"mid":[3],"late":[1]}' }), /whole numbers/);
  const saved = await ctx.rpc('admin', 'set_setting', { p_key: 'lead_cadence', p_value: '{"early":[10,60],"mid":[2],"late":[0,2]}' });
  assert.deepEqual(JSON.parse(saved.lead_cadence), { early: [10, 60], mid: [2], late: [0, 2] });
  await assert.rejects(ctx.rpc('admin', 'set_setting', { p_key: 'lead_owner_sales', p_value: 'Somebody' }), /active staff/);
  await assert.rejects(ctx.rpc('admin', 'set_setting', { p_key: 'lead_mail_last_poll', p_value: '' }), /updated by the worker/);
  await assert.rejects(ctx.rpc('sales', 'set_setting', { p_key: 'lead_mail_query', p_value: 'from:x' }), /role/);
  await assert.rejects(ctx.rpc('sales', 'mail_poll_begin', { p_configured: true }), /permission denied/);
  await assert.rejects(ctx.rpc('sales', 'complete_lead_import', { p_job: ctx.admin }), /permission denied/);
  await assert.rejects(as(ctx.db, { role: 'anon' }, tx => tx.query(`select cac.upload_lead_report('x', 'y', '[]')`)), /permission denied/);
});

const HEAD = ['Sr. No.', 'Project', 'Builder', 'Architect', 'Other Professional Details'];
const sheet = rows => [{ name: 'Report', rows: rows.map(r => r.map(v => String(v ?? ''))) }];

test('duplicates: a project repeated in one report, or seen again with a spelling variant, is merged into one lead', async t => {
  const ctx = await setup(t, { seed: false });
  // The same project twice in one file; the repeat lists another person and no stage line.
  const first = sheet([...reportRows(),
    HEAD, [4, 'RIVERSIDE PH-II', 'Demo Lifespace Developers Ltd', '', 'Purchase Manager:'], ['', 'Residential', '', '', 'Ms.Rita Shah'], ['', '', '', '', 'M: 9800000999.'],
    ['', 'Landmark: Sector R-33,Nande,Mulshi,Pune-412115.']]);
  const { run } = await importReport(ctx, first);
  assert.equal(run.status, 'completed');
  const imported = await ctx.one(`select result from cac.lead_import`);
  assert.deepEqual([imported.result.created, imported.result.duplicates, imported.result.updated], [3, 1, 0]);
  let lead = await ctx.one(`select * from cac.project_lead where name = 'RIVERSIDE PH-II'`);
  assert.equal((await ctx.all(`select id from cac.project_lead where name = 'RIVERSIDE PH-II'`)).length, 1);
  assert.deepEqual(lead.contacts.map(c => c.name), ['Mr.Sunil Desai', 'Mr.Arun Mehta', 'Ms.Rita Shah']);
  assert.deepEqual([lead.stage, lead.possession, lead.history.length], ['Prelaunch', 'December 2028', 1]); // the repeat's blanks did not wipe them
  assert.equal((await ctx.all(`select id from cac.task where project_lead_id = $1 and status = 'open'`, [lead.id])).length, 1);

  // Next month: builder written without "Ltd", a known person with a new phone, a new person, and no possession date.
  const next = sheet([HEAD, [1, 'RIVERSIDE PH-II', 'Demo Lifespace Developers', 'Demo Associates:Ar.Vinay Rao', 'Purchase Manager:'],
    ['', 'Residential', 'T: 020 4000 1009.', '', 'Mr.Sunil Desai'], ['', '', '', '', 'M: 9800000102.'], ['', '', '', '', 'Mr.Kiran Rao (Director)'],
    ['', 'Landmark: Sector R-33,Nande,Mulshi,Pune-412115.'], ['', 'Project Details: 3 Towers of G+36 Floors with 654 Flats,Excavation in Progress….'],
    ['', 'Product Details: Swimming Pool,Clubhouse.']]);
  await importReport(ctx, next, { name: 'november.xlsx' });
  assert.equal((await ctx.all(`select id from cac.project_lead where name = 'RIVERSIDE PH-II'`)).length, 1);
  lead = await ctx.one(`select * from cac.project_lead where name = 'RIVERSIDE PH-II'`);
  const sunil = lead.contacts.find(c => c.name === 'Mr.Sunil Desai');
  assert.deepEqual([sunil.email, sunil.phone], ['sunil.desai@demo-lifespace.example', '9800000102']); // filled in, nothing lost
  assert.deepEqual(lead.contacts.map(c => c.name), ['Mr.Sunil Desai', 'Mr.Arun Mehta', 'Ms.Rita Shah', 'Mr.Kiran Rao']);
  assert.deepEqual(lead.builder.phones, ['020 4000 1001', '9800000101', '020 4000 1009']);
  assert.equal(lead.builder.name, 'Demo Lifespace Developers');
  assert.deepEqual([lead.stage, lead.possession, lead.pool_mentioned], ['Excavation in Progress', 'December 2028', true]);
  assert.ok(lead.products.includes('Paving Tiles') && lead.products.includes('Swimming Pool'));
  const result = (await ctx.one(`select result from cac.lead_import where name = 'november.xlsx'`)).result;
  assert.deepEqual([result.created, result.updated, result.merged], [0, 1, 1]);
  const note = await ctx.one(`select body from cac.comment where target_id = $1 and body like '%new contact%' order by created_at desc limit 1`, [lead.id]);
  assert.match(note.body, /november\.xlsx: 1 new contact\(s\) added: Mr\.Kiran Rao/);
});

test('duplicates: the same file in a second email is not read again; Read again re-merges without copies', async t => {
  const ctx = await setup(t, { seed: false });
  const client = serviceClient(ctx.db);
  const file = Buffer.from(report()).toString('base64url');
  const reply = body => new Response(JSON.stringify(body), { status: 200 });
  let ids = ['m1'];
  const fetchImpl = async url => {
    url = String(url);
    if (url.startsWith('https://oauth2.googleapis.com/token')) return reply({ access_token: 'token' });
    if (/messages\?/.test(url)) return reply({ messages: ids.map(id => ({ id })) });
    if (/format=full/.test(url)) return reply({ internalDate: '1793232000000', payload: { headers: [{ name: 'From', value: 'prathamesh.meraki2025@gmail.com' }], parts: [{ filename: 'Report copy.XLSX', body: { attachmentId: 'a1' } }] } });
    if (/attachments/.test(url)) return reply({ data: file });
    throw new Error(url);
  };
  const gmail = { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' };
  assert.deepEqual(await pollMail(client, gmail, { fetchImpl }), { messages: 1, files: 1, duplicates: 0 });
  await runOnce(client);
  ids = ['m1', 'm2']; // the same report forwarded again
  await ctx.rpc('sales', 'request_mail_check');
  assert.deepEqual(await pollMail(client, gmail, { fetchImpl }), { messages: 1, files: 1, duplicates: 1 });
  assert.match((await ctx.one(`select value from cac.setting where key = 'lead_mail_last_result'`)).value, /1 already imported, skipped/);
  assert.equal((await ctx.all(`select id from cac.lead_import`)).length, 1);
  assert.equal(await runOnce(client), null); // nothing new to read

  const { id } = await ctx.one(`select id from cac.lead_import`);
  await assert.rejects(ctx.rpc('viewer', 'reread_lead_report', { p_import: id }), /role/);
  const job = await ctx.rpc('sales', 'reread_lead_report', { p_import: id });
  assert.equal(job.status, 'queued');
  assert.equal((await runOnce(client)).status, 'completed');
  assert.equal((await ctx.all(`select id from cac.project_lead`)).length, 3);
  const again = (await ctx.one(`select result from cac.lead_import`)).result;
  assert.deepEqual([again.created, again.updated], [0, 3]);
  assert.equal((await ctx.all(`select id from cac.task where project_lead_id is not null and status = 'open'`)).length, 3);
});

test('controls: assistants on/off, paid AI off by default, sections, lead-flow follow-ups', async t => {
  const ctx = await setup(t, { seed: false, agents: 'defaults' });
  const state = await ctx.rpc('sales', 'workspace_state');
  assert.deepEqual(state.agents.filter(a => !a.active).map(a => a.id).sort(), ['outreach', 'research']);
  assert.equal(state.settings.ai_enabled, 'false');
  assert.equal(state.settings.hidden_modules, 'prospect,outreach,lifecycle');
  assert.deepEqual(JSON.parse(state.settings.lead_cadence), { early: [1, 30, 30], mid: [1, 2, 4, 30], late: [1, 2, 4, 30] });

  // Paid AI off: the worker uses the free rules even when a provider key is configured.
  const client = serviceClient(ctx.db);
  const paid = { mode: 'anthropic', anthropic: { apiKey: 'sk-ant-test', model: 'claude-haiku-5-5' } };
  assert.equal((await effectiveOptions(client, paid)).mode, 'demo');
  await assert.rejects(ctx.rpc('sales', 'set_setting', { p_key: 'ai_enabled', p_value: 'true' }), /role/);
  await ctx.rpc('admin', 'set_setting', { p_key: 'ai_enabled', p_value: 'true' });
  assert.equal((await effectiveOptions(client, paid)).mode, 'anthropic');
  await assert.rejects(ctx.rpc('admin', 'set_setting', { p_key: 'ai_enabled', p_value: 'maybe' }), /on \(true\) or off/);

  // Sections: validated and normalised.
  await assert.rejects(ctx.rpc('admin', 'set_setting', { p_key: 'hidden_modules', p_value: 'prospect,nonsense' }), /Unknown workspace section/);
  assert.equal((await ctx.rpc('admin', 'set_setting', { p_key: 'hidden_modules', p_value: ' outreach , prospect,outreach' })).hidden_modules, 'outreach,prospect');

  // A turned-off assistant cannot run by any route.
  await assert.rejects(ctx.rpc('sales', 'set_agent_active', { p_agent: 'leadimport', p_active: false }), /role/);
  await ctx.rpc('admin', 'set_agent_active', { p_agent: 'leadimport', p_active: false });
  const sheets = await sheetsOf();
  await assert.rejects(ctx.rpc('sales', 'upload_lead_report', { p_name: 'r.xlsx', p_sha256: 'b'.repeat(64), p_sheets: sheets }), /Lead report reader assistant is turned off/);
  assert.equal((await ctx.all(`select id from cac.lead_import`)).length, 0); // nothing half-saved
  await assert.rejects(ctx.rpc('sales', 'request_mail_check'), /turned off/);
  assert.deepEqual(await ctx.rpc('sales', 'mail_poll_begin', { p_configured: true }).catch(() => 'denied'), 'denied');
  assert.equal((await call(ctx.db, 'mail_poll_begin', { p_configured: true }, { role: 'service_role' })).due, false);
  await ctx.rpc('admin', 'set_agent_active', { p_agent: 'leadimport', p_active: true });
  assert.equal((await ctx.rpc('sales', 'upload_lead_report', { p_name: 'r.xlsx', p_sha256: 'b'.repeat(64), p_sheets: sheets })).status, 'queued');
});
