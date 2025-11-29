# Bugs Status (Updated 2025-11-29)

---

## New Bugs

<!-- Add new bugs here in the format: -->
<!-- - **Bug Name** - Brief description of the issue -->

- **Monthly Bill Category Displays in Two Budget Sections** - On the Budgets page (`/dashboard/budgets`), categories with type "Monthly Bill" (like Rent) appear in both "Essential Expenses" AND "Discretionary Spending" sections. The category should only appear in one section. **Location:** The grouping logic in the budgets page component that separates categories into sections (likely in `app/dashboard/budgets/page.tsx` or a related component). **Impact:** Confusing UX as users see the same category twice with the same budget amount. **Fix:** Review the category grouping logic to ensure "monthly_bill" type categories are only placed in one section (likely "Essential Expenses" since fixed bills are typically essential).

- **Debt Payoff Strategy Not Updating After Adding New Debt** - When adding a new debt on the Debts page, the Debt Payoff Strategy section does not update to include the newly added debt. The "Your Payoff Order" list and "Method Comparison" calculations remain stale, still showing the old debt count and calculations. **Location:** `components/debts/debt-payoff-strategy.tsx` - The component doesn't re-fetch or recalculate when debts are added. **Impact:** Users see incorrect payoff projections after adding new debts. A high-APR credit card (22.99%) was added but the calculator still showed only 3 debts instead of 4, with unchanged interest calculations. **Fix:** Add a dependency on the debts list or implement a refresh mechanism when debts change.

- **Identical Interest Calculations for Snowball vs Avalanche Despite Different Timeframes** - The Debt Payoff Strategy comparison shows identical total interest amounts for both Snowball and Avalanche methods even when the payoff timeframes differ significantly (e.g., 50 months vs 35 months). **Example:** With $200 extra payment, Snowball shows 50 months/$1,350.53 interest while Avalanche shows 35 months/$1,350.53 interest. Mathematically, paying debt for 15 additional months should accumulate more interest with the slower method. **Location:** `lib/debts/payoff-calculator.ts` - The interest calculation logic may not properly account for interest accrual during the extended payoff period. **Impact:** Users cannot make informed decisions between methods because the interest savings are always shown as $0. **Fix:** Review the interest calculation algorithm in `calculatePayoffStrategy` and `comparePayoffMethods` functions to ensure interest is properly calculated based on remaining balances over time.

- **Payment Tracking Section Not Reflecting Recorded Payments** - The Payment Tracking section on the Debts page shows "No payment history yet" even after multiple payments have been recorded. **Tested with:** Recorded $500 on Test Credit Card and $300 on Student Loan - Payment Tracking still shows empty state. **Impact:** Users have no visibility into their payment adherence or streak despite actively making payments. **Fix:** Investigate why the Payment Tracking component isn't fetching or displaying payment history data.

- **Debt-Free Countdown Widget Shows Stale Data After Payments** - The Debt-Free Countdown widget does not update after payments are recorded. The "Total Remaining" value stays at the initial load amount (e.g., $34,200) even after payments reduce the actual balance to $33,400. The stats bar below correctly updates. **Impact:** Users see misleading information about their debt-free timeline. **Fix:** Add a refresh mechanism for the countdown widget when payments are recorded.

---

## Active Bugs

- **Monthly Bill Category Displays in Two Budget Sections** - See New Bugs section above
- **Debt Payoff Strategy Not Updating After Adding New Debt** - See New Bugs section above
- **Identical Interest Calculations for Snowball vs Avalanche Despite Different Timeframes** - See New Bugs section above
- **Payment Tracking Section Not Reflecting Recorded Payments** - See New Bugs section above
- **Debt-Free Countdown Widget Shows Stale Data After Payments** - See New Bugs section above

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
| Active Bugs | 5 |
| Tests Passing | 590/590 (100%) |
| Linter Errors | 0 |
| Linter Warnings | 0 |
| Build Status | Passing |
| Fixed (All Time) | 652 (76 bugs + 310 warnings + 195 errors + 71 additional) |

---

## Fixed Bugs (76 total)

1. ✅ **Credit Card Available Balance Calculation Wrong with Negative Balance** [FIXED 2025-11-29] - Fixed available credit and utilization calculations in `account-card.tsx` to use `Math.abs()` on balance. Now handles both positive and negative balance conventions correctly.
2. ✅ **What-If Calculator Fails with 400 Error for Weekly/Quarterly Frequencies** [FIXED 2025-11-29] - Updated `/api/debts/scenarios/route.ts` validation to accept all 4 payment frequencies (weekly, biweekly, monthly, quarterly) instead of just monthly and biweekly. Aligned with `PaymentFrequency` type definition.
2. ✅ **Weekly/Biweekly Bill Instance Dates Off-By-One** [FIXED 2025-11-29] - Fixed timezone bug in `calculateNextDueDate` function where `toISOString().split('T')[0]` converted dates to UTC, causing off-by-one errors for evening users. Replaced with `format(date, 'yyyy-MM-dd')` from date-fns to preserve local date. Also fixed monthly/quarterly/semi-annual/annual frequencies for consistency.
2. ✅ **Middleware to Proxy Convention Migration** [FIXED 2025-11-29] - Migrated from deprecated `middleware.ts` to `proxy.ts` per Next.js 16 convention. Renamed file and exported function from `middleware` to `proxy`, removed obsolete `runtime` config since proxy always runs on Node.js.
2. ✅ **Response Body Stream Already Read (Household Context)** [FIXED 2025-11-29] - Fixed TypeError "Failed to execute 'json' on 'Response': body stream already read" in household-context.tsx by adding `deduplicate: false` to enhancedFetch calls, preventing shared Response objects in React Strict Mode.
3. ✅ **Response Body Stream Already Read (Onboarding Context)** [FIXED 2025-11-29] - Fixed same TypeError in onboarding-context.tsx with identical fix. Root cause was request deduplication returning the same Response object to multiple callers in Strict Mode.
3. ✅ **Linter Cleanup - Remaining Directories** [FIXED 2025-11-28] - Fixed all 73 ESLint issues (17 errors + 56 warnings) in __tests__/, scripts/, contexts/, and hooks/ directories. Replaced `any` types with proper TypeScript interfaces, prefixed unused variables with `_`, removed unused imports, and fixed React hook dependencies.
2. ✅ **Fix Integration Test Failures (50 tests)** [FIXED 2025-11-28] - Fixed all 50 failing tests after Household Data Isolation. Updated rule-matcher.test.ts (25), actions-executor.test.ts (7), transaction-creation-rules.test.ts (5), migrate-to-household-preferences.test.ts (12), user-household-preferences.test.ts (1). Also fixed bug in getOrMigratePreferences where empty array check was incorrect.
2. ✅ **Split Builder Auto-Calculation UX** [FIXED] - Replaced silent auto-calculation with explicit "Balance Splits" button and "Balanced" badge indicator for clearer UX
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

(None)
