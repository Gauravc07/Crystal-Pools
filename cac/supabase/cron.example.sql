-- Wakes the cac-worker every Sunday at 9:00 AM IST (03:30 UTC; Supabase cron runs
-- in UTC) to read new lead reports from Gmail. Staff runs and Run agent now wake
-- it directly, so they do not wait for this. Use '* * * * *' for every minute. Not a migration, because it contains a secret.
-- Requires the pg_cron and pg_net extensions (Database → Extensions).
-- Replace <project-ref> and <CAC_WORKER_SECRET> (the same value set with
-- `supabase secrets set CAC_WORKER_SECRET=...`), then run it in the SQL editor.

select cron.schedule(
  'cac-worker',
  '30 3 * * 0',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/cac-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cac-worker-secret', '<CAC_WORKER_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);

-- To stop it: select cron.unschedule('cac-worker');
