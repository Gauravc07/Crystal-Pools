import fs from 'node:fs';
import { PAGES } from '../src/content/index';
import { allFields } from '../src/content/types';

const ids = new Set<string>();
let problems = 0;
let fieldCount = 0;
const fail = (msg: string) => { console.log('PROBLEM', msg); problems++; };
const localFileOk = (p: string) => !p || /^https?:\/\//.test(p) || (fs.existsSync(`public${p}`) && fs.statSync(`public${p}`).size > 0);

for (const p of PAGES) {
  if (ids.has(p.id)) fail(`duplicate id ${p.id}`);
  ids.add(p.id);
  if (!/^[a-z0-9-]+$/.test(p.id)) fail(`bad id ${p.id}`);
  const keys = p.sections.flatMap(s => Object.keys(s.fields));
  if (new Set(keys).size !== keys.length) fail(`duplicate key in ${p.id}`);
  for (const [k, f] of Object.entries(allFields(p))) {
    fieldCount++;
    if (k.length > 100) fail(`${p.id} ${k} key too long`);
    if (f.type === 'image' || f.type === 'file') {
      if (!localFileOk(f.default)) fail(`${p.id} ${k}: default file missing or empty: ${f.default}`);
    }
    if (f.type === 'list') {
      for (const item of f.default) {
        for (const sub of Object.keys(item)) if (!(sub in f.item)) fail(`${p.id} ${k}: unknown sub-field ${sub}`);
        for (const [sub, def] of Object.entries(f.item)) {
          if ((def.type === 'image' || def.type === 'file') && !localFileOk(item[sub])) fail(`${p.id} ${k}.${sub}: missing/empty file ${item[sub]}`);
        }
      }
    }
  }
}
console.log(`${PAGES.length} pages, ${fieldCount} fields, ${problems} problems`);
