---
description: "Write tests for ChainCrack — unit & integration tests for AI validation, Socket.IO handlers, REST endpoints, DB queries, and scoring logic. Use when: testing AI service, Socket.IO events, REST routes, database queries, game logic."
name: "Write Tests"
argument-hint: "Test focus: 'AI validation', 'Socket.IO handler', 'REST endpoint', 'DB query', or 'scoring logic'"
agent: "agent"
---

# Write Tests for ChainCrack

Create comprehensive, production-ready tests for any layer of the stack — from AI service mocks to multi-client Socket.IO integration.

---

## Test Structure & Organization

Tests live **adjacent to source**, with `.test.js` suffix:

```
packages/backend/src/
├── services/
│   ├── ai/
│   │   ├── aiService.js
│   │   └── aiService.test.js         ← AI validation tests
│   └── game/
│       ├── gameLogic.js
│       └── gameLogic.test.js          ← Game logic tests
├── routes/
│   ├── games.js
│   ├── games.test.js                  ← Route integration tests
└── db/
    ├── queries.js
    └── queries.test.js                ← DB query tests

packages/frontend/src/
├── components/
│   ├── GameBoard/
│   │   ├── GameBoard.jsx
│   │   └── GameBoard.test.jsx         ← React component tests
└── services/
    ├── socketService.js
    └── socketService.test.js          ← Socket.IO client tests
```

---

## Test Layers & Strategy

### Layer 1: Unit Tests (AI Service, DB Queries, Game Logic)

**What to test:**
- Single function behavior in isolation
- Edge cases & error handling (null inputs, invalid data)
- Return values match expected shape

**Tools:** `vitest` or `jest`

**Example: AI Validation Scoring**

```javascript
// packages/backend/src/services/ai/aiService.test.js
import { describe, it, expect, vi } from 'vitest';
import * as aiService from './aiService.js';

describe('AI Service — Word Chain Validation', () => {
  // Mock Gemini API responses
  vi.mock('./providers/geminiProvider.js', () => ({
    validateConnection: vi.fn()
  }));

  it('should score a valid word chain connection', async () => {
    const result = await aiService.validateWordConnection('cat', 'dog', 'Both are domesticated animals');
    
    expect(result).toEqual({
      isValid: true,
      score: 85,
      explanation: expect.any(String)
    });
  });

  it('should reject invalid connections', async () => {
    const result = await aiService.validateWordConnection('xyz', 'abc', 'No connection');
    
    expect(result.isValid).toBe(false);
    expect(result.score).toBeLessThan(50);
  });

  it('should fallback to basic scoring (50 pts) if API fails', async () => {
    // Simulate Groq timeout (primary provider)
    vi.mocked(groqProvider.validateConnection).mockRejectedValue(
      new Error('API timeout')
    );
    
    const result = await aiService.validateWordConnection('cat', 'dog', 'Connection');
    
    expect(result.score).toBe(50); // Fallback score
    expect(result.isValid).toBe(true); // Still valid submission
  });
});
```

---

### Layer 2: Mocking External APIs (Groq, Gemini, Llama)

**Mock Provider Pattern:**

```javascript
// packages/backend/src/services/ai/providers/__mocks__/groqProvider.js
export const validateConnection = vi.fn(async (word1, word2, explanation) => {
  return {
    isValid: true,
    score: 75,
    reasoning: 'Mocked Groq response'
  };
});

export const scoreSubmission = vi.fn(async (submission) => {
  return {
    score: 80,
    feedback: 'Well explained connection'
  };
});
```

**Test with Mock:**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as aiService from './aiService.js';
import * as groqProvider from './providers/__mocks__/groqProvider.js';

describe('AI Service with Groq Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use Groq if all primary fails', async () => {
    // Gemini fails, Groq succeeds
    groqProvider.validateConnection.mockResolvedValue({
      isValid: true,
      score: 78
    });

    const result = await aiService.validateWordConnection('cat', 'dog', 'Pets');
    
    expect(result.score).toBe(78);
    expect(groqProvider.validateConnection).toHaveBeenCalled();
  });
});
```

---

### Layer 3: Socket.IO Integration Tests

**Multi-Client Simulation:**

```javascript
// packages/backend/src/server.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient } from 'socket.io-client';

describe('Socket.IO Game Events', () => {
  let httpServer, ioServer;
  let client1, client2, client3;
  const TEST_PORT = 3001;

  beforeEach((done) => {
    httpServer = createServer();
    ioServer = new SocketIOServer(httpServer);
    httpServer.listen(TEST_PORT, () => {
      // Attach game handlers to server
      attachGameHandlers(ioServer);
      
      // Create 3 client connections
      client1 = ioClient(`http://localhost:${TEST_PORT}`, {
        reconnection: false
      });
      client2 = ioClient(`http://localhost:${TEST_PORT}`, {
        reconnection: false
      });
      client3 = ioClient(`http://localhost:${TEST_PORT}`, {
        reconnection: false
      });
      
      // Wait for all connections
      let connectedCount = 0;
      const checkReady = () => {
        connectedCount++;
        if (connectedCount === 3) done();
      };
      
      client1.on('connect', checkReady);
      client2.on('connect', checkReady);
      client3.on('connect', checkReady);
    });
  });

  afterEach((done) => {
    client1.disconnect();
    client2.disconnect();
    client3.disconnect();
    ioServer.close();
    httpServer.close(done);
  });

  it('should broadcast submission to all players', (done) => {
    const gameId = 'game-123';
    
    // Clients 2 & 3 listen for submission
    let receivedCount = 0;
    
    client2.on('submission_accepted', (data) => {
      expect(data.word).toBe('intermediate');
      expect(data.playerId).toBe('player-1');
      receivedCount++;
      if (receivedCount === 2) done();
    });
    
    client3.on('submission_accepted', (data) => {
      expect(data.word).toBe('intermediate');
      receivedCount++;
      if (receivedCount === 2) done();
    });
    
    // Client 1 submits
    client1.emit('submit_word', {
      gameId,
      playerId: 'player-1',
      word: 'intermediate',
      explanation: 'Halfway between cat and dog'
    });
  });

  it('should update scores for all players after submission', (done) => {
    const gameId = 'game-123';
    let scoresReceived = 0;
    
    [client1, client2, client3].forEach((client) => {
      client.on('scores_updated', (scores) => {
        expect(scores).toHaveProperty('player-1');
        scoresReceived++;
        if (scoresReceived === 3) done();
      });
    });
    
    // Player 1 submits
    client1.emit('submit_word', {
      gameId,
      playerId: 'player-1',
      word: 'step',
      explanation: 'Between cat and dog'
    });
  });
});
```

---

### Layer 4: REST Endpoint Integration Tests

**What to test:**
- Request → response cycle
- Status codes (200, 400, 404, 500)
- Response structure & data types
- Database state after request

**Example: Leaderboard Endpoint**

```javascript
// packages/backend/src/routes/stats.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import * as db from '../db/init.js';

describe('GET /api/stats/leaderboard', () => {
  beforeEach(async () => {
    // Reset DB before each test
    await db.reset();
    // Seed test data
    await db.query(`
      INSERT INTO players (id, name, score) VALUES 
      ('p1', 'Alice', 500),
      ('p2', 'Bob', 450),
      ('p3', 'Charlie', 400)
    `);
  });

  it('should return top 10 players sorted by score (desc)', async () => {
    const res = await request(app)
      .get('/api/stats/leaderboard')
      .expect(200);
    
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].name).toBe('Alice');
    expect(res.body.data[0].score).toBe(500);
    expect(res.body.data[1].name).toBe('Bob');
  });

  it('should respect limit query param', async () => {
    const res = await request(app)
      .get('/api/stats/leaderboard?limit=2')
      .expect(200);
    
    expect(res.body.data).toHaveLength(2);
  });

  it('should return 400 if limit is invalid', async () => {
    const res = await request(app)
      .get('/api/stats/leaderboard?limit=abc')
      .expect(400);
    
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('limit must be a number');
  });
});
```

---

### Layer 5: Database Query Tests

**What to test:**
- Correct SQL execution
- Proper record insertion/update/deletion
- Edge cases (duplicate keys, null values)

**Example: Game queries**

```javascript
// packages/backend/src/db/queries.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import * as queries from './queries.js';
import * as db from './init.js';

describe('Database Queries', () => {
  beforeEach(async () => {
    await db.reset();
  });

  describe('createGame', () => {
    it('should insert a new game and return its ID', async () => {
      const gameId = await queries.createGame({
        hostId: 'player-1',
        startWord: 'cat',
        endWord: 'dog',
        maxPlayers: 4
      });
      
      expect(gameId).toBeTruthy();
      
      const game = await queries.getGame(gameId);
      expect(game.startWord).toBe('cat');
      expect(game.endWord).toBe('dog');
      expect(game.status).toBe('waiting');
    });
  });

  describe('addPlayerToGame', () => {
    it('should add a player and increment playerCount', async () => {
      const gameId = await queries.createGame({
        hostId: 'p1',
        startWord: 'cat',
        endWord: 'dog',
        maxPlayers: 4
      });
      
      await queries.addPlayerToGame(gameId, 'p2');
      
      const game = await queries.getGame(gameId);
      expect(game.playerCount).toBe(2); // host + new player
    });

    it('should reject players if game is full', async () => {
      const gameId = await queries.createGame({
        hostId: 'p1',
        startWord: 'cat',
        endWord: 'dog',
        maxPlayers: 2
      });
      
      await queries.addPlayerToGame(gameId, 'p2');
      
      expect(async () => {
        await queries.addPlayerToGame(gameId, 'p3');
      }).rejects.toThrow('Game is full');
    });
  });
});
```

---

### Layer 6: Scoring Logic Tests

**What to test:**
- Correct score calculation
- Tie-breaking logic (chain length, speed)
- Bonus points for short chains

**Example: Scoring**

```javascript
// packages/backend/src/services/game/scoring.test.js
import { describe, it, expect } from 'vitest';
import { calculateScore, determineWinner } from './scoring.js';

describe('Game Scoring', () => {
  describe('calculateScore', () => {
    it('should award base points for valid submission', () => {
      const score = calculateScore({
        isValid: true,
        aiScore: 85,
        chainLength: 3,
        submissionTime: 5000 // 5 seconds
      });
      
      expect(score).toBeGreaterThanOrEqual(80);
      expect(score).toBeLessThanOrEqual(90);
    });

    it('should apply chain-length bonus (-10 pts per step)', () => {
      const scoreChain2 = calculateScore({
        isValid: true,
        aiScore: 80,
        chainLength: 2,
        submissionTime: 5000
      });
      
      const scoreChain4 = calculateScore({
        isValid: true,
        aiScore: 80,
        chainLength: 4,
        submissionTime: 5000
      });
      
      expect(scoreChain2).toBeGreaterThan(scoreChain4);
    });

    it('should apply speed bonus for fast submissions', () => {
      const speedyScore = calculateScore({
        isValid: true,
        aiScore: 80,
        chainLength: 3,
        submissionTime: 2000 // 2 seconds
      });
      
      const slowScore = calculateScore({
        isValid: true,
        aiScore: 80,
        chainLength: 3,
        submissionTime: 30000 // 30 seconds
      });
      
      expect(speedyScore).toBeGreaterThan(slowScore);
    });
  });

  describe('determineWinner', () => {
    it('should pick shortest chain', () => {
      const submissions = [
        { playerId: 'p1', chainLength: 4, score: 100 },
        { playerId: 'p2', chainLength: 3, score: 95 },
        { playerId: 'p3', chainLength: 3, score: 92 }
      ];
      
      const winner = determineWinner(submissions);
      
      expect(winner.playerId).toBe('p2'); // Tied on length, but faster
    });

    it('should use submission time as tiebreaker', () => {
      const submissions = [
        { playerId: 'p1', chainLength: 3, submissionTime: 10000, score: 90 },
        { playerId: 'p2', chainLength: 3, submissionTime: 5000, score: 95 }
      ];
      
      const winner = determineWinner(submissions);
      
      expect(winner.playerId).toBe('p2'); // Same chain length, faster wins
    });
  });
});
```

---

## Test Execution

### Run all tests:
```bash
npm --workspace=packages/backend run test
npm --workspace=packages/frontend run test
```

### Run single test file:
```bash
npm --workspace=packages/backend run test aiService.test.js
```

### Watch mode (auto-rerun on change):
```bash
npm --workspace=packages/backend run test:watch
```

### Coverage report:
```bash
npm --workspace=packages/backend run test:coverage
```

---

## Passing Test Checklist

✓ All assertions pass (green)  
✓ No console warnings or errors  
✓ All mocked APIs are cleared between tests (`beforeEach`)  
✓ Database state is reset between tests  
✓ Socket connections are properly cleaned up  
✓ No timing/race conditions (`done()` callbacks or `await`)  
✓ Covers happy path + error cases + edge cases  
✓ Variable names clearly indicate test intent  
✓ Comments explain non-obvious logic  

---

## Best Practices

1. **Mock external APIs** — Use `vi.mock()` to isolate unit tests
2. **Seed test data consistently** — Use `beforeEach()` to reset state
3. **Test one scenario per `it()` block** — Makes failures clear
4. **Use descriptive test names** — "should reject invalid connections" vs "test validation"
5. **Avoid hardcoded values** — Use constants for game IDs, timeouts
6. **Clean up after tests** — Close DB connections, disconnect sockets
7. **Test error paths** — Not just happy path (e.g., API timeouts, invalid input)
