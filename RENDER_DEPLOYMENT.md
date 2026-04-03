# ChainCrack Render Deployment Guide

## Overview

Your ChainCrack app is configured for deployment to **Render** — a modern cloud platform perfect for full-stack Node.js + React apps with WebSocket support.

## Architecture

- **Single Web Service:** Backend serves both Express API + Socket.IO + static React frontend
- **Database:** SQLite on ephemeral storage (resets on redeploy)
- **Frontend Build:** Compiled during deploy, served as static files from `/dist`

---

## Quick Start

### Step 1: Prepare Your Code

```bash
# Ensure everything is committed
git add -A
git commit -m "Setup for Render deployment"
git push origin main
```

### Step 2: Deploy to Render

1. Go to **https://render.com**
2. Sign up (GitHub login recommended)
3. Click **"New +"** → **"Web Service"**
4. Select **"Connect a repository"** → Choose your **ChainCrack** repo
5. Fill in deployment settings:
   - **Name:** `chaincrack-backend` (or your preferred name)
   - **Root Directory:** `.` (leave empty/blank)
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm --workspace=packages/backend start`
   - **Plan:** Free (or Starter for production)

6. Click **"Create Web Service"**

Render will start building. This takes 2–3 minutes.

### Step 3: Add Environment Variables

Once the service is created, go to the **Environment** tab and add:

#### Non-Secret Environment Variables
| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DATABASE_PATH` | `/tmp/gamestate.db` |
| `AI_VALIDATION_TIMEOUT_MS` | `10000` |
| `ROOM_EXPIRY_MS` | `300000` |
| `ROOM_GAME_SECONDS` | `90` |
| `GROQ_MODEL` | `llama-3.1-8b-instant` |
| `GROQ_FALLBACK_MODEL` | `llama-3.3-70b-versatile` |
| `GEMINI_MODEL` | `gemini-2.0-flash` |
| `LLAMA_MODEL` | `meta-llama/Llama-3.3-70b-Instruct-Turbo` |
| `LLAMA_BASE_URL` | `https://api.together.xyz/v1` |

#### Secret Environment Variables
Add these **after your app deploys** (you'll get the URL):

| Key | Value | From |
|-----|-------|------|
| `CORS_ORIGINS` | `https://your-app-name.onrender.com` | Your Render URL |
| `GROQ_API_KEY` | Your API key | https://console.groq.com |
| `GEMINI_API_KEY` | Your API key | https://ai.google.dev |
| `LLAMA_API_KEY` | Your API key | https://together.ai |

**Save & Deploy** after adding environment variables.

### Step 4: Test Your App

1. Get your app URL from the Render dashboard (e.g., `https://chaincrack-abc123.onrender.com`)
2. Visit the URL in your browser
3. Check DevTools (F12) for any CORS errors
4. Try joining a game and submitting a word

---

## Getting API Keys

### Groq (Primary AI Provider)
1. Go to **https://console.groq.com**
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new key
5. Copy and paste into Render `GROQ_API_KEY`

### Google Gemini (Fallback AI Provider)
1. Go to **https://ai.google.dev**
2. Click **Get Started** → **API Keys**
3. Create a new API key (for free tier)
4. Copy and paste into Render `GEMINI_API_KEY`

### Together AI / Llama (Fallback AI Provider)
1. Go to **https://together.ai**
2. Sign up with email or GitHub
3. Navigate to **API Keys**
4. Create a new key
5. Copy and paste into Render `LLAMA_API_KEY`

---

## Deployment Files

| File | Purpose |
|------|---------|
| `render.yaml` | Infrastructure configuration for Render |
| `RENDER_DEPLOYMENT.md` | This guide |
| `RENDER_QUICKSTART.md` | Quick checklist |
| `render-check.js` | Pre-deployment validator (optional) |

---

## Monitoring & Debugging

### View Logs
1. Render Dashboard → Your Service → **Logs** tab
2. Watch real-time output as your app runs

### Common Startup Logs
```
Starting service...
npm ERR! ...              → Build failed, check package.json
found 0 vulnerabilities  → OK ✓
listening on port 10000  → Backend started ✓
```

### Check App Status
- **Building:** Yellow circle
- **Live:** Green circle
- **Failed:** Red circle (check Logs tab)

---

## Troubleshooting

### CORS Errors in Browser
**Problem:** `CORS origin not allowed`

**Solution:**
1. Get your Render app URL (e.g., `https://chaincrack-abc123.onrender.com`)
2. Render Dashboard → Environment tab
3. Add/update `CORS_ORIGINS=https://your-app.onrender.com` (exact match, with `https://`)
4. Click **"Save"** → Render auto-redeploys

### Frontend Shows 404
**Problem:** App loads but pages are 404

**Solution:**
- The backend is serving `index.html` for all routes (correct for SPA)
- Check browser console (F12) for actual errors
- If no console errors, issue is elsewhere

### WebSocket Connection Fails
**Problem:** DevTools shows `WebSocket connection failed`

**Solution:**
1. Verify `CORS_ORIGINS` is set correctly (matches your Render URL exactly)
2. Check Render Logs tab for connection errors
3. Ensure firewall isn't blocking WebSocket protocol (`wss://`)

### Build Takes Too Long
**Problem:** Build timeout (> 30 minutes on Render free tier)

**Solution:**
- Free tier has limited build time
- If monorepo is large, upgrade to **Starter** or **Standard** plan
- Or split frontend/backend into separate services

### "address already in use" Error
**Problem:** Port conflict

**Solution:**
- `PORT` is already set to `10000` in `render.yaml`
- Check no other service is using this port
- If redeploy fails, wait 30 seconds and try again

---

## Database: Ephemeral vs. Persistent

### Current Setup: Ephemeral (SQLite `/tmp/`)
- ✓ No setup required
- ✗ **Data is lost when service restarts/redeploys**
- **Best for:** Development, testing, prototyping

### Persistent Option: Add PostgreSQL
To keep data across redeploys:

1. Render Dashboard → Your Project → **"Create"** → **"Database"**
2. Select **PostgreSQL**
3. Render auto-creates `DATABASE_URL` env var
4. Update backend to use PostgreSQL instead of SQLite
5. Run schema migrations

---

## Custom Domain (Optional)

1. Render Dashboard → Your Service → **Settings**
2. Navigate to **"Custom Domain"**
3. Enter your domain (e.g., `chaincrack.com`)
4. Render provides DNS records—add to your domain registrar
5. Update `CORS_ORIGINS` with your custom domain

---

## Auto-Deploy on Git Push

By default, Render auto-deploys when you push to your repo's main branch.

To disable/enable:
1. Render Dashboard → Your Service → **Settings**
2. Toggle **"Auto-Deploy"**

---

## Performance Tips

1. **Use Free Tier Wisely:**
   - Spins down after 15 minutes of inactivity
   - First request after spin-down takes ~30 seconds
   - Upgrade to Starter ($7/mo) for always-on

2. **Monitor Resource Usage:**
   - Render Dashboard → **Metrics** tab
   - Watch CPU, memory, disk usage

3. **Optimize Build:**
   - Keep dependencies minimal
   - Use `npm ci` instead of `npm install` (faster)
   - Cache dependencies (Render does this automatically)

---

## Next Steps

- ✅ Commit and push code
- ✅ Deploy via Render dashboard
- ✅ Add API keys to Environment
- ✅ Test your app
- ✅ Set custom domain (optional)
- ✅ Enable PostgreSQL for persistence (optional)

---

## Support

- **Render Docs:** https://docs.render.com/
- **Node.js Guide:** https://docs.render.com/deploy-node-express-app
- **WebSocket Guide:** https://docs.render.com/websockets

Happy deploying! 🚀
