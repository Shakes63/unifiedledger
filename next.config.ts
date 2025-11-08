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
};

export default withPWAConfig(nextConfig);
