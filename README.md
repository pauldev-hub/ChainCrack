# ChainCrack

[![Release](https://img.shields.io/github/v/release/pauldev-hub/ChainCrack?color=blue)](https://github.com/pauldev-hub/ChainCrack/releases)
[![Node](https://img.shields.io/badge/node-18%2B-green)](https://nodejs.org/)

A real-time competitive browser game where 2–4 players race to build the shortest logical word chain between two given words. Each step requires a word and a short explanation; submissions are validated and scored by an AI judge with a resilient provider fallback (Groq → Gemini → Llama 3.3 → basic scorer).

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Roadmap (Future Features)](#roadmap-future-features)
- [Development](#development)
- [Environment](#environment)
- [Build & Deploy](#build--deploy)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Technical Contracts](#technical-contracts)
- [Contributing](#contributing)
- [License](#license)

## Features

- Real-time multiplayer (2–4 players) using Socket.IO
- AI-judged semantic validation and scoring (multi-provider fallback)
- Server-authoritative game state persisted to SQLite
- Lightweight monorepo with separate `frontend` and `backend` packages
- Guest sessions with persistent UUID stored in `localStorage`
- REST API endpoints for game management, stats, and administration

## Roadmap (Future Features)

- Single-command Docker development & production builds
- Player accounts, profiles, and persistent leaderboards
- Spectator mode and game replay
- Mobile-first responsive UI and PWA support
- CI/CD pipelines, automated releases, and deploy previews
- Model A/B testing and scoring telemetry for fairness
- Internationalization and accessibility improvements
- Rate limiting, caching, and batched AI validation

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

> NOTE: Do not commit `.env` files or API keys to source control.

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
packages/
├── backend/        # Express + Socket.IO + SQLite
│   ├── src/
│   │   ├── server.js
   │   ├── routes/
   │   ├── services/
   │   │   ├── ai/
   │   │   └── game/
   │   └── db/
   └── package.json
└── frontend/       # React + Vite + Tailwind
    ├── public/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   └── services/
    └── package.json
```

## Testing

Run the test suite:

```bash
npm run test
```

## Technical Contracts

Implementation must follow the project's technical contracts and payload schemas: see [.github/instructions/technical-contracts.instructions.md](.github/instructions/technical-contracts.instructions.md).

## Contributing

- Fork the repo and create a feature branch: `feature/your-feature`
- Follow the commit message style (imperative, lowercase)
- Run tests and linters before opening a PR
- Open an issue to discuss larger changes first

## License

This project is released under the ISC License. See the `LICENSE` file for details.

---
