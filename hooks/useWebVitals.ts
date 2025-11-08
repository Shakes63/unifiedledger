/**
 * React Hook for tracking Web Vitals
 *
 * Integrates with web-vitals library to track:
 * - LCP: Largest Contentful Paint
 * - FID: First Input Delay (or INP: Interaction to Next Paint)
 * - CLS: Cumulative Layout Shift
 * - TTFB: Time to First Byte
 *
 * Automatically sends metrics to analytics endpoint
 */

import { useEffect } from "react";
import { onCLS, onINP, onFCP, onLCP, onTTFB } from "web-vitals";
import type { Metric } from "web-vitals";
import {
  CoreWebVitalsMetric,
  getMetricRating,
  reportMetric,
} from "@/lib/performance/core-web-vitals";

/**
 * Callback type for metric reporting
 */
export type MetricReportCallback = (metric: CoreWebVitalsMetric) => void;

/**
 * Options for useWebVitals hook
 */
export interface UseWebVitalsOptions {
  /**
   * Send metrics to this endpoint
   * POST body will include the metric
   * @default "/api/performance/metrics"
   */
  endpoint?: string;

  /**
   * Callback function to handle metrics
   */
  onMetric?: MetricReportCallback;

  /**
   * Enable console logging of metrics (for development)
   * @default false
   */
  debug?: boolean;

  /**
   * Enable sending to analytics (requires endpoint)
   * @default true
   */
  sendToAnalytics?: boolean;
}

/**
 * Unified metric handler that works with all web-vitals
 */
function handleMetric(
  webVitalsMetric: Metric,
  options: UseWebVitalsOptions
) {
  const metric: CoreWebVitalsMetric = {
    name: webVitalsMetric.name as CoreWebVitalsMetric["name"],
    value: Math.round(webVitalsMetric.value),
    rating: getMetricRating(webVitalsMetric.name, webVitalsMetric.value),
    delta: Math.round(webVitalsMetric.delta || 0),
    id: webVitalsMetric.id,
    navigationType: webVitalsMetric.navigationType || "navigation",
  };

  // Debug logging
  if (options.debug) {
    console.log(
      `[Web Vitals] ${metric.name}: ${metric.value}ms (${metric.rating})`,
      {
        delta: metric.delta,
        id: metric.id,
      }
    );
  }

  // Call callback
  if (options.onMetric) {
    options.onMetric(metric);
  }

  // Report to local storage
  reportMetric(metric);

  // Send to analytics endpoint
  if (options.sendToAnalytics && options.endpoint) {
    sendMetricToAnalytics(metric, options.endpoint).catch((error) => {
      if (options.debug) {
        console.error("[Web Vitals] Failed to send metric:", error);
      }
    });
  }
}

/**
 * Send metric to analytics endpoint using Navigator.sendBeacon
 * (more reliable than fetch for analytics)
 */
async function sendMetricToAnalytics(
  metric: CoreWebVitalsMetric,
  endpoint: string
) {
  const payload = {
    metric,
    timestamp: Date.now(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };

  // Try sendBeacon first (most reliable for analytics)
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(endpoint, JSON.stringify(payload));
      return;
    } catch (error) {
      // Fallback to fetch if sendBeacon fails
    }
  }

  // Fallback to fetch
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Don't keep-alive to avoid blocking page unload
      keepalive: true,
    });
  } catch (error) {
    // Silently fail - don't break the page for analytics
    if (process.env.NODE_ENV === "development") {
      console.error("[Web Vitals] Failed to send metric:", error);
    }
  }
}

/**
 * React hook to track Web Vitals
 *
 * @example
 * export default function Page() {
 *   useWebVitals({
 *     endpoint: "/api/performance/metrics",
 *     debug: true,
 *   });
 *   return <div>Your page</div>;
 * }
 */
export function useWebVitals(options: UseWebVitalsOptions = {}) {
  const {
    endpoint = "/api/performance/metrics",
    onMetric,
    debug = false,
    sendToAnalytics = true,
  } = options;

  useEffect(() => {
    // Create unified handler
    const handler = (metric: Metric) =>
      handleMetric(metric, {
        endpoint,
        onMetric,
        debug,
        sendToAnalytics,
      });

    // Register all metric collectors
    onCLS(handler);
    onINP(handler);
    onFCP(handler);
    onLCP(handler);
    onTTFB(handler);

    // Cleanup: web-vitals handles unsubscription internally
    return () => {
      // web-vitals doesn't provide unsubscribe, but it's safe to leave
    };
  }, [endpoint, onMetric, debug, sendToAnalytics]);
}
