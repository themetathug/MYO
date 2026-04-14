/** @type {import('next').NextConfig} */
// Never default NEXT_PUBLIC_* to localhost here — that value is inlined into the browser
// bundle and breaks Vercel (the SPA would call the visitor's localhost:3001).
// Use BACKEND_URL (server-only) or NEXT_PUBLIC_API_URL for where /api/* should proxy.
const backendOrigin = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'
)
  .trim()
  .replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
}

module.exports = nextConfig
