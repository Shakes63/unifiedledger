# Bugs Status (Updated 2025-11-27)

## 🆕 ADD NEW BUGS HERE



---

## 🐛 Active Bugs

1. ⏳ Fix 2 date handling edge cases in transfer matching tests (optional - low priority)

---

## 📋 Improvement Backlog

**Split Transaction Improvements (Low Priority)** - See `docs/split-transaction-review.md` for details
- Low: Add batch split update API endpoint
- Low: Simplify auto-calculation logic in SplitBuilder
- Low: Add loading states for category fetching

---

## 🔧 Linter Errors to Fix (849 remaining: 419 errors, 430 warnings)

**Status:** In Progress - See `docs/linter-cleanup-plan.md` for plan
- ✅ lib/ directory warnings fixed (36 warnings)
- ⏳ app/api/ routes (pending)
- ⏳ components/ (pending)
- ⏳ __tests__/ (pending)
- ⏳ scripts/ (pending)

### Critical: `@typescript-eslint/no-explicit-any` (419 errors)
Replace `any` types with proper TypeScript types across API routes, components, libraries, tests, and scripts.

### Warnings: `@typescript-eslint/no-unused-vars` (430 warnings)
Remove or prefix with underscore unused variables/imports across the codebase.

---

## 📊 Current Status

**Active Bugs:** 1 (optional)
**Linter Errors:** 419
**Linter Warnings:** 430
**Fixed (All Time):** 63

---

## ✅ Fixed Bugs

1. **Savings Goals GET 500 Error** - Enhanced error logging in API route
2. **Savings Goals POST 500 Error** - Added explicit type casting for amounts
3. **Budget Summary 401 Unauthorized** - Integrated Clerk's useAuth() hook
4. **Bill Save Performance** - Parallelized queries, 75% faster
5. **Budget Analytics Chart Warning** - Added explicit height to chart wrapper
6. **Dialog Accessibility Warning** - Added DialogDescription to all dialogs
7. **Budget Income Display Logic** - Fixed status logic for income categories
8. **Goals Page Console Errors** - Fixed database schema mismatch
9. **Budget Export Incorrect Values** - Fixed transaction type query
10. **Reports Chart Dimension Warnings** - Added explicit height to ChartContainer
11. **Form Field ID/Name Missing** - Added id, name, aria-label to selects
12. **Reports Charts Dimension Warnings** - Changed to explicit height={320}
13. **Image Aspect Ratio Warning** - Added height: auto to logo
14. **Clerk Redirect URL Deprecation** - Updated to new env var
15. **RecentTransactions Failed to Fetch** - Added guards and retry
16. **HouseholdContext loadPreferences Failed** - Added retry and circuit breaker
17. **WebVitals sendMetricToAnalytics Failed** - Added circuit breaker and batching
18. **SessionActivity pingServer Failed** - Added visibility checks and timeout handling
19. **Recent Transactions Infinite Loop** - Memoized useHouseholdFetch
20. **Transaction Creation Sign-Out Bug** - Added household context guards
21. **Categories API 403 Forbidden** - Updated to household-aware fetch
22. **Transactions API 403 Forbidden** - Added household context guards
23. **Accounts API 403 Forbidden** - Added household context guards
24. **CompactStatsBar 403 Forbidden** - Updated to household-aware fetch
25. **Logo Image Aspect Ratio Warning** - Removed CSS override from Image
26. **Quick Entry Mode Account Loading** - Fixed race condition
27. **React Hydration Mismatch (Sign-In)** - Client-only rendering for OfflineBanner
28. **React Hydration Mismatch (Settings)** - Custom button-based tabs
29. **Quick Transaction Form Required Fields** - Added red asterisk indicators
30. **Transfer Display Logic with Account Filter** - Fixed color coding
31. **Combined Transfer View Toggle** - Fixed frontend filtering
32. **Password Field Not Contained in Form** - Wrapped in form elements
33. **Image Aspect Ratio Warning** - Updated to use fill prop
34. **Bills Not Showing in Transaction Form** - Fixed to use fetchWithHousehold
35. **Bill Details Page Failed to Fetch** - Fixed all API calls
36. **Overdue Bill Payment Not Removing** - Fixed auto-matching
37. **Pending Bill Instances with Past Due Dates** - Auto-update to overdue
38. **Bills Dropdown Missing Overdue Bills** - Added with visual indicators
39. **Date Formatting Inconsistency** - Standardized to MMM d, yyyy
40. **Quick Entry Form Scrolling Issue** - Added max-h-[90vh] overflow-y-auto
41. **Quick Entry Form Missing Bill Payment** - Added bill payment type
42. **Bill Form Missing Inline Merchant Creation** - Added MerchantSelector
43. **Bills Not Refreshing After Transaction** - Custom event-based refresh
44. **Bill Matching Without Merchants** - Three-tier matching system
45. **Overdue Bills Sorting** - Fixed to sort oldest first
46. **Pending Bills Month Navigation** - Added forward/backward buttons
47. **Paid Bills Month Navigation** - Added matching navigation
48. **Intermittent Session Redirects** - Hardened cookie parsing
49. **Password Change Not Implemented** - Created password-utils.ts
50. **Email Change Skipped Password Verification** - Added bcrypt verification
51. **Reset App Data Skipped Password Verification** - Added bcrypt verification
52. **Session Timeout Cache Not Cleared** - Call clearTimeoutCache() on update
53. **Remember-Me Route Fragile Cookie Regex** - Replaced with auth.api.getSession()
54. **Tab Visibility Not Triggering Session Check** - Added visibilitychange listener
55. **BillForm Category Creation Missing Credentials** - Added credentials: include
56. **Invitation Decline Missing Credentials** - Added credentials: include
57. **Onboarding Modal Not Resuming After Refresh** - Removed householdList check
58. **Unused Circle Import in OnboardingProgress** - Removed unused import
59. **Onboarding Modal Not Scrolling to Top** - Added useRef/useEffect scroll reset
60. **Split Transaction Hardcoded Colors** - Replaced hex colors with CSS variables in SplitBuilder
61. **Split Transaction Duplicate Validation** - Consolidated validation into `validateSplitConfiguration()` in split-calculator.ts with configurable options
62. **Split Transaction TypeScript Any Types** - Created `SplitUpdateData` interface, replaced `Record<string, any>` in split API
63. **Split Transaction Decimal Rounding** - Added `toDecimalPlaces(2, ROUND_HALF_UP)` to calculateSplitAmounts and handleSplitCreation

---

## 💡 Known Minor Issues (Not Blocking)

1. **Middleware Convention:** Next.js deprecation warning - "middleware" should use "proxy" instead

**Note:** These don't require immediate action but can be addressed as polish improvements.
