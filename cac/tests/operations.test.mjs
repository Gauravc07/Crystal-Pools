import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, serviceClient } from './helpers/db.mjs';
import { runOnce } from '../supabase/functions/_shared/worker.js';

test('temporary passwords must be changed: new accounts are flagged, the setup admin is not', async t => {
  const { rpc, staff, one } = await setup(t);
  assert.equal((await rpc('admin', 'workspace_state')).user.must_change_password, false);
  const created = await rpc('admin', 'create_staff', { p_email: 'new.sales@cac.test', p_name: 'New sales', p_role: 'sales', p_password: 'temporary-password-1' });
  assert.equal(created.must_change_password, true);
  assert.equal((await rpc('sales', 'workspace_state')).user.must_change_password, true);
  await rpc('sales', 'password_changed');
  assert.equal((await one(`select must_change_password from cac.staff where user_id = $1`, [staff.sales])).must_change_password, false);
});

test('duplicate customers are blocked by email (any case) and by phone (last 10 digits)', async t => {
  const { rpc } = await setup(t);
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'customer', p_values: { name: 'Copy', email: 'PROJECTS@example.invalid' } }), /already exists: Sahyadri Retreat/);
  await rpc('sales', 'write_record', { p_kind: 'customer', p_values: { name: 'Asha', phone: '+91 98200 12345' } });
  await assert.rejects(rpc('sales', 'write_record', { p_kind: 'customer', p_values: { name: 'Asha again', phone: '098200-12345' } }), /phone number already exists: Asha/);
  assert.ok((await rpc('sales', 'write_record', { p_kind: 'customer', p_values: { name: 'Other', phone: '98200 54321', email: 'other@example.invalid' } })).id);
});

test('tasks can be cancelled with a reason, once', async t => {
  const { rpc, one } = await setup(t);
  const task = await one(`select id from cac.task where status = 'open' limit 1`);
  await assert.rejects(rpc('sales', 'cancel_task', { p_task: task.id, p_reason: '' }), /reason/);
  await assert.rejects(rpc('viewer', 'cancel_task', { p_task: task.id, p_reason: 'Not needed' }), /role/);
  assert.equal((await rpc('sales', 'cancel_task', { p_task: task.id, p_reason: 'Customer already called us' })).status, 'cancelled');
  await assert.rejects(rpc('sales', 'cancel_task', { p_task: task.id, p_reason: 'Again' }), /Only open/);
});

test('manual sending: approved reply recorded once, counts as human response, schedules one follow-up, respects opt-out', async t => {
  const { ids, rpc, db, one, all } = await setup(t);
  const job = await rpc('sales', 'enqueue_run', { p_agent: 'followup', p_target: ids.villaOpportunity, p_input: { message: 'Please share the process.' } });
  await runOnce(serviceClient(db));
  const draft = await one(`select id from cac.draft where run_id = $1`, [job.id]);
  await assert.rejects(rpc('sales', 'mark_sent', { p_kind: 'draft', p_id: draft.id, p_channel: 'WhatsApp' }), /Approval is required/);
  await rpc('sales', 'decide', { p_approval: (await one(`select approval_id from cac.job where id = $1`, [job.id])).approval_id, p_decision: 'approved' });
  await assert.rejects(rpc('sales', 'mark_sent', { p_kind: 'draft', p_id: draft.id, p_channel: 'Carrier pigeon' }), /Choose how it was sent/);
  const sent = await rpc('sales', 'mark_sent', { p_kind: 'draft', p_id: draft.id, p_channel: 'WhatsApp' });
  assert.equal(sent.sent_channel, 'WhatsApp'); assert.ok(sent.sent_at);
  assert.equal((await rpc('sales', 'mark_sent', { p_kind: 'draft', p_id: draft.id, p_channel: 'Email' })).sent_channel, 'WhatsApp');
  const reply = await one(`select type, channel, direction from cac.activity where opportunity_id = $1 and name = 'Message sent'`, [ids.villaOpportunity]);
  assert.deepEqual(reply, { type: 'Human response', channel: 'WhatsApp', direction: 'Outbound' });
  assert.equal((await all(`select id from cac.task where opportunity_id = $1 and name = 'Follow up on sent message'`, [ids.villaOpportunity])).length, 1);
  assert.equal((await rpc('sales', 'workspace_state')).metrics.response.awaiting, 0);
  // Quotes: delivery recorded satisfies the "estimate sent" gate; opted-out customers are blocked.
  await db.query(`update cac.quote set simulated_at = null where id = $1`, [ids.quote]);
  await rpc('commercial', 'mark_sent', { p_kind: 'quote', p_id: ids.quote, p_channel: 'Email' });
  assert.ok((await one(`select simulated_at from cac.quote where id = $1`, [ids.quote])).simulated_at);
  const second = (await db.query(`select cac.put('quote', (select to_jsonb(q) - 'id' - 'version' - 'sent_at' - 'sent_channel' - 'sent_by' - 'simulated_at' from cac.quote q where id = $1) || '{"version": 9, "name": "v9"}') as q`, [ids.quote])).rows[0].q;
  await db.query(`update cac.customer set suppressed = true where id = $1`, [ids.customer]);
  await assert.rejects(rpc('commercial', 'mark_sent', { p_kind: 'quote', p_id: second.id, p_channel: 'Email' }), /opted out/);
});

test('manual review request sending needs the link and the right role', async t => {
  const { ids, rpc, db, one, admin } = await setup(t);
  const project = (await db.query(`select cac.put('project', jsonb_build_object('name','Build','opportunity_id',$1::uuid,'milestones','Done','handover_checklist','Signed','created_by',$2::uuid)) as p`, [ids.opportunity, admin])).rows[0].p;
  await rpc('project', 'complete_project', { p_project: project.id });
  const review = await one(`select id from cac.review_request where project_id = $1`, [project.id]);
  await assert.rejects(rpc('project', 'mark_sent', { p_kind: 'review_request', p_id: review.id, p_channel: 'WhatsApp' }), /review link/);
  await rpc('admin', 'set_setting', { p_key: 'review_url', p_value: 'https://g.page/r/test/review' });
  await assert.rejects(rpc('engineer', 'mark_sent', { p_kind: 'review_request', p_id: review.id, p_channel: 'WhatsApp' }), /role/);
  const sent = await rpc('project', 'mark_sent', { p_kind: 'review_request', p_id: review.id, p_channel: 'WhatsApp' });
  assert.equal(sent.status, 'sent'); assert.equal(sent.sent_channel, 'WhatsApp');
});

test('admin backup exports every table without passwords; others cannot export', async t => {
  const { rpc } = await setup(t);
  await assert.rejects(rpc('sales', 'export_workspace'), /role/);
  const backup = await rpc('admin', 'export_workspace');
  assert.equal(backup.exported_by, 'admin@cac.test');
  assert.equal(backup.tables.customer.length, 2); assert.ok(backup.tables.event.length > 0);
  assert.doesNotMatch(JSON.stringify(backup), /encrypted_password|\$2[aby]\$/);
});
