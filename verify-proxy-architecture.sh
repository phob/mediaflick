#!/bin/bash
# SignalR Proxy Architecture Verification Script
# This script checks for common architectural violations

echo "🔍 MediaFlick SignalR Proxy Architecture Verification"
echo "======================================================"
echo ""

VIOLATIONS=0

# Check 1: Verify no NEXT_PUBLIC_SIGNALR_URL in frontend code
echo "✓ Checking for exposed backend URLs in frontend..."
if grep -r "NEXT_PUBLIC_SIGNALR_URL" mediaflick/src/ 2>/dev/null; then
    echo "  ❌ VIOLATION: Found NEXT_PUBLIC_SIGNALR_URL in frontend code"
    echo "     Backend URLs should never be exposed to the browser"
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "  ✅ No NEXT_PUBLIC_SIGNALR_URL found"
fi

# Check 2: Verify signalr.ts uses relative URL
echo ""
echo "✓ Checking SignalR client connection URL..."
if grep -q "'/api/signalr'" mediaflick/src/lib/api/signalr.ts && ! grep -q "localhost:5000" mediaflick/src/lib/api/signalr.ts; then
    echo "  ✅ SignalR client uses proxy URL: /api/signalr"
elif grep -q "localhost:5000" mediaflick/src/lib/api/signalr.ts; then
    echo "  ❌ VIOLATION: SignalR client connects directly to backend"
    echo "     Found: localhost:5000 in signalr.ts"
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "  ⚠️  Could not verify SignalR connection URL pattern"
fi

# Check 3: Verify custom server exists
echo ""
echo "✓ Checking for custom server implementation..."
if [ -f "mediaflick/server.js" ]; then
    echo "  ✅ Custom server found: mediaflick/server.js"

    # Check if it handles WebSocket upgrades
    if grep -q "server.on('upgrade'" mediaflick/server.js; then
        echo "  ✅ Custom server handles WebSocket upgrades"
    else
        echo "  ❌ VIOLATION: Custom server missing WebSocket upgrade handler"
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
else
    echo "  ❌ VIOLATION: Custom server not found"
    echo "     Expected: mediaflick/server.js"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check 4: Verify package.json uses custom server
echo ""
echo "✓ Checking package.json scripts..."
if grep -q '"dev".*"node server.js"' mediaflick/package.json; then
    echo "  ✅ Dev script uses custom server"
elif grep -q '"dev".*"next dev"' mediaflick/package.json; then
    echo "  ❌ VIOLATION: Dev script uses 'next dev' instead of custom server"
    echo "     WebSocket proxying requires custom server"
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "  ⚠️  Could not verify dev script"
fi

# Check 5: Verify http-proxy-middleware dependency
echo ""
echo "✓ Checking dependencies..."
if grep -q "http-proxy-middleware" mediaflick/package.json; then
    echo "  ✅ http-proxy-middleware is installed"
else
    echo "  ❌ VIOLATION: http-proxy-middleware not found in package.json"
    echo "     Run: cd mediaflick && bun install http-proxy-middleware"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check 6: Verify no direct fetch to backend in client components
echo ""
echo "✓ Checking for direct backend API calls in client code..."
# Exclude server-side API routes (app/api/**/route.ts) since they are proxy layers
DIRECT_CALLS=$(grep -r "localhost:5000" mediaflick/src/components/ mediaflick/src/app/ 2>/dev/null | grep -v ".next" | grep -v "route.ts" | wc -l)
if [ "$DIRECT_CALLS" -gt 0 ]; then
    echo "  ❌ VIOLATION: Found $DIRECT_CALLS direct backend calls in client code"
    grep -rn "localhost:5000" mediaflick/src/components/ mediaflick/src/app/ 2>/dev/null | grep -v ".next" | grep -v "route.ts" | head -5
    echo "     Note: Server-side API routes (route.ts) are proxy layers and are OK"
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "  ✅ No direct backend calls found in client code"
    echo "     (Server-side API routes excluded from check)"
fi

# Check 7: Verify backend CORS configuration
echo ""
echo "✓ Checking backend CORS configuration..."
if [ -f "src/PlexLocalScan.Api/ServiceCollection/Cors.cs" ]; then
    if grep -q "WithOrigins" src/PlexLocalScan.Api/ServiceCollection/Cors.cs; then
        echo "  ✅ Backend CORS configured with specific origins"

        # Check for insecure wildcard
        if grep -q 'AllowAnyOrigin\|WithOrigins("\*")' src/PlexLocalScan.Api/ServiceCollection/Cors.cs; then
            echo "  ❌ VIOLATION: Backend allows any origin (*)"
            echo "     CORS should restrict to Next.js origin only"
            VIOLATIONS=$((VIOLATIONS + 1))
        fi
    else
        echo "  ⚠️  Could not verify CORS origin restrictions"
    fi
else
    echo "  ⚠️  Backend CORS configuration not found"
fi

# Summary
echo ""
echo "======================================================"
if [ $VIOLATIONS -eq 0 ]; then
    echo "✅ All checks passed! Proxy architecture is properly configured."
    echo ""
    echo "Next steps:"
    echo "  1. Run: cd mediaflick && bun install"
    echo "  2. Run: ./startdev.sh"
    echo "  3. Open: http://localhost:3000"
    echo "  4. Check DevTools → Network → WS"
    echo "  5. Verify connection: ws://localhost:3000/api/signalr/filetracking"
    exit 0
else
    echo "❌ Found $VIOLATIONS violation(s) in proxy architecture"
    echo ""
    echo "Please review the violations above and fix them."
    echo "Refer to SIGNALR_PROXY_ARCHITECTURE.md for detailed guidance."
    exit 1
fi
