---
description: "Implement or debug AI word-chain validation and scoring. Use when working on services/ai/ to handle Gemini (primary), Groq, Llama API (fallback), with automatic retry & fallback logic, timeouts, and basic scoring fallback (50 points)."
name: "AI Word-Chain Validation"
argument-hint: "Task (e.g., 'implement Gemini validation', 'add retry logic', 'debug API timeout')"
agent: "agent"
---

# AI Word-Chain Validation & Scoring

Implement or fix AI service for word-chain validation and scoring with **Groq as primary provider** and automatic fallback to Gemini, then Llama API, with retry logic and safe scoring fallback.

## Context & Requirements

### File Organization
- **AI Service Location:** `packages/backend/src/services/ai/`
- **Provider Strategy:** Try each provider in order; automatic fallback on failure
- **Supported Providers:**
  - Gemini (Google) — primary
  - Groq — fast inference
  - Llama via API (together.ai, replicate, or similar)
  - OpenRouter — meta-LLM routing
  - Any free model with OpenAI-compatible API
- **Retry Logic:** Single retry per provider with exponential backoff (500ms), then fallback
- **Final Fallback:** Basic scoring (50 points) if all APIs fail

### Environment Configuration

**Backend `.env` — All provider keys:**
```
# Groq (PRIMARY PROVIDER)
GROQ_API_KEY=gsk_xxx
GROQ_MODEL=mixtral-8x7b-32768

# Gemini (FALLBACK 1)
GEMINI_API_KEY=xxx
GEMINI_MODEL=gemini-2.0-flash

# Llama API (FALLBACK 2)
LLAMA_API_KEY=xxx
LLAMA_BASE_URL=https://api.together.xyz/v1

# Timeouts
AI_TIMEOUT_MS=10000
```

**Provider Configuration:**
```javascript
// services/ai/providers.js
const PROVIDERS = {
  groq: {
    name: 'Groq',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
    apiKey: process.env.GROQ_API_KEY,
    timeout: 10000,
    type: 'openai-compatible'
  },
  gemini: {
    name: 'Gemini',
    apiUrl: 'https://generativelanguage.googleapis.com/v1/generateMessage',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    apiKey: process.env.GEMINI_API_KEY,
    timeout: 10000,
    type: 'google'
  },
  llama: {
    name: 'Llama API',
    apiUrl: process.env.LLAMA_BASE_URL || 'https://api.together.xyz/v1/chat/completions',
    model: process.env.LLAMA_MODEL || 'meta-llama/Llama-2-70b-chat-hf',
    apiKey: process.env.LLAMA_API_KEY,
    timeout: 12000,
    type: 'openai-compatible'
  }
};

// Retry priority: groq → gemini → llama
export const PROVIDER_FALLBACK_ORDER = ['groq', 'gemini', 'llama'];
export { PROVIDERS };
```

### Universal Request/Response Schema

#### Request Format
All providers accept OpenAI-compatible or compatible variant:
```javascript
// Standard OpenAI-compatible (Groq, Llama, OpenRouter)
{
  model: "mixtral-8x7b-32768",
  messages: [
    {
      role: "system",
      content: "You are a word-chain validator. Validate whether word A connects to word B. Always respond with ONLY valid JSON: {\"valid\": boolean, \"score\": number (0-100), \"reason\": string}"
    },
    {
      role: "user",
      content: `Validate: ${startWord} → ${word}\nExplanation: ${explanation}\nRespond ONLY with JSON.`
    }
  ],
  temperature: 0.3,
  max_tokens: 200
}

// Gemini (REST API with generateContent)
{
  contents: [{
    parts: [{
      text: `System: Validate word chains. Always respond with ONLY JSON: {"valid": boolean, "score": 0-100, "reason": string}\n\nValidate: ${startWord} → ${word}\nWhy: ${explanation}`
    }]
  }],
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 200
  }
}
```

#### Response Contract (Universal JSON)
```javascript
{
  // Success case
  valid: true,               // boolean: is connection logically sound?
  score: 75,                 // number: 0-100 confidence/quality score
  reason: "Connection...",   // string: brief explanation (max 100 chars)
  
  // Invalid chain
  valid: false,
  score: 0,
  reason: "No semantic link between words."
}
```

**Parsing Rule:** All providers must extract JSON from response text (may contain markdown, explanations). Use robust JSON extraction: `response.match(/\{[\s\S]*\}/)` + `JSON.parse()` with error handling.

### Retry & Fallback Logic

#### Flow Diagram
```
┌──────────────────────────────────────┐
│ Get provider list from AI_PROVIDER_  │
│ ORDER env (e.g., gemini,groq,llama)  │
└────────────┬─────────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ For each provider in order:   │
    │ 1. Try with timeout (10-12s)  │
    │ 2. Parse response JSON        │
    │ 3. Validate schema            │
    └──────────┬─────────────────────┘
               │
          ┌────▼──────┐
          │ Success?  │
          └─┬──────┬──┘
            │      │
        YES │      │ NO
           │      │  (timeout, parse error,
           │      │   rate limit, API error)
           │      │
           │    ┌──▼───────────────────────┐
           │    │ Retry once with 500ms+   │
           │    │ exponential backoff       │
           │    └──────┬───────────────────┘
           │           │
           │      ┌────▼──────┐
           │      │ Still NO? │
           │      └─┬──────┬──┘
           │        │      │
           │    YES │      │ NO
           │        │      │ (try next provider)
           │        │      │
           └─────┐  │    ┌─┘
                 │  │    │
           ┌─────▼──▼────▼──────────┐
           │ Try next provider in    │
           │ AI_PROVIDER_ORDER       │
           └──────┬─────────────────┘
                  │
              ┌───▼─────────────────┐
              │ No more providers?  │
              └───┬─────┬──────────┘
                  │     │
              YES │     │ NO (try next)
                  │     └─────────────┐
                  │                   │
         ┌────────▼────────────────┐  │
         │ Return basic fallback:  │  │
         │ score: 50, reason:      │◄─┘
         │ "System unavailable"    │
         └─────────────────────────┘
```

#### Multi-Provider Implementation Pattern
```javascript
// services/ai/chainValidator.js
import { PROVIDERS } from './providers.js';
import { validateWithProvider } from './providerAdapter.js';

/**
 * Validate word chain with automatic multi-provider fallback
 * @param {string} startWord
 * @param {string} word
 * @param {string} explanation
 * @returns {Promise<{valid: boolean, score: number, reason: string}>}
 */
async function validateChain(startWord, word, explanation) {
  const providerOrder = (process.env.AI_PROVIDER_ORDER || 'gemini,groq,llama,openrouter')
    .split(',')
    .map(p => p.trim())
    .filter(p => process.env[PROVIDERS[p]?.apiKeyKey]);

  let lastError;

  // Try each provider in order
  for (const provider of providerOrder) {
    try {
      console.log(`[ChainValidator] Attempting ${provider}...`);
      const result = await validateWithProvider(provider, startWord, word, explanation);
      console.log(`[ChainValidator] SUCCESS with ${provider}:`, result);
      return { ...result, provider }; // Include which provider succeeded
    } catch (error) {
      lastError = error;
      console.error(`[ChainValidator] ${provider} failed:`, error.message);
      // Continue to next provider
    }
  }

  // All providers exhausted
  console.error('[ChainValidator] All providers failed. Using fallback scoring.', { startWord, word, lastError });
  return {
    valid: true,
    score: 50,
    reason: 'System unavailable; basic scoring applied',
    provider: 'fallback'
  };
}

export { validateChain };
```

#### Provider Adapter (Handles All API Formats)
```javascript
// services/ai/providerAdapter.js
import axios from 'axios';
import { PROVIDERS } from './providers.js';

/**
 * Call any supported provider with automatic retry
 * @param {string} providerName - 'gemini', 'groq', 'llama', 'openrouter', etc.
 * @param {string} startWord
 * @param {string} word
 * @param {string} explanation
 * @returns {Promise<{valid: boolean, score: number, reason: string}>}
 */
async function validateWithProvider(providerName, startWord, word, explanation) {
  const config = PROVIDERS[providerName];
  if (!config) throw new Error(`Unknown provider: ${providerName}`);

  const apiKey = process.env[config.apiKeyKey];
  if (!apiKey) throw new Error(`Missing API key for ${providerName}`);

  const maxRetries = 1;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }

      let response;

      if (config.type === 'google') {
        // Gemini-specific request
        response = await callGemini(apiKey, config, startWord, word, explanation, config.timeout);
      } else if (config.type === 'openai-compatible') {
        // Groq, Llama, OpenRouter, etc.
        response = await callOpenAICompatible(
          config.baseUrl,
          apiKey,
          config,
          startWord,
          word,
          explanation,
          config.timeout
        );
      } else {
        throw new Error(`Unknown provider type: ${config.type}`);
      }

      // Parse and validate response
      const result = parseAndValidateResponse(response);
      return result;

    } catch (error) {
      lastError = error;
      console.error(`[ProviderAdapter] ${providerName} attempt ${attempt + 1}/${maxRetries + 1}:`, error.message);
    }
  }

  throw new Error(`${providerName} failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

async function callGemini(apiKey, config, startWord, word, explanation, timeout) {
  const endpoint = `${config.baseUrl}/${config.modelKey}:generateContent?key=${apiKey}`;
  const response = await axios.post(
    endpoint,
    {
      contents: [{
        parts: [{
          text: `System: Validate word chains. Always respond with ONLY JSON: {"valid": boolean, "score": 0-100, "reason": string}\n\nValidate: ${startWord} → ${word}\nWhy: ${explanation}`
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 200
      }
    },
    { timeout }
  );
  
  return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAICompatible(baseUrl, apiKey, config, startWord, word, explanation, timeout) {
  const response = await axios.post(
    baseUrl,
    {
      model: process.env[config.modelKey],
      messages: [
        {
          role: 'system',
          content: 'You are a word-chain validator. Always respond with ONLY valid JSON: {"valid": boolean, "score": 0-100, "reason": string}'
        },
        {
          role: 'user',
          content: `Validate: ${startWord} → ${word}\nWhy: ${explanation}`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout
    }
  );

  return response.data.choices?.[0]?.message?.content || '';
}

function parseAndValidateResponse(content) {
  // Extract JSON from response (may be wrapped in markdown)
  const jsonMatch = String(content).match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');

  const result = JSON.parse(jsonMatch[0]);

  // Validate schema
  if (typeof result.valid !== 'boolean' || typeof result.score !== 'number' || typeof result.reason !== 'string') {
    throw new Error('Invalid response schema');
  }

  return {
    valid: result.valid ?? false,
    score: Math.max(0, Math.min(100, result.score ?? 0)),
    reason: (result.reason ?? '').substring(0, 100)
  };
}

export { validateWithProvider };
```

## Testing Patterns

### Unit Test Checklist
- [ ] **Success path (Gemini):** Valid JSON response parsed correctly
- [ ] **Success path (Groq):** OpenAI-compatible response handled
- [ ] **Success path (Llama):** Custom base URL and model resolution works
- [ ] **Success path (OpenRouter):** Meta-routing provider works
- [ ] **Retry:** Single retry triggered on timeout, then succeeds
- [ ] **Parse error:** Malformed JSON handled, triggers next provider
- [ ] **Rate limit:** HTTP 429 handled with retry, then fallback
- [ ] **Timeout:** Per-provider timeout (10-12s) triggers retry
- [ ] **All retries for all providers:** Fallback scoring (50 points) applied
- [ ] **Response validation:** Invalid schema detected and rejected
- [ ] **Provider order respected:** AI_PROVIDER_ORDER env var honored
- [ ] **Missing API key:** Provider skipped in fallback chain

### Integration Test Checklist
- [ ] **Multi-provider fallback chain works:** Gemini → Groq → Llama → OpenRouter → Fallback
- [ ] **Provider selection:** Only enabled providers in chain (API key check)
- [ ] **Concurrent submissions:** No blocking or race conditions
- [ ] **Database logging:** AI `provider` field records which provider was used
- [ ] **Logging visibility:** Server logs show provider attempt order on failure
- [ ] **Final fallback:** 50-point score applied when all APIs unavailable

### Manual Testing
```bash
# 1. Set up all provider keys in backend .env (or leave some empty to test fallback)
GEMINI_API_KEY=xxx
GROQ_API_KEY=xxx
LLAMA_API_KEY=xxx
OPENROUTER_API_KEY=xxx
AI_PROVIDER_ORDER=gemini,groq,llama,openrouter

# 2. Start backend in dev mode
npm --workspace=packages/backend run dev

# 3. Trigger game submission via Socket.IO or API
# Check server logs: which provider was used and in what order

# 4. Verify database: 
sqlite3 gamestate.db "SELECT id, provider, score FROM submissions ORDER BY created_at DESC LIMIT 5;"

# 5. Test fallback by disabling a provider temporarily or making api key invalid
# - For Gemini: export GEMINI_API_KEY= (empty)
# - Then resubmit and check logs: should skip Gemini, try Groq next
```

## Key Rules

1. **Never hardcode API keys** — use `process.env[PROVIDER_API_KEY]`
2. **Always use async/await** — no callbacks or `.then()` chains
3. **Parse JSON defensively** — all providers may wrap response in markdown or extra text
4. **Timeout = retry candidate** — single retry per provider on timeout/network error
5. **Log provider attempts** — track which AI validator was used (include in response)
6. **Respect provider order** — AI_PROVIDER_ORDER env var controls fallback sequence
7. **50-point fallback is final** — only applied after all providers + retries exhausted
8. **Filter by API key** — skip providers without valid API key in `.env`

## Environment Setup

**Backend `.env` — Configure all providers (leave empty to disable):**
```
# Google Gemini
GEMINI_API_KEY=xxx
GEMINI_MODEL=gemini-2.0-flash

# Groq (fast inference)
GROQ_API_KEY=gsk_xxx
GROQ_MODEL=mixtral-8x7b-32768

# Llama (together.ai, replicate, etc.)
LLAMA_API_KEY=xxx
LLAMA_BASE_URL=https://api.together.xyz/v1

# OpenRouter (meta-routing)
OPENROUTER_API_KEY=xxx
OPENROUTER_MODEL=meta-llama/llama-2-70b-chat

# Provider fallback sequence and timeout
AI_PROVIDER_ORDER=gemini,groq,llama,openrouter
AI_TIMEOUT_MS=10000
```

**Verification before working:**
```bash
# Check that at least one provider key is set
echo "Gemini: $GEMINI_API_KEY"
echo "Groq: $GROQ_API_KEY"
echo "Llama: $LLAMA_API_KEY"
echo "OpenRouter: $OPENROUTER_API_KEY"

# Run backend in dev mode with debug logging
AI_DEBUG=1 npm --workspace=packages/backend run dev
```

## Free Model Resources

| Provider | Model | Free Tier | Timeout | Notes |
|----------|-------|-----------|---------|-------|
| **Gemini** | gemini-2.0-flash | 60 req/min | 10s | Fast, reliable, best for production |
| **Groq** | mixtral-8x7b-32768 | 20 req/min | 10s | Ultra-fast inference (~50-200ms) |
| **Llama** | Llama 3 via together.ai | $1 free credit | 12s | Good fallback, supports multiple models |
| **OpenRouter** | Multiple models | $5 free credits | 12s | Meta-routing, supports 60+ models |

Recommended order for reliability: **Gemini → Groq → Llama → OpenRouter**

