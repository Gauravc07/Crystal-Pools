// Bundled to dist-server/render.cjs at build time and called by api/render.mjs.
// The page shell and public Supabase settings are baked in, so it needs nothing else at runtime.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleSeoRequest } from './seo';

declare const __SHELL_HTML__: string;

export async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.searchParams.get('__path') ?? '/';
  url.searchParams.delete('__path');
  const search = url.searchParams.toString();
  let result;
  try {
    result = await handleSeoRequest(path, __SHELL_HTML__, search ? `?${search}` : '');
  } catch (err) {
    // Never fail a visitor because of SEO: the plain app still works.
    console.error('SEO render failed', err);
    result = { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, body: __SHELL_HTML__ };
  }
  res.statusCode = result.status;
  for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v as string);
  res.end(req.method === 'HEAD' ? undefined : result.body);
}
