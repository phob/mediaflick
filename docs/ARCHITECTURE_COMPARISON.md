# SignalR Architecture: Before vs After

## BEFORE (VIOLATION) ❌

```
┌─────────────────────────────────┐
│  Browser                        │
│  http://localhost:3000          │
│                                 │
│  ┌───────────────────────────┐  │
│  │  SignalR Client           │  │
│  │  const SIGNALR_BASE =     │  │
│  │    'http://localhost:5000'│  │
│  │                           │  │
│  │  Uses: NEXT_PUBLIC_       │  │
│  │        SIGNALR_URL        │  │
│  └───────────┬───────────────┘  │
└──────────────┼──────────────────┘
               │
               │ DIRECT CONNECTION
               │ (Violates Proxy Architecture)
               │
               ▼
┌──────────────────────────────────┐
│  .NET Backend                    │
│  http://localhost:5000           │
│                                  │
│  /hubs/filetracking              │
│                                  │
│  CORS: Allows localhost:3000     │
│  (Less secure - backend exposed) │
└──────────────────────────────────┘
```

### Problems with This Approach:

1. **Backend URL Exposed**: Browser sees `http://localhost:5000` in:
   - Network requests
   - Environment variables (`NEXT_PUBLIC_SIGNALR_URL`)
   - Client-side code

2. **No Request Validation**: Requests bypass Next.js middleware

3. **CORS Complexity**: Backend must handle browser CORS preflight requests

4. **Production Risk**: Exposes internal backend architecture to clients

5. **Security Boundary Violated**: No server-side validation layer

---

## AFTER (CORRECT) ✅

```
┌─────────────────────────────────┐
│  Browser                        │
│  http://localhost:3000          │
│                                 │
│  ┌───────────────────────────┐  │
│  │  SignalR Client           │  │
│  │  const SIGNALR_BASE =     │  │
│  │    '/api/signalr'         │  │
│  │                           │  │
│  │  Relative URL - No        │  │
│  │  backend exposure         │  │
│  └───────────┬───────────────┘  │
└──────────────┼──────────────────┘
               │
               │ WebSocket: ws://localhost:3000/api/signalr/filetracking
               │
               ▼
┌──────────────────────────────────┐
│  Next.js Custom Server           │
│  http://localhost:3000           │
│  (server.js)                     │
│                                  │
│  ┌────────────────────────────┐  │
│  │  http-proxy-middleware     │  │
│  │                            │  │
│  │  Handles:                  │  │
│  │  • HTTP requests           │  │
│  │  • WebSocket upgrades      │  │
│  │  • Path rewriting          │  │
│  │    /api/signalr/* → /hubs/*│  │
│  │                            │  │
│  │  Server-side only:         │  │
│  │  SIGNALR_URL env var       │  │
│  └────────────┬───────────────┘  │
└───────────────┼──────────────────┘
                │
                │ PROXIED CONNECTION
                │ (Maintains Proxy Architecture)
                │
                ▼
┌──────────────────────────────────┐
│  .NET Backend                    │
│  http://localhost:5000           │
│  (Internal - Not exposed)        │
│                                  │
│  /hubs/filetracking              │
│                                  │
│  CORS: Only from Next.js server  │
│  (More secure)                   │
└──────────────────────────────────┘
```

### Benefits of This Approach:

1. **Backend URL Hidden**: Browser only sees:
   - Relative URL: `/api/signalr/filetracking`
   - Same origin: `localhost:3000`
   - No backend URL exposure

2. **Server-Side Validation**: All requests flow through Next.js:
   - Can add authentication middleware
   - Can log/monitor requests
   - Can rate limit

3. **Simplified CORS**: Backend only needs to trust Next.js origin

4. **Production Ready**: Internal backend URL never exposed

5. **Security Boundaries Maintained**: Clear separation of concerns

---

## Request Flow Comparison

### BEFORE (VIOLATION) ❌

```
1. Browser makes request
   │
   ├─→ REST API: fetch('http://localhost:5000/api/movies')
   │   Problem: Backend URL hardcoded
   │
   └─→ WebSocket: ws://localhost:5000/hubs/filetracking
       Problem: Direct connection to backend
```

### AFTER (CORRECT) ✅

```
1. Browser makes request
   │
   ├─→ REST API: fetch('/api/movies')
   │   ├─→ Next.js API Route: /app/api/movies/route.ts
   │   │   └─→ Proxies to: http://localhost:5000/api/movies
   │   │       (Backend URL server-side only)
   │
   └─→ WebSocket: ws://localhost:3000/api/signalr/filetracking
       ├─→ Custom Server: server.js
       │   └─→ Proxies to: ws://localhost:5000/hubs/filetracking
       │       (Backend URL server-side only)
```

---

## Environment Variables Comparison

### BEFORE (VIOLATION) ❌

```bash
# .env.local
NEXT_PUBLIC_SIGNALR_URL=http://localhost:5000/hubs
# Problem: NEXT_PUBLIC_ exposes to browser
```

**Result:** Backend URL visible in browser:
```javascript
// Browser can access:
process.env.NEXT_PUBLIC_SIGNALR_URL
// → "http://localhost:5000/hubs"
```

### AFTER (CORRECT) ✅

```bash
# .env.local
SIGNALR_URL=http://localhost:5000
# No NEXT_PUBLIC_ prefix - server-side only
```

**Result:** Backend URL hidden from browser:
```javascript
// Browser CANNOT access:
process.env.SIGNALR_URL  // → undefined

// Server-side (server.js) CAN access:
process.env.SIGNALR_URL  // → "http://localhost:5000"
```

---

## Code Changes Summary

### 1. Frontend Client (signalr.ts)

**BEFORE:**
```typescript
const SIGNALR_BASE = process.env.NEXT_PUBLIC_SIGNALR_URL || 'http://localhost:5000/hubs'

this.connection = new HubConnectionBuilder()
  .withUrl(`${SIGNALR_BASE}/filetracking`)
  // Connects to: http://localhost:5000/hubs/filetracking
```

**AFTER:**
```typescript
const SIGNALR_BASE = '/api/signalr'

this.connection = new HubConnectionBuilder()
  .withUrl(`${SIGNALR_BASE}/filetracking`)
  // Connects to: /api/signalr/filetracking (proxied)
```

### 2. Server Configuration

**BEFORE:**
```bash
# Used standard Next.js server
bun run dev  # → next dev --turbopack
# Cannot handle WebSocket upgrades
```

**AFTER:**
```bash
# Uses custom Node.js server
bun run dev  # → node server.js
# Handles WebSocket upgrades with http-proxy-middleware
```

### 3. API Routes

**BEFORE:**
```typescript
// app/api/signalr/[...path]/route.ts
export async function GET() {
  // Tried to proxy, but WebSocket upgrades don't work
  // in Next.js API routes (serverless-style functions)
}
```

**AFTER:**
```javascript
// server.js (custom Node.js server)
server.on('upgrade', (req, socket, head) => {
  // Properly handles WebSocket upgrade handshake
  signalrProxy.upgrade(req, socket, head)
})
```

---

## DevTools Verification

### What You See in Browser DevTools

**BEFORE (VIOLATION) ❌**

Network → WS tab:
```
Name: filetracking
URL: ws://localhost:5000/hubs/filetracking
Status: 101 Switching Protocols
```
⚠️ Connection goes directly to backend port 5000

**AFTER (CORRECT) ✅**

Network → WS tab:
```
Name: filetracking
URL: ws://localhost:3000/api/signalr/filetracking
Status: 101 Switching Protocols
```
✅ Connection goes through Next.js proxy on port 3000

---

## Security Implications

### BEFORE (VIOLATION) ❌

| Aspect | Issue |
|--------|-------|
| **Backend Discovery** | Attacker sees `http://localhost:5000` in network requests |
| **Port Scanning** | Backend port exposed to browser |
| **API Endpoints** | Can guess backend endpoints (e.g., `/api/*`, `/hubs/*`) |
| **CORS Bypass** | Could attempt CORS bypass attacks |
| **Man-in-the-Middle** | More attack surface (two separate origins) |

### AFTER (CORRECT) ✅

| Aspect | Protection |
|--------|------------|
| **Backend Discovery** | Backend URL never exposed to browser |
| **Port Scanning** | Only Next.js port (3000) visible |
| **API Endpoints** | Backend API surface hidden |
| **CORS Simplification** | Single-origin architecture |
| **Attack Surface** | Reduced - all traffic through Next.js layer |

---

## Production Deployment Comparison

### BEFORE (VIOLATION) ❌

```bash
# Production .env
NEXT_PUBLIC_SIGNALR_URL=https://api.example.com/hubs
# Problem: Exposes production backend URL to all clients
```

**Risk:** Anyone can:
1. See production backend URL in browser
2. Attempt direct connections
3. Bypass Next.js security middleware
4. Map backend infrastructure

### AFTER (CORRECT) ✅

```bash
# Production .env (server-side)
SIGNALR_URL=http://internal-backend:5000
# No exposure - internal network address hidden
```

**Security:** Clients cannot:
1. See backend URLs (only see `/api/signalr/*`)
2. Connect directly (CORS blocks non-proxy origins)
3. Bypass Next.js middleware
4. Map internal infrastructure

---

## Summary Table

| Characteristic | Before (❌) | After (✅) |
|----------------|------------|-----------|
| **Connection URL** | `ws://localhost:5000/hubs/filetracking` | `ws://localhost:3000/api/signalr/filetracking` |
| **Backend Exposure** | Visible in browser | Hidden (server-side only) |
| **Environment Vars** | `NEXT_PUBLIC_SIGNALR_URL` | `SIGNALR_URL` (no NEXT_PUBLIC_) |
| **Proxy Layer** | None (direct) | Next.js custom server |
| **WebSocket Handling** | Direct to backend | Proxied through http-proxy-middleware |
| **CORS Complexity** | Backend handles browser CORS | Simplified (backend trusts Next.js) |
| **Security Boundary** | Violated | Maintained |
| **Architecture Compliance** | ❌ Violated | ✅ Compliant |

---

## Quick Verification Commands

### Check Connection URL
```bash
# Open browser DevTools → Network → WS
# Look at WebSocket connection URL

# ❌ WRONG: ws://localhost:5000/...
# ✅ CORRECT: ws://localhost:3000/api/signalr/...
```

### Check Environment Variables
```javascript
// In browser console:
console.log(process.env.NEXT_PUBLIC_SIGNALR_URL)

// ❌ WRONG: If you see a URL, it's exposed
// ✅ CORRECT: Should be undefined
```

### Check Server Process
```bash
ps aux | grep server.js

# ✅ CORRECT: Should see "node server.js" running
# ❌ WRONG: If only "next dev" is running, WebSocket proxy won't work
```

---

## Migration Checklist

- [x] Remove `NEXT_PUBLIC_SIGNALR_URL` from environment
- [x] Update `signalr.ts` to use `/api/signalr`
- [x] Create `server.js` with WebSocket proxy
- [x] Update `package.json` dev script to use custom server
- [x] Add `http-proxy-middleware` dependency
- [x] Delete old API route `app/api/signalr/[...path]/route.ts`
- [x] Test WebSocket connection in browser DevTools
- [x] Verify connection URL is `localhost:3000/api/signalr/*`
- [x] Run verification script: `./verify-proxy-architecture.sh`

---

**Result:** All MediaFlick communication now flows through Next.js proxy layer, maintaining proper architectural boundaries and security.
