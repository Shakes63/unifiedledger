# Bugs Status (Updated 2025-01-27)

---

## 🆕 ADD NEW BUGS HERE
(No active bugs - all fixed!)


---

## 📊 Current Status

**Active Bugs:** 0
**In Progress:** 0
**Fixed (All Time):** 25

---

## ✅ Fixed Bugs

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
19. **Recent Transactions Infinite Loop** - Memoized `useHouseholdFetch` hook functions with `useCallback` and removed function references from `useEffect` dependency arrays in 6 components
20. **Transaction Creation Sign-Out Bug** - Added household context readiness guards and improved error handling to prevent sign-out on 403 errors
21. **Categories API 403 Forbidden** - Updated categories page to use household-aware fetch hooks and added household context guards
22. **Transactions API 403 Forbidden** - Added household context readiness guards to transactions page and improved error handling
23. **Accounts API 403 Forbidden** - Added household context readiness guards to accounts page
24. **CompactStatsBar 403 Forbidden** - Updated CompactStatsBar component to use household-aware fetch hooks for all API calls
25. **Logo Image Aspect Ratio Warning** - Removed `style={{ height: 'auto' }}` from collapsed sidebar logo Image component. Next.js Image best practice: when using explicit width/height props, don't modify dimensions via CSS.

---

## 💡 Known Minor Issues (Not Blocking)

These are minor warnings/deprecations that don't affect functionality:

1. **Middleware Convention:** Next.js deprecation warning - "middleware" file convention should use "proxy" instead

**Note:** These don't require immediate action but can be addressed as polish improvements.
