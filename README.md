# ChainCrack

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

A real-time competitive browser game where 2–4 players race to build the shortest logical word chain between two given words. Each step requires a word and a short explanation; submissions are validated and scored by an AI judge with a resilient provider fallback (Groq → Gemini → Llama 3.3 → basic scorer). 

Built with ❤️ by Pratyush — a fun passion project exploring real-time multiplayer and AI-powered gameplay.

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Development](#development)
- [Environment](#environment)
- [Build & Deploy](#build--deploy)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Contributing](#contributing)

## Features

- Real-time multiplayer (2–4 players) using Socket.IO
- AI-judged semantic validation and scoring (multi-provider fallback)
- Server-authoritative game state persisted to SQLite
- Lightweight monorepo with separate `frontend` and `backend` packages
- Guest sessions with persistent UUID stored in `localStorage`
- REST API endpoints for game management, stats, and administration


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

### Run (development)

Start both packages (monorepo):

```bash
npm run dev
```

Or run packages individually:

```bash
npm --workspace=packages/backend run dev
npm --workspace=packages/frontend run dev
```

The frontend runs at `http://localhost:5173` (Vite default). The backend API and Socket server run at `http://localhost:5000`.

## Environment

Copy the env examples and fill secrets.

Backend (`packages/backend/.env`):

```env
PORT=5000
DATABASE_PATH=./gamestate.db
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.1-8b-instant
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
LLAMA_API_KEY=your_key_here
LLAMA_BASE_URL=https://api.together.xyz/v1
NODE_ENV=development
```

Frontend (`packages/frontend/.env`):

```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```

## Build & Deploy

Build both packages for production:

```bash
npm run build
```

Start backend in production mode:

```bash
npm --workspace=packages/backend start
```

Preview frontend production build:

```bash
npm --workspace=packages/frontend preview
```

## Project Structure

```
ChainCrack/
├── packages/
│   ├── backend/               # 🔧 Node.js + Express + Socket.IO + SQLite
│   │   ├── src/
│   │   │   ├── server.js      # Express app & Socket.IO setup
│   │   │   ├── db/
│   │   │   │   ├── init.js    # SQLite initialization & migrations
│   │   │   │   └── queries.js # Raw SQL queries
│   │   │   ├── routes/        # REST API endpoints
│   │   │   │   ├── auth.js
│   │   │   │   ├── games.js
│   │   │   │   ├── players.js
│   │   │   │   ├── stats.js
│   │   │   │   └── leaderboard.js
│   │   │   ├── services/      # Business logic
│   │   │   │   ├── ai/        # Multi-provider LLM validation
│   │   │   │   ├── game/      # Game logic & state management
│   │   │   │   ├── player.js
│   │   │   │   ├── stats.js
│   │   │   │   └── wordService.js
│   │   │   ├── types/         # JSDoc type definitions
│   │   │   └── utils/         # Helper utilities
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── frontend/              # ⚛️ React + Vite + Tailwind CSS
│       ├── src/
│       │   ├── components/    # Reusable React components
│       │   ├── pages/         # Page-level layouts
│       │   │   ├── Game.jsx
│       │   │   ├── Home.jsx
│       │   │   ├── Lobby.jsx
│       │   │   ├── Leaderboard.jsx
│       │   │   ├── Results.jsx
│       │   │   └── Vote.jsx
│       │   ├── hooks/         # Custom React hooks
│       │   ├── services/      # API & Socket.IO client
│       │   ├── types/         # JSDoc type definitions
│       │   ├── App.jsx
│       │   ├── index.css      # Global styles
│       │   └── main.jsx
│       ├── public/            # Static assets
│       ├── index.html
│       ├── vite.config.js
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── .env.example
│       └── package.json
│
├── package.json               # Monorepo root
├── README.md                  # This file
└── LICENSE
```

### Architecture Overview

- **Backend:** Single-source-of-truth game state in SQLite, server-authoritative via Socket.IO
- **Frontend:** React components consuming real-time updates from Socket.IO
- **Database:** SQLite with raw SQL (no ORM) for full control
- **Real-time:** Socket.IO events keep all players in sync
- **AI Validation:** Multi-provider fallback chain (Groq → Gemini → Llama 3.3 → basic scorer)

## Testing

Run the test suite:

```bash
npm run test
```
## Disclaimer

 This is a personal hobby project built for learning and portfolio purposes. AI validations may not always be accurate and the game may contain bugs.

## Contributing

- Fork the repo and create a feature branch: `feature/your-feature`
- Follow the commit message style (imperative, lowercase)
- Run tests and linters before opening a PR
- Open an issue to discuss larger changes first


---
