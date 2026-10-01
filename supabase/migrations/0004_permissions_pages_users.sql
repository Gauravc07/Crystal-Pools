-- ============================================================================
-- 1. Per-user permissions (section-wise and page-wise access)
--    Super Admins can do everything. Editors can only touch what is listed in
--    profiles.permissions:  'blogs' | 'projects' | 'testimonials' | 'page:<page id>'
-- ============================================================================

alter table public.profiles
  add column permissions text[] not null default '{}';

update public.profiles set permissions = '{blogs,projects,testimonials}' where role = 'editor';

create or replace function public.has_permission(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and (role = 'super_admin' or p = any(permissions))
  );
$$;

-- Blogs: editors need the 'blogs' permission (and still only work on drafts)
drop policy "blogs: admins read all" on public.blogs;
drop policy "blogs: insert" on public.blogs;
drop policy "blogs: update" on public.blogs;
drop policy "blogs: delete" on public.blogs;

create policy "blogs: admins read all"
  on public.blogs for select to authenticated using (public.has_permission('blogs'));

create policy "blogs: insert"
  on public.blogs for insert to authenticated
  with check (public.is_super_admin() or (public.has_permission('blogs') and status = 'draft'));

create policy "blogs: update"
  on public.blogs for update to authenticated
  using (public.is_super_admin() or (public.has_permission('blogs') and status = 'draft'))
  with check (public.is_super_admin() or (public.has_permission('blogs') and status = 'draft'));

create policy "blogs: delete"
  on public.blogs for delete to authenticated
  using (public.is_super_admin() or (public.has_permission('blogs') and status = 'draft'));

-- Projects & testimonials
drop policy "projects: admins manage" on public.projects;
create policy "projects: permitted admins manage"
  on public.projects for all to authenticated
  using (public.has_permission('projects')) with check (public.has_permission('projects'));

drop policy "testimonials: admins manage" on public.testimonials;
create policy "testimonials: permitted admins manage"
  on public.testimonials for all to authenticated
  using (public.has_permission('testimonials')) with check (public.has_permission('testimonials'));

-- Storage for those sections follows the same permissions
drop policy "storage: admins upload content images" on storage.objects;
drop policy "storage: admins update content images" on storage.objects;
drop policy "storage: admins delete content images" on storage.objects;

create or replace function public.can_write_bucket(bucket text, object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select case bucket
    when 'blog'         then public.has_permission('blogs')
    when 'projects'     then public.has_permission('projects')
    when 'testimonials' then public.has_permission('testimonials')
    -- page images are stored under <page id>/...
    when 'pages'        then public.has_permission('page:' || split_part(object_name, '/', 1))
    else false
  end;
$$;

create policy "storage: permitted admins upload"
  on storage.objects for insert to authenticated
  with check (public.can_write_bucket(bucket_id, name));

create policy "storage: permitted admins update"
  on storage.objects for update to authenticated
  using (public.can_write_bucket(bucket_id, name));

create policy "storage: permitted admins delete"
  on storage.objects for delete to authenticated
  using (public.can_write_bucket(bucket_id, name));

-- ============================================================================
-- 2. Editable page content (text and images on each website page)
--    Only overrides are stored; the website falls back to its built-in defaults.
-- ============================================================================

create table public.page_content (
  page        text not null check (page ~ '^[a-z0-9-]+$'),
  key         text not null check (char_length(key) between 1 and 100),
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null,
  primary key (page, key)
);

create trigger page_content_updated_at before update on public.page_content
  for each row execute function public.set_updated_at();

alter table public.page_content enable row level security;

create policy "page content: public read"
  on public.page_content for select to anon, authenticated using (true);

create policy "page content: permitted admins write"
  on public.page_content for all to authenticated
  using (public.has_permission('page:' || page))
  with check (public.has_permission('page:' || page));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('pages', 'pages', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

-- ============================================================================
-- 3. Analytics, Search Console and Google Business Profile settings
-- ============================================================================

alter table public.site_settings
  add column ga_measurement_id text not null default '' check (ga_measurement_id = '' or ga_measurement_id ~ '^G-[A-Z0-9]{4,20}$'),
  add column gsc_verification  text not null default '' check (gsc_verification ~ '^[A-Za-z0-9_-]{0,100}$'),
  add column gbp_url           text not null default '';

-- ============================================================================
-- 4. User management for Super Admins (create / reset password / disable / delete)
--    Runs inside the database, so no secret key is ever needed in the browser.
-- ============================================================================

create or replace function public.admin_generate_password()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  bytes bytea := extensions.gen_random_bytes(16);
  result text := '';
begin
  for i in 0..15 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end $$;

create or replace function public.admin_create_user(
  p_email text, p_full_name text, p_role text, p_permissions text[] default '{}'
)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id     uuid := gen_random_uuid();
  v_email  text := lower(trim(p_email));
  v_name   text := trim(coalesce(p_full_name, ''));
  v_pw     text;
begin
  if not public.is_super_admin() then
    raise exception 'Only Super Admins can create users.' using errcode = '42501';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Enter a valid email address.'; end if;
  if v_name = '' then raise exception 'Name is required.'; end if;
  if p_role not in ('super_admin', 'editor') then raise exception 'Invalid role.'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'A user with this email already exists.';
  end if;

  v_pw := public.admin_generate_password();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_pw, extensions.gen_salt('bf', 10)), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb, jsonb_build_object('full_name', v_name), now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, email, full_name, role, permissions, must_change_password)
  values (v_id, v_email, v_name, p_role, case when p_role = 'editor' then coalesce(p_permissions, '{}') else '{}' end, true);

  return json_build_object('user_id', v_id, 'temp_password', v_pw);
end $$;

create or replace function public.admin_reset_password(p_user_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pw text;
begin
  if not public.is_super_admin() then raise exception 'Only Super Admins can reset passwords.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'Use "Change password" for your own account.'; end if;

  v_pw := public.admin_generate_password();
  update auth.users
    set encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf', 10)), updated_at = now()
    where id = p_user_id;
  if not found then raise exception 'User not found.'; end if;

  update public.profiles set must_change_password = true where id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;   -- sign them out everywhere
  return v_pw;
end $$;

create or replace function public.admin_set_active(p_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'Only Super Admins can change access.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot disable your own account.'; end if;

  -- The profile guard refuses to deactivate the last active Super Admin.
  update public.profiles set is_active = p_active where id = p_user_id;
  if not found then raise exception 'User not found.'; end if;

  update auth.users
    set banned_until = case when p_active then null else now() + interval '100 years' end, updated_at = now()
    where id = p_user_id;
  if not p_active then
    delete from auth.sessions where user_id = p_user_id;
  end if;
end $$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'Only Super Admins can delete users.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot delete your own account.'; end if;
  delete from auth.users where id = p_user_id;   -- cascades to the profile (guarded) and sessions
  if not found then raise exception 'User not found.'; end if;
end $$;

revoke execute on function public.admin_generate_password() from public, anon, authenticated;
revoke execute on function public.admin_create_user(text, text, text, text[]) from public, anon;
revoke execute on function public.admin_reset_password(uuid) from public, anon;
revoke execute on function public.admin_set_active(uuid, boolean) from public, anon;
revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_create_user(text, text, text, text[]) to authenticated;
grant execute on function public.admin_reset_password(uuid) to authenticated;
grant execute on function public.admin_set_active(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
