-- Postgres grants EXECUTE on new functions to PUBLIC (which includes anonymous visitors).
-- None of these functions are useful to visitors, so only signed-in users (who need them
-- for the access rules) and the service role may call them. Triggers keep working:
-- trigger functions are not subject to EXECUTE checks for the person changing the row.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'can_edit_any_page', 'can_write_bucket', 'clear_must_change_password', 'dashboard_stats',
        'guard_last_super_admin', 'has_permission', 'is_admin', 'is_super_admin',
        'limit_lead_submissions', 'set_updated_at', 'track_blog_slug_change',
        'admin_create_user', 'admin_reset_password', 'admin_set_active', 'admin_delete_user'
      )
  loop
    execute format('revoke execute on function %s from public, anon', fn.sig);
    execute format('grant execute on function %s to authenticated, service_role', fn.sig);
  end loop;
end $$;

-- Only callable from inside other functions
revoke execute on function public.admin_generate_password() from public, anon, authenticated;
