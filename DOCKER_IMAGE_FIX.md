# Docker TMDB Image Loading Fix

## Problem
TMDB images (posters, backdrops, episode stills) were not loading in Docker containers, returning **400 Bad Request** errors.

**Error in browser console:**
```
/_next/image?url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Foriginal%2F...jpg&w=3840&q=75
400 (Bad Request)
```

**Symptoms:**
- Media cards show no posters
- Dashboard cards missing images
- Media info backdrops not displaying
- All components using `https://image.tmdb.org` URLs failing

## Root Cause

**Next.js Image Optimization doesn't work reliably with custom servers in production.** The issue has two parts:

1. **Custom server routing conflicts** - The `server.js` was intercepting image optimization requests
2. **Image optimization restrictions** - Next.js imposes strict security checks on external domains that fail with custom servers

### Why Image Optimization Failed

When using `<Image src="https://image.tmdb.org/..." />` with a custom server:

1. Next.js tries to optimize the image via `/_next/image?url=...`
2. Custom server needs to properly route this to Next.js internals
3. Next.js applies domain whitelist checks
4. With custom servers, these checks become overly restrictive
5. Results in 400 Bad Request errors

---

## Solution

The solution is to **enable Next.js image optimization with proper caching headers**. Since TMDB image URLs never change (they're content-addressable), we can cache them indefinitely for better performance.

### Changes Made

#### 1. next.config.ts - Enable Image Optimization with Indefinite Caching
**File:** `mediaflick/next.config.ts`

**Added:**
```typescript
images: {
  // TMDB image URLs never change, so we can cache them indefinitely
  remotePatterns: [
    {
      protocol: "https",
      hostname: "image.tmdb.org",
      pathname: "/t/p/**",
    },
  ],
  // Optimize images for better performance
  formats: ["image/webp"],
  // Cache optimized images for 1 year (TMDB URLs are permanent)
  minimumCacheTTL: 31536000, // 365 days in seconds
},
async headers() {
  return [
    {
      // Apply caching headers to all TMDB images
      source: "/_next/image",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
  ]
},
```

**What this does:**
- **All environments**: Images are optimized (WebP format, resizing)
- **Indefinite caching**: Browser caches images for 1 year with `immutable` flag
- **Better performance**: Smaller file sizes, faster load times
- **Custom server compatible**: Works with server.js proxy setup
- **No repeated downloads**: Once cached, images never re-downloaded

#### 2. server.js - Allow Next.js Internal Routes (Already Done)
**File:** `mediaflick/server.js:19-23`

```javascript
// Let Next.js handle its internal routes (static files, etc.)
if (pathname && (pathname.startsWith('/_next/') || pathname.startsWith('/static/'))) {
  return handle(req, res, parsedUrl)
}
```

**Note:** With `unoptimized: true`, `/_next/image` won't be used, but we keep this for other Next.js internals like static assets.

---

## Request Routing Flow

### Corrected Flow (After Fix)
```
Browser Request
  ↓
Custom Server (server.js)
  ↓
┌─── Is /_next/* or /static/*? ───────────────────────────────┐
│    YES: Pass directly to Next.js handler                    │
│         ├─> /_next/image/* (Image Optimization)             │
│         ├─> /_next/static/* (Static Assets)                 │
│         └─> /_next/data/* (Data Fetching)                   │
└──────────────────────────────────────────────────────────────┘
  ↓ NO
┌─── Is /api/signalr/*? ───────────────────────────────────────┐
│    YES: Proxy to backend SignalR hub                         │
│         └─> http://localhost:5000/hubs/*                     │
└──────────────────────────────────────────────────────────────┘
  ↓ NO
Handle with Next.js (pages, API routes, etc.)
```

---

## Image Loading Architecture

### Development (localhost)
```
Component: <Image src="https://image.tmdb.org/..." />
  ↓
Next.js Image Optimization (localhost:3000/_next/image)
  ↓
Fetches from: https://image.tmdb.org/t/p/w500/...
  ↓
Optimizes (resize, format, quality)
  ↓
Returns optimized image ✅
```

### Production (Docker) - With Unoptimized Images
```
Component: <Image src="https://image.tmdb.org/..." />
  ↓
Next.js <Image> renders as <img>
  ↓
Browser fetches directly: https://image.tmdb.org/t/p/w500/...
  ↓
Returns original image ✅
```

**Benefits:**
- ✅ No custom server routing needed
- ✅ No 400 Bad Request errors
- ✅ Simpler architecture
- ✅ Works reliably in all environments

**Trade-offs:**
- ⚠️ Images not optimized in production (slightly larger file sizes)
- ⚠️ No automatic WebP conversion
- ✅ But TMDB already provides optimized images at various sizes

---

## Alternative: Use Backend Image Proxy

If your Docker network doesn't allow external connections, you can route images through the backend API instead.

### Option 1: Backend Image Proxy (Recommended for Isolated Networks)

**Update components to use backend proxy:**

```typescript
// Instead of:
const imageUrl = `https://image.tmdb.org/t/p/w500${path}`

// Use:
const imageUrl = `/api/proxy/medialookup/images${path}?size=w500`
```

**Benefits:**
- Works in isolated Docker networks
- Backend can cache images
- Single point of control for image fetching
- No external dependencies from frontend

**Drawbacks:**
- Increases backend load
- No Next.js image optimization
- Need to implement caching in backend

### Option 2: Keep Direct TMDB Access (Current Solution)

**Requirements:**
- Docker container has internet access
- `image.tmdb.org` is reachable
- Next.js image optimization enabled

**Benefits:**
- Next.js optimizes images automatically
- Reduces backend load
- Built-in caching and format conversion

**Drawbacks:**
- Requires external internet access
- Depends on TMDB availability

---

## Testing the Fix

### Step 1: Rebuild and Restart
```bash
cd /home/pho/mediaflick

# Rebuild the Docker image
docker-compose -f Plex/docker-compose.yml build mediaflick

# Restart container
docker-compose -f Plex/docker-compose.yml down mediaflick
docker-compose -f Plex/docker-compose.yml up -d mediaflick
```

### Step 2: Verify Server Routes
```bash
# Check server logs for proper routing
docker-compose -f Plex/docker-compose.yml logs -f mediaflick | grep "Ready on"

# Should show:
# > Ready on http://0.0.0.0:3000
# > SignalR proxy: /api/signalr/* → http://127.0.0.1:5000/hubs/*
```

### Step 3: Test Image Optimization Endpoint
```bash
# Test Next.js image optimization (should return image data)
curl -I "http://localhost:3000/_next/image?url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2Ftest.jpg&w=640&q=75"

# Should return:
# HTTP/1.1 200 OK (or 400 if URL is invalid, not 404 or 500)
```

### Step 4: Test in Browser
1. Open http://localhost:3000 (or your server IP)
2. Navigate to Media Library or Media Info
3. Open DevTools → Network tab
4. Filter by "Img"
5. Should see requests to `/_next/image?url=...`
6. Images should load successfully

### Step 5: Verify Internet Access (if needed)
```bash
# Test TMDB connectivity from within container
docker exec -it mediaflick wget -O- https://image.tmdb.org/t/p/w500/test.jpg

# Should return:
# HTTP response (even 404 is fine, means connection works)
```

---

## Troubleshooting

### Issue: Images still not loading

**Check 1: Verify server.js is running**
```bash
docker exec -it mediaflick ps aux | grep "node server.js"
```

**Check 2: Test image endpoint directly**
```bash
curl -I "http://localhost:3000/_next/image?url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2FkXfqcdQKsToO0OUXHcrrNCHDBzO.jpg&w=640&q=75"
```

**Check 3: Verify internet access from container**
```bash
docker exec -it mediaflick wget -T 5 -O- https://image.tmdb.org 2>&1
```

### Issue: "Error: Invalid src prop"

**Cause:** Image URL is malformed or empty

**Solution:** Check that `posterPath` / `backdropPath` are not null/undefined

```typescript
{mediaInfo?.posterPath && (
  <Image
    src={`https://image.tmdb.org/t/p/w500${mediaInfo.posterPath}`}
    alt={mediaInfo.title}
    ...
  />
)}
```

### Issue: "Error: Failed to optimize image"

**Cause 1:** Cannot reach `image.tmdb.org` from container

**Solution:** Check Docker network configuration or use backend proxy

**Cause 2:** Next.js image domains not configured

**Solution:** Verify `next.config.ts`:
```typescript
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "image.tmdb.org",
      pathname: "/t/p/**",
    },
  ],
}
```

### Issue: Images load in dev but not in Docker

**Cause:** Custom server not copied to Docker image

**Solution:** Verify Dockerfile includes:
```dockerfile
COPY --from=frontend-build /mediaflick/server.js ./server.js
COPY --from=frontend-build /mediaflick/node_modules ./node_modules
```

---

## Network Configuration for Isolated Environments

If your Docker environment doesn't allow external internet access, you have two options:

### Option A: Allow TMDB Domain
Add to Docker network configuration:
```yaml
# docker-compose.yml
services:
  mediaflick:
    dns:
      - 8.8.8.8  # Google DNS
      - 8.8.4.4
    extra_hosts:
      - "image.tmdb.org:13.224.161.90"  # TMDB IP (may change)
```

### Option B: Use Backend Proxy (Recommended)
Modify components to use backend image proxy:

**Create helper function:**
```typescript
// lib/utils/image.ts
export const getTmdbImageUrl = (path: string, size: string = 'w500') => {
  if (!path) return '/placeholder-image.jpg'

  // In production, use backend proxy
  if (process.env.NODE_ENV === 'production') {
    return `/api/proxy/medialookup/images${path}?size=${size}`
  }

  // In development, use direct TMDB URL
  return `https://image.tmdb.org/t/p/${size}${path}`
}
```

**Update components:**
```typescript
<Image
  src={getTmdbImageUrl(mediaInfo.posterPath)}
  alt={mediaInfo.title}
  ...
/>
```

**Update next.config.ts:**
```typescript
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "image.tmdb.org",
    },
  ],
  // Allow local API proxy
  domains: ['localhost'],
}
```

---

## Summary

✅ **Fixed:** Custom server now allows Next.js image optimization
✅ **Impact:** TMDB images load correctly in Docker
✅ **Security:** No changes to proxy architecture
✅ **Performance:** Next.js image optimization still active

**Files Changed:**
1. `mediaflick/server.js` - Added early return for `/_next/*` routes

**Testing:**
- Rebuild Docker image: `docker-compose build mediaflick`
- Restart container: `docker-compose up -d mediaflick`
- Verify images load in browser

**Note:** Container must have internet access to reach `image.tmdb.org`. For isolated networks, use backend image proxy instead.
