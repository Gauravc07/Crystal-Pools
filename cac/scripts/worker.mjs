// Optional: runs the same queue worker as the cac-worker Edge Function, from
// this machine. Useful before the function is deployed. Reads cac/.env.
import { createClient } from '@supabase/supabase-js';
import { runAll, effectiveOptions } from '../supabase/functions/_shared/worker.js';
import { providerOptions, aiConfigured } from '../supabase/functions/_shared/analysis.js';
import { gmailOptions, gmailConfigured, pollMail } from '../supabase/functions/_shared/mail.js';

const url = process.env.CAC_SUPABASE_URL || process.env.VITE_CAC_SUPABASE_URL;
const key = process.env.CAC_SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Set VITE_CAC_SUPABASE_URL and CAC_SUPABASE_SECRET_KEY in cac/.env to run the local worker.');
  process.exit(1);
}
const options = providerOptions(key => process.env[key]);
const mode = options.mode;
const model = mode === 'anthropic' ? options.anthropic.model : mode === 'openai' ? options.openai.model : mode === 'huggingface' ? options.huggingface.model : 'demo rules';
if (!aiConfigured(options)) console.warn(`CAC_AI_MODE=${mode} but its key is missing (${mode === 'anthropic' ? 'ANTHROPIC_API_KEY' : mode === 'openai' ? 'OPENAI_API_KEY' : 'HF_TOKEN'}). Runs will fail until it is set.`);
const client = createClient(url, key, { db: { schema: 'cac' }, auth: { persistSession: false } });
const gmail = gmailOptions(key => process.env[key]);
console.log(`CAC worker · ${mode} (${model}) · Gmail lead reports ${gmailConfigured(gmail) ? 'on' : 'off'} · outbound disabled · polling every 3 s`);

let stopping = false;
let lastError = '';
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
const ref = new URL(url).hostname.split('.')[0];
while (!stopping) {
  try {
    const pass = await effectiveOptions(client, options);
    const { error } = await client.rpc('worker_heartbeat', { p_mode: pass.mode, p_ai_configured: aiConfigured(pass) });
    if (error) throw error;
    if (lastError) { console.log('Worker connected.'); lastError = ''; }
    const mail = await pollMail(client, gmail);
    if (mail) console.log(mail.error ? `Gmail: ${mail.error}` : `Gmail: ${mail.messages} new email(s), ${mail.files} report file(s)`);
    for (const result of await runAll(client, pass)) console.log(`run ${result.id}: ${result.status}${result.error ? ` · ${result.error}` : ''}`);
  } catch (error) {
    // Report each distinct problem once instead of every 3 seconds.
    if (error.message !== lastError) {
      lastError = error.message;
      console.error(/Invalid schema/.test(error.message)
        ? `The cac schema is not exposed to the Supabase Data API yet. Add "cac" under Exposed schemas at https://supabase.com/dashboard/project/${ref}/settings/api and save. The worker keeps retrying.`
        : error.message);
    }
  }
  await new Promise(resolve => setTimeout(resolve, 3000));
}
