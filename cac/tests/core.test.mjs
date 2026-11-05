import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, as, call } from './helpers/db.mjs';

// CAC is the drawings vault and the FRP quotation agent, nothing else.
const TABLES = ['doc_counter', 'drawing', 'drawing_revision', 'event', 'frp_config', 'frp_price', 'frp_quote', 'frp_requirement', 'staff'];
const FUNCTIONS = ['actor', 'add_drawing_revision', 'blank', 'bootstrap_admin', 'can_upload_drawing', 'columns', 'create_drawing', 'create_staff', 'ensure_staff',
  'export_workspace', 'fail', 'frp_build', 'frp_details', 'frp_generate', 'frp_next_ref', 'frp_num', 'frp_payments', 'get', 'is_staff', 'log', 'next_no', 'num',
  'password_changed', 'preview_frp', 'put', 'regenerate_frp_quote', 'related', 'require_role', 'rerun_frp_agent', 'review_drawing_revision', 'review_frp_quote', 'save_frp_prices',
  'set_frp_special_price', 'set_staff', 'submit_drawing_revision', 'submit_frp_requirement', 'touch', 'workspace_state'];

test('the cac schema holds only the vault and FRP tables and the functions they use', async t => {
  const { all } = await setup(t);
  const tables = (await all(`select tablename from pg_tables where schemaname = 'cac' and tablename <> 'schema_migrations' order by 1`)).map(r => r.tablename);
  assert.deepEqual(tables, TABLES);
  const functions = (await all(`select distinct proname from pg_proc where pronamespace = 'cac'::regnamespace order by 1`)).map(r => r.proname);
  assert.deepEqual(functions, FUNCTIONS);
  const policies = (await all(`select policyname from pg_policies where schemaname = 'storage' order by 1`)).map(r => r.policyname);
  assert.deepEqual(policies, ['cac: staff read drawings', 'cac: staff upload drawings']);
  assert.deepEqual((await all(`select id from storage.buckets order by 1`)).map(r => r.id), ['cac-drawings']);
  const columns = (await all(`select column_name from information_schema.columns where table_schema = 'cac' and table_name = 'drawing' order by ordinal_position`)).map(r => r.column_name);
  assert.ok(columns.includes('client') && columns.includes('requirement_id') && !columns.includes('opportunity_id'));
});

test('temporary passwords must be changed: new accounts are flagged, the setup admin is not', async t => {
  const { rpc, staff, one } = await setup(t);
  assert.equal((await rpc('admin', 'workspace_state')).user.must_change_password, false);
  const created = await rpc('admin', 'create_staff', { p_email: 'new.sales@cac.test', p_name: 'New sales', p_role: 'sales', p_password: 'temporary-password-1' });
  assert.equal(created.must_change_password, true);
  assert.equal((await rpc('sales', 'workspace_state')).user.must_change_password, true);
  await rpc('sales', 'password_changed');
  assert.equal((await one(`select must_change_password from cac.staff where user_id = $1`, [staff.sales])).must_change_password, false);
});

test('staff management: admin only, links existing accounts, keeps one active admin, no inventory role', async t => {
  const { rpc, admin, db, one } = await setup(t);
  await assert.rejects(rpc('sales', 'create_staff', { p_email: 'x@cac.test', p_name: 'X', p_role: 'sales', p_password: 'long-enough-password' }), /role/);
  await assert.rejects(rpc('admin', 'create_staff', { p_email: 'short@cac.test', p_name: 'Short', p_role: 'sales', p_password: 'short' }), /12–256/);
  await assert.rejects(rpc('admin', 'create_staff', { p_email: 'store@cac.test', p_name: 'Store', p_role: 'store', p_password: 'long-enough-password' }), /Invalid role/);
  const created = await rpc('admin', 'create_staff', { p_email: 'New.Estimator@cac.test', p_name: 'Estimator', p_role: 'engineer', p_password: 'long-enough-password' });
  assert.equal(created.email, 'new.estimator@cac.test');
  assert.ok((await one(`select encrypted_password like '$2%' as ok from auth.users where id = $1`, [created.user_id])).ok);
  await db.query(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000bb', 'webadmin@site.test')`);
  assert.equal((await rpc('admin', 'create_staff', { p_email: 'webadmin@site.test', p_name: 'Web admin', p_role: 'viewer' })).user_id, '00000000-0000-0000-0000-0000000000bb');
  const field = await rpc('admin', 'create_staff', { p_email: 'visits@cac.test', p_name: 'Site Visits', p_role: 'field', p_password: 'long-enough-password' });
  assert.equal((await rpc('admin', 'set_staff', { p_user: field.user_id, p_role: 'sales', p_active: true })).role, 'sales');
  await assert.rejects(rpc('admin', 'set_staff', { p_user: admin, p_role: 'sales', p_active: true }), /one active admin/);
});

test('staff can read but never write tables directly; outsiders and helpers are locked out', async t => {
  const { db, admin, rpc } = await setup(t);
  await assert.rejects(as(db, { user: admin }, tx => tx.query(`insert into cac.drawing (name, number, discipline, client) values ('Direct', 'X', 'FRP', 'Direct write')`)), /permission denied/);
  await assert.rejects(as(db, { user: admin }, tx => tx.query(`update cac.frp_price set rate = 1`)), /permission denied/);
  assert.equal((await as(db, { user: admin }, tx => tx.query('select count(*)::int as n from cac.frp_price'))).rows[0].n, 27);
  // A website admin (auth user without a cac.staff row) gets no rows and no workspace.
  await db.query(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'website@admin.test')`);
  const outsider = '00000000-0000-0000-0000-0000000000aa';
  assert.equal((await as(db, { user: outsider }, tx => tx.query('select count(*)::int as n from cac.frp_price'))).rows[0].n, 0);
  await assert.rejects(call(db, 'workspace_state', {}, { user: outsider }), /active staff account/);
  await assert.rejects(call(db, 'workspace_state', {}, { role: 'anon' }), /permission denied/);
  // Internal helpers (which skip role checks) are not callable at all.
  await assert.rejects(call(db, 'put', { p_kind: 'drawing', p_values: { name: 'Bypass' } }, { user: admin }), /permission denied for function/);
  await assert.rejects(call(db, 'frp_generate', { p_requirement: '00000000-0000-0000-0000-000000000000', p_actor: admin }, { user: admin }), /permission denied for function/);
  await assert.rejects(call(db, 'frp_build', { p: {}, p_rates: {} }, { user: admin }), /permission denied for function/);
  assert.equal((await db.query(`select count(*)::int as n from pg_proc where pronamespace = 'cac'::regnamespace and has_function_privilege('anon', oid, 'execute')`)).rows[0].n, 0);
  await assert.rejects(call(db, 'ensure_staff', { p_email: 'x@cac.test', p_name: 'X', p_role: 'admin', p_password: 'long-enough-password' }, { user: admin }), /permission denied for function/);
  const state = await rpc('viewer', 'workspace_state');
  assert.equal(state.user.role, 'viewer');
  assert.deepEqual(Object.keys(state.records).sort(), ['drawing', 'drawing_revision', 'frp_quote', 'frp_requirement']);
  assert.ok(state.frp.prices.length === 27 && state.frp.config.terms);
});

test('admin backup exports the kept tables without passwords; others cannot export', async t => {
  const { rpc } = await setup(t);
  await rpc('engineer', 'create_drawing', { p_values: { name: 'Pool GA', discipline: 'FRP', client: 'Sahyadri Retreat' } });
  await assert.rejects(rpc('sales', 'export_workspace'), /role/);
  const backup = await rpc('admin', 'export_workspace');
  assert.equal(backup.exported_by, 'admin@cac.test');
  assert.deepEqual(Object.keys(backup.tables).sort(), [...TABLES].sort());
  assert.equal(backup.tables.drawing.length, 1);
  assert.ok(backup.tables.event.length > 0);
  assert.doesNotMatch(JSON.stringify(backup), /encrypted_password|\$2[aby]\$/);
});
