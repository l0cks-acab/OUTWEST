# Netlify Setup Guide

## Step 1: Get Your Railway Server URL

1. Go to your Railway project dashboard
2. Click on your deployed service
3. Go to the **Settings** tab
4. Find the **Domains** section
5. Copy your Railway URL (e.g., `https://your-app.railway.app`)

**OR** if Railway generated a default domain, you can find it in the **Deployments** tab - it will be shown after a successful deployment.

## Step 2: Configure Netlify Environment Variable

1. Go to your Netlify dashboard: https://app.netlify.com
2. Select your site
3. Go to **Site settings** (gear icon in the top navigation)
4. Click on **Environment variables** in the left sidebar
5. Click **Add a variable**
6. Add:
   - **Key**: `VITE_SERVER_URL`
   - **Value**: Your Railway URL (e.g., `https://your-app.railway.app`)
   - **Scopes**: Select "All scopes" or "Production"
7. Click **Save**

## Step 3: Rebuild Your Netlify Site

**IMPORTANT**: After adding the environment variable, you MUST rebuild your site for it to take effect.

1. In Netlify, go to **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**
3. Wait for the build to complete

**OR** if you're using Git integration:
- Make a small change and push to your repository (Netlify will auto-deploy)
- Or manually trigger a redeploy from the Deploys tab

## Step 4: Test the Connection

1. Open your Netlify site URL
2. Look at the connection indicator at the top of the start screen
3. It should show:
   - **Green dot** with "Connected" ✅
   - If it shows red "Disconnected", check the browser console for errors

## Step 5: Test the Game

1. Enter your name
2. Click **CREATE LOBBY** - it should work now!
3. Open the site in another browser/incognito window
4. Join the lobby from the second window
5. Both players click **READY**
6. Game should start!

## Troubleshooting

### Still shows "Disconnected"
- Check that you rebuilt Netlify after adding the environment variable
- Verify the Railway URL is correct (no trailing slash)
- Check browser console (F12) for connection errors
- Make sure Railway service is running (check Railway dashboard)

### CORS Errors
- The server already has CORS enabled, but if you see errors:
  - Check Railway logs for any errors
  - Verify the server is actually running

### Can't create/join lobby
- Make sure the connection indicator shows "Connected"
- Check browser console for any error messages
- Verify both Railway and Netlify deployments are successful

## Quick Checklist

- [ ] Railway server deployed and running
- [ ] Railway URL copied
- [ ] `VITE_SERVER_URL` environment variable added to Netlify
- [ ] Netlify site rebuilt after adding environment variable
- [ ] Connection indicator shows "Connected" (green)
- [ ] Can create a lobby
- [ ] Can join a lobby from another browser

You're all set! 🎮

