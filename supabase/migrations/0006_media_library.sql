-- ============================================================================
-- Media library: a shared folder of images (pages/library/...) that any page
-- can use, plus listing of uploaded files for the admin "Media" section.
-- ============================================================================

-- Can the current user edit at least one website page?
create or replace function public.can_edit_any_page()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
      and (role = 'super_admin' or exists (select 1 from unnest(permissions) p where p like 'page:%'))
  );
$$;

-- Library uploads: anyone who edits pages. Everything else unchanged.
create or replace function public.can_write_bucket(bucket text, object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select case bucket
    when 'blog'         then public.has_permission('blogs')
    when 'projects'     then public.has_permission('projects')
    when 'testimonials' then public.has_permission('testimonials')
    when 'pages'        then
      case when split_part(object_name, '/', 1) = 'library'
        then public.can_edit_any_page()
        else public.has_permission('page:' || split_part(object_name, '/', 1))
      end
    else false
  end;
$$;

-- Library deletions are Super Admin only (an image may be in use on several pages).
drop policy "storage: permitted admins delete" on storage.objects;
create policy "storage: permitted admins delete"
  on storage.objects for delete to authenticated
  using (
    public.can_write_bucket(bucket_id, name)
    and (bucket_id <> 'pages' or split_part(name, '/', 1) <> 'library' or public.is_super_admin())
  );

-- Admins may list uploaded files (files are already publicly readable by URL).
create policy "storage: admins list uploads"
  on storage.objects for select to authenticated
  using (bucket_id in ('blog', 'projects', 'testimonials', 'site', 'pages') and public.is_admin());
