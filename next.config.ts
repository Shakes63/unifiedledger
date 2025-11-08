import type { NextConfig } from "next";
// @ts-ignore - next-pwa doesn't have proper TypeScript definitions
import withPWA from "next-pwa";

const withPWAConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Use custom service worker with advanced caching strategies
  publicExcludes: ["!sw.js"],
  buildExcludes: ["!sw.js"],
  // Configure runtime caching for better performance
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/fonts\.(googleapis|gstatic)\.com/,
      handler: "CacheFirst",
      options: {
        cacheName: "fonts",
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
      },
    },
    {
      urlPattern: /^\/api\//,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "api",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 5, // 5 minutes
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {},

  // Enable standalone output for Docker deployment
  output: 'standalone',

  // Optimize for container deployment
  outputFileTracingRoot: __dirname,

  // Asset optimization
  images: {
    unoptimized: process.env.NODE_ENV === "development",
  },

  // Security headers for production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default withPWAConfig(nextConfig);
