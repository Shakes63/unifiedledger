"use client";

/**
 * Performance Provider Component
 *
 * Initializes Web Vitals tracking and performance monitoring.
 * Wraps the entire app to ensure metrics are collected from all pages.
 */

import { ReactNode } from "react";
import { useWebVitals } from "@/hooks/useWebVitals";

export function PerformanceProvider({ children }: { children: ReactNode }) {
  // Initialize Web Vitals tracking
  useWebVitals({
    endpoint: "/api/performance/metrics",
    debug: process.env.NODE_ENV === "development",
    sendToAnalytics: true,
  });

  return <>{children}</>;
}
