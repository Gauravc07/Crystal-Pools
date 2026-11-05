import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, as } from './helpers/db.mjs';

test('drawings vault: numbered drawings, revisions R0/R1, checker differs from drafter, approval supersedes', async t => {
  const ctx = await setup(t);
  const upload = async (drawingId, file = 'a1b2.pdf', mimetype = 'application/pdf', size = 250000) => {
    const path = `${drawingId}/${file}`;
    await ctx.db.query(`insert into storage.objects (bucket_id, name, metadata) values ('cac-drawings', $1, $2)`, [path, JSON.stringify({ mimetype, size })]);
    return path;
  };
  await assert.rejects(ctx.rpc('project', 'create_drawing', { p_values: { name: 'Pool GA', discipline: 'Architectural' } }), /Enter the client or site/);
  await assert.rejects(ctx.rpc('project', 'create_drawing', { p_values: { name: 'Pool GA', discipline: 'Architectural', client: 'X' } }), /Enter the client or site/);
  await assert.rejects(ctx.rpc('project', 'create_drawing', { p_values: { name: '', discipline: 'Architectural', client: 'Sahyadri Retreat' } }), /title/);
  await assert.rejects(ctx.rpc('project', 'create_drawing', { p_values: { name: 'Pool GA', discipline: 'Plumbing art', client: 'Sahyadri Retreat' } }), /discipline/);
  await assert.rejects(ctx.rpc('viewer', 'create_drawing', { p_values: { name: 'Pool GA', discipline: 'Architectural', client: 'Sahyadri Retreat' } }), /role/);
  await assert.rejects(ctx.rpc('commercial', 'create_drawing', { p_values: { name: 'Pool GA', discipline: 'Architectural', client: 'Sahyadri Retreat' } }), /role/);
  const drawing = await ctx.rpc('project', 'create_drawing', { p_values: { name: 'Pool general arrangement', discipline: 'Structural (RCC)', client: 'Sahyadri Retreat · Lonavala' } });
  assert.match(drawing.number, /^DRG\/\d{2}-\d{2}\/0001$/);
  assert.deepEqual([drawing.client, drawing.requirement_id, drawing.status], ['Sahyadri Retreat · Lonavala', null, 'draft']);

  await assert.rejects(ctx.rpc('project', 'add_drawing_revision', { p_drawing: drawing.id, p_path: `${drawing.id}/missing.pdf`, p_name: 'GA.pdf' }), /Upload the file/);
  const r0 = await ctx.rpc('project', 'add_drawing_revision', { p_drawing: drawing.id, p_path: await upload(drawing.id), p_name: 'GA R0.pdf', p_note: 'First issue' });
  assert.equal(r0.revision, 0);
  await assert.rejects(ctx.rpc('project', 'add_drawing_revision', { p_drawing: drawing.id, p_path: await upload(drawing.id, 'c3d4.pdf'), p_name: 'GA.pdf' }), /Finish the open revision/);
  await ctx.rpc('project', 'submit_drawing_revision', { p_revision: r0.id });
  await assert.rejects(ctx.rpc('project', 'review_drawing_revision', { p_revision: r0.id, p_decision: 'approved' }), /role/);
  await assert.rejects(ctx.rpc('engineer', 'review_drawing_revision', { p_revision: r0.id, p_decision: 'rejected', p_note: '' }), /what needs to change/);
  await ctx.rpc('engineer', 'review_drawing_revision', { p_revision: r0.id, p_decision: 'approved', p_note: 'Checked' });
  let d = await ctx.one(`select status, approved_revision, latest_revision from cac.drawing where id = $1`, [drawing.id]);
  assert.deepEqual([d.status, d.approved_revision, d.latest_revision], ['approved', 0, 0]);

  // The engineer drafts R1 and cannot approve it themselves; an admin who did not upload it can.
  const r1 = await ctx.rpc('engineer', 'add_drawing_revision', { p_drawing: drawing.id, p_path: await upload(drawing.id, 'e5f6.dwg', 'image/vnd.dwg', 900000), p_name: 'GA R1.dwg', p_note: 'Deep end 1.8 m' });
  assert.equal(r1.revision, 1);
  await ctx.rpc('engineer', 'submit_drawing_revision', { p_revision: r1.id });
  await assert.rejects(ctx.rpc('engineer', 'review_drawing_revision', { p_revision: r1.id, p_decision: 'approved' }), /someone other than the person who uploaded/);
  await ctx.rpc('admin', 'review_drawing_revision', { p_revision: r1.id, p_decision: 'approved' });
  const revisions = await ctx.all(`select revision, status from cac.drawing_revision where drawing_id = $1 order by revision`, [drawing.id]);
  assert.deepEqual(revisions, [{ revision: 0, status: 'superseded' }, { revision: 1, status: 'approved' }]);
  d = await ctx.one(`select approved_revision from cac.drawing where id = $1`, [drawing.id]);
  assert.equal(d.approved_revision, 1);

  // Wrong file types and oversized files never register.
  const d2 = await ctx.rpc('engineer', 'create_drawing', { p_values: { name: 'Filtration layout', discipline: 'Filtration & plumbing', client: 'Meadow villa' } });
  await assert.rejects(ctx.rpc('engineer', 'add_drawing_revision', { p_drawing: d2.id, p_path: await upload(d2.id, 'x.pdf', 'application/pdf', 60_000_000), p_name: 'big.pdf' }), /up to 50 MB/);
  // The upload policy: only staff who may draft, only into an existing drawing, only drawing file types.
  const can = async (role, name) => as(ctx.db, { user: ctx.staff[role] }, async tx => (await tx.query(`select cac.can_upload_drawing($1) as ok`, [name])).rows[0].ok);
  assert.equal(await can('engineer', `${d2.id}/abc.dxf`), true);
  assert.equal(await can('viewer', `${d2.id}/abc.dxf`), false);
  assert.equal(await can('engineer', `${d2.id}/abc.exe`), false);
  assert.equal(await can('engineer', `00000000-0000-0000-0000-000000000000/abc.pdf`), false);
  const state = await ctx.rpc('viewer', 'workspace_state');
  assert.equal(state.records.drawing.length, 2);
  assert.equal(state.records.drawing_revision.length, 2);
});

test('drawings can belong to an FRP requirement; the client defaults to its customer and site', async t => {
  const ctx = await setup(t);
  const { requirement } = await ctx.rpc('sales', 'submit_frp_requirement', { p_values: {
    customer_name: 'Mr Nilesh Shukla', phone: '98220 12345', location: 'Mahabaleshwar', details: { length_ft: 30, width_ft: 12, depth_ft: 4.4 } } });
  const drawing = await ctx.rpc('engineer', 'create_drawing', { p_values: { name: 'FRP shell shop drawing', discipline: 'FRP', requirement_id: requirement.id } });
  assert.deepEqual([drawing.client, drawing.requirement_id], ['Mr Nilesh Shukla · Mahabaleshwar', requirement.id]);
  const named = await ctx.rpc('engineer', 'create_drawing', { p_values: { name: 'Deck layout', discipline: 'Landscape', requirement_id: requirement.id, client: 'Shukla villa, Mahabaleshwar' } });
  assert.equal(named.client, 'Shukla villa, Mahabaleshwar');
  await assert.rejects(ctx.rpc('engineer', 'create_drawing', { p_values: { name: 'X', discipline: 'FRP', requirement_id: 'not-a-uuid' } }), /Choose a requirement/);
  await assert.rejects(ctx.rpc('engineer', 'create_drawing', { p_values: { name: 'X', discipline: 'FRP', requirement_id: '00000000-0000-0000-0000-000000000000' } }), /Choose a requirement/);
});
