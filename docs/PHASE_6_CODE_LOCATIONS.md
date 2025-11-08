# Phase 6 Remaining Tasks - Code Locations Reference

## Performance Optimization - Existing Code Locations

### Configuration
- **Next.js Config:** `/next.config.ts` (45 lines)
  - Turbopack enabled
  - PWA configuration
  - Runtime caching setup

- **TypeScript Config:** `/tsconfig.json` (34 lines)
  - ES2017 target
  - Strict mode enabled
  - Path aliases configured

### Service Worker & Caching
- **Custom Service Worker:** `/public/sw.js` (6.8 KB)
  - Cache-first for static assets
  - Stale-while-revalidate for API
  - Network-first for HTML

- **Cache Manager Library:** `/lib/service-worker/cache-manager.ts` (400+ lines)
  - Service worker registration
  - Cache status monitoring
  - Storage quota management
  - Pre-caching utilities

- **Service Worker Hook:** `/hooks/useServiceWorker.ts` (250+ lines)
  - Register SW on mount
  - Monitor cache status
  - Listen for updates
  - Background sync support

- **Cache Settings UI:** `/components/settings/cache-settings.tsx` (200+ lines)
  - Storage usage display
  - Cache management buttons
  - Status indicators

### Database Performance
- **Schema with Indexes:** `/lib/db/schema.ts` (lines 16-172)
  - `idx_accounts_user_usage` - Account sorting
  - `idx_budget_categories_user_type` - Category filtering
  - `idx_merchants_user_usage` - Merchant sorting
  - `idx_tags_user_usage` - Tag sorting
  - `idx_custom_fields_user_active` - Field filtering
  - Plus 5 more indexes

### Documentation
- **Service Worker Caching:** `/docs/SERVICE_WORKER_CACHING.md` (500+ lines)
- **Usage Tracking Optimization:** `/docs/USAGE_TRACKING_OPTIMIZATION.md` (280+ lines)
- **PWA Setup Complete:** `/docs/PWA_SETUP_COMPLETE.md`
- **One-Handed Optimization:** `/docs/ONE_HANDED_OPTIMIZATION.md`
- **Haptic Feedback:** `/docs/HAPTIC_FEEDBACK.md`

### Package Dependencies
- **package.json** (lines 13-48)
  - `next@16.0.1`
  - `next-pwa@5.6.0`
  - `recharts@3.3.0`
  - `sonner@2.0.7`

---

## Cron Job Infrastructure - Existing Code Locations

### Cron-Compatible Endpoints
1. **Bill Reminders:** `/app/api/notifications/bill-reminders/route.ts` (66 lines)
   - POST: Trigger bill reminder checks
   - GET: Returns endpoint info
   - Utility: `lib/notifications/bill-reminders.ts`

2. **Budget Warnings:** `/app/api/notifications/budget-warnings/route.ts` (65 lines)
   - POST: Check budget thresholds
   - GET: Returns endpoint info
   - Utility: `lib/notifications/budget-warnings.ts`

3. **Low Balance Alerts:** `/app/api/notifications/low-balance-alerts/route.ts`
   - POST: Check account balances
   - Utility: `lib/notifications/low-balance-alerts.ts`

4. **Savings Milestones:** `/app/api/notifications/savings-milestones/route.ts`
   - POST: Check savings progress
   - Utility: `lib/notifications/savings-milestones.ts`

5. **Debt Milestones:** `/app/api/notifications/debt-milestones/route.ts`
   - POST: Check debt payoff progress
   - Utility: `lib/notifications/debt-milestones.ts`

### Notification Service
- **Main Service:** `/lib/notifications/notification-service.ts` (7,755 lines)
  - 10 notification types
  - Priority levels (low, normal, high, urgent)
  - CRUD operations
  - Unread count tracking

### Cron Setup Documentation
- **Cron Job Setup Guide:** `/docs/CRON_JOB_SETUP.md` (200+ lines)
  - 5 setup options explained
  - Security considerations
  - Recommended schedules

### Related Endpoints (No Cron Yet)
- `/app/api/notifications/route.ts` - List/create notifications
- `/app/api/notifications/[id]/route.ts` - Get/update/delete notification
- `/app/api/notification-preferences/route.ts` - User preferences

---

## Usage Tracking - Existing Code Locations

### Database Schema
- **Main Schema:** `/lib/db/schema.ts`
  - `accounts` table (line 16): `usageCount`, `lastUsedAt`
  - `budgetCategories` table (line 46): `usageCount`, `lastUsedAt`
  - `merchants` table (line 71): `usageCount`, `lastUsedAt`, `totalSpent`
  - `usageAnalytics` table (line 97): Comprehensive tracking table
  - All have performance indexes

### API Endpoints Using Usage Tracking
- `/app/api/accounts/route.ts` - Sorted by usage
- `/app/api/categories/route.ts` - Sorted by usage
- `/app/api/merchants/route.ts` - Sorted by usage
- `/app/api/tags/route.ts` - Sorted by usage
- `/app/api/custom-fields/route.ts` - Sorted by usage
- `/app/api/transfers/suggest/route.ts` - Usage-based suggestions

### Usage Analytics
- **Usage Analytics Table:** `/lib/db/schema.ts` (lines 97-121)
  - `itemType`: account, category, merchant, transfer_pair, bill
  - `usageCount`: Counter
  - `lastUsedAt`: Timestamp
  - `contextData`: JSON metadata
  - Unique index on (userId, itemType, itemId, itemSecondaryId)

### Sorting/Filtering Components
- `/components/transactions/account-selector.tsx` - Account dropdown
- `/components/transactions/category-selector.tsx` - Category dropdown
- `/components/transactions/merchant-autocomplete.tsx` - Merchant search
- `/components/tags/tag-selector.tsx` - Tag selection
- `/components/transactions/transaction-form.tsx` - Main form with all selectors

---

## Where to Add New Code

### For Task 1: Performance Optimization
**New files to create:**
```
/lib/performance/
  ├── performance-tracker.ts (Core Web Vitals tracking)
  ├── api-performance.ts (API response time tracking)
  └── memory-monitoring.ts (Memory usage tracking)

/app/api/performance/
  ├── metrics/route.ts (GET metrics endpoint)
  └── report/route.ts (Send performance data)

/components/performance/
  ├── performance-dashboard.tsx (Dashboard widget)
  └── core-web-vitals-badge.tsx (Status indicator)

/docs/
  └── PERFORMANCE_MONITORING.md (Setup and usage guide)
```

### For Task 2: Cron Data Cleanup
**New files to create:**
```
/lib/cleanup/
  ├── notification-cleanup.ts (Delete old notifications)
  ├── activity-cleanup.ts (Archive old activities)
  ├── orphan-cleanup.ts (Remove orphaned data)
  ├── offline-cleanup.ts (Clear stale offline entries)
  └── database-optimization.ts (VACUUM, ANALYZE)

/app/api/cron/
  ├── cleanup/route.ts (Main cleanup orchestrator)
  ├── maintenance/route.ts (Database maintenance)
  └── monitoring/route.ts (Track cleanup metrics)

/lib/cleanup-jobs/
  ├── notification-retention.ts (Define retention policies)
  ├── activity-retention.ts (Activity archive rules)
  └── storage-limits.ts (Storage quota management)

/docs/
  └── DATA_CLEANUP_GUIDE.md (Setup and monitoring)
```

### For Task 3: Usage Decay Algorithm
**New files to create:**
```
/lib/usage/
  ├── decay-calculator.ts (Core algorithm)
  ├── decay-strategies.ts (Multiple algorithm options)
  ├── decay-scheduler.ts (Background job handler)
  └── decay-config.ts (User configuration)

/app/api/usage/
  ├── decay/route.ts (Manual decay trigger)
  ├── decay/calculate/route.ts (Test decay calculation)
  └── decay/config/route.ts (User decay settings)

/components/usage/
  ├── decay-settings.tsx (Configure decay algorithm)
  ├── decay-preview.tsx (Preview decay effect)
  └── usage-score-display.tsx (Show decayed scores)

/docs/
  ├── USAGE_DECAY_ALGORITHM.md (Algorithm explanation)
  └── USAGE_DECAY_IMPLEMENTATION.md (Integration guide)
```

---

## Files to Update for Each Task

### Task 1: Performance
- `/next.config.ts` - Add bundle analyzer configuration
- `/package.json` - Add performance monitoring dependencies
- `/app/layout.tsx` - Initialize performance tracking
- `/app/dashboard/page.tsx` - Add performance dashboard widget

### Task 2: Cron Cleanup
- `/lib/db/schema.ts` - Add retention_archived field (optional)
- `/package.json` - Add cleanup dependencies (none typically needed)
- `/vercel.json` - Add cron schedule if using Vercel
- `/.env.local` - Add CRON_SECRET for authentication

### Task 3: Usage Decay
- `/lib/db/schema.ts` - Add decayedScore field (optional)
- `/app/api/accounts/route.ts` - Apply decay in sorting
- `/app/api/categories/route.ts` - Apply decay in sorting
- `/app/api/merchants/route.ts` - Apply decay in sorting
- `/app/api/tags/route.ts` - Apply decay in sorting
- `/app/api/custom-fields/route.ts` - Apply decay in sorting

---

## Key Functions to Reference

### Service Worker (Performance)
```typescript
// From: /lib/service-worker/cache-manager.ts

export async function registerServiceWorker()
export async function getCacheStatus()
export async function clearAllCaches()
export async function getCacheSize()
export async function isStorageLow()
export async function cleanupCache()
```

### Notifications (Cron Jobs)
```typescript
// From: /lib/notifications/notification-service.ts

export class NotificationService {
  static async create()
  static async getUnreadCount()
  static async markAsRead()
  static async delete()
  static async getAll()
}

// From: /lib/notifications/bill-reminders.ts
export async function checkAndCreateBillReminders()

// From: /lib/notifications/budget-warnings.ts
export async function checkAndCreateBudgetWarnings()
```

### Usage Tracking (Current)
```typescript
// From: /lib/db/schema.ts

// Update function patterns (in API routes):
db.update(schema.accounts)
  .set({ usageCount: schema.accounts.usageCount + 1, lastUsedAt: now })
  .where(eq(schema.accounts.id, accountId))

// Query patterns with sorting:
db.query.accounts.findMany({
  where: eq(schema.accounts.userId, userId),
  orderBy: desc(schema.accounts.usageCount)
})
```

---

## Testing Utilities

### For Performance
- **DevTools Lighthouse:** Built-in (F12 → Lighthouse)
- **Chrome Performance Tab:** DevTools → Performance
- **Network Tab:** DevTools → Network (cache status)
- **Coverage Tab:** DevTools → Coverage (unused code)

### For Cron Jobs
```bash
# Test endpoint manually
curl -H "Authorization: Bearer YOUR_SECRET" \
  -X POST http://localhost:3000/api/cron/cleanup

# View logs
tail -f .next/server.log
```

### For Decay Algorithm
```typescript
// Test in Node console
const { calculateDecayedScore } = await import('./lib/usage/decay-calculator.ts');

const score = calculateDecayedScore(
  100,  // usageCount
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),  // 1 week ago
  0.1   // decayRate
);
```

---

## Development Tips

### Quick Performance Check
```bash
pnpm build && pnpm start
# Open http://localhost:3000
# F12 → Lighthouse → Analyze page load
```

### View Database Indexes
```bash
# Using drizzle-kit
pnpm db:studio

# Or manually in SQLite
sqlite3 .sqlite
PRAGMA index_info(idx_accounts_user_usage);
```

### Monitor Cron Jobs
```bash
# Check if endpoint works
curl https://yourdomain.com/api/notifications/bill-reminders

# Check logs
grep "cron\|cleanup" .next/server.log
```

