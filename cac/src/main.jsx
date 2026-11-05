// Crystal Pools workspace: requirement forms and the FRP quotation agent
// (frp.jsx) and the drawings vault. Everything is enforced by cac.* functions
// in Supabase; this app only signs staff in and calls them.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownToLine, ArrowRight, Check, CheckCircle2, CircleHelp, ClipboardList, DraftingCompass, FileText, FileUp, LoaderCircle, Lock, LogOut, Menu, Plus, Search, Settings2, ShieldCheck, Waves, X, ChevronRight } from 'lucide-react';
import { configured, supabase, rpc, signIn, signOut, loadState, sendPasswordReset, changePassword, openedFromRecoveryLink, markActive, idleExpired, downloadBackup, uploadDrawing, drawingUrl, toSnake } from './api.js';
import { dateTime, nice, Badge, Button, Sheet, DataTable, cell } from './ui.jsx';
import { RequirementsPage, FrpQuotesTab, FrpPriceSettings } from './frp.jsx';
import './styles.css';

// Field staff (customer visits) see only their requirement forms.
const navFor = role => role === 'field' ? [['requirements', ClipboardList, 'Requirements']]
  : [['quotations', FileText, 'Quotations'], ['requirements', ClipboardList, 'Requirements'], ['drawings', DraftingCompass, 'Drawings vault']];
const ROLES = ['admin', 'sales', 'engineer', 'commercial', 'project', 'field', 'viewer'];
const roleLabel = role => role === 'field' ? 'field (customer visits)' : role;
const TITLES = {
  quotations: ['Every quotation, in one place.', 'FRP proposals prepared by the quotation agent from requirement forms and the FRP price list.'],
  drawings: ['Every drawing, every revision, checked.', 'RCC, filtration, tiling and FRP drawings for each client or requirement, with checked and approved revisions.'],
  settings: ['Built around your way of working.', 'Your account, staff access and the FRP price list.'],
};

function App() {
  const [recovery, setRecovery] = useState(openedFromRecoveryLink);
  const [state, setState] = useState(null), [auth, setAuth] = useState(false), [loading, setLoading] = useState(true);
  const [pageState, setPage] = useState('quotations'), [search, setSearch] = useState(''), [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false), [mobile, setMobile] = useState(false), [adding, setAdding] = useState(false);
  const notify = (message, error = false) => setToast({ message, error });
  const refresh = async () => {
    if (!configured) { setLoading(false); return; }
    try { setState(await loadState()); setAuth(true); }
    catch (error) { if (error.status === 401) { setAuth(false); if (error.code) notify(error.message, true); } else notify(error.message, true); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    refresh(); if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') setAuth(false); if (event === 'PASSWORD_RECOVERY') setRecovery(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  // A new sign-in always starts on the home page, never on the previous person's screen.
  useEffect(() => { if (!auth) { setPage('quotations'); setSearch(''); setAdding(false); setMobile(false); } }, [auth]);
  useEffect(() => {
    if (!auth) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 5000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [auth]);
  // Sessions end after 12 hours without activity on this device.
  useEffect(() => {
    if (!auth) return;
    const expire = () => signOut().then(() => { setAuth(false); notify('Signed out after 12 hours without activity.', true); });
    if (idleExpired()) { expire(); return; }
    markActive(); let last = 0; const touch = () => { if (Date.now() - last > 60000) { last = Date.now(); markActive(); } };
    const check = setInterval(() => { if (idleExpired()) expire(); }, 60000);
    ['pointerdown', 'keydown'].forEach(e => window.addEventListener(e, touch));
    return () => { clearInterval(check); ['pointerdown', 'keydown'].forEach(e => window.removeEventListener(e, touch)); };
  }, [auth]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null), 7000); return () => clearTimeout(timer); } }, [toast]);
  useEffect(() => { const handler = e => { if (e.key === 'Escape') { setAdding(false); setMobile(false); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
  async function act(work, message = 'Saved successfully.') {
    setBusy(true);
    try { const result = await work(); await refresh(); notify(typeof message === 'function' ? message(result) : message); return result; }
    catch (error) { notify(error.message, true); return null; }
    finally { setBusy(false); }
  }
  const navigate = next => { setPage(next); setSearch(''); setMobile(false); };
  if (!configured) return <SetupNeeded/>;
  if (loading) return <div className="loading"><Waves size={36}/><p>Opening your workspace…</p></div>;
  if (!auth) return <Login onLogin={() => { setToast(null); return refresh(); }} notify={notify} toast={toast}/>;
  if (recovery || state.user.mustChangePassword) return <SetPasswordScreen reason={recovery ? 'recovery' : 'temporary'} user={state.user}
    onDone={async () => { setRecovery(false); if (location.hash) history.replaceState(null, '', location.pathname); await refresh(); notify('Password changed.'); }}/>;
  const field = state.user.role === 'field';
  const NAV = navFor(state.user.role), pages = [...NAV.map(([key]) => key), 'settings'];
  const page = pages.includes(pageState) ? pageState : NAV[0][0];
  const ctx = { state, act, busy, refresh, notify, canWrite: state.user.role !== 'viewer' };
  const [title, subtitle] = page === 'requirements'
    ? (field ? ['Every customer visit, ready to quote.', 'Fill in a requirement after each visit. The quotation is prepared for you.']
      : ['What customers asked for, ready to quote.', 'Requirements from customer visits, each with the quotation the FRP agent prepared.'])
    : TITLES[page];
  return <div className="app-shell">
    {mobile && <button className="sidebar-scrim" onClick={() => setMobile(false)} aria-label="Close navigation"/>}
    <aside className={`sidebar ${mobile ? 'open' : ''}`}>
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate(NAV[0][0]); }}><span className="brand-mark"><Waves size={27}/></span><span>crystal pools<small>WORKSPACE</small></span></a>
      <nav>{NAV.map(([key, Icon, label]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => navigate(key)}><Icon size={18}/>{label}</button>)}</nav>
      <div className="sidebar-bottom"><nav><button onClick={() => navigate('settings')} className={page === 'settings' ? 'active' : ''}><Settings2 size={17}/>Settings</button></nav>
        <div className="profile"><span className="avatar">{state.user.name.slice(0, 2).toUpperCase()}</span><span>{state.user.name}<small>{nice(state.user.role)}</small></span>
          <button title="Sign out" className="icon-button" onClick={async () => { await signOut(); setAuth(false); }}><LogOut size={16}/></button></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={22}/></button>
        <div className="breadcrumb">Workspace <ChevronRight size={13}/><strong>{NAV.find(([key]) => key === page)?.[2] || nice(page)}</strong></div><div className="topbar-right"><span className="avatar small">CP</span></div></header>
      <main>
        <div className="page-heading"><div><div className="eyebrow">CRYSTAL POOLS / {nice(page).toUpperCase()}</div><h1>{title}</h1><p>{subtitle}</p></div></div>
        {page !== 'settings' && <div className="search-row"><div className="search-field"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${nice(page)}…`} aria-label="Search records"/>
          {search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={14}/></button>}</div>
          <span className="muted small-text">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span></div>}
        {page === 'quotations' && <FrpQuotesTab ctx={ctx} search={search}/>}
        {page === 'requirements' && <RequirementsPage ctx={ctx} search={search}/>}
        {page === 'drawings' && <DrawingsVault ctx={ctx} search={search}/>}
        {page === 'settings' && <><AccountSettings state={state}/><StaffSettings ctx={ctx} onAdd={() => setAdding(true)}/>{['admin', 'commercial'].includes(state.user.role) && <FrpPriceSettings ctx={ctx}/>}</>}
        <footer className="page-footer"><span><Waves size={15}/> Crystal Pools · Workspace</span><span>Requirements, quotations and drawings.</span></footer>
      </main>
    </div>
    {adding && <AddStaff ctx={ctx} close={() => setAdding(false)}/>}
    {toast && <div role="status" className={`toast ${toast.error ? 'error' : ''}`}>{toast.error ? <CircleHelp size={18}/> : <CheckCircle2 size={18}/>}<span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={16}/></button></div>}
  </div>;
}

// ── Sign-in and passwords ──────────────────────────────────────────────────
const Story = ({ eyebrow, children, footer }) => <div className="login-story"><div className="brand"><span className="brand-mark"><Waves size={30}/></span><span>crystal pools<small>WORKSPACE</small></span></div>
  <div><div className="eyebrow">{eyebrow}</div>{children}</div><small>{footer || 'Crystal Pools · Requirements, quotations and drawings'}</small></div>;

function Login({ onLogin, notify, toast }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [working, setWorking] = useState(false);
  return <div className="login-page"><Story eyebrow="FROM CUSTOMER VISIT TO SIGNED QUOTATION"><h1>Good work deserves<br/>room to grow.</h1><p>Requirements from site visits, quotations prepared in minutes, and every drawing checked.</p>
      <div className="login-flow"><span>Visit</span><ArrowRight/><span>Quote</span><ArrowRight/><span>Build</span></div></Story>
    <div className="login-form"><div className="eyebrow">WELCOME TO YOUR WORKSPACE</div><h2>Let’s get things flowing.</h2><p>Sign in with your Crystal Pools staff account.</p>
      <form onSubmit={async e => { e.preventDefault(); setWorking(true); try { await signIn(email, password); await onLogin(); } catch (error) { notify(error.message, true); } finally { setWorking(false); } }}>
        <label>Email address<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required/></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required/></label>
        {toast?.error && <p className="error-inline" role="alert">{toast.message}</p>}
        <Button primary disabled={working} type="submit">{working ? <LoaderCircle className="spin" size={17}/> : <>Enter workspace <ArrowRight size={17}/></>}</Button></form>
      <div className="login-note"><ShieldCheck size={20}/><span>Staff access only<br/><small>Accounts are created by an admin in Settings.</small></span></div>
      <button type="button" className="text-button forgot-link" onClick={async () => { if (!email) { notify('Enter your email address first.', true); return; } try { await sendPasswordReset(email); notify('If this email has an account, a reset link is on its way.'); } catch (error) { notify(error.message, true); } }}>Forgot password?</button></div></div>;
}

function SetPasswordScreen({ reason, user, onDone }) {
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false);
  async function save(e) { e.preventDefault(); setError(''); if (password !== confirm) { setError('The passwords do not match.'); return; } setWorking(true); try { await changePassword(password); await onDone(); } catch (err) { setError(err.message); } finally { setWorking(false); } }
  return <div className="login-page"><Story eyebrow={reason === 'recovery' ? 'PASSWORD RESET' : 'ONE MORE STEP'} footer={user?.email}><h1>Choose your<br/>own password.</h1><p>{reason === 'recovery' ? 'Set a new password for your account.' : 'Your account was created with a temporary password. Replace it before you continue.'}</p></Story>
    <div className="login-form"><h2>New password</h2><form onSubmit={save}>
      <label>New password (12+ characters)<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)}/></label>
      <label>Repeat new password<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)}/></label>
      {error && <p className="error-inline" role="alert">{error}</p>}
      <Button primary disabled={working} type="submit">{working ? <LoaderCircle className="spin" size={17}/> : <>Save password <ArrowRight size={17}/></>}</Button></form></div></div>;
}

function SetupNeeded() {
  return <div className="login-page"><Story eyebrow="SETUP REQUIRED"><h1>Connect the workspace<br/>to Supabase.</h1></Story><div className="login-form"><h2>One step left.</h2>
    <p>Copy <code>cac/.env.example</code> to <code>cac/.env</code>, set <code>VITE_CAC_SUPABASE_URL</code> and <code>VITE_CAC_SUPABASE_PUBLISHABLE_KEY</code>, then restart. The README walks through the full setup.</p></div></div>;
}

// ── Settings: my account and staff ─────────────────────────────────────────
function AccountSettings({ state }) {
  const [password, setPassword] = useState(''), [message, setMessage] = useState(''), [working, setWorking] = useState(false);
  async function save(e) { e.preventDefault(); setWorking(true); setMessage(''); try { await changePassword(password); setPassword(''); setMessage('Password changed.'); } catch (err) { setMessage(err.message); } finally { setWorking(false); } }
  return <section className="panel settings-card business-settings"><h2>My account</h2><p>{state.user.email} · {roleLabel(state.user.role)} · sessions end after 12 hours without activity.</p>
    <form className="setting-form" onSubmit={save}><label>New password (12+ characters)<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)}/></label><Button disabled={working} type="submit">Change password</Button></form>
    {message && <p className="form-note">{message}</p>}
    {state.user.role === 'admin' && <div className="setting-form"><label>Full backup of every CAC table (JSON, no passwords)<span className="muted small-text">Drawing files stay in Supabase Storage. Supabase also keeps its own database backups.</span></label>
      <Button onClick={() => downloadBackup().catch(err => setMessage(err.message))}><ArrowDownToLine size={15}/>Download backup</Button></div>}</section>;
}

function StaffSettings({ ctx, onAdd }) {
  const { state, act, busy } = ctx, admin = state.user.role === 'admin';
  return <section className="panel business-settings"><div className="panel-heading"><div><h2>People & permissions</h2><p>Server-enforced roles for each important decision.</p></div>{admin && <Button primary onClick={onAdd}><Plus size={15}/>Add staff member</Button>}</div>
    {state.users.map(user => <div className="staff-row" key={user.id}><span className="avatar">{user.name.slice(0, 2)}</span><div><strong>{user.name}</strong><small>{user.email}</small></div>
      <Badge tone={user.active ? undefined : 'red'}>{user.active ? roleLabel(user.role) : 'inactive'}</Badge>
      {admin && user.id !== state.user.id && <Button disabled={busy} onClick={() => act(() => rpc('set_staff', { p_user: user.id, p_role: user.role, p_active: !user.active }), user.active ? 'Staff member deactivated.' : 'Staff member reactivated.')}>{user.active ? 'Deactivate' : 'Reactivate'}</Button>}</div>)}</section>;
}

function AddStaff({ ctx, close }) {
  return <FormSheet title="Add staff member" state={ctx.state} close={close} submitLabel="Add staff member" intro="Field staff only see their own requirement forms. Commercial staff set prices and approve quotations. Engineers check drawings."
    fields={[{ key: 'name', label: 'Full name', type: 'text', required: true }, { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Initial password (12+ characters; leave blank for an existing Supabase account)', type: 'password' },
      { key: 'role', label: 'Role', type: 'select', options: ROLES.map(r => [r, roleLabel(r)]), required: true }]}
    onSubmit={async values => { await rpc('create_staff', { p_email: values.email, p_name: values.name, p_role: values.role, p_password: values.password || null }); await ctx.refresh(); ctx.notify('Staff member added. They choose their own password at first sign-in.'); }}/>;
}

// ── Forms ──────────────────────────────────────────────────────────────────
function Field({ field, value, onChange }) {
  const options = (field.options || []).map(o => Array.isArray(o) ? o : [o, o]);
  const common = { 'aria-label': field.label, value: value ?? '', onChange: e => onChange(e.target.value), required: field.required };
  return <label className={field.type === 'textarea' ? 'wide' : ''}>{field.label}
    {field.type === 'select' ? <select {...common}><option value="">{field.placeholder || `Choose ${field.label.toLowerCase()}`}</option>{options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      : field.type === 'textarea' ? <textarea {...common} rows={3}/>
      : <input {...common} type={field.type} minLength={field.type === 'password' && value ? 12 : undefined}/>}</label>;
}
// A form in a dialog. onSubmit throws to keep the dialog open with the error shown.
function FormSheet({ title, fields, initial = {}, submitLabel = 'Save', onSubmit, close, intro }) {
  const [values, setValues] = useState(initial), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  return <Sheet title={title} close={close}><form onSubmit={async e => { e.preventDefault(); setSaving(true); setError(''); try { await onSubmit(values); close(); } catch (err) { setError(err.message); } finally { setSaving(false); } }}>
    <div className="form-grid">{intro && <p className="wide muted">{intro}</p>}{fields.map(field => <Field key={field.key} field={field} value={values[field.key]} onChange={value => setValues(old => ({ ...old, [field.key]: value }))}/>)}</div>
    {error && <p className="error-inline" role="alert">{error}</p>}
    <div className="form-footer"><Button type="button" onClick={close}>Cancel</Button><Button type="submit" primary disabled={saving}>{saving ? 'Saving…' : submitLabel}</Button></div></form></Sheet>;
}

// ── Drawings vault ─────────────────────────────────────────────────────────
const DISCIPLINES = ['Architectural', 'Structural (RCC)', 'Filtration & plumbing', 'Electrical', 'Tiling & finishes', 'FRP', 'Landscape', 'Shop drawing', 'As-built', 'Other'];
const nameOf = (list, id) => list.find(x => x.id === id)?.name || '—';
const allowed = (state, roles) => state.user.role === 'admin' || roles.includes(state.user.role);
const toneOf = s => s === 'approved' ? 'green' : ['for_approval', 'draft'].includes(s) ? 'amber' : s === 'rejected' ? 'red' : undefined;
const requirementOf = (r, id) => (r.frpRequirement || []).find(x => x.id === id);

function DrawingsVault({ ctx, search }) {
  const { state } = ctx, r = state.records;
  const [view, setView] = useState('all'), [openId, setOpenId] = useState(null), [creating, setCreating] = useState(false);
  const drafter = allowed(state, ['engineer', 'project', 'sales']);
  const waiting = r.drawingRevision.filter(v => v.status === 'for_approval');
  const forOf = d => [d.client, requirementOf(r, d.requirementId)?.number].filter(Boolean).join(' · ');
  const q = search.toLowerCase();
  const rows = r.drawing.filter(d => view === 'all' || waiting.some(v => v.drawingId === d.id)).filter(d => !q || `${d.name} ${d.number} ${d.discipline} ${forOf(d)}`.toLowerCase().includes(q));
  const current = openId && r.drawing.find(d => d.id === openId);
  return <>
    <div className="info-strip"><Lock size={20}/><div><strong>One place for every drawing.</strong><span>Each revision is checked by someone other than the person who drew it. Approved revisions are locked, and approving a new one supersedes the last. Files open through links that expire after 10 minutes.</span></div>
      {drafter && <Button primary onClick={() => setCreating(true)}><Plus size={15}/>New drawing</Button>}</div>
    <div className="tabs">{[['all', 'All drawings', r.drawing.length], ['waiting', 'Waiting for approval', waiting.length]].map(([key, label, n]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}<span>{n}</span></button>)}</div>
    <DataTable head={['Drawing', 'Discipline', 'For', 'Latest revision', 'Approved']} rows={rows} onRow={d => setOpenId(d.id)}
      empty={r.drawing.length ? ['No drawings match.', 'Change the tab or the search.'] : ['No drawings yet.', 'Add a drawing, then upload its first revision (R0).']}
      render={d => [cell(<button type="button" className="record-link">{d.name}</button>, d.number), d.discipline, <span className="muted">{forOf(d)}</span>,
        <>{d.latestRevision == null ? 'No file yet' : `R${d.latestRevision}`} <Badge tone={toneOf(d.status)}>{d.status}</Badge></>, d.approvedRevision == null ? '—' : `R${d.approvedRevision}`]}/>
    {creating && <FormSheet title="New drawing" state={state} close={() => setCreating(false)} submitLabel="Create drawing" intro="Name the client or site, or link the drawing to an FRP requirement. You upload its first revision (R0) next."
      fields={[{ key: 'name', label: 'Title', type: 'text', required: true }, { key: 'discipline', label: 'Discipline', type: 'select', options: DISCIPLINES, required: true },
        { key: 'client', label: 'Client or site', type: 'text' },
        { key: 'requirementId', label: 'FRP requirement (optional)', type: 'select', placeholder: 'No requirement', options: (r.frpRequirement || []).map(x => [x.id, `${x.number} · ${x.customerName} · ${x.location}`]) },
        { key: 'notes', label: 'Notes', type: 'textarea' }]}
      onSubmit={async values => { const d = await rpc('create_drawing', { p_values: toSnake(values) }); await ctx.refresh(); ctx.notify(`Drawing ${d.number} created. Upload its first revision.`); setOpenId(d.id); }}/>}
    {current && <DrawingSheet ctx={ctx} drawing={current} close={() => setOpenId(null)}/>}
  </>;
}

function DrawingSheet({ ctx, drawing, close }) {
  const { state, notify } = ctx, r = state.records, me = state.user;
  const revisions = r.drawingRevision.filter(v => v.drawingId === drawing.id).sort((a, b) => b.revision - a.revision);
  const openRev = revisions.find(v => ['draft', 'for_approval'].includes(v.status));
  const [note, setNote] = useState(''), [review, setReview] = useState(''), [working, setWorking] = useState(false);
  const drafter = allowed(state, ['engineer', 'project', 'sales']), checker = allowed(state, ['engineer']);
  const go = async (work, message) => { setWorking(true); try { await work(); await ctx.refresh(); notify(message); } catch (error) { notify(error.message, true); } finally { setWorking(false); } };
  // Open the tab on the click itself (pop-up blockers), then point it at the 10-minute link.
  const view = path => { const win = window.open('about:blank', '_blank'); drawingUrl(path).then(url => { if (win) win.location.href = url; else location.href = url; }).catch(error => { win?.close(); notify(error.message, true); }); };
  const next = revisions.length ? Math.max(...revisions.map(v => v.revision)) + 1 : 0;
  const req = requirementOf(r, drawing.requirementId);
  return <Sheet large title={drawing.name} eyebrow={`${drawing.number} · ${drawing.discipline}`} close={close}>
    <div className="record-details">{[['Status', nice(drawing.status)], ['Latest revision', drawing.latestRevision == null ? 'No file yet' : `R${drawing.latestRevision}`], ['Approved revision', drawing.approvedRevision == null ? 'None yet' : `R${drawing.approvedRevision}`],
      ['Client or site', drawing.client], ['FRP requirement', req && `${req.number} · ${req.customerName} · ${req.location}`], ['Notes', drawing.notes]].filter(([, v]) => v).map(([k, v]) => <div className="detail-field" key={k}><label>{k}</label><p>{v}</p></div>)}</div>
    <h3 className="section-heading">Revisions</h3>
    {revisions.length ? revisions.map(v => <div className="revision-row" key={v.id}><div><strong>R{v.revision} · {v.name}</strong>
        <small>{(Number(v.size) / 1048576).toFixed(1)} MB · uploaded by {nameOf(state.users, v.createdBy)} · {dateTime(v.createdAt)}{v.changeNote ? ` · ${v.changeNote}` : ''}</small>
        {v.reviewedBy && <small>{v.status === 'rejected' ? 'Rejected' : 'Checked'} by {nameOf(state.users, v.reviewedBy)} · {dateTime(v.reviewedAt)}{v.reviewNote ? ` · ${v.reviewNote}` : ''}</small>}</div>
      <div className="revision-actions"><Badge tone={toneOf(v.status)}>{v.status}</Badge><Button onClick={() => view(v.path)}>Open</Button>
        {v.status === 'draft' && drafter && <Button primary disabled={working} onClick={() => go(() => rpc('submit_drawing_revision', { p_revision: v.id }), `R${v.revision} sent for approval.`)}>Submit for approval</Button>}</div></div>)
      : <p className="muted small-text">No revisions yet.</p>}
    {openRev?.status === 'for_approval' && checker && (openRev.createdBy === me.id ? <p className="muted small-text">R{openRev.revision} is waiting for a checker: someone other than you must approve it.</p>
      : <div className="setting-form"><label>Review note (required to reject)<input value={review} onChange={e => setReview(e.target.value)} placeholder="e.g. Checked against the site survey"/></label>
        <Button primary disabled={working} onClick={() => go(() => rpc('review_drawing_revision', { p_revision: openRev.id, p_decision: 'approved', p_note: review }), `R${openRev.revision} approved.`)}><Check size={14}/>Approve R{openRev.revision}</Button>
        <Button disabled={working} onClick={() => go(() => rpc('review_drawing_revision', { p_revision: openRev.id, p_decision: 'rejected', p_note: review }), `R${openRev.revision} rejected.`)}>Reject</Button></div>)}
    {openRev?.status === 'draft' && <p className="muted small-text">Submit R{openRev.revision} for approval before uploading another revision.</p>}
    {!openRev && drafter && <div className="setting-form"><label>What changed in R{next}<input value={note} onChange={e => setNote(e.target.value)} placeholder={next ? 'What changed since the last revision' : 'First issue'}/></label>
      <label className={`button upload-button ${working ? 'disabled-look' : ''}`}><FileUp size={14}/>{working ? 'Uploading…' : `Upload R${next}`}
        <input className="file-button-input" type="file" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.webp" disabled={working} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) go(() => uploadDrawing(drawing.id, file, note).then(() => setNote('')), `R${next} uploaded. Submit it for approval when ready.`); }}/></label></div>}
  </Sheet>;
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('CAC crashed', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="loading"><Waves size={36}/><h2>Something went wrong on this screen.</h2><p>Your data is safe in Supabase. Reload to continue.</p><code className="crash-detail">{String(this.state.error?.message || this.state.error)}</code><button className="button primary" onClick={() => location.reload()}>Reload workspace</button></div>;
  }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
