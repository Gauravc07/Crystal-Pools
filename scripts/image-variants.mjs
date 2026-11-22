// Makes smaller copies of the site's large images so phones download a size that fits their screen.
// The originals are never changed; copies sit next to them as name-640w.webp, name-960w.webp, name-1280w.webp.
// Also writes src/config/imageVariants.json, which the site uses to build srcset attributes.
// Run after adding or replacing images in public/images:   node scripts/image-variants.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = 'public';
const WIDTHS = [640, 960, 1280];
const MIN_WIDTH = 900;         // smaller images gain little
const MIN_BYTES = 60 * 1024;
const VARIANT = /-\d+w\.webp$/;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

const manifest = {};
let made = 0, saved = 0;
for (const file of walk(path.join(ROOT, 'images'))) {
  if (!/\.(webp|jpe?g|png)$/i.test(file) || VARIANT.test(file)) continue;
  const size = fs.statSync(file).size;
  const meta = await sharp(file).metadata();
  if (!meta.width || meta.width < MIN_WIDTH || size < MIN_BYTES) continue;
  const url = '/' + path.relative(ROOT, file).split(path.sep).join('/');
  const base = file.replace(/\.(webp|jpe?g|png)$/i, '');
  const widths = [];
  for (const w of WIDTHS) {
    if (w >= meta.width) continue;
    const out = `${base}-${w}w.webp`;
    if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(file).mtimeMs) {
      await sharp(file).resize({ width: w }).webp({ quality: 82, effort: 5 }).toFile(out);
      made++;
    }
    // Keep a copy only if it is really smaller than the original
    if (fs.statSync(out).size < size * 0.9) { widths.push(w); saved += size - fs.statSync(out).size; }
    else fs.rmSync(out);
  }
  if (widths.length) manifest[url] = { w: meta.width, v: widths };
}
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync('src/config/imageVariants.json', JSON.stringify(sorted, null, 1) + '\n');
console.log(`${Object.keys(sorted).length} images have smaller copies (${made} files written)`);
