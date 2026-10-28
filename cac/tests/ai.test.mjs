import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, serviceClient } from './helpers/db.mjs';
import { runOnce } from '../supabase/functions/_shared/worker.js';
import { providerOptions, aiConfigured, huggingfaceAnalysis, parseJsonObject, normalizeAnalysis } from '../supabase/functions/_shared/analysis.js';

const good = {
  summary: 'Customer asked to add heating.', facts: [], missing: ['Confirm the start year'], proposedReply: 'Thank you, our estimator will review heating.',
  intent: 'revision', heatingRequested: true, tentativeStart: 'December', extracted: { location: null, pool_type: null, budget: null, timeline: 'December', decision_maker: null }, actions: [],
};
const env = values => key => values[key];
const hf = (extra = {}) => providerOptions(env({ CAC_AI_MODE: 'huggingface', HF_TOKEN: 'hf_test', ...extra }));
const context = { target: { name: 'Resort pool', source_url: 'https://resort.example/news', website: 'https://resort.example' }, input: { message: 'Add heating?' } };

// Replaces global fetch with a scripted sequence of responses and records the requests.
function mockFetch(t, responses) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    const next = responses.shift();
    if (!next) throw new Error('Unexpected extra provider call');
    return new Response(typeof next.body === 'string' ? next.body : JSON.stringify(next.body), { status: next.status || 200 });
  };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}
const chat = (content, model = 'openai/gpt-oss-120b') => ({ body: { model, choices: [{ message: { content } }], usage: { prompt_tokens: 900, completion_tokens: 120 } } });

test('provider settings: modes, defaults and configuration checks', () => {
  assert.equal(providerOptions(env({})).mode, 'demo');
  assert.equal(providerOptions(env({ CAC_AI_MODE: 'live' })).mode, 'openai');
  assert.equal(providerOptions(env({ CAC_AI_MODE: 'nonsense' })).mode, 'demo');
  const options = hf();
  assert.equal(options.huggingface.model, 'openai/gpt-oss-120b:cheapest');
  assert.deepEqual(options.huggingface.fallbacks, ['Qwen/Qwen3-32B', 'meta-llama/Llama-3.3-70B-Instruct']);
  assert.deepEqual(hf({ CAC_HF_FALLBACK_MODELS: '' }).huggingface.fallbacks, []);
  assert.equal(aiConfigured(options), true);
  assert.equal(aiConfigured(providerOptions(env({ CAC_AI_MODE: 'huggingface' }))), false);
});

test('Hugging Face: structured request to the router, normalised output, usage recorded', async t => {
  const calls = mockFetch(t, [chat(JSON.stringify(good))]);
  const result = await huggingfaceAnalysis('followup', context, hf({ CAC_HF_BILL_TO: 'crystal-pools' }));
  assert.equal(calls[0].url, 'https://router.huggingface.co/v1/chat/completions');
  assert.equal(calls[0].headers.Authorization, 'Bearer hf_test');
  assert.equal(calls[0].headers['X-HF-Bill-To'], 'crystal-pools');
  assert.equal(calls[0].body.model, 'openai/gpt-oss-120b:cheapest');
  assert.equal(calls[0].body.response_format.type, 'json_schema');
  assert.match(calls[0].body.messages[0].content, /untrusted data/);
  assert.equal(result.provider, 'huggingface'); assert.equal(result.intent, 'revision'); assert.equal(result.heatingRequested, true);
  assert.deepEqual(result.usage, { input: 900, output: 120 });
});

test('Hugging Face: falls back to the next model and to JSON mode when a provider rejects json_schema', async t => {
  const calls = mockFetch(t, [
    { status: 503, body: { error: 'overloaded' } },
    { status: 400, body: { error: 'response_format json_schema not supported' } },
    chat('```json\n' + JSON.stringify(good) + '\n```', 'Qwen/Qwen3-32B'),
  ]);
  const result = await huggingfaceAnalysis('followup', context, hf());
  assert.deepEqual(calls.map(c => [c.body.model, c.body.response_format.type]), [
    ['openai/gpt-oss-120b:cheapest', 'json_schema'], ['Qwen/Qwen3-32B', 'json_schema'], ['Qwen/Qwen3-32B', 'json_object'],
  ]);
  assert.equal(result.model, 'Qwen/Qwen3-32B');
});

test('Hugging Face: bad token and missing credits stop immediately without trying other models', async t => {
  mockFetch(t, [{ status: 402, body: { error: 'payment required' } }]);
  await assert.rejects(huggingfaceAnalysis('followup', context, hf()), error => error.terminal && /no inference credits/.test(error.message));
  mockFetch(t, [{ status: 401, body: { error: 'unauthorized' } }]);
  await assert.rejects(huggingfaceAnalysis('followup', context, hf()), error => error.terminal && /rejected the token/.test(error.message));
  await assert.rejects(huggingfaceAnalysis('followup', context, providerOptions(env({ CAC_AI_MODE: 'huggingface' }))), /HF_TOKEN is required/);
});

test('model output is sanitised: invented sources, bad budgets, oversized or extra actions are removed', async t => {
  const research = { ...good, facts: [{ claim: 'Expanding in 2027', sourceUrl: 'https://resort.example/news' }, { claim: 'Invented', sourceUrl: 'https://made-up.example' }, { claim: 'Not https', sourceUrl: 'http://resort.example' }] };
  mockFetch(t, [chat(JSON.stringify(research))]);
  const result = await huggingfaceAnalysis('research', context, hf());
  assert.deepEqual(result.facts.map(f => f.sourceUrl), ['https://resort.example/news']);
  const sanitized = normalizeAnalysis('operator', { ...good, intent: 'buy-now', extracted: { budget: -5, location: 'x'.repeat(500) },
    actions: Array.from({ length: 9 }, (_, i) => ({ name: `Action ${i}`, owner: '', dueInDays: 999, reason: 'r' })) }, context, { citedUrls: [] });
  assert.equal(sanitized.intent, 'unknown'); assert.equal(sanitized.extracted.budget, null); assert.equal(sanitized.extracted.location.length, 200);
  assert.equal(sanitized.actions.length, 5); assert.equal(sanitized.actions[0].dueInDays, 60); assert.equal(sanitized.actions[0].owner, 'Owner');
  assert.deepEqual(normalizeAnalysis('followup', { ...good, actions: [{ name: 'x' }] }, context, { citedUrls: [] }).actions, []);
  assert.throws(() => normalizeAnalysis('followup', { summary: '' }, context, { citedUrls: [] }), /incomplete/);
  assert.throws(() => parseJsonObject('I cannot help with that.'), /valid JSON/);
  assert.deepEqual(parseJsonObject('Here you go: {"summary":"ok"} done'), { summary: 'ok' });
});

test('survey photos go to the vision model; without one the review says photos were not analysed', async t => {
  const survey = { target: { name: 'Survey' }, input: {}, images: [{ name: 'a.png', mime: 'image/png', data: 'iVBORw0KGgo=' }] };
  const calls = mockFetch(t, [chat(JSON.stringify(good), 'Qwen/Qwen2.5-VL-72B-Instruct'), chat(JSON.stringify(good))]);
  await huggingfaceAnalysis('survey', survey, hf());
  assert.equal(calls[0].body.model, 'Qwen/Qwen2.5-VL-72B-Instruct');
  assert.equal(calls[0].body.messages[1].content[1].type, 'image_url');
  const result = await huggingfaceAnalysis('survey', survey, hf({ CAC_HF_VISION_MODEL: '' }));
  assert.equal(typeof calls[1].body.messages[1].content, 'string');
  assert.ok(result.missing.some(m => /not analysed/.test(m)));
});

test('worker with Hugging Face: a credits error fails the run at once with a clear reason', async t => {
  const { ids, rpc, db, one } = await setup(t);
  const job = await rpc('sales', 'enqueue_run', { p_agent: 'followup', p_target: ids.opportunity, p_input: { message: 'Hello' } });
  mockFetch(t, [{ status: 402, body: {} }]);
  await runOnce(serviceClient(db), hf());
  const run = await one(`select status, attempts, error from cac.job where id = $1`, [job.id]);
  assert.equal(run.status, 'failed'); assert.equal(run.attempts, 1); assert.match(run.error, /no inference credits/);
});

test('worker with Hugging Face: a good answer becomes a review draft with model and token usage', async t => {
  const { ids, rpc, db, one } = await setup(t);
  const job = await rpc('sales', 'enqueue_run', { p_agent: 'followup', p_target: ids.opportunity, p_input: { message: 'Can you add heating?' } });
  mockFetch(t, [chat(JSON.stringify(good))]);
  await runOnce(serviceClient(db), hf());
  assert.equal((await one(`select status from cac.job where id = $1`, [job.id])).status, 'waiting_approval');
  const usage = (await rpc('sales', 'workspace_state')).usage.by_model_30d.find(u => u.provider === 'huggingface');
  assert.deepEqual([usage.model, usage.runs, usage.input_tokens, usage.output_tokens], ['openai/gpt-oss-120b', 1, 900, 120]);
});

test('cost guards: per-person hourly and workspace daily run limits', async t => {
  const { ids, rpc } = await setup(t);
  await assert.rejects(rpc('sales', 'set_setting', { p_key: 'user_hourly_run_limit', p_value: '2' }), /role/);
  await assert.rejects(rpc('admin', 'set_setting', { p_key: 'user_hourly_run_limit', p_value: '0' }), /1–500/);
  await rpc('admin', 'set_setting', { p_key: 'user_hourly_run_limit', p_value: '2' });
  await rpc('sales', 'enqueue_run', { p_agent: 'sales', p_target: ids.opportunity });
  await rpc('sales', 'enqueue_run', { p_agent: 'qualification', p_target: ids.villaOpportunity });
  // Re-asking for an existing active run returns it instead of counting a new one.
  await rpc('sales', 'enqueue_run', { p_agent: 'sales', p_target: ids.opportunity });
  await assert.rejects(rpc('sales', 'enqueue_run', { p_agent: 'sales', p_target: ids.villaOpportunity }), /hourly limit/);
  await rpc('admin', 'set_setting', { p_key: 'user_hourly_run_limit', p_value: '100' });
  await rpc('admin', 'set_setting', { p_key: 'workspace_daily_run_limit', p_value: '3' });
  await rpc('admin', 'enqueue_run', { p_agent: 'sales', p_target: ids.villaOpportunity });
  await assert.rejects(rpc('sales', 'enqueue_run', { p_agent: 'qualification', p_target: ids.opportunity }), /today's limit/);
  const usage = (await rpc('sales', 'workspace_state')).usage;
  assert.equal(usage.runs_today, 3); assert.equal(usage.my_runs_last_hour, 2);
});
