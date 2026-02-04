import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // output: 'standalone', // Enable only for Docker self-hosting, not Vercel

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // 🔒 SECURITY: no-referrer prevents token leakage via quick-connect URLs (?token=...)
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(), payment=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} wss: ws:`,
              `img-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} data: blob:`,
              "frame-src 'self' blob:",
              "font-src 'self'",
              "media-src 'self' blob: data:",
              "object-src 'none'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
