-- ============================================================================
-- Crystal Pools — initial schema
-- Tables, Row Level Security, storage buckets.
--
-- Security model:
--   * The public website uses the publishable (anon) key. It can only READ
--     published content and INSERT enquiries (leads). Nothing else.
--   * Admin users are Supabase Auth users WITH a row in public.profiles.
--     Signing up alone grants nothing — no profile, no access.
--   * Roles: super_admin (everything) and editor (content, drafts only for blogs).
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Profiles (admin users) ─────────────────────────────────────────────────

create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text not null,
  full_name             text not null default '',
  role                  text not null check (role in ('super_admin', 'editor')),
  is_active             boolean not null default true,
  must_change_password  boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- security definer so RLS policies can call these without recursion
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = 'super_admin'
  );
$$;

-- Never allow the last active super admin to be removed, demoted or deactivated.
create or replace function public.guard_last_super_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  remaining int;
begin
  if (tg_op = 'DELETE' and old.role = 'super_admin' and old.is_active)
     or (tg_op = 'UPDATE' and old.role = 'super_admin' and old.is_active
         and (new.role <> 'super_admin' or not new.is_active)) then
    select count(*) into remaining from public.profiles
      where role = 'super_admin' and is_active and id <> old.id;
    if remaining = 0 then
      raise exception 'At least one active Super Admin is required.';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger profiles_guard_last_super_admin
  before update or delete on public.profiles
  for each row execute function public.guard_last_super_admin();

-- Lets a user clear their own "must change password" flag after changing it.
create or replace function public.clear_must_change_password()
returns void language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

alter table public.profiles enable row level security;

create policy "profiles: read own or super admin reads all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

create policy "profiles: super admin manages"
  on public.profiles for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ── Blog categories ────────────────────────────────────────────────────────

create table public.blog_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.blog_categories (name, slug, sort_order) values
  ('Maintenance',  'maintenance',  1),
  ('Architecture', 'architecture', 2),
  ('Wellness',     'wellness',     3),
  ('Technology',   'technology',   4);

alter table public.blog_categories enable row level security;

create policy "categories: public read"
  on public.blog_categories for select to anon, authenticated using (true);

create policy "categories: super admin manages"
  on public.blog_categories for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ── Blogs ──────────────────────────────────────────────────────────────────

create table public.blogs (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id       uuid references public.blog_categories(id) on delete set null,
  excerpt           text not null default '',
  content           text not null default '',          -- sanitized HTML from the editor
  featured_image    text,                               -- storage path in bucket "blog"
  author_name       text not null default '',
  is_featured       boolean not null default false,
  status            text not null default 'draft' check (status in ('draft', 'published')),
  published_at      timestamptz,
  meta_title        text,
  meta_description  text,
  tags              text[] not null default '{}',
  og_image          text,
  created_by        uuid references public.profiles(id) on delete set null,
  updated_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index blogs_public_idx on public.blogs (status, published_at desc);
create index blogs_category_idx on public.blogs (category_id);
create index blogs_tags_idx on public.blogs using gin (tags);

create trigger blogs_updated_at before update on public.blogs
  for each row execute function public.set_updated_at();

-- Old slugs keep working (301) after a published post is renamed.
create table public.blog_slug_redirects (
  old_slug    text primary key,
  blog_id     uuid not null references public.blogs(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create or replace function public.track_blog_slug_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.slug <> old.slug and old.status = 'published' then
    insert into public.blog_slug_redirects (old_slug, blog_id)
      values (old.slug, old.id)
      on conflict (old_slug) do update set blog_id = excluded.blog_id;
  end if;
  delete from public.blog_slug_redirects where old_slug = new.slug;
  return new;
end $$;

create trigger blogs_track_slug_change after update of slug on public.blogs
  for each row execute function public.track_blog_slug_change();

alter table public.blogs enable row level security;
alter table public.blog_slug_redirects enable row level security;

create policy "blogs: public reads published"
  on public.blogs for select to anon, authenticated
  using (status = 'published' and published_at <= now());

create policy "blogs: admins read all"
  on public.blogs for select to authenticated using (public.is_admin());

-- Editors may create and edit drafts only; Super Admins publish.
create policy "blogs: insert"
  on public.blogs for insert to authenticated
  with check (public.is_super_admin() or (public.is_admin() and status = 'draft'));

create policy "blogs: update"
  on public.blogs for update to authenticated
  using (public.is_super_admin() or (public.is_admin() and status = 'draft'))
  with check (public.is_super_admin() or (public.is_admin() and status = 'draft'));

create policy "blogs: delete"
  on public.blogs for delete to authenticated
  using (public.is_super_admin() or (public.is_admin() and status = 'draft'));

create policy "redirects: public read"
  on public.blog_slug_redirects for select to anon, authenticated using (true);

-- ── Projects (gallery) ─────────────────────────────────────────────────────

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  location     text not null default '',
  pool_type    text not null check (pool_type in (
                 'private', 'commercial', 'recreational', 'competition',
                 'vanishing-edge', 'overflow', 'skimmer', 'readymade')),
  description  text not null default '',
  cover_image  text,                                     -- storage path in bucket "projects"
  images       jsonb not null default '[]'::jsonb,       -- [{ "path": "...", "alt": "..." }] in display order
  is_published boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index projects_public_idx on public.projects (is_published, pool_type, sort_order);

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy "projects: public reads published"
  on public.projects for select to anon, authenticated using (is_published);

create policy "projects: admins manage"
  on public.projects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Testimonials ───────────────────────────────────────────────────────────

create table public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  designation  text not null default '',
  photo        text,                                     -- storage path in bucket "testimonials"
  review       text not null,
  rating       smallint not null check (rating between 1 and 5),
  is_published boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger testimonials_updated_at before update on public.testimonials
  for each row execute function public.set_updated_at();

alter table public.testimonials enable row level security;

create policy "testimonials: public reads published"
  on public.testimonials for select to anon, authenticated using (is_published);

create policy "testimonials: admins manage"
  on public.testimonials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Leads (contact form enquiries) ─────────────────────────────────────────

create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 200),
  email         text not null check (char_length(email) between 3 and 320),
  phone         text not null default '' check (char_length(phone) <= 30),
  project_type  text not null default '' check (char_length(project_type) <= 100),
  message       text not null check (char_length(message) between 1 and 5000),
  source_page   text not null default '' check (char_length(source_page) <= 300),
  status        text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index leads_status_idx on public.leads (status, created_at desc);

create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

-- The website may submit an enquiry, but can never read, edit or delete one.
create policy "leads: public can submit"
  on public.leads for insert to anon, authenticated
  with check (status = 'new' and notes = '');

create policy "leads: super admin reads"
  on public.leads for select to authenticated using (public.is_super_admin());

create policy "leads: super admin updates"
  on public.leads for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "leads: super admin deletes"
  on public.leads for delete to authenticated using (public.is_super_admin());

-- ── Site settings (single row: contact info, SEO, homepage banner) ─────────

create table public.site_settings (
  id                    int primary key default 1 check (id = 1),
  phone                 text not null default '+91 95525 26371',
  whatsapp              text not null default '919552526371',
  email                 text not null default 'sales@crystalpools.in',
  address               text not null default '',
  map_lat               double precision,
  map_lng               double precision,
  branches              text[] not null default array['Pune', 'Mumbai', 'Nashik', 'Kolhapur', 'Rajasthan', 'Goa'],
  social_links          jsonb not null default '{}'::jsonb,
  seo_title             text not null default 'Crystal Pools | Premium Swimming Pool Construction',
  seo_description       text not null default 'Crystal Pools is a leading swimming pool consultant, builder and construction company in Pune since 1993.',
  og_image              text,
  hero_video            text,                            -- storage paths in bucket "site"
  hero_image_light      text,
  hero_image_dark       text,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles(id) on delete set null
);

insert into public.site_settings (id) values (1);

create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;

create policy "settings: public read"
  on public.site_settings for select to anon, authenticated using (true);

create policy "settings: super admin updates"
  on public.site_settings for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ── Dashboard stats ────────────────────────────────────────────────────────

create or replace function public.dashboard_stats()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return json_build_object(
    'leads_total',         (select count(*) from public.leads),
    'leads_new',           (select count(*) from public.leads where status = 'new'),
    'blogs_total',         (select count(*) from public.blogs),
    'blogs_published',     (select count(*) from public.blogs where status = 'published'),
    'blogs_draft',         (select count(*) from public.blogs where status = 'draft'),
    'projects_total',      (select count(*) from public.projects),
    'projects_published',  (select count(*) from public.projects where is_published),
    'testimonials_total',  (select count(*) from public.testimonials)
  );
end $$;

revoke execute on function public.dashboard_stats() from anon;
revoke execute on function public.clear_must_change_password() from anon;

-- ── Storage buckets (public read; only admins write) ───────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('blog',         'blog',         true, 5242880,  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('projects',     'projects',     true, 5242880,  array['image/jpeg', 'image/png', 'image/webp']),
  ('testimonials', 'testimonials', true, 2097152,  array['image/jpeg', 'image/png', 'image/webp']),
  ('site',         'site',         true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'video/mp4', 'application/pdf']);

create policy "storage: admins upload content images"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('blog', 'projects', 'testimonials') and public.is_admin());

create policy "storage: admins update content images"
  on storage.objects for update to authenticated
  using (bucket_id in ('blog', 'projects', 'testimonials') and public.is_admin());

create policy "storage: admins delete content images"
  on storage.objects for delete to authenticated
  using (bucket_id in ('blog', 'projects', 'testimonials') and public.is_admin());

create policy "storage: super admin manages site assets"
  on storage.objects for all to authenticated
  using (bucket_id = 'site' and public.is_super_admin())
  with check (bucket_id = 'site' and public.is_super_admin());
