# Bugs Status (Updated 2025-11-30)

---

## New Bugs

(None)

---

## Active Bugs

(None)

---

## In Progress

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
| Fixed (All Time) | 679 (103 bugs + 310 warnings + 195 errors + 71 additional) |

---

## Fixed Bugs (103 total)

103. ✅ **Debt Milestones Not Appearing on Calendar** [FIXED 2025-12-01] - Created `lib/debts/payoff-date-utils.ts` to auto-sync `targetPayoffDate` when debts are created/updated or settings change. Fixed inverted comparison in `milestone-utils.ts` (gte instead of lte). Added payoff date sync to POST/PUT debt APIs and bulk sync when debt settings change.
102. ✅ **Inline Description Edit Text Box Too Small** [FIXED 2025-12-01] - Replaced single-line `<Input>` with multi-line `<Textarea>` (2 rows, min-h-[40px], max-h-[80px], min-w-[200px], max-w-[300px]). Display mode now uses `line-clamp-2` instead of `truncate` to show up to 2 lines of text.
101. ✅ **Inline Transaction Dropdown Merchant/Category Creation Bug** [FIXED 2025-12-01] - Fixed issue on transactions list page where creating a new merchant/category from inline dropdown would exit edit mode before creation completed. Root cause: stale closure issue in `onOpenChange` callback - the `isCreating` state was captured before the state update took effect. Fixed by adding `isCreatingRef` to synchronously track creating state and using it in the setTimeout callback. Also fixed related bugs in transaction form: (1) Categories API only returned `{id, message}` - now returns full object. (2) CategorySelector/MerchantSelector used conditional rendering causing unmount/remount - fixed with CSS hidden class and `flushSync`.
100. ✅ **Repeat Transaction Date Bug** [FIXED 2025-11-30] - Fixed timezone-related date display bug. The issue was that `new Date('YYYY-MM-DD')` parses dates as UTC midnight, which displays as the previous day in local timezones behind UTC. Replaced all `new Date(transaction.date)` calls with `parseISO()` from date-fns in 5 files for consistent date handling.
99. ✅ **Transaction History Page Redirects in TEST_MODE** [FIXED 2025-11-30] - Fixed by replacing direct `auth.api.getSession()` call with `getAuthUser()` from auth-helpers.ts which has TEST_MODE bypass support. Also fixed hardcoded colors in page and component to use semantic theme variables.
94. ✅ **Double-Negative Amount Display on Transactions** [FIXED 2025-11-30] - Fixed by using `Math.abs()` on transaction amounts in display logic across transaction list, recent transactions, and transaction history components. Also fixed test data script to store positive amounts.
95. ✅ **Dashboard Recent Transactions Double-Negative Regression** [FIXED 2025-11-30] - The `recent-transactions.tsx` dashboard widget was still showing double-negatives (e.g., "-$-42.32") after Bug #94 fix. Fixed by adding `Math.abs()` to line 456 in the amount display logic.
96. ✅ **Merchant Dropdown Shows Usage Numbers** [FIXED 2025-11-30] - Removed usage count display from merchant selector dropdown. Merchants now display as "Whole Foods" instead of "Whole Foods (4)". Sorting by usage count is preserved (API behavior), only the visual display was changed.
97. ✅ **Dashboard Collapse State Not Persisting** [FIXED 2025-11-30] - Fixed hydration mismatch in `CollapsibleSection` component. Changed from reading localStorage during useState initialization (causes SSR/client mismatch) to using useEffect for hydration-safe localStorage read after mount.
98. ✅ **Transaction History Page Build Error** [FIXED 2025-11-30] - Fixed "Module not found: Can't resolve 'fs'" error caused by client component importing server-only code. Created `lib/transactions/audit-utils.ts` for client-safe utilities and updated imports.
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
88. ✅ **Transaction Detail Page 403 Forbidden** [FIXED 2025-11-29] - Fixed missing household context in transaction detail page, splits list, and convert-to-transfer modal by replacing raw `fetch()` calls with `useHouseholdFetch` hook methods that include `x-household-id` header.
89. ✅ **Dashboard Budget Section Dual Auth Message in TEST MODE** [FIXED 2025-11-29] - Removed preemptive client-side auth check from `BudgetSurplusCard` that incorrectly showed auth error in TEST_MODE. Now relies on API 401 response for auth errors, matching the pattern used by `BudgetSummaryWidget`.
90. ✅ **Transfers Page Stuck Loading** [FIXED 2025-11-29] - Updated transfers page, QuickTransferModal, TransferForm, and TransferList to use `useHousehold` context and `useHouseholdFetch` hook instead of old `betterAuthClient.useSession()` pattern. Also updated all hardcoded colors to semantic theme variables.
91. ✅ **Database Statistics Show All Zeros in Advanced Settings** [FIXED 2025-11-29] - Created dedicated `/api/stats` endpoint with efficient COUNT queries for all entity types. Updated Advanced settings tab to use `fetchWithHousehold()` with the new endpoint instead of multiple individual API calls with incorrect response parsing.
92. ✅ **NotificationBell Component Not Integrated** [FIXED 2025-11-29] - Imported and rendered `NotificationBell` component in sidebar footer next to UserMenu. Bell icon shows unread count badge and opens slide-out sheet with notifications list. Also added missing `credentials: 'include'` to PATCH API calls.
93. ✅ **Advanced Search Clear All Not Resetting Results** [FIXED 2025-11-29] - Added `onClear` callback prop to `AdvancedSearch` component. Parent transactions page now passes a handler that resets `currentFilters` to `null` and refetches all transactions from the API when "Clear All" is clicked.

---

## Known Minor Issues (Not Blocking)

- **Session Ping 401 Errors in TEST MODE** - Console shows repeated 401 Unauthorized errors for `/api/session/ping` endpoint with message "Session ping returned 401 without reason: {error: No session found}". This is expected in TEST_MODE since session management is disabled. Non-blocking, app functions correctly.

- ~~**Dashboard Collapse State Not Persisting** - The collapsible sections on the dashboard (Budget Details, Debt & Credit) reset to expanded state on page reload. Would be a nice-to-have to remember collapse state in localStorage.~~ **FIXED 2025-11-30**: Fixed hydration mismatch by using useEffect for localStorage read.

- ~~**Transaction History Route Missing** - `/dashboard/transaction-history` redirects to main dashboard. The route appears to not be implemented or was removed. Transaction audit trail functionality may need to be added in a future update.~~ **FIXED 2025-11-30**: Fixed build error caused by `transaction-audit-log.tsx` importing server-only code. Split `audit-logger.ts` into server and client-safe files (`audit-utils.ts`).

- **Bill Instance Operations Not Implemented** - The bill detail page (`/dashboard/bills/[id]`) displays bill instances (overdue and upcoming) but does not provide UI for managing them. Missing features: "Mark as Paid" button, "Mark as Pending" button, "Link to Transaction" functionality. Users cannot manually track bill payments from the bill detail view. Bill auto-detection via transactions works, but manual status updates are not available.

- ~~**Edit Transaction Success Message Incorrect** - When updating a transaction, the success toast says "Transaction created successfully!" instead of "Transaction updated successfully!". Functionality works correctly, just the message text is wrong. Located in `components/transactions/transaction-form.tsx`.~~ **FIXED 2025-11-30**: Updated success message to use `isEditMode` conditional.

---

## Bug Tracking Guidelines

**Adding New Bugs:**
- Add to the "New Bugs" section at the top of this file
- Format: `- **Bug Name** - Brief description of the issue`
- Include file paths and line numbers when known

**Working on Bugs:**
- Move bug from "New Bugs" or "Active Bugs" to "In Progress"
- Create implementation plan in `docs/` folder (e.g., `docs/bug-name-fix-plan.md`)
- Reference the plan file location in the bug entry

**Incomplete Tasks:**
- Keep in "In Progress" section with status note
- Document what remains unfinished
- Reference the plan file for continuation

**Completed Bugs:**
1. Move to "Fixed Bugs" section with next sequential number
2. Format: `N. ✅ **Bug Name** [FIXED YYYY-MM-DD] - 1-2 line description of the fix`
3. Update metrics table (decrement Active Bugs, increment Fixed count)
4. Delete the associated plan file from `docs/`
5. Commit and push changes
