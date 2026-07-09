import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { buildSecurityHeaders } from "./lib/security/headers";

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

  // Docker/CI builds: allow shipping an image even if TypeScript has dialect-union typing issues.
  // Default is strict; opt-in by setting NEXT_IGNORE_BUILD_ERRORS=1.
  typescript: {
    ignoreBuildErrors: process.env.NEXT_IGNORE_BUILD_ERRORS === "1",
  },

  // Security headers (policy lives in lib/security/headers.ts so it is
  // unit-tested; HSTS + CSP are added in production builds only).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: buildSecurityHeaders({ production: process.env.NODE_ENV === 'production' }),
      },
    ];
  },
};

export default withSerwist(nextConfig);
