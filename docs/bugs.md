# Bugs Status (Updated 2025-11-26)

## 🆕 ADD NEW BUGS HERE



---

## 🐛 Active Bugs

_No active bugs_

---

## 📊 Current Status

**Active Bugs:** 0
**In Progress:** 0
**Fixed (All Time):** 54

---

## ✅ Fixed Bugs

1. **Savings Goals GET 500 Error** - Enhanced error logging and handling in API route
2. **Savings Goals POST 500 Error** - Added explicit type casting for financial amounts
3. **Budget Summary 401 Unauthorized** - Integrated Clerk's `useAuth()` hook for proper authentication
4. **Bill Save Performance** - Parallelized validation queries and batch instance creation (75% faster)
5. **Budget Analytics Chart Dimension Warning** - Added explicit height and minHeight to chart wrapper
6. **Dialog Accessibility Warning** - Added `DialogDescription` to all 7 dialogs for screen reader support
7. **Budget Income Display Logic** - Reversed status logic so income exceeding budget shows as positive
8. **Goals Page Console Errors** - Fixed database schema mismatch
9. **Budget Export Incorrect Values** - Fixed transaction type query to include income categories
10. **Reports Page Chart Dimension Warnings** - Added explicit height styling to ChartContainer
11. **Form Field ID/Name Attributes Missing** - Added id, name, and aria-label to select dropdowns
12. **Reports Charts Dimension Warnings** - Changed ResponsiveContainer to explicit height={320}
13. **Image Aspect Ratio Warning** - Added height: auto to logo Image components
14. **Clerk Redirect URL Deprecation** - Updated to new SIGN_IN_FALLBACK_REDIRECT_URL env var
15. **RecentTransactions Failed to Fetch** - Added initialization guards and error states with retry
16. **HouseholdContext loadPreferences Failed** - Added retry logic and circuit breaker pattern
17. **WebVitals sendMetricToAnalytics Failed** - Added circuit breaker, metric batching, offline detection
18. **SessionActivity pingServer Failed** - Added visibility checks, timeout handling, production-safe logging
19. **Recent Transactions Infinite Loop** - Memoized useHouseholdFetch with useCallback
20. **Transaction Creation Sign-Out Bug** - Added household context readiness guards
21. **Categories API 403 Forbidden** - Updated to household-aware fetch hooks
22. **Transactions API 403 Forbidden** - Added household context readiness guards
23. **Accounts API 403 Forbidden** - Added household context readiness guards
24. **CompactStatsBar 403 Forbidden** - Updated to use household-aware fetch hooks
25. **Logo Image Aspect Ratio Warning** - Removed CSS dimension override from Next.js Image
26. **Quick Entry Mode Account Loading** - Fixed race condition with household context loading
27. **React Hydration Mismatch (Sign-In)** - Implemented client-only rendering pattern for OfflineBanner
28. **React Hydration Mismatch (Settings)** - Replaced nested Radix Tabs with custom button-based tabs
29. **Quick Transaction Form Required Fields** - Added red asterisk indicators to required fields
30. **Transfer Display Logic with Account Filter** - Fixed color coding based on filter context
31. **Combined Transfer View Toggle Not Working** - Fixed frontend filtering to respect preference
32. **Password Field Not Contained in Form** - Wrapped password fields in form elements
33. **Image Aspect Ratio Warning** - Updated logo components to use fill prop
34. **Bills Not Showing in Transaction Form** - Fixed to use fetchWithHousehold for bills API
35. **Bill Details Page Failed to Fetch** - Fixed all API calls to use fetchWithHousehold
36. **Overdue Bill Payment Not Removing** - Fixed auto-matching to include overdue instances
37. **Pending Bill Instances with Past Due Dates** - Auto-update to overdue status on past dates
38. **Bills Dropdown Missing Overdue Bills** - Added overdue bills to dropdown with visual indicators
39. **Date Formatting Inconsistency** - Standardized to MMM d, yyyy format with date-fns
40. **Quick Entry Form Scrolling Issue** - Added max-h-[90vh] overflow-y-auto to DialogContent
41. **Quick Entry Form Missing Bill Payment** - Added bill payment type with selector dropdown
42. **Bill Form Missing Inline Merchant Creation** - Added MerchantSelector component to bill forms
43. **Bills Not Refreshing After Transaction** - Implemented custom event-based bill refresh
44. **Bill Matching Without Merchants** - Implemented three-tier matching system with fallbacks
45. **Overdue Bills Sorting** - Fixed to sort by oldest first
46. **Pending Bills Month Navigation** - Added month-based navigation with forward/backward buttons
47. **Paid Bills Month Navigation** - Added month-based navigation matching pending bills
48. **Intermittent Session Redirects** - Hardened middleware cookie parsing with Buffer.from, added sign-in reason display
49. **Password Change Not Implemented** - Created password-utils.ts with bcrypt verify/hash functions
50. **Email Change Skipped Password Verification** - Added bcrypt password verification before email change
51. **Reset App Data Skipped Password Verification** - Added bcrypt password verification before reset
52. **Session Timeout Cache Not Cleared** - Call clearTimeoutCache() when sessionTimeout is updated
53. **Remember-Me Route Fragile Cookie Regex** - Replaced with auth.api.getSession() for consistency
54. **Tab Visibility Not Triggering Session Check** - Added visibilitychange listener to immediately ping server

---

## 💡 Known Minor Issues (Not Blocking)

1. **Middleware Convention:** Next.js deprecation warning - "middleware" file should use "proxy" instead

**Note:** These don't require immediate action but can be addressed as polish improvements.
