# Railway Deployment Checklist

## Pre-Deployment (Local)

- [ ] All code committed to GitHub (`git status` shows nothing)
- [ ] Environment variables documented in `packages/backend/.env.example`
- [ ] Frontend builds successfully: `npm --workspace=packages/frontend run build`
- [ ] Backend starts successfully: `npm --workspace=packages/backend start`
- [ ] Tests pass (if any): `npm run test`

## Railway Setup (5 minutes)

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub"
   - Authorize Railway
   - Select `ChainCrack` repository
   - Click "Deploy"

3. **Wait for Build**
   - Railway automatically detects Node.js app
   - Reads `Procfile` and `railway.json`
   - Build takes ~2-3 minutes
   - Check Deployments tab for logs

## Post-Build Configuration

1. **Set Environment Variables**
   - In Railway dashboard: Your Project → Variables
   - Add all variables from `packages/backend/.env.example`:
     ```
     PORT=3000
     NODE_ENV=production
     CORS_ORIGINS=https://your-app-url.railway.app
     DATABASE_PATH=/tmp/gamestate.db
     GROQ_API_KEY=your_key
     GROQ_MODEL=llama-3.1-8b-instant
     GROQ_FALLBACK_MODEL=llama-3.3-70b-versatile
     GEMINI_API_KEY=your_key
     GEMINI_MODEL=gemini-2.0-flash
     LLAMA_API_KEY=your_key
     LLAMA_BASE_URL=https://api.together.xyz/v1
     LLAMA_MODEL=meta-llama/Llama-3.3-70b-Instruct-Turbo
     AI_VALIDATION_TIMEOUT_MS=10000
     ROOM_EXPIRY_MS=300000
     ROOM_GAME_SECONDS=90
     ```

2. **Get Your App URL**
   - In Settings tab, find "Public URL" (e.g., `https://chaincrack-prod.railway.app`)
   - Update `CORS_ORIGINS` to match this URL
   - Note this URL—you'll need it for testing

## Verification

- [ ] App loads at `https://your-app-url.railway.app`
- [ ] No CORS errors in browser console (F12)
- [ ] Game UI displays correctly
- [ ] Socket.IO connects (check Network tab in DevTools)
- [ ] Can join game and submit words
- [ ] Scores update in real-time

## Troubleshooting

**App fails to build:**
- Check build logs in Deployments tab
- Ensure `npm run build` works locally
- Verify all dependencies in `package-lock.json` are committed

**Frontend shows 404:**
- Verify `packages/frontend/dist/index.html` exists locally
- Check backend is serving static files in production mode
- Set `NODE_ENV=production` in Railway variables

**Socket.IO fails to connect:**
- Check `CORS_ORIGINS` matches your Railway URL exactly
- Ensure backend is running (check Logs tab)
- Verify WebSocket is enabled (should be by default)

**Database errors:**
- SQLite on `/tmp/` resets on redeploys (expected)
- For persistent DB, add Railway PostgreSQL add-on
- Check database path in logs

## Enable Auto-Deploys (Optional)

In Railway dashboard: Settings → GitHub Integration:
- ✓ "Deploy on push to main"
- ✓ "Automatic deploys"

Now every `git push` auto-deploys the app!

---

See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) for detailed documentation.
