# Crystal Pools

Marketing website for Crystal Pools, plus a separate admin panel for managing its content and the CAC workspace for requirement forms, FRP quotations and drawings (`cac/`, see [cac/README.md](cac/README.md)).
All content (page text and images, blogs, projects, testimonials, enquiries, banner, settings) lives in Supabase.

| App | Folder | Dev URL | Build output | Deployed at |
|---|---|---|---|---|
| Public website | `src/`, `index.html`, `server.ts` | http://localhost:5173 | `dist/` (+ `dist/server.cjs`) | www.crystalpools.in |
| Admin panel | `admin/` | http://localhost:5174/admin/ | `dist/admin/` | www.crystalpools.in/admin |
| CAC workspace | `cac/` | http://127.0.0.1:5185 | `dist/cac/` | www.crystalpools.in/cac |

## Setup

```bash
npm install
cp .env.example .env      # fill in the Supabase values
npm run db:migrate        # applies supabase/migrations/*.sql (once each)
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Public website dev server |
| `npm run dev:admin` | Admin panel dev server |
| `npm run build` | Builds the website, the admin panel (into `dist/admin`), the Node server and CAC (into `dist/cac`) |
| `npm run build:cac` | Installs CAC's own dependencies and builds only CAC into `dist/cac` |
| `npm run build:admin` | Builds only the admin panel into `dist/admin` |
| `npm start` | Runs the production website server (port 3000, or `PORT`) |
| `npm run db:migrate` | Applies new database migrations |
| `npm run admin:create -- --email x@y.com --name "Full Name" --role super_admin` | Creates an admin user from the command line (normally done in the panel) |
| `npm run images:optimize` | Converts heavy PNG/JPG images to WebP (dry run; add `-- --apply`) |
| `npm run lint` | Type-checks everything and validates the page content definitions |

## How the admin panel is kept separate

- **Separate app.** `admin/` has its own entry page, Vite config (`vite.admin.config.ts`) and build folder. The website never imports it, so no admin code ships to visitors, and the website has no login or link to the admin.
- **Served at /admin.** The admin is built into `dist/admin` and served at `/admin` by the same Vercel project (see `vercel.json`). It is `noindex` (meta tag and X-Robots-Tag header) and `robots.txt` disallows `/admin`. The website has no link to it.
- **Real security is in the database.** Every table and storage bucket has Row Level Security. Visitors can only read published content and submit enquiries; everything else depends on the signed-in user's role and permissions.

## Roles and access

| | Super Admin | Editor |
|---|---|---|
| Pages (text & images) | All pages | Only the pages ticked for them |
| Blogs | Create, edit, publish, delete | Drafts only — if given "Blogs" |
| Projects, testimonials | ✔ | If given that section |
| Enquiries, banner, settings, users | ✔ | ✘ |

Super Admins create users, choose their role and tick an Editor's sections and pages under **Users**. New users get a
one-time temporary password and must set their own at first sign-in. User management runs as Postgres functions
(`admin_create_user`, `admin_reset_password`, `admin_set_active`, `admin_delete_user`) that only work for an active
Super Admin — no secret key is needed in the browser.

## Editable page content

Every page's text and images are defined in `src/content/pages/*.ts` with today's content as the default. The website
shows an admin's saved version where one exists (table `page_content`, one row per changed field) and the default
otherwise, so "Reset to default" always works. To make something new editable: add a field to the page's definition,
then read it in the component with `usePageContent(schema).text('key')` / `.image('key')` / `.list('key')`.
`npm run lint` checks the definitions (unique ids/keys, default files exist).

## Production website server

On Vercel, every website page goes through one function, `api/render.mjs`, which runs `server/seo.ts`. (`server.ts` runs the same logic under Express for other hosts.) It adds, so crawlers and link previews see it in the first response:
- each page's SEO title, description, canonical and share image, with admin edits, and readable page text that React replaces on load;
- the Google Analytics tag and Search Console verification, when set in the admin;
- structured data: the business, each branch, the Contact FAQ, blog posts and city pages;
- `/sitemap.xml` with every page, published post, city page and project;
- real 404s, 301s for trailing slashes, renamed posts, old website URLs (`server/legacyRedirects.ts`) and admin-managed redirects.

**How it builds:** Vercel serves files before rewrites, so `scripts/build-render.mjs` (the last step of `npm run build`) removes `dist/index.html` and `dist/sitemap.xml`, bakes the page shell and public Supabase settings into `dist-server/render.cjs`, and keeps `dist/_shell.html` as a fallback.

**If Supabase is down or slow,** pages render from built-in defaults within about 2.5 seconds. Responses are cached at the CDN for 2 minutes, so admin edits appear within about 5 minutes.

**To roll back:** revert the merge, or promote the previous deployment in Vercel. Migration `0008` only adds things, so it can stay.

## SEO tools

The admin's **SEO** section needs the `seo` permission (Users → edit user), and needs migration `0008` applied (`npm run db:migrate`) **before** the code is deployed. It covers titles and descriptions with checks, redirects, city pages, Google connections and company facts, and the monthly report. An SEO user can change only SEO fields, sees lead counts but not the leads, and can't change visible page text.

Run the checks with `npm run test:seo-db` (migrations and permissions on an in-process database; needs `cac` dependencies installed) and `npm run check:content` (includes title and description lengths).
