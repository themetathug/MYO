/** @type {import('next').NextConfig} */
// API proxy: use `src/app/api/[[...path]]/route.ts` so Authorization reaches Render.
// Set BACKEND_URL or NEXT_PUBLIC_API_URL on Vercel (server reads both in the Route Handler).
// Do not default NEXT_PUBLIC_* to localhost here — it gets inlined into the browser bundle.

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
