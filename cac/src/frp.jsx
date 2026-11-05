// Requirement forms and the FRP quotation agent (supabase/migrations/0012).
// Field staff fill a requirement after a customer visit; the agent in the
// database prepares a priced proposal at once; admin or commercial approve it
// and print it in the Crystal Pools fiberglass proposal format. No AI is used.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Check, CheckCircle2, ClipboardList, MessageSquare, Pencil, Plus, Printer, RefreshCw, Send, ShieldCheck, Undo2, X } from 'lucide-react';
import { rpc, toSnake } from './api.js';
import { Badge, Button, DataTable, Sheet, cell, date, dateTime } from './ui.jsx';
import logoUrl from './assets/frp/logo.png';
import filterUrl from './assets/frp/filter.webp';
import pumpUrl from './assets/frp/pump.webp';
import kitUrl from './assets/frp/test-kit.webp';
import './frp.css';

// ── Formatting ─────────────────────────────────────────────────────────────
export const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const rupees = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const num = n => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const ft = n => String(Number(n));
const day = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fullDay = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const list = items => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const upper = s => s.charAt(0).toUpperCase() + s.slice(1);
const many = (n, one, more = `${one}s`) => n === 1 ? one : `${n} ${more}`;
const sizeOf = pool => `${ft(pool.lengthFt)} × ${ft(pool.widthFt)} ft`;

export const isField = state => state.user.role === 'field';
const canPrice = state => ['admin', 'commercial'].includes(state.user.role);
const canRequire = state => ['admin', 'sales', 'commercial', 'field'].includes(state.user.role);

const REQ_STATUS = { submitted: ['Waiting for approval', 'amber'], returned: ['Sent back', 'red'], approved: ['Approved', 'green'] };
const QUOTE_STATUS = { draft: ['Waiting for approval', 'amber'], approved: ['Approved', 'green'], returned: ['Sent back', 'red'], superseded: ['Superseded', undefined] };
const StatusBadge = ({ map, status }) => <Badge tone={(map[status] || [])[1]}>{(map[status] || [status])[0]}</Badge>;

const TILES = {
  'Dark blue': { base: '#3d4f9f', grout: '#8d9ad3' },
  'Light blue': { base: '#4d9dd6', grout: '#a8d2ef' },
  'Aqua': { base: '#2db1be', grout: '#9edee3' },
  'Mixed blue mosaic': { base: '#3a73b6', grout: '#a3c4e6', mix: ['#2c56a3', '#3f84c4', '#5ba4d8', '#3268b0'] },
};
const TILE_COLOURS = Object.keys(TILES);
// The five upgrades on the Mr Nilesh Shukla proposal are offered by default.
const DEFAULT_UPGRADES = ['water_descent_4ft', 'heat_pump', 'lion', 'dolphin', 'jacuzzi'];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => [String(a + i), String(a + i)]);
const EQUIPMENT = [
  { key: 'filter', label: 'Sand filter', options: [['650', '650Ø'], ['700', '700Ø']], show: e => `${e.filter}Ø` },
  { key: 'mediaKg', label: 'Filter media', options: [['100', '100 kg'], ['150', '150 kg'], ['200', '200 kg'], ['250', '250 kg']], show: e => `${e.mediaKg} kg` },
  { key: 'pumpHp', label: 'Re-circulation pump', options: [['1.5', '1.5 hp'], ['2', '2 hp']], show: e => `${ft(e.pumpHp)} hp` },
  { key: 'lights', label: 'Underwater RGB lights', options: range(0, 12), show: e => e.lights },
  { key: 'skimmers', label: 'Wall skimmers', options: range(1, 4), show: e => e.skimmers },
  { key: 'jets', label: 'Turbo jet nozzles', options: range(0, 6), show: e => e.jets },
  { key: 'drains', label: 'Drain points', options: range(0, 3), show: e => e.drains },
  { key: 'suctionPoints', label: 'Suction points', options: range(0, 3), show: e => e.suctionPoints },
  { key: 'ladders', label: 'SS ladders (4 steps)', options: range(0, 3), show: e => e.ladders },
  { key: 'hoseM', label: 'Suction hose', options: [['9', '9 m'], ['11', '11 m'], ['15', '15 m']], show: e => `${e.hoseM} m` },
];

// ── Requirements page ──────────────────────────────────────────────────────
export function RequirementsPage({ ctx, search }) {
  const { state } = ctx, r = state.records, field = isField(state);
  const [view, setView] = useState(field ? 'all' : 'submitted'), [openId, setOpenId] = useState(null), [editing, setEditing] = useState(null);
  const [quoteId, setQuoteId] = useState(null), [viewing, setViewing] = useState(null);
  const reqs = r.frpRequirement || [], quotes = r.frpQuote || [];
  const q = search.toLowerCase();
  const rows = reqs.filter(x => view === 'all' || x.status === view)
    .filter(x => !q || `${x.number} ${x.customerName} ${x.location} ${x.phone} ${x.referredBy || ''}`.toLowerCase().includes(q));
  const takenBy = x => state.users.find(u => u.id === x.createdBy)?.name || '—';
  const tabs = field ? [['all', 'My requirements', reqs.length], ['returned', 'Sent back to me', reqs.filter(x => x.status === 'returned').length]]
    : [['submitted', 'Waiting for approval', reqs.filter(x => x.status === 'submitted').length], ['returned', 'Sent back', reqs.filter(x => x.status === 'returned').length], ['approved', 'Approved', reqs.filter(x => x.status === 'approved').length], ['all', 'All', reqs.length]];
  const current = openId && reqs.find(x => x.id === openId);
  const openQuote = quoteId && quotes.find(x => x.id === quoteId);
  return <>
    <div className="info-strip"><ClipboardList size={20}/><div><strong>{field ? 'One form after every customer visit.' : 'Requirements from customer visits.'}</strong><span>{field
      ? 'Fill in what the customer wants. The FRP quotation agent prepares the quotation straight away, and the office checks and approves it. You can open it here once it is approved.'
      : 'Each requirement already has the quotation the FRP agent prepared from the FRP price list. Review it, then approve it, give a special price or send it back.'}</span></div>
      {canRequire(state) && <Button primary onClick={() => setEditing({})}><Plus size={15}/>New requirement</Button>}</div>
    <div className="tabs">{tabs.map(([key, label, n]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}<span>{n}</span></button>)}</div>
    <DataTable head={field ? ['Requirement', 'Pool', 'Quotation', 'Status', 'Visit'] : ['Requirement', 'Pool', 'Taken by', 'Referred by', 'Quotation', 'Status', 'Visit']} rows={rows} onRow={x => setOpenId(x.id)}
      empty={reqs.length ? ['Nothing here.', 'Change the tab or the search.'] : ['No requirements yet.', field ? 'After a customer visit, tap New requirement and fill in the FRP pool details.' : 'Requirements from customer visits appear here with their quotation.']}
      render={x => {
        const quote = quotes.find(v => v.id === x.quoteId), d = x.details;
        return [cell(<button type="button" className="record-link">{x.customerName}</button>, `${x.number} · ${x.location}`), `FRP · ${ft(d.lengthFt)} × ${ft(d.widthFt)} × ${ft(d.depthFt)} ft`,
          ...(field ? [] : [takenBy(x), x.referredBy || '—']),
          quote ? cell(quote.reference, `${inr(quote.total)}${quote.status === 'approved' && quote.remark ? ' · remark from the office' : ''}`) : <span className="muted">{x.status === 'returned' ? 'Change and resubmit' : 'Prepared, waiting for approval'}</span>,
          <StatusBadge map={REQ_STATUS} status={x.status}/>, x.visitDate ? day(x.visitDate) : '—'];
      }}/>
    {editing && <RequirementForm ctx={ctx} requirement={editing.id ? editing : null} close={() => setEditing(null)} onSaved={id => { setEditing(null); setOpenId(id); }}/>}
    {current && !editing && <RequirementSheet ctx={ctx} requirement={current} close={() => setOpenId(null)} edit={() => setEditing(current)}
      openQuote={quote => field ? setViewing(quote) : setQuoteId(quote.id)}/>}
    {openQuote && <FrpQuoteSheet ctx={ctx} quote={openQuote} close={() => setQuoteId(null)} open={setViewing} show={setQuoteId}/>}
    {viewing && <ProposalViewer quote={viewing} close={() => setViewing(null)}/>}
  </>;
}

function RequirementSheet({ ctx, requirement: x, close, edit, openQuote }) {
  const { state } = ctx, field = isField(state), d = x.details;
  const quotes = (state.records.frpQuote || []).filter(q => q.requirementId === x.id).sort((a, b) => b.version - a.version);
  const latest = quotes.find(q => q.id === x.quoteId);
  const mine = x.createdBy === state.user.id;
  const editable = canRequire(state) && (!field || mine);
  const choice = (key, show) => d[key] == null ? 'Agent decides' : show;
  const officePrices = latest && !field ? officeEdits(latest) : [];
  const fields = [['Phone', x.phone], ['Email', x.email], ['Site location', x.location], ['Site address', x.address], ['Visit date', x.visitDate && day(x.visitDate)],
    ['Taken by', state.users.find(u => u.id === x.createdBy)?.name], ['Referred by', x.referredBy], ['Pool size', `${ft(d.lengthFt)} × ${ft(d.widthFt)} ft, ${ft(d.depthFt)} ft deep`],
    ['Tile print', `${d.tileColour}, ${d.tileSizeIn} × ${d.tileSizeIn} in`],
    ['Equipment', EQUIPMENT.map(f => `${f.label}: ${choice(f.key, d[f.key] == null ? '' : f.options.find(o => o[0] === String(d[f.key]))?.[1] || d[f.key])}`).join(' · ') + ` · Chemical dispenser: ${d.dispenser ? 'yes' : 'no'}`],
    ['Optional upgrades', (d.upgrades || []).map(code => state.frp?.prices?.find(p => p.code === code)?.name || code).join(', ') || 'None'],
    ['Notes', d.notes], ['Office prices', officePrices.join(' · ')]].filter(([, v]) => v);
  return <Sheet large title={x.customerName} eyebrow={`${x.number} · FRP POOL REQUIREMENT`} close={close}>
    <div className="fp-sheet-status"><StatusBadge map={REQ_STATUS} status={x.status}/><span className="muted">Updated {dateTime(x.updatedAt)}</span></div>
    {x.status === 'returned' && <p className="fp-issue block"><Undo2 size={15}/><span><strong>Sent back:</strong> {x.returnNote}</span></p>}
    {latest?.status === 'approved' && latest.remark && <p className="fp-issue ok"><MessageSquare size={15}/><span><strong>Remark from the office:</strong> {latest.remark}</span></p>}
    <div className="record-details">{fields.map(([k, v]) => <div className={`detail-field ${['Equipment', 'Notes', 'Optional upgrades', 'Office prices'].includes(k) ? 'wide' : ''}`} key={k}><label>{k}</label><p>{v}</p></div>)}</div>
    <div className="fp-actions">
      {editable && <Button onClick={edit}><Pencil size={14}/>{x.status === 'returned' ? 'Change and resubmit' : 'Edit requirement'}</Button>}
      {latest ? <Button primary onClick={() => openQuote(latest)}>{field ? <><Printer size={14}/>Open quotation</> : <>Review quotation {latest.reference}</>}</Button>
        : <span className="muted small-text">{field ? (x.status === 'returned' ? 'Change the requirement and submit it again.' : 'The quotation is prepared. You can open it here once the office approves it.') : 'No quotation yet.'}</span>}
    </div>
    {!field && quotes.length > 1 && <><h3 className="section-heading">All versions</h3>{quotes.map(q => <button className="linked-record" key={q.id} onClick={() => openQuote(q)}><span><small>v{q.version} · {date(q.createdAt)}</small>{q.reference} · {inr(q.total)}</span><StatusBadge map={QUOTE_STATUS} status={q.status}/></button>)}</>}
  </Sheet>;
}

// ── Requirement form ───────────────────────────────────────────────────────
const blankDetails = () => ({ lengthFt: '', widthFt: '', depthFt: '', tileColour: 'Dark blue', tileSizeIn: '2', filter: '', mediaKg: '', pumpHp: '', lights: '', skimmers: '', jets: '', drains: '', suctionPoints: '', ladders: '', hoseM: '', dispenser: false, upgrades: [...DEFAULT_UPGRADES], notes: '' });
const fromSaved = d => Object.fromEntries(Object.entries({ ...blankDetails(), ...d }).map(([k, v]) => [k, k === 'upgrades' ? v || [] : typeof v === 'boolean' ? v : v == null ? '' : String(v)]));
const toDetails = d => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === '' ? null : v]));

function RequirementForm({ ctx, requirement, close, onSaved }) {
  const { state, notify, refresh } = ctx, field = isField(state);
  const [values, setValues] = useState(() => requirement ? { customerName: requirement.customerName, phone: requirement.phone, email: requirement.email || '', location: requirement.location, address: requirement.address || '', visitDate: requirement.visitDate || '', referredBy: requirement.referredBy || '' }
    : { customerName: '', phone: '', email: '', location: '', address: '', visitDate: todayIso(), referredBy: '' });
  const [details, setDetails] = useState(() => requirement ? fromSaved(requirement.details) : blankDetails());
  const [preview, setPreview] = useState(null), [previewError, setPreviewError] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const set = (k, v) => setValues(old => ({ ...old, [k]: v })), setD = (k, v) => setDetails(old => ({ ...old, [k]: v }));
  const upgrades = (state.frp?.prices || []).filter(p => p.grp === 'upgrade');
  const sized = details.lengthFt && details.widthFt && details.depthFt;
  // The live summary is the agent itself (preview_frp), run without saving.
  useEffect(() => {
    if (!sized) { setPreview(null); setPreviewError(''); return; }
    let live = true;
    const timer = setTimeout(() => rpc('preview_frp', { p_details: toSnake(toDetails(details)) })
      .then(result => { if (live) { setPreview(result); setPreviewError(''); } })
      .catch(err => { if (live) { setPreview(null); setPreviewError(err.message); } }), 350);
    return () => { live = false; clearTimeout(timer); };
  }, [JSON.stringify(details)]);
  async function submit(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const result = await rpc('submit_frp_requirement', { p_values: toSnake({ type: 'frp_pool', ...values, details: toDetails(details) }), p_id: requirement?.id || null });
      await refresh();
      notify(`Requirement ${result.requirement.number} saved. The FRP quotation agent prepared ${result.quote.reference}${field ? '' : ` at ${inr(result.quote.total)} + GST`} for approval.`);
      onSaved(result.requirement.id);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  const e = preview?.equipment;
  return <Sheet large title={requirement ? `Change ${requirement.number}` : 'New requirement'} eyebrow="AFTER A CUSTOMER VISIT" close={close}>
    <form onSubmit={submit} className="fp-form">
      <div className="form-grid">
        <label className="wide">Requirement type<select value="frp_pool" onChange={() => {}} aria-label="Requirement type"><option value="frp_pool">FRP (fiberglass) pool</option></select></label>
      </div>
      <h3 className="fp-form-title">Customer</h3>
      <div className="form-grid">
        <label>Customer name<input required minLength={2} maxLength={120} value={values.customerName} onChange={ev => set('customerName', ev.target.value)} placeholder="e.g. Mr Nilesh Shukla"/></label>
        <label>Phone<input required type="tel" value={values.phone} onChange={ev => set('phone', ev.target.value)} placeholder="10-digit mobile number"/></label>
        <label>Site location (town or city)<input required maxLength={80} value={values.location} onChange={ev => set('location', ev.target.value)} placeholder="e.g. Mahabaleshwar"/></label>
        <label>Email (optional)<input type="email" value={values.email} onChange={ev => set('email', ev.target.value)}/></label>
        <label>Visit date<input type="date" value={values.visitDate} onChange={ev => set('visitDate', ev.target.value)}/></label>
        <label>Referred by (optional)<input maxLength={120} value={values.referredBy} onChange={ev => set('referredBy', ev.target.value)} placeholder="e.g. Architect Mehta, an existing customer, Instagram"/></label>
        <label className="wide">Site address (optional)<input maxLength={500} value={values.address} onChange={ev => set('address', ev.target.value)}/></label>
      </div>
      <h3 className="fp-form-title">Pool size and finish</h3>
      <div className="form-grid fp-three">
        {[['lengthFt', 'Length (ft)', '30'], ['widthFt', 'Width (ft)', '12'], ['depthFt', 'Depth (ft)', '4.4']].map(([k, label, ph]) =>
          <label key={k}>{label}<input required type="number" inputMode="decimal" min="0" step="0.1" value={details[k]} onChange={ev => setD(k, ev.target.value)} placeholder={ph}/></label>)}
        <label>Tile print colour<select value={details.tileColour} onChange={ev => setD('tileColour', ev.target.value)}>{TILE_COLOURS.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Tile size<select value={details.tileSizeIn} onChange={ev => setD('tileSizeIn', ev.target.value)}><option value="2">2 × 2 in</option><option value="1">1 × 1 in</option></select></label>
        <div className="fp-swatch-cell"><Swatch colour={details.tileColour} size={46}/></div>
      </div>
      <h3 className="fp-form-title">Equipment <span>Leave “Agent decides” unless the customer asked for something specific.</span></h3>
      <div className="form-grid fp-three">
        {EQUIPMENT.map(f => <label key={f.key}>{f.label}<select value={details[f.key]} onChange={ev => setD(f.key, ev.target.value)}>
          <option value="">Agent decides{e ? ` (${f.show(e)})` : ''}</option>{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>)}
        <label className="fp-check"><input type="checkbox" checked={details.dispenser} onChange={ev => setD('dispenser', ev.target.checked)}/>7" chemical dispenser</label>
      </div>
      <h3 className="fp-form-title">Optional upgrades the customer asked about</h3>
      <div className="fp-check-grid">{upgrades.map(u => <label key={u.code} className="fp-check"><input type="checkbox" checked={details.upgrades.includes(u.code)}
        onChange={ev => setD('upgrades', ev.target.checked ? [...details.upgrades, u.code] : details.upgrades.filter(c => c !== u.code))}/>{u.name}</label>)}</div>
      <label className="spaced">Notes for the office (optional)<textarea rows={3} maxLength={2000} value={details.notes} onChange={ev => setD('notes', ev.target.value)} placeholder="Site access, budget, timeline, anything else the customer said"/></label>
      <div className="fp-preview" aria-live="polite">
        <div className="fp-preview-head"><Bot size={17}/><strong>What the FRP quotation agent will prepare</strong><span>Rules only · no AI credits</span></div>
        {!sized ? <p className="muted">Enter the pool length, width and depth to see the sizes and equipment.</p>
          : previewError ? <p className="error-inline">{previewError}</p>
          : !preview ? <p className="muted">Calculating…</p>
          : <><div className="fp-preview-grid">
              <div><small>Fiberglass surface</small><strong>{num(preview.pool.areaSqft)} sq ft</strong></div>
              <div><small>Water</small><strong>{ft(preview.pool.waterDepthFt)} ft deep · {num(preview.pool.volumeL)} L</strong></div>
              <div><small>Filtration</small><strong>{e.filter}Ø · {e.mediaKg} kg · {ft(e.pumpHp)} hp</strong></div>
              <div><small>Fittings</small><strong>{e.lights} lights · {many(e.skimmers, 'skimmer')} · {e.ladders} ladder{e.ladders === 1 ? '' : 's'}</strong></div>
              {!field && preview.total != null && <div className="fp-preview-price"><small>Package price from the FRP price list</small><strong>{inr(preview.total)} + GST</strong></div>}
            </div>{(preview.issues || []).map((i, n) => <p key={n} className={`fp-issue ${i.level}`}>{i.text}</p>)}</>}
      </div>
      {error && <p className="error-inline" role="alert">{error}</p>}
      <div className="form-footer"><Button type="button" onClick={close}>Cancel</Button><Button type="submit" primary disabled={saving}>{saving ? 'Preparing quotation…' : requirement ? 'Save and prepare a new quotation' : 'Submit requirement'}</Button></div>
    </form>
  </Sheet>;
}

// ── Quotations: FRP proposals ──────────────────────────────────────────────
export function FrpQuotesTab({ ctx, search }) {
  const { state } = ctx, quotes = state.records.frpQuote || [];
  const [all, setAll] = useState(false), [openId, setOpenId] = useState(null), [viewing, setViewing] = useState(null);
  const q = search.toLowerCase();
  const rows = quotes.filter(x => all || x.status !== 'superseded').filter(x => !q || `${x.reference} ${x.name}`.toLowerCase().includes(q));
  const current = openId && quotes.find(x => x.id === openId);
  return <>
    <div className="info-strip"><Bot size={20}/><div><strong>Prepared by the FRP quotation agent.</strong><span>Each proposal is built from a requirement form and the FRP price list, with rules only, so no AI credits are used. Approve it to date it and print it for the customer.</span></div>
      <label className="check-filter"><input type="checkbox" checked={all} onChange={ev => setAll(ev.target.checked)}/>Show earlier versions</label></div>
    <DataTable head={['Proposal', 'Pool', 'Package price', 'Status', 'Prepared']} rows={rows} onRow={x => setOpenId(x.id)}
      empty={quotes.length ? ['No proposals match.', 'Change the search.'] : ['No FRP proposals yet.', 'They appear here as soon as a requirement form is submitted.']}
      render={x => [cell(<button type="button" className="record-link">{x.proposal.customer.name}</button>, `${x.reference}${x.version > 1 ? ` · v${x.version}` : ''}`), `${sizeOf(x.proposal.pool)} · ${x.proposal.customer.location}`,
        <>{inr(x.total)}{x.specialPrice != null ? <small>special price</small> : officeEdits(x).length ? <small>office prices</small> : null}</>, <StatusBadge map={QUOTE_STATUS} status={x.status}/>, date(x.createdAt)]}/>
    {current && <FrpQuoteSheet ctx={ctx} quote={current} close={() => setOpenId(null)} open={setViewing} show={setOpenId}/>}
    {viewing && <ProposalViewer quote={viewing} close={() => setViewing(null)}/>}
  </>;
}

function AgentSteps({ quote }) {
  const p = quote.proposal, e = p.equipment, pool = p.pool, auto = new Set(p.auto), t = p.terms;
  const rounded = Math.round(Number(quote.subtotal) / t.roundTo) * t.roundTo;
  const edited = [...(quote.lines || []).filter(l => l.edited).map(l => l.name), ...p.upgrades.filter(u => u.edited).map(u => u.title)];
  const chip = (key, text) => <span key={key} className={auto.has(key) ? 'auto' : ''} title={auto.has(key) ? 'Chosen by the agent' : 'As asked in the requirement'}>{text}</span>;
  return <ol className="fp-steps">
    <li><strong>Read the requirement</strong><span>{p.requirementNumber} from {p.preparedBy?.name || 'staff'}: {sizeOf(pool)}, {ft(pool.depthFt)} ft deep, {pool.tileColour.toLowerCase()} {pool.tileSizeIn} × {pool.tileSizeIn} in tile print.</span></li>
    <li><strong>Calculated the pool</strong><span>{num(pool.areaSqft)} sq ft of fiberglass, {ft(pool.waterDepthFt)} ft of water, {num(pool.volumeL)} L. It needs {num(p.flowM3h)} m³/h of filtration for a {ft(p.turnoverHours)}-hour turnover.</span></li>
    <li><strong>Chose the equipment</strong><span className="fp-chips">{[chip('filter', `${e.filter}Ø filter`), chip('media_kg', `${e.mediaKg} kg media`), chip('pump_hp', `${ft(e.pumpHp)} hp pump`), chip('lights', `${e.lights} lights`),
      chip('skimmers', many(e.skimmers, '1 skimmer', 'skimmers')), chip('jets', `${e.jets} jet${e.jets === 1 ? '' : 's'}`), chip('drains', `${e.drains} drain${e.drains === 1 ? '' : 's'}`),
      chip('suction_points', `${e.suctionPoints} suction`), chip('ladders', `${e.ladders} ladder${e.ladders === 1 ? '' : 's'}`), chip('hose_m', `${e.hoseM} m hose`)]}</span><small>Highlighted: chosen by the agent. The rest: as asked.</small></li>
    {quote.lines && <li><strong>Priced it from the FRP price list</strong><span>{quote.lines.length} lines add up to {rupees(quote.subtotal)}, rounded to {inr(rounded)} + GST.{edited.length ? ` Office prices on ${list(edited)}.` : ''}{quote.specialPrice != null ? ` Special price ${inr(quote.specialPrice)}: ${quote.specialReason}.` : ''}</span></li>}
    <li><strong>Drafted the proposal</strong><span>{quote.reference}, valid {t.validityDays} days, paid in {quote.payments.map(s => `${s.percent}%`).join(' / ')} stages.</span></li>
  </ol>;
}

// ── Office edits: prices for one customer, regenerated by the agent ───────
// Office prices live on the requirement; each quotation line says whether it used one.
const listRate = (state, code) => state.frp?.prices?.find(p => p.code === code)?.rate ?? null;
const rateText = n => n == null ? '' : String(Number(n));
function officeEdits(quote) {
  return [...(quote.lines || []).filter(l => l.edited).map(l => `${l.name}: ${rupees(l.rate)} per ${l.unit}`),
    ...(quote.proposal?.upgrades || []).filter(u => u.edited).map(u => `${u.title}: ${u.price == null ? 'price on request' : inr(u.price)}`)];
}
// Every package line and optional upgrade on the quotation, starting from its office price or the current list rate.
function editableRates(state, x) {
  const start = (item, code) => rateText(item.edited ? item.rate : listRate(state, code));
  return [...(x.lines || []).map(l => ({ code: l.code, name: l.name, unit: l.unit, qty: Number(l.qty), list: listRate(state, l.code), start: start(l, l.code) })),
    ...x.proposal.upgrades.map(u => ({ code: u.code, name: u.title, unit: u.unit, upgrade: true, qty: u.unit === 'sq ft' ? Number(x.proposal.pool.surfaceSqft) : 1, list: listRate(state, u.code), start: start(u, u.code) }))];
}
// What changed from the previous version: rates, quantities, and items added or removed.
function changesFrom(prev, x) {
  if (!prev?.lines || !x.lines) return [];
  const out = [], before = new Map(prev.lines.map(l => [l.code, l]));
  for (const l of x.lines) {
    const b = before.get(l.code); before.delete(l.code);
    if (!b) out.push({ name: l.name, text: `${l.name} added` });
    else {
      if (Number(b.qty) !== Number(l.qty)) out.push({ name: l.name, text: `${l.name}: ${num(b.qty)} → ${num(l.qty)} ${l.unit}` });
      if (Number(b.rate) !== Number(l.rate)) out.push({ name: l.name, text: `${l.name}: ${rupees(b.rate)} → ${rupees(l.rate)} per ${l.unit}` });
    }
  }
  for (const b of before.values()) out.push({ name: b.name, text: `${b.name} removed` });
  const ups = new Map(prev.proposal.upgrades.map(u => [u.code, u])), shown = v => v == null ? 'price on request' : inr(v);
  for (const u of x.proposal.upgrades) {
    const b = ups.get(u.code); ups.delete(u.code);
    if (!b) out.push({ name: u.title, text: `${u.title} added (${shown(u.price)})` });
    else if (b.price !== u.price) out.push({ name: u.title, text: `${u.title}: ${shown(b.price)} → ${shown(u.price)}` });
  }
  for (const b of ups.values()) out.push({ name: b.title, text: `${b.title} removed` });
  return out;
}
// A starting remark for the site user: which items changed and the new package price, without internal rates.
function defaultRemark(prev, x) {
  if (!prev) return '';
  const names = [...new Set(changesFrom(prev, x).map(c => c.name))];
  const total = Number(prev.total) !== Number(x.total) ? ` Package price ${inr(x.total)} + GST (was ${inr(prev.total)}).` : '';
  return names.length || total ? `Updated quotation ${x.reference}.${names.length ? ` Revised: ${list(names)}.` : ''}${total}` : '';
}

function FrpQuoteSheet({ ctx, quote: x, close, open, show }) {
  const { state, notify, refresh } = ctx, p = x.proposal, priced = canPrice(state);
  const quotes = state.records.frpQuote || [];
  const req = (state.records.frpRequirement || []).find(r => r.id === x.requirementId);
  const site = state.users.find(u => u.id === req?.createdBy), direct = !site || site.id === state.user.id;
  const siteName = site?.name || 'the site user';
  const prev = quotes.find(q => q.requirementId === x.requirementId && q.version === x.version - 1);
  const changes = changesFrom(prev, x);
  const [mode, setMode] = useState(''), [price, setPrice] = useState(x.specialPrice ?? ''), [reason, setReason] = useState(x.specialReason || ''), [note, setNote] = useState('');
  const [remark, setRemark] = useState(''), [rates, setRates] = useState({}), [working, setWorking] = useState(false), [error, setError] = useState('');
  const regenerated = useRef(false);
  // A regenerated version opens ready to send, with a remark that says what changed.
  useEffect(() => {
    setPrice(x.specialPrice ?? ''); setReason(x.specialReason || ''); setNote(''); setRates({}); setError('');
    setMode(regenerated.current && x.status === 'draft' && !direct ? 'send' : '');
    setRemark(regenerated.current ? defaultRemark(prev, x) : '');
    regenerated.current = false;
  }, [x.id]);
  const cfg = state.frp?.config;
  const stale = cfg?.pricesConfirmedAt && new Date(x.createdAt) < new Date(cfg.pricesConfirmedAt);
  const go = async (work, message, after) => { setWorking(true); setError(''); try { const result = await work(); await refresh(); notify(typeof message === 'function' ? message(result) : message); setMode(''); after?.(result); } catch (err) { setError(err.message); } finally { setWorking(false); } };

  // Price edits.
  const rows = mode === 'edit' ? editableRates(state, x) : [];
  const valueOf = r => rates[r.code] ?? r.start;
  const dirty = rows.filter(r => valueOf(r) !== r.start);
  const sum = rows.filter(r => !r.upgrade).reduce((s, r) => s + r.qty * Number(valueOf(r) === '' ? r.list || 0 : valueOf(r)), 0);
  const estimate = Math.round(sum / p.terms.roundTo) * p.terms.roundTo;
  const hasOffice = rows.some(r => r.start !== rateText(r.list));
  const regenerate = () => go(() => rpc('regenerate_frp_quote', { p_quote: x.id, p_rates: Object.fromEntries(dirty.map(r => [r.code, valueOf(r)])) }),
    next => `The agent regenerated the quotation as ${next.reference} at ${inr(next.total)} + GST.${direct ? '' : ` Check it, then send it to ${siteName}.`}`,
    next => { regenerated.current = true; show ? show(next.id) : close(); });
  const approve = () => go(() => rpc('review_frp_quote', { p_quote: x.id, p_decision: 'approved', p_note: direct ? '' : remark }),
    direct ? `${x.reference} approved and dated today.` : `${x.reference} approved and sent to ${siteName}.`);
  const startSend = () => { setRemark(old => old || defaultRemark(prev, x)); setMode('send'); };

  const fields = [['Customer', `${p.customer.name} · ${p.customer.phone}`], ['Site', [p.customer.location, p.customer.address].filter(Boolean).join(' · ')], ['Pool', `${sizeOf(p.pool)} × ${ft(p.pool.depthFt)} ft · ${num(p.pool.areaSqft)} sq ft · ${num(p.pool.volumeL)} L`],
    ['Package price', `${inr(x.total)} + GST${x.specialPrice != null ? ' (special price)' : ''}`], [x.status === 'approved' ? 'Valid till' : 'Prepared', x.status === 'approved' ? day(x.validTill) : dateTime(x.createdAt)],
    ['Requirement', `${p.requirementNumber} · taken by ${p.preparedBy?.name || '—'}`], req?.referredBy && ['Referred by', req.referredBy],
    x.approvedBy && [direct ? 'Approved' : 'Approved and sent', `${state.users.find(u => u.id === x.approvedBy)?.name || '—'} · ${dateTime(x.approvedAt)}`],
    x.remark && ['Remark sent', x.remark]].filter(Boolean);
  return <Sheet large title={x.reference} eyebrow={`FRP PROPOSAL · V${x.version}`} close={close}>
    <div className="fp-sheet-status"><StatusBadge map={QUOTE_STATUS} status={x.status}/><span className="muted">{x.name}</span></div>
    <div className="record-details">{fields.map(([k, v]) => <div className={`detail-field ${k === 'Remark sent' ? 'wide' : ''}`} key={k}><label>{k}</label><p>{v}</p></div>)}</div>
    {(x.issues || []).map((i, n) => <p key={n} className={`fp-issue ${i.level}`}>{i.text}</p>)}
    {priced && prev && changes.length > 0 && <div className="fp-changes"><strong>Changes from {prev.reference}</strong><ul>{changes.map((c, i) => <li key={i}>{c.text}</li>)}</ul>
      <span>Package price {inr(prev.total)} → {inr(x.total)} + GST</span></div>}
    {x.status === 'draft' && priced && !cfg?.pricesConfirmedAt && <p className="fp-issue warn">The FRP price list is not confirmed yet. Check it in Settings before approving.</p>}
    {x.status === 'draft' && priced && stale && <p className="fp-issue warn">The price list changed after this proposal was prepared. Re-run the agent to reprice it.</p>}
    <div className="fp-actions">
      <Button primary={x.status !== 'draft' || !priced} onClick={() => open(x)}><Printer size={14}/>Open proposal</Button>
      {x.status === 'draft' && priced && <>
        <Button primary disabled={working || dirty.length > 0} title={dirty.length ? 'Regenerate the quotation with your prices first' : undefined} onClick={direct ? approve : startSend}>
          {direct ? <><Check size={14}/>Approve</> : <><Send size={14}/>Approve and send</>}</Button>
        <Button onClick={() => setMode(mode === 'price' ? '' : 'price')}>Special price</Button>
        <Button onClick={() => setMode(mode === 'back' ? '' : 'back')}><Undo2 size={14}/>Send back</Button>
      </>}
      {priced && ['draft', 'approved'].includes(x.status) && <Button onClick={() => { setRates({}); setMode(mode === 'edit' ? '' : 'edit'); }}><Pencil size={14}/>Edit prices</Button>}
      {priced && x.status !== 'superseded' && <Button disabled={working} onClick={() => go(() => rpc('rerun_frp_agent', { p_requirement: x.requirementId }), 'The agent prepared a new version from the current price list.', next => show ? show(next.id) : close())}><RefreshCw size={14}/>Re-run agent</Button>}
    </div>
    {mode === 'edit' && <div className="fp-panel">
      <p className="fp-hint">Change any rate for this customer only. The FRP price list does not change. Clear a rate to go back to the price list.{x.specialPrice != null ? ' The special price is not carried to the regenerated quotation.' : ''}</p>
      <div className="fp-lines fp-edit"><table><thead><tr><th>Item</th><th>Qty</th><th>Price list</th><th>Rate for this quotation (₹)</th></tr></thead><tbody>
        {rows.map(r => <tr key={r.code} className={valueOf(r) !== r.start ? 'fp-dirty' : ''}><td>{r.name}{r.upgrade && <small>Optional upgrade, priced separately</small>}{!r.upgrade && r.start !== rateText(r.list) && <small>Office price</small>}</td>
          <td>{num(r.qty)} {r.unit}</td><td>{r.list == null ? 'On request' : rupees(r.list)}</td>
          <td><input aria-label={`Rate for ${r.name}`} type="number" min="0" step="0.01" value={valueOf(r)} placeholder={r.list == null ? 'Price on request' : rateText(r.list)}
            onChange={ev => setRates(old => ({ ...old, [r.code]: ev.target.value }))}/></td></tr>)}
        <tr className="fp-sum"><td colSpan={3}>Package price with these rates</td><td>{inr(estimate)}<small>now {inr(x.total)}</small></td></tr>
      </tbody></table></div>
      {dirty.length > 0 ? <p className="fp-issue warn"><RefreshCw size={15}/><span>You changed {many(dirty.length, '1 price', 'prices')}. Regenerate the quotation to apply {dirty.length === 1 ? 'it' : 'them'}{direct ? '' : `, then send it to ${siteName} with a remark`}.</span></p>
        : <p className="muted small-text">Change a rate, then regenerate the quotation.</p>}
      <div className="fp-actions">
        <Button primary disabled={working || !dirty.length} onClick={regenerate}><RefreshCw size={14}/>{working ? 'Regenerating…' : 'Regenerate quotation'}</Button>
        {hasOffice && <Button onClick={() => setRates(Object.fromEntries(rows.filter(r => r.start !== rateText(r.list)).map(r => [r.code, rateText(r.list)])))}>Back to price-list rates</Button>}
        <Button onClick={() => setMode('')}>Cancel</Button>
      </div>
    </div>}
    {mode === 'send' && <div className="fp-panel">
      <label className="fp-remark">Remark for {siteName} (optional)<textarea rows={3} maxLength={1000} value={remark} onChange={ev => setRemark(ev.target.value)} placeholder="e.g. Installation reduced as agreed with the customer. Heat pump now priced."/></label>
      <p className="muted small-text">Approving dates the quotation today. {site ? site.name : 'The site user'} sees it under Requirements, with your remark.</p>
      <div className="fp-actions"><Button primary disabled={working} onClick={approve}><Send size={14}/>{working ? 'Sending…' : `Approve and send to ${siteName}`}</Button><Button onClick={() => setMode('')}>Cancel</Button></div>
    </div>}
    {mode === 'price' && <div className="setting-form"><label>Package price before GST (₹)<input type="number" min="1" value={price} onChange={ev => setPrice(ev.target.value)}/></label><label>Reason<input value={reason} onChange={ev => setReason(ev.target.value)} placeholder="e.g. Festival offer agreed with the owner"/></label>
      <Button primary disabled={working} onClick={() => go(() => rpc('set_frp_special_price', { p_quote: x.id, p_price: price === '' ? null : Number(price), p_reason: reason }), 'Special price saved.')}>Save price</Button>
      {x.specialPrice != null && <Button disabled={working} onClick={() => go(() => rpc('set_frp_special_price', { p_quote: x.id, p_price: null, p_reason: '' }), 'Back to the price-list total.')}>Use price list</Button>}</div>}
    {mode === 'back' && <div className="setting-form"><label>What needs to change<input value={note} onChange={ev => setNote(ev.target.value)} placeholder="e.g. Confirm the depth with the customer"/></label>
      <Button primary disabled={working} onClick={() => go(() => rpc('review_frp_quote', { p_quote: x.id, p_decision: 'returned', p_note: note }), 'Sent back to the person who took the requirement.')}>Send back</Button></div>}
    {error && <p className="error-inline" role="alert">{error}</p>}
    <h3 className="section-heading">What the agent did</h3>
    <AgentSteps quote={x}/>
    {x.lines && <><h3 className="section-heading">Price build-up (internal)</h3>
      <div className="fp-lines"><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
        {x.lines.map(l => <tr key={l.code}><td>{l.name}{l.edited && <small>Office price · list {l.listRate == null ? '—' : rupees(l.listRate)}</small>}</td><td>{num(l.qty)} {l.unit}</td><td>{l.rate == null ? '—' : rupees(l.rate)}</td><td>{rupees(l.amount)}</td></tr>)}
        <tr className="fp-sum"><td colSpan={3}>Sum of lines</td><td>{rupees(x.subtotal)}</td></tr>
        <tr className="fp-sum"><td colSpan={3}>Package price{x.specialPrice != null ? ' (special)' : ''}</td><td>{inr(x.total)}</td></tr>
      </tbody></table></div></>}
    <h3 className="section-heading">Payment stages</h3>
    <div className="fp-pay">{x.payments.map((s, i) => <div key={i}><strong>{s.percent}%</strong><span>{['with the purchase order', 'before dispatch', 'before installation'][i]}</span><b>{inr(s.amount)} + GST</b></div>)}</div>
  </Sheet>;
}

// ── Settings: FRP price list and terms ─────────────────────────────────────
export function FrpPriceSettings({ ctx }) {
  const { state, notify, refresh } = ctx, frp = state.frp || {};
  const cfg = frp.config, key = cfg?.pricesConfirmedAt || 'never';
  const [rates, setRates] = useState({}), [terms, setTerms] = useState(null), [working, setWorking] = useState(false), [error, setError] = useState('');
  useEffect(() => { setRates(Object.fromEntries((frp.prices || []).map(p => [p.code, p.rate == null ? '' : String(p.rate)]))); setTerms(cfg ? JSON.parse(JSON.stringify(cfg.terms)) : null); }, [key]);
  if (!cfg || !terms) return null;
  const setT = (path, value) => setTerms(old => { const next = JSON.parse(JSON.stringify(old)); let o = next; path.slice(0, -1).forEach(k => { o = o[k]; }); o[path.at(-1)] = value; return next; });
  const who = state.users.find(u => u.id === cfg.pricesConfirmedBy)?.name;
  async function save(e) {
    e.preventDefault(); setWorking(true); setError('');
    try {
      await rpc('save_frp_prices', { p_prices: Object.entries(rates).map(([code, rate]) => ({ code, rate: rate === '' ? null : rate })), p_terms: toSnake(terms) });
      await refresh(); notify('FRP price list saved and confirmed. New proposals use these prices.');
    } catch (err) { setError(err.message); } finally { setWorking(false); }
  }
  const row = p => <tr key={p.code}><td><strong>{p.name}</strong>{p.note && <small>{p.note}</small>}</td><td>{p.unit}</td>
    <td><input aria-label={`Rate for ${p.name}`} type="number" min="0" step="0.01" value={rates[p.code] ?? ''} placeholder={p.grp === 'upgrade' ? 'Price on request' : ''} onChange={ev => setRates(old => ({ ...old, [p.code]: ev.target.value }))}/></td></tr>;
  const field = (label, path, props = {}) => <label key={path.join('.')}>{label}<input value={path.reduce((o, k) => o?.[k], terms) ?? ''} onChange={ev => setT(path, props.type === 'number' ? (ev.target.value === '' ? '' : Number(ev.target.value)) : ev.target.value)} {...props}/></label>;
  return <form className="panel settings-card business-settings fp-prices" onSubmit={save}>
    <h2>FRP price list</h2>
    <p>The FRP quotation agent prices every proposal from this list. Rates are before GST.</p>
    {cfg.pricesConfirmedAt ? <p className="fp-issue ok"><CheckCircle2 size={15}/>Confirmed by {who || 'staff'} on {dateTime(cfg.pricesConfirmedAt)}.</p>
      : <p className="fp-issue warn">Not confirmed yet. The defaults come from your quotations to Mr Vishal Lakhani and Mr Nikhil Kulkarni, and some are estimates. Proposals can't be approved until you check them and save.</p>}
    <div className="fp-lines"><table><thead><tr><th>Included in the package</th><th>Unit</th><th>Rate (₹)</th></tr></thead><tbody>{(frp.prices || []).filter(p => p.grp === 'package').map(row)}</tbody></table></div>
    <div className="fp-lines"><table><thead><tr><th>Optional upgrades (blank shows “Price on request”)</th><th>Unit</th><th>Rate (₹)</th></tr></thead><tbody>{(frp.prices || []).filter(p => p.grp === 'upgrade').map(row)}</tbody></table></div>
    <h3 className="fp-form-title">Proposal terms</h3>
    <div className="form-grid fp-three">
      {field('Valid for (days)', ['validityDays'], { type: 'number', min: 1 })}{field('Delivery (working days)', ['deliveryDays'], { type: 'number', min: 1 })}
      {[0, 1, 2].map(i => <label key={i}>{['Advance with PO (%)', 'Before dispatch (%)', 'Before installation (%)'][i]}<input type="number" min="0" max="100" value={terms.payment[i]} onChange={ev => setT(['payment', i], Number(ev.target.value))}/></label>)}
      {field('Shell warranty (years)', ['warranty', 'shell'], { type: 'number', min: 0 })}{field('Filter warranty (years)', ['warranty', 'filter'], { type: 'number', min: 0 })}{field('Pump and valve warranty (years)', ['warranty', 'pump'], { type: 'number', min: 0 })}
    </div>
    <h3 className="fp-form-title">Company details on the proposal</h3>
    <div className="form-grid">
      {field('Company name', ['company', 'name'])}{field('Phone', ['company', 'phone'])}{field('Email', ['company', 'email'], { type: 'email' })}{field('Website', ['company', 'website'])}
      {field('Years of experience', ['company', 'years'])}{field('Happy clients', ['company', 'clients'])}{field('Factory (transport starts here)', ['company', 'factory'])}
      <label className="wide">Address<input value={terms.company.address} onChange={ev => setT(['company', 'address'], ev.target.value)}/></label>
    </div>
    <h3 className="fp-form-title">Agent rules</h3>
    <div className="form-grid fp-three">
      {field('Water level below the edge (ft)', ['freeboardFt'], { type: 'number', step: 0.05, min: 0 })}{field('Litres per cubic foot', ['litresPerCft'], { type: 'number', step: 0.01 })}
      {field('Filtration turnover (hours)', ['turnoverHours'], { type: 'number', step: 0.5 })}
      <label>Round the package price to<select value={terms.roundTo} onChange={ev => setT(['roundTo'], Number(ev.target.value))}>{[1, 10, 100, 1000].map(n => <option key={n} value={n}>₹{n.toLocaleString('en-IN')}</option>)}</select></label>
    </div>
    {error && <p className="error-inline" role="alert">{error}</p>}
    <div className="form-footer"><Button primary type="submit" disabled={working}><ShieldCheck size={15}/>{working ? 'Saving…' : 'Save and confirm prices'}</Button></div>
  </form>;
}

// ── The proposal document (4 A4 pages, Mr Nilesh Shukla format) ───────────
function Swatch({ colour, size = 60 }) {
  const t = TILES[colour] || TILES['Dark blue'], n = 3, s = size / n;
  return <svg className="fp-swatch" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><rect width={size} height={size} fill={t.grout}/>
    {Array.from({ length: n * n }, (_, i) => <rect key={i} x={(i % n) * s + 1} y={Math.floor(i / n) * s + 1} width={s - 2} height={s - 2} fill={t.mix ? t.mix[(i * 7) % t.mix.length] : t.base}/>)}</svg>;
}

function TopView({ p }) {
  const pool = p.pool, e = p.equipment, t = TILES[pool.tileColour] || TILES['Dark blue'];
  const L = Number(pool.lengthFt), W = Number(pool.widthFt);
  const scale = Math.min(330 / L, 150 / W), pw = L * scale, ph = W * scale, x0 = 26, y0 = 18 + (150 - ph) / 2;
  const tile = Number(pool.tileSizeIn) / 12 * scale, g = Math.max(0.12, tile * 0.07), id = `fp-tile-${pool.tileColour.replace(/\W/g, '')}`;
  const top = Math.ceil(e.lights / 2), bottom = Math.floor(e.lights / 2), m = Math.min(pw * 0.07, 22);
  const xs = k => k === 1 ? [x0 + pw / 2] : Array.from({ length: k }, (_, i) => x0 + m + i * (pw - 2 * m) / (k - 1));
  const lights = [...xs(top).map(x => [x, y0 + Math.min(ph * 0.17, 16)]), ...xs(bottom).map(x => [x, y0 + ph - Math.min(ph * 0.17, 16)])];
  const by = y0 + ph + 24, rx = x0 + pw + 24;
  return <svg className="fp-topview" viewBox="0 0 420 230" role="img" aria-label={`Top view of a ${sizeOf(pool)} pool with ${e.lights} lights`}>
    <defs>
      <pattern id={id} width={tile * (t.mix ? 2 : 1)} height={tile * (t.mix ? 2 : 1)} patternUnits="userSpaceOnUse">
        <rect width={tile * 2} height={tile * 2} fill={t.grout}/>
        {(t.mix || [t.base]).slice(0, t.mix ? 4 : 1).map((c, i) => <rect key={i} x={(i % 2) * tile + g} y={Math.floor(i / 2) * tile + g} width={tile - 2 * g} height={tile - 2 * g} fill={c}/>)}
      </pattern>
      <radialGradient id="fp-glow"><stop offset="0" stopColor="#ffe9a8"/><stop offset="1" stopColor="#f5b700"/></radialGradient>
    </defs>
    <rect x={x0 - 7} y={y0 - 7} width={pw + 14} height={ph + 14} rx="12" fill="#e9eef1" stroke="#d3dde3"/>
    <rect x={x0} y={y0} width={pw} height={ph} rx="8" fill={`url(#${id})`}/>
    <rect x={x0} y={y0} width={pw} height={ph} rx="8" fill="none" stroke="#ffffff55" strokeWidth="1.5"/>
    <text x={x0 + pw / 2} y={y0 + ph / 2 + 10} textAnchor="middle" className="fp-topview-label">{sizeOf(pool)}</text>
    {lights.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="8.5" fill="#fff3c8" opacity=".55"/><circle cx={x} cy={y} r="6" fill="url(#fp-glow)"/></g>)}
    {e.ladders > 0 && <rect x={x0 + pw - 12} y={y0 + ph * 0.3} width="3.2" height={ph * 0.4} rx="1.6" fill="#fff"/>}
    <g className="fp-dim"><line x1={x0} y1={by} x2={x0 + pw} y2={by}/><line x1={x0} y1={by - 6} x2={x0} y2={by + 6}/><line x1={x0 + pw} y1={by - 6} x2={x0 + pw} y2={by + 6}/>
      <text x={x0 + pw / 2} y={by + 20} textAnchor="middle">{ft(L)} ft length</text>
      <line x1={rx} y1={y0} x2={rx} y2={y0 + ph}/><line x1={rx - 6} y1={y0} x2={rx + 6} y2={y0}/><line x1={rx - 6} y1={y0 + ph} x2={rx + 6} y2={y0 + ph}/>
      <text x={rx + 17} y={y0 + ph / 2} textAnchor="middle" transform={`rotate(-90 ${rx + 17} ${y0 + ph / 2})`}>{ft(W)} ft width</text></g>
  </svg>;
}

const Icon = {
  check: () => <span className="fp-tick"><Check size={22} strokeWidth={3}/></span>,
  skimmer: () => <svg viewBox="0 0 80 80" aria-hidden="true"><rect x="12" y="22" width="56" height="40" rx="4" fill="#eef2f5" stroke="#9fb2c2" strokeWidth="2"/><rect x="18" y="30" width="44" height="14" rx="2" fill="#fff" stroke="#9fb2c2"/><path d="M18 52h44" stroke="#c4d0da" strokeWidth="3"/><rect x="30" y="14" width="20" height="10" rx="2" fill="#dfe7ee" stroke="#9fb2c2"/></svg>,
  light: () => <svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="27" fill="#eef2f5" stroke="#b9c7d3" strokeWidth="2"/><circle cx="40" cy="40" r="18" fill="#fff" stroke="#cfd9e2" strokeWidth="2"/><circle cx="40" cy="40" r="9" fill="#ffd34d"/><circle cx="33" cy="34" r="3" fill="#ff6fa0"/><circle cx="48" cy="35" r="3" fill="#47b7ff"/><circle cx="40" cy="49" r="3" fill="#5ed17d"/></svg>,
  ladder: () => <svg viewBox="0 0 80 80" aria-hidden="true"><g fill="none" stroke="#8a9aa8" strokeWidth="3.5" strokeLinecap="round"><path d="M26 70V22c0-8 10-12 14-4"/><path d="M50 70V22c0-8 10-12 14-4"/></g><g stroke="#aab6c1" strokeWidth="4" strokeLinecap="round"><path d="M26 36h24M26 48h24M26 60h24"/></g></svg>,
};
const ART = { shell: c => <Swatch colour={c} size={84}/>, filtration: () => <span className="fp-photo duo"><img src={filterUrl} alt=""/><img src={pumpUrl} alt=""/></span>, kit: () => <span className="fp-photo"><img src={kitUrl} alt=""/></span> };

const UPGRADE_ICON = code => code.startsWith('water_descent') ? <svg viewBox="0 0 80 64" aria-hidden="true"><rect x="2" y="4" width="76" height="7" fill="#0b2a5b"/><g fill="none" stroke="#1d9ad6" strokeWidth="4" strokeLinecap="round"><path d="M14 11c5 14-5 26 0 46"/><path d="M34 11c5 14-5 26 0 46"/><path d="M54 11c5 14-5 26 0 46"/></g></svg>
  : code === 'heat_pump' ? <svg viewBox="0 0 64 64" aria-hidden="true"><rect x="3" y="3" width="58" height="58" rx="10" fill="#fff4cf" stroke="#f5b700" strokeWidth="3"/><g fill="none" stroke="#f0a800" strokeWidth="3.5" strokeLinecap="round"><path d="M20 48c-6-8 6-12 0-20s4-10 0-14"/><path d="M32 48c-6-8 6-12 0-20s4-10 0-14"/><path d="M44 48c-6-8 6-12 0-20s4-10 0-14"/></g></svg>
  : code === 'jacuzzi' ? <svg viewBox="0 0 80 64" aria-hidden="true"><rect x="4" y="10" width="72" height="46" rx="16" fill="#dff3fb" stroke="#1d9ad6" strokeWidth="3"/><g fill="#fff"><circle cx="26" cy="34" r="9"/><circle cx="46" cy="26" r="6"/><circle cx="54" cy="42" r="7"/><circle cx="36" cy="46" r="4"/></g></svg>
  : code === 'pool_cover' ? <svg viewBox="0 0 80 64" aria-hidden="true"><rect x="6" y="10" width="68" height="44" rx="6" fill="#dff3fb" stroke="#1d9ad6" strokeWidth="3"/><g stroke="#1d9ad6" strokeWidth="3"><path d="M18 10v44M30 10v44M42 10v44M54 10v44M66 10v44"/></g></svg>
  : <svg viewBox="0 0 80 64" aria-hidden="true"><path d="M16 56h48l-6-12H22z" fill="#cfe3ee" stroke="#6f97b0" strokeWidth="2"/><rect x="34" y="28" width="12" height="16" rx="3" fill="#e8eef2" stroke="#6f97b0" strokeWidth="2"/><g fill="none" stroke="#1d9ad6" strokeWidth="3" strokeLinecap="round"><path d="M40 28c0-14 12-20 22-12"/><path d="M40 28c0-14-12-20-22-12"/><path d="M40 26V8"/></g></svg>;

function includedCards(p) {
  const e = p.equipment, pool = p.pool, w = p.terms.warranty, tile = `${pool.tileSizeIn} in × ${pool.tileSizeIn} in`;
  const fittings = [e.skimmers === 1 ? 'wall skimmer' : `${e.skimmers} wall skimmers`, e.jets === 1 ? 'turbo jet nozzle with air nozzle' : e.jets ? `${e.jets} turbo jet nozzles with air nozzles` : null,
    e.drains === 1 ? 'drain point' : e.drains ? `${e.drains} drain points` : null, e.suctionPoints === 1 ? 'suction point' : e.suctionPoints ? `${e.suctionPoints} suction points` : null].filter(Boolean);
  const fitTitle = upper(list(['skimmer', e.jets && 'jet', e.drains && 'drain', e.suctionPoints && 'suction point'].filter(Boolean)));
  return [
    { key: 'shell', art: ART.shell(pool.tileColour), title: 'Fiberglass pool shell', text: `Multilayer glass-fibre shell (${num(pool.areaSqft)} sq ft) with ISO NPG gel coat in your chosen ${pool.tileColour.toLowerCase()} square tile print (${tile} tiles).` },
    { key: 'filtration', art: ART.filtration(), title: 'Filtration system', text: `${e.filter}Ø sand filter, ${num(e.mediaKg)} kg filter media and a ${ft(e.pumpHp)} hp re-circulation pump, to keep your water clean and clear.` },
    { key: 'fittings', art: <Icon.skimmer/>, title: fitTitle, text: `${upper(list([...fittings, 'all interconnecting plumbing for the main pool']))}.` },
    e.lights > 0 && { key: 'lights', art: <Icon.light/>, title: 'Colour LED lighting', text: `${e.lights} underwater RGB colour light${e.lights === 1 ? '' : 's'} with remote controller, rain-proof driver and electrical cable.` },
    e.ladders > 0 && { key: 'ladder', art: <Icon.ladder/>, title: e.ladders === 1 ? 'Stainless steel ladder' : 'Stainless steel ladders', text: e.ladders === 1 ? '4-step SS ladder for safe, easy entry and exit.' : `${e.ladders} 4-step SS ladders for safe, easy entry and exit.` },
    { key: 'kit', art: ART.kit(), title: 'Maintenance kit', text: `18" brush, suction head, ${e.hoseM} m suction hose, telescopic pole (2.4–4.8 m), deep net and 2-in-1 test kit${e.dispenser ? ', plus a 7" chemical dispenser with chemicals' : ''}.` },
    { key: 'install', art: <Icon.check/>, title: 'Installation and testing', text: 'Our team installs the pool and the equipment above, then tests everything before handover.' },
    { key: 'warranty', art: <Icon.check/>, title: 'Backed by our warranty', text: `Shell ${w.shell} years · Filter ${w.filter} years · Pump and multiport valve ${w.pump} year${w.pump === 1 ? '' : 's'} (on full payment, against manufacturing defect).` },
  ].filter(Boolean);
}

const fileName = (quote) => {
  const p = quote.proposal;
  return `Quotation_${p.customer.name}_${p.customer.location}_FRP_${ft(p.pool.lengthFt)}x${ft(p.pool.widthFt)}_Proposal`.replace(/[^A-Za-z0-9.]+/g, '_').replace(/_+/g, '_');
};

export function ProposalDocument({ quote }) {
  const p = quote.proposal, t = p.terms, c = t.company, pool = p.pool, e = p.equipment, w = t.warranty, pay = quote.payments;
  const [, brand = c.name, suffix = ''] = c.name.match(/^(.*?)\s*(\(.*)$/) || [];
  const signOff = c.name.toUpperCase().replace(/[().]/g, '').replace(/\s+/g, ' ');
  const city = c.address.split(',').slice(-2).map(s => s.replace(/\d+/g, '').trim()).filter(Boolean).join(', ');
  const lineItems = ['Pool shell', 'filtration', e.lights > 0 && 'colour lights', e.ladders > 0 && (e.ladders > 1 ? 'ladders' : 'ladder'), 'maintenance kit', 'installation & testing'].filter(Boolean);
  const intro = list(['filtration', e.lights > 0 && 'colour lighting', e.ladders > 0 && (e.ladders > 1 ? 'ladders' : 'ladder'), 'maintenance kit'].filter(Boolean));
  const cards = includedCards(p);
  const priced = p.upgrades.filter(u => u.price != null).length;
  const draft = quote.status !== 'approved';
  const Foot = ({ n }) => <footer className="fp-foot"><div><span>{c.name} · {c.address}</span><strong>Call {c.phone} · {c.email}</strong></div><span>{n > 1 ? `Ref ${quote.reference} · ` : ''}Page {n} of 4</span></footer>;
  const Head = ({ title, sub }) => <header className="fp-head"><span className="fp-logo"><img src={logoUrl} alt="Crystal Pools"/></span><div><h2>{title}</h2><p>{sub}</p></div><aside><b>FIBERGLASS POOL PROPOSAL</b><span>Prepared for {p.customer.name} · {p.customer.location}</span></aside></header>;
  const Draft = () => draft ? <div className="fp-draft">DRAFT · NOT YET APPROVED</div> : null;
  const H = ({ children, sub }) => <><h3 className="fp-h">{children}</h3>{sub && <p className="fp-hsub">{sub}</p>}</>;
  return <div className="fp-doc">
    {/* Page 1: cover */}
    <section className="fp-page fp-cover">
      <div className="fp-hero"/>
      <svg className="fp-wave" viewBox="0 0 794 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0 34C120 6 230 4 360 28s250 40 434 6V70H0z" fill="#3c9fd0" opacity=".5"/><path d="M0 52C140 24 260 30 400 52s260 26 394-6V90H0z" fill="#fff"/></svg>
      <div className="fp-cover-top"><span className="fp-logo big"><img src={logoUrl} alt="Crystal Pools"/></span>
        <div className="fp-brand"><strong>{brand.toUpperCase()}</strong><b>{suffix.toUpperCase()}</b><span>Committed to excellence — {c.years} years, {c.clients} happy clients</span></div></div>
      <span className="fp-pill">FIBERGLASS POOL PROPOSAL</span>
      <h1 className="fp-title">Your dream swimming pool,<br/><em>built and installed for you.</em></h1>
      <p className="fp-intro">A complete <b>{sizeOf(pool)} fiberglass pool</b> with {intro}, installed and tested by our team. Everything you need to start swimming, in one clear package.</p>
      <div className="fp-card-info">
        <div><small>PREPARED FOR</small><strong>{p.customer.name}</strong><span>{p.customer.location}</span></div>
        <div><small>DATE</small><strong>{day(quote.quoteDate)}</strong></div>
        <div><small>VALID TILL</small><strong>{day(quote.validTill)}</strong><span>{t.validityDays} days</span></div>
        <div><small>REFERENCE</small><strong className="fp-ref">{quote.reference}</strong></div>
      </div>
      <div className="fp-stats">{[[c.years, 'years of pool-building experience'], [c.clients, 'happy clients across India'], [`${w.shell} Years`, 'leak-proof warranty on your pool shell'], [`${t.deliveryDays} Days`, 'working-day delivery from order']]
        .map(([big, small]) => <div key={small}><strong>{big}</strong><span>{small}</span></div>)}</div>
      <div className="fp-package">
        <div><small>YOUR COMPLETE TURNKEY PACKAGE</small><strong>{inr(quote.total)}<em> + GST</em></strong><p>{lineItems.join(' · ')}. No hidden extras inside the pool package.</p></div>
        <aside><small>PAY IN {pay.length} SIMPLE STAGES</small>{pay.map((s, i) => <div key={i}><b>{s.percent}%</b><span>{['to book your pool', 'before dispatch', 'before installation'][i]}</span></div>)}</aside>
      </div>
      <p className="fp-scroll">Scroll on to see exactly what you get, how it works, and what happens next.</p>
      <p className="fp-thanks">Thank you for your enquiry. We would be honoured to build your pool.</p>
      <Foot n={1}/><Draft/>
    </section>

    {/* Page 2: pool at a glance and what is included */}
    <section className="fp-page">
      <Head title="Your pool at a glance" sub="Size, specification and everything included"/>
      <div className="fp-glance">
        <div className="fp-glance-main"><small className="fp-label">TOP VIEW OF YOUR POOL</small><TopView p={p}/>
          <div className="fp-legend">{e.lights > 0 && <span><i className="dot"/>colour LED lights ({e.lights})</span>}{e.ladders > 0 && <span><i className="bar"/>ladder end</span>}</div></div>
        <div className="fp-glance-side">{[[`${ft(pool.depthFt)} ft`, `pool depth (${ft(pool.waterDepthFt)} ft of water)`], [`${num(pool.volumeL)} L`, 'water volume'], [`${num(pool.areaSqft)} sq ft`, 'fiberglass surface'], [`${w.shell} years`, 'leak-proof shell warranty']]
          .map(([big, small]) => <div key={small}><strong>{big}</strong><span>{small}</span></div>)}</div>
        <div className="fp-finish"><Swatch colour={pool.tileColour} size={56}/><p><b>Your selected finish, close-up:</b> {pool.tileColour.toLowerCase()} square tiles, each {pool.tileSizeIn} in × {pool.tileSizeIn} in. The pool above is drawn to true scale, so your floor has {pool.tilesLong} × {pool.tilesWide} tiles ({ft(pool.lengthFt)} ft × {ft(pool.widthFt)} ft).</p></div>
      </div>
      <H sub="Everything below is part of your package price">What is included</H>
      <div className={`fp-cards n${cards.length}`}>{cards.map(card => <div key={card.key}><span className="fp-art">{card.art}</span><div><b>{card.title}</b><p>{card.text}</p></div></div>)}</div>
      <Foot n={2}/><Draft/>
    </section>

    {/* Page 3: optional upgrades and the journey */}
    <section className="fp-page">
      <Head title="Make it even better" sub="Optional upgrades and your journey from order to first swim"/>
      <H sub={p.upgrades.length ? `Not included in the package price.${priced === p.upgrades.length ? '' : priced ? ' Ask us for a price on the others.' : ' Ask us for a price on any of these.'}` : 'Ask us about water descents, heat pumps, fountains and jacuzzis.'}>Optional upgrades</H>
      <div className={`fp-upgrades ${p.upgrades.length % 2 ? 'odd' : ''}`}>{p.upgrades.map(u => <div key={u.code}><span className="fp-uicon">{UPGRADE_ICON(u.code)}</span><div><b>{u.title}</b><p>{u.text}</p>
        <span className="fp-tag">{u.price != null ? `${inr(u.price)} + GST` : 'PRICE ON REQUEST'}</span></div></div>)}</div>
      <H sub="Payments are linked to clear milestones, so you always know what comes next">Your journey: from order to first swim</H>
      <ol className="fp-journey">{[['Confirm', `${pay[0].percent}% advance with your purchase order`, `${inr(pay[0].amount)} + GST`], ['We build', 'Your pool is made in our factory', `${t.deliveryDays} working days`],
        ['Dispatch', `${pay[1].percent}% before dispatch`, `${inr(pay[1].amount)} + GST`], ['Install and test', `${pay[2].percent}% before installation`, `${inr(pay[2].amount)} + GST`], ['Swim!', 'Your pool is ready to enjoy', 'Warranty active']]
        .map(([title, text, tag], i) => <li key={title}><i>{i + 1}</i><b>{title}</b><span>{text}</span><em>{tag}</em></li>)}</ol>
      <div className="fp-promise"><div><small>OUR WARRANTY PROMISE</small><span>On full payment, against manufacturing defect</span></div>
        {[[`${w.shell} yrs`, 'Leak-proof pool shell'], [`${w.filter} yrs`, 'Filter'], [`${w.pump} yr${w.pump === 1 ? '' : 's'}`, 'Pump, multiport valve']].map(([big, small]) => <div key={small}><strong>{big}</strong><span>{small}</span></div>)}</div>
      <Foot n={3}/><Draft/>
    </section>

    {/* Page 4: why Crystal and the terms */}
    <section className="fp-page">
      <Head title="Why Crystal, and what to expect" sub="Clear terms, so there are no surprises"/>
      <H>Why choose a Crystal fiberglass pool</H>
      <div className="fp-why">{[['Factory-built quality', 'Your shell is made in a controlled factory, not improvised on site.'], ['Less time on your site', 'The pool arrives ready to install, so work on your property is shorter and tidier.'],
        ['Smooth, durable surface', 'Gel-coat finish with multilayer glass fibre, vinyl ester and ISO resins.'], [`${c.years.replace('+', '')} years you can trust`, `${c.clients} clients across India, and now India’s first world-class fiberglass pool.`]]
        .map(([b, s]) => <div key={b}><Icon.check/><b>{b}</b><p>{s}</p></div>)}</div>
      <H sub="All the practical details in plain language">Good to know</H>
      <div className="fp-know">
        <div className="blue"><b>Included in your price</b><ul><li>{upper(list(['pool shell', 'filtration', e.lights > 0 && 'lighting', e.ladders > 0 && (e.ladders > 1 ? 'ladders' : 'ladder')].filter(Boolean)).replace(' and ', ', '))}</li><li>Maintenance kit</li><li>Installation and testing labour</li><li>Delivery in {t.deliveryDays} working days from advance with PO</li></ul></div>
        <div className="yellow"><b>Arranged by you</b><ul><li>Excavation and civil work (PCC soling and filtration room)</li><li>Unloading manpower and machinery</li><li>Side deck development</li><li>Accommodation for our staff and labour</li><li>Safe machinery room with water and electricity</li></ul></div>
        <div className="navy"><b>Charged extra, at actual</b><ul><li>GST (tax and octroi)</li><li>Transport from {c.factory ? `${c.factory} factory` : 'our factory'} to {p.customer.location}</li><li>Any extra work outside this quotation</li></ul></div>
      </div>
      <div className="fp-terms"><small>IMPORTANT TERMS</small><p>This quotation is valid for <b>{t.validityDays} days</b> (until {fullDay(quote.validTill)}). Delivery time is {t.deliveryDays} working days from the date of receiving the advance with your purchase order. Money paid in advance to confirm the order is non-refundable in case of cancellation from the client side. Quoted prices are for the scope described in this document.</p></div>
      <div className="fp-ready"><div><h4>Ready to start your pool?</h4><p>Sign below and send us your purchase order with the {pay[0].percent}% advance. Our team will schedule everything with you.</p>
        <div className="fp-sign"><span>Customer signature</span><span>Date</span></div></div>
        <aside><small>TALK TO US</small><strong>{c.phone}</strong><span className="mail">{c.email}</span>{c.website && <span>{c.website}</span>}<span>{city ? `${city} · ` : ''}Pan-India service</span></aside></div>
      <p className="fp-regards">Thanks and regards, for {signOff}</p>
      <Foot n={4}/><Draft/>
    </section>
  </div>;
}

export function ProposalViewer({ quote, close }) {
  const [zoom, setZoom] = useState(1), ref = useRef(null);
  useLayoutEffect(() => { const fit = () => setZoom(Math.min(1, (window.innerWidth - 24) / 820)); fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, []);
  useEffect(() => {
    document.body.classList.add('fp-open');
    const onKey = ev => { if (ev.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey); ref.current?.focus();
    return () => { document.body.classList.remove('fp-open'); window.removeEventListener('keydown', onKey); };
  }, []);
  // The PDF is saved under the customer's name, like Quotation_Mr_Nilesh_Shukla_Mahabaleshwar_FRP_30x12_Proposal.
  const print = () => {
    const title = document.title, restore = () => { document.title = title; window.removeEventListener('afterprint', restore); };
    document.title = fileName(quote); window.addEventListener('afterprint', restore);
    (document.fonts?.ready || Promise.resolve()).then(() => window.print());
  };
  return createPortal(<div className="fp-viewer" role="dialog" aria-modal="true" aria-label={`Proposal ${quote.reference}`} tabIndex={-1} ref={ref}>
    <div className="fp-toolbar"><div><strong>{quote.reference}</strong><span>{quote.status === 'approved' ? `Approved · valid till ${day(quote.validTill)}` : 'Draft: approve it before sending it to the customer'}</span></div>
      <Button primary onClick={print}><Printer size={15}/>Print / save PDF</Button><Button onClick={close} aria-label="Close proposal"><X size={15}/>Close</Button></div>
    <div className="fp-stage" style={{ '--fp-zoom': zoom }}><ProposalDocument quote={quote}/></div>
  </div>, document.body);
}
