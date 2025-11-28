# Bugs Status (Updated 2025-11-28)

---

## New Bugs

<!-- Add new bugs here in the format: -->
<!-- - **Bug Name** - Brief description of the issue -->



---

## Active Bugs

1. ⏳ **Fix Integration Test Failures (50 remaining)** - Household data isolation caused test failures
   - **Progress:** Reduced from 75 to 50 failing tests (33% fixed)
   - **Completed:** Integration tests (post-creation-actions, rules-flow, rule-execution-logging, bulk-apply-rules)
   - **Remaining:** Unit tests (rule-matcher ~24, migrate-to-household-preferences ~13, actions-executor 7, transaction-creation-rules 5, user-household-preferences 1)
   - **See:** `docs/fix-integration-tests-plan.md` for detailed status

---

## In Progress

(None)

---

## Improvement Backlog

**Linter Cleanup - Remaining Directories (Low Priority)**
- __tests__/, scripts/, contexts/, hooks/ directories (warnings only)

---

## Current Status

| Metric | Count |
|--------|-------|
| Active Bugs | 1 (50 failing tests) |
| Tests Passing | 540/590 (91.5%) |
| Linter Errors | 0 (in components/) |
| Linter Warnings | 0 (in components/) |
| Build Status | Passing |
| Fixed (All Time) | 572 (68 bugs + 310 warnings + 195 errors) |

---

## Fixed Bugs (68 total)

1. ✅ **Split Builder Auto-Calculation UX** [FIXED] - Replaced silent auto-calculation with explicit "Balance Splits" button and "Balanced" badge indicator for clearer UX
2. ✅ **Split Builder Loading States** [FIXED] - Added `onLoadingChange` callback to CategorySelector and loading spinner on Add Split button while categories load
3. ✅ **Batch Split Update API** [FIXED] - Added atomic batch update endpoint (`PUT /api/transactions/[id]/splits/batch`) reducing 7+ sequential API calls to 1, with 18 unit tests
2. ✅ **Linter Cleanup Phase 2** [FIXED] - Fixed all 196 ESLint errors in components/ with proper type definitions in `lib/types/index.ts`
2. ✅ **Savings Goals GET 500 Error** - Added error logging
3. ✅ **Savings Goals POST 500 Error** - Fixed amount type casting
4. ✅ **Budget Summary 401 Unauthorized** - Integrated useAuth() hook
5. ✅ **Bill Save Performance** - Parallelized queries (75% faster)
6. ✅ **Budget Analytics Chart Warning** - Added explicit chart height
7. ✅ **Dialog Accessibility Warning** - Added DialogDescription to all dialogs
8. ✅ **Budget Income Display Logic** - Fixed status logic for income categories
9. ✅ **Goals Page Console Errors** - Fixed schema mismatch
10. ✅ **Budget Export Incorrect Values** - Fixed transaction type query
11. ✅ **Reports Chart Dimension Warnings** - Added explicit height
12. ✅ **Form Field ID/Name Missing** - Added accessibility attributes
13. ✅ **Reports Charts Dimension Warnings** - Set explicit height={320}
14. ✅ **Image Aspect Ratio Warning** - Added height: auto
15. ✅ **Clerk Redirect URL Deprecation** - Updated env var
16. ✅ **RecentTransactions Failed to Fetch** - Added guards and retry
17. ✅ **HouseholdContext loadPreferences Failed** - Added circuit breaker
18. ✅ **WebVitals sendMetricToAnalytics Failed** - Added batching
19. ✅ **SessionActivity pingServer Failed** - Added timeout handling
20. ✅ **Recent Transactions Infinite Loop** - Memoized fetch hooks
21. ✅ **Transaction Creation Sign-Out Bug** - Added household guards
22. ✅ **Categories API 403 Forbidden** - Updated to household-aware fetch
23. ✅ **Transactions API 403 Forbidden** - Added household guards
24. ✅ **Accounts API 403 Forbidden** - Added household guards
25. ✅ **CompactStatsBar 403 Forbidden** - Updated fetch hooks
26. ✅ **Logo Image Aspect Ratio Warning** - Removed CSS override
27. ✅ **Quick Entry Mode Account Loading** - Fixed race condition
28. ✅ **React Hydration Mismatch (Sign-In)** - Client-only OfflineBanner
29. ✅ **React Hydration Mismatch (Settings)** - Custom button-based tabs
30. ✅ **Quick Transaction Form Required Fields** - Added red asterisks
31. ✅ **Transfer Display Logic with Account Filter** - Fixed color coding
32. ✅ **Combined Transfer View Toggle** - Fixed frontend filtering
33. ✅ **Password Field Not Contained in Form** - Wrapped in form elements
34. ✅ **Image Aspect Ratio Warning** - Updated to use fill prop
35. ✅ **Bills Not Showing in Transaction Form** - Fixed to fetchWithHousehold
36. ✅ **Bill Details Page Failed to Fetch** - Fixed all API calls
37. ✅ **Overdue Bill Payment Not Removing** - Fixed auto-matching
38. ✅ **Pending Bill Instances with Past Due Dates** - Auto-update to overdue
39. ✅ **Bills Dropdown Missing Overdue Bills** - Added visual indicators
40. ✅ **Date Formatting Inconsistency** - Standardized to MMM d, yyyy
41. ✅ **Quick Entry Form Scrolling Issue** - Added max-h-[90vh]
42. ✅ **Quick Entry Form Missing Bill Payment** - Added bill payment type
43. ✅ **Bill Form Missing Inline Merchant Creation** - Added MerchantSelector
44. ✅ **Bills Not Refreshing After Transaction** - Custom event-based refresh
45. ✅ **Bill Matching Without Merchants** - Three-tier matching system
46. ✅ **Overdue Bills Sorting** - Fixed to sort oldest first
47. ✅ **Pending Bills Month Navigation** - Added forward/backward buttons
48. ✅ **Paid Bills Month Navigation** - Added matching navigation
49. ✅ **Intermittent Session Redirects** - Hardened cookie parsing
50. ✅ **Password Change Not Implemented** - Created password-utils.ts
51. ✅ **Email Change Skipped Password Verification** - Added bcrypt verification
52. ✅ **Reset App Data Skipped Password Verification** - Added bcrypt verification
53. ✅ **Session Timeout Cache Not Cleared** - Call clearTimeoutCache()
54. ✅ **Remember-Me Route Fragile Cookie Regex** - Replaced with auth.api.getSession()
55. ✅ **Tab Visibility Not Triggering Session Check** - Added visibilitychange listener
56. ✅ **BillForm Category Creation Missing Credentials** - Added credentials: include
57. ✅ **Invitation Decline Missing Credentials** - Added credentials: include
58. ✅ **Onboarding Modal Not Resuming After Refresh** - Removed householdList check
59. ✅ **Unused Circle Import in OnboardingProgress** - Removed unused import
60. ✅ **Onboarding Modal Not Scrolling to Top** - Added useRef/useEffect scroll reset
61. ✅ **Split Transaction Hardcoded Colors** - Replaced with CSS variables
62. ✅ **Split Transaction Duplicate Validation** - Consolidated into validateSplitConfiguration()
63. ✅ **Split Transaction TypeScript Any Types** - Created SplitUpdateData interface
64. ✅ **Split Transaction Decimal Rounding** - Added toDecimalPlaces(2, ROUND_HALF_UP)
65. ✅ **ESLint-Disable Suppressions** - Removed 9 suppressions with proper type definitions

---

## Known Minor Issues (Not Blocking)

1. **Middleware Convention:** Next.js deprecation warning - "middleware" should use "proxy" instead
