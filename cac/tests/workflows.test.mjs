import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, serviceClient } from './helpers/db.mjs';
import { runOnce } from '../supabase/functions/_shared/worker.js';
import { demoAnalysis } from '../supabase/functions/_shared/analysis.js';

const heating = 'Can you add heating and send a revised estimate? We plan to start in December.';

test('heating reply creates an unpriced revision and pauses generic follow-up exactly once', async t => {
  const { ids, rpc, db, one, all } = await setup(t);
  const args = { p_agent: 'followup', p_target: ids.opportunity, p_input: { message: heating }, p_dedupe: 'reply-one' };
  const job = await rpc('sales', 'enqueue_run', args);
  assert.equal((await rpc('sales', 'enqueue_run', args)).id, job.id);
  const worker = serviceClient(db);
  await runOnce(worker);
  const run = await one(`select status, approval_id from cac.job where id = $1`, [job.id]);
  assert.equal(run.status, 'waiting_approval');
  const revision = await one(`select * from cac.revision`);
  assert.equal(revision.heating_requested, true); assert.equal(revision.tentative_start, 'December');
  assert.equal(revision.previous_quote_id, ids.quote); assert.equal(revision.site_id, ids.site);
  assert.ok(revision.missing.some(s => s.includes('year')));
  assert.equal((await one(`select status from cac.task where category = 'generic_followup'`)).status, 'paused');
  assert.equal((await all(`select id from cac.task where category = 'estimation'`)).length, 1);
  assert.equal(await runOnce(worker), null);
  assert.equal((await all(`select id from cac.revision`)).length, 1);
  assert.equal((await all(`select id from cac.quote`)).length, 1);
  await rpc('sales', 'decide', { p_approval: run.approval_id, p_decision: 'approved' });
  assert.equal((await one(`select status from cac.job where id = $1`, [job.id])).status, 'completed');
  assert.equal((await one(`select status from cac.draft where run_id = $1`, [job.id])).status, 'approved');
});

test('opt-out suppresses the customer and all their opportunities', async t => {
  const { ids, rpc, db, one } = await setup(t);
  await rpc('sales', 'enqueue_run', { p_agent: 'followup', p_target: ids.opportunity, p_input: { message: 'Please unsubscribe and stop contacting us.' } });
  await runOnce(serviceClient(db));
  assert.equal((await one(`select suppressed from cac.customer where id = $1`, [ids.customer])).suppressed, true);
  assert.equal((await one(`select bool_and(suppressed) as all from cac.opportunity where customer_id = $1`, [ids.customer])).all, true);
});

test('qualification extraction is proposed until a salesperson approves it', async t => {
  const { ids, rpc, db, one } = await setup(t);
  const target = ids.villaOpportunity;
  await rpc('sales', 'write_record', { p_kind: 'opportunity', p_id: target, p_values: { location: '', budget: '', pool_type: '', timeline: '', notes: 'I am the owner. We need a skimmer pool in Pune. Budget: 12 lakh. Start December.' } });
  const job = await rpc('sales', 'enqueue_run', { p_agent: 'qualification', p_target: target });
  await runOnce(serviceClient(db));
  assert.equal((await one(`select budget from cac.opportunity where id = $1`, [target])).budget, null);
  await rpc('sales', 'decide', { p_approval: (await one(`select approval_id from cac.job where id = $1`, [job.id])).approval_id, p_decision: 'approved' });
  const opp = await one(`select * from cac.opportunity where id = $1`, [target]);
  assert.equal(Number(opp.budget), 1200000); assert.equal(opp.location, 'Pune'); assert.equal(opp.decision_maker, 'Owner (customer stated)'); assert.equal(opp.qualification_reviewed, true);
});

test('failed analysis retries at most three times and creates no business side effects', async t => {
  const { ids, rpc, db, one, all } = await setup(t);
  const job = await rpc('sales', 'enqueue_run', { p_agent: 'followup', p_target: ids.opportunity, p_input: { message: 'Hello' } });
  const worker = serviceClient(db);
  for (let i = 0; i < 3; i++) {
    await runOnce(worker, { analyze: async () => { throw new Error('Provider unavailable'); } });
    await db.query(`update cac.job set available_at = now() - interval '1 minute' where id = $1 and status = 'queued'`, [job.id]);
  }
  const run = await one(`select attempts, status, error from cac.job where id = $1`, [job.id]);
  assert.deepEqual(run, { attempts: 3, status: 'failed', error: 'Provider unavailable' });
  assert.equal((await all(`select id from cac.draft`)).length, 0); assert.equal((await all(`select id from cac.revision`)).length, 0);
  await assert.rejects(rpc('sales', 'retry_run', { p_job: job.id }), /Retry limit/);
});

test('a business-rule failure during completion rolls back every side effect', async t => {
  const { rpc, db, one, all } = await setup(t);
  const prospect = await one(`select id from cac.prospect where name = 'Canopy Hospitality (demo)'`);
  const review = await rpc('sales', 'submit_record', { p_kind: 'prospect', p_id: prospect.id });
  await rpc('sales', 'decide', { p_approval: review.id, p_decision: 'approved' });
  await db.query(`update cac.portfolio set status = 'draft'`);
  const job = await rpc('sales', 'enqueue_run', { p_agent: 'outreach', p_target: prospect.id });
  const result = await runOnce(serviceClient(db));
  assert.equal(result.status, 'failed'); assert.match(result.error, /portfolio/);
  assert.equal((await one(`select status from cac.job where id = $1`, [job.id])).status, 'failed');
  assert.equal((await all(`select id from cac.draft`)).length, 0);
});

test('a crashed worker resumes from the saved checkpoint without a second provider call', async t => {
  const { ids, rpc, db, one, all } = await setup(t);
  const job = await rpc('sales', 'enqueue_run', { p_agent: 'sales', p_target: ids.opportunity });
  const target = await one(`select to_jsonb(o) as t from cac.opportunity o where id = $1`, [ids.opportunity]);
  // Simulate a worker that saved its analysis and then died before completing.
  await db.query(`update cac.job set status = 'running', attempts = 1, locked_until = now() - interval '1 second', analysis = $2 where id = $1`, [job.id, JSON.stringify(demoAnalysis('sales', { target: target.t, input: {} }))]);
  await runOnce(serviceClient(db), { analyze: async () => { throw new Error('Should not call provider'); } });
  assert.equal((await one(`select status from cac.job where id = $1`, [job.id])).status, 'waiting_approval');
  assert.equal((await all(`select id from cac.draft`)).length, 1);
});

test('a run fails if its record changed after queueing', async t => {
  const { ids, rpc, db, one } = await setup(t);
  const job = await rpc('sales', 'enqueue_run', { p_agent: 'sales', p_target: ids.opportunity });
  await rpc('sales', 'write_record', { p_kind: 'opportunity', p_values: { notes: 'Edited meanwhile' }, p_id: ids.opportunity });
  assert.equal(await runOnce(serviceClient(db)), null);
  assert.match((await one(`select status, error from cac.job where id = $1`, [job.id])).error, /changed after/);
});

test('proposal workflow stays pending across engineering and commercial approval', async t => {
  const { ids, rpc, db, one } = await setup(t);
  const job = await rpc('commercial', 'enqueue_run', { p_agent: 'proposal', p_target: ids.opportunity, p_input: { survey_id: ids.survey, items: [{ rate_id: ids.rate, quantity: 10 }], scope: 'S', exclusions: 'E', terms: 'T' } });
  await runOnce(serviceClient(db));
  const step = async () => one(`select status, step, approval_id from cac.job where id = $1`, [job.id]);
  assert.equal((await step()).status, 'waiting_approval');
  await rpc('engineer', 'decide', { p_approval: (await step()).approval_id, p_decision: 'approved' });
  assert.deepEqual([(await step()).status, (await step()).step], ['waiting_approval', 'commercial_review']);
  await rpc('commercial', 'decide', { p_approval: (await step()).approval_id, p_decision: 'approved' });
  assert.equal((await step()).status, 'completed');
});

test('all remaining assistants create bounded drafts with the right review role', async t => {
  const { ids, rpc, db, one, admin } = await setup(t);
  const worker = serviceClient(db);
  const prospect = await one(`select id from cac.prospect where name = 'Studio Terrain (demo)'`);
  const research = await rpc('sales', 'enqueue_run', { p_agent: 'research', p_target: prospect.id });
  await runOnce(worker);
  const researched = await one(`select approval_id, status from cac.job where id = $1`, [research.id]);
  assert.equal(researched.status, 'waiting_approval');
  await rpc('sales', 'decide', { p_approval: researched.approval_id, p_decision: 'approved' });
  await assert.rejects(rpc('engineer', 'enqueue_run', { p_agent: 'outreach', p_target: prospect.id }), /role/);
  const campaign = await one(`select id from cac.campaign limit 1`);
  const outreach = await rpc('sales', 'enqueue_run', { p_agent: 'outreach', p_target: prospect.id, p_input: { campaign_id: campaign.id } });
  await runOnce(worker);
  const draft = await one(`select body, campaign_id from cac.draft where run_id = $1`, [outreach.id]);
  assert.match(draft.body, /Crystal Pools/); assert.match(draft.body, /stop contacting you/); assert.equal(draft.campaign_id, campaign.id);
  const project = (await db.query(`select cac.put('project', jsonb_build_object('name','Test project','opportunity_id',$1::uuid,'site_updates','Customer requested a scope review.','created_by',$2::uuid)) as p`, [ids.opportunity, admin])).rows[0].p;
  const maintenance = await one(`select id from cac.maintenance limit 1`);
  for (const [agent, target, role, who] of [['sales', ids.opportunity, 'sales', 'sales'], ['survey', ids.survey, 'engineer', 'engineer'], ['project', project.id, 'project', 'project'], ['maintenance', maintenance.id, 'commercial', 'commercial']]) {
    const job = await rpc(who, 'enqueue_run', { p_agent: agent, p_target: target });
    await runOnce(worker);
    const run = await one(`select status, approval_id from cac.job where id = $1`, [job.id]);
    assert.equal(run.status, 'waiting_approval', agent);
    const review = await one(`select role, target_id from cac.approval where id = $1`, [run.approval_id]);
    assert.equal(review.role, role, agent);
    assert.equal((await one(`select status from cac.draft where id = $1`, [review.target_id])).status, 'pending', agent);
  }
});

test('internal briefs can never be simulated as sent', async t => {
  const { ids, rpc, db, one } = await setup(t);
  const job = await rpc('sales', 'enqueue_run', { p_agent: 'sales', p_target: ids.opportunity });
  await runOnce(serviceClient(db));
  const run = await one(`select approval_id from cac.job where id = $1`, [job.id]);
  await rpc('sales', 'decide', { p_approval: run.approval_id, p_decision: 'approved' });
  const draft = await one(`select id from cac.draft where run_id = $1`, [job.id]);
  await assert.rejects(rpc('sales', 'simulate_delivery', { p_kind: 'draft', p_id: draft.id }), /Internal briefs/);
});

test('demo rules never invent prices or heater specifications', () => {
  const analysis = demoAnalysis('followup', { target: { name: 'Resort' }, input: { message: heating } });
  assert.equal(analysis.intent, 'revision'); assert.equal(analysis.tentativeStart, 'December');
  assert.doesNotMatch(analysis.proposedReply, /₹|\bkW\b|price of/i);
  assert.equal(demoAnalysis('followup', { target: { name: 'R' }, input: { message: 'We do not want heating.' } }).heatingRequested, false);
});
