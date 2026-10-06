import express from "express";
import fs from "fs";
import path from "path";
import { PAGES } from "./src/content";
import { allFields } from "./src/content/types";

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://www.crystalpools.in").replace(/\/$/, "");
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// ── Supabase (read-only, publishable key: only public data is visible) ──

async function supabaseGet<T>(pathAndQuery: string): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function mediaUrl(bucket: string, value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  if (value.startsWith("/")) return `${SITE_URL}${value}`;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${value}`;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── Site-wide data (settings + page SEO overrides), cached briefly ──

interface Settings {
  phone: string; email: string; address: string;
  map_lat: number | null; map_lng: number | null;
  social_links: Record<string, string>;
  seo_title: string; seo_description: string; og_image: string | null;
  ga_measurement_id: string; gsc_verification: string; gbp_url: string;
}

interface SiteData {
  settings: Settings | null;
  /** page id → key → value, only the SEO-relevant keys */
  overrides: Record<string, Record<string, unknown>>;
}

let siteCache: { data: SiteData; at: number } | null = null;

async function getSiteData(): Promise<SiteData> {
  if (siteCache && Date.now() - siteCache.at < 2 * 60 * 1000) return siteCache.data;
  const [settingsRows, contentRows] = await Promise.all([
    supabaseGet<Settings[]>(
      "site_settings?select=phone,email,address,map_lat,map_lng,social_links,seo_title,seo_description,og_image,ga_measurement_id,gsc_verification,gbp_url&id=eq.1",
    ),
    supabaseGet<{ page: string; key: string; value: unknown }[]>(
      "page_content?select=page,key,value&key=in.(seo.title,seo.description,hero.image)",
    ),
  ]);
  const overrides: SiteData["overrides"] = {};
  for (const row of contentRows ?? []) (overrides[row.page] ??= {})[row.key] = row.value;
  const data = { settings: settingsRows?.[0] ?? null, overrides };
  // Don't cache a failed fetch for long
  siteCache = { data, at: settingsRows ? Date.now() : Date.now() - 100 * 1000 };
  return data;
}

// ── HTML head building ──

interface PageMeta {
  title: string;
  description: string;
  image: string | null;
  canonical: string;
  type?: "website" | "article";
  extra?: string[];
}

function siteTags(site: SiteData): string[] {
  const s = site.settings;
  const tags: string[] = [];
  if (s?.gsc_verification) tags.push(`<meta name="google-site-verification" content="${escapeHtml(s.gsc_verification)}" />`);
  if (s?.ga_measurement_id) {
    const id = escapeHtml(s.ga_measurement_id);
    tags.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`,
    );
  }
  if (s) {
    // Business details for Google (local search / Business Profile)
    const sameAs = [...Object.values(s.social_links ?? {}), s.gbp_url].filter(Boolean);
    const business = {
      "@context": "https://schema.org",
      "@type": "HomeAndConstructionBusiness",
      name: "Crystal Pools",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      image: mediaUrl("site", s.og_image) ?? `${SITE_URL}/images/hero/light-mode.webp`,
      telephone: s.phone,
      email: s.email,
      foundingDate: "1993",
      address: s.address ? { "@type": "PostalAddress", streetAddress: s.address, addressCountry: "IN" } : undefined,
      geo: s.map_lat != null && s.map_lng != null ? { "@type": "GeoCoordinates", latitude: s.map_lat, longitude: s.map_lng } : undefined,
      hasMap: s.gbp_url || undefined,
      sameAs: sameAs.length ? sameAs : undefined,
    };
    tags.push(`<script type="application/ld+json">${JSON.stringify(business).replace(/</g, "\\u003c")}</script>`);
  }
  return tags;
}

function renderHead(html: string, meta: PageMeta, site: SiteData) {
  const title = `${meta.title} | Crystal Pools`;
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
    `<meta property="og:type" content="${meta.type ?? "website"}" />`,
    `<meta property="og:site_name" content="Crystal Pools" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`,
    meta.image ? `<meta property="og:image" content="${escapeHtml(meta.image)}" />` : "",
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    meta.image ? `<meta name="twitter:image" content="${escapeHtml(meta.image)}" />` : "",
    ...(meta.extra ?? []),
    ...siteTags(site),
  ].filter(Boolean).join("\n    ");

  return html
    // Drop the defaults these tags replace
    .replace(/<meta (name|property)="(description|keywords|og:[a-z:_]+|twitter:[a-z:_]+)"[^>]*>\s*/g, "")
    .replace(/<link rel="canonical"[^>]*>\s*/g, "")
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace("</head>", `    ${tags}\n  </head>`);
}

/** SEO for one of the website's content pages, with admin overrides applied. */
function pageMeta(urlPath: string, site: SiteData): PageMeta {
  const normalised = urlPath.replace(/\/+$/, "") || "/";
  const page = PAGES.find(p => p.id !== "footer" && p.path === normalised);
  const s = site.settings;
  if (!page) {
    return {
      title: s?.seo_title?.replace(/\s*\|\s*Crystal Pools$/, "") || "Premium Swimming Pool Construction",
      description: s?.seo_description || "",
      image: mediaUrl("site", s?.og_image),
      canonical: `${SITE_URL}${normalised === "/" ? "/" : normalised}`,
    };
  }
  const fields = allFields(page);
  const o = site.overrides[page.id] ?? {};
  const pick = (key: string) => {
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v;
    const f = fields[key];
    return f && f.type !== "list" ? f.default : "";
  };
  const heroImage = fields["hero.image"] ? mediaUrl("pages", pick("hero.image")) : null;
  return {
    title: pick("seo.title"),
    description: pick("seo.description"),
    image: heroImage ?? mediaUrl("site", s?.og_image) ?? `${SITE_URL}/images/hero/light-mode.webp`,
    canonical: `${SITE_URL}${page.path === "/" ? "/" : page.path}`,
  };
}

// ── Blog posts ──

interface PostMeta {
  title: string; slug: string; excerpt: string;
  featured_image: string | null; og_image: string | null;
  meta_title: string | null; meta_description: string | null;
  tags: string[]; published_at: string; updated_at: string;
}

const POST_FIELDS = "title,slug,excerpt,featured_image,og_image,meta_title,meta_description,tags,published_at,updated_at";

async function getPost(slug: string) {
  const rows = await supabaseGet<PostMeta[]>(`blogs?select=${POST_FIELDS}&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return rows?.[0] ?? null;
}

async function getRedirect(oldSlug: string) {
  const rows = await supabaseGet<{ blog: { slug: string } | null }[]>(
    `blog_slug_redirects?select=blog:blogs(slug)&old_slug=eq.${encodeURIComponent(oldSlug)}&limit=1`,
  );
  return rows?.[0]?.blog?.slug ?? null;
}

function postMeta(post: PostMeta): PageMeta {
  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    image: mediaUrl("blog", post.og_image || post.featured_image),
    canonical: `${SITE_URL}/blogs/${post.slug}`,
    type: "article",
    extra: [
      post.tags.length ? `<meta name="keywords" content="${escapeHtml(post.tags.join(", "))}" />` : "",
      `<meta property="article:published_time" content="${post.published_at}" />`,
    ],
  };
}

// ── Sitemap: static pages + every published blog post ──

let sitemapCache: { xml: string; at: number } | null = null;

async function buildSitemap(staticXml: string) {
  if (sitemapCache && Date.now() - sitemapCache.at < 10 * 60 * 1000) return sitemapCache.xml;
  const posts = await supabaseGet<{ slug: string; updated_at: string }[]>(
    "blogs?select=slug,updated_at&order=published_at.desc",
  );
  const entries = (posts ?? []).map(p => [
    "  <url>",
    `    <loc>${SITE_URL}/blogs/${p.slug}</loc>`,
    `    <lastmod>${p.updated_at.slice(0, 10)}</lastmod>`,
    "    <changefreq>monthly</changefreq>",
    "    <priority>0.6</priority>",
    "  </url>",
  ].join("\n"));
  const xml = entries.length
    ? staticXml.replace("</urlset>", `\n  <!-- Blog posts -->\n${entries.join("\n")}\n</urlset>`)
    : staticXml;
  sitemapCache = { xml, at: Date.now() };
  return xml;
}

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
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    });
    if (req.secure || req.get("x-forwarded-proto") === "https") {
      res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // The blog moved from /blog to /blogs — keep old links and rankings (301).
  app.get("/blog", (req, res) => res.redirect(301, "/blogs"));
  app.get("/blog/:slug", (req, res) => res.redirect(301, `/blogs/${encodeURIComponent(req.params.slug)}`));

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
    const distPath = typeof __dirname !== 'undefined' ? __dirname : path.join(process.cwd(), 'dist');
    console.log(`Serving static files from ${distPath}`);
    const indexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
    const staticSitemap = fs.readFileSync(path.join(distPath, "sitemap.xml"), "utf8");

    app.get("/sitemap.xml", async (req, res) => {
      res.type("application/xml").set("Cache-Control", "public, max-age=600").send(await buildSitemap(staticSitemap));
    });

    app.get("/blogs/:slug", async (req, res) => {
      const [post, site] = await Promise.all([getPost(req.params.slug), getSiteData()]);
      if (post) {
        res.set("Cache-Control", "public, max-age=300").send(renderHead(indexHtml, postMeta(post), site));
        return;
      }
      const newSlug = await getRedirect(req.params.slug);
      if (newSlug) return res.redirect(301, `/blogs/${encodeURIComponent(newSlug)}`);
      // Unknown post: the app shows its 404 page
      res.status(404).send(renderHead(indexHtml, { ...pageMeta("/404", site), title: "Page Not Found" }, site));
    });

    // dist/ also holds the compiled server; never serve it.
    app.use(/^\/server\.cjs(\.map)?$/, (req, res) => { res.sendStatus(404); });

    // Fingerprinted build assets never change; images and documents change rarely.
    app.use("/assets", express.static(path.join(distPath, "assets"), { immutable: true, maxAge: "1y", index: false }));
    app.use(express.static(distPath, { index: false, maxAge: "7d" }));

    // Admin panel (built into dist/admin): every /admin route loads its app shell
    const adminHtml = path.join(distPath, "admin", "index.html");
    app.get(/^\/admin(\/.*)?$/, (req, res) => {
      res.set({ "X-Robots-Tag": "noindex, nofollow, noarchive", "Cache-Control": "no-cache" }).sendFile(adminHtml);
    });

    app.get('*all', async (req, res) => {
      const site = await getSiteData();
      const known = req.path === "/" || PAGES.some(p => p.path === req.path.replace(/\/+$/, ""));
      res.status(known || req.path === "/blogs" ? 200 : 404)
        .set("Cache-Control", "public, max-age=120")
        .send(renderHead(indexHtml, req.path === "/blogs" ? pageMeta("/blogs", site) : known ? pageMeta(req.path, site) : { ...pageMeta("/404", site), title: "Page Not Found" }, site));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
