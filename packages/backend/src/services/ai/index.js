/**
 * AI Service Module
 * 
 * Handles multi-provider LLM integration for word-chain validation
 * Primary: Groq (llama-3.1-8b-instant)
 * Fallback 1: Gemini
 * Fallback 2: Groq Llama 3.3 70B
 * Final Fallback: Basic scoring (50 points)
 * 
 * @file packages/backend/src/services/ai/index.js
 */

import axios from 'axios';

const AI_TIMEOUT_MS = Number(
  process.env.AI_VALIDATION_TIMEOUT_MS || process.env.AI_TIMEOUT_MS || 10000,
);
const AI_FAIL_OPEN = String(process.env.AI_FAIL_OPEN || 'false').toLowerCase() === 'true';
const DEFAULT_PROVIDER_ORDER = ['groq', 'gemini', 'llama'];
const inflightValidationLocks = new Set();

const providerRegistry = {
  groq: {
    id: 'groq',
    getModel: () => process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    isEnabled: () => Boolean(process.env.GROQ_API_KEY),
    validate: requestGroqValidation,
  },
  gemini: {
    id: 'gemini',
    getModel: () => process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    isEnabled: () => Boolean(process.env.GEMINI_API_KEY),
    validate: requestGeminiValidation,
  },
  llama: {
    id: 'llama',
    getModel: () => process.env.GROQ_FALLBACK_MODEL || 'llama-3.3-70b-versatile',
    isEnabled: () => Boolean(process.env.GROQ_API_KEY),
    validate: requestGroqFallbackValidation,
  },
};

function getProviderOrder() {
  const configuredOrder = String(process.env.AI_PROVIDER_ORDER || DEFAULT_PROVIDER_ORDER.join(','))
    .split(',')
    .map((providerId) => providerId.trim().toLowerCase())
    .filter(Boolean);

  const uniqueOrder = [];
  const seen = new Set();
  for (const providerId of configuredOrder) {
    if (seen.has(providerId)) {
      continue;
    }
    seen.add(providerId);
    if (Object.hasOwn(providerRegistry, providerId)) {
      uniqueOrder.push(providerId);
    }
  }

  if (uniqueOrder.length > 0) {
    return uniqueOrder;
  }

  return [...DEFAULT_PROVIDER_ORDER];
}

function getEnabledProviders() {
  return getProviderOrder()
    .map((providerId) => {
      const provider = providerRegistry[providerId];
      return {
        id: provider.id,
        model: provider.getModel(),
        enabled: provider.isEnabled(),
        validate: provider.validate,
      };
    })
    .filter((provider) => provider.enabled);
}

function createLimiterKey(gameId, playerId) {
  return `${gameId}:${playerId}`;
}

function reserveValidationSlot(gameId, playerId) {
  const key = createLimiterKey(gameId, playerId);
  if (inflightValidationLocks.has(key)) {
    const error = new Error('You already have a validation in progress for this game');
    error.code = 'AI_RATE_LIMIT';
    throw error;
  }
  inflightValidationLocks.add(key);
  return key;
}

function releaseValidationSlot(lockKey) {
  if (lockKey) {
    inflightValidationLocks.delete(lockKey);
  }
}

function parseJsonObject(text) {
  if (!text) {
    throw new Error('Empty AI response content');
  }

  const raw = String(text).trim();
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : raw;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI response did not contain JSON');
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Parses and normalizes model content to contract output.
 * @param {string} content
 * @returns {{valid:boolean,score:number,reason:string}}
 */
export function parseValidationContent(content) {
  const parsed = parseJsonObject(content);
  const normalizedScore = Number(parsed.score);

  return {
    valid: typeof parsed.valid === 'boolean' ? parsed.valid : false,
    score: Number.isFinite(normalizedScore)
      ? Math.max(0, Math.min(100, normalizedScore))
      : 50,
    reason: String(parsed.reason || 'Connection accepted').slice(0, 100),
  };
}

function isRetryableProviderError(error) {
  const status = Number(error?.response?.status || 0);
  if ([408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('timeout')
    || message.includes('rate limit')
    || message.includes('over capacity')
    || message.includes('temporarily unavailable')
    || message.includes('econnaborted')
  );
}

async function callProviderWithRetry(provider, context) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await provider.validate(provider.model, context);
      const parsed = parseValidationContent(content);
      return {
        ...parsed,
        providerUsed: provider.id,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableProviderError(error) || attempt === 1) {
        break;
      }
      const retryDelayMs = 500 * (2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw lastError;
}

function buildPrompt(previousWord, currentWord, explanation) {
  return [
    {
      role: 'system',
      content: 'You are a word-chain validator. Determine if WORD1 connects logically to WORD2 using EXPLANATION. Reject random or weak links. Respond with valid JSON only: {"valid": boolean, "score": number 0-100, "reason": string max 100 chars}',
    },
    {
      role: 'user',
      content: `WORD1: ${previousWord}, WORD2: ${currentWord}, EXPLANATION: ${explanation}`,
    },
  ];
}

async function requestGroqValidation(model, context) {
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      messages: buildPrompt(context.previousWord, context.currentWord, context.explanation),
      temperature: 0.7,
      max_tokens: 100,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: AI_TIMEOUT_MS,
    },
  );

  return response?.data?.choices?.[0]?.message?.content;
}

async function requestGroqFallbackValidation(model, context) {
  return requestGroqValidation(model, context);
}

async function requestGeminiValidation(model, context) {
  const prompt = buildPrompt(
    context.previousWord,
    context.currentWord,
    context.explanation,
  );
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await axios.post(
    endpoint,
    {
      contents: [
        {
          parts: [
            {
              text: `${prompt[0].content}\n${prompt[1].content}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 120,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: AI_TIMEOUT_MS,
    },
  );

  return response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
}

/**
 * Validates a word chain connection using provider fallback with in-flight limit.
 * @param {{gameId:string,playerId:string,previousWord:string,currentWord:string,explanation:string}} payload
 * @returns {Promise<{valid: boolean, score: number, reason: string, providerUsed: 'groq'|'gemini'|'llama'|'fallback'}>}
 */
export const validateWordChain = async (payload) => {
  const {
    gameId,
    playerId,
    previousWord,
    currentWord,
    explanation,
  } = payload;

  const lockKey = reserveValidationSlot(gameId, playerId);
  const context = {
    previousWord,
    currentWord,
    explanation,
  };

  try {
    const enabledProviders = getEnabledProviders();
    for (const provider of enabledProviders) {

      try {
        return await callProviderWithRetry(provider, context);
      } catch (providerError) {
        console.error(
          `[AI] Provider failed (${provider.id}): ${providerError.message}`,
        );
      }
    }

    if (AI_FAIL_OPEN) {
      return {
        valid: true,
        score: 50,
        reason: 'Auto-validated',
        providerUsed: 'fallback',
      };
    }

    return {
      valid: false,
      score: 0,
      reason: 'Validation unavailable. Try again.',
      providerUsed: 'fallback',
    };
  } finally {
    releaseValidationSlot(lockKey);
  }
};

export default {
  validateWordChain,
  parseValidationContent,
};
