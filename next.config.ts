import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable in development for faster builds
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */

  // Serwist uses webpack; this tells Next.js 16 we're aware of the webpack config
  // Serwist Turbopack support is tracked at: https://github.com/serwist/serwist/issues/54
  turbopack: {},

  // Enable standalone output for Docker deployment
  output: 'standalone',

  // Optimize for container deployment
  outputFileTracingRoot: __dirname,

  // Asset optimization
  images: {
    unoptimized: process.env.NODE_ENV === "development",
  },

  // Exclude server-only packages from client bundle
  serverExternalPackages: ['sharp'],

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

export default withSerwist(nextConfig);
