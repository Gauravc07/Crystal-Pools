// The staff app talks only to Supabase: Auth for sign-in, `cac.*` functions for
// every read and write (rules, and the FRP quotation agent, run in Postgres),
// and Storage for drawing files.
import { createClient } from '@supabase/supabase-js';

// Hosted at www.crystalpools.in/cac, CAC uses the website's Supabase project, so it falls back to the website's public settings.
const url = import.meta.env.VITE_CAC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_CAC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key, { db: { schema: 'cac' }, auth: { storageKey: 'cac-auth' } }) : null;

const camelKey = key => key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const snakeKey = key => key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
const mapKeys = (value, fn) => Array.isArray(value) ? value.map(v => mapKeys(v, fn))
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [fn(k), mapKeys(v, fn)])) : value;
export const toCamel = value => mapKeys(value, camelKey);
export const toSnake = value => mapKeys(value, snakeKey);

export async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error?.code === 'PGRST106') throw Object.assign(new Error('CAC is installed but not yet exposed to the Supabase Data API. An admin must add "cac" under Project Settings → Data API → Exposed schemas.'), { code: error.code });
  if (error) throw Object.assign(new Error(error.message || 'Request failed.'), { code: error.code });
  return toCamel(data);
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message);
}
export const signOut = () => { try { localStorage.removeItem(ACTIVE_KEY); } catch { /* storage may be blocked */ } return supabase.auth.signOut(); };

// Password reset email. The link returns to this app, which then asks for a new password.
// The app address must be in Supabase → Authentication → URL Configuration → Redirect URLs.
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw new Error(error.message);
}
export async function changePassword(password) {
  if (password.length < 12) throw new Error('Use at least 12 characters.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  await rpc('password_changed');
}
// True when the page was opened from a password-reset email link.
export const openedFromRecoveryLink = typeof location !== 'undefined' && /type=recovery/.test(location.hash);

// Signed-in sessions end after 12 hours without any activity on this device.
const ACTIVE_KEY = 'cac-last-active';
export const IDLE_LIMIT_MS = 12 * 3600 * 1000;
export function markActive() { try { localStorage.setItem(ACTIVE_KEY, String(Date.now())); } catch { /* storage may be blocked */ } }
export function idleExpired() {
  try { const last = Number(localStorage.getItem(ACTIVE_KEY)); return Boolean(last) && Date.now() - last > IDLE_LIMIT_MS; } catch { return false; }
}

export async function downloadBackup() {
  const backup = await rpc('export_workspace');
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })), download: `cac-backup-${new Date().toISOString().slice(0, 10)}.json` });
  link.click(); URL.revokeObjectURL(link.href);
}

export async function loadState() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw Object.assign(new Error('Sign in to the CAC workspace.'), { status: 401 });
  try {
    const state = await rpc('workspace_state');
    const users = state.users.map(u => ({ ...u, id: u.userId }));
    const records = Object.fromEntries(Object.entries(state.records).map(([kind, rows]) => [kind, rows.map(row => ({ ...row, kind }))]));
    return { ...state, user: { ...state.user, id: state.user.userId }, users, records };
  } catch (error) {
    // Signed in to Supabase but not (or no longer) an active CAC staff member.
    if (error.code === '42501') { await signOut(); throw Object.assign(error, { status: 401 }); }
    throw error;
  }
}

// Drawings vault: files go to the private "cac-drawings" bucket, then are registered as the next revision.
export const DRAWING_BUCKET = 'cac-drawings';
const DRAWING_TYPES = { pdf: 'application/pdf', dwg: 'image/vnd.dwg', dxf: 'image/vnd.dxf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
export async function uploadDrawing(drawingId, file, note) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!DRAWING_TYPES[ext]) throw new Error('Use a PDF, DWG, DXF, PNG, JPEG or WebP file.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Use a file up to 50 MB.');
  const path = `${drawingId}/${crypto.randomUUID().replaceAll('-', '')}.${ext}`;
  const { error } = await supabase.storage.from(DRAWING_BUCKET).upload(path, file, { contentType: DRAWING_TYPES[ext], upsert: false });
  if (error) throw new Error(error.message.includes('row-level security') ? 'Engineers, project and sales staff can add revisions to existing drawings.' : error.message);
  return rpc('add_drawing_revision', { p_drawing: drawingId, p_path: path, p_name: file.name.slice(0, 200), p_note: note || '' });
}
// A 10-minute link to one revision's file.
export async function drawingUrl(path) {
  const { data, error } = await supabase.storage.from(DRAWING_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error('Could not open the file. Try again.');
  return data.signedUrl;
}
