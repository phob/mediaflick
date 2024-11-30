/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*' // Adjust the port if your .NET API runs on a different port
      }
    ]
  }
}

module.exports = nextConfig 