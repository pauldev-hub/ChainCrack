# ChainCrack

A real-time competitive browser game where 2–4 players race to build the shortest logical word chain between two given words. Each step in the chain requires a word plus a written explanation of the connection. An AI judge (Groq API with Gemini/Llama fallback) scores every submission in real-time.

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm 9+

### Installation

```bash
# Clone repository
git clone <repo-url>
cd ChainCrack

# Install dependencies for all packages
npm install
```

### Development

```bash
# Start both frontend and backend in dev mode
npm run dev

# Or start individually:
npm --workspace=packages/backend run dev
npm --workspace=packages/frontend run dev
```

Frontend will be available at `http://localhost:5173` (Vite default)
Backend API at `http://localhost:5000`

### Environment Setup

1. **Backend** — Copy `packages/backend/.env.example` to `.env` and fill in API keys:
   ```bash
   PORT=5000
   GROQ_API_KEY=your_key_here
   GEMINI_API_KEY=your_key_here
   ```

2. **Frontend** — Copy `packages/frontend/.env.example` to `.env`:
   ```bash
   VITE_API_URL=http://localhost:5000
   VITE_WS_URL=ws://localhost:5000
   ```

## Project Structure

```
packages/
├── backend/
│   ├── src/
│   │   ├── server.js          (Express + Socket.IO setup)
│   │   ├── routes/             (REST endpoints)
│   │   ├── services/
│   │   │   ├── ai/             (LLM validation: Groq, Gemini, Llama)
│   │   │   └── game/           (game logic)
│   │   ├── db/
│   │   │   ├── init.js         (SQLite setup)
│   │   │   └── queries.js      (raw SQL queries)
│   │   └── types/              (JSDoc types)
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/         (React components)
    │   ├── pages/              (page layouts)
    │   ├── hooks/              (custom hooks)
    │   ├── services/           (Socket.IO, API client)
    │   ├── types/              (JSDoc types)
    │   ├── App.jsx
    │   └── main.jsx
    ├── public/                 (static assets)
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

## Technology Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Socket.IO Client
- **Backend:** Node.js, Express.js, Socket.IO, SQLite
- **AI:** Groq API (primary), Gemini (fallback 1), Llama 3.3 70B (fallback 2)
- **Monorepo:** npm workspaces

## Development Guidelines

See `copilot-instructions.md` and `.github/instructions/technical-contracts.instructions.md` for:
- Code conventions and structure
- Socket.IO event contracts
- Database schema
- REST API specifications
- AI service integration details

## Build & Deployment

```bash
# Build both packages for production
npm run build

# Backend production start
npm --workspace=packages/backend start

# Frontend production preview
npm --workspace=packages/frontend preview
```

## Testing

```bash
npm run test
```

## License

ISC
