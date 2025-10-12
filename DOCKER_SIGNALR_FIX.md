# Docker SignalR WebSocket Fix

## Problem
SignalR WebSocket connections were failing in Docker with error:
```
SignalR Connection Error: Failed to complete negotiation with the server: Error: <!DOCTYPE
```

This error occurred because the HTML error page was returned instead of the SignalR negotiation response.

## Root Causes

### 1. Backend Binding Issue
**Problem:** Backend was binding to `localhost:5000` which is too restrictive in containers
```yaml
ASPNETCORE_URLS=http://localhost:5000  # ❌ Only accessible on loopback
```

**Solution:** Bind to all interfaces
```yaml
ASPNETCORE_URLS=http://0.0.0.0:5000  # ✅ Accessible within container
```

### 2. Frontend Server Hostname
**Problem:** Frontend server was always using `localhost`
```javascript
const hostname = 'localhost'  // ❌ Doesn't work in Docker
```

**Solution:** Use `0.0.0.0` in production
```javascript
const hostname = dev ? 'localhost' : '0.0.0.0'  // ✅ Production-ready
```

### 3. Missing Files in Docker Image
**Problem:** Custom `server.js` and `node_modules` weren't copied to the runtime image

**Solution:** Explicitly copy required files in Dockerfile

---

## Changes Made

### 1. docker-compose.yml
**File:** `Plex/docker-compose.yml`

**Changed:**
```yaml
environment:
  - ASPNETCORE_URLS=http://0.0.0.0:5000  # Was: http://localhost:5000
  - SIGNALR_URL=http://127.0.0.1:5000    # Was: http://localhost:5000/hubs
  # Removed: API_URL (not needed with proxy)
```

**Why:**
- `0.0.0.0:5000` allows backend to accept connections from frontend within container
- `127.0.0.1:5000` is used by proxy to connect to backend (no /hubs suffix needed)

### 2. server.js
**File:** `mediaflick/server.js`

**Changed:**
```javascript
const hostname = dev ? 'localhost' : '0.0.0.0'
```

**Why:**
- Development: `localhost` for local testing
- Production: `0.0.0.0` to accept external connections in Docker

### 3. Dockerfile
**File:** `Dockerfile`

**Changed:**
```dockerfile
# Copy the built frontend app
COPY --from=frontend-build /mediaflick/.next/standalone ./
COPY --from=frontend-build /mediaflick/.next/static ./.next/static
COPY --from=frontend-build /mediaflick/server.js ./server.js         # ADDED
COPY --from=frontend-build /mediaflick/node_modules ./node_modules    # ADDED
```

**Why:**
- `server.js` contains the custom WebSocket proxy logic
- `node_modules` includes `http-proxy-middleware` dependency

---

## Architecture in Docker

### Container Layout
```
mediaflick:
  ┌─────────────────────────────────────────┐
  │  Node.js Custom Server (0.0.0.0:3000)   │  ← Exposed to host
  │           ↓ (proxy)                      │
  │  .NET Backend (0.0.0.0:5000)            │  ← Internal only
  └─────────────────────────────────────────┘
```

### Connection Flow
```
Browser (outside container)
  ↓
http://host-ip:3000/api/signalr/filetracking
  ↓
[Docker Port Mapping 3000:3000]
  ↓
Node.js Server (0.0.0.0:3000) in container
  ↓ [WebSocket Proxy]
.NET Backend (127.0.0.1:5000) in container
  ↓
SignalR Hub (/hubs/filetracking)
```

### Key Points
1. **Only port 3000 is exposed** to the host
2. **Backend (port 5000) stays internal** to the container
3. **All external traffic** goes through Next.js proxy
4. **WebSocket upgrades** are handled by custom server

---

## Rebuilding and Testing

### Step 1: Rebuild the Docker Image
```bash
cd /home/pho/mediaflick
docker-compose -f Plex/docker-compose.yml build mediaflick
```

### Step 2: Stop and Remove Old Container
```bash
docker-compose -f Plex/docker-compose.yml down mediaflick
```

### Step 3: Start New Container
```bash
docker-compose -f Plex/docker-compose.yml up -d mediaflick
```

### Step 4: Check Logs
```bash
# Watch container startup
docker-compose -f Plex/docker-compose.yml logs -f mediaflick

# Look for these success messages:
# ✅ "Starting both frontend and backend..."
# ✅ "> Ready on http://0.0.0.0:3000"
# ✅ "> SignalR proxy: /api/signalr/* → http://127.0.0.1:5000/hubs/*"
# ✅ "[INF] Starting PlexLocalScan API"
```

### Step 5: Test SignalR Connection
```bash
# From your host machine
curl http://localhost:3000/api/signalr/filetracking/negotiate

# Should return JSON with connectionId, not HTML error
```

### Step 6: Test in Browser
1. Open http://localhost:3000 (or your server IP)
2. Open DevTools → Network → WS
3. Look for WebSocket connection to `/api/signalr/filetracking`
4. Status should be `101 Switching Protocols`

---

## Troubleshooting

### Issue: "SignalR Connection Error: Failed to complete negotiation"

**Check 1:** Verify backend is running
```bash
docker exec -it mediaflick ps aux | grep dotnet
```

**Check 2:** Test backend directly (inside container)
```bash
docker exec -it mediaflick wget -O- http://127.0.0.1:5000/
```

**Check 3:** Check backend binding
```bash
docker exec -it mediaflick netstat -tuln | grep 5000
# Should show: 0.0.0.0:5000
```

### Issue: "Connection refused" or "ECONNREFUSED"

**Cause:** Backend not started or crashed

**Solution:**
```bash
# Check container logs for backend errors
docker-compose -f Plex/docker-compose.yml logs mediaflick | grep -A 5 "error"

# Check if backend process is alive
docker exec -it mediaflick ps aux | grep dotnet
```

### Issue: WebSocket shows "connection to localhost:5000"

**Cause:** Old browser cache or custom server not running

**Solution:**
```bash
# Verify custom server is being used
docker exec -it mediaflick ps aux | grep "node server.js"

# If not found, check start.sh is using server.js
docker exec -it mediaflick cat start.sh
```

---

## Environment Variables Reference

### Docker Compose Variables
```yaml
environment:
  # Backend Configuration
  - ASPNETCORE_ENVIRONMENT=Production
  - ASPNETCORE_URLS=http://0.0.0.0:5000        # Bind to all interfaces

  # Frontend Configuration
  - NODE_ENV=production

  # Proxy Configuration
  - SIGNALR_URL=http://127.0.0.1:5000          # Backend URL for proxy (no /hubs)

  # CORS Configuration
  - CORS_ORIGINS=http://localhost:3000         # Allow frontend origin

  # Port Configuration (optional, defaults to 3000)
  - PORT=3000
```

### Why These Values?
- `0.0.0.0`: Accept connections from any interface (required in Docker)
- `127.0.0.1`: Loopback for same-container connections (frontend → backend)
- `http://localhost:3000`: CORS origin from backend's perspective

---

## Security Notes

### Production Deployment
For production on a public server:

1. **Use HTTPS** with reverse proxy (nginx/Caddy)
   ```
   Internet → HTTPS (443) → Reverse Proxy → Container :3000
   ```

2. **Update CORS_ORIGINS** to your domain
   ```yaml
   - CORS_ORIGINS=https://your-domain.com
   ```

3. **Add authentication** to SignalR hub if needed

4. **Use secrets management** for sensitive configs

### Network Isolation
- Port 5000 (backend) is **NOT exposed** in docker-compose
- Only port 3000 (frontend) is accessible from host
- Backend is only reachable via internal container networking

---

## Summary

✅ **Fixed Issues:**
1. Backend now binds to `0.0.0.0:5000` (accessible within container)
2. Frontend server uses `0.0.0.0` in production
3. Custom `server.js` and dependencies copied to Docker image
4. SignalR proxy correctly configured for container environment

✅ **Security Maintained:**
- Backend not exposed to outside network
- All traffic proxied through Next.js
- CORS properly configured

✅ **Ready for Deployment:**
- Rebuild Docker image with changes
- Test WebSocket connection
- Deploy to production with HTTPS
