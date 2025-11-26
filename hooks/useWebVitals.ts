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
   * @default "/api/telemetry/vitals"
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
 * Circuit breaker state for preventing repeated failures
 */
let failureCount = 0;
let lastFailureTime = 0;
const MAX_FAILURES = 3;
const CIRCUIT_RESET_TIME = 60000; // 1 minute

/**
 * Metric queue for batching
 */
const metricQueue: Array<{
  metric: CoreWebVitalsMetric;
  timestamp: number;
  url: string;
  userAgent: string;
}> = [];
let flushTimeoutId: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
// Track the endpoint used by the queued flusher (updated on send)
let currentAnalyticsEndpoint = "/api/telemetry/vitals";

/**
 * Check if browser is online
 */
function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/**
 * Send metric to analytics endpoint
 * Uses fetch with credentials since sendBeacon doesn't support authentication
 * Includes circuit breaker pattern and batching
 */
async function sendMetricToAnalytics(
  metric: CoreWebVitalsMetric,
  endpoint: string
) {
  // Persist endpoint for queued flushes
  if (endpoint) {
    currentAnalyticsEndpoint = endpoint;
  }
  // Check if circuit breaker is open (too many failures)
  if (failureCount >= MAX_FAILURES) {
    const timeSinceLastFailure = Date.now() - lastFailureTime;
    if (timeSinceLastFailure < CIRCUIT_RESET_TIME) {
      // Circuit open, skip sending (silently)
      return;
    }
    // Reset circuit after timeout
    failureCount = 0;
  }

  // Check if browser is online
  if (!isOnline()) {
    // Don't attempt to send when offline
    return;
  }

  const payload = {
    metric,
    timestamp: Date.now(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };

  // Add to queue instead of sending immediately
  metricQueue.push(payload);

  // Schedule flush if not already scheduled
  if (!flushTimeoutId) {
    flushTimeoutId = setTimeout(flushMetricQueue, FLUSH_INTERVAL);
  }
}

/**
 * Flush all queued metrics to the server
 * Batches multiple metrics into a single request
 */
async function flushMetricQueue() {
  if (metricQueue.length === 0) {
    flushTimeoutId = null;
    return;
  }

  // Take all current metrics from queue
  const metricsToSend = [...metricQueue];
  metricQueue.length = 0; // Clear queue
  flushTimeoutId = null;

  try {
    await fetch(currentAnalyticsEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metrics: metricsToSend,
        batched: true,
      }),
      credentials: "include", // Required for cookie-based authentication
      keepalive: true, // Don't block page unload
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    // Success - reset failure count
    if (failureCount > 0) {
      failureCount = 0;
    }
  } catch (error) {
    // Increment failure count
    failureCount++;
    lastFailureTime = Date.now();

    // Only log in development
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[Web Vitals] Failed to send metrics (${failureCount}/${MAX_FAILURES}):`,
        error
      );
    }

    // Don't retry - just drop the metrics
    // Performance tracking is non-critical
  }
}

/**
 * React hook to track Web Vitals
 *
 * @example
 * export default function Page() {
 *   useWebVitals({
 *     endpoint: "/api/telemetry/vitals",
 *     debug: true,
 *   });
 *   return <div>Your page</div>;
 * }
 */
export function useWebVitals(options: UseWebVitalsOptions = {}) {
  const {
    endpoint = "/api/telemetry/vitals",
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
