/**
 * On production hosts (e.g. Vercel), use same-origin `/api/*` so `next.config.js`
 * rewrites proxy to Render — avoids cross-origin/CORS on the browser.
 * On localhost, call the backend URL from NEXT_PUBLIC_API_URL.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  return '';
}
