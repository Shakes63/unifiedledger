/**
 * Core Web Vitals Tracking
 *
 * Tracks Google's Core Web Vitals metrics:
 * - LCP: Largest Contentful Paint (loading performance)
 * - FID: First Input Delay (interactivity)
 * - CLS: Cumulative Layout Shift (visual stability)
 * - TTFB: Time to First Byte (server response)
 *
 * These metrics are reported to analytics and stored in browser storage for analysis.
 */

export interface CoreWebVitalsMetric {
  name: "LCP" | "FID" | "CLS" | "TTFB" | "INP"; // INP = Interaction to Next Paint (FID replacement)
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  navigationType: string;
}

export interface PerformanceMetrics {
  lcp?: number; // Largest Contentful Paint (ms)
  fid?: number; // First Input Delay (ms)
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte (ms)
  inp?: number; // Interaction to Next Paint (ms)
  pageLoadTime?: number; // Total page load (ms)
  timestamp: number;
  url: string;
  userAgent: string;
}

/**
 * Threshold values according to Google Web Vitals standards
 */
export const VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
};

/**
 * Callback type for metric reporting
 */
export type MetricCallback = (metric: CoreWebVitalsMetric) => void;

/**
 * Get rating for metric value
 */
export function getMetricRating(
  metricName: string,
  value: number
): "good" | "needs-improvement" | "poor" {
  const threshold =
    VITALS_THRESHOLDS[metricName as keyof typeof VITALS_THRESHOLDS];

  if (!threshold) return "needs-improvement";

  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

/**
 * Report metric with optional callback
 */
export function reportMetric(
  metric: CoreWebVitalsMetric,
  callback?: MetricCallback
) {
  if (callback) {
    callback(metric);
  }

  // Store in browser storage for later analysis
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = localStorage.getItem("cwv_metrics") || "[]";
      const metrics = JSON.parse(stored);
      metrics.push({
        ...metric,
        timestamp: Date.now(),
      });
      // Keep last 50 metrics
      const recentMetrics = metrics.slice(-50);
      localStorage.setItem("cwv_metrics", JSON.stringify(recentMetrics));
    } catch (e) {
      console.error("Failed to store metric:", e);
    }
  }
}

/**
 * Get stored metrics from browser storage
 */
export function getStoredMetrics(): (CoreWebVitalsMetric & { timestamp: number })[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const stored = localStorage.getItem("cwv_metrics") || "[]";
    return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to retrieve metrics:", e);
    return [];
  }
}

/**
 * Calculate average metrics from stored values
 */
export function getAverageMetrics(): Partial<PerformanceMetrics> {
  const metrics = getStoredMetrics();

  if (metrics.length === 0) {
    return {};
  }

  const avg: Partial<PerformanceMetrics> = {
    timestamp: Date.now(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };

  const lcpValues = metrics
    .filter((m) => m.name === "LCP")
    .map((m) => m.value);
  const fidValues = metrics
    .filter((m) => m.name === "FID" || m.name === "INP")
    .map((m) => m.value);
  const clsValues = metrics
    .filter((m) => m.name === "CLS")
    .map((m) => m.value);
  const ttfbValues = metrics
    .filter((m) => m.name === "TTFB")
    .map((m) => m.value);

  if (lcpValues.length > 0) {
    avg.lcp = lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length;
  }
  if (fidValues.length > 0) {
    avg.fid = fidValues.reduce((a, b) => a + b, 0) / fidValues.length;
  }
  if (clsValues.length > 0) {
    avg.cls = clsValues.reduce((a, b) => a + b, 0) / clsValues.length;
  }
  if (ttfbValues.length > 0) {
    avg.ttfb = ttfbValues.reduce((a, b) => a + b, 0) / ttfbValues.length;
  }

  return avg;
}

/**
 * Get performance timeline from Performance API
 */
export function getPageLoadMetrics(): Partial<PerformanceMetrics> {
  if (typeof window === "undefined" || !window.performance) {
    return {};
  }

  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

  if (!navigation) {
    return {};
  }

  return {
    pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
    ttfb: navigation.responseStart - navigation.fetchStart,
    timestamp: Date.now(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
}

/**
 * Clear stored metrics (useful for testing)
 */
export function clearStoredMetrics() {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.removeItem("cwv_metrics");
    } catch (e) {
      console.error("Failed to clear metrics:", e);
    }
  }
}

/**
 * Export metrics to JSON
 */
export function exportMetricsAsJSON(): string {
  const metrics = getStoredMetrics();
  const averages = getAverageMetrics();
  const pageLoad = getPageLoadMetrics();

  return JSON.stringify(
    {
      summary: {
        metricsCount: metrics.length,
        averages,
        pageLoad,
        exportedAt: new Date().toISOString(),
      },
      details: metrics,
    },
    null,
    2
  );
}

/**
 * Download metrics as JSON file
 */
export function downloadMetricsAsJSON() {
  const json = exportMetricsAsJSON();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `performance-metrics-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
