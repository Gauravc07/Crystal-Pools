// Gmail → lead reports. Every 15 minutes (or when staff press "Check Gmail now")
// the worker searches the mailbox with the saved Gmail query, downloads new
// .xlsx attachments, reads them and registers each file once (by SHA-256) as a
// lead report; registering queues the extraction run. Read-only Gmail access
// (gmail.readonly): nothing in the mailbox is changed, labelled or sent.
import { readXlsx, sha256Hex } from './xlsx.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_MESSAGES = 20;

export function gmailOptions(get) {
  return { clientId: get('GMAIL_CLIENT_ID') || '', clientSecret: get('GMAIL_CLIENT_SECRET') || '', refreshToken: get('GMAIL_REFRESH_TOKEN') || '' };
}
export const gmailConfigured = gmail => Boolean(gmail?.clientId && gmail?.clientSecret && gmail?.refreshToken);

class MailError extends Error {}

export async function gmailAccessToken(gmail, fetchImpl = fetch) {
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: gmail.clientId, client_secret: gmail.clientSecret, refresh_token: gmail.refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (body.error === 'invalid_grant') throw new MailError('Gmail access was revoked or has expired. Run npm --prefix cac run gmail:auth again, then redeploy the worker.');
  if (!response.ok || !body.access_token) throw new MailError(`Google sign-in failed (${body.error || `HTTP ${response.status}`}). Check GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.`);
  return body.access_token;
}

function attachments(part, found = []) {
  if (!part) return found;
  const name = part.filename || '';
  // Any file name, as long as it ends in .xlsx (the attachment's declared type is not trusted).
  if (part.body?.attachmentId && /\.xlsx$/i.test(name.trim())) found.push({ name, attachmentId: part.body.attachmentId, size: part.body.size || 0 });
  else if (part.body?.attachmentId && /\.xls$/i.test(name)) found.push({ name, attachmentId: null, error: 'Old .xls format: ask the sender for .xlsx, or open it and save it as .xlsx, then upload it.' });
  for (const child of part.parts || []) attachments(child, found);
  return found;
}
const fromBase64Url = data => Uint8Array.from(atob(data.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

// Returns null when not due, otherwise { messages, files } for this pass.
export async function pollMail(client, gmail, { fetchImpl = fetch } = {}) {
  const configured = gmailConfigured(gmail);
  const status = await rpc(client, 'mail_poll_begin', { p_configured: configured });
  if (!configured || !status?.due) return null;
  let messages = 0, files = 0, duplicates = 0;
  try {
    const token = await gmailAccessToken(gmail, fetchImpl);
    const get = async path => {
      const response = await fetchImpl(`${API}/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
      if (response.status === 403) throw new MailError('Gmail refused access. Re-run gmail:auth and allow "Read your email messages".');
      if (!response.ok) throw new MailError(`Gmail returned HTTP ${response.status}.`);
      return response.json();
    };
    const list = await get(`messages?maxResults=${MAX_MESSAGES}&q=${encodeURIComponent(status.query)}`);
    const ids = (list.messages || []).map(m => m.id);
    const known = new Set(ids.length ? await rpc(client, 'mail_known', { p_ids: ids }) : []);
    for (const id of ids.filter(id => !known.has(id))) {
      const message = await get(`messages/${id}?format=full`);
      const header = name => message.payload?.headers?.find(h => h.name.toLowerCase() === name)?.value || '';
      const found = [];
      for (const file of attachments(message.payload)) {
        // Unreadable formats are still recorded once (fingerprinted by message and file name) so staff see why.
        if (!file.attachmentId) { found.push({ name: file.name.slice(0, 200), error: file.error, sha256: await sha256Hex(new TextEncoder().encode(`${id}/${file.name}`)), sheets: null }); continue; }
        const bytes = fromBase64Url((await get(`messages/${id}/attachments/${file.attachmentId}`)).data || '');
        const entry = { name: file.name.slice(0, 200), sha256: await sha256Hex(bytes), sheets: null, error: null };
        try { entry.sheets = (await readXlsx(bytes)).sheets; } catch (error) { entry.error = error.message; }
        found.push(entry);
      }
      const recorded = await rpc(client, 'mail_record_message', {
        p_id: id, p_from: header('from').slice(0, 300), p_subject: header('subject').slice(0, 300),
        p_received_at: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null, p_files: found,
      });
      // The same file sent again in another email is recognised by its fingerprint and not read twice.
      messages++; files += found.length; duplicates += recorded?.duplicates || 0;
    }
    await rpc(client, 'mail_poll_end', { p_error: null, p_summary: `${messages} new email${messages === 1 ? '' : 's'}, ${files} report file${files === 1 ? '' : 's'}${duplicates ? ` (${duplicates} already imported, skipped)` : ''}` });
  } catch (error) {
    await client.rpc('mail_poll_end', { p_error: String(error.message).slice(0, 500), p_summary: null });
    return { messages, files, error: error.message };
  }
  return { messages, files, duplicates };
}
