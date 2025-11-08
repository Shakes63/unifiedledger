# Phase 6 Remaining Tasks - Exploration Summary

## Overview
Analysis of the Unified Ledger codebase to understand current status of the three remaining Phase 6 tasks and what infrastructure already exists.

---

## Task 1: Performance Optimization (<2s load)

### Current Status: PARTIAL ✓

#### What Exists:
1. **Next.js Configuration** (`next.config.ts`)
   - Turbopack enabled for fast builds
   - PWA support with runtime caching
   - Static asset caching (cache-first strategy)
   - API endpoint caching (stale-while-revalidate, 5-minute TTL)
   - Google Fonts cached for 1 year

2. **Service Worker Implementation** (`public/sw.js` - 6.8 KB)
   - Custom service worker with intelligent caching strategies
   - 3 caching strategies: cache-first, stale-while-revalidate, network-first
   - Automatic cache versioning and cleanup
   - Cross-origin request handling

3. **Cache Manager Library** (`lib/service-worker/cache-manager.ts`)
   - Complete TypeScript API for cache management
   - Storage quota monitoring
   - Cache size calculation
   - Low storage detection
   - Background sync support

4. **React Service Worker Hook** (`hooks/useServiceWorker.ts`)
   - Service worker registration and status tracking
   - Periodic cache status updates (30s interval)
   - Background sync listening
   - Error handling

5. **Cache Settings Component** (`components/settings/cache-settings.tsx`)
   - Service worker status indicator
   - Real-time storage usage display
   - Cache cleanup and clear buttons
   - Educational information

6. **Database Indexes for Performance** (Phase 1 Complete)
   - 10 new indexes on accounts, categories, merchants, tags, custom fields
   - Expected 50-80% improvement for usage-based operations
   - Composite indexes on (user_id, usage_count), (user_id, type), etc.

7. **Documentation:**
   - `SERVICE_WORKER_CACHING.md` (500+ lines) - Complete caching guide
   - `USAGE_TRACKING_OPTIMIZATION.md` - Performance metrics and benchmarks
   - `PWA_SETUP_COMPLETE.md` - PWA setup details
   - `ONE_HANDED_OPTIMIZATION.md` - Mobile UX optimization
   - `HAPTIC_FEEDBACK.md` - Haptic feedback implementation

#### What's Missing:
1. **Lighthouse Audit Data** - No baseline metrics or audit reports
2. **Performance Monitoring** - No real-time performance tracking infrastructure
3. **Bundle Analysis** - No webpack-bundle-analyzer or similar tool
4. **Performance Benchmarks** - No before/after metrics from actual users
5. **Load Testing** - No k6, Artillery, or similar load testing setup
6. **Caching Metrics Dashboard** - No way to visualize cache hit rates
7. **Core Web Vitals Tracking** - No CWV monitoring implementation

#### Estimated Implementation Time:
- Lighthouse audit baseline: 1 hour
- Bundle analysis setup: 1-2 hours
- Performance monitoring infrastructure: 4-6 hours
- Documentation: 2-3 hours
- **Total: 8-12 hours**

---

## Task 2: Cron Job Infrastructure for Data Cleanup

### Current Status: PARTIAL ✓

#### What Exists:

1. **5 Cron-Compatible Endpoints** (Already Implemented):
   - `POST /api/notifications/bill-reminders` - Check upcoming/overdue bills
   - `POST /api/notifications/budget-warnings` - Check budget spending
   - `POST /api/notifications/low-balance-alerts` - Check account balances
   - `POST /api/notifications/savings-milestones` - Check savings progress
   - `POST /api/notifications/debt-milestones` - Check debt payoff progress

2. **Cron Setup Documentation** (`docs/CRON_JOB_SETUP.md`)
   - 5 setup options documented:
     - Vercel Cron (recommended for Vercel deployments)
     - cron-job.org (free third-party service)
     - EasyCron (alternative free service)
     - AWS EventBridge (production)
     - Coolify Cron (if deploying with Coolify)
   - All endpoints have recommended schedules
   - Security considerations documented

3. **Notification Service** (`lib/notifications/notification-service.ts`)
   - 10 notification types supported
   - Priority levels (low, normal, high, urgent)
   - Unread count tracking
   - Metadata storage for rich notifications

4. **Utility Functions** for Notification Checks:
   - `lib/notifications/bill-reminders.ts`
   - `lib/notifications/budget-warnings.ts`
   - `lib/notifications/low-balance-alerts.ts`
   - `lib/notifications/savings-milestones.ts`
   - `lib/notifications/debt-milestones.ts`

#### What's Missing:

1. **Data Cleanup Endpoints** - No endpoints for:
   - Cleaning up old notifications (>30 days)
   - Archiving completed activities
   - Removing duplicate usage analytics entries
   - Clearing stale offline transaction entries
   - Purging old audit logs

2. **Cleanup Utilities** - No functions for:
   - Archiving old notifications
   - Removing orphaned data
   - Compacting the database
   - Managing storage growth

3. **Data Retention Policies** - Not defined:
   - How long to keep notifications
   - When to archive activities
   - Transaction history retention period
   - Rule execution log retention

4. **Monitoring** - No setup for:
   - Cron job execution tracking
   - Failure alerts
   - Performance monitoring of cron jobs
   - Database size monitoring

5. **Actual Cron Endpoint Routes** - Not created:
   - `/api/cron/cleanup` or similar
   - No dedicated cron folder structure
   - No cron job scheduler orchestration

#### Estimated Implementation Time:
- Data cleanup endpoints (5 endpoints): 2-3 hours
- Cleanup utility functions: 2-3 hours
- Database compaction/optimization: 1-2 hours
- Monitoring and alerts setup: 3-4 hours
- Documentation: 2-3 hours
- **Total: 10-15 hours**

---

## Task 3: Usage Decay Algorithm Implementation

### Current Status: NOT STARTED ✗

#### What Exists:

1. **Usage Tracking Infrastructure:**
   - `usageCount` field on: accounts, categories, merchants, tags, custom_fields
   - `lastUsedAt` timestamp on: accounts, merchants, tags
   - `usageAnalytics` table with comprehensive tracking
   - 10 performance indexes for usage-based queries
   - Usage sorting implemented in all dropdowns

2. **Current Behavior:**
   - Simple usage counting (increment on each use)
   - No decay or time-based weighting
   - Most-used items always appear at top
   - Old items stay high if used frequently in past
   - Example: Item used 100 times 2 years ago still ranks above item used 5 times this week

#### What's Missing:

1. **Decay Algorithm** - Not implemented:
   - No exponential decay function
   - No time-weighted scoring
   - No recency bonus
   - No implementation of time-decay algorithms (e.g., exponential, linear)
   - Algorithms to explore:
     - Exponential decay: `score = usageCount * e^(-λ * daysSinceLastUse)`
     - Time-weighted: `score = usageCount / (1 + daysSinceLastUse * weight)`
     - Recency bonus: `score = usageCount + recencyBonus(lastUsedAt)`
     - Linear decay: `score = usageCount - (daysSinceLastUse / daysToDecayToZero)`

2. **Decay Application Logic:**
   - No background job to apply decay periodically
   - No stored decay parameters per user
   - No decay calculation during query execution
   - Decision needed: Calculate on-the-fly vs. periodically update

3. **Configuration:**
   - No user-configurable decay settings
   - No decay rate parameters
   - No UI for tuning decay behavior
   - Hard-coded vs. database-driven parameters

4. **Monitoring & Analytics:**
   - No way to see how decay affects rankings
   - No A/B testing infrastructure
   - No metrics on decay effectiveness

5. **Migration Strategy:**
   - No plan for existing data
   - No backward compatibility considered
   - No validation of decay impact

#### Database Changes Needed:
1. **Schema additions:**
   - `decayRate` field on usageAnalytics (or user preferences)
   - `lastDecayUpdated` timestamp
   - Possibly new `decayedScore` field for pre-calculated values

2. **New indexes:**
   - If calculating on-the-fly: `(userId, lastUsedAt)`
   - If storing decayed score: `(userId, decayedScore DESC)`

#### Files That Would Need Updating:
1. `lib/db/schema.ts` - Add decay-related fields
2. New file: `lib/usage/decay-calculator.ts` - Core algorithm
3. New file: `lib/usage/decay-scheduler.ts` - Cron job handler
4. `app/api/accounts/route.ts` - Apply decay in sorting
5. `app/api/categories/route.ts` - Apply decay in sorting
6. `app/api/merchants/route.ts` - Apply decay in sorting
7. `app/api/tags/route.ts` - Apply decay in sorting
8. `app/api/custom-fields/route.ts` - Apply decay in sorting
9. Query optimization for decay calculations

#### Estimated Implementation Time:
- Algorithm design and math: 2-3 hours
- Core decay calculator implementation: 2-3 hours
- Integration into API endpoints (5 endpoints): 3-4 hours
- Cron job setup and scheduling: 2-3 hours
- User preference UI (optional): 2-3 hours
- Testing and validation: 3-4 hours
- Documentation: 2-3 hours
- **Total: 16-23 hours**

---

## Summary Table

| Task | Status | Effort | Blocker | Priority |
|------|--------|--------|---------|----------|
| Performance Optimization | Partial (60%) | 8-12h | None | High |
| Cron Data Cleanup | Partial (40%) | 10-15h | None | High |
| Usage Decay Algorithm | Not Started (0%) | 16-23h | Algorithm Design | Medium |

---

## Recommended Implementation Order

1. **Phase 1: Performance Optimization** (8-12 hours)
   - Establish Lighthouse baseline
   - Set up performance monitoring
   - Create bundle analysis
   - Quick wins: Already have caching, just need measurement

2. **Phase 2: Cron Data Cleanup** (10-15 hours)
   - Build cleanup endpoints (5-10 total)
   - Set up monitoring and alerting
   - Deploy to production with automated schedule
   - Foundational for production stability

3. **Phase 3: Usage Decay Algorithm** (16-23 hours)
   - Complex algorithmic work
   - Requires careful testing
   - Can be done after other two tasks
   - Incremental improvement, not critical path

---

## Key Dependencies

### Task 1 → Task 2
- Performance monitoring can help identify which cron jobs are slow
- Cron cleanup can help improve performance metrics

### Task 1 → Task 3
- Usage decay implementation might affect performance
- Need baseline metrics before adding decay

### Task 2 → Task 3
- Usage decay cron job would be part of cleanup infrastructure
- Cleanup job could handle decay calculation updates

---

## Quick Wins Available Now

1. **Run Lighthouse Audit:** 15 minutes
   - `npm run build && npm start`
   - Open DevTools → Lighthouse
   - Get baseline metrics

2. **Enable Bundle Analysis:** 30 minutes
   - Add `@next/bundle-analyzer`
   - Run build with analysis
   - Identify large bundles

3. **Create Cleanup Endpoint:** 1-2 hours
   - Start with notification cleanup (easy)
   - Pattern can be repeated for other endpoints

---

## Resources Needed

### For Task 1 (Performance):
- Lighthouse (built-in to DevTools)
- @next/bundle-analyzer package
- Web Vitals library for monitoring

### For Task 2 (Cron):
- Existing cron infrastructure (already setup)
- Database cleanup queries
- Monitoring/alerting solution (Sentry, LogRocket, etc.)

### For Task 3 (Decay):
- Math/statistics knowledge
- A/B testing framework (optional)
- Performance monitoring during rollout

