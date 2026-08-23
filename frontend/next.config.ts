import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // The legacy XSS auditor is deprecated and can itself introduce
  // vulnerabilities; OWASP recommends disabling it (0) and relying on CSP.
  { key: 'X-XSS-Protection', value: '0' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    // Add 'unsafe-eval' only in development for React debugging features.
    // NOTE: a nonce-based script CSP (middleware.ts) was reverted — Next.js
    // only stamps its bootstrap scripts with the nonce when the root layout
    // reads it via headers(), which forces every route dynamic and kills
    // static rendering of landing/blogs/docs. Revisit before re-enabling.
    value: `default-src 'self'; script-src 'self' blob: 'unsafe-inline' ${isDevelopment ? "'unsafe-eval'" : ''} https://*.vercel-scripts.com https://vercel.live; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.groq.com https://api.groq.com https://*.vercel-scripts.com https://vercel.live wss://vercel.live https://archdraw.hiabhee.online wss://archdraw.hiabhee.online; frame-src 'self' https://vercel.live https://accounts.google.com; frame-ancestors 'self'; base-uri 'self'; object-src 'none';`
  },
];

// Configure allowed embed domains via environment variable.
// Comma-separated list of domains allowed to embed the diagram viewer.
// SECURE DEFAULT: when unset, only same-origin embedding is allowed.
// Set ALLOWED_EMBED_DOMAINS="*" to explicitly opt into embedding from anywhere.
// Values are validated so a malformed entry cannot inject extra CSP directives.
const allowedEmbedDomains = process.env.ALLOWED_EMBED_DOMAINS
  ? process.env.ALLOWED_EMBED_DOMAINS.split(',')
      .map((d) => d.trim())
      .filter((d) => /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(d))
  : []; // Default: same-origin only (no third-party embedding)

const allowAllEmbeds = allowedEmbedDomains.includes('*');

const embedCSP = [
  // /embed/* is excluded from the nonce-based middleware CSP, so it carries its
  // own full static policy here (scripts stay 'unsafe-inline' for the viewer).
  `default-src 'self'`,
  `script-src 'self' blob: 'unsafe-inline'${
    isDevelopment ? " 'unsafe-eval'" : ''
  } https://*.vercel-scripts.com https://vercel.live`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://*.groq.com https://api.groq.com https://*.vercel-scripts.com https://vercel.live wss://vercel.live https://archdraw.hiabhee.online wss://archdraw.hiabhee.online`,
  `frame-src 'self' https://vercel.live https://accounts.google.com`,
  allowAllEmbeds ? `frame-ancestors *` : `frame-ancestors 'self'${
    allowedEmbedDomains.length ? ' ' + allowedEmbedDomains.map((d) => `https://${d}`).join(' ') : ''
  }`,
  `base-uri 'self'`,
  `object-src 'none'`,
].join('; ');

const embedHeaders = [
  // X-Frame-Options cannot express an allowlist, so only emit it for the
  // same-origin default (SAMEORIGIN). When specific domains or '*' are
  // configured, rely on the CSP frame-ancestors directive above and omit the
  // legacy header rather than send an invalid value like "ALLOWALL".
  ...(allowAllEmbeds || allowedEmbedDomains.length
    ? []
    : [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }]),
  { key: 'Content-Security-Policy', value: embedCSP },
];

const nextConfig: NextConfig = {
  transpilePackages: [],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'zustand',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-slot',
    ],
  },

  async headers() {
    return [
      {
        source: '/embed/:path*',
        headers: embedHeaders,
      },
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  logging: {
    fetches: { fullUrl: false },
  },
  async redirects() {
    return [
      {
        source: '/blog',
        destination: '/blogs',
        permanent: true,
      },
      {
        source: '/login',
        destination: '/dashboard',
        permanent: false,
      },
      {
        source: '/examples',
        destination: '/dashboard/templates',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
