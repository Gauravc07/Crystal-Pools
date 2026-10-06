# Crystal Pools

Marketing website for Crystal Pools, plus a separate admin panel for managing its content.
All content (page text and images, blogs, projects, testimonials, enquiries, banner, settings) lives in Supabase.

| App | Folder | Dev URL | Build output | Deployed at |
|---|---|---|---|---|
| Public website | `src/`, `index.html`, `server.ts` | http://localhost:5173 | `dist/` (+ `dist/server.cjs`) | www.crystalpools.in |
| Admin panel | `admin/` | http://localhost:5174/admin/ | `dist/admin/` | www.crystalpools.in/admin |

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
| `npm run build` | Builds the website, the admin panel (into `dist/admin`) and the Node server |
| `npm run build:admin` | Builds only the admin panel into `dist/admin` |
| `npm start` | Runs the production website server (port 3000, or `PORT`) |
| `npm run db:migrate` | Applies new database migrations |
| `npm run admin:create -- --email x@y.com --name "Full Name" --role super_admin` | Creates an admin user from the command line (normally done in the panel) |
| `npm run images:optimize` | Converts heavy PNG/JPG images to WebP (dry run; add `-- --apply`) |
| `npm run lint` | Type-checks everything and validates the page content definitions |

## How the admin panel is kept separate

- **Separate app.** `admin/` has its own entry page, Vite config (`vite.admin.config.ts`) and build folder. The website never imports it, so no admin code ships to visitors. The website has no login, no admin link and no `/admin` route.
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

`server.ts` serves the built site and adds, server-side so crawlers and link previews see it:
- each page's SEO title, description and share image (including admin edits) and each blog post's;
- the Google Analytics tag and Search Console verification, when set in **Settings → Google**;
- business details as structured data (`HomeAndConstructionBusiness`) with the Google Business Profile link;
- `/sitemap.xml` with every published post, 301 redirects from the old `/blog` URLs and renamed posts;
- real 404 status for unknown URLs, security headers, and long-term caching for build assets.

It needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at runtime (read from `.env` if present), and
`PUBLIC_SITE_URL` for canonical links.
