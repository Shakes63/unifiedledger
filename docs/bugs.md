# Bugs Status (Updated 2025-11-15)

---

## 🆕 ADD NEW BUGS HERE


---

## 📊 Current Status

**Active Bugs:** 0
**In Progress:** 0
**Fixed (All Time):** 23

---

## ✅ Historical Bug Summary

All 23 tracked bugs have been fixed (100% complete)! 🎉

1. **Savings Goals GET 500 Error** - Enhanced error logging and handling in API route
2. **Savings Goals POST 500 Error** - Added explicit type casting for financial amounts
3. **Budget Summary 401 Unauthorized** - Integrated Clerk's `useAuth()` hook for proper authentication
4. **Bill Save Performance** - Parallelized validation queries and batch instance creation (75% faster)
5. **Budget Analytics Chart Dimension Warning** - Added explicit height and minHeight to chart wrapper
6. **Dialog Accessibility Warning** - Added `DialogDescription` to all 7 dialogs for screen reader support
7. **Budget Income Display Logic** - Reversed status logic so income exceeding budget shows as positive (green)
8. **Goals Page Console Errors** - Fixed database schema mismatch (recreated savings_goals table)
9. **Budget Export Incorrect Values** - Fixed transaction type query to properly include income categories
10. **Reports Page Chart Dimension Warnings** - Added explicit `style={{ height: '320px' }}` to ChartContainer
11. **Form Field ID/Name Attributes Missing** - Added id, name, and aria-label attributes to select dropdowns
12. **Reports Charts Dimension Warnings (Multiple Components)** - Changed ResponsiveContainer in all chart components to use explicit `height={320}` instead of `height="100%"`
13. **Image Aspect Ratio Warning** - Added explicit `style={{ height: 'auto' }}` to both logo Image components in sidebar for proper aspect ratio maintenance
14. **Clerk Redirect URL Deprecation** - Updated environment variables from deprecated `AFTER_SIGN_IN_URL` to new `SIGN_IN_FALLBACK_REDIRECT_URL` for better redirect handling and to eliminate deprecation warnings
15. **RecentTransactions Failed to Fetch (Bugs 1-4)** - Added initialization guards and comprehensive error states with retry functionality
16. **HouseholdContext loadPreferences Failed to Fetch (Bug 5)** - Implemented enhanced fetch with retry logic, circuit breaker pattern, and fallback to cached preferences
17. **WebVitals sendMetricToAnalytics Failed to Fetch (Bugs 6-7)** - Added circuit breaker pattern, metric batching (5s intervals), and offline detection
18. **SessionActivity pingServer Failed to Fetch (Bugs 8-9)** - Added Page Visibility API checks, network status detection, timeout handling, and production-safe logging

**Comprehensive Error Handling Infrastructure (2025-11-15):**
- Created `lib/utils/enhanced-fetch.ts` - Robust fetch utility with exponential backoff retry, timeout handling, request deduplication, and detailed error categorization
- Created `contexts/network-status-context.tsx` - Real-time online/offline detection, periodic server health checks (30s), connection quality monitoring
- Updated `contexts/household-context.tsx` - Added initialization state tracking, comprehensive error handling with toast notifications and retry functionality
- Updated `components/dashboard/recent-transactions.tsx` - Added 6-state loading system (initializing, household error, no household, data loading, data error, empty state)
- Updated `hooks/useWebVitals.ts` - Implemented circuit breaker (3 failures/60s), metric batching, offline detection, silent failure mode
- Updated `app/api/performance/metrics/route.ts` - Added batched metrics support, always-200 responses, graceful auth failures
- Updated `components/providers/session-activity-provider.tsx` - Added Page Visibility API, network detection, timeout handling, development-only logging

**For detailed information, see git commit history and `docs/fetch-error-handling-improvement-plan.md`.**

---

## 💡 Known Minor Issues (Not Blocking)

These are minor warnings/deprecations that don't affect functionality:

1. **Middleware Convention:** Next.js deprecation warning - "middleware" file convention should use "proxy" instead

**Note:** These don't require immediate action but can be addressed as polish improvements.
