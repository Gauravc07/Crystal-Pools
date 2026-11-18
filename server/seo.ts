// Everything a crawler needs in the first HTML response: per-page head tags, readable text, schema,
// real status codes, redirects and the sitemap. Used by the Vercel function (server/vercel.ts) and by
// the Express server (server.ts). Reads public data only, with the publishable key. If Supabase is
// slow or down, pages still render from their built-in defaults.
import { PAGES } from '../src/content';
import { allFields, pageTitle } from '../src/content/types';
import type { Field, PageSchema } from '../src/content/types';
import { LEGACY_REDIRECTS } from './legacyRedirects';

// Canonical links always name the real site, whatever host or environment served the page.
const SITE_URL = 'https://www.crystalpools.in';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const CACHE_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 2500;

export interface SeoResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

interface Settings {
  phone: string; email: string; address: string;
  map_lat: number | null; map_lng: number | null;
  social_links: Record<string, string> | null;
  seo_title: string; seo_description: string; og_image: string | null;
  ga_measurement_id: string; gsc_verification: string; gbp_url: string;
  founding_year?: string;
}

interface City {
  slug: string; city: string; region: string; meta_title: string; meta_description: string;
  heading: string; intro: string; body: string; contact_name: string; phone: string; address: string;
  lat: number | null; lng: number | null; hero_image: string | null; updated_at: string;
}

interface Project {
  slug: string; name: string; location: string; pool_type: string; description: string;
  cover_image: string | null; images: { path: string; alt: string }[] | null;
  meta_title?: string; meta_description?: string; updated_at: string;
}

interface PostSummary { slug: string; title: string; excerpt: string; updated_at: string }

interface SiteData {
  settings: Settings | null;
  /** page id → key → value */
  overrides: Record<string, Record<string, unknown>>;
  redirects: Record<string, { to: string; status: number }>;
  cities: City[];
  projects: Project[];
  posts: PostSummary[];
}

interface PageMeta {
  title: string;
  description: string;
  image: string | null;
  canonical: string;
  type?: 'website' | 'article';
  extra?: string[];
}

// ── Helpers ──

async function supabaseGet<T>(pathAndQuery: string): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const escapeHtml = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

function mediaUrl(bucket: string, value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  if (value.startsWith('/')) return `${SITE_URL}${value}`;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${value}`;
}

/** First phone number in a string such as "+(91) 9850997486 / (020) 24690602". */
function firstPhone(value: string) {
  const digits = (value.split('/')[0] ?? '').replace(/[^\d+]/g, '');
  return digits || undefined;
}

// Only simple formatting survives into the crawler copy of a post; the browser replaces it on load.
const SAFE_TAGS = /^(h[2-4]|p|ul|ol|li|strong|em|b|i|blockquote|table|thead|tbody|tr|th|td|br)$/i;
function safeHtml(html: string) {
  return html
    .replace(/<(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, name: string) => {
      if (!SAFE_TAGS.test(name)) return ' ';
      return tag.startsWith('</') ? `</${name.toLowerCase()}>` : `<${name.toLowerCase()}>`;
    });
}

// ── Site-wide data, cached briefly. A failed refresh keeps the last good copy. ──

let siteCache: { data: SiteData; at: number } | null = null;

async function getSiteData(): Promise<SiteData> {
  if (siteCache && Date.now() - siteCache.at < CACHE_MS) return siteCache.data;
  const [settings, content, redirects, cities, projects, posts] = await Promise.all([
    supabaseGet<Settings[]>('site_settings?select=*&id=eq.1'),
    supabaseGet<{ page: string; key: string; value: unknown }[]>('page_content?select=page,key,value'),
    supabaseGet<{ from_path: string; to_path: string; status_code: number }[]>('seo_redirects?select=from_path,to_path,status_code&limit=5000'),
    supabaseGet<City[]>('city_pages?select=*&order=sort_order'),
    supabaseGet<Project[]>('projects?select=*&order=sort_order'),
    supabaseGet<PostSummary[]>('blogs?select=slug,title,excerpt,updated_at&order=published_at.desc'),
  ]);
  const previous = siteCache?.data;
  const overrides: SiteData['overrides'] = {};
  for (const row of content ?? []) (overrides[row.page] ??= {})[row.key] = row.value;
  const redirectMap: SiteData['redirects'] = {};
  for (const r of redirects ?? []) redirectMap[r.from_path.toLowerCase()] = { to: r.to_path, status: r.status_code };
  const data: SiteData = {
    settings: settings?.[0] ?? previous?.settings ?? null,
    overrides: content ? overrides : previous?.overrides ?? {},
    redirects: redirects ? redirectMap : previous?.redirects ?? {},
    cities: cities ?? previous?.cities ?? [],
    projects: projects ?? previous?.projects ?? [],
    posts: posts ?? previous?.posts ?? [],
  };
  // Retry sooner after a failed refresh
  siteCache = { data, at: settings ? Date.now() : Date.now() - CACHE_MS + 10 * 1000 };
  return data;
}

// ── Head ──

function analyticsTags(site: SiteData): string[] {
  const s = site.settings;
  const tags: string[] = [];
  if (s?.gsc_verification) tags.push(`<meta name="google-site-verification" content="${escapeHtml(s.gsc_verification)}" />`);
  if (s?.ga_measurement_id) {
    const id = escapeHtml(s.ga_measurement_id);
    // ga-init.js is a file rather than inline code because the site's security policy blocks inline scripts.
    tags.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
      `<script src="/ga-init.js" data-id="${id}"></script>`,
    );
  }
  return tags;
}

function businessSchema(site: SiteData) {
  const s = site.settings;
  if (!s) return null;
  const sameAs = [...Object.values(s.social_links ?? {}), s.gbp_url].filter(Boolean);
  const postalCode = s.address?.match(/\b\d{6}\b/)?.[0];
  return {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    '@id': `${SITE_URL}/#business`,
    name: 'Crystal Pools',
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/favicon-512.png`,
    image: mediaUrl('site', s.og_image) ?? `${SITE_URL}/images/hero/light-mode.webp`,
    telephone: s.phone,
    email: s.email,
    foundingDate: s.founding_year || '2000',
    address: s.address
      ? { '@type': 'PostalAddress', streetAddress: s.address, addressLocality: 'Pune', addressRegion: 'Maharashtra', postalCode, addressCountry: 'IN' }
      : undefined,
    geo: s.map_lat != null && s.map_lng != null ? { '@type': 'GeoCoordinates', latitude: s.map_lat, longitude: s.map_lng } : undefined,
    hasMap: s.gbp_url || undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
}

function renderHead(shell: string, meta: PageMeta, site: SiteData) {
  const title = pageTitle(meta.title);
  const business = businessSchema(site);
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
    `<meta property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta property="og:site_name" content="Crystal Pools" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`,
    meta.image ? `<meta property="og:image" content="${escapeHtml(meta.image)}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    meta.image ? `<meta name="twitter:image" content="${escapeHtml(meta.image)}" />` : '',
    ...(meta.extra ?? []),
    business ? jsonLd(business) : '',
    ...analyticsTags(site),
  ].filter(Boolean).join('\n    ');

  const foundingYear = site.settings?.founding_year;
  let html = shell
    // Drop the defaults these tags replace (replacer functions: titles may contain "$")
    .replace(/<meta (name|property)="(description|keywords|og:[a-z:_]+|twitter:[a-z:_]+)"[^>]*>\s*/g, '')
    .replace(/<link rel="canonical"[^>]*>\s*/g, '')
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
    .replace('</head>', () => `    ${tags}\n  </head>`);
  if (foundingYear) html = html.replace(/"foundingDate": "\d{4}"/, () => `"foundingDate": ${JSON.stringify(foundingYear)}`);
  return html;
}

/**
 * Puts readable text in the first response for crawlers that don't run JavaScript. Visually hidden, and
 * React replaces it as soon as the app starts, so visitors never see it. It only repeats the page's text.
 */
function renderBody(html: string, inner: string) {
  const block = `<div id="seo-content" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:normal">${inner}</div>`;
  return html.replace('<div id="root"></div>', () => `<div id="root">${block}</div>`);
}

// ── Page content → readable text ──

const SKIP_KEY = /(^seo\.|\.alt$|image|video|icon|zoom|selecttitle|selecttext|^form\.|button|placeholder|\.cta|cta\.|\.file$|\.pdf$|\.lat$|\.lng$)/i;
const SKIP_SUBKEY = /^(lat|lng|image|images?|icon|alt|href|link|url|path|file|light|dark|value|suffix)$/i;
const HEADING_KEY = /(heading|title|highlight)$/i;

function fieldText(key: string, field: Field, value: unknown): string {
  if (SKIP_KEY.test(key)) return '';
  if (field.type === 'list') {
    const items = (Array.isArray(value) ? value : field.default) as Record<string, string>[];
    const lines = items
      .map(item => Object.entries(field.item)
        .filter(([sub, def]) => def.type === 'text' && !SKIP_SUBKEY.test(sub))
        .map(([sub]) => item[sub])
        .filter(Boolean)
        .map(t => escapeHtml(String(t).replace(/\n/g, ' ')))
        .join(': '))
      .filter(Boolean);
    return lines.length ? `<ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>` : '';
  }
  if (field.type !== 'text') return '';
  const text = String(typeof value === 'string' && value.trim() ? value : field.default ?? '').replace(/\s*\n\s*/g, ' ').trim();
  if (!text || /^(https?:\/\/|\/)/.test(text)) return '';
  return HEADING_KEY.test(key) ? `<h2>${escapeHtml(text)}</h2>` : `<p>${escapeHtml(text)}</p>`;
}

function pick(page: PageSchema, site: SiteData, key: string): string {
  const v = site.overrides[page.id]?.[key];
  if (typeof v === 'string' && v.trim()) return v;
  const f = allFields(page)[key];
  return f && f.type !== 'list' ? f.default : '';
}

function pageHeading(page: PageSchema, site: SiteData) {
  const fields = allFields(page);
  if (page.id === 'home' && fields['hero.heading']) return pick(page, site, 'hero.heading');
  if (page.id === 'home') {
    const f = fields['hero.words'];
    const raw = site.overrides.home?.['hero.words'];
    const items = (Array.isArray(raw) ? raw : f?.type === 'list' ? f.default : []) as { word?: string }[];
    return `${pick(page, site, 'hero.lead')} ${items.map(w => w.word).filter(Boolean).join(', ')}`.trim();
  }
  if (fields['hero.line1']) return ['hero.line1', 'hero.line2', 'hero.line3'].map(k => pick(page, site, k)).join(' ').replace(/\s+/g, ' ').trim();
  for (const [a, b] of [['hero.title', 'hero.highlight'], ['header.heading', ''], ['hero.heading', '']]) {
    if (fields[a]) return `${pick(page, site, a)} ${b && fields[b] ? pick(page, site, b) : ''}`.replace(/\s+/g, ' ').trim();
  }
  return pick(page, site, 'seo.title');
}

function siteNav() {
  const links = PAGES.filter(p => p.id !== 'footer').map(p => `<a href="${p.path}">${escapeHtml(p.label)}</a>`);
  return `<nav>${links.join(' ')}</nav>`;
}

function pageBody(page: PageSchema, site: SiteData) {
  const parts: string[] = [`<h1>${escapeHtml(pageHeading(page, site))}</h1>`];
  if (page.id === 'home') {
    const f = allFields(page)['hero.words'];
    const raw = site.overrides.home?.['hero.words'];
    const items = (Array.isArray(raw) ? raw : f?.type === 'list' ? f.default : []) as { word?: string }[];
    parts.push(`<p>${escapeHtml(`${pick(page, site, 'hero.lead')} ${items.map(w => w.word).filter(Boolean).join(', ')}`)}</p>`);
  }
  const skip = new Set(['hero.title', 'hero.highlight', 'hero.lead', 'hero.words', 'header.heading', 'hero.heading', 'hero.line1', 'hero.line2', 'hero.line3']);
  for (const section of page.sections) {
    for (const [key, field] of Object.entries(section.fields)) {
      if (skip.has(key)) continue;
      const html = fieldText(key, field, site.overrides[page.id]?.[key]);
      if (html) parts.push(html);
    }
  }
  if (page.path === '/blogs') {
    parts.push(`<ul>${site.posts.map(p => `<li><a href="/blogs/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a> ${escapeHtml(p.excerpt)}</li>`).join('')}</ul>`);
  }
  if (page.path === '/gallery-swimming-pool-construction' && site.projects.length) {
    parts.push(`<ul>${site.projects.map(p => `<li><a href="/projects/${escapeHtml(p.slug)}">${escapeHtml(p.name)}</a></li>`).join('')}</ul>`);
  }
  return `<main>${parts.join('')}</main>${siteNav()}`;
}

function pageExtras(page: PageSchema, site: SiteData): string[] {
  if (page.id !== 'contact') return [];
  const extras: string[] = [];
  const fields = allFields(page);
  const list = <T,>(key: string): T[] => {
    const raw = site.overrides.contact?.[key];
    const f = fields[key];
    return (Array.isArray(raw) ? raw : f?.type === 'list' ? f.default : []) as T[];
  };
  const branches = list<{ city: string; phone: string; address: string; lat: string; lng: string }>('map.locations');
  if (branches.length) {
    extras.push(jsonLd({
      '@context': 'https://schema.org',
      '@graph': branches.filter(b => b.city).map(b => ({
        '@type': 'HomeAndConstructionBusiness',
        name: `Crystal Pools ${b.city}`,
        parentOrganization: { '@id': `${SITE_URL}/#business` },
        url: `${SITE_URL}${page.path}`,
        telephone: firstPhone(b.phone ?? ''),
        address: b.address ? { '@type': 'PostalAddress', streetAddress: b.address, addressCountry: 'IN' } : undefined,
        geo: b.lat && b.lng ? { '@type': 'GeoCoordinates', latitude: Number(b.lat), longitude: Number(b.lng) } : undefined,
      })),
    }));
  }
  const faqs = list<{ question: string; answer: string }>('faq.items').filter(f => f.question && f.answer);
  if (faqs.length) {
    extras.push(jsonLd({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    }));
  }
  return extras;
}

function pageMeta(page: PageSchema, site: SiteData): PageMeta {
  const fields = allFields(page);
  const heroImage = fields['hero.image'] ? mediaUrl('pages', pick(page, site, 'hero.image')) : null;
  return {
    title: pick(page, site, 'seo.title'),
    description: pick(page, site, 'seo.description'),
    image: heroImage ?? mediaUrl('site', site.settings?.og_image) ?? `${SITE_URL}/images/hero/light-mode.webp`,
    canonical: `${SITE_URL}${page.path === '/' ? '/' : page.path}`,
    extra: pageExtras(page, site),
  };
}

// ── Blog posts ──

interface Post extends PostSummary {
  content: string; featured_image: string | null; og_image: string | null;
  meta_title: string | null; meta_description: string | null;
  tags: string[] | null; published_at: string;
}

function postMeta(post: Post): PageMeta {
  const image = mediaUrl('blog', post.og_image || post.featured_image);
  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    image,
    canonical: `${SITE_URL}/blogs/${post.slug}`,
    type: 'article',
    extra: [
      post.tags?.length ? `<meta name="keywords" content="${escapeHtml(post.tags.join(', '))}" />` : '',
      `<meta property="article:published_time" content="${escapeHtml(post.published_at)}" />`,
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.meta_description || post.excerpt,
        image: image ?? undefined,
        datePublished: post.published_at,
        dateModified: post.updated_at,
        author: { '@type': 'Organization', name: 'Crystal Pools' },
        publisher: { '@id': `${SITE_URL}/#business` },
        mainEntityOfPage: `${SITE_URL}/blogs/${post.slug}`,
      }),
    ],
  };
}

// ── Sitemap ──

function sitemap(site: SiteData) {
  const entry = (path: string, changefreq: string, priority: string, lastmod?: string) => [
    '  <url>',
    `    <loc>${SITE_URL}${path}</loc>`,
    lastmod ? `    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : '',
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n');

  const urls = [
    ...PAGES.filter(p => p.id !== 'footer').map(p =>
      entry(p.path, p.path === '/' || p.path === '/blogs' ? 'weekly' : 'monthly', p.path === '/' ? '1.0' : p.group === 'Main pages' ? '0.8' : '0.7')),
    ...site.cities.map(c => entry(`/swimming-pool-contractor/${c.slug}`, 'monthly', '0.8', c.updated_at)),
    ...site.projects.map(p => entry(`/projects/${p.slug}`, 'monthly', '0.6', p.updated_at)),
    ...site.posts.map(p => entry(`/blogs/${p.slug}`, 'monthly', '0.6', p.updated_at)),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// ── The request handler ──

const HTML = { 'Content-Type': 'text/html; charset=utf-8' };
// CDN cache: edits appear within minutes; the last good page keeps serving if a refresh fails.
const PAGE_CACHE = 'public, max-age=0, s-maxage=120, stale-while-revalidate=86400, stale-if-error=86400';

const redirect = (to: string, status = 301): SeoResponse => ({
  status,
  headers: { Location: to, 'Cache-Control': 'public, max-age=0, s-maxage=600' },
  body: '',
});

const page = (body: string, status = 200): SeoResponse => ({
  status,
  headers: { ...HTML, 'Cache-Control': status === 200 ? PAGE_CACHE : 'public, max-age=0, s-maxage=300' },
  body,
});

/** Where an old city URL should go now: the city page once it's published. */
function cityFromLegacy(path: string, site: SiteData) {
  const slug = path.match(/^\/contact-swimming-pool-contractors-in-([a-z-]+)$/)?.[1];
  return slug && site.cities.some(c => c.slug === slug) ? `/swimming-pool-contractor/${slug}` : null;
}

export async function handleSeoRequest(rawPath: string, shell: string, search = ''): Promise<SeoResponse> {
  let path = rawPath || '/';
  try { path = decodeURI(path); } catch { /* keep as sent */ }
  if (!path.startsWith('/') || path.startsWith('//')) path = '/';

  const site = await getSiteData();

  if (path === '/sitemap.xml') {
    return {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400' },
      body: sitemap(site),
    };
  }

  // One address per page: no trailing slash
  if (path.length > 1 && path.endsWith('/')) return redirect(encodeURI(path.replace(/\/+$/, '') || '/') + search);

  const known = PAGES.find(p => p.id !== 'footer' && p.path === path);
  if (known) return page(renderBody(renderHead(shell, pageMeta(known, site), site), pageBody(known, site)));

  const notFound = () => page(renderHead(shell, {
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist. Head back to Crystal Pools to explore our swimming pools and services.',
    image: null,
    canonical: `${SITE_URL}${encodeURI(path)}`,
    extra: ['<meta name="robots" content="noindex" />'],
  }, site), 404);

  const postSlug = path.match(/^\/blogs\/([^/]+)$/)?.[1];
  if (postSlug) {
    const rows = await supabaseGet<Post[]>(`blogs?select=*&slug=eq.${encodeURIComponent(postSlug)}&limit=1`);
    const post = rows?.[0];
    if (post) {
      const body = `<main><h1>${escapeHtml(post.title)}</h1>${safeHtml(post.content ?? '')}</main>${siteNav()}`;
      return page(renderBody(renderHead(shell, postMeta(post), site), body));
    }
    // Supabase unreachable: serve the app rather than tell Google the post is gone
    if (!rows) return { status: 200, headers: { ...HTML, 'Cache-Control': 'no-store' }, body: shell };
    const moved = await supabaseGet<{ blog: { slug: string } | null }[]>(`blog_slug_redirects?select=blog:blogs(slug)&old_slug=eq.${encodeURIComponent(postSlug)}&limit=1`);
    if (moved?.[0]?.blog?.slug) return redirect(`/blogs/${encodeURIComponent(moved[0].blog.slug)}`);
    return notFound();
  }

  const legacyPost = path.match(/^\/blog\/([^/]+)$/)?.[1];
  if (legacyPost) return redirect(`/blogs/${encodeURIComponent(legacyPost)}`);

  const citySlug = path.match(/^\/swimming-pool-contractor\/([^/]+)$/)?.[1];
  const city = citySlug ? site.cities.find(c => c.slug === citySlug) : undefined;
  if (city) {
    const title = city.meta_title || `Swimming Pool Contractor in ${city.city}`;
    const canonical = `${SITE_URL}/swimming-pool-contractor/${city.slug}`;
    const meta: PageMeta = {
      title,
      description: city.meta_description || city.intro,
      canonical,
      image: mediaUrl('pages', city.hero_image) ?? mediaUrl('site', site.settings?.og_image) ?? `${SITE_URL}/images/hero/light-mode.webp`,
      extra: [jsonLd({
        '@context': 'https://schema.org',
        '@type': 'HomeAndConstructionBusiness',
        name: `Crystal Pools ${city.city}`,
        parentOrganization: { '@id': `${SITE_URL}/#business` },
        url: canonical,
        telephone: firstPhone(city.phone ?? ''),
        address: city.address ? { '@type': 'PostalAddress', streetAddress: city.address, addressRegion: city.region || undefined, addressCountry: 'IN' } : undefined,
        geo: city.lat != null && city.lng != null ? { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lng } : undefined,
      })],
    };
    const body = `<main><h1>${escapeHtml(city.heading || title)}</h1><p>${escapeHtml(city.intro)}</p>${safeHtml(city.body ?? '')}<p>${escapeHtml(city.address)}</p><p>${escapeHtml(city.phone)}</p></main>${siteNav()}`;
    return page(renderBody(renderHead(shell, meta, site), body));
  }

  const projectSlug = path.match(/^\/projects\/([^/]+)$/)?.[1];
  const project = projectSlug ? site.projects.find(p => p.slug === projectSlug) : undefined;
  if (project) {
    const description = project.meta_description || project.description || `${project.name}, a swimming pool project by Crystal Pools${project.location ? ` in ${project.location}` : ''}.`;
    const meta: PageMeta = {
      title: project.meta_title || `${project.name}${project.location ? `, ${project.location}` : ''}`,
      description: description.slice(0, 300),
      image: mediaUrl('projects', project.cover_image),
      canonical: `${SITE_URL}/projects/${project.slug}`,
    };
    const body = `<main><h1>${escapeHtml(project.name)}</h1><p>${escapeHtml(project.location)}</p><p>${escapeHtml(project.description)}</p></main>${siteNav()}`;
    return page(renderBody(renderHead(shell, meta, site), body));
  }

  // Redirects: admin-managed first, then a published city page, then the built-in list of old URLs
  const lower = path.toLowerCase();
  const managed = site.redirects[lower];
  if (managed && managed.to !== path) return redirect(managed.to, managed.status);
  const to = cityFromLegacy(lower, site) ?? LEGACY_REDIRECTS[lower];
  if (to && to !== path) return redirect(to + search);

  return notFound();
}
