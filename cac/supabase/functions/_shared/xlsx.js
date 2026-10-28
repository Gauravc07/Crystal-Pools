// Minimal .xlsx reader: unzips the workbook with the platform's
// DecompressionStream and reads cell text from the sheet XML. Plain ESM with no
// imports, so the Edge Function (Deno), the Node worker/tests and the browser
// share it. Returns { sheets: [{ name, rows: [[cell text, ...], ...] }] }.

const MAX_FILE = 5 * 1024 * 1024;      // attachment size accepted
const MAX_UNZIPPED = 40 * 1024 * 1024; // guards against zip bombs
const MAX_ROWS = 5000;

export class XlsxError extends Error {}

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Reads the zip central directory and returns a lazy map of entry name → bytes.
function zipEntries(bytes) {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(bytes, i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new XlsxError('This is not an .xlsx file (old .xls files are not supported; re-save it as .xlsx).');
  const count = u16(bytes, end + 10);
  let p = u32(bytes, end + 16);
  const entries = new Map();
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (u32(bytes, p) !== 0x02014b50) throw new XlsxError('The .xlsx file is damaged.');
    const method = u16(bytes, p + 10), size = u32(bytes, p + 20), unzipped = u32(bytes, p + 24);
    const nameLength = u16(bytes, p + 28), extra = u16(bytes, p + 30), comment = u16(bytes, p + 32), local = u32(bytes, p + 42);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLength));
    total += unzipped;
    if (total > MAX_UNZIPPED) throw new XlsxError('The .xlsx file is too large once unpacked.');
    const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    entries.set(name, async () => {
      const data = bytes.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflate(data);
      throw new XlsxError('The .xlsx file uses an unsupported compression method.');
    });
    p += 46 + nameLength + extra + comment;
  }
  return entries;
}

const entity = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
export function decodeXml(text) {
  return text
    .replace(/&(#x[0-9a-f]+|#[0-9]+|lt|gt|amp|quot|apos);/gi, (_, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entity[e.toLowerCase()])
    .replace(/_x([0-9A-F]{4})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
const attr = (attrs, name) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
// All <t> runs inside an element (shared strings and inline strings may be rich text).
const runs = xml => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => decodeXml(m[1])).join('');
const column = ref => [...(ref.match(/^[A-Z]+/)?.[0] || 'A')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

function sheetRows(xml, shared) {
  const rows = [];
  for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1], inner = cell[2] || '';
      const type = attr(attrs, 't'), raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = type === 's' ? shared[Number(raw)] ?? '' : type === 'inlineStr' ? runs(inner) : type === 'b' ? (raw === '1' ? 'TRUE' : 'FALSE') : decodeXml(raw ?? '');
      value = value.replace(/\r\n?/g, '\n').trim();
      const ref = attr(attrs, 'r');
      cells[ref ? column(ref) : cells.length] = value;
    }
    const values = Array.from(cells, v => v ?? '');
    while (values.length && !values[values.length - 1]) values.pop();
    if (values.length) rows.push(values);
    if (rows.length >= MAX_ROWS) break;
  }
  return rows;
}

export async function readXlsx(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length > MAX_FILE) throw new XlsxError('Use an .xlsx file smaller than 5 MB.');
  const entries = zipEntries(bytes);
  const text = async name => entries.has(name) ? new TextDecoder().decode(await entries.get(name)()) : '';
  const shared = [...(await text('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => runs(m[1]).replace(/\r\n?/g, '\n'));
  const rels = Object.fromEntries([...(await text('xl/_rels/workbook.xml.rels')).matchAll(/<Relationship\b([^>]*)\/?>/g)].map(m => [attr(m[1], 'Id'), attr(m[1], 'Target')]));
  const sheets = [];
  for (const m of (await text('xl/workbook.xml')).matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const target = rels[attr(m[1], 'r:id')];
    if (!target) continue;
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const rows = sheetRows(await text(path), shared);
    if (rows.length) sheets.push({ name: decodeXml(attr(m[1], 'name') || `Sheet ${sheets.length + 1}`), rows });
  }
  if (!sheets.length) throw new XlsxError('The workbook has no readable sheets.');
  return { sheets };
}

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
