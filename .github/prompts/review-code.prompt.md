---
description: "Use when: you've written a chunk of code and want a second opinion before moving on — a socket handler, a React component, the AI service, a DB query. Checks against project rules, flags anti-patterns, validates error handling, verifies security, and suggests improvements."
name: "Review Code"
argument-hint: "Paste code or reference file to review"
agent: "agent"
---

# Code Review for ChainCrack

Review the provided code against ChainCrack project standards. Check **all** of the following:

## 1. Project Rules Compliance
- [ ] Follow conventions from [copilot-instructions.md](../../copilot-instructions.md):
  - Full file path named before any code block
  - Code broken into components/services (no monolithic files)
  - All code fully optimized (no placeholders, TODO stubs, or unused imports)
  - Uses `async/await` consistently for async operations
  - JSDoc comments present for all functions and exports

## 2. Anti-Patterns (Forbidden)
- [ ] No ORMs used (raw SQL only for database operations)
- [ ] No authorization logic in frontend (all validation on backend)
- [ ] No secrets stored in code (use `.env` files)
- [ ] No direct DB mutations via Socket.IO (always validate server-side)
- [ ] No blocking async calls (event loop never blocked)

## 3. Error Handling
- [ ] Backend returns `{ success: false, error: "message" }` format on failure
- [ ] Frontend displays user-friendly error messages
- [ ] Errors logged server-side; no stack traces exposed to client
- [ ] Fallback behavior defined (e.g., AI service fallbacks to basic scoring if API fails)
- [ ] Network timeouts handled gracefully

## 4. Security
- [ ] No API keys, passwords, or secrets hardcoded
- [ ] Environment variables used for all sensitive config (`.env`)
- [ ] Input validation present (especially for Socket.IO events and API params)
- [ ] SQL queries use parameterized queries (no string concatenation)

## 5. Component-Specific Checks

### React Components
- [ ] Presentational only (no business logic embedded)
- [ ] Mobile responsive (check Tailwind breakpoints if styling)
- [ ] Proper hook usage (no hooks in conditionals)
- [ ] No direct DOM manipulation (use React state/refs)

### Socket.IO Handlers (Backend)
- [ ] Event handler is pure: receives → validates → broadcasts
- [ ] All state changes persisted to database
- [ ] Emits match documented event schema
- [ ] Server-authoritative (never trust client state)

### AI Service / External APIs
- [ ] Multi-provider fallback implemented (Groq → Gemini → Llama API)
- [ ] Retry logic with exponential backoff (if applicable)
- [ ] Timeout handling (don't hang forever)
- [ ] Graceful degradation (e.g., fallback to basic scoring if all APIs fail)

### Database Queries
- [ ] Raw SQL (no ORM)
- [ ] Parameterized queries (prevent SQL injection)
- [ ] Queries isolated in `queries.js`
- [ ] Transaction handling if multiple operations needed

## 6. Improvements (Suggest Without Rewriting)
Highlight 2–3 opportunities for improvement:
- Readability or clarity
- Performance optimization
- Better error messaging
- Code reuse / DRY principle
- Type safety or JSDoc precision

---

**Output Format**: Provide a summary of pass/fail for each section above, then list suggested improvements as bullet points. Keep the tone constructive — assume the code is mostly good; focus on opportunities to make it better.
