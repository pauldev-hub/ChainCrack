# ChainCrack: Development Instructions

## Project Overview

**ChainCrack** is a real-time competitive browser game where 2–4 players race to build the shortest logical word chain between two given words. Each step in the chain requires a word plus a written explanation of the connection. An AI judge (Groq API) scores every submission in real-time.

### Core Gameplay Loop
1. Game host provides two words (start → end)
2. Players submit word-chain steps with explanations
3. Gemini API validates connection logic and scores submissions
4. Shortest valid chain wins; fastest ties win
5. Real-time sync across all players via Socket.IO

---

## Technology Stack

### Frontend
- **React 18** with JavaScript (ES2022+)
- **Vite** (build tool, dev server)
- **Tailwind CSS** (styling)
- **Socket.IO Client** (real-time updates)
- **localStorage** (session persistence with UUID-based guest auth)

### Backend
- **Node.js 18+** with JavaScript (ES2022+)
- **Express.js** (API + WebSocket server)
- **Socket.IO** (server-authoritative real-time sync)
- **SQLite** (single-file database, no ORM—raw SQL only)
- **Multi-provider LLM integration** (Groq primary, Gemini/Llama fallback—isolated in AI service module)

### Development & Deployment
- npm workspaces (monorepo: `packages/frontend`, `packages/backend`)
- Environment variables (`.env` per package, not tracked)
- Docker support (optional future enhancement)

---

## General Rules

1. **Avoid assumptions.** If you don't have enough context to complete a task correctly, ask a clarifying question before writing any code.

2. **Always name the file.** Every code block must be preceded by the full file path (e.g., `packages/backend/src/services/aiService.js`).

3. **Break code into components/services.** Never put everything in one file.
   - UI → separate React components (one component per file)
   - Backend logic → services layer, not in route handlers
   - DB queries → isolated in `queries.js`, not mixed with business logic

4. **All code must be fully optimized.** No placeholder logic, no TODO stubs, no unused imports. Follow DRY principles. Use `async/await` consistently for all async operations.

---

## Project Structure

```
ChainCrack/
├── .github/
│   └── copilot-instructions.md       (this file)
├── packages/
│   ├── backend/                      (Express + SQLite + Socket.IO)
│   │   ├── src/
│   │   │   ├── server.js             (Express + Socket.IO setup)
│   │   │   ├── routes/               (REST endpoints)
│   │   │   ├── services/
│   │   │   │   ├── ai/               (Gemini API service)
│   │   │   │   └── game/             (game logic)
│   │   │   ├── db/
│   │   │   │   ├── init.js           (SQLite setup & migrations)
│   │   │   │   └── queries.js        (raw SQL queries)
│   │   │   └── types/                (JSDoc types)
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── frontend/                     (React + Vite)
│       ├── src/
│       │   ├── components/           (React components)
│       │   ├── pages/                (page layouts)
│       │   ├── hooks/                (custom React hooks)
│       │   ├── services/             (Socket.IO client, API calls)
│       │   ├── types/                (JSDoc types)
│       │   ├── App.jsx
│       │   └── main.jsx
│       ├── .env.example
│       └── package.json
│
├── package.json                      (monorepo root)
└── README.md
```

---

## Development Conventions

### Authentication
- **No signup/login:** Guest-only via UUID stored in `localStorage`
- Each player gets a UUID on first visit (frontend generates)
- UUID persists across sessions; used in all game requests

### Database (SQLite)
- **Raw SQL only:** No ORM (Prisma, TypeORM, etc.)
- Queries written in `packages/backend/src/db/queries.js`
- Migrations managed manually in `packages/backend/src/db/init.js`
- Schema: games, players, word_chains, submissions, scores

### Real-time Sync (Socket.IO)
- **Server-authoritative:** All game state lives on server
- Client emits events; server validates, updates DB, broadcasts to all players
- Events: `join_game`, `submit_word`, `update_scores`, `game_end`, etc.

### AI Service (Multi-Provider LLM)
- Isolated in `packages/backend/src/services/ai/`
- **Primary provider:** Groq (llama-3.1-8b-instant, 560 tps—fastest)
- **Fallback 1:** Gemini API (gemini-2.0-flash)
- **Fallback 2:** Groq Llama 3.3 70B (llama-3.3-70b-versatile, 280 tps—better quality)
- **Final Fallback:** Basic scoring (50 points)
- Async validation: check word-chain connection logic, score submission
- Timeout: 10 seconds per validation
- If provider fails: retry next in chain
- API keys stored in backend `.env` (never exposed to frontend)

**Note:** Mixtral (old model) is deprecated by Groq. Use Llama 3.1 8B for production.

### Code Organization
- **Components** stay presentational (no business logic)
- **Services** handle API/Socket.IO communication
- **Hooks** manage state & side effects (React)
- **JSDoc types** defined once, shared between packages (comments in `.js` files or separate `.d.ts`)

### Error Handling
- Backend returns `{ success: false, error: "message" }`
- Frontend displays user-friendly error messages
- Log errors server-side; never expose stack traces to client

---

## Build & Run Commands

### Root (monorepo)
```bash
# Install dependencies
npm install

# Develop (both packages in parallel)
npm run dev

# Build production
npm run build

# Run tests
npm run test
```

### Backend
```bash
npm --workspace=packages/backend run dev     # dev server + auto-reload
npm --workspace=packages/backend run build   # compile
npm --workspace=packages/backend start       # run compiled server
```

### Frontend
```bash
npm --workspace=packages/frontend run dev    # Vite dev server
npm --workspace=packages/frontend run build  # production build
npm --workspace=packages/frontend preview   # preview production build
```

---

## Environment Variables

### Backend (`.env`)
```
PORT=5000
DATABASE_PATH=./gamestate.db
GROQ_API_KEY=xxx
GROQ_MODEL=llama-3.1-8b-instant
GEMINI_API_KEY=xxx
GEMINI_MODEL=gemini-2.0-flash
LLAMA_API_KEY=xxx
LLAMA_BASE_URL=https://api.together.xyz/v1
NODE_ENV=development
```

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```

---

## Key Architecture Patterns

### 1. Game State Management
- **Single Source of Truth:** SQLite + in-memory game cache on server
- Players don't hold game state; they request & listen for updates

### 2. Word Chain Validation
- Frontend: basic UI validation (non-empty, no duplicates)
- Backend: Groq API (llama-3.1-8b-instant) validates semantic connection + scoring
- Fallback chain: Groq → Gemini → Llama 3.3 70B → basic scoring (50 points)
- Timeout: 10 seconds per validation

### 3. Player Lifecycle
- **Join:** Generate/reuse UUID, add player to game, broadcast update
- **Play:** Submit word → server validates → broadcast to all
- **Leave:** Update game state, announce disconnect, broadcast

### 4. Socket.IO Event Pattern
```javascript
// Client emits
socket.emit('submit_word', { gameId, playerId, word, explanation });

// Server validates, updates DB, broadcasts
io.to(gameId).emit('submission_accepted', { playerId, word, score });
```

---

## Common Development Tasks

### Adding a New Game Feature
1. Define JSDoc types in comments or create `.d.ts` file in `types/`
2. Backend: add DB query in `queries.js`, add Socket event handler in `server.js`
3. Frontend: add component, add Socket listener in service
4. Test: game state sync, AI scoring (if applicable)

### Debugging Real-time Sync
- Log all Socket.IO emits/receives (enable debug in Socket.IO config)
- Check DB state in SQLite (query directly or use CLI)
- Verify client UUID in browser DevTools → Application → localStorage

### Adding Database Migrations
1. Write SQL in `packages/backend/src/db/init.js`
2. Test with fresh `gamestate.db` (delete & restart)
3. Verify all queries still work

---

## Anti-Patterns (Don't Do This)

❌ **ORMs:** Use raw SQL for full control & transparency
❌ **Authorization Logic in Frontend:** All validation on backend
❌ **Storing Secrets in Code:** Use `.env` files (never commit)
❌ **Direct DB Mutation via Socket:** Always validate & log server-side
❌ **Blocking Async Calls:** Use `async/await`, never block the event loop

---

## Testing Strategy

- **Unit Tests:** Service logic (AI validation, scoring)
- **Integration Tests:** Socket.IO events + DB state
- **Manual Testing:** Multi-client gameplay (open 2+ browsers)

---

## Git Workflow

- Branch naming: `feature/`, `bugfix/`, `refactor/`
- Commit messages: imperative, lowercase ("add word validation" not "Added validation")
- PR reviews: require passing tests + code review

---

## Resources & Links

- **Socket.IO Docs:** https://socket.io/docs/
- **SQLite:** https://www.sqlite.org/cli.html
- **Gemini API:** https://ai.google.dev/tutorials/rest_quickstart
- **React Hooks:** https://react.dev/reference/react/hooks
- **Vite:** https://vitejs.dev/

---

## AI Agent Guidance

### Code Generation Rules
When writing code for ChainCrack:
1. Always validate on backend before accepting state changes
2. Keep Socket.IO handlers pure: receive → validate → broadcast
3. Test with multiple concurrent players when modifying game logic
4. Never hardcode API keys or database paths—use environment variables
5. Write JSDoc types first: define interfaces/types before implementation

### Response Format Rules
When responding to the user:
1. **Always state the full file path** before any code block (e.g., `packages/backend/src/server.js`)
2. **Break large files into logical sections** with comment headers (e.g., `// Database setup`, `// Socket.IO handlers`)
3. **Flag assumptions explicitly** with "ASSUMPTION:" prefix (e.g., "ASSUMPTION: using SQLite in-memory mode for tests")
4. **Never generate placeholder logic** — if implementation details are unknown, ask the user first
5. **Show before/after context** when editing existing files (3-5 lines surrounding changes)
6. **Use JSDoc comments** for all functions and exports: `/** Validates word chain logic. @param {string} word @returns {boolean} */`
7. **Provide environment variable examples** when creating new features that need config
