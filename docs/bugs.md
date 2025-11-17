# Bugs Status (Updated 2025-01-27)

## 🆕 ADD NEW BUGS HERE

---

## 🐛 Active Bugs

1. **Bill Matching Not Working for Bills Without Merchants** - Bills with no merchant set are not matching transactions even when category matches. User wants to bypass category-only matching and use direct bill matching (description/amount/date) instead. See `docs/bill-matching-and-refresh-plan.md` for investigation details. **Status:** Refresh mechanism implemented, but matching logic needs enhancement to support description/amount/date matching instead of category-only.

---

## 📊 Current Status

**Active Bugs:** 1
**In Progress:** 0
**Fixed (All Time):** 44

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
26. **Quick Entry Mode Account Loading** - Fixed race condition where accounts were fetched before household context was ready, causing 400 Bad Request errors. Added proper loading states, error handling, and useEffect hook that waits for household initialization before fetching accounts.
27. **React Hydration Mismatch Error (Sign-In Page)** - Fixed hydration mismatch on sign-in page caused by OfflineBanner component rendering differently on server vs client. Implemented client-only rendering pattern using `mounted` state to ensure consistent SSR/client rendering during hydration. Component now returns `null` during SSR and initial client render, then renders after mount. Moved localStorage checks and DOM manipulation to run only after component mounts.
28. **React Hydration Mismatch Error (Settings Page)** - Replaced nested Radix UI Tabs with custom button-based tab implementation to fix hydration mismatch from random ID generation
29. **Quick Transaction Form Required Fields** - Added required field indicators (red asterisks) to Account and Type fields, plus notice explaining required fields
30. **Transfer Display Logic with Account Filter** - Fixed transfer display to show blue (no sign) when no filter or both accounts filtered, red (-) when filtered by source, green (+) when filtered by destination. Added deduplication to combine transfer pairs into single transaction.
31. **Combined Transfer View Toggle Not Working** - Fixed frontend filtering logic in `getFilteredTransactions` function to respect `combinedTransferView` preference. When toggle is OFF (separate view), both `transfer_out` and `transfer_in` transactions are displayed with proper color coding (red for transfer_out, green for transfer_in). Updated `getTransferDisplayProps` to show correct colors even when both accounts are selected in filter. Added preference fetching and state management in transactions page component.
32. **Password Field Not Contained in Form** - Wrapped all password fields in settings page (ProfileTab, DataTab, PrivacyTab) within `<form>` elements with proper `onSubmit` handlers. Changed buttons from `onClick` to `type="submit"` for proper HTML form behavior and accessibility.
33. **Image Aspect Ratio Warning** - Updated all logo Image components (sidebar collapsed/expanded, mobile nav, landing page, transactions page) to use `fill` prop instead of explicit width/height props, eliminating Next.js Image optimization warnings while maintaining aspect ratios.
34. **Bills Not Showing in Transaction Form Dropdown** - Fixed transaction form to use `fetchWithHousehold` instead of regular `fetch` for pending bills API call. Added household ID check and proper dependencies to useEffect hook.
35. **Bill Details Page Failed to Fetch** - Fixed BillDetails component and Edit Bill page to use `fetchWithHousehold` for all API calls (GET, PUT, DELETE). Added household ID checks and proper error handling. Also fixed category-selector bills fetch to use `fetchWithHousehold`.
36. **Overdue Bill Payment Not Removing from List** - Fixed auto-matching logic to include both 'pending' and 'overdue' bill instances when matching transactions to bills. Updated transaction creation endpoint, transaction update endpoint, and bill matching endpoint to prioritize overdue bills first, then pending bills (oldest first). Overdue bills are now automatically matched and marked as paid when transactions are created/updated, causing them to disappear from the overdue bills list.

37. **Pending Bill Instances with Past Due Dates** - Fixed issue where pending bill instances with past due dates weren't automatically marked as overdue. Updated GET endpoint to auto-update pending bills with past dates to overdue status, POST endpoint to set overdue status when creating instances with past dates, and bill creation endpoint to check dates. Also added data consistency fix to revert overdue bills with future dates back to pending.

38. **Bills Dropdown Missing Overdue Bills and Incorrect Sorting** - Fixed transaction form bills dropdown to show both pending and overdue bills, sorted oldest first. Updated API endpoint to sort by ascending due date. Added visual indicators for overdue bills using theme error color.

39. **Date Formatting Inconsistency Between Bills Dropdown and Bills Page** - Fixed date formatting mismatch where transaction form dropdown used `toLocaleDateString()` (browser-dependent format) while bills page used `format(parseISO(dueDate), 'MMM d, yyyy')` from date-fns. Updated transaction form to use the same consistent date format (`MMM d, yyyy`) as the bills page, ensuring dates display consistently across the application (e.g., "Jan 15, 2024").

41. **Quick Entry Form Scrolling Issue** - Fixed quick entry modal being taller than viewport without scrolling. Added `max-h-[90vh] overflow-y-auto` to DialogContent to enable scrolling when form exceeds viewport height.

42. **Quick Entry Form Missing Bill Payment Type** - Added bill payment type to quick entry form with bill selector dropdown, inline merchant creation, and automatic form pre-filling. Bills refresh after bill payment transactions are created.

43. **Bill Form Missing Inline Merchant Creation** - Replaced plain merchant Select dropdown with MerchantSelector component in bill creation and update forms, enabling inline merchant creation matching transaction forms.

44. **Bills Not Refreshing After Transaction Creation** - Implemented conditional bill refresh mechanism using custom events. Bills refresh automatically when 'bill' or 'expense' transactions are created. All bill-displaying components (bills page, widgets, dropdowns) listen for refresh events and update accordingly.

---

## 💡 Known Minor Issues (Not Blocking)

These are minor warnings/deprecations that don't affect functionality:

1. **Middleware Convention:** Next.js deprecation warning - "middleware" file convention should use "proxy" instead

**Note:** These don't require immediate action but can be addressed as polish improvements.
