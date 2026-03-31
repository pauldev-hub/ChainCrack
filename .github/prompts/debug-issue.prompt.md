---
description: "Debug a broken feature in ChainCrack. Use when something is broken and you don't know why — desync, socket not firing, AI returning wrong shape, score not saving."
name: "Debug ChainCrack Issue"
argument-hint: "What's broken? (e.g., 'score not saving', 'socket timeout', 'AI validation failing')"
agent: "agent"
---

# ChainCrack Debugging Guide

Systematically diagnose and fix issues in ChainCrack using a layered approach: **frontend → Socket.IO → backend → database → AI service**.

## Symptom Classification

| Symptom | Likely Layer | First Check |
|---------|--------------|------------|
| UI doesn't update / state stuck | Frontend or Socket.IO | Browser DevTools + server logs |
| Socket event doesn't fire | Backend handler or Socket.IO | Server terminal + check event name |
| Data doesn't persist / DB empty | Backend or Database | SQLite CLI query |
| Score wrong or AI response malformed | AI Service | AI service logs + API response |
| Player desync / conflicting state | Socket.IO broadcast | Check if all players getting same event |
| Game crashes on submit | Backend exception | Server logs + try/catch coverage |

---

## Systematic Diagnosis Process

### Step 1: Reproduce & Isolate
```
1. Can you reproduce the issue consistently? (yes/no)
   → If no: timing/race condition issue
2. Does it happen with 1 player or 2+ players?
   → 1 player: frontend or single-player backend logic
   → 2+ players: Socket.IO broadcast or state sync issue
3. Does it happen in Firefox and Chrome, or just one?
   → One browser: browser-local storage or plugin conflict
   → Both: backend or database issue
```

### Step 2: Examine the Right Layer

#### **Frontend (React/Browser)**
```javascript
// In browser DevTools Console:

// 1. Check local state
console.log(localStorage.getItem('playerId')); // Should exist
console.log(localStorage.getItem('gameState')); // Should match server

// 2. Check Socket.IO connection
console.log(socket.connected); // true = connected
console.log(socket.id); // Should exist
socket.on('*', (event, data) => console.log('EVENT:', event, data)); // All events

// 3. Check React state (if using React DevTools)
// Open React DevTools → Components tab → search component
// Check props vs actual rendered output
```

**Key log locations:**
- `packages/frontend/src/services/socketService.js` — add console logs around emit/listen
- Component render — log props: `console.log('Props:', props)` inside component
- Effect hooks — log when listeners attach: `console.log('Listener attached for:', eventName)`

#### **Socket.IO (Real-time Sync)**
```javascript
// Server: packages/backend/src/server.js

// Add logging at server startup:
io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);
  
  socket.on('submit_word', (data) => {
    console.log(`[SOCKET] submit_word received:`, data);
    // ... handler logic
    console.log(`[SOCKET] Broadcasting to room ${gameId}`);
    io.to(gameId).emit('submission_accepted', result);
  });
});

// Check in terminal output:
// ✓ "[SOCKET] Client connected" appears = connection successful
// ✓ "[SOCKET] submit_word received" appears = event fired
// ✗ Missing = event name wrong or not registered
// ✗ No broadcast log = issue in try/catch or handler code
```

**Common Socket.IO issues:**
- Event name typo (backend `submit_word` vs frontend `submitWord`)
- Client not joined to room: check `socket.join(gameId)` is called
- Handler throws error silently: wrap in try/catch and log errors

#### **Backend (Express + Handlers)**
```javascript
// In handler: packages/backend/src/sockets/gameHandlers.js

socket.on('submit_word', async (data) => {
  try {
    console.log(`[HANDLER] Input data:`, data); // Log input
    
    const validation = validateInput(data);
    console.log(`[HANDLER] Validation result:`, validation); // Log validation
    
    const dbResult = await queries.insertWordChain(data);
    console.log(`[HANDLER] DB insert result:`, dbResult); // Log DB write
    
    io.to(gameId).emit('submission_accepted', dbResult);
    console.log(`[HANDLER] Broadcast sent`); // Log broadcast
  } catch (error) {
    console.error(`[HANDLER] Error in submit_word:`, error); // CRITICAL
    socket.emit('error', { message: error.message });
  }
});

// Check:
// ✓ All 4 logs appear in order = flow completes
// ✗ Logs stop at validation = validation failing
// ✗ Logs stop at DB = database error
// ✗ Error log appears = exception caught, check message
```

#### **Database (SQLite)**
```bash
# Terminal: Connect to SQLite immediately after issue occurs
cd packages/backend
sqlite3 gamestate.db

# Check tables exist
.schema

# Check game state
SELECT * FROM games WHERE id = 'GAME_ID';
SELECT * FROM players WHERE game_id = 'GAME_ID';
SELECT * FROM word_chains WHERE game_id = 'GAME_ID';
SELECT * FROM submissions WHERE game_id = 'GAME_ID';
SELECT * FROM scores WHERE game_id = 'GAME_ID';

# Expected results:
# ✓ Games, players exist = join worked
# ✓ Submissions inserted with correct timestamp = submit worked
# ✗ Empty table = INSERT not called or failed
# ✗ NULL values = data validation missing
```

**Run queries directly from code:**
```javascript
// In packages/backend/src/db/queries.js
// Add logging for verification:
async function insertWordChain(gameId, playerId, word, explanation) {
  console.log(`[DB] Inserting word_chain: game=${gameId}, player=${playerId}, word=${word}`);
  const result = db.run(
    `INSERT INTO word_chains (game_id, player_id, word, explanation) VALUES (?, ?, ?, ?)`,
    [gameId, playerId, word, explanation]
  );
  console.log(`[DB] Insert result:`, result);
  return result;
}
```

#### **AI Service (Gemini API)**
```javascript
// In packages/backend/src/services/ai/aiService.js

async function validateWordChain(word1, word2, explanation) {
  try {
    console.log(`[AI] Sending validation request: ${word1} → ${word2}`);
    const response = await geminiAPI.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    console.log(`[AI] API response:`, response);
    
    const score = parseResponse(response);
    console.log(`[AI] Parsed score:`, score); // Should be number 0-100
    
    return score;
  } catch (error) {
    console.error(`[AI] API Error:`, error.message);
    return 50; // Fallback score
  }
}

// Check:
// ✓ Response contains text field = API working
// ✗ Rate limit error = API key wrong or quota exceeded
// ✗ Malformed response = parsing logic wrong
// ✗ Falls back to 50 = catch block triggered, check error message
```

---

## Common Failure Patterns & Fixes

### Pattern 1: Desynchronization (Players see different state)
**Symptoms:** Player A sees score change, Player B doesn't

**Diagnosis:**
```javascript
// Check: Is broadcast happening to ALL players?
io.to(gameId).emit('state_updated', state); // ✓ Correct
socket.emit('state_updated', state);        // ✗ Only sender sees it
io.emit('state_updated', state);            // ✗ Broadcasts to ALL games
```

**Fix:**
- Ensure `socket.join(gameId)` is called when player joins
- Replace single `socket.emit()` with `io.to(gameId).emit()` for shared state
- Verify room name matches between join and broadcast

### Pattern 2: Socket Event Not Firing
**Symptoms:** "Submit" button clicked, nothing happens

**Diagnosis:**
```javascript
// Frontend: Is event being emitted?
console.log('Emitting submit_word:', { word, explanation });
socket.emit('submit_word', { word, explanation });

// Backend: Is handler registered?
socket.on('submit_word', (data) => { console.log('Received!'); });

// Likely issue: event name mismatch
// Frontend emits: 'submitWord' (camelCase)
// Backend listens: 'submit_word' (snake_case)
```

**Fix:** Use snake_case for all Socket.IO event names globally

### Pattern 3: Data Not Persisting
**Symptoms:** Submit word → confirmation shows → refresh page → word gone

**Diagnosis:**
```javascript
// 1. Check DB directly
sqlite3 gamestate.db
SELECT * FROM word_chains WHERE game_id = 'GAME_ID' ORDER BY created_at DESC LIMIT 5;

// 2. Check INSERT is being called
// Add log in queries.js: console.log(`[DB] INSERT called`)

// 3. Check for transaction/commit issues
// SQLite: ensure db.run() or db.exec() is called (not just prepared)
```

**Fix:**
- Verify `queries.js` function actually calls `db.run()` or `db.exec()`
- Check error handling in handler (exceptions might be swallowed)
- Ensure database file is writable (check file permissions)

### Pattern 4: AI Service Returning Wrong Data
**Symptoms:** Score is always 50, or AI response is `undefined`

**Diagnosis:**
```javascript
// 1. Check API key is set
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'MISSING');

// 2. Check response structure
console.log('Raw API response:', JSON.stringify(response, null, 2));

// 3. Check parsing logic
const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
console.log('Extracted text:', text);
```

**Fix:**
- Verify `GEMINI_API_KEY` in backend `.env`
- Check API response structure matches Gemini docs
- Add safe navigation: `response?.candidates?.[0]?.content` (not `response.candidates[0].content`)
- Implement fallback scoring when API fails

### Pattern 5: Race Condition (Two players submit simultaneously)
**Symptoms:** One submission overwrites the other, or score calculation off

**Diagnosis:**
```javascript
// Check handler doesn't have concurrent db.run() calls without locking
socket.on('submit_word', async (data) => {
  // ✗ Bad: Two simultaneous requests can both read old score, write wrong value
  const score = await getPlayerScore(playerId);
  const newScore = score + points;
  await savePlayerScore(playerId, newScore);
  
  // ✓ Good: Atomic database operation
  await db.run(
    `UPDATE scores SET value = value + ? WHERE player_id = ?`,
    [points, playerId]
  );
});
```

**Fix:**
- Use atomic database operations (single `UPDATE` with `value + ?`, not read-then-write)
- Lock game state during sensitive operations if needed

---

## Debug Checklist

- [ ] **Reproduce:** Consistent? 1 player or 2+? 
- [ ] **Frontend Logs:** DevTools console showing events?
- [ ] **Socket.IO Logs:** Server terminal showing `[SOCKET]` messages?
- [ ] **Handler Logs:** All steps of handler executing?
- [ ] **Database:** Data in SQLite after operation?
- [ ] **AI Service:** API key set? Response structure correct?
- [ ] **Error Messages:** Any `[ERROR]` or exception logs?
- [ ] **Room/Event Names:** Consistent between frontend and backend?

## Adding Temporary Logging

```javascript
// Quick debug: Add 1-line logs at critical points
console.log(`[DEBUG] Variable name:`, variableValue);
console.error(`[ERROR] Failed to insert: ${error.message}`);

// Server terminal shows labels: [DEBUG], [SOCKET], [HANDLER], [DB], [AI], [ERROR]
// Makes it easy to follow flow and spot where it stops
```

---

## Resources for Debugging

- **Socket.IO Debug:** `DEBUG=socket.io:* npm run dev` (very verbose)
- **Backend Terminal:** Watch for logs in real-time as you trigger actions
- **SQLite CLI:** `sqlite3 gamestate.db` then `.tables`, `.schema`, `SELECT ...`
- **Browser DevTools:** Network tab shows Socket.IO frames, Console shows client logs
- **Fallback Scoring:** If AI fails, backend returns 50 points — check for this pattern
