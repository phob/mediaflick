import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Use unoptimized images - we handle caching via our custom /api/image endpoint
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Apply aggressive caching headers to our custom image proxy
        source: "/api/image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },
}

export default nextConfig
