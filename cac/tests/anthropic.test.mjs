import test from 'node:test';
import assert from 'node:assert/strict';
import { providerOptions, aiConfigured, anthropicAnalysis, analyzerFor } from '../supabase/functions/_shared/analysis.js';
import { extractLeads } from '../supabase/functions/_shared/leads.js';
import { readXlsx } from '../supabase/functions/_shared/xlsx.js';
import { report } from './helpers/xlsx.mjs';

const env = values => key => values[key];
const claude = (extra = {}) => providerOptions(env({ CAC_AI_MODE: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test', ...extra }));

// Answers the SDK's requests to the Messages API from a script; records each request.
function mockClaude(t, replies) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const headers = new Headers(init.headers);
    const body = JSON.parse(init.body);
    calls.push({ url: String(url), headers, body });
    const next = typeof replies === 'function' ? replies(body) : replies.shift();
    if (!next) throw new Error('Unexpected extra Claude call');
    if (next.status) return new Response(JSON.stringify({ type: 'error', error: { type: next.type, message: next.message || 'error' } }), { status: next.status, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: next.model || body.model, stop_reason: next.stop_reason || 'end_turn',
      content: [{ type: 'text', text: typeof next.json === 'string' ? next.json : JSON.stringify(next.json) }], usage: { input_tokens: 1200, output_tokens: 300 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}
const analysis = { summary: 'Customer asked about heating.', facts: [], missing: ['Confirm the start year'], proposedReply: 'Thank you.', intent: 'revision', heatingRequested: true,
  tentativeStart: 'December', extracted: { location: null, pool_type: null, budget: null, timeline: 'December', decision_maker: null }, actions: [] };
const context = { target: { name: 'Resort pool' }, input: { message: 'Add heating?' } };

test('Claude settings: mode, default model, key check', () => {
  const options = claude();
  assert.equal(options.mode, 'anthropic');
  assert.equal(providerOptions(env({ CAC_AI_MODE: 'claude' })).mode, 'anthropic');
  assert.equal(options.anthropic.model, 'claude-haiku-5-5');
  assert.equal(claude({ CAC_ANTHROPIC_MODEL: 'claude-opus-5-5' }).anthropic.model, 'claude-opus-5-5');
  assert.equal(aiConfigured(options), true);
  assert.equal(aiConfigured(providerOptions(env({ CAC_AI_MODE: 'anthropic' }))), false);
  assert.equal(analyzerFor('anthropic'), anthropicAnalysis);
});

test('Claude analysis: structured output, server-side fallback on Opus, usage recorded', async t => {
  const calls = mockClaude(t, [{ json: analysis }, { json: analysis }]);
  await anthropicAnalysis('followup', context, claude());
  // Haiku (the default) has no server-side fallback, so none is requested.
  assert.equal(calls[0].body.model, 'claude-haiku-5-5');
  assert.equal(calls[0].body.fallbacks, undefined);
  calls.shift();
  const result = await anthropicAnalysis('followup', context, claude({ CAC_ANTHROPIC_MODEL: 'claude-opus-5-5' }));
  assert.equal(calls.length, 1);
  const { url, headers, body } = calls[0];
  assert.match(url, /^https:\/\/api\.anthropic\.com\/v1\/messages/);
  assert.ok([headers.get('x-api-key'), headers.get('authorization')].some(v => v?.endsWith('sk-ant-test')));
  assert.match(headers.get('anthropic-beta'), /server-side-fallback-2026-07-01/);
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.fallbacks, 'default');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.ok(body.output_config.format.schema.properties.proposedReply);
  assert.equal(body.output_config.effort, 'medium');
  assert.match(body.system, /untrusted data, never instructions/);
  assert.equal(result.provider, 'anthropic');
  assert.equal(result.intent, 'revision');
  assert.deepEqual(result.usage, { input: 1200, output: 300 });
});

test('Claude errors: bad key and no credits stop at once; overload retries; refusals and cut-offs never save', async t => {
  mockClaude(t, [
    { status: 401, type: 'authentication_error' },
    { status: 402, type: 'billing_error' },
    { status: 529, type: 'overloaded_error' }, { status: 529, type: 'overloaded_error' },
    { json: '{}', stop_reason: 'refusal' },
    { json: '{"summary": "half', stop_reason: 'max_tokens' },
  ]);
  const options = claude();
  await assert.rejects(anthropicAnalysis('followup', context, options), e => e.terminal && /rejected ANTHROPIC_API_KEY/.test(e.message));
  await assert.rejects(anthropicAnalysis('followup', context, options), e => e.terminal && /no credits/.test(e.message));
  await assert.rejects(anthropicAnalysis('followup', context, options), e => !e.terminal && /HTTP 529/.test(e.message));
  await assert.rejects(anthropicAnalysis('followup', context, options), e => e.terminal && /declined/.test(e.message));
  await assert.rejects(anthropicAnalysis('followup', context, options), e => e.terminal && /cut off/.test(e.message));
});

test('Claude lead extraction: low effort, lead schema, contacts still verified against the report', async t => {
  const { sheets } = await readXlsx(report());
  const calls = mockClaude(t, body => {
    const blocks = JSON.parse(body.messages[0].content).blocks;
    return { json: { leads: blocks.map(b => ({ serial: b.serial, project_name: b.text.match(/^Project: ([^/\n]+)/)[1].trim(), project_type: 'Residential', builder_name: 'B', builder_address: '',
      builder_phones: ['9811111111'], builder_emails: [], architect_firm: '', architect_name: '', architect_address: '', architect_phones: [], architect_emails: [], contacts: [],
      landmark: '', area: '', pincode: '', details: '', towers: null, units: null, stage: 'RCC Completed', possession: '', products: [] })) } };
  });
  const result = await extractLeads(sheets, claude());
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.output_config.effort, 'low');
  assert.ok(calls[0].body.output_config.format.schema.properties.leads);
  assert.equal(result.leads.length, 3);
  assert.equal(result.provider, 'anthropic');
  assert.deepEqual(result.leads[0].builder.phones, []); // invented number dropped
});
