import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { parseValidationContent } from './index.js';

test('parseValidationContent should parse valid JSON payload', () => {
  const parsed = parseValidationContent('{"valid":true,"score":88,"reason":"Solid semantic link"}');
  assert.equal(parsed.valid, true);
  assert.equal(parsed.score, 88);
  assert.equal(parsed.reason, 'Solid semantic link');
});

test('parseValidationContent should clamp score and trim reason', () => {
  const parsed = parseValidationContent('{"valid":false,"score":1000,"reason":"abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz"}');
  assert.equal(parsed.valid, false);
  assert.equal(parsed.score, 100);
  assert.ok(parsed.reason.length <= 100);
});

test('parseValidationContent should parse fenced JSON blocks', () => {
  const parsed = parseValidationContent('```json\n{"valid":true,"score":75,"reason":"ok"}\n```');
  assert.equal(parsed.valid, true);
  assert.equal(parsed.score, 75);
  assert.equal(parsed.reason, 'ok');
});

test('parseValidationContent should coerce invalid fields to safe defaults', () => {
  const parsed = parseValidationContent('{"valid":"yes","score":"NaN","reason":null}');
  assert.equal(parsed.valid, false);
  assert.equal(parsed.score, 50);
  assert.equal(parsed.reason, 'Connection accepted');
});

test('validateWordChain should fall back from groq retry failures to gemini', async () => {
  const originalEnv = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GROQ_FALLBACK_MODEL: process.env.GROQ_FALLBACK_MODEL,
  };
  const originalPost = axios.post;

  process.env.GROQ_API_KEY = 'test-groq-key';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GROQ_MODEL = 'llama-3.1-8b-instant';
  process.env.GEMINI_MODEL = 'gemini-2.0-flash';
  process.env.GROQ_FALLBACK_MODEL = 'llama-3.3-70b-versatile';

  const calls = [];
  axios.post = async (url) => {
    calls.push(url);
    if (calls.length <= 2) {
      const timeoutError = new Error('timeout while calling groq');
      timeoutError.code = 'ECONNABORTED';
      throw timeoutError;
    }

    return {
      data: {
        candidates: [
          {
            content: {
              parts: [{ text: '{"valid":true,"score":81,"reason":"Gemini fallback worked"}' }],
            },
          },
        ],
      },
    };
  };

  try {
    const moduleUrl = new URL(`./index.js?fallback=${Date.now()}-${Math.random()}`, import.meta.url);
    const { validateWordChain } = await import(moduleUrl.href);

    const result = await validateWordChain({
      gameId: '11111111-1111-4111-8111-111111111111',
      playerId: '22222222-2222-4222-8222-222222222222',
      previousWord: 'cat',
      currentWord: 'dog',
      explanation: 'Both are common household pets',
    });

    assert.equal(result.providerUsed, 'gemini');
    assert.equal(result.valid, true);
    assert.equal(result.score, 81);
    assert.equal(calls.length, 3);
  } finally {
    axios.post = originalPost;
    process.env.GROQ_API_KEY = originalEnv.GROQ_API_KEY;
    process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
    process.env.GROQ_MODEL = originalEnv.GROQ_MODEL;
    process.env.GEMINI_MODEL = originalEnv.GEMINI_MODEL;
    process.env.GROQ_FALLBACK_MODEL = originalEnv.GROQ_FALLBACK_MODEL;
  }
});

test('validateWordChain should block simultaneous validations for the same player in a game', async () => {
  const originalEnv = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
  };
  const originalPost = axios.post;

  process.env.GROQ_API_KEY = 'test-groq-key';
  delete process.env.GEMINI_API_KEY;
  process.env.GROQ_MODEL = 'llama-3.1-8b-instant';

  axios.post = async () => new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        data: {
          choices: [
            {
              message: {
                content: '{"valid":true,"score":72,"reason":"accepted"}',
              },
            },
          ],
        },
      });
    }, 60);
  });

  try {
    const moduleUrl = new URL(`./index.js?limiter=${Date.now()}-${Math.random()}`, import.meta.url);
    const { validateWordChain } = await import(moduleUrl.href);

    const firstCall = validateWordChain({
      gameId: '33333333-3333-4333-8333-333333333333',
      playerId: '44444444-4444-4444-8444-444444444444',
      previousWord: 'sun',
      currentWord: 'moon',
      explanation: 'Both are visible in the sky',
    });

    await assert.rejects(
      validateWordChain({
        gameId: '33333333-3333-4333-8333-333333333333',
        playerId: '44444444-4444-4444-8444-444444444444',
        previousWord: 'sun',
        currentWord: 'star',
        explanation: 'All are celestial bodies',
      }),
      (error) => error?.code === 'AI_RATE_LIMIT',
    );

    const firstResult = await firstCall;
    assert.equal(firstResult.providerUsed, 'groq');

    const thirdResult = await validateWordChain({
      gameId: '33333333-3333-4333-8333-333333333333',
      playerId: '44444444-4444-4444-8444-444444444444',
      previousWord: 'moon',
      currentWord: 'night',
      explanation: 'The moon is commonly seen at night',
    });
    assert.equal(thirdResult.providerUsed, 'groq');
  } finally {
    axios.post = originalPost;
    process.env.GROQ_API_KEY = originalEnv.GROQ_API_KEY;
    process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
    process.env.GROQ_MODEL = originalEnv.GROQ_MODEL;
  }
});

test('validateWordChain should honor AI_PROVIDER_ORDER when enabled providers are available', async () => {
  const originalEnv = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    AI_PROVIDER_ORDER: process.env.AI_PROVIDER_ORDER,
  };
  const originalPost = axios.post;

  process.env.GROQ_API_KEY = 'test-groq-key';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GROQ_MODEL = 'llama-3.1-8b-instant';
  process.env.GEMINI_MODEL = 'gemini-2.0-flash';
  process.env.AI_PROVIDER_ORDER = 'gemini,groq,llama';

  const calls = [];
  axios.post = async (url) => {
    calls.push(url);
    if (!String(url).includes('generativelanguage.googleapis.com')) {
      throw new Error('Expected Gemini to be called first');
    }

    return {
      data: {
        candidates: [
          {
            content: {
              parts: [{ text: '{"valid":true,"score":77,"reason":"Gemini used first"}' }],
            },
          },
        ],
      },
    };
  };

  try {
    const moduleUrl = new URL(`./index.js?provider-order=${Date.now()}-${Math.random()}`, import.meta.url);
    const { validateWordChain } = await import(moduleUrl.href);

    const result = await validateWordChain({
      gameId: '55555555-5555-4555-8555-555555555555',
      playerId: '66666666-6666-4666-8666-666666666666',
      previousWord: 'rain',
      currentWord: 'cloud',
      explanation: 'Clouds are associated with rainfall',
    });

    assert.equal(result.providerUsed, 'gemini');
    assert.equal(calls.length, 1);
  } finally {
    axios.post = originalPost;
    process.env.GROQ_API_KEY = originalEnv.GROQ_API_KEY;
    process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
    process.env.GROQ_MODEL = originalEnv.GROQ_MODEL;
    process.env.GEMINI_MODEL = originalEnv.GEMINI_MODEL;
    process.env.AI_PROVIDER_ORDER = originalEnv.AI_PROVIDER_ORDER;
  }
});

test('validateWordChain should return fallback scoring after all providers fail', async () => {
  const originalEnv = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GROQ_FALLBACK_MODEL: process.env.GROQ_FALLBACK_MODEL,
    AI_PROVIDER_ORDER: process.env.AI_PROVIDER_ORDER,
    AI_FAIL_OPEN: process.env.AI_FAIL_OPEN,
  };
  const originalPost = axios.post;

  process.env.GROQ_API_KEY = 'test-groq-key';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GROQ_MODEL = 'llama-3.1-8b-instant';
  process.env.GEMINI_MODEL = 'gemini-2.0-flash';
  process.env.GROQ_FALLBACK_MODEL = 'llama-3.3-70b-versatile';
  process.env.AI_PROVIDER_ORDER = 'groq,gemini,llama';
  delete process.env.AI_FAIL_OPEN;

  const calls = [];
  axios.post = async (url) => {
    calls.push(url);
    const timeoutError = new Error('timeout while calling provider');
    timeoutError.code = 'ECONNABORTED';
    throw timeoutError;
  };

  try {
    const moduleUrl = new URL(`./index.js?all-fail=${Date.now()}-${Math.random()}`, import.meta.url);
    const { validateWordChain } = await import(moduleUrl.href);

    const result = await validateWordChain({
      gameId: '77777777-7777-4777-8777-777777777777',
      playerId: '88888888-8888-4888-8888-888888888888',
      previousWord: 'tree',
      currentWord: 'forest',
      explanation: 'A forest is made up of many trees',
    });

    assert.equal(result.providerUsed, 'fallback');
    assert.equal(result.valid, false);
    assert.equal(result.score, 0);
    assert.equal(result.reason, 'Validation unavailable. Try again.');
    assert.equal(calls.length, 6);
  } finally {
    axios.post = originalPost;
    process.env.GROQ_API_KEY = originalEnv.GROQ_API_KEY;
    process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
    process.env.GROQ_MODEL = originalEnv.GROQ_MODEL;
    process.env.GEMINI_MODEL = originalEnv.GEMINI_MODEL;
    process.env.GROQ_FALLBACK_MODEL = originalEnv.GROQ_FALLBACK_MODEL;
    process.env.AI_PROVIDER_ORDER = originalEnv.AI_PROVIDER_ORDER;
    process.env.AI_FAIL_OPEN = originalEnv.AI_FAIL_OPEN;
  }
});
