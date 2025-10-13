const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { createProxyMiddleware } = require('http-proxy-middleware')

const dev = process.env.NODE_ENV !== 'production'
const hostname = dev ? 'localhost' : '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Create SignalR proxy middleware ONCE at startup to prevent memory leaks
  // Creating it per-request causes event listener accumulation on Socket objects
  const backendUrl = process.env.SIGNALR_URL || 'http://localhost:5000'
  const signalrProxy = createProxyMiddleware({
    target: backendUrl,
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying
    pathRewrite: {
      '^/api/signalr': '/hubs', // Rewrite /api/signalr/* to /hubs/*
    },
    onProxyReq: (proxyReq, req) => {
      // Add custom headers if needed
      proxyReq.setHeader('X-Forwarded-For', req.socket.remoteAddress)
      proxyReq.setHeader('X-Forwarded-Proto', 'http')
      proxyReq.setHeader('X-Forwarded-Host', req.headers.host)
    },
    onError: (err, req, res) => {
      console.error('SignalR Proxy Error:', err)
      if (res.writeHead) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Proxy error', details: err.message }))
      }
    },
    logLevel: dev ? 'debug' : 'warn',
  })

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      const { pathname } = parsedUrl

      // Let Next.js handle its internal routes (image optimization, static files, etc.)
      // IMPORTANT: This must come before SignalR proxy to avoid intercepting Next.js internals
      if (pathname && (pathname.startsWith('/_next/') || pathname.startsWith('/static/'))) {
        return handle(req, res, parsedUrl)
      }

      // Proxy SignalR WebSocket connections to backend using the singleton proxy
      if (pathname && pathname.startsWith('/api/signalr')) {
        return signalrProxy(req, res)
      }

      // Handle all other requests with Next.js
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('Internal server error')
    }
  })

  // Handle WebSocket upgrade requests using the singleton proxy
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url, true)

    if (pathname && pathname.startsWith('/api/signalr')) {
      signalrProxy.upgrade(req, socket, head)
    } else {
      socket.destroy()
    }
  })

  server.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> SignalR proxy: /api/signalr/* → ${process.env.SIGNALR_URL || 'http://localhost:5000'}/hubs/*`)
  })
})
