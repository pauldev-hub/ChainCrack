---
description: "Use when implementing Socket.IO events, REST endpoints, database operations, or AI service integration. Enforces exact payload schemas, database columns, endpoint signatures, and response formats."
applyTo: "packages/backend/src/**/*.js"
---

# API & Data Contracts

## Socket.IO Events

### Client → Server
| Event | Payload |
|-------|---------|
| `join_game` | `{ gameId: string, playerName: string, playerId: string }` |
| `submit_word` | `{ gameId: string, playerId: string, word: string, explanation: string }` |
| `leave_game` | `{ gameId: string, playerId: string }` |
| `request_game_state` | `{ gameId: string, playerId: string }` |
| `request_scores` | `{ gameId: string }` |

### Server → Client
| Event | Payload |
|-------|---------|
| `player_joined` | `{ playerId: string, playerName: string, playerCount: number, timestamp: ISO8601 }` |
| `submission_received` | `{ submissionId: string, playerId: string, word: string, status: "pending" }` |
| `submission_validated` | `{ submissionId: string, isValid: boolean, score: number, reason: string }` |
| `scores_updated` | `{ gameId: string, scores: [{ playerId, playerName, score, chainLength }] }` |
| `player_left` | `{ playerId: string, remainingPlayers: number }` |
| `game_ended` | `{ winnerId: string, winnerName: string, finalScores: [...], timestamp: ISO8601 }` |
| `error` | `{ message: string, errorType: string, data?: {...} }` |
| `game_state` | Full game object (see DB schema) |

---

## Database Schema

### games
| Column | Type | Constraints |
|--------|------|-----------|
| `id` | TEXT PRIMARY KEY | UUID |
| `start_word` | TEXT NOT NULL | |
| `end_word` | TEXT NOT NULL | |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `started_at` | TIMESTAMP | NULLABLE |
| `ended_at` | TIMESTAMP | NULLABLE |
| `status` | TEXT | "waiting" \| "active" \| "ended" |
| `max_players` | INTEGER | DEFAULT 4 |
| `time_limit_seconds` | INTEGER | DEFAULT 300 |

### players
| Column | Type | Constraints |
|--------|------|-----------|
| `id` | TEXT PRIMARY KEY | UUID |
| `game_id` | TEXT | FOREIGN KEY (games.id) |
| `name` | TEXT NOT NULL | 1-50 chars |
| `joined_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `left_at` | TIMESTAMP | NULLABLE |
| `is_active` | BOOLEAN | DEFAULT true |

### word_chains
| Column | Type | Constraints |
|--------|------|-----------|
| `id` | TEXT PRIMARY KEY | UUID |
| `game_id` | TEXT | FOREIGN KEY (games.id) |
| `player_id` | TEXT | FOREIGN KEY (players.id) |
| `step_number` | INTEGER | NOT NULL |
| `word` | TEXT NOT NULL | |
| `explanation` | TEXT NOT NULL | 10-500 chars |
| `submitted_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `is_valid` | BOOLEAN | NOT NULL |
| `ai_score` | INTEGER | 0-100 |
| `ai_feedback` | TEXT | NULLABLE |

### submissions
| Column | Type | Constraints |
|--------|------|-----------|
| `id` | TEXT PRIMARY KEY | UUID |
| `game_id` | TEXT | FOREIGN KEY (games.id) |
| `player_id` | TEXT | FOREIGN KEY (players.id) |
| `word_chain_id` | TEXT | FOREIGN KEY (word_chains.id) |
| `status` | TEXT | "pending" \| "validated" \| "rejected" |
| `submitted_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `validated_at` | TIMESTAMP | NULLABLE |
| `validation_ms` | INTEGER | NULLABLE |
| `provider_used` | TEXT | "groq" \| "gemini" \| "llama" |

### scores
| Column | Type | Constraints |
|--------|------|-----------|
| `id` | TEXT PRIMARY KEY | UUID |
| `game_id` | TEXT | FOREIGN KEY (games.id) |
| `player_id` | TEXT | FOREIGN KEY (players.id) |
| `total_score` | INTEGER | |
| `chain_length` | INTEGER | |
| `time_taken_seconds` | INTEGER | |
| `rank` | INTEGER | |
| `finalized_at` | TIMESTAMP | |

---

## REST Endpoints

### Games
| Method | Path | Query/Body | Response | Status |
|--------|------|-----------|----------|--------|
| GET | `/api/games/:gameId` | — | Game object + players | 200 / 404 |
| POST | `/api/games` | `{ startWord: string, endWord: string, maxPlayers: number }` | `{ gameId, status, startWord, endWord }` | 201 / 400 |
| GET | `/api/games/:gameId/state` | — | Full game state | 200 / 404 |
| POST | `/api/games/:gameId/end` | `{ winnerId: string }` | `{ success: true, finalScores [...] }` | 200 / 400 |

### Players
| Method | Path | Query/Body | Response | Status |
|--------|------|-----------|----------|--------|
| POST | `/api/players/create` | `{ name: string }` | `{ playerId: string, name }` | 201 |
| GET | `/api/players/:playerId` | — | Player object | 200 / 404 |

### Stats
| Method | Path | Query/Body | Response | Status |
|--------|------|-----------|----------|--------|
| GET | `/api/stats/leaderboard` | `?limit=10` | `{ success: true, data: [{...}] }` | 200 |
| GET | `/api/stats/player/:playerId` | — | `{ success: true, data: {...} }` | 200 / 404 |
| GET | `/api/stats/game/:gameId` | — | `{ success: true, data: {...} }` | 200 / 404 |

### Response Format (All Endpoints)
**Success:** `{ success: true, data: {...} }` — HTTP 200, 201
**Error:** `{ success: false, error: "message" }` — HTTP 400, 404, 500

---

## AI Service Contract

### Request (Groq)
```javascript
{
  model: "llama-3.1-8b-instant",
  messages: [{
    role: "system",
    content: "Validate word connection. Respond with valid JSON only: {\"valid\": boolean, \"score\": number 0-100, \"reason\": string max 100 chars}"
  }, {
    role: "user",
    content: "WORD1: cat, WORD2: dog, EXPLANATION: Both are domesticated pets"
  }],
  temperature: 0.7,
  max_tokens: 100
}
```

### Response (Parsed)
| Field | Type | Valid Range | Fallback |
|-------|------|------------|----------|
| `valid` | boolean | true \| false | — |
| `score` | number | 0–100 | 50 |
| `reason` | string | max 100 chars | "Connection accepted" |

### Fallback Chain
1. **Groq** — `llama-3.1-8b-instant` (560 tps)
2. **Gemini** — `gemini-2.0-flash`
3. **Groq** — `llama-3.3-70b-versatile` (280 tps, better quality)
4. **Fallback** — Basic scoring (score: 50, valid: true)

**Timeout:** 10 seconds per validation

---

## Validation Rules

### Word Submission (Server-Side)
- Word: 1–50 ASCII chars, non-empty, no duplicates in chain
- Explanation: 10–500 chars, non-empty
- Both required; reject if invalid

### Database Uniqueness
- `games.id` — Unique per game
- `players.id` — UUID across all players
- `games` + `player_id` — No duplicate player in same game
- `word_chains.step_number` — Unique per game

### Timestamps
- Format: **ISO 8601** (e.g., `2025-03-28T14:30:45Z`)
- Stored in SQLite as `CURRENT_TIMESTAMP`
- Serialized to client as ISO string

### HTTP Headers
- Request: `Content-Type: application/json`
- Response: `Content-Type: application/json`

---

## Implementation Checklist

- [ ] Socket.IO event names match exactly (case-sensitive)
- [ ] Payload fields present and typed correctly
- [ ] Database columns and constraints match schema
- [ ] REST endpoints return correct HTTP status + response format
- [ ] AI service JSON response parsed correctly
- [ ] Fallback chain honored on API failure
- [ ] All timestamps ISO 8601
- [ ] Errors include user-friendly message + errorType
- [ ] All required fields present in payloads
- [ ] No hardcoded API keys (use `.env`)
