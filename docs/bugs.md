# Bugs Status (Updated 2025-11-28)

## ADD NEW BUGS HERE



---

## Active Bugs

1. ⏳ Fix 2 date handling edge cases in transfer matching tests (optional - low priority)

---

## In Progress

(None)

---

## Improvement Backlog

**Split Transaction Improvements (Low Priority)** - See `docs/split-transaction-review.md`
- Add batch split update API endpoint
- Simplify auto-calculation logic in SplitBuilder
- Add loading states for category fetching

**Linter Cleanup - Remaining Directories (Low Priority)**
- __tests__/, scripts/, contexts/, hooks/ directories (warnings only)

---

## Current Status

| Metric | Count |
|--------|-------|
| Active Bugs | 1 (optional) |
| Linter Errors | 0 (in components/) |
| Linter Warnings | 0 (in components/) |
| Build Status | Passing |
| Fixed (All Time) | 569 (65 bugs + 310 warnings + 195 errors) |

---

## Fixed Bugs (65 total)

1. ✅ **Linter Cleanup Phase 2** - Fixed all 121 `@typescript-eslint/no-explicit-any` errors in components/ with proper type definitions
2. ✅ **Savings Goals GET 500 Error** - Added error logging
2. ✅ **Savings Goals POST 500 Error** - Fixed amount type casting
3. ✅ **Budget Summary 401 Unauthorized** - Integrated useAuth() hook
4. ✅ **Bill Save Performance** - Parallelized queries (75% faster)
5. ✅ **Budget Analytics Chart Warning** - Added explicit chart height
6. ✅ **Dialog Accessibility Warning** - Added DialogDescription to all dialogs
7. ✅ **Budget Income Display Logic** - Fixed status logic for income categories
8. ✅ **Goals Page Console Errors** - Fixed schema mismatch
9. ✅ **Budget Export Incorrect Values** - Fixed transaction type query
10. ✅ **Reports Chart Dimension Warnings** - Added explicit height
11. ✅ **Form Field ID/Name Missing** - Added accessibility attributes
12. ✅ **Reports Charts Dimension Warnings** - Set explicit height={320}
13. ✅ **Image Aspect Ratio Warning** - Added height: auto
14. ✅ **Clerk Redirect URL Deprecation** - Updated env var
15. ✅ **RecentTransactions Failed to Fetch** - Added guards and retry
16. ✅ **HouseholdContext loadPreferences Failed** - Added circuit breaker
17. ✅ **WebVitals sendMetricToAnalytics Failed** - Added batching
18. ✅ **SessionActivity pingServer Failed** - Added timeout handling
19. ✅ **Recent Transactions Infinite Loop** - Memoized fetch hooks
20. ✅ **Transaction Creation Sign-Out Bug** - Added household guards
21. ✅ **Categories API 403 Forbidden** - Updated to household-aware fetch
22. ✅ **Transactions API 403 Forbidden** - Added household guards
23. ✅ **Accounts API 403 Forbidden** - Added household guards
24. ✅ **CompactStatsBar 403 Forbidden** - Updated fetch hooks
25. ✅ **Logo Image Aspect Ratio Warning** - Removed CSS override
26. ✅ **Quick Entry Mode Account Loading** - Fixed race condition
27. ✅ **React Hydration Mismatch (Sign-In)** - Client-only OfflineBanner
28. ✅ **React Hydration Mismatch (Settings)** - Custom button-based tabs
29. ✅ **Quick Transaction Form Required Fields** - Added red asterisks
30. ✅ **Transfer Display Logic with Account Filter** - Fixed color coding
31. ✅ **Combined Transfer View Toggle** - Fixed frontend filtering
32. ✅ **Password Field Not Contained in Form** - Wrapped in form elements
33. ✅ **Image Aspect Ratio Warning** - Updated to use fill prop
34. ✅ **Bills Not Showing in Transaction Form** - Fixed to fetchWithHousehold
35. ✅ **Bill Details Page Failed to Fetch** - Fixed all API calls
36. ✅ **Overdue Bill Payment Not Removing** - Fixed auto-matching
37. ✅ **Pending Bill Instances with Past Due Dates** - Auto-update to overdue
38. ✅ **Bills Dropdown Missing Overdue Bills** - Added visual indicators
39. ✅ **Date Formatting Inconsistency** - Standardized to MMM d, yyyy
40. ✅ **Quick Entry Form Scrolling Issue** - Added max-h-[90vh]
41. ✅ **Quick Entry Form Missing Bill Payment** - Added bill payment type
42. ✅ **Bill Form Missing Inline Merchant Creation** - Added MerchantSelector
43. ✅ **Bills Not Refreshing After Transaction** - Custom event-based refresh
44. ✅ **Bill Matching Without Merchants** - Three-tier matching system
45. ✅ **Overdue Bills Sorting** - Fixed to sort oldest first
46. ✅ **Pending Bills Month Navigation** - Added forward/backward buttons
47. ✅ **Paid Bills Month Navigation** - Added matching navigation
48. ✅ **Intermittent Session Redirects** - Hardened cookie parsing
49. ✅ **Password Change Not Implemented** - Created password-utils.ts
50. ✅ **Email Change Skipped Password Verification** - Added bcrypt verification
51. ✅ **Reset App Data Skipped Password Verification** - Added bcrypt verification
52. ✅ **Session Timeout Cache Not Cleared** - Call clearTimeoutCache()
53. ✅ **Remember-Me Route Fragile Cookie Regex** - Replaced with auth.api.getSession()
54. ✅ **Tab Visibility Not Triggering Session Check** - Added visibilitychange listener
55. ✅ **BillForm Category Creation Missing Credentials** - Added credentials: include
56. ✅ **Invitation Decline Missing Credentials** - Added credentials: include
57. ✅ **Onboarding Modal Not Resuming After Refresh** - Removed householdList check
58. ✅ **Unused Circle Import in OnboardingProgress** - Removed unused import
59. ✅ **Onboarding Modal Not Scrolling to Top** - Added useRef/useEffect scroll reset
60. ✅ **Split Transaction Hardcoded Colors** - Replaced with CSS variables
61. ✅ **Split Transaction Duplicate Validation** - Consolidated into validateSplitConfiguration()
62. ✅ **Split Transaction TypeScript Any Types** - Created SplitUpdateData interface
63. ✅ **Split Transaction Decimal Rounding** - Added toDecimalPlaces(2, ROUND_HALF_UP)
64. ✅ **ESLint-Disable Suppressions** - Removed 9 suppressions with proper type definitions

---

## Known Minor Issues (Not Blocking)

1. **Middleware Convention:** Next.js deprecation warning - "middleware" should use "proxy" instead
