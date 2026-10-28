// cac-worker: processes queued CAC workflow runs.
// Woken by the staff app after it queues a run or presses Run agent now, and
// every Sunday at 9:00 AM IST by pg_cron (see supabase/cron.example.sql). Each
// pass also checks Gmail for new lead reports. Deploy with --no-verify-jwt; access is
// checked here: an active CAC staff session, or the CAC_WORKER_SECRET header.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runAll, effectiveOptions } from '../_shared/worker.js';
import { providerOptions, aiConfigured } from '../_shared/analysis.js';
import { gmailOptions, pollMail } from '../_shared/mail.js';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('CAC_APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const workerSecret = Deno.env.get('CAC_WORKER_SECRET');

  const fromScheduler = Boolean(workerSecret) && req.headers.get('x-cac-worker-secret') === workerSecret;
  if (!fromScheduler) {
    const authorization = req.headers.get('Authorization') ?? '';
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, db: { schema: 'cac' }, auth: { persistSession: false } });
    const { data, error } = await caller.rpc('is_staff');
    if (error || data !== true) return json({ error: 'Only active CAC staff can run the worker.' }, 403);
  }

  const client = createClient(url, serviceKey, { db: { schema: 'cac' }, auth: { persistSession: false } });
  const options = await effectiveOptions(client, providerOptions((key: string) => Deno.env.get(key)));
  await client.rpc('worker_heartbeat', { p_mode: options.mode, p_ai_configured: aiConfigured(options) });
  try {
    const mail = await pollMail(client, gmailOptions((key: string) => Deno.env.get(key)));
    if (mail?.error) console.error('Gmail:', mail.error);
    const results = await runAll(client, options, { deadline: Date.now() + 45000 });
    return json({ processed: results.length, mail });
  } catch (error) {
    console.error(error);
    return json({ error: 'Worker could not reach the queue. Check the function logs.' }, 500);
  }
});
