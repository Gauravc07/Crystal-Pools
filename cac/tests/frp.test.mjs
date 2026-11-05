import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, call, as } from './helpers/db.mjs';

// The requirement behind the Mr Nilesh Shukla proposal (FRP/SK/26/Oct/02): 30 × 12 × 4.4 ft,
// dark blue 2 × 2 in tile print, equipment left to the agent, five optional upgrades.
const nilesh = () => ({
  type: 'frp_pool', customer_name: 'Mr Nilesh Shukla', phone: '98220 12345', location: 'Mahabaleshwar', visit_date: '2026-10-11',
  details: { length_ft: 30, width_ft: 12, depth_ft: 4.4, tile_colour: 'Dark blue', tile_size_in: 2, upgrades: ['jacuzzi', 'water_descent_4ft', 'heat_pump', 'lion', 'dolphin'] },
});
const withDetails = (extra, base = nilesh()) => ({ ...base, details: { ...base.details, ...extra } });

async function fieldStaff(ctx, name, email) {
  return (await ctx.db.query(`select (cac.ensure_staff($1, $2, 'field', 'cac-test-password')->>'user_id') as id`, [email, name])).rows[0].id;
}
const as_ = (ctx, user, name, args) => call(ctx.db, name, args, { user });
const today = async ctx => (await ctx.one(`select (now() at time zone 'Asia/Kolkata')::date::text as d`)).d;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const confirmPrices = ctx => ctx.rpc('commercial', 'save_frp_prices', { p_prices: [] });

test('the agent reproduces the Mr Nilesh Shukla proposal from his requirement', async t => {
  const ctx = await setup(t);
  const sagar = await fieldStaff(ctx, 'Sagar Kale', 'sagar@cac.test');
  const { requirement, quote } = await as_(ctx, sagar, 'submit_frp_requirement', { p_values: nilesh() });

  assert.match(requirement.number, /^REQ\/\d{2}-\d{2}\/0001$/);
  assert.equal(requirement.status, 'submitted');
  assert.equal(requirement.quote_id, quote.id);
  assert.match(quote.reference, /^FRP\/SK\/\d{2}\/[A-Z][a-z]{2}\/01$/);
  assert.equal(quote.name, 'Mr Nilesh Shukla · Mahabaleshwar · 30 × 12 ft');
  assert.equal(quote.status, 'draft');

  const p = quote.proposal;
  assert.deepEqual([p.pool.area_sqft, p.pool.surface_sqft, p.pool.water_depth_ft, p.pool.volume_l], [729.6, 360, 4, 41760]);
  assert.deepEqual([p.pool.tiles_long, p.pool.tiles_wide, p.pool.tile_colour, p.pool.tile_size_in], [180, 72, 'Dark blue', 2]);
  const e = p.equipment;
  assert.deepEqual([e.filter, e.media_kg, e.pump_hp, e.lights, e.skimmers, e.jets, e.drains, e.suction_points, e.ladders, e.hose_m, e.dispenser],
    ['650', 100, 2, 4, 1, 1, 1, 0, 1, 9, false]);
  assert.ok(['filter', 'media_kg', 'pump_hp', 'lights', 'hose_m'].every(k => p.auto.includes(k)));
  assert.equal(p.flow_m3h, 10.44);

  // Same package price and payment stages as the PDF.
  assert.equal(quote.total, 728680);
  assert.deepEqual(quote.payments.map(s => [s.percent, s.amount]), [[50, 364340], [40, 291472], [10, 72868]]);
  assert.equal(Math.round(quote.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100, quote.subtotal);
  assert.equal(quote.lines.find(l => l.code === 'shell').qty, 729.6);
  assert.deepEqual(quote.issues, []);

  // Optional upgrades in price-list order, all "price on request" by default.
  assert.deepEqual(p.upgrades.map(u => u.code), ['water_descent_4ft', 'heat_pump', 'lion', 'dolphin', 'jacuzzi']);
  assert.ok(p.upgrades.every(u => u.price === null && u.text));
  assert.equal(days(quote.quote_date, quote.valid_till), 15);
  assert.equal(quote.quote_date, await today(ctx));
  assert.deepEqual([p.customer.name, p.customer.location, p.requirement_number, p.prepared_by.name], ['Mr Nilesh Shukla', 'Mahabaleshwar', requirement.number, 'Sagar Kale']);
  assert.deepEqual([p.terms.company.phone, p.terms.warranty.shell, p.terms.delivery_days], ['7507899555', 10, 28]);

  // Numbering continues per month.
  const second = await as_(ctx, sagar, 'submit_frp_requirement', { p_values: { ...nilesh(), customer_name: 'Mrs Asha Patil', location: 'Wai' } });
  assert.match(second.quote.reference, /\/02$/);
  assert.match(second.requirement.number, /\/0002$/);

  // Past the 99th proposal of a month the number grows to three digits instead of clashing with the 10th.
  await ctx.db.query(`update cac.doc_counter set n = 99 where prefix = 'FRP'`);
  const hundredth = await as_(ctx, sagar, 'submit_frp_requirement', { p_values: { ...nilesh(), customer_name: 'Mr Hundred' } });
  assert.match(hundredth.quote.reference, /^FRP\/SK\/\d{2}\/[A-Z][a-z]{2}\/100$/);
});

test('the agent: sizes from the Jaiswal quote, explicit choices, large pools and swapped sides', async t => {
  const ctx = await setup(t);
  const jaiswal = await ctx.rpc('sales', 'submit_frp_requirement', { p_values: withDetails({ length_ft: 27.5, width_ft: 9.5, depth_ft: 4.7, upgrades: [] }) });
  const jp = jaiswal.quote.proposal;
  assert.deepEqual([jp.pool.area_sqft, jp.pool.volume_l, jp.pool.water_depth_ft, jp.pool.tiles_long], [609.05, 32578, 4.3, 165]);
  assert.equal(jp.equipment.pump_hp, 1.5);
  assert.deepEqual(jp.upgrades, []);
  assert.equal(jaiswal.quote.name, 'Mr Nilesh Shukla · Mahabaleshwar · 27.5 × 9.5 ft');

  // What the employee chose is kept; the rest is the agent's.
  const chosen = await ctx.rpc('sales', 'submit_frp_requirement', { p_values: withDetails({ lights: 6, suction_points: 1, dispenser: true, hose_m: 11, filter: '700', pump_hp: 1.5 }) });
  const c = chosen.quote.proposal;
  assert.deepEqual([c.equipment.lights, c.equipment.suction_points, c.equipment.dispenser, c.equipment.hose_m, c.equipment.filter, c.equipment.media_kg, c.equipment.pump_hp],
    [6, 1, true, 11, '700', 250, 1.5]);
  assert.ok(!c.auto.includes('lights') && !c.auto.includes('filter') && c.auto.includes('media_kg'));
  const codes = chosen.quote.lines.map(l => l.code);
  assert.ok(codes.includes('suction') && codes.includes('dispenser') && codes.includes('filter_700') && codes.includes('pump_1_5'));
  assert.equal(chosen.quote.lines.find(l => l.code === 'light').amount, 6 * 4500);

  // No lights: no driver or remote either.
  const dark = await ctx.rpc('sales', 'submit_frp_requirement', { p_values: withDetails({ lights: 0, ladders: 0 }) });
  assert.ok(!dark.quote.lines.some(l => ['light', 'driver', 'remote', 'ladder'].includes(l.code)));

  // A large pool needs more than one 700Ø filter can do: the agent says so.
  const big = await ctx.rpc('sales', 'submit_frp_requirement', { p_values: withDetails({ length_ft: 50, width_ft: 20, depth_ft: 6 }) });
  assert.equal(big.quote.proposal.equipment.filter, '700');
  assert.equal(big.quote.issues[0].level, 'warn');
  assert.match(big.quote.issues[0].text, /engineer/);
  assert.deepEqual([big.quote.proposal.equipment.skimmers, big.quote.proposal.equipment.jets, big.quote.proposal.equipment.hose_m], [2, 2, 15]);

  // Length is always the longer side.
  const swapped = await ctx.rpc('sales', 'submit_frp_requirement', { p_values: withDetails({ length_ft: 12, width_ft: 30 }) });
  assert.deepEqual([swapped.requirement.details.length_ft, swapped.requirement.details.width_ft], [30, 12]);
  assert.equal(swapped.quote.total, 728680);
});

test('requirement forms are validated and only the right roles submit them', async t => {
  const ctx = await setup(t);
  const bad = (values, pattern) => assert.rejects(ctx.rpc('sales', 'submit_frp_requirement', { p_values: values }), pattern);
  await bad({ ...nilesh(), customer_name: 'A' }, /customer name/);
  await bad({ ...nilesh(), phone: '12345' }, /phone number/);
  await bad({ ...nilesh(), phone: '' }, /phone number/);
  await bad({ ...nilesh(), email: 'not-an-email' }, /valid email/);
  await bad({ ...nilesh(), location: '' }, /site location/);
  await bad({ ...nilesh(), visit_date: 'yesterday' }, /visit date/);
  await bad({ ...nilesh(), type: 'concrete_pool' }, /requirement type/);
  await bad({ ...nilesh(), details: null }, /pool details/);
  await bad(withDetails({ length_ft: '' }), /length, width and depth/);
  await bad(withDetails({ length_ft: 100 }), /Pool length \(ft\) must be between 6 and 60/);
  await bad(withDetails({ depth_ft: 'deep' }), /Pool depth \(ft\) must be a number/);
  await bad(withDetails({ tile_colour: 'Red' }), /tile print colour/);
  await bad(withDetails({ filter: '900' }), /650Ø or 700Ø/);
  await bad(withDetails({ pump_hp: 3 }), /between 1.5 and 2/);
  await bad(withDetails({ lights: 2.5 }), /whole number/);
  await bad(withDetails({ hose_m: 10 }), /9 m, 11 m or 15 m/);
  await bad(withDetails({ upgrades: ['rocket'] }), /from the list/);
  await bad(withDetails({ notes: 'x'.repeat(2001) }), /2,000/);
  for (const role of ['engineer', 'project', 'viewer']) {
    await assert.rejects(ctx.rpc(role, 'submit_frp_requirement', { p_values: nilesh() }), /role/);
    await assert.rejects(ctx.rpc(role, 'preview_frp', { p_details: nilesh().details }), /role/);
  }
  assert.equal((await ctx.rpc('commercial', 'submit_frp_requirement', { p_values: nilesh() })).quote.total, 728680);
  assert.equal((await ctx.rpc('admin', 'submit_frp_requirement', { p_values: nilesh() })).quote.total, 728680);
  // The admin can give field staff a login.
  const created = await ctx.rpc('admin', 'create_staff', { p_email: 'site.visits@cac.test', p_name: 'Site Visits', p_role: 'field', p_password: 'temporary-pass-123' });
  assert.equal(created.role, 'field');
});

test('field staff see only their own requirements and nothing else in CAC', async t => {
  const ctx = await setup(t);
  const sagar = await fieldStaff(ctx, 'Sagar Kale', 'sagar@cac.test');
  const priya = await fieldStaff(ctx, 'Priya Rao', 'priya@cac.test');
  const mine = await as_(ctx, sagar, 'submit_frp_requirement', { p_values: nilesh() });
  const theirs = await as_(ctx, priya, 'submit_frp_requirement', { p_values: { ...nilesh(), customer_name: 'Mr Other' } });
  await ctx.rpc('engineer', 'create_drawing', { p_values: { name: 'Pool GA', discipline: 'FRP', requirement_id: mine.requirement.id } });
  assert.match(theirs.quote.reference, /^FRP\/PR\//);

  const state = await as_(ctx, sagar, 'workspace_state');
  assert.deepEqual(state.records.frp_requirement.map(r => r.id), [mine.requirement.id]);
  assert.deepEqual(state.records.frp_quote, []);   // nothing until it is approved
  assert.deepEqual([state.records.drawing, state.records.drawing_revision], [[], []]);
  assert.deepEqual(state.users.map(u => u.user_id), [sagar]);
  assert.ok(state.frp.prices.length > 0 && state.frp.prices.every(p => !('rate' in p) && !('note' in p)));
  assert.equal(state.frp.config, null);

  // Direct table reads return nothing for field staff (RLS), unlike office staff.
  const count = (user, table) => as(ctx.db, { user }, async tx => Number((await tx.query(`select count(*) from cac.${table}`)).rows[0].count));
  assert.equal(await count(sagar, 'frp_requirement'), 0);
  assert.equal(await count(sagar, 'drawing'), 0);
  assert.equal(await count(sagar, 'frp_price'), 0);
  assert.equal(await count(ctx.admin, 'frp_requirement'), 2);
  assert.equal(await count(ctx.admin, 'drawing'), 1);

  // Field staff change only their own requirements and never see prices in the live summary.
  await assert.rejects(as_(ctx, sagar, 'submit_frp_requirement', { p_values: nilesh(), p_id: theirs.requirement.id }), /your own requirements/);
  const preview = await as_(ctx, sagar, 'preview_frp', { p_details: nilesh().details });
  assert.equal(preview.pool.volume_l, 41760);
  assert.ok(!('total' in preview) && !('lines' in preview) && preview.upgrades.every(u => !('price' in u)));
  assert.equal((await ctx.rpc('sales', 'preview_frp', { p_details: nilesh().details })).total, 728680);

  // Other CAC actions stay closed to them.
  await assert.rejects(as_(ctx, sagar, 'create_drawing', { p_values: { name: 'x', discipline: 'FRP', client: 'Somebody' } }), /role/);
  await assert.rejects(as_(ctx, sagar, 'review_frp_quote', { p_quote: mine.quote.id, p_decision: 'approved' }), /role/);
  await assert.rejects(as_(ctx, sagar, 'save_frp_prices', { p_prices: [] }), /role/);
  await assert.rejects(as_(ctx, sagar, 'export_workspace'), /role/);

  // After approval the proposal (without the internal price build-up) appears for them.
  await confirmPrices(ctx);
  const fresh = await ctx.rpc('commercial', 'rerun_frp_agent', { p_requirement: mine.requirement.id });
  await ctx.rpc('commercial', 'review_frp_quote', { p_quote: fresh.id, p_decision: 'approved' });
  const after = await as_(ctx, sagar, 'workspace_state');
  assert.deepEqual(after.records.frp_quote.map(q => q.id), [fresh.id]);
  assert.ok(!('lines' in after.records.frp_quote[0]) && after.records.frp_quote[0].total === 728680);
  assert.equal(after.records.frp_requirement[0].status, 'approved');
});

test('approval needs a confirmed price list; a price change means the agent reprices first', async t => {
  const ctx = await setup(t);
  const { requirement, quote } = await ctx.rpc('sales', 'submit_frp_requirement', { p_values: nilesh() });
  await assert.rejects(ctx.rpc('sales', 'review_frp_quote', { p_quote: quote.id, p_decision: 'approved' }), /role/);
  await assert.rejects(ctx.rpc('commercial', 'review_frp_quote', { p_quote: quote.id, p_decision: 'approved' }), /Confirm the FRP price list/);
  await confirmPrices(ctx);
  await assert.rejects(ctx.rpc('commercial', 'review_frp_quote', { p_quote: quote.id, p_decision: 'approved' }), /Re-run the agent/);

  const v2 = await ctx.rpc('commercial', 'rerun_frp_agent', { p_requirement: requirement.id });
  assert.equal(v2.version, 2);
  assert.equal(v2.reference, `${quote.reference}-R1`);
  assert.equal((await ctx.one(`select status from cac.frp_quote where id = $1`, [quote.id])).status, 'superseded');
  await assert.rejects(ctx.rpc('commercial', 'review_frp_quote', { p_quote: quote.id, p_decision: 'approved' }), /waiting for approval/);
  await assert.rejects(ctx.rpc('commercial', 'review_frp_quote', { p_quote: v2.id, p_decision: 'maybe' }), /approve or send back/);

  const approved = await ctx.rpc('commercial', 'review_frp_quote', { p_quote: v2.id, p_decision: 'approved' });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.quote_date, await today(ctx));
  assert.equal(days(approved.quote_date, approved.valid_till), 15);
  assert.equal((await ctx.one(`select status from cac.frp_requirement where id = $1`, [requirement.id])).status, 'approved');
  await assert.rejects(ctx.rpc('commercial', 'set_frp_special_price', { p_quote: v2.id, p_price: 1, p_reason: 'late' }), /waiting for approval/);

  // Editing an approved requirement prepares a new draft; the approved one is superseded.
  const edited = await ctx.rpc('sales', 'submit_frp_requirement', { p_values: withDetails({ lights: 6 }), p_id: requirement.id });
  assert.equal(edited.quote.reference, `${quote.reference}-R2`);
  assert.equal(edited.requirement.status, 'submitted');
  assert.equal((await ctx.one(`select status from cac.frp_quote where id = $1`, [v2.id])).status, 'superseded');
  assert.equal(edited.quote.total - v2.total, 2 * 4500);

  // A missing package rate blocks approval.
  await ctx.db.query(`update cac.frp_price set rate = null where code = 'kit'`);
  const missing = await ctx.rpc('commercial', 'rerun_frp_agent', { p_requirement: requirement.id });
  assert.equal(missing.issues[0].level, 'block');
  await ctx.db.query(`update cac.frp_config set prices_confirmed_at = now() - interval '1 day'`);
  await assert.rejects(ctx.rpc('commercial', 'review_frp_quote', { p_quote: missing.id, p_decision: 'approved' }), /no rate for Maintenance kit/);
});

test('special price, sending back and resubmitting', async t => {
  const ctx = await setup(t);
  const sagar = await fieldStaff(ctx, 'Sagar Kale', 'sagar@cac.test');
  const { requirement, quote } = await as_(ctx, sagar, 'submit_frp_requirement', { p_values: nilesh() });

  await assert.rejects(ctx.rpc('sales', 'set_frp_special_price', { p_quote: quote.id, p_price: 700000, p_reason: 'Festival offer' }), /role/);
  await assert.rejects(ctx.rpc('commercial', 'set_frp_special_price', { p_quote: quote.id, p_price: 700000, p_reason: '' }), /reason/);
  await assert.rejects(ctx.rpc('commercial', 'set_frp_special_price', { p_quote: quote.id, p_price: 0, p_reason: 'Free' }), /greater than zero/);
  const special = await ctx.rpc('commercial', 'set_frp_special_price', { p_quote: quote.id, p_price: 700000, p_reason: 'Festival offer' });
  assert.deepEqual([special.total, special.special_price, special.special_reason], [700000, 700000, 'Festival offer']);
  assert.deepEqual(special.payments.map(s => s.amount), [350000, 280000, 70000]);
  const back = await ctx.rpc('commercial', 'set_frp_special_price', { p_quote: quote.id, p_price: null });
  assert.deepEqual([back.total, back.special_price], [728680, null]);

  await assert.rejects(ctx.rpc('commercial', 'review_frp_quote', { p_quote: quote.id, p_decision: 'returned', p_note: '' }), /what needs to change/);
  await ctx.rpc('commercial', 'review_frp_quote', { p_quote: quote.id, p_decision: 'returned', p_note: 'Customer wants 6 lights' });
  const returned = (await as_(ctx, sagar, 'workspace_state')).records.frp_requirement[0];
  assert.deepEqual([returned.status, returned.return_note], ['returned', 'Customer wants 6 lights']);
  await assert.rejects(ctx.rpc('commercial', 'review_frp_quote', { p_quote: quote.id, p_decision: 'approved' }), /waiting for approval/);

  const again = await as_(ctx, sagar, 'submit_frp_requirement', { p_values: withDetails({ lights: 6 }), p_id: requirement.id });
  assert.deepEqual([again.requirement.status, again.requirement.return_note, again.requirement.number], ['submitted', null, requirement.number]);
  assert.equal(again.quote.version, 2);
  assert.equal((await ctx.one(`select status from cac.frp_quote where id = $1`, [quote.id])).status, 'superseded');
});

test('FRP price list and terms: commercial or admin only, validated, used by new proposals', async t => {
  const ctx = await setup(t);
  await assert.rejects(ctx.rpc('sales', 'save_frp_prices', { p_prices: [] }), /role/);
  await assert.rejects(ctx.rpc('commercial', 'save_frp_prices', { p_prices: [{ code: 'shell', rate: '' }] }), /Enter a rate for FRP pool shell/);
  await assert.rejects(ctx.rpc('commercial', 'save_frp_prices', { p_prices: [{ code: 'shell', rate: '0' }] }), /more than zero/);
  await assert.rejects(ctx.rpc('commercial', 'save_frp_prices', { p_prices: [{ code: 'shell', rate: 'a lot' }] }), /number in rupees/);
  await assert.rejects(ctx.rpc('commercial', 'save_frp_prices', { p_prices: [{ code: 'nope', rate: '1' }] }), /Unknown price-list item/);

  const terms = (await ctx.one(`select terms from cac.frp_config`)).terms;
  const badTerms = (patch, pattern) => assert.rejects(ctx.rpc('commercial', 'save_frp_prices', { p_prices: [], p_terms: { ...terms, ...patch } }), pattern);
  await badTerms({ payment: [50, 40, 5] }, /add up to 100/);
  await badTerms({ payment: [0, 90, 10] }, /add up to 100/);
  await badTerms({ validity_days: 0 }, /Validity/);
  await badTerms({ litres_per_cft: 5 }, /Litres per cubic foot/);
  await badTerms({ round_to: 7 }, /Round the package price/);
  await badTerms({ company: { ...terms.company, email: 'nobody' } }, /company email/);

  const saved = await ctx.rpc('admin', 'save_frp_prices', {
    p_prices: [{ code: 'shell', rate: '800' }, { code: 'water_descent_4ft', rate: '20400' }, { code: 'pool_cover', rate: '120' }],
    p_terms: { ...terms, validity_days: 30, payment: [60, 30, 10] },
  });
  assert.ok(saved.config.prices_confirmed_at);
  assert.equal(saved.prices.find(p => p.code === 'shell').rate, 800);

  const { quote } = await ctx.rpc('sales', 'submit_frp_requirement', { p_values: withDetails({ upgrades: ['water_descent_4ft', 'pool_cover', 'lion'] }) });
  assert.equal(quote.lines.find(l => l.code === 'shell').amount, 729.6 * 800);
  assert.equal(days(quote.quote_date, quote.valid_till), 30);
  assert.deepEqual(quote.payments.map(s => s.percent), [60, 30, 10]);
  assert.deepEqual(quote.proposal.upgrades.map(u => [u.code, u.price]), [['water_descent_4ft', 20400], ['lion', null], ['pool_cover', 43200]]);

  // Clearing an upgrade rate goes back to "price on request".
  await ctx.rpc('commercial', 'save_frp_prices', { p_prices: [{ code: 'water_descent_4ft', rate: null }] });
  assert.equal((await ctx.one(`select rate from cac.frp_price where code = 'water_descent_4ft'`)).rate, null);
});

test('the office edits prices, the agent regenerates, and the site user gets the update with a remark', async t => {
  const ctx = await setup(t);
  const sagar = await fieldStaff(ctx, 'Sagar Kale', 'sagar@cac.test');
  const { requirement, quote } = await as_(ctx, sagar, 'submit_frp_requirement', { p_values: { ...nilesh(), referred_by: '  Architect Mehta ' } });
  assert.equal(requirement.referred_by, 'Architect Mehta');
  await confirmPrices(ctx);
  const repriced = await ctx.rpc('commercial', 'rerun_frp_agent', { p_requirement: requirement.id });

  // Admin or commercial only, valid rates only, and something must change.
  await assert.rejects(ctx.rpc('sales', 'regenerate_frp_quote', { p_quote: repriced.id, p_rates: { install: 45000 } }), /role/);
  await assert.rejects(as_(ctx, sagar, 'regenerate_frp_quote', { p_quote: repriced.id, p_rates: { install: 45000 } }), /role/);
  await assert.rejects(ctx.rpc('admin', 'regenerate_frp_quote', { p_quote: repriced.id, p_rates: { install: 'cheap' } }), /Installation and testing \(labour\) must be a number/);
  await assert.rejects(ctx.rpc('admin', 'regenerate_frp_quote', { p_quote: repriced.id, p_rates: { rocket: 1 } }), /Unknown price-list item/);
  await assert.rejects(ctx.rpc('admin', 'regenerate_frp_quote', { p_quote: repriced.id, p_rates: { install: 50000 } }), /No price changed/);
  await assert.rejects(ctx.rpc('admin', 'regenerate_frp_quote', { p_quote: quote.id, p_rates: { install: 45000 } }), /latest version/);

  // Installation at ₹45,000 instead of ₹50,000, and a price for the heat pump.
  const edited = await ctx.rpc('admin', 'regenerate_frp_quote', { p_quote: repriced.id, p_rates: { install: 45000, heat_pump: '185000' } });
  assert.deepEqual([edited.version, edited.reference, edited.status], [3, `${quote.reference}-R2`, 'draft']);
  assert.equal(edited.total, 728680 - 5000);
  const install = edited.lines.find(l => l.code === 'install');
  assert.deepEqual([install.rate, install.list_rate, install.edited], [45000, 50000, true]);
  assert.ok(edited.lines.filter(l => l.code !== 'install').every(l => !l.edited && l.rate === l.list_rate));
  const heat = edited.proposal.upgrades.find(u => u.code === 'heat_pump');
  assert.deepEqual([heat.price, heat.list_rate, heat.edited], [185000, null, true]);
  assert.equal((await ctx.one(`select status from cac.frp_quote where id = $1`, [repriced.id])).status, 'superseded');
  assert.deepEqual((await ctx.one(`select price_overrides from cac.frp_requirement where id = $1`, [requirement.id])).price_overrides, { install: 45000, heat_pump: 185000 });

  // The site user sees nothing until the office approves; approving sends it with the remark.
  assert.deepEqual((await as_(ctx, sagar, 'workspace_state')).records.frp_quote, []);
  await assert.rejects(ctx.rpc('admin', 'review_frp_quote', { p_quote: edited.id, p_decision: 'approved', p_note: 'x'.repeat(1001) }), /1,000/);
  const sent = await ctx.rpc('admin', 'review_frp_quote', { p_quote: edited.id, p_decision: 'approved', p_note: ' Installation reduced as agreed. Heat pump priced. ' });
  assert.deepEqual([sent.status, sent.remark], ['approved', 'Installation reduced as agreed. Heat pump priced.']);
  const field = await as_(ctx, sagar, 'workspace_state');
  assert.deepEqual(field.records.frp_quote.map(q => [q.id, q.remark, q.total]), [[edited.id, 'Installation reduced as agreed. Heat pump priced.', 723680]]);
  assert.ok(!('price_overrides' in field.records.frp_requirement[0]) && !('lines' in field.records.frp_quote[0]));
  assert.deepEqual([field.records.frp_requirement[0].referred_by, field.records.frp_requirement[0].status], ['Architect Mehta', 'approved']);

  // An approved quotation can be revised again; office prices carry into later versions.
  const revised = await ctx.rpc('commercial', 'regenerate_frp_quote', { p_quote: edited.id, p_rates: { install: '', ladder: 15000 } });
  assert.equal(revised.lines.find(l => l.code === 'install').edited, false);
  assert.equal(revised.total, 728680 - 1500);
  assert.equal(revised.proposal.upgrades.find(u => u.code === 'heat_pump').price, 185000);
  assert.equal(revised.remark, null);
  assert.deepEqual((await as_(ctx, sagar, 'workspace_state')).records.frp_quote, []);   // back with the office until approved
  const resubmitted = await as_(ctx, sagar, 'submit_frp_requirement', { p_values: withDetails({ lights: 6 }, { ...nilesh(), referred_by: '' }), p_id: requirement.id });
  assert.equal(resubmitted.requirement.referred_by, null);
  assert.equal(resubmitted.quote.total, 728680 - 1500 + 2 * 4500);
  assert.equal(resubmitted.quote.lines.find(l => l.code === 'ladder').rate, 15000);

  await assert.rejects(ctx.rpc('sales', 'submit_frp_requirement', { p_values: { ...nilesh(), referred_by: 'x'.repeat(121) } }), /Referred by/);
});
