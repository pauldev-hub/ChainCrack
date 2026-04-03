---
description: "Technical contract reference for ChainCrack. Use when implementing Socket.IO events, database operations, REST endpoints, or AI service integration. Defines exact payload schemas, database columns, endpoint signatures, and response formats."
applyTo: "**/*"
---

# ChainCrack Technical Contracts

Reference tables for implementation. All implementations must match these exact specifications.

---

## Socket.IO Event Contract

### Client → Server Events

| Event Name | Payload | Notes |
|-----------|---------|-------|
| `join_game` | `{ gameId: string, playerName: string, playerId: string }` | Player joins existing game or creates new. `playerId` is UUID from localStorage. |
| `submit_word` | `{ gameId: string, playerId: string, word: string, explanation: string }` | Submit word chain step with semantic explanation. |
| `leave_game` | `{ gameId: string, playerId: string }` | Player disconnects. Server broadcasts to remaining players. |
| `request_game_state` | `{ gameId: string, playerId: string }` | Client requests full current game state. |
| `request_scores` | `{ gameId: string }` | Request current score board. |

### Server → Client Events

| Event Name | Payload | Notes |
|-----------|---------|-------|
| `player_joined` | `{ playerId: string, playerName: string, playerCount: number, timestamp: ISO8601 }` | Broadcast when player joins. |
| `submission_received` | `{ submissionId: string, playerId: string, word: string, status: "pending" }` | Acknowledge word received, awaiting AI validation. |
| `submission_validated` | `{ submissionId: string, isValid: boolean, score: number, reason: string }` | AI validation complete with score. |
| `scores_updated` | `{ gameId: string, scores: [{ playerId, playerName, score, chainLength }] }` | Broadcast score update to all players. |
| `player_left` | `{ playerId: string, remainingPlayers: number }` | Player disconnected. |
| `game_ended` | `{ winnerId: string, winnerName: string, finalScores: [...], timestamp: ISO8601 }` | Game concluded. |
| `error` | `{ message: string, errorType: string }` | Error occurred on server. |
| `game_state` | Full game object (see DB schema) | Response to `request_game_state`. |

### Error Event Generic Format
```
{ 
  message: "User-friendly error description",
  errorType: "VALIDATION_ERROR" | "TIMEOUT" | "SERVER_ERROR" | "INVALID_OPERATION",
  data?: { /* optional context */ }
}
```

---

## Database Schema

### games
| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | TEXT PRIMARY KEY | UUID | Unique game identifier. |
| `start_word` | TEXT NOT NULL | | First word of chain (e.g., "cat") |
| `end_word` | TEXT NOT NULL | | Target word (e.g., "dog") |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Game creation time. |
| `started_at` | TIMESTAMP | NULLABLE | Time game actually started. |
| `ended_at` | TIMESTAMP | NULLABLE | Time game concluded. |
| `status` | TEXT | "waiting" \| "active" \| "ended" | Current game state. |
| `max_players` | INTEGER | DEFAULT 4 | Max allowed players (2-4). |
| `time_limit_seconds` | INTEGER | DEFAULT 300 | Total game duration. |

### players
| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | TEXT PRIMARY KEY | UUID | Player UUID (from localStorage). |
| `game_id` | TEXT | FOREIGN KEY (games.id) | Game reference. |
| `name` | TEXT NOT NULL | 1-50 chars | Display name. |
| `joined_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Join time. |
| `left_at` | TIMESTAMP | NULLABLE | Disconnect time (if applicable). |
| `is_active` | BOOLEAN | DEFAULT true | Currently in game. |

### word_chains
| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | TEXT PRIMARY KEY | UUID | Chain step ID. |
| `game_id` | TEXT | FOREIGN KEY (games.id) | Game reference. |
| `player_id` | TEXT | FOREIGN KEY (players.id) | Submitting player. |
| `step_number` | INTEGER | NOT NULL | Position in chain (1, 2, 3...). |
| `word` | TEXT NOT NULL | | The word submitted. |
| `explanation` | TEXT NOT NULL | 10-500 chars | Semantic connection explanation. |
| `submitted_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Submission time. |
| `is_valid` | BOOLEAN | NOT NULL | Validation result. |
| `ai_score` | INTEGER | 0-100 | Score from AI validation. |
| `ai_feedback` | TEXT | NULLABLE | Validation explanation. |

### submissions
| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | TEXT PRIMARY KEY | UUID | Submission ID. |
| `game_id` | TEXT | FOREIGN KEY (games.id) | Game reference. |
| `player_id` | TEXT | FOREIGN KEY (players.id) | Player who submitted. |
| `word_chain_id` | TEXT | FOREIGN KEY (word_chains.id) | Associated chain step. |
| `status` | TEXT | "pending" \| "validated" \| "rejected" | Current status. |
| `submitted_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When submitted. |
| `validated_at` | TIMESTAMP | NULLABLE | When AI returned result. |
| `validation_ms` | INTEGER | NULLABLE | Time taken for AI validation (ms). |
| `provider_used` | TEXT | "groq" \| "gemini" \| "llama" | Which LLM validated. |

### scores
| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | TEXT PRIMARY KEY | UUID | Score record ID. |
| `game_id` | TEXT | FOREIGN KEY (games.id) | Game reference. |
| `player_id` | TEXT | FOREIGN KEY (players.id) | Player reference. |
| `total_score` | INTEGER | | Sum of all word scores. |
| `chain_length` | INTEGER | | Number of words in chain. |
| `time_taken_seconds` | INTEGER | | Time to complete chain. |
| `rank` | INTEGER | | Final ranking (1st, 2nd, etc.). |
| `finalized_at` | TIMESTAMP | | When score locked. |

---

## REST API Endpoints

### Games

| Method | Path | Query/Body | Response | Status |
|--------|------|-----------|----------|--------|
| GET | `/api/games/:gameId` | — | Game object + players | 200 / 404 |
| POST | `/api/games` | `{ startWord: string, endWord: string, maxPlayers: number }` | `{ gameId, status, startWord, endWord }` | 201 / 400 |
| GET | `/api/games/:gameId/state` | — | Full game state (games + players + word_chains) | 200 / 404 |
| POST | `/api/games/:gameId/end` | `{ winnerId: string }` | `{ success: true, finalScores [...] }` | 200 / 400 |

### Players

| Method | Path | Query/Body | Response | Status |
|--------|------|-----------|----------|--------|
| POST | `/api/players/create` | `{ name: string }` | `{ playerId: string, name }` | 201 |
| GET | `/api/players/:playerId` | — | Player object | 200 / 404 |

### Stats

| Method | Path | Query/Body | Response | Status |
|--------|------|-----------|----------|--------|
| GET | `/api/stats/leaderboard` | `?limit=10` | `{ success: true, data: [{ playerName, totalScore, wins }] }` | 200 |
| GET | `/api/stats/player/:playerId` | — | `{ success: true, data: { stats, history } }` | 200 / 404 |
| GET | `/api/stats/game/:gameId` | — | `{ success: true, data: { game, players, submissions, scores } }` | 200 / 404 |

### Response Format (All Endpoints)

**Success:**
```json
{
  "success": true,
  "data": { /* endpoint-specific */ }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Plain text error message"
}
```

HTTP status must reflect outcome:
- `200` — Success
- `201` — Resource created
- `400` — Bad request / validation error
- `404` — Not found
- `500` — Server error

---

## AI Service JSON Response Contract

### Groq Request Payload
```javascript
{
  model: "llama-3.1-8b-instant",  // Mixtral deprecated; use Llama 3.1 8B for speed or llama-3.3-70b-versatile for quality
  messages: [
    {
      role: "system",
      content: "You are a word-chain validator. Determine if WORD1 connects logically to WORD2 given EXPLANATION. Respond with valid JSON only: {\"valid\": boolean, \"score\": number 0-100, \"reason\": string max 100 chars}"
    },
    {
      role: "user",
      content: "WORD1: cat, WORD2: dog, EXPLANATION: Both are domesticated pets"
    }
  ],
  temperature: 0.7,
  max_tokens: 100
}
```

### Groq Response Payload (Expected)
```javascript
{
  id: "chatcmpl-xxx",
  object: "chat.completion",
  created: 1234567890,
  model: "llama-3.1-8b-instant",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "{\"valid\": true, \"score\": 85, \"reason\": \"Common domestic animals\"}"
      },
      finish_reason: "stop"
    }
  ],
  usage: {
    prompt_tokens: 120,
    completion_tokens: 25,
    total_tokens: 145
  }
}
```

### Parsed Response Contract (After JSON Extract)
| Field | Type | Valid Range | Fallback |
|-------|------|------------|----------|
| `valid` | boolean | true \| false | — |
| `score` | number | 0–100 | 50 (if API fails) |
| `reason` | string | max 100 chars | "Connection accepted" |

### Provider Fallback Chain
```
Primary: Groq (llama-3.1-8b-instant) — 560 tps, fastest option
         ↓ (timeout/error after 1 retry)
Fallback 1: Gemini (gemini-2.0-flash)
           ↓ (timeout/error after 1 retry)
Fallback 2: Groq Llama 3.3 70B (llama-3.3-70b-versatile) — better semantic understanding, 280 tps
           ↓ (all fail)
Final Fallback: Basic Scoring (score: 50, valid: true, reason: "Auto-validated")
```

**Note:** Mixtral has been deprecated by Groq. Using Llama 3.1 8B instant is recommended for real-time word-chain validation due to high throughput (560 tps). For higher quality semantic analysis, fall back to Llama 3.3 70B.
```

---

## Validation Rules

### Word Submission Validation (Server-Side)
- Word: 1–50 ASCII chars, non-empty, not duplicate in chain
- Explanation: 10–500 chars, non-empty
- Both required; reject if missing or invalid

### Database Uniqueness
- `games.id` — Unique per game
- `players.id` — UUID across all players
- `games` + `player_id` — No duplicate player in same game (enforced at service layer)
- `word_chains.step_number` — Unique per game (enforced at service layer)

### Timestamp Format
- All timestamps: **ISO 8601** (e.g., `2025-03-28T14:30:45Z`)
- Stored in SQLite as `CURRENT_TIMESTAMP`
- Serialized to client as ISO string

### HTTP Headers
- Request: `Content-Type: application/json`
- Response: `Content-Type: application/json`
- All endpoints accept **JWT or UUID-based session** (not yet auth-restricted)

---

## Implementation Checklist

When implementing any layer, verify:
- [ ] Socket.IO event names match **exactly** (case-sensitive)
- [ ] Payload fields present and typed correctly
- [ ] Database columns and constraints match schema
- [ ] REST endpoints return correct HTTP status + response format
- [ ] AI service JSON response parsed correctly
- [ ] Fallback chain honored on API failure
- [ ] All timestamps ISO 8601
- [ ] Errors include user-friendly message + errorType
