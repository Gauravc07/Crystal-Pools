// Shared queue worker. `client` is a supabase-js client created with the
// service role and `db: { schema: 'cac' }`. Each run is:
//   claim_job → analysis (checkpointed by save_analysis) → complete_job
// complete_job applies every business side effect in one transaction, so a
// failed run leaves no partial drafts, tasks or revisions behind.
import { analyzerFor } from './analysis.js';
import { extractLeads } from './leads.js';

const BUCKET = 'cac-survey-photos';

function base64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function loadImages(client, images) {
  const loaded = [];
  for (const image of images) {
    const { data, error } = await client.storage.from(BUCKET).download(image.path);
    if (!error && data) loaded.push({ ...image, data: base64(new Uint8Array(await data.arrayBuffer())) });
  }
  return loaded;
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw Object.assign(new Error(error.message), { business: true });
  return data;
}

// options: { mode, openai, huggingface } from providerOptions(), plus optional analyze / extractLeads overrides for tests.
export async function runOnce(client, options = {}) {
  const { mode = 'demo', analyze } = options;
  const claimed = await rpc(client, 'claim_job');
  if (!claimed) return null;
  const { job, context } = claimed;
  if (!job.analysis) {
    try {
      let analysis;
      if (job.agent === 'proposal') analysis = { mode: 'approved catalogue', summary: 'Deterministic quotation calculation', missing: [] };
      else if (job.agent === 'leadimport') analysis = await (options.extractLeads || extractLeads)(context.target.sheets, options);
      else {
        if (mode !== 'demo' && context.images?.length) context.images = await loadImages(client, context.images);
        analysis = await (analyze || analyzerFor(mode))(job.agent, context, options);
      }
      await rpc(client, 'save_analysis', { p_job: job.id, p_analysis: analysis });
    } catch (error) {
      // Provider failures retry with backoff up to the attempt limit; configuration errors (bad key, no credits) stop at once.
      await client.rpc('fail_job', { p_job: job.id, p_message: error.message, p_terminal: Boolean(error.terminal) });
      return { id: job.id, status: 'retry_or_failed', error: error.message };
    }
  }
  // Lead reports update the project lead list directly; every other run waits for a person's review.
  const { data, error } = await client.rpc(job.agent === 'leadimport' ? 'complete_lead_import' : 'complete_job', { p_job: job.id });
  if (error) {
    // Business-rule failures will not fix themselves: stop and show the reason.
    await client.rpc('fail_job', { p_job: job.id, p_message: error.message, p_terminal: true });
    return { id: job.id, status: 'failed', error: error.message };
  }
  return data;
}

export async function runAll(client, options = {}, { deadline = Date.now() + 50000, maxJobs = 25 } = {}) {
  const results = [];
  while (results.length < maxJobs && Date.now() < deadline) {
    const result = await runOnce(client, options);
    if (!result) break;
    results.push(result);
  }
  return results;
}
