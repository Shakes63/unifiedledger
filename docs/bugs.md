# Bugs Status (Updated 2025-11-29)

---

## New Bugs

<!-- Add new bugs here in the format: -->
<!-- - **Bug Name** - Brief description of the issue -->

---

## Active Bugs

(None)

---

## In Progress

(None)

---

## Improvement Backlog

(None)

---

## Current Status

| Metric | Count |
|--------|-------|
| Active Bugs | 0 |
| Tests Passing | 590/590 (100%) |
| Linter Errors | 0 |
| Linter Warnings | 0 |
| Build Status | Passing |
| Fixed (All Time) | 663 (87 bugs + 310 warnings + 195 errors + 71 additional) |

---

## Fixed Bugs (87 total)

1. ✅ **Identical Interest Calculations for Snowball vs Avalanche** [FIXED 2025-11-29] - Rewrote payoff calculator to use parallel simulation tracking ALL debts simultaneously.
2. ✅ **Debt Payoff Strategy Not Updating After Adding New Debt** [FIXED 2025-11-29] - Added `refreshKey` state forcing child component remount on data changes.
3. ✅ **Payment Tracking Section Not Reflecting Recorded Payments** [FIXED 2025-11-29] - Same refreshKey fix for PaymentAdherenceCard and PaymentStreakWidget.
4. ✅ **Debt-Free Countdown Widget Shows Stale Data After Payments** [FIXED 2025-11-29] - Same refreshKey fix for DebtFreeCountdown component.
5. ✅ **Monthly Bill Category Displays in Two Budget Sections** [FIXED 2025-11-29] - Fixed groupedCategories.expenses to only include variable_expense types.
6. ✅ **Credit Card Available Balance Calculation Wrong** [FIXED 2025-11-29] - Fixed available credit calculation to use Math.abs() on balance.
7. ✅ **What-If Calculator 400 Error for Weekly/Quarterly** [FIXED 2025-11-29] - Updated API validation to accept all 4 payment frequencies.
8. ✅ **Weekly/Biweekly Bill Instance Dates Off-By-One** [FIXED 2025-11-29] - Fixed timezone bug with date-fns format() instead of toISOString().
9. ✅ **Middleware to Proxy Convention Migration** [FIXED 2025-11-29] - Migrated from middleware.ts to proxy.ts per Next.js 16 convention.
10. ✅ **Response Body Stream Already Read (Household)** [FIXED 2025-11-29] - Added deduplicate: false to enhancedFetch calls.
11. ✅ **Response Body Stream Already Read (Onboarding)** [FIXED 2025-11-29] - Same deduplicate fix for onboarding-context.tsx.
12. ✅ **Linter Cleanup - Remaining Directories** [FIXED 2025-11-28] - Fixed 73 ESLint issues in __tests__/, scripts/, contexts/, hooks/.
13. ✅ **Fix Integration Test Failures (50 tests)** [FIXED 2025-11-28] - Fixed all 50 failing tests after Household Data Isolation.
14. ✅ **Split Builder Auto-Calculation UX** [FIXED] - Added explicit "Balance Splits" button and "Balanced" badge.
15. ✅ **Split Builder Loading States** [FIXED] - Added onLoadingChange callback and loading spinner.
16. ✅ **Batch Split Update API** [FIXED] - Added atomic batch update endpoint reducing 7+ API calls to 1.
17. ✅ **Linter Cleanup Phase 2** [FIXED] - Fixed 196 ESLint errors in components/.
18. ✅ **Savings Goals GET 500 Error** [FIXED] - Added error logging.
19. ✅ **Savings Goals POST 500 Error** [FIXED] - Fixed amount type casting.
20. ✅ **Budget Summary 401 Unauthorized** [FIXED] - Integrated useAuth() hook.
21. ✅ **Bill Save Performance** [FIXED] - Parallelized queries (75% faster).
22. ✅ **Budget Analytics Chart Warning** [FIXED] - Added explicit chart height.
23. ✅ **Dialog Accessibility Warning** [FIXED] - Added DialogDescription to all dialogs.
24. ✅ **Budget Income Display Logic** [FIXED] - Fixed status logic for income categories.
25. ✅ **Goals Page Console Errors** [FIXED] - Fixed schema mismatch.
26. ✅ **Budget Export Incorrect Values** [FIXED] - Fixed transaction type query.
27. ✅ **Reports Chart Dimension Warnings** [FIXED] - Added explicit height.
28. ✅ **Form Field ID/Name Missing** [FIXED] - Added accessibility attributes.
29. ✅ **Reports Charts Dimension Warnings** [FIXED] - Set explicit height={320}.
30. ✅ **Image Aspect Ratio Warning** [FIXED] - Added height: auto.
31. ✅ **Clerk Redirect URL Deprecation** [FIXED] - Updated env var.
32. ✅ **RecentTransactions Failed to Fetch** [FIXED] - Added guards and retry.
33. ✅ **HouseholdContext loadPreferences Failed** [FIXED] - Added circuit breaker.
34. ✅ **WebVitals sendMetricToAnalytics Failed** [FIXED] - Added batching.
35. ✅ **SessionActivity pingServer Failed** [FIXED] - Added timeout handling.
36. ✅ **Recent Transactions Infinite Loop** [FIXED] - Memoized fetch hooks.
37. ✅ **Transaction Creation Sign-Out Bug** [FIXED] - Added household guards.
38. ✅ **Categories API 403 Forbidden** [FIXED] - Updated to household-aware fetch.
39. ✅ **Transactions API 403 Forbidden** [FIXED] - Added household guards.
40. ✅ **Accounts API 403 Forbidden** [FIXED] - Added household guards.
41. ✅ **CompactStatsBar 403 Forbidden** [FIXED] - Updated fetch hooks.
42. ✅ **Logo Image Aspect Ratio Warning** [FIXED] - Removed CSS override.
43. ✅ **Quick Entry Mode Account Loading** [FIXED] - Fixed race condition.
44. ✅ **React Hydration Mismatch (Sign-In)** [FIXED] - Client-only OfflineBanner.
45. ✅ **React Hydration Mismatch (Settings)** [FIXED] - Custom button-based tabs.
46. ✅ **Quick Transaction Form Required Fields** [FIXED] - Added red asterisks.
47. ✅ **Transfer Display Logic with Account Filter** [FIXED] - Fixed color coding.
48. ✅ **Combined Transfer View Toggle** [FIXED] - Fixed frontend filtering.
49. ✅ **Password Field Not Contained in Form** [FIXED] - Wrapped in form elements.
50. ✅ **Image Aspect Ratio Warning** [FIXED] - Updated to use fill prop.
51. ✅ **Bills Not Showing in Transaction Form** [FIXED] - Fixed to fetchWithHousehold.
52. ✅ **Bill Details Page Failed to Fetch** [FIXED] - Fixed all API calls.
53. ✅ **Overdue Bill Payment Not Removing** [FIXED] - Fixed auto-matching.
54. ✅ **Pending Bill Instances with Past Due Dates** [FIXED] - Auto-update to overdue.
55. ✅ **Bills Dropdown Missing Overdue Bills** [FIXED] - Added visual indicators.
56. ✅ **Date Formatting Inconsistency** [FIXED] - Standardized to MMM d, yyyy.
57. ✅ **Quick Entry Form Scrolling Issue** [FIXED] - Added max-h-[90vh].
58. ✅ **Quick Entry Form Missing Bill Payment** [FIXED] - Added bill payment type.
59. ✅ **Bill Form Missing Inline Merchant Creation** [FIXED] - Added MerchantSelector.
60. ✅ **Bills Not Refreshing After Transaction** [FIXED] - Custom event-based refresh.
61. ✅ **Bill Matching Without Merchants** [FIXED] - Three-tier matching system.
62. ✅ **Overdue Bills Sorting** [FIXED] - Fixed to sort oldest first.
63. ✅ **Pending Bills Month Navigation** [FIXED] - Added forward/backward buttons.
64. ✅ **Paid Bills Month Navigation** [FIXED] - Added matching navigation.
65. ✅ **Intermittent Session Redirects** [FIXED] - Hardened cookie parsing.
66. ✅ **Password Change Not Implemented** [FIXED] - Created password-utils.ts.
67. ✅ **Email Change Skipped Password Verification** [FIXED] - Added bcrypt verification.
68. ✅ **Reset App Data Skipped Password Verification** [FIXED] - Added bcrypt verification.
69. ✅ **Session Timeout Cache Not Cleared** [FIXED] - Call clearTimeoutCache().
70. ✅ **Remember-Me Route Fragile Cookie Regex** [FIXED] - Replaced with auth.api.getSession().
71. ✅ **Tab Visibility Not Triggering Session Check** [FIXED] - Added visibilitychange listener.
72. ✅ **BillForm Category Creation Missing Credentials** [FIXED] - Added credentials: include.
73. ✅ **Invitation Decline Missing Credentials** [FIXED] - Added credentials: include.
74. ✅ **Onboarding Modal Not Resuming After Refresh** [FIXED] - Removed householdList check.
75. ✅ **Unused Circle Import in OnboardingProgress** [FIXED] - Removed unused import.
76. ✅ **Onboarding Modal Not Scrolling to Top** [FIXED] - Added useRef/useEffect scroll reset.
77. ✅ **Split Transaction Hardcoded Colors** [FIXED] - Replaced with CSS variables.
78. ✅ **Split Transaction Duplicate Validation** [FIXED] - Consolidated into validateSplitConfiguration().
79. ✅ **Split Transaction TypeScript Any Types** [FIXED] - Created SplitUpdateData interface.
80. ✅ **Split Transaction Decimal Rounding** [FIXED] - Added toDecimalPlaces(2, ROUND_HALF_UP).
81. ✅ **ESLint-Disable Suppressions** [FIXED] - Removed 9 suppressions with proper type definitions.
82. ✅ **Annual Planning Grid Timezone Bug** [FIXED 2025-11-29] - Fixed date parsing to avoid local timezone conversion where November 1st appeared as October 31st by parsing ISO date strings directly.
83. ✅ **Quarterly Bills Missing October** [FIXED 2025-11-29] - Changed getInstanceCount from 3 to 4 for quarterly frequency to ensure all 4 quarters appear in annual planner.
84. ✅ **Semi-Annual Bills Only Showing One Per Year** [FIXED 2025-11-29] - Changed getInstanceCount from 2 to 4 for semi-annual frequency so both occurrences (Jan+Jul) visible per year.
85. ✅ **Bill Instances Not Generated for Future Years** [FIXED 2025-11-29] - Added on-demand instance generation via /api/bills/ensure-instances endpoint, triggered when viewing annual planner.
86. ✅ **Calendar Week View Infinite Render Loop** [FIXED 2025-11-29] - Replaced Date objects in useEffect dependency array with `currentDate.getTime()` timestamp to avoid infinite re-renders caused by reference inequality.
87. ✅ **Calendar Day Modal Bill Due Date Off-By-One** [FIXED 2025-11-29] - Changed `new Date(bill.dueDate)` to `parseISO(bill.dueDate)` from date-fns to avoid UTC timezone conversion that shifted dates back one day in local timezones behind UTC.

---

## Known Minor Issues (Not Blocking)

(None)
