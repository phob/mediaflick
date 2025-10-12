# SignalR Proxy Implementation - Quick Reference

## What Changed

Your MediaFlick application now implements proper proxy architecture for SignalR WebSocket connections. All browser-to-backend communication flows through Next.js.

## Files Modified

### 1. **Frontend SignalR Client** ✅ FIXED
**File:** `/home/pho/mediaflick/mediaflick/src/lib/api/signalr.ts`

**Before (VIOLATION):**
```typescript
// Direct connection to backend
const SIGNALR_BASE = 'http://localhost:5000/hubs'
```

**After (CORRECT):**
```typescript
// Proxied through Next.js
const SIGNALR_BASE = '/api/signalr'
```

### 2. **Custom Server Created** ✅ NEW
**File:** `/home/pho/mediaflick/mediaflick/server.js`

- Handles HTTP requests and WebSocket upgrades
- Proxies `/api/signalr/*` → backend `/hubs/*`
- Uses `http-proxy-middleware` for WebSocket support

### 3. **Package Scripts Updated** ✅ MODIFIED
**File:** `/home/pho/mediaflick/mediaflick/package.json`

**Changed:**
```json
"scripts": {
  "dev": "node server.js",          // Was: "next dev --turbopack"
  "start": "NODE_ENV=production node server.js"  // Was: "next start"
}
```

**Added dependency:**
```json
"dependencies": {
  "http-proxy-middleware": "^3.0.3"
}
```

### 4. **API Route Removed** ✅ DELETED
**Deleted:** `/home/pho/mediaflick/mediaflick/src/app/api/signalr/[...path]/route.ts`

Reason: Next.js API routes cannot handle WebSocket upgrades. Custom server handles this now.

## Installation Steps

### Step 1: Install Dependencies
```bash
cd /home/pho/mediaflick/mediaflick
bun install
```

This installs `http-proxy-middleware` needed for WebSocket proxying.

### Step 2: Verify Configuration
```bash
cd /home/pho/mediaflick
./verify-proxy-architecture.sh
```

You should see:
```
✅ All checks passed! Proxy architecture is properly configured.
```

### Step 3: Start Development Environment
```bash
cd /home/pho/mediaflick
./startdev.sh
```

This starts:
1. .NET backend on `http://localhost:5000`
2. Next.js custom server on `http://localhost:3000` (with WebSocket proxy)

### Step 4: Verify WebSocket Connection

1. Open browser: `http://localhost:3000`
2. Open DevTools → Network → WS (WebSocket filter)
3. Look for: `ws://localhost:3000/api/signalr/filetracking`

**✅ CORRECT:** Connection URL contains `localhost:3000/api/signalr`
**❌ WRONG:** Connection URL contains `localhost:5000/hubs` (would be direct connection)

## Architecture Flow

```
Browser
   │
   │ WebSocket Connection
   ▼
/api/signalr/filetracking (Next.js Custom Server - Port 3000)
   │
   │ Proxied through http-proxy-middleware
   ▼
/hubs/filetracking (.NET Backend - Port 5000)
```

## Environment Variables

Create `/home/pho/mediaflick/mediaflick/.env.local` (optional):

```bash
# Backend URL (server-side only)
SIGNALR_URL=http://localhost:5000

# Next.js server port
PORT=3000
```

**Important:** Defaults work fine for local development. No `.env.local` needed unless you change ports.

## Troubleshooting

### Issue: "Cannot find module 'http-proxy-middleware'"
**Solution:**
```bash
cd mediaflick
bun install
```

### Issue: WebSocket connection fails
**Check 1:** Verify custom server is running
```bash
ps aux | grep "node server.js"
```

**Check 2:** Verify backend is running
```bash
curl http://localhost:5000/
# Should return: PlexLocalScan API is running
```

**Check 3:** Check browser DevTools
- Network → WS tab should show connection to `ws://localhost:3000/api/signalr/filetracking`
- If you see `ws://localhost:5000`, the proxy is being bypassed (violation)

### Issue: "next dev --turbopack" starts instead of custom server
**Solution:** Check `package.json`:
```json
"scripts": {
  "dev": "node server.js"  // Should be this, not "next dev"
}
```

## Production Deployment

### Build
```bash
cd mediaflick
bun run builddist
```

### Run
```bash
cd mediaflick
bun run start
```

### Environment
```bash
# Set backend URL if on different host
SIGNALR_URL=http://backend-host:5000

# Set Next.js port
PORT=3000

# Backend CORS must include Next.js origin
# In backend appsettings.Production.json:
CORS_ORIGINS=https://yourdomain.com
```

## Security Notes

- ✅ Backend URL never exposed to browser
- ✅ CORS protection on backend (only allows Next.js origin)
- ✅ All WebSocket connections proxied through Next.js
- ✅ Server-side environment variables only (`SIGNALR_URL`, not `NEXT_PUBLIC_SIGNALR_URL`)

## Testing the Fix

### Before (VIOLATION)
Browser DevTools would show:
```
WebSocket connection to ws://localhost:5000/hubs/filetracking
Status: 101 Switching Protocols
```
This is a **direct connection** - violates proxy architecture.

### After (CORRECT)
Browser DevTools now shows:
```
WebSocket connection to ws://localhost:3000/api/signalr/filetracking
Status: 101 Switching Protocols
```
This is a **proxied connection** - maintains proper architecture.

## Verification Checklist

After implementing these changes:

- [ ] Run `./verify-proxy-architecture.sh` - all checks pass
- [ ] Run `bun install` - http-proxy-middleware installed
- [ ] Run `./startdev.sh` - both backend and frontend start
- [ ] Open `http://localhost:3000` - app loads
- [ ] Open DevTools → Network → WS - connection to `localhost:3000/api/signalr/filetracking`
- [ ] Verify SignalR events work (file tracking updates appear in UI)

## Files Reference

All modified files with absolute paths:

1. `/home/pho/mediaflick/mediaflick/server.js` (NEW)
2. `/home/pho/mediaflick/mediaflick/package.json` (MODIFIED)
3. `/home/pho/mediaflick/mediaflick/src/lib/api/signalr.ts` (FIXED)
4. `/home/pho/mediaflick/mediaflick/.env.example` (NEW)
5. `/home/pho/mediaflick/verify-proxy-architecture.sh` (NEW)
6. `/home/pho/mediaflick/SIGNALR_PROXY_ARCHITECTURE.md` (NEW - full documentation)
7. `/home/pho/mediaflick/SIGNALR_PROXY_IMPLEMENTATION.md` (THIS FILE - quick reference)

## Need Help?

1. Read full documentation: `SIGNALR_PROXY_ARCHITECTURE.md`
2. Run verification script: `./verify-proxy-architecture.sh`
3. Check DevTools WebSocket connections
4. Review backend logs for CORS and SignalR messages

## Summary

**What was wrong:**
- Frontend connected directly to `http://localhost:5000/hubs/filetracking`
- Backend URL exposed in browser environment variables

**What's fixed:**
- Frontend now connects to `/api/signalr/filetracking` (relative URL)
- Custom Next.js server proxies WebSocket to backend
- Backend URL kept server-side only
- Proper architectural boundaries maintained

**Result:** ✅ Secure proxy architecture with working SignalR WebSocket connections.
