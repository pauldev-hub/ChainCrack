# ChainCrack Render Deployment - Quick Checklist

## Pre-Deployment ✓

- [ ] All code committed: `git add -A && git commit -m "..." && git push`
- [ ] `package.json` has `start:prod` script (already present)
- [ ] Backend serves frontend static files (already configured)
- [ ] `.env` files **not** committed (check `.gitignore`)

## During Deployment

1. **Create Render Web Service**
   - Website: https://render.com
   - Click: **New +** → **Web Service**
   - Connect GitHub repo: **ChainCrack**
   - Name: `chaincrack-backend`
   - Root Directory: (leave blank)
   - Runtime: **Node**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm --workspace=packages/backend start`
   - Plan: **Free** (or Starter/Standard for production)
   - Click: **Create Web Service**

2. **Wait for Build** (2–3 minutes)
   - Logs show: `listening on port 10000` ✓

3. **Add Environment Variables**
   
   Go to Render Dashboard → Your Service → **Environment**

   **Add these:**
   ```
   NODE_ENV = production
   PORT = 10000
   DATABASE_PATH = /tmp/gamestate.db
   AI_VALIDATION_TIMEOUT_MS = 10000
   ROOM_EXPIRY_MS = 300000
   ROOM_GAME_SECONDS = 90
   GROQ_MODEL = llama-3.1-8b-instant
   GROQ_FALLBACK_MODEL = llama-3.3-70b-versatile
   GEMINI_MODEL = gemini-2.0-flash
   LLAMA_MODEL = meta-llama/Llama-3.3-70b-Instruct-Turbo
   LLAMA_BASE_URL = https://api.together.xyz/v1
   ```

4. **Add API Keys** (these are secret)
   
   Get your Render URL first (e.g., `https://chaincrack-abc123.onrender.com`)
   
   ```
   CORS_ORIGINS = https://your-app-name.onrender.com  ← Use YOUR URL!
   GROQ_API_KEY = (get from https://console.groq.com)
   GEMINI_API_KEY = (get from https://ai.google.dev)
   LLAMA_API_KEY = (get from https://together.ai)
   ```

5. **Save & Redeploy**
   - Click **Save**
   - Render auto-redeploys with new env vars

## Post-Deployment ✓

- [ ] Visit your app URL (check Render dashboard for exact URL)
- [ ] Frontend loads without 404 errors
- [ ] No CORS errors in DevTools (F12 → Console)
- [ ] Can join a game
- [ ] Can submit words
- [ ] Scores update in real-time

## Troubleshooting Quick Fixes

| Problem | Fix |
|---------|-----|
| Frontend won't load (404) | Check `NODE_ENV=production` is set |
| CORS origin not allowed | Update `CORS_ORIGINS` to exact Render URL (with `https://`) |
| WebSocket fails | Restart service: Dashboard → Settings → **Restart Instance** |
| Build fails | Push `package-lock.json`: `git add package-lock.json && git push` |
| App works, then crashes | Check Logs tab for errors |

## Enable Auto-Deploy (Optional)

Already enabled by default! Every `git push` deploys automatically.

To disable:
- Render Dashboard → Your Service → Settings → Toggle **Auto-Deploy**

## That's It! 🎉

Your ChainCrack app is live on Render!

Next: Share your URL and invite friends to play!

---

**Full Guide:** See `RENDER_DEPLOYMENT.md`
