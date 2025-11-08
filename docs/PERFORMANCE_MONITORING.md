# Performance Monitoring System

## Overview

The Unified Ledger application includes a comprehensive performance monitoring system that tracks Google's Core Web Vitals metrics across the entire application. This system automatically collects, stores, and analyzes performance data to help identify bottlenecks and track improvements.

## Core Metrics

### 1. **LCP - Largest Contentful Paint**
- **What it measures:** Time until the largest visible element appears on screen
- **Good threshold:** ≤ 2,500 ms
- **Needs improvement:** 2,500 - 4,000 ms
- **Poor:** > 4,000 ms
- **Why it matters:** Indicates perceived loading performance

### 2. **FID - First Input Delay** (Legacy) / **INP - Interaction to Next Paint** (Modern)
- **What it measures:** Delay between user interaction and response
- **Good threshold:** ≤ 100 ms (FID) / ≤ 200 ms (INP)
- **Needs improvement:** 100-300 ms (FID) / 200-500 ms (INP)
- **Poor:** > 300 ms (FID) / > 500 ms (INP)
- **Why it matters:** Indicates responsiveness and interactivity

### 3. **CLS - Cumulative Layout Shift**
- **What it measures:** Unexpected layout shifts during page load
- **Good threshold:** ≤ 0.1
- **Needs improvement:** 0.1 - 0.25
- **Poor:** > 0.25
- **Why it matters:** Indicates visual stability

### 4. **TTFB - Time to First Byte**
- **What it measures:** Time from request to first byte of response
- **Good threshold:** ≤ 800 ms
- **Needs improvement:** 800 - 1,800 ms
- **Poor:** > 1,800 ms
- **Why it matters:** Indicates server responsiveness

## Architecture

### Components

1. **Core Web Vitals Library** (`lib/performance/core-web-vitals.ts`)
   - Tracks metrics according to Google standards
   - Thresholds and rating calculations
   - Browser storage management
   - Metric export functionality

2. **Web Vitals Hook** (`hooks/useWebVitals.ts`)
   - Integrates with `web-vitals` library
   - Sends metrics to analytics endpoint
   - Callback support for custom handling
   - Debug logging for development

3. **Performance Provider** (`components/providers/performance-provider.tsx`)
   - Wraps entire application
   - Initializes Web Vitals tracking
   - Minimal performance overhead

4. **API Endpoint** (`app/api/performance/metrics/route.ts`)
   - Receives metrics from clients
   - Stores in memory (database integration ready)
   - Provides statistics and analysis
   - Supports filtering and limiting

5. **Performance Monitor Component** (`components/settings/performance-monitor.tsx`)
   - Visual dashboard of metrics
   - Real-time updates (5-second interval)
   - Historical trends and statistics
   - Export functionality

## How It Works

### 1. Automatic Tracking

The `PerformanceProvider` is integrated into the root layout and automatically starts tracking metrics when the app loads:

```typescript
// app/layout.tsx
<PerformanceProvider>
  {children}
</PerformanceProvider>
```

### 2. Metric Collection

As users interact with the page, the `useWebVitals` hook collects metrics:

```typescript
// Automatic collection of:
- LCP (Largest Contentful Paint)
- FID (First Input Delay) / INP (Interaction to Next Paint)
- CLS (Cumulative Layout Shift)
- TTFB (Time to First Byte)
```

### 3. Storage & Reporting

Metrics are stored in two locations:

**Browser Local Storage** - For offline access and trend analysis
```json
{
  "name": "LCP",
  "value": 2300,
  "rating": "good",
  "delta": 50,
  "id": "metric-id",
  "navigationType": "navigation",
  "timestamp": 1699564800000
}
```

**Server Endpoint** - For analytics and cross-device insights
```
POST /api/performance/metrics
```

### 4. Analysis & Display

The `PerformanceMonitor` component displays:
- Real-time metric values
- Historical trends (min, max, median)
- Rating distributions (good/needs-improvement/poor)
- Page load summaries
- Export capability

## Usage

### In Components

#### Use the Web Vitals Hook Directly

```typescript
"use client";

import { useWebVitals } from "@/hooks/useWebVitals";

export default function MyComponent() {
  // Automatically tracks all metrics
  useWebVitals({
    endpoint: "/api/performance/metrics",
    debug: true,
    onMetric: (metric) => {
      console.log(`${metric.name}: ${metric.value}ms (${metric.rating})`);
    },
  });

  return <div>Your component</div>;
}
```

#### Access Metrics Programmatically

```typescript
import {
  getStoredMetrics,
  getAverageMetrics,
  getPageLoadMetrics,
} from "@/lib/performance/core-web-vitals";

// Get all stored metrics
const metrics = getStoredMetrics();

// Calculate averages
const averages = getAverageMetrics();
console.log(`Average LCP: ${averages.lcp}ms`);

// Get page load info
const pageLoad = getPageLoadMetrics();
console.log(`Total load time: ${pageLoad.pageLoadTime}ms`);
```

### View Performance Dashboard

Add the `PerformanceMonitor` component to a settings page:

```typescript
import { PerformanceMonitor } from "@/components/settings/performance-monitor";

export default function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <PerformanceMonitor />
    </div>
  );
}
```

## API Endpoints

### POST `/api/performance/metrics`

Receive and store a new performance metric.

**Request:**
```json
{
  "metric": {
    "name": "LCP",
    "value": 2300,
    "rating": "good",
    "delta": 50,
    "id": "metric-id",
    "navigationType": "navigation"
  },
  "timestamp": 1699564800000,
  "url": "https://example.com/dashboard",
  "userAgent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "success": true
}
```

### GET `/api/performance/metrics`

Retrieve stored metrics for analysis.

**Query Parameters:**
- `limit` - Number of metrics to return (default: 50, max: 500)
- `metricName` - Filter by metric name (LCP, FID, CLS, TTFB, INP)
- `rating` - Filter by rating (good, needs-improvement, poor)

**Response:**
```json
{
  "metrics": [
    {
      "metric": { ... },
      "timestamp": 1699564800000,
      "url": "https://example.com/dashboard",
      "userAgent": "..."
    }
  ],
  "stats": {
    "LCP": {
      "values": [2300, 2400, 2250],
      "ratings": { "good": 3, "needs-improvement": 0, "poor": 0 },
      "avg": 2316.67,
      "min": 2250,
      "max": 2400,
      "median": 2300
    }
  },
  "count": 3,
  "limit": 50
}
```

## Performance Impact

### Overhead

The performance monitoring system is designed to have minimal impact:

- **Library size:** `web-vitals` = 2.5 KB (gzipped)
- **Hook overhead:** < 1 KB
- **Storage overhead:** ~1 KB per metric (last 50 stored)
- **Network impact:** Single beacon request per page load (batched)

### Best Practices

1. **Use `navigator.sendBeacon()`** - Most reliable for analytics
2. **Non-blocking** - Metrics don't block page interactions
3. **Graceful degradation** - Works in all modern browsers
4. **Privacy-friendly** - No PII collected, only metrics

## Optimization Recommendations

Based on metric ratings, here are optimization strategies:

### If LCP is Poor (> 4,000 ms)

1. **Optimize images** - Use WebP, lazy load, responsive sizes
2. **Code splitting** - Load only needed JavaScript
3. **Server optimization** - Reduce TTFB
4. **Preload critical resources** - Use `<link rel="preload">`

### If FID/INP is Poor (> 300/500 ms)

1. **Break long tasks** - Use `requestIdleCallback()`
2. **Defer non-critical JS** - Use `defer` or `async`
3. **Reduce main thread work** - Profile and optimize
4. **Use Web Workers** - Offload heavy computation

### If CLS is Poor (> 0.25)

1. **Reserve space for ads** - Use placeholder boxes
2. **Avoid dynamic content shifts** - Set dimensions
3. **Use `content-visibility`** - Optimize render performance
4. **Animate safely** - Use `transform` instead of layout changes

### If TTFB is Poor (> 1,800 ms)

1. **Optimize backend** - Database queries, caching
2. **Use CDN** - Distribute content globally
3. **Enable gzip compression** - Reduce transfer size
4. **Set caching headers** - Browser and server caching

## Development

### Enable Debug Mode

```typescript
useWebVitals({
  debug: true, // Logs metrics to console
});
```

### Monitor in DevTools

1. **Chrome DevTools** → **Performance** tab → Record page load
2. **DevTools** → **Lighthouse** → Generate report
3. **DevTools** → **Network** → Check resource timing

### Export Metrics for Analysis

```typescript
import { downloadMetricsAsJSON } from "@/lib/performance/core-web-vitals";

// Download metrics as JSON
downloadMetricsAsJSON();
```

## Testing

### Manual Testing

1. Open DevTools → Performance tab
2. Record page navigation
3. Look for LCP, FID, CLS in timeline
4. Compare with thresholds

### Synthetic Testing

Use Lighthouse CI to measure performance on every commit:

```bash
npm install -g @lhci/cli
lhci autorun
```

### Real User Monitoring (RUM)

Monitor real user metrics in production:

```typescript
const metrics = await fetch("/api/performance/metrics").then(r => r.json());
console.log(metrics.stats);
```

## Future Enhancements

1. **Database Storage** - Persist metrics in SQLite
2. **Alerting** - Send notifications when metrics degrade
3. **Comparisons** - Compare metrics across versions
4. **Trends** - Historical trend analysis and predictions
5. **Device Segmentation** - Track metrics by device type
6. **Network Throttling** - Simulate different network conditions
7. **Custom Metrics** - Track app-specific performance markers

## Troubleshooting

### Metrics Not Appearing

1. **Check browser console** - Look for errors
2. **Verify endpoint** - Ensure `/api/performance/metrics` is accessible
3. **Check localStorage** - Metrics stored at `cwv_metrics` key
4. **Network tab** - Check if beacon requests are sent
5. **Clear cache** - Hard refresh and try again

### High Metrics Values

1. **Device** - Test on slower devices
2. **Network** - Test on slower networks (DevTools throttling)
3. **Load time** - Check if resources are properly optimized
4. **Third-party scripts** - Audit for slow external scripts

### Development vs Production

Development build may show different metrics:
- Use production build for accurate measurements
- Disable sourcemaps for faster load
- Use real network conditions (not localhost)

## References

- [Google Web Vitals](https://web.dev/vitals/)
- [web-vitals Library](https://github.com/GoogleChrome/web-vitals)
- [Core Web Vitals Report](https://support.google.com/webmasters/answer/9205520)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

## Checklist for Implementation

- [x] Install web-vitals library
- [x] Create Core Web Vitals utility (`lib/performance/core-web-vitals.ts`)
- [x] Create useWebVitals hook (`hooks/useWebVitals.ts`)
- [x] Create PerformanceProvider component
- [x] Create metrics API endpoint
- [x] Create PerformanceMonitor dashboard component
- [x] Integrate PerformanceProvider into root layout
- [ ] Deploy to production and monitor
- [ ] Set up Lighthouse CI for continuous monitoring
- [ ] Create performance alerts and notifications
- [ ] Implement database storage for long-term analysis

## Summary

The performance monitoring system provides real-time tracking of Core Web Vitals metrics across the application. It's fully automatic, has minimal overhead, and provides actionable insights for optimization. The system is production-ready and can be extended with database storage and alerting for enterprise use.
