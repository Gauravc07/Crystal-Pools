// Last build step. Vercel serves static files before rewrites, so the website's index.html and
// sitemap.xml must not exist as files or / and /sitemap.xml would never reach api/render.
// The shell is baked into the function bundle and also kept as _shell.html for the fallback.
import fs from 'node:fs';
import { build } from 'esbuild';

// Local builds read .env; on Vercel these come from the project's environment variables.
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const shellPath = fs.existsSync('dist/index.html') ? 'dist/index.html' : 'dist/_shell.html';
const shell = fs.readFileSync(shellPath, 'utf8');
if (!shell.includes('<div id="root"></div>')) throw new Error('App shell is missing its root element');

const env = (...names) => JSON.stringify(names.map(n => process.env[n]).find(Boolean) ?? '');
await build({
  entryPoints: ['server/vercel.ts'],
  outfile: 'dist-server/render.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  define: {
    __SHELL_HTML__: JSON.stringify(shell),
    // Public values only. Never add a secret here.
    'process.env.VITE_SUPABASE_URL': env('VITE_SUPABASE_URL', 'SUPABASE_URL'),
    'process.env.SUPABASE_URL': env('VITE_SUPABASE_URL', 'SUPABASE_URL'),
    'process.env.VITE_SUPABASE_PUBLISHABLE_KEY': env('VITE_SUPABASE_PUBLISHABLE_KEY'),
  },
});

fs.writeFileSync('dist/_shell.html', shell);
fs.rmSync('dist/index.html', { force: true });
fs.rmSync('dist/sitemap.xml', { force: true });
console.log('Built dist-server/render.cjs and moved the shell to dist/_shell.html');
