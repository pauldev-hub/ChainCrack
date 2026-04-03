# Railway Deployment Guide for ChainCrack

## Prerequisites
- Railway account (https://railway.app)
- Git repository initialized and pushed to GitHub
- All environment variables documented

## Step 1: Prepare Your App for Production

### Update Backend for Production
Edit `packages/backend/src/server.js` to handle database path properly on Railway:

```javascript
// Use /tmp for database on Railway (ephemeral storage)
const dbPath = process.env.DATABASE_PATH || (
  process.env.NODE_ENV === 'production' 
    ? '/tmp/gamestate.db' 
    : './gamestate.db'
);
```

### Ensure Frontend Build Outputs to Dist
The frontend Vite build already outputs to `dist/`. Railway will serve it.

## Step 2: Create Railway Project

1. Go to https://railway.app and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub"**
4. Authorize Railway to access your GitHub
5. Select your `ChainCrack` repository
6. Click **"Deploy"**

Railway will automatically detect:
- Node.js app
- Use the `Procfile` and `railway.json` for build/start commands

## Step 3: Configure Environment Variables

In Railway dashboard, go to your project → **Variables** and add:

```
PORT=3000
NODE_ENV=production
CORS_ORIGINS=https://your-railway-app.up.railway.app

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

> **Note:** Railway will provide your app URL. Replace `https://your-railway-app.up.railway.app` with the actual URL.

## Step 4: Handle Database Persistence

SQLite on Railway's ephemeral storage is reset on redeploy. For persistent data:

### Option A: Use Railway PostgreSQL Add-on (Recommended)
1. In project dashboard, click **"Add Service"** → **"Database"** → **"PostgreSQL"**
2. Railway auto-populates `DATABASE_URL`
3. Migrate your SQLite schema to PostgreSQL

### Option B: Keep SQLite on Ephemeral Storage
- Database resets on redeploy
- Good for development/testing
- Current setup will work as-is

### Option C: Use Railway Volume Storage
1. Add a volume mount in Railway dashboard
2. Point `DATABASE_PATH` to `/data/gamestate.db`
3. Volume persists across redeploys

## Step 5: Configure Frontend URL

Edit `packages/frontend/.env.production`:
```
VITE_API_URL=https://your-railway-app.up.railway.app
VITE_WS_URL=wss://your-railway-app.up.railway.app
```

Add this file to version control (it's safe—no secrets here).

## Step 6: Deploy

Option A: **Automatic** (GitHub Integration)
- Every push to `main` auto-deploys
- No manual steps needed

Option B: **Manual CLI**
```bash
npm install -g @railway/cli
railway login
railway link  # Link to your Railway project
railway up
```

## Step 7: Monitor & Debug

In Railway dashboard:
- **Deployments** tab: View build/start logs
- **Logs** tab: Real-time server output
- **Metrics** tab: CPU, memory, requests

### Common Errors

| Error | Solution |
|-------|----------|
| `PORT not listening` | Ensure backend listens on `process.env.PORT` |
| `Frontend can't reach backend` | Update `CORS_ORIGINS` in env vars |
| `Socket.IO connection fails` | Check `VITE_WS_URL` matches Railway domain |
| `Module not found` | Run `npm install` locally, commit `package-lock.json` |

## Step 8: Custom Domain (Optional)

1. In Railway project → **Settings** → **Custom Domain**
2. Add your domain (e.g., `chaincrack.com`)
3. Update DNS records as Railway instructs
4. Update `CORS_ORIGINS` env var with new domain

## Troubleshooting

### Database Path Issues
Railway doesn't have a persistent `./` like local development. Always use absolute paths or `/tmp`:
```javascript
const dbPath = process.env.DATABASE_PATH || '/tmp/gamestate.db';
```

### Frontend Not Serving
Ensure `packages/frontend/vite.config.js` has:
```javascript
export default defineConfig({
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': 'http://localhost:5000'
    }
  }
});
```

### Socket.IO CORS Issues
Add to backend:
```javascript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    credentials: true
  }
});
```

## Success Indicators

✅ Deployment succeeds in Railway dashboard
✅ Frontend loads at `https://your-railway-app.up.railway.app`
✅ Socket.IO connects (check browser DevTools → Network)
✅ Game works: join → submit word → scores update
✅ No CORS errors in browser console

## Next Steps

- Set up CI/CD for tests before deploy
- Configure error tracking (Sentry integration available)
- Enable Railway health checks
- Set up auto-scaling if needed
