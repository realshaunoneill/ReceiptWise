/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: false,
    remotePatterns: [
      // Google profile pictures, shown as the avatar in the navigation.
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // The old XSS auditor is gone from browsers, and where it lingers "1; mode=block" can be
            // abused to blank a page; "0" is today's advice.
            key: 'X-XSS-Protection',
            value: '0',
          },
          {
            // Vercel's default HSTS, plus the subdomains (www, staging and in. are all HTTPS or mail).
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            // The parts of a CSP that can't break a page: no framing, no plugins, no <base> swap,
            // and forms post only here or to the payment and sign-in pages. A script-src policy
            // needs per-request nonces, which would make every page dynamic; not worth it yet.
            key: 'Content-Security-Policy',
            value: [
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://checkout.stripe.com https://billing.stripe.com https://accounts.google.com https://appleid.apple.com",
            ].join('; '),
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
