import express from "express";
import fs from "fs";
import path from "path";
import { handleSeoRequest } from "./server/seo";

// ── Server ──

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  app.disable("x-powered-by");

  // Basic security headers
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      "Content-Security-Policy": "default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com https://raw.githubusercontent.com https://www.google-analytics.com https://www.googletagmanager.com; media-src 'self' blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.web3forms.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com; frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests",
    });
    if (req.secure || req.get("x-forwarded-proto") === "https") {
      res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const isProd = process.env.NODE_ENV === "production" || !!process.env.K_SERVICE;
  console.log(`Running in ${isProd ? "production" : "development"} mode.`);

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn("Failed to load Vite middleware:", err);
    }
  } else {
    // In production, serve static files
    // The compiled server is dist-server/server.cjs; the website files are in dist/ (the server itself is never served)
    const distPath = typeof __dirname !== 'undefined' ? path.join(__dirname, '..', 'dist') : path.join(process.cwd(), 'dist');
    console.log(`Serving static files from ${distPath}`);
    const shellFile = ["_shell.html", "index.html"].map(f => path.join(distPath, f)).find(f => fs.existsSync(f))!;
    const shell = fs.readFileSync(shellFile, "utf8");

    // Fingerprinted build assets never change; images and documents change rarely.
    app.use("/assets", express.static(path.join(distPath, "assets"), { immutable: true, maxAge: "1y", index: false }));
    app.get("/sitemap.xml", async (req, res) => {
      const result = await handleSeoRequest("/sitemap.xml", shell);
      res.status(result.status).set(result.headers).send(result.body);
    });
    app.use(express.static(distPath, { index: false, maxAge: "7d" }));

    // Admin panel (built into dist/admin): every /admin route loads its app shell
    const adminHtml = path.join(distPath, "admin", "index.html");
    app.get(/^\/admin(\/.*)?$/, (req, res) => {
      res.set({ "X-Robots-Tag": "noindex, nofollow, noarchive", "Cache-Control": "no-cache" }).sendFile(adminHtml);
    });

    app.get('*all', async (req, res) => {
      const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      const result = await handleSeoRequest(req.path, shell, search);
      res.status(result.status).set(result.headers).send(result.body);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
