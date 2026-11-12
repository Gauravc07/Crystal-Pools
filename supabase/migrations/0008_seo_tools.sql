-- SEO tools for the admin panel. Additive only: no existing column, row or rule is changed
-- except can_write_bucket, which gains one extra case. Safe to apply before the code is deployed.

-- ── 'seo' permission: page titles and descriptions ──────────────────────────
-- Only the seo.* keys, so an SEO user can't change visible page text this way.
create policy "page content: seo team writes seo fields"
  on public.page_content for all to authenticated
  using (public.has_permission('seo') and key like 'seo.%')
  with check (public.has_permission('seo') and key like 'seo.%');

-- ── Company facts and lead attribution ──────────────────────────────────────
alter table public.site_settings
  add column founding_year text not null default '1993' check (founding_year ~ '^[0-9]{4}$'),
  add column est_label text not null default 'EST 2000' check (char_length(est_label) <= 30);

alter table public.leads
  add column traffic_source text not null default '' check (char_length(traffic_source) <= 40),
  add column referrer       text not null default '' check (char_length(referrer) <= 300),
  add column landing_page   text not null default '' check (char_length(landing_page) <= 300),
  add column utm_source     text not null default '' check (char_length(utm_source) <= 100),
  add column utm_medium     text not null default '' check (char_length(utm_medium) <= 100),
  add column utm_campaign   text not null default '' check (char_length(utm_campaign) <= 100);

-- ── Project pages ───────────────────────────────────────────────────────────
alter table public.projects
  add column meta_title       text not null default '' check (char_length(meta_title) <= 120),
  add column meta_description text not null default '' check (char_length(meta_description) <= 320);

-- ── Redirects managed from the admin ────────────────────────────────────────
create table public.seo_redirects (
  id          uuid primary key default gen_random_uuid(),
  from_path   text not null unique check (from_path ~ '^/[^?#[:space:]]*$' and from_path = lower(from_path) and char_length(from_path) <= 300),
  to_path     text not null check (to_path ~ '^(/|https://)[^[:space:]]*$' and char_length(to_path) <= 500),
  status_code smallint not null default 301 check (status_code in (301, 302)),
  note        text not null default '' check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (from_path <> to_path)
);

create trigger seo_redirects_updated_at before update on public.seo_redirects
  for each row execute function public.set_updated_at();

alter table public.seo_redirects enable row level security;

create policy "seo redirects: public read"
  on public.seo_redirects for select to anon, authenticated using (true);

create policy "seo redirects: seo team manages"
  on public.seo_redirects for all to authenticated
  using (public.has_permission('seo')) with check (public.has_permission('seo'));

-- ── City pages ──────────────────────────────────────────────────────────────
create table public.city_pages (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  city             text not null check (char_length(city) between 1 and 80),
  region           text not null default '' check (char_length(region) <= 80),
  meta_title       text not null default '' check (char_length(meta_title) <= 120),
  meta_description text not null default '' check (char_length(meta_description) <= 320),
  heading          text not null default '' check (char_length(heading) <= 160),
  intro            text not null default '' check (char_length(intro) <= 1000),
  body             text not null default '',
  contact_name     text not null default '' check (char_length(contact_name) <= 120),
  phone            text not null default '' check (char_length(phone) <= 80),
  address          text not null default '' check (char_length(address) <= 400),
  lat              double precision check (lat between -90 and 90),
  lng              double precision check (lng between -180 and 180),
  hero_image       text,
  is_published     boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger city_pages_updated_at before update on public.city_pages
  for each row execute function public.set_updated_at();

alter table public.city_pages enable row level security;

create policy "city pages: public reads published"
  on public.city_pages for select to anon, authenticated using (is_published);

create policy "city pages: seo team manages"
  on public.city_pages for all to authenticated
  using (public.has_permission('seo')) with check (public.has_permission('seo'));

-- Drafts from the branch details on the Contact page. Nothing appears on the website until
-- the SEO team writes the text and publishes each one.
insert into public.city_pages (slug, city, region, contact_name, phone, address, lat, lng, sort_order) values
  ('pune', 'Pune', 'Maharashtra', 'Mr. Nilesh Shukla (Managing Director)', '+91 98509 97486 / (020) 24690602', 'Sr. No. 10/1/1, Shed No. 3&4, Nr. Kailash Jeevan Factory, Dhayari, Pune 411041', 18.4372, 73.8052, 1),
  ('nashik', 'Nashik', 'Maharashtra', 'Mr. Sarang Sukenkar', '+91 98502 37502', 'Block no 2, Ambarai Apartment, Vise mala, Canada corner, Nashik 422005', 20.0075, 73.7663, 2),
  ('kolhapur', 'Kolhapur', 'Maharashtra', 'Mr. Prasad Vaidya', '+91 98221 16662', 'B305, Anant Pride, Kolhapur, Maharashtra 416002', 16.7050, 74.2433, 3),
  ('sindhudurg', 'Sindhudurg', 'Maharashtra', 'Sales & Support', '+91 95525 26371', 'Sindhudurg, Maharashtra 416812', 16.0543, 73.5274, 4),
  ('goa', 'Goa', 'Goa', 'Mr. Ashis Patel', '+91 93242 29688', '101/A4 Saldhana Kyle Gardens, near Church of Piety, Khobra Waddo, Calangute, Goa 403516', 15.5447, 73.7554, 5),
  ('udaipur', 'Udaipur', 'Rajasthan', 'Shri Siddhi Vinayak Associates', '+91 96940 99801', '20 Nakoda complex, Hansa Palace Lane, Hiran Magri Sec 4, Udaipur 313002', 24.5712, 73.7125, 6);

-- City photos are stored under pages/cities/...
create or replace function public.can_write_bucket(bucket text, object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select case bucket
    when 'blog'         then public.has_permission('blogs')
    when 'projects'     then public.has_permission('projects')
    when 'testimonials' then public.has_permission('testimonials')
    when 'pages'        then
      case split_part(object_name, '/', 1)
        when 'library' then public.can_edit_any_page()
        when 'cities'  then public.has_permission('seo')
        else public.has_permission('page:' || split_part(object_name, '/', 1))
      end
    else false
  end;
$$;
revoke execute on function public.can_write_bucket(text, text) from public, anon;

-- ── Monthly report ──────────────────────────────────────────────────────────
create table public.seo_monthly (
  month          date primary key check (extract(day from month) = 1),
  review_count   int check (review_count >= 0),
  average_rating numeric(2, 1) check (average_rating between 0 and 5),
  keyword_position numeric(5, 1) check (keyword_position >= 0),
  phone_clicks   int check (phone_clicks >= 0),
  whatsapp_clicks int check (whatsapp_clicks >= 0),
  google_leads   int check (google_leads >= 0),
  notes          text not null default '' check (char_length(notes) <= 2000),
  updated_at     timestamptz not null default now()
);

create trigger seo_monthly_updated_at before update on public.seo_monthly
  for each row execute function public.set_updated_at();

alter table public.seo_monthly enable row level security;

create policy "seo monthly: seo team manages"
  on public.seo_monthly for all to authenticated
  using (public.has_permission('seo')) with check (public.has_permission('seo'));

-- ── Functions: narrow changes the SEO team may make without wider access ─────

-- Blog SEO fields only, including on published posts (Editors otherwise can't touch those).
create function public.set_blog_seo(p_id uuid, p_title text, p_description text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('seo') then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.blogs
    set meta_title = nullif(trim(p_title), ''), meta_description = nullif(trim(p_description), '')
    where id = p_id;
  if not found then raise exception 'Post not found'; end if;
end;
$$;

-- Google connection fields only, not the rest of site settings.
create function public.set_google_settings(p_ga text, p_gsc text, p_gbp text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('seo') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_gbp <> '' and p_gbp !~ '^https://' then raise exception 'Business Profile link must start with https://'; end if;
  update public.site_settings
    set ga_measurement_id = p_ga, gsc_verification = p_gsc, gbp_url = p_gbp, updated_by = auth.uid()
    where id = 1;
end;
$$;

-- Lead counts per month by source. Counts only: no names, emails or phone numbers.
create function public.seo_lead_counts(p_months int default 12)
returns table (month date, source text, leads bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_permission('seo') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select date_trunc('month', l.created_at)::date, coalesce(nullif(l.traffic_source, ''), 'unknown'), count(*)
    from public.leads l
    where l.created_at >= date_trunc('month', now()) - make_interval(months => greatest(p_months, 1) - 1)
    group by 1, 2;
end;
$$;

revoke execute on function public.set_blog_seo(uuid, text, text) from public, anon;
revoke execute on function public.set_google_settings(text, text, text) from public, anon;
revoke execute on function public.seo_lead_counts(int) from public, anon;
grant execute on function public.set_blog_seo(uuid, text, text) to authenticated;
grant execute on function public.set_google_settings(text, text, text) to authenticated;
grant execute on function public.seo_lead_counts(int) to authenticated;
