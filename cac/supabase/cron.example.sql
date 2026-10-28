-- Optional: wake the cac-worker every minute so queued runs finish even when
-- nobody has the staff app open. Not a migration, because it contains a secret.
-- Requires the pg_cron and pg_net extensions (Database → Extensions).
-- Replace <project-ref> and <CAC_WORKER_SECRET> (the same value set with
-- `supabase secrets set CAC_WORKER_SECRET=...`), then run it in the SQL editor.

select cron.schedule(
  'cac-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/cac-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cac-worker-secret', '<CAC_WORKER_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);

-- To stop it: select cron.unschedule('cac-worker');
