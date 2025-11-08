# Bundle Size Optimization Guide

## Overview

This guide covers strategies for optimizing bundle size in the Unified Ledger application. Current infrastructure includes service worker caching (5-10x improvement for repeat visits) and performance monitoring. This document focuses on initial load optimization.

## Current Status

### What's Already Optimized ✅
- Service worker caching for static assets (cache-first strategy)
- API endpoint caching with stale-while-revalidate (5-minute TTL)
- Google Fonts caching (1-year expiration)
- Production build with tree-shaking enabled
- Turbopack bundler for fast builds
- Next.js Image Optimization

### Baseline Metrics
- Total build size: ~500-800 KB (initial estimate)
- Gzipped size: ~150-200 KB (initial estimate)
- First load time: ~2-3 seconds (depends on network)
- Repeat visits: ~500ms (with service worker caching)

## Core Principles

### 1. **Route-Based Code Splitting**
Load code only for the routes users visit.

```typescript
// Example: Dashboard page
import dynamic from 'next/dynamic';

const BillsDashboard = dynamic(() => import('./bills'), {
  loading: () => <div>Loading bills...</div>,
  ssr: false, // Only load on client side
});

export default function Dashboard() {
  return (
    <>
      <h1>Dashboard</h1>
      <BillsDashboard />
    </>
  );
}
```

### 2. **Component-Level Code Splitting**
Lazy load heavy components that aren't critical.

```typescript
// Heavy component lazy load
const AdvancedSearch = dynamic(() => import('./advanced-search'), {
  loading: () => <div className="h-12 bg-gray-700 rounded animate-pulse" />,
});
```

### 3. **Library Optimization**
Replace heavy libraries or load them dynamically.

```typescript
// Good: Use lighter alternatives
import { format } from 'date-fns'; // 13 KB vs moment 266 KB

// Or dynamic import for rarely-used features
const ChartComponent = dynamic(() => import('recharts'), {
  ssr: false,
});
```

### 4. **Tree Shaking**
Ensure all dependencies support ES modules and named imports.

```typescript
// ✅ Good: Named imports enable tree-shaking
import { format, parseISO } from 'date-fns';

// ❌ Avoid: Default imports prevent tree-shaking
import * as dateFns from 'date-fns';
```

## Implementation Strategies

### Strategy 1: Route-Based Code Splitting

**Files to Update:** Dashboard pages and heavy feature pages

```typescript
// app/dashboard/bills/page.tsx
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const BillsDashboard = dynamic(() => import('@/components/bills/bills-dashboard'), {
  loading: () => <BillsSkeleton />,
  ssr: true, // Server-render for SEO if needed
});

export default function BillsPage() {
  return (
    <Suspense fallback={<BillsSkeleton />}>
      <BillsDashboard />
    </Suspense>
  );
}
```

### Strategy 2: Modal/Dialog Code Splitting

**Heavy modals** that aren't always shown should be lazily loaded:

```typescript
// components/transaction-form-modal.tsx
import dynamic from 'next/dynamic';
import { useState } from 'react';

const TransactionForm = dynamic(() => import('./transaction-form'), {
  loading: () => <FormSkeleton />,
});

export function TransactionModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Add Transaction</button>
      {open && <TransactionForm onClose={() => setOpen(false)} />}
    </>
  );
}
```

### Strategy 3: Library-Level Optimization

**Replace heavy libraries:**

| Current | Alternative | Savings |
|---------|-------------|---------|
| moment.js (266 KB) | date-fns (13 KB) | 253 KB |
| lodash (70 KB) | lodash-es + tree-shake (20 KB) | 50 KB |
| axios (14 KB) | fetch API (0 KB) | 14 KB |
| recharts (large) | Smaller chart lib or canvas | 30-50 KB |

## Code Splitting Checklist

### Phase 1: Route-Level Splitting (Quick Wins)

- [ ] Dashboard transactions page - lazy load advanced features
- [ ] Bills page - lazy load calendar/timeline views
- [ ] Goals/Debts pages - lazy load detail modals
- [ ] Categories page - lazy load category editor

**Estimated savings:** 50-100 KB

```typescript
// Example: app/dashboard/transactions/page.tsx
import dynamic from 'next/dynamic';

const AdvancedSearch = dynamic(
  () => import('@/components/advanced-search'),
  { loading: () => <SearchSkeleton />, ssr: false }
);

const TransactionDetails = dynamic(
  () => import('@/components/transaction-details'),
  { loading: () => <div>Loading...</div>, ssr: false }
);
```

### Phase 2: Component-Level Splitting (Medium Effort)

- [ ] Split large form components
- [ ] Lazy load chart components
- [ ] Lazy load calendar views
- [ ] Split notification system

**Estimated savings:** 30-50 KB

### Phase 3: Library Optimization (High Effort)

- [ ] Audit and replace heavy dependencies
- [ ] Convert to lighter alternatives
- [ ] Use dynamic imports for optional features
- [ ] Remove unused dependencies

**Estimated savings:** 50-150 KB

## Implementation Checklist for Phase 1

### 1. Dashboard Transactions Page

```typescript
// app/dashboard/transactions/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { TransactionList } from '@/components/transactions/transaction-list';
import { TransactionListSkeleton } from '@/components/transactions/transaction-skeleton';

// Lazy load advanced features
const AdvancedSearch = dynamic(
  () => import('@/components/transactions/advanced-search'),
  {
    loading: () => <TransactionListSkeleton />,
    ssr: false,
  }
);

export default function TransactionsPage() {
  return (
    <div>
      <AdvancedSearch />
      <TransactionList />
    </div>
  );
}
```

### 2. Bills Page

```typescript
// app/dashboard/bills/page.tsx
import dynamic from 'next/dynamic';

const BillsCalendar = dynamic(
  () => import('@/components/bills/bills-calendar'),
  {
    ssr: false,
    loading: () => <CalendarSkeleton />,
  }
);

export default function BillsPage() {
  return <BillsCalendar />;
}
```

### 3. Add Skeleton Components

Create lightweight skeleton loaders for lazy-loaded sections:

```typescript
// components/transactions/transaction-skeleton.tsx
export function TransactionListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-700 rounded animate-pulse" />
      ))}
    </div>
  );
}
```

## Next.js Configuration

### Update `next.config.ts`

```typescript
import type { NextConfig } from "next";
import withPWA from "next-pwa";

const withPWAConfig = withPWA({
  dest: "public",
  // ... other config
});

const nextConfig: NextConfig = {
  turbopack: {
    // Enable advanced optimizations
    resolveAlias: {
      // Add path aliases for smaller imports
    },
  },
  // Compress output
  compress: true,
  // Generate source maps only in development
  productionBrowserSourceMaps: false,
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
  },
};

export default withPWAConfig(nextConfig);
```

### Update `tsconfig.json`

Ensure tree-shaking is enabled:

```json
{
  "compilerOptions": {
    "lib": ["es2020"],
    "module": "es2020",
    "moduleResolution": "bundler"
  }
}
```

## Bundle Analysis Tools

### Using Bundle Analyzer Utility

```typescript
import {
  analyzeBundle,
  generateBundleReport,
  getBundleOptimizationTips,
} from '@/lib/performance/bundle-analyzer';

// Analyze bundle
const analysis = analyzeBundle([
  {
    name: 'react',
    size: 42000,
    gzipSize: 13000,
    type: 'library',
    chunks: ['main'],
    risk: 'safe',
  },
  // ... more modules
]);

// Generate report
const report = generateBundleReport(analysis);
console.log(report);

// Get tips
const tips = getBundleOptimizationTips();
```

### Lighthouse Bundle Analysis

1. Open DevTools → Lighthouse
2. Run audit with "Performance" category
3. Check "Coverage" tab for unused code
4. Review "Main thread work" breakdown

### Next.js Build Analysis

Add to `package.json`:

```json
{
  "scripts": {
    "build:analyze": "ANALYZE=true pnpm build"
  }
}
```

Install analyzer:
```bash
pnpm add -D @next/bundle-analyzer
```

Update `next.config.ts`:
```typescript
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer(nextConfig);
```

Run: `pnpm build:analyze`

## Monitoring & Alerts

### Set Size Budgets

In `.github/workflows/bundle-check.yml`:

```yaml
name: Bundle Size Check
on: [pull_request]

jobs:
  bundle:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check bundle size
        run: |
          pnpm build
          SIZE=$(stat -f%z .next/static/chunks/main*.js 2>/dev/null || du -b .next/static/chunks/main*.js | cut -f1)
          LIMIT=$((200 * 1024)) # 200 KB limit
          if [ $SIZE -gt $LIMIT ]; then
            echo "❌ Bundle too large: $SIZE > $LIMIT"
            exit 1
          fi
          echo "✅ Bundle size OK: $SIZE bytes"
```

### Performance Dashboard

Use the `PerformanceMonitor` component to track:
- Bundle load time
- Time to Interactive (TTI)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)

## Expected Results

### Current Baseline
- Initial load: ~2-3 seconds
- Bundle size (gzipped): ~150-200 KB

### After Phase 1 (Route-level splitting)
- Initial load: ~1.5-2 seconds
- Bundle size (gzipped): ~100-150 KB
- Savings: 20-40%

### After Phase 2 (Component-level splitting)
- Initial load: ~1-1.5 seconds
- Bundle size (gzipped): ~80-120 KB
- Savings: 40-50%

### After Phase 3 (Library optimization)
- Initial load: <1 second
- Bundle size (gzipped): <100 KB
- Savings: 50-60%

## Performance Targets

Based on Google Web Vitals:

| Metric | Target | Current | Goal |
|--------|--------|---------|------|
| **LCP** | ≤ 2.5s | ~2-3s | ≤ 2.5s |
| **FID** | ≤ 100ms | ~150-300ms | ≤ 100ms |
| **CLS** | ≤ 0.1 | ~0.1-0.2 | ≤ 0.1 |
| **Bundle (gzip)** | < 100 KB | ~150-200 KB | < 100 KB |

## Quick Reference

### Lazy Load a Heavy Component
```typescript
import dynamic from 'next/dynamic';

const Heavy = dynamic(() => import('./heavy'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

### Check Bundle Size
```bash
# Analyze build
pnpm build:analyze

# Or check specific file
du -h .next/static/chunks/main*.js
```

### Test Performance
```bash
# Build and test
pnpm build && pnpm start

# Open http://localhost:3000 and use DevTools Lighthouse
```

## References

- [Next.js Code Splitting](https://nextjs.org/docs/advanced-features/dynamic-import)
- [Web Vitals Guide](https://web.dev/vitals/)
- [JavaScript.info - Code Splitting](https://javascript.info/import-export)
- [Bundle Analyzer](https://github.com/vercel/next.js/tree/canary/packages/next-bundle-analyzer)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

## Summary

The bundle optimization strategy focuses on:

1. **Route-based code splitting** - Load page code on-demand
2. **Component lazy loading** - Load heavy components when needed
3. **Library optimization** - Use lighter alternatives
4. **Tree shaking** - Ensure unused code is removed
5. **Service worker caching** - Cache assets for faster repeat visits

Expected improvement: 50-60% reduction in initial bundle size, with <1 second initial load time after all phases are implemented.
