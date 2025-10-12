# SignalR Proxy Architecture Documentation

## Overview

MediaFlick implements a **strict proxy architecture** where all browser-to-backend communication flows through Next.js. This document explains the SignalR WebSocket proxy implementation and security boundaries.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (localhost:3000)                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  SignalR Client                                            │ │
│  │  Connection: /api/signalr/filetracking                     │ │
│  │  (WebSocket upgrade)                                       │ │
│  └───────────────────────┬────────────────────────────────────┘ │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             │ WebSocket Connection
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next.js Custom Server (server.js)                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  HTTP Proxy Middleware                                     │ │
│  │  - Proxies /api/signalr/* → backend /hubs/*               │ │
│  │  - Handles WebSocket upgrades                             │ │
│  │  - Server-side only (SIGNALR_URL env var)                 │ │
│  └───────────────────────┬────────────────────────────────────┘ │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             │ Proxied WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  .NET Backend (localhost:5000)                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  SignalR Hub: /hubs/filetracking                          │ │
│  │  CORS: Only allows http://localhost:3000                  │ │
│  │  (PlexLocalScan.SignalR/Hubs/ContextHub.cs)              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Security Boundaries

### ✅ CORRECT: Proxy Pattern
- **Frontend connects to:** `/api/signalr/filetracking`
- **Custom server proxies to:** `http://localhost:5000/hubs/filetracking`
- **Backend URL stored in:** Server-side `SIGNALR_URL` env var (NOT exposed to browser)
- **CORS protection:** Backend only accepts connections from Next.js origin

### ❌ PROHIBITED: Direct Connection
- **NEVER connect browser directly to:** `http://localhost:5000/hubs/filetracking`
- **NEVER use:** `NEXT_PUBLIC_SIGNALR_URL` environment variables
- **NEVER expose:** Backend URLs in client-side code

## Implementation Details

### 1. Custom Server Configuration

**File:** `/home/pho/mediaflick/mediaflick/server.js`

The custom server uses `http-proxy-middleware` to proxy both HTTP and WebSocket connections:

```javascript
// HTTP requests to /api/signalr/* are proxied
createProxyMiddleware({
  target: 'http://localhost:5000',
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  pathRewrite: {
    '^/api/signalr': '/hubs', // /api/signalr/filetracking → /hubs/filetracking
  },
})

// WebSocket upgrades are handled separately
server.on('upgrade', (req, socket, head) => {
  if (pathname.startsWith('/api/signalr')) {
    signalrProxy.upgrade(req, socket, head)
  }
})
```

### 2. Frontend SignalR Client

**File:** `/home/pho/mediaflick/mediaflick/src/lib/api/signalr.ts`

The client connects to the Next.js proxy endpoint:

```typescript
const SIGNALR_BASE = '/api/signalr' // Proxied through Next.js

this.connection = new HubConnectionBuilder()
  .withUrl(`${SIGNALR_BASE}/filetracking`)
  .withAutomaticReconnect()
  .build()
```

**Key Points:**
- Uses relative URL `/api/signalr` (not absolute URL)
- No environment variables needed on client side
- Automatically works in both development and production

### 3. Backend SignalR Hub

**File:** `/home/pho/mediaflick/src/PlexLocalScan.SignalR/Hubs/ContextHub.cs`

The hub is mapped at `/hubs/filetracking`:

```csharp
public class ContextHub : Hub<ISignalRHub>
{
    private const string HubRoute = "/hubs/filetracking";
    public static string Route => HubRoute;
}
```

**CORS Configuration:** `/home/pho/mediaflick/src/PlexLocalScan.Api/ServiceCollection/Cors.cs`

```csharp
var corsOrigins = configuration.GetValue<string>("CORS_ORIGINS")?.Split(',')
                  ?? ["http://localhost:3000"];

services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy
            .WithOrigins(corsOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials() // Required for SignalR
    )
);
```

## Development Setup

### 1. Install Dependencies

```bash
cd /home/pho/mediaflick/mediaflick
bun install
```

This will install `http-proxy-middleware` (added to package.json dependencies).

### 2. Environment Configuration

Create `.env.local` (optional - defaults work for local development):

```bash
# Backend SignalR URL (server-side only)
SIGNALR_URL=http://localhost:5000

# Next.js server port
PORT=3000
```

**Important:** Do NOT use `NEXT_PUBLIC_` prefix for backend URLs!

### 3. Start Development Environment

```bash
# Start both backend and frontend (recommended)
./startdev.sh

# Or start manually:
# Terminal 1 - Backend
cd src/PlexLocalScan.Api
dotnet run

# Terminal 2 - Frontend (uses custom server)
cd mediaflick
bun run dev
```

The `bun run dev` command now runs `node server.js` which starts the custom server with WebSocket proxying.

### 4. Verify Connection

1. Open browser to `http://localhost:3000`
2. Open DevTools → Network → WS (WebSocket)
3. Look for connection to `ws://localhost:3000/api/signalr/filetracking`
4. Verify status shows "Connected"

**You should see:**
- Connection URL: `ws://localhost:3000/api/signalr/filetracking`
- Status: 101 Switching Protocols

**You should NOT see:**
- Connection URL: `ws://localhost:5000/hubs/filetracking` (this would be a violation)

## Production Deployment

### 1. Build

```bash
cd mediaflick
bun run builddist
```

This creates:
- `.next/standalone` → copied to `dist/`
- `.next/static` → copied to `dist/.next/static`
- `public/` → copied to `dist/public`
- `server.js` → should be copied to `dist/`

### 2. Run Production Server

```bash
cd mediaflick
bun run start  # Runs: NODE_ENV=production node server.js
```

### 3. Production Environment Variables

```bash
# Backend URL (typically internal network or localhost)
SIGNALR_URL=http://localhost:5000

# Or if backend is on different host:
SIGNALR_URL=http://backend.internal:5000

# Port for Next.js
PORT=3000

# Backend CORS configuration
# Add to backend appsettings.Production.json or environment:
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## Troubleshooting

### Issue: WebSocket Connection Fails

**Symptoms:**
```
Error: WebSocket failed to connect. The connection could not be found on the server
```

**Causes & Solutions:**

1. **Using standard Next.js server instead of custom server**
   - Verify: `bun run dev` should start `node server.js`, not `next dev`
   - Check: `package.json` scripts should have `"dev": "node server.js"`

2. **Backend not running**
   - Verify: `curl http://localhost:5000/` should return "PlexLocalScan API is running"
   - Start: `dotnet run` from `src/PlexLocalScan.Api`

3. **CORS misconfiguration**
   - Check: Backend logs should show "Configuring CORS policy with origins: http://localhost:3000"
   - Fix: Set `CORS_ORIGINS=http://localhost:3000` in backend config

4. **Port conflicts**
   - Check: `lsof -i :3000` and `lsof -i :5000`
   - Fix: Kill conflicting processes or change ports

### Issue: Direct Backend Connection (Architecture Violation)

**Symptoms:**
- Browser DevTools shows WebSocket connection to `ws://localhost:5000`
- SignalR client uses `NEXT_PUBLIC_SIGNALR_URL`

**Solution:**
1. Remove any `NEXT_PUBLIC_SIGNALR_URL` from environment
2. Verify `signalr.ts` connects to `/api/signalr` (relative URL)
3. Ensure `bun run dev` starts custom server

### Issue: "http-proxy-middleware" Module Not Found

**Solution:**
```bash
cd mediaflick
bun install http-proxy-middleware
```

## Maintenance and Monitoring

### Logging

The custom server logs proxy activity:

```javascript
logLevel: dev ? 'debug' : 'warn'
```

In development, you'll see detailed proxy logs:
```
[HPM] Proxy created: /api/signalr  ->  http://localhost:5000/hubs
[HPM] Rewriting path from "/api/signalr/filetracking" to "/hubs/filetracking"
[HPM] WebSocket upgrade on /api/signalr/filetracking
```

### Backend Logs

Check SignalR connection logs:
```
[Information] SignalR connection established: <ConnectionId>
[Information] Client connected to ContextHub
```

## Alternative Solution: Direct Connection with Enhanced Security

If the custom server approach is too complex for your use case, you can use **Solution 2: Enhanced Direct Connection**:

### Requirements
- Backend CORS must be strictly configured
- Use HTTPS in production
- Monitor and audit connection sources

### Implementation

1. **Keep direct connection in `signalr.ts`:**
```typescript
const SIGNALR_BASE = process.env.NEXT_PUBLIC_SIGNALR_URL || 'http://localhost:5000/hubs'
```

2. **Strengthen backend CORS:**
```csharp
// Only allow specific origins, never use "*"
.WithOrigins("http://localhost:3000", "https://yourdomain.com")
.AllowCredentials() // Prevents wildcard origins
```

3. **Add security headers in backend:**
```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers.Add("X-Frame-Options", "DENY");
    context.Response.Headers.Add("X-Content-Type-Options", "nosniff");
    await next();
});
```

4. **Document the architectural decision:**
   - This is an exception due to SignalR WebSocket complexity
   - CORS provides security boundary
   - Only applicable for internal/local deployments

**Trade-offs:**
- ✅ Simpler deployment (no custom server)
- ✅ Works with serverless Next.js deployments
- ❌ Exposes backend URL to browser
- ❌ Requires careful CORS configuration
- ❌ Not suitable for public-facing applications

**Recommendation:** Use the custom server solution (Solution 1) for production deployments to maintain strict architectural boundaries.

## Security Checklist

Before deploying to production:

- [ ] Verify `bun run dev` starts custom server (not `next dev`)
- [ ] Confirm SignalR client connects to `/api/signalr/*` (not `http://localhost:5000`)
- [ ] Ensure no `NEXT_PUBLIC_SIGNALR_URL` environment variables exist
- [ ] Backend CORS only allows Next.js origin
- [ ] WebSocket connections show `ws://localhost:3000/api/signalr/*` in DevTools
- [ ] Backend URL is server-side only (`SIGNALR_URL` without `NEXT_PUBLIC_` prefix)
- [ ] Production CORS includes production domain
- [ ] HTTPS enabled for production WebSockets (`wss://`)

## References

- SignalR Client: `/home/pho/mediaflick/mediaflick/src/lib/api/signalr.ts`
- Custom Server: `/home/pho/mediaflick/mediaflick/server.js`
- Backend Hub: `/home/pho/mediaflick/src/PlexLocalScan.SignalR/Hubs/ContextHub.cs`
- CORS Config: `/home/pho/mediaflick/src/PlexLocalScan.Api/ServiceCollection/Cors.cs`
- Package Config: `/home/pho/mediaflick/mediaflick/package.json`

## Support

If you encounter issues:

1. Check DevTools → Network → WS for WebSocket connection details
2. Review backend logs for CORS and SignalR connection messages
3. Verify custom server is running: `ps aux | grep "node server.js"`
4. Test backend directly: `curl http://localhost:5000/`
5. Consult this document's troubleshooting section

**Remember:** All browser-to-backend communication MUST flow through Next.js. No exceptions.
