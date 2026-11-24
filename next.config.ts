import type { NextConfig } from 'next';

/**
 * In production nginx serves this app and the admin service on the same
 * origin (admin.sinc.today), so /admin-api is routed by nginx. In development
 * the rewrite below proxies /admin-api to the local admin service so the
 * session cookie stays same-origin.
 */
const adminApi = process.env.ADMIN_API_URL || 'http://localhost:8005';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
      "style-src 'self' 'unsafe-inline'",
      // Event flyers live on Sinc's CDNs. Override with CONSOLE_IMAGE_HOSTS (space-separated origins).
      `img-src 'self' data: blob: ${process.env.CONSOLE_IMAGE_HOSTS ?? 'https://*.cloudfront.net https://*.amazonaws.com https://res.cloudinary.com'}`,
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/admin-api/:path*', destination: `${adminApi}/admin-api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
