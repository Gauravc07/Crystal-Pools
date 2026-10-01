-- ============================================================================
-- 1. Spam protection for the public contact form
--    Max 3 enquiries per email address per hour, and max 60 site-wide per 10 minutes.
-- ============================================================================

create or replace function public.limit_lead_submissions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Admins (authenticated with a profile) are never limited
  if public.is_admin() then
    return new;
  end if;

  if (select count(*) from public.leads
        where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many enquiries from this email address. Please try again later.'
      using errcode = 'P0001';
  end if;

  if (select count(*) from public.leads where created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'The enquiry form is temporarily busy. Please try again shortly.'
      using errcode = 'P0001';
  end if;

  return new;
end $$;

create trigger leads_rate_limit before insert on public.leads
  for each row execute function public.limit_lead_submissions();

create index if not exists leads_email_created_idx on public.leads (lower(email), created_at desc);

-- ============================================================================
-- 2. Move the 5 posts that were hard-coded in src/data/blog.ts into the database.
--    They had no body text; the excerpt is used as placeholder content until
--    the client writes the full articles in the admin panel.
-- ============================================================================

insert into public.blogs
  (title, slug, category_id, excerpt, content, featured_image, author_name, is_featured, status, published_at, tags)
values
  ('The Ultimate Guide to Swimming Pool Maintenance',
   'ultimate-guide-swimming-pool-maintenance',
   (select id from public.blog_categories where slug = 'maintenance'),
   'Discover the secrets to keeping your pool pristine year-round, from water chemistry balancing to advanced filtration techniques.',
   '<p>Discover the secrets to keeping your pool pristine year-round, from water chemistry balancing to advanced filtration techniques.</p>',
   '/images/services/renovation/1.png', 'Technical Team', true, 'published', '2025-01-15 10:00+05:30',
   array['pool maintenance', 'water chemistry', 'filtration']),

  ('Infinity Pools vs. Overflow: What''s the Difference?',
   'infinity-pools-vs-overflow-difference',
   (select id from public.blog_categories where slug = 'architecture'),
   'An architectural deep-dive into the structural and aesthetic differences between vanishing edge and overflow pool designs.',
   '<p>An architectural deep-dive into the structural and aesthetic differences between vanishing edge and overflow pool designs.</p>',
   '/images/pool-types/vanishing-edge.webp', 'Design Dept', false, 'published', '2025-02-22 10:00+05:30',
   array['infinity pool', 'overflow pool', 'pool design']),

  ('The Health Benefits of Domestic Saunas',
   'health-benefits-domestic-saunas',
   (select id from public.blog_categories where slug = 'wellness'),
   'How integrating a dry heat sauna into your wellness routine can improve cardiovascular health and skin vitality.',
   '<p>How integrating a dry heat sauna into your wellness routine can improve cardiovascular health and skin vitality.</p>',
   '/images/products/specialty-installations/sunbath/1.png', 'Wellness Expert', false, 'published', '2025-03-05 10:00+05:30',
   array['sauna', 'wellness']),

  ('Automated Pool Cleaning Technology',
   'automated-pool-cleaning-technology',
   (select id from public.blog_categories where slug = 'technology'),
   'Exploring the latest in robotic vacuums and automated dosing systems that minimise manual maintenance.',
   '<p>Exploring the latest in robotic vacuums and automated dosing systems that minimise manual maintenance.</p>',
   '/images/products/equipment-catalogue/hero.webp', 'Technical Team', false, 'published', '2025-04-12 10:00+05:30',
   array['pool maintenance', 'automation', 'pool equipment']),

  ('Selecting the Perfect Pool Tiles',
   'selecting-perfect-pool-tiles',
   (select id from public.blog_categories where slug = 'architecture'),
   'A guide to glass mosaics, ceramic, and natural stone finishes for your pool interior.',
   '<p>A guide to glass mosaics, ceramic, and natural stone finishes for your pool interior.</p>',
   '/images/services/pool-tiles/hero.webp', 'Design Dept', false, 'published', '2025-05-18 10:00+05:30',
   array['pool tiles', 'glass mosaic', 'pool design'])
on conflict (slug) do nothing;
