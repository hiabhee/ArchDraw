import type { NextConfig } from 'next';
import path from 'path';

const isDevelopment = process.env.NODE_ENV === 'development';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { 
    key: 'Content-Security-Policy', 
    // Add 'unsafe-eval' only in development for React debugging features
    value: `default-src 'self'; script-src 'self' blob: 'unsafe-inline' ${isDevelopment ? "'unsafe-eval'" : ''} https://*.vercel-scripts.com https://vercel.live; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.groq.com https://api.groq.com https://*.vercel-scripts.com https://vercel.live wss://vercel.live https://archdraw.hiabhee.online wss://archdraw.hiabhee.online; frame-src 'self' https://vercel.live https://accounts.google.com; frame-ancestors 'self'; base-uri 'self';` 
  },
];

// Configure allowed embed domains via environment variable
// Comma-separated list of domains allowed to embed the diagram viewer
const allowedEmbedDomains = process.env.ALLOWED_EMBED_DOMAINS 
  ? process.env.ALLOWED_EMBED_DOMAINS.split(',').map(d => d.trim()) 
  : ['*']; // Default to allow all if not configured

const embedCSP = allowedEmbedDomains.includes('*') 
  ? "frame-ancestors *"
  : `frame-ancestors 'self' ${allowedEmbedDomains.map(d => `https://${d}`).join(' ')}`;

const embedHeaders = [
  { key: 'X-Frame-Options', value: allowedEmbedDomains.includes('*') ? 'ALLOWALL' : 'SAMEORIGIN' },
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
