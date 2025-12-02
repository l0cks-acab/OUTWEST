# Deployment Guide

## Overview

This game requires **two separate deployments**:
1. **Frontend (Static Files)** - Hosted on Netlify, Vercel, or similar
2. **Backend (Node.js Server)** - Hosted on Heroku, Railway, Render, or similar

## Frontend Deployment (Netlify)

### Step 1: Build the Frontend

```bash
npm run build
```

This creates a `dist` folder with the static files.

### Step 2: Deploy to Netlify

1. Go to [Netlify](https://www.netlify.com/)
2. Drag and drop the `dist` folder, OR
3. Connect your Git repository and set build command: `npm run build`
4. Set publish directory: `dist`

### Step 3: Configure Environment Variable

In Netlify dashboard:
1. Go to Site settings → Environment variables
2. Add a new variable:
   - **Key**: `VITE_SERVER_URL`
   - **Value**: Your backend server URL (e.g., `https://your-app.herokuapp.com`)

**Important**: After adding the environment variable, you need to **rebuild and redeploy** your site for the change to take effect.

## Backend Deployment Options

### Option 1: Railway (Recommended - Easy Setup)

1. Go to [Railway](https://railway.app/)
2. Create a new project
3. Connect your Git repository or deploy from GitHub
4. Railway will auto-detect Node.js
5. **Important**: In Railway settings:
   - Go to your service → Settings → Deploy
   - Set **Build Command** to: `npm install --omit=dev` (or leave empty)
   - Set **Start Command** to: `node server.js`
   - This prevents Railway from trying to build the frontend
6. Railway will provide a URL like `https://your-app.railway.app`
7. Use this URL as your `VITE_SERVER_URL` in Netlify

**Note**: The `nixpacks.toml` file in the repo should automatically configure this, but you can also set it manually in Railway's UI.

### Option 2: Render

1. Go to [Render](https://render.com/)
2. Create a new Web Service
3. Connect your repository
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node
5. Render will provide a URL like `https://your-app.onrender.com`
6. Use this URL as your `VITE_SERVER_URL` in Netlify

### Option 3: Heroku

1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Create a `Procfile` in your project root:
   ```
   web: node server.js
   ```
3. Deploy:
   ```bash
   heroku create your-app-name
   git push heroku main
   ```
4. Heroku will provide a URL like `https://your-app.herokuapp.com`
5. Use this URL as your `VITE_SERVER_URL` in Netlify

### Option 4: Fly.io

1. Install [Fly CLI](https://fly.io/docs/getting-started/installing-flyctl/)
2. Create a `fly.toml`:
   ```toml
   app = "your-app-name"
   primary_region = "iad"

   [build]

   [http_service]
     internal_port = 3000
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 0
     processes = ["app"]

   [[vm]]
     cpu_kind = "shared"
     cpus = 1
     memory_mb = 256
   ```
3. Deploy:
   ```bash
   fly launch
   ```
4. Use the provided URL as your `VITE_SERVER_URL`

## Quick Setup Checklist

- [ ] Backend deployed and running
- [ ] Backend URL tested (should see Socket.io connection)
- [ ] Frontend built (`npm run build`)
- [ ] Frontend deployed to Netlify
- [ ] `VITE_SERVER_URL` environment variable set in Netlify
- [ ] Netlify site rebuilt after setting environment variable
- [ ] Test connection from deployed frontend

## Testing Your Deployment

1. Open your Netlify site
2. Check the connection indicator (should show "Connected" with green dot)
3. Try creating a lobby
4. Open the site in another browser/incognito window
5. Try joining the lobby from the second window
6. Test the game!

## Troubleshooting

### "Not connected to server" error
- Check that your backend server is running
- Verify `VITE_SERVER_URL` is set correctly in Netlify
- Make sure you rebuilt the Netlify site after setting the environment variable
- Check browser console for connection errors

### CORS errors
- The server already has CORS enabled for all origins
- If issues persist, check server logs

### Socket.io connection fails
- Verify the backend URL is accessible (try opening it in a browser)
- Check that the backend server is actually running
- Look at browser console and server logs for specific errors

## Environment Variables Reference

### Frontend (Netlify)
- `VITE_SERVER_URL` - Your backend server URL (required for production)

### Backend (Railway/Render/Heroku)
- `PORT` - Server port (usually auto-set by hosting provider)

## Notes

- The frontend uses Vite, which requires environment variables to be prefixed with `VITE_`
- After changing environment variables in Netlify, you must rebuild the site
- Free tiers on hosting platforms may have cold starts (first request takes longer)
- Consider using a service like [UptimeRobot](https://uptimerobot.com/) to keep free tier servers awake

