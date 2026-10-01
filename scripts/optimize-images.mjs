// Converts heavy PNG/JPG images in public/images to WebP, points the code (and the
// database's blog posts) at the WebP versions, and removes originals nothing uses any more.
//
//   node --env-file=.env scripts/optimize-images.mjs            # dry run: report only
//   node --env-file=.env scripts/optimize-images.mjs --apply    # do it
//
// Originals stay in git history, so this is reversible.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const MIN_BYTES = 200 * 1024;     // leave small images alone
const MAX_WIDTH = 2400;
const QUALITY = 80;
const ROOT = process.cwd();

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});
const toWeb = file => '/' + path.relative(path.join(ROOT, 'public'), file).split(path.sep).join('/');
const mb = n => (n / 1048576).toFixed(1) + ' MB';

// Files whose text may reference images
const codeFiles = [
  ...walk(path.join(ROOT, 'src')).filter(f => /\.(tsx?|css)$/.test(f)),
  path.join(ROOT, 'index.html'),
];
const readAll = () => codeFiles.map(f => ({ file: f, text: fs.readFileSync(f, 'utf8') }));

const db = process.env.SUPABASE_DB_URL ? new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } }) : null;
if (db) await db.connect();
const dbRefs = async () => {
  if (!db) return '';
  const rows = await db.query(`
    select featured_image as v from blogs union all select og_image from blogs
    union all select content from blogs union all select value::text from page_content
    union all select cover_image from projects union all select images::text from projects`);
  return rows.rows.map(r => r.v ?? '').join('\n');
};

const images = walk(path.join(ROOT, 'public/images')).filter(f => /\.(png|jpe?g)$/i.test(f) && fs.statSync(f).size > 0);
const plan = [];
let before = 0, after = 0;

for (const file of images) {
  const size = fs.statSync(file).size;
  if (size < MIN_BYTES) continue;
  const webp = file.replace(/\.(png|jpe?g)$/i, '.webp');
  const existing = fs.existsSync(webp) && fs.statSync(webp).size > 0 ? fs.statSync(webp).size : 0;
  let newSize = existing;
  let generate = false;
  if (!existing) {
    const buf = await sharp(file).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer();
    if (buf.length >= size) continue; // WebP wouldn't help
    newSize = buf.length;
    generate = true;
    if (APPLY) fs.writeFileSync(webp, buf);
  }
  before += size;
  after += newSize;
  plan.push({ file, webp, from: toWeb(file), to: toWeb(webp), size, newSize, generate });
}

console.log(`${plan.length} heavy images → WebP: ${mb(before)} → ${mb(after)}`);
for (const p of plan.slice(0, 8)) console.log(`  ${p.from}  ${mb(p.size)} → ${mb(p.newSize)}${p.generate ? '' : ' (WebP already existed)'}`);
if (plan.length > 8) console.log(`  … and ${plan.length - 8} more`);

// Point code at the WebP versions
let codeEdits = 0;
for (const { file, text } of readAll()) {
  let next = text;
  for (const p of plan) next = next.split(p.from).join(p.to);
  if (next !== text) {
    codeEdits++;
    if (APPLY) fs.writeFileSync(file, next);
  }
}
console.log(`${codeEdits} source files reference these images${APPLY ? ' (updated)' : ''}`);

// Point database content (seeded blog posts etc.) at the WebP versions
if (db) {
  let dbEdits = 0;
  for (const p of plan) {
    const q = [
      [`update blogs set featured_image = $2 where featured_image = $1`],
      [`update blogs set og_image = $2 where og_image = $1`],
      [`update blogs set content = replace(content, $1, $2) where content like '%' || $1 || '%'`],
      [`update projects set cover_image = $2 where cover_image = $1`],
    ];
    for (const [sql] of q) {
      if (APPLY) dbEdits += (await db.query(sql, [p.from, p.to])).rowCount;
      else dbEdits += (await db.query(sql.replace(/^update (\w+) set .* where/, 'select 1 from $1 where'), [p.from, p.to].slice(0, sql.includes('like') ? 1 : 1))).rowCount;
    }
  }
  console.log(`${dbEdits} database rows reference these images${APPLY ? ' (updated)' : ''}`);
}

// Remove originals that nothing references any more
const refs = readAll().map(r => r.text).join('\n') + '\n' + (await dbRefs());
let removed = 0, freed = 0;
for (const p of plan) {
  const stillUsed = APPLY ? refs.includes(p.from) : false; // in a dry run every reference is about to be rewritten
  if (stillUsed) continue;
  removed++;
  freed += p.size;
  if (APPLY) fs.unlinkSync(p.file);
}
console.log(`${removed} originals ${APPLY ? 'removed' : 'would be removed'} (${mb(freed)})`);
if (!APPLY) console.log('\nDry run only. Re-run with --apply to make these changes.');
if (db) await db.end();
