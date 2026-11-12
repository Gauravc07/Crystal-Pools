// Serves every website page (see the rewrites in vercel.json). The logic lives in server/seo.ts.
// If the bundle can't load for any reason, visitors still get the normal app shell.
let bundle;

export default async function handler(req, res) {
  try {
    bundle ??= await import('../dist-server/render.cjs');
    await (bundle.handle ?? bundle.default.handle)(req, res);
  } catch (err) {
    console.error('render bundle failed', err);
    const shell = await fetch(`https://${req.headers.host}/_shell.html`).catch(() => null);
    res.statusCode = shell?.ok ? 200 : 503;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(shell?.ok ? await shell.text() : 'Temporarily unavailable. Please refresh in a moment.');
  }
}
