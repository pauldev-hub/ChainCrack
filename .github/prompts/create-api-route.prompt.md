---
description: "Create a REST API endpoint for ChainCrack. Use when adding any endpoint — leaderboard, player stats, match history, replay data."
name: "Create API Route"
argument-hint: "Endpoint purpose and resource (e.g., 'GET /leaderboard to fetch top players')"
agent: "agent"
---

# REST API Route Creation

Build a production-ready Express route handler with consistent error responses and database integration.

## File Organization

```
packages/backend/src/
├── routes/
│   ├── index.js           (Route aggregator)
│   ├── games.js           (Game endpoints)
│   ├── players.js         (Player endpoints)
│   └── stats.js           (Leaderboard, match history, stats)
├── services/
│   ├── gameService.js     (Game business logic)
│   ├── playerService.js   (Player business logic)
│   └── ai/                (AI validation service)
├── db/
│   └── queries.js         (Raw SQL queries)
└── server.js              (Express setup - mounts routes)
```

**Pattern:**
- **Route file** (`games.js`): Defines endpoints and middleware
- **Service file** (`gameService.js`): Implements business logic
- **Database queries:** Use `packages/backend/src/db/queries.js` for raw SQL

---

## Route File Structure

**File: `packages/backend/src/routes/stats.js`**

```javascript
import express from 'express';
import * as statsService from '../services/statsService.js';

const router = express.Router();

/**
 * GET /api/stats/leaderboard
 * Fetch top 10 players by score
 * @query {number} [limit=10] - Number of players to return
 * @returns {Object} { success: true, data: [...] }
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const data = await statsService.getLeaderboard(limit);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats/player/:playerId
 * Fetch player stats and match history
 * @param {string} playerId - Player UUID
 * @returns {Object} { success: true, data: { stats, history } }
 */
router.get('/player/:playerId', async (req, res) => {
  try {
    const data = await statsService.getPlayerStats(req.params.playerId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats/game/:gameId
 * Fetch game replay data (all submissions + scores)
 * @param {string} gameId - Game UUID
 * @returns {Object} { success: true, data: { game, players, submissions } }
 */
router.get('/game/:gameId', async (req, res) => {
  try {
    const data = await statsService.getGameReplay(req.params.gameId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

**In `packages/backend/src/server.js`:**
```javascript
import statsRoutes from './routes/stats.js';
import gameRoutes from './routes/games.js';
import playerRoutes from './routes/players.js';

// Mount API routes
app.use('/api/stats', statsRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/players', playerRoutes);
```

---

## Service File Structure

**File: `packages/backend/src/services/statsService.js`**

```javascript
import * as queries from '../db/queries.js';

/**
 * Get top players by score
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of player objects with scores
 */
export async function getLeaderboard(limit = 10) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Cap at 100
    
    console.log(`[CONTROLLER] Fetching leaderboard, limit: ${limit}`);
    
    const leaderboard = await queries.getTopPlayers(limit);
    console.log(`[CONTROLLER] Leaderboard fetched, count: ${leaderboard.length}`);
    
    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error(`[CONTROLLER] Error in getLeaderboard:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
}

/**
 * Get player stats and match history
 * @param {Object} req - Express request
 * @param {string} req.params.playerId - Player UUID
 * @returns {void} - Sends JSON response
 */
export async function getPlayerStats(req, res) {
  try {
    const { playerId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'playerId is required'
      });
    }
    
    console.log(`[CONTROLLER] Fetching stats for player: ${playerId}`);
    
    const [playerStats, matchHistory] = await Promise.all([
      queries.getPlayerStats(playerId),
      queries.getPlayerMatchHistory(playerId, 10) // Last 10 games
    ]);
    
    if (!playerStats) {
      return res.status(404).json({
        success: false,
        error: 'Player not found'
      });
    }
    
    console.log(`[CONTROLLER] Stats fetched: ${matchHistory.length} games`);
    
    res.json({
      success: true,
      data: {
        stats: playerStats,
        history: matchHistory
      }
    });
  } catch (error) {
    console.error(`[CONTROLLER] Error in getPlayerStats:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player stats'
    });
  }
}

/**
 * Get game replay with all submissions
 * @param {Object} req - Express request
 * @param {string} req.params.gameId - Game UUID
 * @returns {void} - Sends JSON response
 */
export async function getGameReplay(req, res) {
  try {
    const { gameId } = req.params;
    
    if (!gameId) {
      return res.status(400).json({
        success: false,
        error: 'gameId is required'
      });
    }
    
    console.log(`[CONTROLLER] Fetching replay for game: ${gameId}`);
    
    const game = await queries.getGame(gameId);
    
    if (!game) {
      return res.status(404).json({
        success: false,
        error: 'Game not found'
      });
    }
    
    const [players, submissions] = await Promise.all([
      queries.getGamePlayers(gameId),
      queries.getGameSubmissions(gameId)
    ]);
    
    console.log(`[CONTROLLER] Replay fetched: ${submissions.length} submissions`);
    
    res.json({
      success: true,
      data: {
        game,
        players,
        submissions
      }
    });
  } catch (error) {
    console.error(`[CONTROLLER] Error in getGameReplay:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch game replay'
    });
  }
}
```

---

## Database Query Pattern

**File: `packages/backend/src/db/queries.js`**

```javascript
import db from './init.js';

/**
 * Get top N players by total score
 * @param {number} limit - Number of players to return
 * @returns {Promise<Array>} List of players with scores
 */
export function getTopPlayers(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        p.id, 
        p.name, 
        SUM(s.score) as total_score, 
        COUNT(DISTINCT s.game_id) as games_played,
        MAX(s.updated_at) as last_game_date
      FROM players p
      LEFT JOIN scores s ON p.id = s.player_id
      GROUP BY p.id
      ORDER BY total_score DESC, last_game_date DESC
      LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) {
          console.error(`[DB] Error fetching top players:`, err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    );
  });
}

/**
 * Get aggregated stats for a player
 * @param {string} playerId - Player UUID
 * @returns {Promise<Object>} Player stats
 */
export function getPlayerStats(playerId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT 
        p.id,
        p.name,
        COUNT(DISTINCT s.game_id) as games_played,
        SUM(s.score) as total_score,
        AVG(s.score) as avg_score,
        MAX(s.score) as max_score,
        COUNT(DISTINCT g.id) as games_won
      FROM players p
      LEFT JOIN scores s ON p.id = s.player_id
      LEFT JOIN games g ON s.game_id = g.id AND s.player_id = (
        SELECT player_id FROM scores WHERE game_id = g.id ORDER BY score DESC LIMIT 1
      )
      WHERE p.id = ?
      GROUP BY p.id`,
      [playerId],
      (err, row) => {
        if (err) {
          console.error(`[DB] Error fetching player stats:`, err);
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
}

/**
 * Get player's recent match history
 * @param {string} playerId - Player UUID
 * @param {number} limit - Number of recent games
 * @returns {Promise<Array>} List of games with scores
 */
export function getPlayerMatchHistory(playerId, limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        g.id,
        g.start_word,
        g.end_word,
        s.score,
        g.created_at,
        g.finished_at
      FROM games g
      JOIN scores s ON g.id = s.game_id
      WHERE s.player_id = ?
      ORDER BY g.created_at DESC
      LIMIT ?`,
      [playerId, limit],
      (err, rows) => {
        if (err) {
          console.error(`[DB] Error fetching match history:`, err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    );
  });
}

/**
 * Get game details
 * @param {string} gameId - Game UUID
 * @returns {Promise<Object>} Game record
 */
export function getGame(gameId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM games WHERE id = ?`,
      [gameId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

/**
 * Get all players in a game
 * @param {string} gameId - Game UUID
 * @returns {Promise<Array>} List of players with scores
 */
export function getGamePlayers(gameId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        p.id,
        p.name,
        s.score
      FROM players p
      JOIN scores s ON p.id = s.player_id
      WHERE s.game_id = ?
      ORDER BY s.score DESC`,
      [gameId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * Get all submissions in a game (replay data)
 * @param {string} gameId - Game UUID
 * @returns {Promise<Array>} List of submissions with player info
 */
export function getGameSubmissions(gameId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        sub.id,
        sub.player_id,
        p.name as player_name,
        sub.word,
        sub.explanation,
        sub.score,
        sub.created_at
      FROM submissions sub
      JOIN players p ON sub.player_id = p.id
      WHERE sub.game_id = ?
      ORDER BY sub.created_at ASC`,
      [gameId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}
```

---

## Error Response Shape

**All endpoints return this shape:**

```javascript
// Success (200)
{ success: true, data: { /* response data */ } }

// Client error (400)
{ success: false, error: "Missing required parameter: gameId" }

// Not found (404)
{ success: false, error: "Player not found" }

// Server error (500)
{ success: false, error: "Failed to fetch leaderboard" }
```

**Never expose stack traces to client:**
```javascript
// ✗ Wrong
res.status(500).json({ error: error.stack });

// ✓ Correct
res.status(500).json({ success: false, error: 'Internal server error' });
console.error('[CONTROLLER] Details:', error.stack); // Log on server only
```

---

## Input Validation Pattern

```javascript
export async function getPlayerStats(req, res) {
  try {
    const { playerId } = req.params;
    
    // Validate required params
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'playerId is required'
      });
    }
    
    // Validate format (UUID pattern)
    if (!/^[a-f0-9-]{36}$/.test(playerId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid playerId format'
      });
    }
    
    // Validate query params
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'limit must be between 1 and 100'
      });
    }
    
    // Proceed with business logic...
  } catch (error) {
    // ...
  }
}
```

---

## HTTP Status Codes

| Code | Use Case |
|------|----------|
| 200 | Success: data returned |
| 400 | Client error: missing/invalid params |
| 404 | Not found: resource doesn't exist |
| 500 | Server error: database or processing error |

---

## Implementation Checklist

- [ ] **Route file:** Created in `packages/backend/src/routes/`
- [ ] **Controller file:** Created in `packages/backend/src/controllers/`
- [ ] **Query functions:** Added to `packages/backend/src/db/queries.js`
- [ ] **HTTP method correct:** GET (fetch), POST (create), PUT/PATCH (update), DELETE
- [ ] **Route registered:** Added to `server.ts` with `app.use()`
- [ ] **JSDoc types:** Documented params, return types, query params
- [ ] **Error handling:** Try/catch in controller, consistent response shape
- [ ] **Input validation:** Check required params, validate formats, reject invalid input
- [ ] **Logging:** `[CONTROLLER]` and `[DB]` logs at key points
- [ ] **Status codes:** 200, 400, 404, 500 used correctly
- [ ] **No stack traces:** Client never sees error.stack, only user-friendly message
- [ ] **Tested:** Manual testing with curl or Postman, verify all response shapes

---

## Testing Endpoints Locally

```bash
# Terminal 1: Start backend server
npm --workspace=packages/backend run dev

# Terminal 2: Test endpoints with curl
curl http://localhost:5000/api/stats/leaderboard?limit=5
curl http://localhost:5000/api/stats/player/YOUR_PLAYER_ID
curl http://localhost:5000/api/stats/game/YOUR_GAME_ID

# Or use Postman to test with GUI
```

**Expected responses:**
```bash
# Success
{ "success": true, "data": [...] }

# Error
{ "success": false, "error": "Player not found" }
```

---

## Related Patterns

- **Real-time Updates:** For live-updated stats, use Socket.IO instead of polling
- **Pagination:** Add `offset` and `limit` query params for large result sets
- **Caching:** Cache leaderboard (updates infrequently) to reduce DB queries
- **Authentication:** All endpoints are currently public (guest-only); add playerId validation if needed
