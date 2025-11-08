/**
 * API Route: POST /api/performance/metrics
 *
 * Receives Web Vitals metrics from clients and stores them for analysis.
 * This endpoint is called by the useWebVitals hook to track performance metrics.
 *
 * @handler POST - Store incoming metric
 * @handler GET - Retrieve stored metrics for analysis
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * In-memory metrics store (in production, use database)
 * Structure: metrics[userId] = [metric, metric, ...]
 */
const metricsStore = new Map<
  string,
  Array<{
    metric: {
      name: string;
      value: number;
      rating: string;
      delta: number;
      id: string;
      navigationType: string;
    };
    timestamp: number;
    url: string;
    userAgent: string;
  }>
>();

/**
 * POST: Receive and store a new metric
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { metric, timestamp, url, userAgent } = body;

    if (!metric || !metric.name) {
      return NextResponse.json(
        { error: "Invalid metric format" },
        { status: 400 }
      );
    }

    // Store metric in memory (in production, use database)
    if (!metricsStore.has(userId)) {
      metricsStore.set(userId, []);
    }

    const userMetrics = metricsStore.get(userId)!;
    userMetrics.push({
      metric,
      timestamp: timestamp || Date.now(),
      url: url || "unknown",
      userAgent: userAgent || "unknown",
    });

    // Keep only last 500 metrics per user
    if (userMetrics.length > 500) {
      metricsStore.set(userId, userMetrics.slice(-500));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Performance] Error storing metric:", error);
    return NextResponse.json(
      { error: "Failed to store metric" },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve stored metrics for the current user
 *
 * Query parameters:
 * - limit: number of most recent metrics to return (default: 50)
 * - metricName: filter by metric name (LCP, FID, CLS, TTFB, INP)
 * - ratingOnly: return only metrics with specific rating (good, needs-improvement, poor)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 500);
    const metricName = searchParams.get("metricName");
    const rating = searchParams.get("rating");

    let metrics = metricsStore.get(userId) || [];

    // Filter by metric name
    if (metricName) {
      metrics = metrics.filter((m) => m.metric.name === metricName);
    }

    // Filter by rating
    if (rating) {
      metrics = metrics.filter((m) => m.metric.rating === rating);
    }

    // Get most recent metrics
    const recent = metrics.slice(-limit);

    // Calculate statistics
    const stats = calculateStats(recent);

    return NextResponse.json({
      metrics: recent,
      stats,
      count: metrics.length,
      limit,
    });
  } catch (error) {
    console.error("[Performance] Error retrieving metrics:", error);
    return NextResponse.json(
      { error: "Failed to retrieve metrics" },
      { status: 500 }
    );
  }
}

/**
 * Calculate statistics from metrics
 */
function calculateStats(
  metrics: Array<{
    metric: {
      name: string;
      value: number;
      rating: string;
      delta: number;
      id: string;
      navigationType: string;
    };
    timestamp: number;
    url: string;
    userAgent: string;
  }>
) {
  const byName: Record<
    string,
    {
      values: number[];
      ratings: Record<string, number>;
      avg: number;
      min: number;
      max: number;
      median: number;
    }
  > = {};

  for (const entry of metrics) {
    const { name, value, rating } = entry.metric;

    if (!byName[name]) {
      byName[name] = {
        values: [],
        ratings: { good: 0, "needs-improvement": 0, poor: 0 },
        avg: 0,
        min: Infinity,
        max: -Infinity,
        median: 0,
      };
    }

    const stat = byName[name];
    stat.values.push(value);
    stat.ratings[rating] = (stat.ratings[rating] || 0) + 1;
    stat.min = Math.min(stat.min, value);
    stat.max = Math.max(stat.max, value);
  }

  // Calculate averages and medians
  for (const name in byName) {
    const stat = byName[name];
    stat.avg = stat.values.reduce((a, b) => a + b, 0) / stat.values.length;

    // Calculate median
    const sorted = stat.values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    stat.median =
      sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return byName;
}
