import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, serviceClient } from './helpers/db.mjs';
import { runOnce } from '../supabase/functions/_shared/worker.js';

const inHours = h => new Date(Date.now() + h * 3600000).toISOString();

test('speed to lead: first human response is measured against the target; missed calls create callbacks', async t => {
  const { ids, rpc, db, one } = await setup(t);
  await db.query(`update cac.opportunity set enquiry_at = now() - interval '3 hours' where id = $1`, [ids.villaOpportunity]);
  let metrics = (await rpc('sales', 'workspace_state')).metrics.response;
  assert.equal(metrics.target_minutes, 60); assert.equal(metrics.awaiting, 1); assert.equal(metrics.awaiting_over_target, 1);
  await rpc('sales', 'write_record', { p_kind: 'activity', p_values: { name: 'Missed call', opportunity_id: ids.villaOpportunity, type: 'Missed call', channel: 'Phone', direction: 'Inbound' } });
  assert.equal((await one(`select owner, due_date = current_date as today from cac.task where category = 'callback'`)).today, true);
  await rpc('sales', 'write_record', { p_kind: 'activity', p_values: { name: 'Called back', opportunity_id: ids.villaOpportunity, type: 'Human response', channel: 'Phone', direction: 'Outbound' } });
  metrics = (await rpc('sales', 'workspace_state')).metrics.response;
  assert.equal(metrics.awaiting, 0); assert.equal(metrics.within_target_pct, 50); // 0-minute demo reply + 180-minute reply
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'activity', p_values: { name: 'Bad', opportunity_id: ids.villaOpportunity, type: 'Note', channel: 'Pigeon' } }), /Channel has an invalid value/);
  await assert.rejects(rpc('sales', 'set_setting', { p_key: 'response_target_minutes', p_value: '30' }), /role/);
  assert.equal((await rpc('admin', 'set_setting', { p_key: 'response_target_minutes', p_value: '30' })).response_target_minutes, '30');
});

test('appointments: reminder before the visit, confirmed site visit satisfies the pipeline gate, no-show creates re-engagement', async t => {
  const { ids, rpc, one, all } = await setup(t);
  const appt = await rpc('sales', 'write_record', { p_kind: 'appointment', p_values: { name: 'Villa site visit', type: 'Site visit', opportunity_id: ids.villaOpportunity, starts_at: inHours(50), assigned_to: 'sales user' } });
  assert.equal(appt.status, 'scheduled');
  assert.equal((await all(`select id from cac.task where appointment_id = $1 and category = 'appointment_reminder' and status = 'open'`, [appt.id])).length, 1);
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'appointment', p_values: { starts_at: inHours(80) }, p_id: appt.id }), /Reschedule/);
  await rpc('sales', 'reschedule_appointment', { p_appointment: appt.id, p_starts_at: inHours(72) });
  assert.equal((await all(`select id from cac.task where appointment_id = $1 and category = 'appointment_reminder' and status = 'open'`, [appt.id])).length, 1);
  await rpc('sales', 'set_appointment_status', { p_appointment: appt.id, p_status: 'confirmed' });
  const opp = await one(`select visit_confirmed, visit_date from cac.opportunity where id = $1`, [ids.villaOpportunity]);
  assert.equal(opp.visit_confirmed, true); assert.ok(opp.visit_date);
  const second = await rpc('sales', 'write_record', { p_kind: 'appointment', p_values: { name: 'Consultation call', type: 'Consultation', opportunity_id: ids.villaOpportunity, starts_at: inHours(5) } });
  await rpc('sales', 'set_appointment_status', { p_appointment: second.id, p_status: 'no_show' });
  assert.equal((await one(`select category from cac.task where appointment_id = $1 and category = 'no_show'`, [second.id])).category, 'no_show');
  assert.equal((await all(`select id from cac.task where appointment_id = $1 and category = 'appointment_reminder' and status = 'open'`, [second.id])).length, 0);
  await assert.rejects(rpc('sales', 'set_appointment_status', { p_appointment: second.id, p_status: 'completed' }), /already closed/);
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'appointment', p_values: { name: 'Floating', type: 'Consultation', starts_at: inHours(5) } }), /opportunity or a maintenance/);
  assert.equal((await rpc('sales', 'workspace_state')).metrics.appointments.show_rate_pct, 0);
});

test('service visits update history and a declined recommendation schedules a 30-day follow-up', async t => {
  const { rpc, one } = await setup(t);
  const contract = await one(`select id from cac.maintenance limit 1`);
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'service_visit', p_values: { name: 'Visit', maintenance_id: contract.id, visit_date: '2026-10-10' } }), /role/);
  await rpc('engineer', 'write_record', { p_kind: 'service_visit', p_values: { name: 'October service', maintenance_id: contract.id, visit_date: '2026-10-10', technician: 'Ravi', work_done: 'Backwash and chemical balance', recommendations: 'Replace worn pump seal', decision: 'Declined' } });
  assert.match((await one(`select service_history from cac.maintenance where id = $1`, [contract.id])).service_history, /10 Oct 2026: Backwash and chemical balance \(Ravi\)/);
  const task = await one(`select due_date::text, notes from cac.task where category = 'declined_service'`);
  assert.equal(task.due_date, '2026-11-09'); assert.match(task.notes, /pump seal/);
});

test('handover creates one review request; sending needs the review link and respects opt-out', async t => {
  const { ids, rpc, db, one, admin } = await setup(t);
  const project = (await db.query(`select cac.put('project', jsonb_build_object('name','Resort pool build','opportunity_id',$1::uuid,'milestones','Done','handover_checklist','Signed','created_by',$2::uuid)) as p`, [ids.opportunity, admin])).rows[0].p;
  await assert.rejects(rpc('sales', 'request_review', { p_project: project.id }), /after the project handover/);
  await rpc('project', 'complete_project', { p_project: project.id });
  const review = await one(`select * from cac.review_request where project_id = $1`, [project.id]);
  assert.equal(review.status, 'to_send'); assert.match(review.body, /review link to be set/);
  assert.equal((await rpc('sales', 'request_review', { p_project: project.id })).id, review.id);
  await assert.rejects(rpc('sales', 'update_review', { p_review: review.id, p_status: 'sent' }), /review link in Settings/);
  await rpc('admin', 'set_setting', { p_key: 'review_url', p_value: 'https://g.page/r/crystal-pools/review' });
  await assert.rejects(rpc('admin', 'set_setting', { p_key: 'review_url', p_value: 'http://insecure.example' }), /HTTPS/);
  await db.query(`update cac.customer set suppressed = true where id = $1`, [ids.customer]);
  await assert.rejects(rpc('sales', 'update_review', { p_review: review.id, p_status: 'sent' }), /opted out/);
  await db.query(`update cac.customer set suppressed = false where id = $1`, [ids.customer]);
  await rpc('sales', 'update_review', { p_review: review.id, p_status: 'sent' });
  await assert.rejects(rpc('sales', 'update_review', { p_review: review.id, p_status: 'received', p_rating: 6 }), /1 to 5/);
  await rpc('sales', 'update_review', { p_review: review.id, p_status: 'received', p_rating: 5 });
  const reviews = (await rpc('sales', 'workspace_state')).metrics.reviews;
  assert.equal(reviews.received, 1); assert.equal(reviews.average_rating, 5);
});

test('lifecycle lists find due customers, create one follow-up each, and skip opted-out customers', async t => {
  const { ids, rpc, db, one, all } = await setup(t);
  await db.query(`update cac.maintenance set next_service = current_date - 3, warranty_date = current_date + 20, equipment = 'Hayward SP2610 pump; sand filter'`);
  const state = await rpc('sales', 'workspace_state');
  const counts = Object.fromEntries(state.lifecycle.map(l => [l.kind, l.count]));
  assert.equal(counts.amc_renewal, 1); assert.equal(counts.service_overdue, 1); assert.equal(counts.warranty_expiring, 1);
  assert.equal(state.metrics.lifecycle.amc_renewal, 1);
  assert.deepEqual(await rpc('commercial', 'launch_lifecycle', { p_kind: 'amc_renewal' }), { created: 1, skipped: 0 });
  assert.deepEqual(await rpc('commercial', 'launch_lifecycle', { p_kind: 'amc_renewal' }), { created: 0, skipped: 1 });
  assert.match((await one(`select notes from cac.task where lifecycle_key like 'amc_renewal:%'`)).notes, /Suggested message/);
  await assert.rejects(rpc('sales', 'launch_lifecycle', { p_kind: 'equipment_advisory', p_pattern: 'ab' }), /3 characters/);
  assert.equal((await rpc('sales', 'launch_lifecycle', { p_kind: 'equipment_advisory', p_pattern: 'sp2610' })).created, 1);
  assert.equal((await rpc('sales', 'launch_lifecycle', { p_kind: 'equipment_advisory', p_pattern: 'no-such-model' })).created, 0);
  await assert.rejects(rpc('engineer', 'launch_lifecycle', { p_kind: 'service_overdue' }), /role/);
  await db.query(`update cac.customer set suppressed = true where id = $1`, [ids.customer]);
  assert.deepEqual(await rpc('project', 'launch_lifecycle', { p_kind: 'service_overdue' }), { created: 0, skipped: 0 });
  // Dormant enquiries: nothing logged for 14 days.
  await db.query(`update cac.opportunity set enquiry_at = now() - interval '20 days' where id = $1`, [ids.villaOpportunity]);
  assert.equal((await rpc('sales', 'launch_lifecycle', { p_kind: 'dormant_enquiries' })).created, 1);
  assert.equal((await all(`select id from cac.task where lifecycle_key = $1`, ['dormant_enquiries:' + ids.villaOpportunity])).length, 1);
});

test('owner assistant: admin-only question, plan from live metrics, approved actions become tasks', async t => {
  const { rpc, db, one, all } = await setup(t);
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'briefing', p_values: { name: 'What is slipping?' } }), /role/);
  const briefing = await rpc('admin', 'write_record', { p_kind: 'briefing', p_values: { name: 'What is slipping this week?' } });
  const job = await rpc('admin', 'enqueue_run', { p_agent: 'operator', p_target: briefing.id });
  await runOnce(serviceClient(db));
  const run = await one(`select status, approval_id from cac.job where id = $1`, [job.id]);
  assert.equal(run.status, 'waiting_approval');
  const draft = await one(`select body, analysis from cac.draft where run_id = $1`, [job.id]);
  assert.match(draft.body, /Plan for: What is slipping this week\?/);
  assert.ok(draft.analysis.actions.length >= 2); // seed has an overdue task and an AMC renewal
  assert.ok(draft.analysis.actions.some(a => /overdue tasks/.test(a.name)));
  assert.equal((await all(`select id from cac.task where category = 'operator'`)).length, 0);
  await assert.rejects(rpc('sales', 'decide', { p_approval: run.approval_id, p_decision: 'approved' }), /role/);
  await rpc('admin', 'decide', { p_approval: run.approval_id, p_decision: 'approved' });
  assert.equal((await all(`select id from cac.task where category = 'operator'`)).length, draft.analysis.actions.length);
  assert.equal((await one(`select status from cac.briefing where id = $1`, [briefing.id])).status, 'actioned');
});

test('approved knowledge answers are used in follow-up drafts; unapproved entries are not', async t => {
  const { ids, rpc, db, one } = await setup(t);
  const entry = await rpc('sales', 'write_record', { p_kind: 'knowledge', p_values: { name: 'Warranty coverage', category: 'Policy', content: 'Structural work carries a 10-year warranty (DEMO policy).' } });
  const ask = async key => {
    const job = await rpc('sales', 'enqueue_run', { p_agent: 'followup', p_target: ids.villaOpportunity, p_input: { message: 'What warranty do you give on the pool?' }, p_dedupe: key });
    await runOnce(serviceClient(db));
    return one(`select body from cac.draft where run_id = $1`, [job.id]);
  };
  assert.doesNotMatch((await ask('first')).body, /10-year/);
  await db.query(`update cac.job set status = 'completed'`);
  const review = await rpc('sales', 'submit_record', { p_kind: 'knowledge', p_id: entry.id });
  await rpc('sales', 'decide', { p_approval: review.id, p_decision: 'approved' });
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'knowledge', p_values: { content: 'Changed' }, p_id: entry.id }), /immutable/);
  await db.query(`update cac.opportunity set record_version = record_version where id = $1`, [ids.villaOpportunity]);
  assert.match((await ask('second')).body, /10-year warranty/);
});
