---
description: "Create a Socket.IO event handler for real-time game features. Use when adding new real-time sync events, player actions, or game state updates."
name: "Create Socket.IO Event Handler"
argument-hint: "Event name and core action (e.g., 'leave_game' or 'submit_word')"
agent: "agent"
---

# Socket.IO Event Handler Creation

Create a production-ready Socket.IO event handler for ChainCrack's real-time synchronization system.

## Context & Requirements

### File Organization
- **Handlers** live in `packages/backend/src/sockets/` — split by concern:
  - `roomHandlers.js` — player joins/leaves, room management
  - `gameHandlers.js` — word submissions, scoring, game state
  - `connectionHandlers.js` — authentication, connection lifecycle
- **Each handler** must be registered in `packages/backend/src/server.js` under the Socket.IO namespace

### Database Integration
- **Always include** the matching SQL query function in `packages/backend/src/db/queries.js`
- Write raw SQL only — no ORM, no query builders
- Use SQLite-compatible syntax with parameterized queries (`?` placeholders)
- Example pattern:
  ```javascript
  // queries.js
  function insertWordChain(gameId, playerId, word, explanation) {
    return db.run(
      `INSERT INTO word_chains (game_id, player_id, word, explanation) 
       VALUES (?, ?, ?, ?)`,
      [gameId, playerId, word, explanation]
    );
  }

  // gameHandlers.js
  socket.on('submit_word', async (data) => {
    try {
      const result = await queries.insertWordChain(...);
      io.to(gameId).emit('submission_accepted', result);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  ```

### Error Handling
- **Always wrap handler logic** in `try/catch`
- **Emit an error event** back to the client on failure: `socket.emit('error', { message: '...' })`
- Log errors server-side with context (gameId, playerId, action)
- Never expose stack traces to the client

### Validation Pattern
- Client: basic UI validation (non-empty, format check)
- **Server: authoritative validation** — all game logic, permissions, state constraints
- Example: validate word against existing chain before inserting

### Real-time Broadcasting
- After DB write succeeds, broadcast state to all players in the room:
  ```javascript
  io.to(gameId).emit('state_updated', { /* new state */ });
  ```
- Use `socket.emit()` for player-specific feedback
- Use `io.to(gameId).emit()` for broadcast to all in room

## Implementation Checklist

- [ ] **Event name** follows snake_case convention (e.g., `submit_word`, `update_scores`)
- [ ] **Handler** is split into appropriate file (roomHandlers.js, gameHandlers.js, etc.)
- [ ] **queries.js function** exists and is tested with fresh DB
- [ ] **Try/catch** wraps entire handler logic
- [ ] **Error emission** sends `socket.emit('error', { message: '...' })` on failure
- [ ] **Server-side validation** of all inputs and game state
- [ ] **Broadcasting** uses `io.to(gameId).emit()` for state synchronization
- [ ] **Logging** includes gameId, playerId, and action for debugging
- [ ] **JSDoc comment** explains event purpose, params, and side effects
- [ ] **Tested** with 2+ concurrent players

## Related Patterns

- **Game State:** Single source of truth in SQLite + in-memory cache on server
- **Player Lifecycle:** join → emit → listen, no state held on client
- **AI Validation:** For word-chain scoring, call AI service in handler (with fallback scoring if API fails)
