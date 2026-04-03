# ChainCrack Railway Deployment Guide

## Overview

Your ChainCrack app is now configured for deployment to Railway! This document summarizes all the changes made and provides the deployment steps.

## What Was Set Up

### Configuration Files Created

| File | Purpose |
|------|---------|
| `railway.json` | Railway platform config (nixpacks builder, start command) |
| `Procfile` | Process configuration (tells Railway how to start the app) |
| `.railway/nixpacks.toml` | Build instructions for nixpacks |
| `RAILWAY_DEPLOYMENT.md` | Detailed deployment guide |
| `RAILWAY_QUICKSTART.md` | Quick reference checklist |
| `railway-check.js` | Pre-deployment validation script |

### Code Changes

**Backend (`packages/backend/src/server.js`):**
- Added static file serving for frontend dist directory
- Configured SPA fallback for client-side routing
- Added `fileURLToPath` and `path` imports for proper file resolution

**Root `package.json`:**
- Added `start:prod` script: `npm --workspace=packages/frontend run build && npm --workspace=packages/backend start`
- This builds the frontend, then starts the backend to serve both

### Why This Architecture?

Railway is a **single-process** deployment, so the backend serves both:
1. The React frontend (static files from `dist/`)
2. The Express API (`/api` routes)
3. Socket.IO WebSocket server

---

## Quick Start (TL;DR)

### 1. Pre-flight Check
```bash
node railway-check.js
```
This validates your app is ready. Fix any issues before proceeding.

### 2. Deploy
```bash
git push origin main
```

Go to https://railway.app:
1. Click "New Project"
2. Select "Deploy from GitHub"
3. Choose `ChainCrack`
4. Wait for build to complete

### 3. Configure Environment
In Railway dashboard → Your Project → Variables, add:

```
PORT=3000
NODE_ENV=production
CORS_ORIGINS=https://your-app-url.railway.app
DATABASE_PATH=/tmp/gamestate.db

GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.1-8b-instant
GROQ_FALLBACK_MODEL=llama-3.3-70b-versatile

GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash

LLAMA_API_KEY=your_llama_key
LLAMA_BASE_URL=https://api.together.xyz/v1
LLAMA_MODEL=meta-llama/Llama-3.3-70b-Instruct-Turbo

AI_VALIDATION_TIMEOUT_MS=10000
ROOM_EXPIRY_MS=300000
ROOM_GAME_SECONDS=90
```

Get your Railway URL from the Settings tab and use it for `CORS_ORIGINS` and any frontend API calls.

### 4. Test
Visit `https://your-app-url.railway.app` and verify:
- ✓ Frontend loads
- ✓ No CORS errors (F12 DevTools)
- ✓ Can join a game
- ✓ Can submit words
- ✓ Scores update

---

## Environment Variables Explained

### Backend (Required)

| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | `3000` | Railway provides this; don't change |
| `NODE_ENV` | `production` | Enables optimizations, serves static frontend |
| `CORS_ORIGINS` | Your Railway URL | Must match exactly for frontend to work |
| `DATABASE_PATH` | `/tmp/gamestate.db` | `/tmp` is ephemeral; resets on redeploy |
| `GROQ_API_KEY` | Your API key | Get from https://console.groq.com |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Fast (~560 tps) |
| `GROQ_FALLBACK_MODEL` | `llama-3.3-70b-versatile` | Better quality (~280 tps) |
| `GEMINI_API_KEY` | Your API key | Get from https://ai.google.dev |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Fallback provider |
| `LLAMA_API_KEY` | Your API key | Get from https://together.ai |
| `LLAMA_BASE_URL` | `https://api.together.xyz/v1` | Together AI endpoint |
| `LLAMA_MODEL` | `meta-llama/Llama-3.3-70b-Instruct-Turbo` | Fallback provider |
| `AI_VALIDATION_TIMEOUT_MS` | `10000` | 10 second timeout for AI validation |
| `ROOM_EXPIRY_MS` | `300000` | 5 minute room expiry |
| `ROOM_GAME_SECONDS` | `90` | Game duration |

---

## Database Options

### Option 1: SQLite on Ephemeral Storage (Current Setup)
- ✓ No additional setup required
- ✗ Database resets when app restarts or redeploys
- **Use for:** Development, testing, or prototyping

### Option 2: Railway PostgreSQL Add-on
- ✓ Persistent data across redeploys
- ✗ Requires schema migration from SQLite
- **Use for:** Production

**To enable PostgreSQL:**
1. In Railway dashboard: Your Project → "Add Plugin"
2. Select "Database" → "PostgreSQL"
3. Railway auto-populates `DATABASE_URL` env var
4. Update backend to use `DATABASE_URL` instead of SQLite
5. Run migrations to create tables

### Option 3: Railway Volume Storage
- ✓ Persistent `/data` directory
- ✗ Slower than PostgreSQL
- **Use for:** Simple persistent storage

---

## Troubleshooting

### Build Fails
**Error:** `npm ERR! ERR! code ENOENT`

**Solution:**
- Ensure `package-lock.json` is committed: `git add package-lock.json && git push`
- Run `npm install` locally to regenerate lock file
- Check for local `.env` files leaking into package.json

### Frontend Shows 404
**Error:** `GET /api/... 404` in DevTools

**Solution:**
- Backend is serving index.html for unknown routes
- Check `CORS_ORIGINS` matches your Railway URL exactly
- Verify `NODE_ENV=production` is set

### Socket.IO Won't Connect
**Error:** `WebSocket connection failed` in DevTools console

**Solution:**
- Check `CORS_ORIGINS` includes your Railway domain
- Verify backend is running (check Railway Logs tab)
- Ensure WebSocket protocol is `wss://` (secure) in frontend:
  ```
  VITE_WS_URL=wss://your-app-url.railway.app
  ```

### Database Connection Errors
**Error:** `ENOENT: no such file or directory, open '/...gamestate.db'`

**Solution:**
- Check `DATABASE_PATH=/tmp/gamestate.db` is set
- `/tmp` is ephemeral—recreate DB schema on startup if needed
- For persistence, switch to PostgreSQL add-on

### CORS Origin Not Allowed
**Error:** `CORS origin not allowed` in browser console

**Solution:**
1. Get your Railway URL (e.g., `https://chaincrack-abc123.railway.app`)
2. Update `CORS_ORIGINS` to exact match (including protocol)
3. **Don't use `localhost`—Railway is cloud hosting**

---

## Monitoring & Logs

### View Logs in Railway Dashboard
1. Your Project → "Logs" tab
2. Real-time server output
3. Search for errors: `ERROR`, `Error:`, `Exception`

### Common Log Signals
| Log | Meaning |
|-----|---------|
| `listening on port 3000` | Backend started ✓ |
| `CORS origin not allowed` | Env var mismatch |
| `socket.io connected` | Client connected to WebSocket ✓ |
| `Cannot find module` | Missing dependency (redeploy) |
| `database is locked` | SQLite contention (use PostgreSQL) |

### Metrics Tab
Monitor:
- CPU usage (should be <50% idle)
- Memory (should stay stable)
- Request count/latency
- Restart count (should be 0)

---

## Going Further

### Enable Auto-Deploys
Every `git push` auto-deploys:
1. Railway Dashboard → Settings
2. Toggle "Automatic Deploys On"
3. Select branch: `main`

Done! Commits now deploy automatically.

### Add Custom Domain
1. Railway Dashboard → Settings → "Custom Domain"
2. Point your domain's DNS to Railway nameservers
3. Update `CORS_ORIGINS` with new domain

### Set Up Monitoring
- **Error tracking:** Install Sentry add-on for error alerts
- **Performance:** Enable Railway Metrics
- **Uptime:** Set up health check: `/health`

### Backups
For critical production data:
- Export PostgreSQL daily (use Railway backup features)
- Store backups in AWS S3 or Google Cloud Storage

---

## Files Reference

### Deployment Files
- `railway.json` — Platform configuration
- `Procfile` — Process definition
- `.railway/nixpacks.toml` — Build pipeline

### Documentation  
- `RAILWAY_QUICKSTART.md` — Quick checklist
- `RAILWAY_DEPLOYMENT.md` — Full detailed guide (this file)
- `railway-check.js` — Pre-flight validator

### Environment
- `packages/backend/.env.example` — Backend template
- `packages/frontend/.env.example` — Frontend template

---

## Support

### Railway Docs
- https://docs.railway.app/
- https://docs.railway.app/deploy-nodejs

### Debugging
1. Run `node railway-check.js` locally first
2. Check Railway Logs tab for errors
3. Verify all env vars in Railway dashboard exactly match
4. Test locally: `npm run dev` vs `npm run start:prod`

### Getting Help
- GitHub Issues in your repo
- Railway Discord: https://discord.gg/railway
- Stack Overflow: tag `railway.app`

---

## Summary

You're all set! Your ChainCrack app is configured for Railway deployment with:
- ✓ Automatic builds via `railway.json`
- ✓ Frontend + Backend served from single process
- ✓ Environment variable management
- ✓ Pre-flight validation script
- ✓ Comprehensive documentation

**Next step:** Run `node railway-check.js` to verify, then `git push` to deploy!
