# Phase 6 Remaining Tasks - Quick Start Guide

## For Quick Wins: Performance Baseline (15 minutes)

```bash
# Build the project
pnpm build

# Start production server
pnpm start

# Open http://localhost:3000 in browser
# Open DevTools (F12) → Lighthouse tab
# Click "Analyze page load"
# Note the Core Web Vitals scores
```

**What to look for:**
- First Contentful Paint (FCP): Target <1.8s
- Largest Contentful Paint (LCP): Target <2.5s
- Cumulative Layout Shift (CLS): Target <0.1
- Time to Interactive (TTI): Target <3.8s

## For Task 1: Performance Optimization

### Step 1: Bundle Analysis (1 hour)
```bash
# Install bundle analyzer
pnpm add -D @next/bundle-analyzer

# Create analyze-bundle.js
node_modules/.bin/next-bundle-analyzer -- -p 3001

# Update next.config.ts to use it
```

### Step 2: Performance Monitoring (4-6 hours)
```bash
# Option A: Web Vitals library
pnpm add web-vitals

# Option B: Custom performance tracking
# Create: lib/performance/performance-tracker.ts
# Track: Core Web Vitals, API response times, render times

# Option C: Third-party service
# Sentry, LogRocket, or similar
```

### Step 3: Create Baseline Metrics
```typescript
// Create: app/api/performance/metrics/route.ts
export async function GET() {
  // Return Core Web Vitals
  // Return API response times
  // Return cache hit rates
}
```

## For Task 2: Cron Data Cleanup

### Step 1: Create Cleanup Endpoint Template
```typescript
// app/api/cron/cleanup.ts
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Verify cron secret
  const secret = request.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run cleanup tasks
    const results = {
      notificationsDeleted: 0,
      activitiesArchived: 0,
      offlineTransactionsCleared: 0,
      timestamp: new Date().toISOString(),
    };

    return Response.json(results);
  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
```

### Step 2: Create Cleanup Utilities
```typescript
// lib/cleanup/notification-cleanup.ts
export async function deleteOldNotifications(daysOld: number = 30) {
  // DELETE FROM notifications WHERE created_at < now() - days_old
  // Return count deleted
}

// lib/cleanup/activity-cleanup.ts
export async function archiveOldActivities(daysOld: number = 90) {
  // Archive completed activities older than N days
  // Return count archived
}

// lib/cleanup/orphan-cleanup.ts
export async function removeOrphanedData() {
  // Remove splits with no parent transaction
  // Remove tags with no transactions
  // Return count removed
}
```

### Step 3: Schedule Cron Job
```json
// vercel.json (if using Vercel)
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"  // 2 AM UTC daily
    }
  ]
}
```

**Or for cron-job.org:**
- URL: `https://yourdomain.com/api/cron/cleanup`
- Schedule: `0 2 * * *`
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

## For Task 3: Usage Decay Algorithm

### Step 1: Design Algorithm
Choose one (or implement custom):

**Option A: Time-Weighted Decay**
```typescript
// Simple, easy to understand
// score = usageCount / (1 + (daysSinceLastUse / 7))
// Items lose 50% relevance every week

decayedScore = usageCount / (1 + (daysSinceLastUse / 7));
```

**Option B: Exponential Decay**
```typescript
// More aggressive for old items
// score = usageCount * Math.exp(-0.1 * daysSinceLastUse)
// Half-life of ~7 days

const lambda = 0.1;
decayedScore = usageCount * Math.exp(-lambda * daysSinceLastUse);
```

**Option C: Recency Bonus**
```typescript
// Keep usage count, add time bonus
// score = usageCount + recencyBonus
// Recent items get bonus points

const daysSinceLastUse = (now - lastUsedAt) / (1000 * 60 * 60 * 24);
const recencyBonus = Math.max(0, 10 - Math.floor(daysSinceLastUse / 7));
decayedScore = usageCount + recencyBonus;
```

### Step 2: Create Calculator
```typescript
// lib/usage/decay-calculator.ts
export function calculateDecayedScore(
  usageCount: number,
  lastUsedAt: Date,
  decayRate: number = 0.1
): number {
  const now = new Date();
  const daysSinceLastUse = (now.getTime() - lastUsedAt.getTime()) / 
                           (1000 * 60 * 60 * 24);
  
  // Using exponential decay formula
  return usageCount * Math.exp(-decayRate * daysSinceLastUse);
}
```

### Step 3: Integrate into Queries
```typescript
// app/api/accounts/route.ts - Example
import { calculateDecayedScore } from '@/lib/usage/decay-calculator';

export async function GET() {
  const accounts = await db.query.accounts.findMany({
    where: eq(schema.accounts.userId, userId),
  });

  // Calculate decayed scores
  const withDecay = accounts.map(account => ({
    ...account,
    decayedScore: calculateDecayedScore(
      account.usageCount,
      new Date(account.lastUsedAt || account.createdAt)
    ),
  }));

  // Sort by decayed score
  return Response.json(
    withDecay.sort((a, b) => b.decayedScore - a.decayedScore)
  );
}
```

### Step 4: Create Cron Job (Optional)
```typescript
// lib/usage/decay-scheduler.ts
export async function updateDecayedScores() {
  // Periodically recalculate all decayed scores
  // Store in database for faster queries
  // Or calculate on-the-fly (simpler)
}

// app/api/cron/update-usage-decay.ts
export async function POST(request: Request) {
  await updateDecayedScores();
  return Response.json({ success: true });
}
```

## Implementation Priorities

**Week 1: Performance (8-12 hours)**
- [ ] Run Lighthouse baseline
- [ ] Set up bundle analysis
- [ ] Create performance tracking
- [ ] Document findings

**Week 2: Cron Cleanup (10-15 hours)**
- [ ] Create cleanup endpoints
- [ ] Add database cleanup utilities
- [ ] Set up cron scheduling
- [ ] Add monitoring

**Week 3-4: Decay Algorithm (16-23 hours)**
- [ ] Choose decay algorithm
- [ ] Implement calculator
- [ ] Integrate into API routes
- [ ] Test and monitor

## Testing the Implementation

### Performance:
```bash
# Measure page load time
curl -w "%{time_total}\n" -o /dev/null -s https://yourdomain.com

# Check cache hit rates (DevTools Network tab)
# Look for: (disk cache), (memory cache) status
```

### Cron Jobs:
```bash
# Test manually
curl -H "Authorization: Bearer YOUR_SECRET" \
  -X POST https://yourdomain.com/api/cron/cleanup

# Check logs for execution
tail -f .next/output.log
```

### Decay Algorithm:
```typescript
// Test decay calculation
import { calculateDecayedScore } from '@/lib/usage/decay-calculator';

const score1 = calculateDecayedScore(100, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));  // 1 week old
const score2 = calculateDecayedScore(100, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 1 month old

console.log('1 week old:', score1);  // Should be ~60.65
console.log('1 month old:', score2); // Should be ~3.12
// Score drops significantly over time
```

## Files to Reference

### Existing Patterns:
- `app/api/notifications/bill-reminders/route.ts` - Cron endpoint pattern
- `lib/notifications/bill-reminders.ts` - Utility function pattern
- `lib/service-worker/cache-manager.ts` - Performance monitoring pattern
- `components/transactions/transaction-form.tsx` - Sorting/filtering pattern

### Documentation:
- `docs/SERVICE_WORKER_CACHING.md` - Cache strategies
- `docs/CRON_JOB_SETUP.md` - Cron setup options
- `docs/USAGE_TRACKING_OPTIMIZATION.md` - Performance benchmarks

## Environment Variables Needed

```bash
# For cron security
CRON_SECRET=your-random-secret-here

# For performance monitoring (optional)
NEXT_PUBLIC_PERFORMANCE_MONITORING=true
SENTRY_DSN=your-sentry-dsn  # if using Sentry

# For decay algorithm (optional)
NEXT_PUBLIC_USAGE_DECAY_ENABLED=true
NEXT_PUBLIC_DECAY_RATE=0.1
```

## Common Issues & Solutions

### Issue: Slow performance after changes
**Solution:** Check cache headers in next.config.ts, verify indexes are being used

### Issue: Cron job not running
**Solution:** Check authorization header, verify cron service credentials, check logs

### Issue: Decay algorithm making rankings weird
**Solution:** Adjust decay rate parameter, consider hybrid approach (count + recency), test with small user group first

