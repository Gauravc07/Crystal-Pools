import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, as } from './helpers/db.mjs';

// Masters used by most tests: a batch-tracked tile, a pump, a vendor, the default warehouse and a site store.
async function masters(ctx) {
  const tile = await ctx.rpc('store', 'save_inv_item', { p_values: { name: 'Glass mosaic 25 mm blue', sku: 'tl-mos-25b', category: 'Mosaic & murals', uom: 'box', hsn: '6907', gst_rate: 18, reorder_level: 40, reorder_qty: 100, batch_tracked: true } });
  const pump = await ctx.rpc('store', 'save_inv_item', { p_values: { name: 'Pump 1.5 HP', sku: 'PMP-15', category: 'Filtration & pumps', uom: 'nos', gst_rate: 18, reorder_level: 2 } });
  const vendor = await ctx.rpc('commercial', 'save_vendor', { p_values: { name: 'Demo Tiles Pvt Ltd', gstin: '27abcde1234f1z5', email: 'sales@demo-tiles.example', payment_terms: '30 days' } });
  const main = await ctx.one(`select id from cac.warehouse where code = 'WH-01'`);
  const site = await ctx.rpc('store', 'save_warehouse', { p_values: { name: 'Lonavala site store', code: 'site-lon', type: 'Site store' } });
  return { tile, pump, vendor, main: main.id, site: site.id };
}
async function approvedPo(ctx, m, lines, who = 'store') {
  const po = await ctx.rpc(who, 'save_purchase_order', { p_values: { vendor_id: m.vendor.id, warehouse_id: m.main, lines } });
  await ctx.rpc(who, 'submit_purchase_order', { p_po: po.id });
  await ctx.rpc('commercial', 'review_purchase_order', { p_po: po.id, p_decision: 'approved' });
  return po;
}
const level = (ctx, item, wh, batch = '') => ctx.one(`select qty::float, value::float from cac.stock_level where item_id = $1 and warehouse_id = $2 and batch = $3 and bin = ''`, [item, wh, batch]);
async function project(ctx) {
  return (await ctx.db.query(`select cac.put('project', jsonb_build_object('name', 'Sahyadri build', 'opportunity_id', $1::uuid, 'created_by', $2::uuid)) as p`, [ctx.ids.opportunity, ctx.admin])).rows[0].p;
}

test('masters: SKU normalised and unique, GSTIN and GST validated, roles enforced', async t => {
  const ctx = await setup(t, { seed: false });
  const m = await masters(ctx);
  assert.equal(m.tile.sku, 'TL-MOS-25B');
  assert.equal(m.vendor.gstin, '27ABCDE1234F1Z5');
  await assert.rejects(ctx.rpc('store', 'save_inv_item', { p_values: { name: 'Copy', sku: 'TL-MOS-25B', category: 'Tiles', uom: 'box' } }), /SKU already exists/);
  await assert.rejects(ctx.rpc('store', 'save_inv_item', { p_values: { name: 'X', sku: 'X-1', category: 'Tiles', uom: 'box', gst_rate: 17 } }), /GST rate/);
  await assert.rejects(ctx.rpc('store', 'save_vendor', { p_values: { name: 'Bad', gstin: '12345' } }), /GSTIN must be 15/);
  await assert.rejects(ctx.rpc('sales', 'save_inv_item', { p_values: { name: 'X', sku: 'X-2', category: 'Tiles', uom: 'box' } }), /role/);
  await assert.rejects(ctx.rpc('viewer', 'save_warehouse', { p_values: { name: 'W', code: 'W-9' } }), /role/);
  assert.equal((await ctx.rpc('admin', 'save_warehouse', { p_values: { name: 'Factory', code: 'fac-01', type: 'Factory' } })).code, 'FAC-01');
});

test('purchase orders: priced with GST, approved by Commercial only, never by the person who raised them', async t => {
  const ctx = await setup(t, { seed: false });
  const m = await masters(ctx);
  await assert.rejects(ctx.rpc('store', 'save_purchase_order', { p_values: { vendor_id: m.vendor.id, warehouse_id: m.main, lines: [] } }), /at least one item/);
  await assert.rejects(ctx.rpc('store', 'save_purchase_order', { p_values: { vendor_id: m.vendor.id, warehouse_id: m.main, lines: [{ item_id: m.tile.id, qty: 10, rate: 1 }, { item_id: m.tile.id, qty: 1, rate: 1 }] } }), /appears twice/);
  const po = await ctx.rpc('store', 'save_purchase_order', { p_values: { vendor_id: m.vendor.id, warehouse_id: m.main, lines: [{ item_id: m.tile.id, qty: 100, rate: 450 }, { item_id: m.pump.id, qty: 2, rate: 18500 }] } });
  assert.match(po.name, /^PO\/\d{2}-\d{2}\/0001$/);
  assert.deepEqual([po.subtotal, po.tax, po.total], [82000, 14760, 96760]);
  await assert.rejects(ctx.rpc('store', 'review_purchase_order', { p_po: po.id, p_decision: 'approved' }), /role/);
  await assert.rejects(ctx.rpc('commercial', 'review_purchase_order', { p_po: po.id, p_decision: 'approved' }), /not waiting for approval/);
  await ctx.rpc('store', 'submit_purchase_order', { p_po: po.id });
  await assert.rejects(ctx.rpc('store', 'save_purchase_order', { p_values: { vendor_id: m.vendor.id, warehouse_id: m.main, lines: [{ item_id: m.pump.id, qty: 1, rate: 1 }] }, p_id: po.id }), /Only a draft/);
  await assert.rejects(ctx.rpc('commercial', 'review_purchase_order', { p_po: po.id, p_decision: 'rejected', p_note: '' }), /reason/);
  await ctx.rpc('commercial', 'review_purchase_order', { p_po: po.id, p_decision: 'rejected', p_note: 'Rate above budget' });
  // Rejected → revised by the raiser → approved by Commercial.
  await ctx.rpc('store', 'save_purchase_order', { p_values: { vendor_id: m.vendor.id, warehouse_id: m.main, lines: [{ item_id: m.tile.id, qty: 100, rate: 420 }] }, p_id: po.id });
  await ctx.rpc('store', 'submit_purchase_order', { p_po: po.id });
  assert.equal((await ctx.rpc('commercial', 'review_purchase_order', { p_po: po.id, p_decision: 'approved' })).status, 'approved');
  // Control rule holds even for an admin who raised the order.
  const own = await ctx.rpc('admin', 'save_purchase_order', { p_values: { vendor_id: m.vendor.id, warehouse_id: m.main, lines: [{ item_id: m.pump.id, qty: 1, rate: 18500 }] } });
  await ctx.rpc('admin', 'submit_purchase_order', { p_po: own.id });
  await assert.rejects(ctx.rpc('admin', 'review_purchase_order', { p_po: own.id, p_decision: 'approved' }), /Control rule/);
});

test('goods receipt: against approved POs only, batch required, over-receipt blocked, PO status follows', async t => {
  const ctx = await setup(t, { seed: false });
  const m = await masters(ctx);
  const draft = await ctx.rpc('store', 'save_purchase_order', { p_values: { vendor_id: m.vendor.id, warehouse_id: m.main, lines: [{ item_id: m.pump.id, qty: 1, rate: 1 }] } });
  await assert.rejects(ctx.rpc('store', 'receive_goods', { p_po: draft.id, p_lines: [{ item_id: m.pump.id, qty: 1 }] }), /approved purchase order/);
  const po = await approvedPo(ctx, m, [{ item_id: m.tile.id, qty: 100, rate: 450 }, { item_id: m.pump.id, qty: 2, rate: 18500 }]);
  await assert.rejects(ctx.rpc('store', 'receive_goods', { p_po: po.id, p_lines: [{ item_id: m.tile.id, qty: 60 }] }), /tracked by batch/);
  await assert.rejects(ctx.rpc('store', 'receive_goods', { p_po: po.id, p_lines: [{ item_id: m.tile.id, qty: 101, batch: 'LOT-A' }] }), /up to 100 box more/);
  await assert.rejects(ctx.rpc('commercial', 'receive_goods', { p_po: po.id, p_lines: [{ item_id: m.pump.id, qty: 1 }] }), /role/);
  const grn = await ctx.rpc('store', 'receive_goods', { p_po: po.id, p_lines: [{ item_id: m.tile.id, qty: 60, batch: 'lot-a' }], p_delivery_note: 'DC 5512' });
  assert.match(grn.name, /^GRN\/\d{2}-\d{2}\/0001$/);
  assert.equal(grn.value, 27000);
  assert.equal((await ctx.one(`select status from cac.purchase_order where id = $1`, [po.id])).status, 'partially_received');
  assert.deepEqual(await level(ctx, m.tile.id, m.main, 'LOT-A'), { qty: 60, value: 27000 });
  await assert.rejects(ctx.rpc('store', 'receive_goods', { p_po: po.id, p_lines: [{ item_id: m.tile.id, qty: 41, batch: 'LOT-B' }] }), /up to 40 box more/);
  await ctx.rpc('store', 'receive_goods', { p_po: po.id, p_lines: [{ item_id: m.tile.id, qty: 40, batch: 'LOT-B' }, { item_id: m.pump.id, qty: 2 }] });
  assert.equal((await ctx.one(`select status from cac.purchase_order where id = $1`, [po.id])).status, 'received');
  await assert.rejects(ctx.rpc('store', 'cancel_purchase_order', { p_po: po.id, p_reason: 'Too late' }), /cannot be cancelled/);
  assert.equal((await ctx.all(`select id from cac.stock_move where po_id = $1 and type = 'receipt'`, [po.id])).length, 3);
});

test('moving weighted average: receipts re-average, issues take the average, stock never goes negative', async t => {
  const ctx = await setup(t);
  const m = await masters(ctx);
  const { id: projectId } = await project(ctx);
  await ctx.rpc('store', 'receive_goods', { p_po: (await approvedPo(ctx, m, [{ item_id: m.pump.id, qty: 100, rate: 10 }])).id, p_lines: [{ item_id: m.pump.id, qty: 100 }] });
  await ctx.rpc('store', 'receive_goods', { p_po: (await approvedPo(ctx, m, [{ item_id: m.pump.id, qty: 100, rate: 13 }])).id, p_lines: [{ item_id: m.pump.id, qty: 100 }] });
  assert.deepEqual(await level(ctx, m.pump.id, m.main), { qty: 200, value: 2300 });
  await assert.rejects(ctx.rpc('store', 'issue_stock', { p_values: { item_id: m.pump.id, warehouse_id: m.main, qty: 5 } }), /project/);
  const issue = await ctx.rpc('store', 'issue_stock', { p_values: { item_id: m.pump.id, warehouse_id: m.main, qty: 50, project_id: projectId } });
  assert.deepEqual([issue.type, Number(issue.unit_cost), Number(issue.value), Number(issue.balance_qty)], ['issue', 11.5, 575, 150]);
  assert.match(issue.name, /^ISS\//);
  assert.deepEqual(await level(ctx, m.pump.id, m.main), { qty: 150, value: 1725 });
  await assert.rejects(ctx.rpc('store', 'issue_stock', { p_values: { item_id: m.pump.id, warehouse_id: m.main, qty: 151, project_id: projectId } }), /Only 150 nos of Pump 1.5 HP in stock at WH-01/);
  // Returns are limited to what the project received and come back at its issue cost.
  await assert.rejects(ctx.rpc('store', 'return_stock', { p_values: { item_id: m.pump.id, warehouse_id: m.main, qty: 51, project_id: projectId } }), /Only 50/);
  const ret = await ctx.rpc('store', 'return_stock', { p_values: { item_id: m.pump.id, warehouse_id: m.main, qty: 10, project_id: projectId } });
  assert.equal(Number(ret.value), 115);
  // Transfers keep value: out at the average, in at the same cost.
  const moved = await ctx.rpc('store', 'transfer_stock', { p_values: { item_id: m.pump.id, from_warehouse_id: m.main, to_warehouse_id: m.site, qty: 40 } });
  assert.equal(moved.out.name, moved.in.name);
  assert.equal(Number(moved.out.value), Number(moved.in.value));
  assert.deepEqual(await level(ctx, m.pump.id, m.site), { qty: 40, value: 460 });
  await assert.rejects(ctx.rpc('store', 'transfer_stock', { p_values: { item_id: m.pump.id, from_warehouse_id: m.main, to_warehouse_id: m.main, qty: 1 } }), /different warehouse or bin/);
  // The ledger is append-only.
  await assert.rejects(ctx.db.query(`update cac.stock_move set qty = 1 where id = $1`, [issue.id]), /cannot be changed or deleted/);
  await assert.rejects(ctx.db.query(`delete from cac.stock_move where id = $1`, [issue.id]), /cannot be changed or deleted/);
});

test('material requests: project asks, store issues against them, over-issue blocked, closes when complete', async t => {
  const ctx = await setup(t);
  const m = await masters(ctx);
  const { id: projectId } = await project(ctx);
  await ctx.rpc('store', 'receive_goods', { p_po: (await approvedPo(ctx, m, [{ item_id: m.pump.id, qty: 5, rate: 18000 }])).id, p_lines: [{ item_id: m.pump.id, qty: 5 }] });
  await assert.rejects(ctx.rpc('sales', 'create_material_request', { p_values: { project_id: projectId, warehouse_id: m.main, lines: [{ item_id: m.pump.id, qty: 2 }] } }), /role/);
  const mr = await ctx.rpc('project', 'create_material_request', { p_values: { project_id: projectId, warehouse_id: m.main, lines: [{ item_id: m.pump.id, qty: 3 }], needed_by: '2030-01-01' } });
  assert.match(mr.name, /^MR\//);
  await ctx.rpc('store', 'issue_stock', { p_values: { item_id: m.pump.id, qty: 2, request_id: mr.id } });
  let req = await ctx.one(`select status, lines from cac.material_request where id = $1`, [mr.id]);
  assert.deepEqual([req.status, req.lines[0].issued], ['partially_issued', 2]);
  await assert.rejects(ctx.rpc('store', 'issue_stock', { p_values: { item_id: m.pump.id, qty: 2, request_id: mr.id } }), /only 1 nos remain/);
  await assert.rejects(ctx.rpc('store', 'issue_stock', { p_values: { item_id: m.tile.id, qty: 1, request_id: mr.id, batch: 'X' } }), /not on the material request/);
  const move = await ctx.rpc('store', 'issue_stock', { p_values: { item_id: m.pump.id, qty: 1, request_id: mr.id } });
  assert.equal(move.project_id, projectId);
  req = await ctx.one(`select status from cac.material_request where id = $1`, [mr.id]);
  assert.equal(req.status, 'issued');
  await assert.rejects(ctx.rpc('store', 'issue_stock', { p_values: { item_id: m.pump.id, qty: 1, request_id: mr.id } }), /closed/);
});

test('stock adjustments post only after Commercial approval, never by the requester', async t => {
  const ctx = await setup(t, { seed: false });
  const m = await masters(ctx);
  await assert.rejects(ctx.rpc('store', 'request_adjustment', { p_values: { item_id: m.pump.id, warehouse_id: m.main, qty_change: 5, reason: 'Opening stock' } }), /unit cost/);
  const open = await ctx.rpc('store', 'request_adjustment', { p_values: { item_id: m.pump.id, warehouse_id: m.main, qty_change: 5, unit_cost: 17000, reason: 'Opening stock' } });
  assert.equal(await ctx.one(`select qty from cac.stock_level where item_id = $1`, [m.pump.id]), undefined); // nothing posted yet
  await assert.rejects(ctx.rpc('store', 'review_adjustment', { p_adjustment: open.id, p_decision: 'approved' }), /role/);
  await ctx.rpc('commercial', 'review_adjustment', { p_adjustment: open.id, p_decision: 'approved' });
  assert.deepEqual(await level(ctx, m.pump.id, m.main), { qty: 5, value: 85000 });
  await assert.rejects(ctx.rpc('store', 'request_adjustment', { p_values: { item_id: m.pump.id, warehouse_id: m.main, qty_change: -6, reason: 'Damaged' } }), /Only 5/);
  await assert.rejects(ctx.rpc('store', 'request_adjustment', { p_values: { item_id: m.pump.id, warehouse_id: m.main, qty_change: -1, reason: 'Physical count' } }), /note/);
  const loss = await ctx.rpc('store', 'request_adjustment', { p_values: { item_id: m.pump.id, warehouse_id: m.main, qty_change: -1, reason: 'Damaged', note: 'Cracked housing' } });
  await assert.rejects(ctx.rpc('commercial', 'review_adjustment', { p_adjustment: loss.id, p_decision: 'rejected', p_note: '' }), /reason/);
  await ctx.rpc('commercial', 'review_adjustment', { p_adjustment: loss.id, p_decision: 'approved' });
  assert.deepEqual(await level(ctx, m.pump.id, m.main), { qty: 4, value: 68000 });
  await assert.rejects(ctx.rpc('commercial', 'review_adjustment', { p_adjustment: loss.id, p_decision: 'approved' }), /already been reviewed/);
  // An admin cannot approve an adjustment they requested.
  const own = await ctx.rpc('admin', 'request_adjustment', { p_values: { item_id: m.pump.id, warehouse_id: m.main, qty_change: 1, reason: 'Found' } });
  await assert.rejects(ctx.rpc('admin', 'review_adjustment', { p_adjustment: own.id, p_decision: 'approved' }), /Control rule/);
});

test('drawings vault: numbered drawings, revisions R0/R1, checker differs from drafter, approval supersedes', async t => {
  const ctx = await setup(t);
  const upload = async (drawingId, file = 'a1b2.pdf', mimetype = 'application/pdf', size = 250000) => {
    const path = `${drawingId}/${file}`;
    await ctx.db.query(`insert into storage.objects (bucket_id, name, metadata) values ('cac-drawings', $1, $2)`, [path, JSON.stringify({ mimetype, size })]);
    return path;
  };
  await assert.rejects(ctx.rpc('project', 'create_drawing', { p_values: { name: 'Pool GA', discipline: 'Architectural' } }), /Attach the drawing/);
  await assert.rejects(ctx.rpc('viewer', 'create_drawing', { p_values: { name: 'Pool GA', discipline: 'Architectural', opportunity_id: ctx.ids.opportunity } }), /role/);
  const drawing = await ctx.rpc('project', 'create_drawing', { p_values: { name: 'Pool general arrangement', discipline: 'Structural (RCC)', opportunity_id: ctx.ids.opportunity, site_id: ctx.ids.site } });
  assert.match(drawing.number, /^DRG\/\d{2}-\d{2}\/0001$/);
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
  const d2 = await ctx.rpc('engineer', 'create_drawing', { p_values: { name: 'Filtration layout', discipline: 'Filtration & plumbing', opportunity_id: ctx.ids.opportunity } });
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

test('inventory snapshot and sections: new tables load, the default warehouse exists, sections are settable', async t => {
  const ctx = await setup(t, { seed: false });
  const state = await ctx.rpc('store', 'workspace_state');
  for (const k of ['inv_item', 'warehouse', 'stock_level', 'vendor', 'purchase_order', 'goods_receipt', 'material_request', 'stock_adjustment', 'stock_move', 'drawing', 'drawing_revision']) assert.ok(Array.isArray(state.records[k]), k);
  assert.deepEqual(state.records.warehouse.map(w => w.code), ['WH-01']);
  assert.equal(state.user.role, 'store');
  assert.equal((await ctx.rpc('admin', 'set_setting', { p_key: 'hidden_modules', p_value: 'inventory' })).hidden_modules, 'inventory');
  await assert.rejects(ctx.rpc('admin', 'create_staff', { p_email: 'x@cac.test', p_name: 'X', p_role: 'warehouse', p_password: 'long-enough-password' }), /Invalid role/);
  assert.equal((await ctx.rpc('admin', 'create_staff', { p_email: 'store2@cac.test', p_name: 'Store two', p_role: 'store', p_password: 'long-enough-password' })).role, 'store');
  const backup = await ctx.rpc('admin', 'export_workspace');
  assert.ok(backup.tables.stock_move && backup.tables.drawing_revision && backup.tables.doc_counter);
});
