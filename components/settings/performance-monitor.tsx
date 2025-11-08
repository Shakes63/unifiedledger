"use client";

/**
 * Performance Monitoring Dashboard Component
 *
 * Displays real-time Web Vitals metrics and performance statistics.
 * Shows:
 * - Current metrics with ratings (good/needs-improvement/poor)
 * - Historical trends and averages
 * - Performance timeline
 * - Export functionality for analysis
 */

import { useEffect, useState } from "react";
import { AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getStoredMetrics,
  getAverageMetrics,
  getPageLoadMetrics,
  exportMetricsAsJSON,
  downloadMetricsAsJSON,
  VITALS_THRESHOLDS,
  type CoreWebVitalsMetric,
} from "@/lib/performance/core-web-vitals";

interface PerformanceStats {
  [key: string]: {
    values: number[];
    ratings: Record<string, number>;
    avg: number;
    min: number;
    max: number;
    median: number;
  };
}

/**
 * Get color for metric rating
 */
function getRatingColor(rating: string): string {
  switch (rating) {
    case "good":
      return "text-emerald-400";
    case "needs-improvement":
      return "text-amber-400";
    case "poor":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}

/**
 * Get background color for metric rating
 */
function getRatingBgColor(rating: string): string {
  switch (rating) {
    case "good":
      return "bg-emerald-500/10";
    case "needs-improvement":
      return "bg-amber-500/10";
    case "poor":
      return "bg-red-500/10";
    default:
      return "bg-gray-500/10";
  }
}

/**
 * Format metric value with units
 */
function formatMetricValue(name: string, value: number): string {
  if (name === "CLS") {
    return value.toFixed(3);
  }
  return Math.round(value).toString();
}

/**
 * Get metric unit
 */
function getMetricUnit(name: string): string {
  if (name === "CLS") {
    return "";
  }
  return "ms";
}

/**
 * Performance Monitor Component
 */
export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<CoreWebVitalsMetric[]>([]);
  const [stats, setStats] = useState<PerformanceStats>({});
  const [pageLoad, setPageLoad] = useState<{
    pageLoadTime?: number;
    ttfb?: number;
  }>({});
  const [loading, setLoading] = useState(true);

  // Load metrics on mount and every 5 seconds
  useEffect(() => {
    const loadMetrics = () => {
      const storedMetrics = getStoredMetrics();
      setMetrics(storedMetrics as CoreWebVitalsMetric[]);

      // Calculate stats
      const byName: PerformanceStats = {};
      for (const metric of storedMetrics as CoreWebVitalsMetric[]) {
        if (!byName[metric.name]) {
          byName[metric.name] = {
            values: [],
            ratings: { good: 0, "needs-improvement": 0, poor: 0 },
            avg: 0,
            min: Infinity,
            max: -Infinity,
            median: 0,
          };
        }

        const stat = byName[metric.name];
        stat.values.push(metric.value);
        stat.ratings[metric.rating] = (stat.ratings[metric.rating] || 0) + 1;
        stat.min = Math.min(stat.min, metric.value);
        stat.max = Math.max(stat.max, metric.value);
      }

      // Calculate medians and averages
      for (const name in byName) {
        const stat = byName[name];
        if (stat.values.length > 0) {
          stat.avg = stat.values.reduce((a, b) => a + b, 0) / stat.values.length;
          const sorted = stat.values.sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          stat.median =
            sorted.length % 2 !== 0
              ? sorted[mid]
              : (sorted[mid - 1] + sorted[mid]) / 2;
        }
      }

      setStats(byName);
      setPageLoad(getPageLoadMetrics());
      setLoading(false);
    };

    loadMetrics();
    const interval = setInterval(loadMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const metricNames = ["LCP", "FID", "CLS", "TTFB", "INP"];
  const hasMetrics = metrics.length > 0;

  if (loading && !hasMetrics) {
    return (
      <Card className="p-6">
        <p className="text-gray-400">Loading performance metrics...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Load Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">
          Page Load Performance
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {pageLoad.pageLoadTime && (
            <div className="bg-[#1a1a1a] rounded-lg p-4">
              <p className="text-sm text-gray-400">Total Load Time</p>
              <p className="text-2xl font-bold text-white mt-1">
                {Math.round(pageLoad.pageLoadTime)}ms
              </p>
            </div>
          )}
          {pageLoad.ttfb && (
            <div className="bg-[#1a1a1a] rounded-lg p-4">
              <p className="text-sm text-gray-400">Time to First Byte</p>
              <p className="text-2xl font-bold text-white mt-1">
                {Math.round(pageLoad.ttfb)}ms
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Core Web Vitals */}
      {hasMetrics && (
        <>
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-white">
              Core Web Vitals
            </h3>

            {metricNames.map((name) => {
              const stat = stats[name];
              if (!stat || stat.values.length === 0) return null;

              const threshold =
                VITALS_THRESHOLDS[name as keyof typeof VITALS_THRESHOLDS];
              const isGood = stat.avg <= threshold.good;
              const isPoor = stat.avg > threshold.poor;

              return (
                <div
                  key={name}
                  className={`mb-4 p-4 rounded-lg ${getRatingBgColor(isGood ? "good" : isPoor ? "poor" : "needs-improvement")}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-white">{name}</p>
                      <p className="text-sm text-gray-400">
                        {getMetricDescription(name)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xl font-bold ${getRatingColor(isGood ? "good" : isPoor ? "poor" : "needs-improvement")}`}
                      >
                        {formatMetricValue(name, stat.avg)}
                        {getMetricUnit(name) && (
                          <span className="text-sm ml-1">
                            {getMetricUnit(name)}
                          </span>
                        )}
                      </p>
                      <p
                        className={`text-xs mt-1 ${getRatingColor(isGood ? "good" : isPoor ? "poor" : "needs-improvement")}`}
                      >
                        {isGood ? "✓ Good" : isPoor ? "✗ Poor" : "⚠ Needs Improvement"}
                      </p>
                    </div>
                  </div>

                  {/* Metric details */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Min</p>
                      <p className="text-white">
                        {formatMetricValue(name, stat.min)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Median</p>
                      <p className="text-white">
                        {formatMetricValue(name, stat.median)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Max</p>
                      <p className="text-white">
                        {formatMetricValue(name, stat.max)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Count</p>
                      <p className="text-white">{stat.values.length}</p>
                    </div>
                  </div>

                  {/* Rating distribution */}
                  <div className="mt-3 grid grid-cols-3 gap-1 text-xs">
                    <div className="bg-emerald-500/20 rounded px-2 py-1">
                      <p className="text-emerald-400">
                        Good: {stat.ratings.good}
                      </p>
                    </div>
                    <div className="bg-amber-500/20 rounded px-2 py-1">
                      <p className="text-amber-400">
                        Needs: {stat.ratings["needs-improvement"]}
                      </p>
                    </div>
                    <div className="bg-red-500/20 rounded px-2 py-1">
                      <p className="text-red-400">Poor: {stat.ratings.poor}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Export section */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-white">
              Export Metrics
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Download all collected metrics as JSON for analysis
            </p>
            <Button
              onClick={() => downloadMetricsAsJSON()}
              className="bg-blue-500 hover:bg-blue-600"
            >
              Export as JSON
            </Button>
          </Card>
        </>
      )}

      {/* No metrics message */}
      {!hasMetrics && (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <p className="text-gray-400">
              No performance metrics collected yet. Metrics appear after page
              interactions.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Get description for metric
 */
function getMetricDescription(name: string): string {
  const descriptions: Record<string, string> = {
    LCP: "Largest Contentful Paint (loading performance)",
    FID: "First Input Delay (interactivity)",
    CLS: "Cumulative Layout Shift (visual stability)",
    TTFB: "Time to First Byte (server response)",
    INP: "Interaction to Next Paint (interactivity)",
  };
  return descriptions[name] || "";
}
