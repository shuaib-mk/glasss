import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AllModelsUnavailableError,
  buildModelQueue,
  clearModelCooldowns,
  streamChatWithFallback
} from './modelFallback.js';

function chunkStream(text) {
  return (async function* () {
    yield { choices: [{ delta: { content: text } }] };
  })();
}

test.beforeEach(() => clearModelCooldowns());

test('buildModelQueue keeps the selected model first and removes duplicates', () => {
  assert.deepEqual(buildModelQueue('openai/gpt-oss-120b'), [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.6-27b',
    'groq/compound-mini'
  ]);
});

test('silently falls back after a rate limit', async () => {
  const attempted = [];
  const output = [];
  const groq = {
    chat: { completions: { create: async ({ model }) => {
      attempted.push(model);
      if (attempted.length === 1) throw Object.assign(new Error('rate limited'), { status: 429, headers: { 'retry-after': '30' } });
      return chunkStream('fallback answer');
    } } }
  };

  const result = await streamChatWithFallback({
    groq,
    preferredModel: 'allam-2-7b',
    request: { messages: [] },
    onChunk: value => output.push(value)
  });

  assert.deepEqual(attempted, ['allam-2-7b', 'openai/gpt-oss-20b']);
  assert.equal(result.model, 'openai/gpt-oss-20b');
  assert.equal(output.join(''), 'fallback answer');
});

test('skips a model while its cooldown is active', async () => {
  let currentTime = 1_000;
  const attempted = [];
  const groq = {
    chat: { completions: { create: async ({ model }) => {
      attempted.push(model);
      if (model === 'allam-2-7b') throw Object.assign(new Error('rate limited'), { status: 429, headers: { 'retry-after': '60' } });
      return chunkStream('ok');
    } } }
  };

  await streamChatWithFallback({ groq, preferredModel: 'allam-2-7b', request: {}, onChunk: () => {}, now: () => currentTime });
  attempted.length = 0;
  currentTime += 1_000;
  await streamChatWithFallback({ groq, preferredModel: 'allam-2-7b', request: {}, onChunk: () => {}, now: () => currentTime });
  assert.deepEqual(attempted, ['openai/gpt-oss-20b']);
});

test('does not rotate on an invalid API key', async () => {
  let attempts = 0;
  const groq = {
    chat: { completions: { create: async () => {
      attempts += 1;
      throw Object.assign(new Error('invalid key'), { status: 401 });
    } } }
  };

  await assert.rejects(
    streamChatWithFallback({ groq, preferredModel: 'allam-2-7b', request: {}, onChunk: () => {} }),
    error => error.status === 401
  );
  assert.equal(attempts, 1);
});

test('returns one bounded error after every model is unavailable', async () => {
  const groq = {
    chat: { completions: { create: async () => {
      throw Object.assign(new Error('service unavailable'), { status: 503 });
    } } }
  };

  await assert.rejects(
    streamChatWithFallback({ groq, preferredModel: 'allam-2-7b', request: {}, onChunk: () => {} }),
    error => error instanceof AllModelsUnavailableError && error.retryAfterSeconds === 5
  );
});
