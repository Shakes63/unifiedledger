# Bugs Status (Updated 2025-12-16)

---

## New Bugs
- (None)

---

## Active Bugs

(None)


---

## In Progress

- (None)

---

## Improvement Backlog

(None)

---

## Current Status

| Metric | Count |
|--------|-------|
| Active Bugs | 0 |
| Tests Passing | 948/948 (100%) |
| Linter Errors | 0 |
| Linter Warnings | 0 |
| Build Status | Passing |
| Fixed (All Time) | 779 (203 bugs + 310 warnings + 195 errors + 71 additional) |

---

## Fixed Bugs (203 total)

203. ✅ **Dashboard “Bills by Category” card has excess empty space with a single category** [FIXED 2025-12-16] - Hide the fixed-height pie chart when only one category is present so the card collapses; added regression test.
202. ✅ **Dashboard “Bills by Category” excludes credit card payment bills** [FIXED 2025-12-16] - Variable credit card payment bills now derive monthly totals from upcoming instances when `expectedAmount=0`, so they appear in the category breakdown; added regression tests.
201. ✅ **Test data access endpoint exposes user data and isn’t household-scoped** [FIXED 2025-12-15] - Locked `/api/test-data-access` to TEST_MODE-only (404 otherwise) and enforced household context in test mode; added regression test.
200. ✅ **CSV export endpoint is not household-scoped and joins are not ownership-filtered** [FIXED 2025-12-15] - Required household context and scoped all CSV export joins/queries by `userId + householdId` to prevent cross-household leakage; added regression test.
199. ✅ **Custom field values endpoint reads values by transactionId without user/household scoping** [FIXED 2025-12-15] - Enforced household membership, scoped transaction validation to household, and scoped custom field value/field operations by `userId`; added regression test.
198. ✅ **Transaction tags endpoint can read/write associations without full ownership scoping** [FIXED 2025-12-15] - Enforced household membership, validated transaction household, and scoped tag association reads/deletes by `userId`; added regression test.
197. ✅ **Accept transfer suggestion does not validate transaction ownership/household** [FIXED 2025-12-15] - Scoped accept handler transaction selects/updates by `userId + householdId` after enforcing household membership; added regression test.
196. ✅ **Transfers/suggest API ignores household context for transfer-pair analytics** [FIXED 2025-12-15] - Enforced household membership and scoped transfer-pair analytics + account enrichment by `userId + householdId`; added regression test.
195. ✅ **Transfers/[id] API leaks account names and can mutate balances without ownership checks** [FIXED 2025-12-15] - Enforced household membership and scoped account/transaction enrichment + balance mutations by validating linked accounts in the active household; added regression test.
194. ✅ **Categorization suggestion API ignores household context and fetches category by id without ownership constraints** [FIXED 2025-12-15] - Enforced household membership and scoped merchant/history/category lookups by `userId + householdId`; added regression test.
193. ✅ **Suggestions API ignores household context** [FIXED 2025-12-15] - Enforced household membership and scoped suggestions queries by `userId + householdId`; added regression test.
192. ✅ **Calendar month API is not household-scoped + milestone enrichment queries are unscoped** [FIXED 2025-12-15] - Added household membership enforcement and scoped month queries + milestone enrichment lookups by `userId + householdId`; added regression test.
191. ✅ **Calendar day API is not household-scoped + uses unscoped account/bill lookups by id** [FIXED 2025-12-15] - Added household membership enforcement and scoped all calendar-day queries/enrichment lookups by `userId + householdId`; added regression test.
190. ✅ **Household isolation missing in spending summary API** [FIXED 2025-12-15] - Scoped transaction/category queries by `userId + householdId` and added a regression test to prevent cross-household leakage.
189. ✅ **Account change handler can move transactions across households and log to wrong household** [FIXED 2025-12-13] - Derived householdId from the transaction, validated target account household, scoped balance/transaction updates by `userId + householdId`, and logged activity to the transaction’s household; added regression test.
188. ✅ **Split creation isn’t household-scoped and updates transaction by id only** [FIXED 2025-12-13] - Derived householdId from the source transaction and scoped category validation + transaction updates by `userId + householdId`; added regression test.
187. ✅ **Transfer conversion/account balance updates aren’t ownership-scoped** [FIXED 2025-12-13] - Scoped transfer conversion transaction/account updates by `userId + householdId` and validated target account household; added regression tests.
186. ✅ **Transfer conversion matching is timezone-sensitive** [FIXED 2025-12-13] - Replaced `new Date()` + UTC string windows with `parseISO` + local `yyyy-MM-dd` date range bounds (and calendar-day scoring); added regression tests.
185. ✅ **Transfer conversion can match transactions across households** [FIXED 2025-12-13] - Transfer matching now filters candidate transactions by `householdId` and excludes self-matches; added regression tests.
184. ✅ **CSV import confirm applies rules incompletely (category only) and doesn’t log execution** [FIXED 2025-12-13] - Confirm now runs `executeRuleActions()` for matched rules, applies non-category mutations, and logs `ruleExecutionLog.appliedActions`; added regression test.
183. ✅ **Repeat Transaction applies rules incompletely (category only)** [FIXED 2025-12-13] - Reuse `executeRuleActions()` in the repeat endpoint to apply non-category actions and log `appliedActions`; added a regression test.
182. ✅ **Repeat Transaction can update category usage across households/users** [FIXED 2025-12-13] - Scoped repeat endpoint category usage select/update by `userId + householdId` and added a regression test.
181. ✅ **findAllMatchingRules ignores household isolation** [FIXED 2025-12-13] - `findAllMatchingRules` now requires householdId and scopes DB rule selection accordingly; added regression test asserting household filtering is included in the query.
180. ✅ **Rules action executor lookups aren’t household-scoped** [FIXED 2025-12-13] - `executeRuleActions()` now scopes category/merchant validation lookups by household when householdId is provided, and apply-bulk context lookups are household-filtered.
179. ✅ **Bulk apply rules endpoint docs mention unsupported query param** [FIXED 2025-12-13] - Removed misleading `categoryId` query param docs from apply-bulk route and added a unit test ensuring extra query params don’t break the handler.
178. ✅ **Rule action preview shows “Unknown” for merchant/account actions** [FIXED 2025-12-13] - Hydrated merchant/account names once and passed them into the Rules page action preview so merchant/account/transfer actions display correct labels; added regression test.
177. ✅ **isActionImplemented() is outdated vs actual supported actions** [FIXED 2025-12-13] - Added missing action types to the helper and extended rules executor tests so UI gating can’t drift from actual support.
176. ✅ **RulesManager N+1 category fetches** [FIXED 2025-12-13] - Updated `fetchRules()` to load categories once and hydrate rule category names locally; added regression test to ensure only one categories request.
175. ✅ **Rules list returned in reverse priority order** [FIXED 2025-12-13] - Changed `/api/rules` to sort by ascending priority to match rule engine semantics and added an API ordering regression test.
174. ✅ **Rules priority reorder can assign duplicate priorities** [FIXED 2025-12-13] - Made priority swapping immutable in `RulesManager` to prevent duplicate priorities and added a regression test.
173. ✅ **Tailwind CSS variable class warnings** [FIXED 2025-12-13] - Replaced `*-[var(--...)]` Tailwind classes with v4 shorthand `*-(--...)` and added a regression test to prevent reverting.
172. ✅ **Logo triggers Next.js LCP warning** [FIXED 2025-12-13] - Marked above-the-fold `/logo.png` usages as `priority` (eager) and added a regression test to prevent removing it.
171. ✅ **Create New Household does not create household** [FIXED 2025-12-13] - Added `credentials: 'include'`, trimmed payload, and toast-based error handling in Settings; added regression test to ensure create-household POST includes credentials.
170. ✅ **Manage Households navigates to wrong Settings section** [FIXED 2025-12-13] - Sidebar household dropdown now routes to `section=households&household=<id>&tab=members` and includes a regression test.
169. ✅ **Cannot Disable OAuth Provider Without Supplying Secret** [FIXED 2025-12-12] - Allowed disabling an existing provider without re-entering secrets in both UI validation and `/api/admin/oauth-settings`.
168. ✅ **OAuth Link Validation Ignores DB Settings** [FIXED 2025-12-12] - `/api/user/oauth/link/[provider]` now treats DB-configured providers as configured (matches login provider availability).
167. ✅ **Admin OAuth Settings For Google/GitHub Have No Effect** [FIXED 2025-12-12] - Better Auth OAuth config and `/api/user/oauth/available` now load provider configuration from `oauth_settings` (fallback to env vars); changes still require restart.
166. ✅ **Interest Paid Monthly Breakdown Collides on Duplicate Account Names** [FIXED 2025-12-12] - Disambiguated duplicate account names by appending a short ID suffix so chart keys don’t merge.
165. ✅ **Balance History Aggregation Collides on Duplicate Account Names** [FIXED 2025-12-12] - Disambiguated duplicate account names by appending a short ID suffix so stacked series don’t overwrite.
164. ✅ **Line Of Credit Draw Period Countdown Can Be Off-By-One** [FIXED 2025-12-12] - Switched to `parseISO` + `differenceInCalendarDays` against `startOfDay(new Date())` for stable day counts.
163. ✅ **Accounts Charts Parse Date-Only Strings with new Date()** [FIXED 2025-12-12] - Updated chart date formatting to use `parseISO()` for date-only labels.
162. ✅ **Account History Date Ranges Are Timezone-Sensitive** [FIXED 2025-12-12] - Replaced `toISOString().split('T')[0]` with local `format(..., 'yyyy-MM-dd')` and `startOfDay` boundaries in account history APIs.
161. ✅ **/api/bills/match GET Returns “Matched” Transactions** [FIXED 2025-12-12] - Added `billId IS NULL` filtering so the endpoint only returns truly unmatched expense transactions.
160. ✅ **Bill Classification Summary Upcoming Window Uses UTC Boundaries** [FIXED 2025-12-12] - Replaced `toISOString().split('T')[0]` with `format(..., 'yyyy-MM-dd')` to align date window filters with local `startOfDay`.
159. ✅ **Bills “By Period” API Can Assign Wrong Period** [FIXED 2025-12-12] - Switched date-only parsing from `new Date()` to `parseISO()` to prevent timezone shifts affecting budget period selection.
158. ✅ **Next-Due Bills API Can Miscompute daysUntilDue / next7Days** [FIXED 2025-12-12] - Parsed bill instance `dueDate` via `parseISO()` for consistent day calculations and sorting across timezones.
157. ✅ **Bill Matching Date Helpers Are Timezone-Sensitive** [FIXED 2025-12-12] - Updated day/day-of-week extraction to use `parseISO()` for date-only strings to avoid off-by-one matching.
156. ✅ **BillForm One-Time Due Date Can Be Falsely “In The Past”** [FIXED 2025-12-12] - Validated one-time `specificDueDate` using `parseISO()` to prevent timezone-induced “past date” errors.
155. ✅ **Budget Group Assign API Skips Type Validation** [FIXED 2025-12-12] - Added server-side validation so `/api/budget-groups` rejects assigning categories whose `type` doesn’t match the target group.
154. ✅ **Cross-Type Subcategory Links Possible** [FIXED 2025-12-12] - Cleared parent selection on category type changes in the UI and enforced parent/child type matching on the category update API.
153. ✅ **Budget Groups Can Become Self-Parenting / Nested** [FIXED 2025-12-12] - Prevented budget groups from ever having `parentId` and blocked self-parenting cycles in category updates.
152. ✅ **Budget Templates Dropdown Opens Modal** [FIXED 2025-12-11] - Created `BudgetTemplateSelector` component with dropdown menu showing 3 predefined templates (50/30/20, Zero-Based, 60% Solution). Replaced non-functional buttons in budget page and modal with the new component. Template selection prompts for monthly income and applies calculated budget allocations.
151. ✅ **What-If Calculator API Error** [FIXED 2025-12-10] - Added missing `name` field to scenarios payload in `what-if-calculator.tsx`. The API requires scenario names but the component was not including them in the POST request.
150. ✅ **Transfer Form Missing Credit Card Detection** [FIXED 2025-12-10] - Ported Phase 5 auto-detection logic from `transaction-form.tsx` to `transfer-form.tsx`. Added useEffect hook to detect payment bills when selecting destination credit card accounts, and banner UI showing bill status (overdue/partial), due date, and expected amount.
149. ✅ **Dashboard Bill Due Date Off-By-One** [FIXED 2025-12-10] - Replaced `new Date(dateString)` with `parseISO` from date-fns in EnhancedBillsWidget and NextPaymentDueWidget. Date-only strings were parsed as UTC midnight and shifted backward in local timezones.
148. ✅ **Phase 10 NotificationsTab Not Rendered** [FIXED 2025-12-10] - Added Notifications tab to Household settings that renders the comprehensive NotificationsTab component with all Phase 10 features (High Utilization Alerts with threshold selector, Credit Limit Change notifications, Income Late Alerts). Removed duplicate condensed notifications from HouseholdPersonalTab.
147. ✅ **Toast Notifications Not Rendering** [FIXED 2025-12-10] - Added Sonner `<Toaster />` component to `app/layout.tsx`. Toast notifications (success, error, etc.) throughout the entire application were previously invisible because the Toaster container was missing.
146. ✅ **Credit Card Payment Auto-Detection UI** [FIXED 2025-12-09] - Added auto-detection banner when creating transfers to credit card accounts with linked payment bills. Shows bill name, due date, expected amount, and status (overdue/partial) using theme variables.
145. ✅ **Next 7 Days Bill Count Off-By-One** [FIXED 2025-12-08] - Fixed inconsistent date comparison in `/api/bills/next-due`. Changed from string comparison to `differenceInDays` arithmetic to match `daysUntilDue` calculation, ensuring bills exactly 7 days away are included in "Next 7 days" count.
144. ✅ **Dashboard Cards 500 Error on Empty Data** [FIXED 2025-12-08] - Fixed API error handling in `/api/debts/countdown` and `/api/budgets/summary` to properly catch household membership errors (403) instead of falling through to 500. Updated components to handle error responses gracefully without logging expected errors.
143. ✅ **TickTick OAuth UI Configuration** [FIXED 2025-12-07] - Added TickTick OAuth configuration to Admin tab in Settings. Credentials are stored encrypted in database with fallback to environment variables for backwards compatibility.
142. ✅ **Test Mode Owner Access** [FIXED 2025-12-07] - Added TEST_MODE bypass to requireOwner() helper so the test user can access owner-only features like OAuth configuration.
141. ✅ **Bill Period Assignment Shows Next Month's Instances** [FIXED 2025-12-07] - Fixed bills-by-period API to verify manual period assignments are for the correct month. Prevents "Always Period 2" from showing January's instance in December's Period 2 view.
140. ✅ **Budget Period Dropdown Shows Wrong Options** [FIXED 2025-12-07] - Made budget period assignment dropdown dynamic based on budget schedule. Monthly hides dropdown, semi-monthly/biweekly shows 2 options, weekly shows 4 options. Auto-resets invalid assignments when schedule changes.
139. ✅ **Select.Item Empty Value Error in BillForm** [FIXED 2025-12-07] - Changed budgetPeriodAssignment SelectItem from `value=""` to `value="auto"` since Radix UI reserves empty string for "no selection" state.
138. ✅ **Budget Period Semi-Monthly Option Missing** [FIXED 2025-12-07] - Not a bug; semi-monthly ("first and fifteenth") is already supported via Settings → Financial → Budget Schedule → "Twice a Month" option.
137. ✅ **Budget Period Setting Not Applied** [FIXED 2025-12-07] - Removed redundant "Budget Period" dropdown from Household Financial Settings that wasn't connected to budget display. Added info card pointing users to the correct Budget Schedule section in Financial settings.
136. ✅ **Debt Strategy Toggle Missing from Debts Page** [FIXED 2025-12-06] - Added strategy toggle card to debts page synced with settings, updated Debt-Free Countdown to show strategy status badge ("Avalanche Strategy" / "Manual Mode"), and added strategyEnabled to countdown API response.
135. ✅ **Budget Save 400 Bad Request** [FIXED 2025-12-06] - Added frontend validation to prevent saving empty budgets array, empty state message when no categories exist, and improved error parsing in budget-manager-modal.tsx.
134. ✅ **Preferences Tab Accounts 403 Forbidden** [FIXED 2025-12-06] - Added useHouseholdFetch hook to preferences-tab.tsx to include x-household-id header when fetching accounts.
133. ✅ **OAuth & Sessions API 401 in TEST_MODE** [FIXED 2025-12-06] - Replaced auth.api.getSession() with requireAuth() in 7 API routes: sessions (list, delete, revoke-all), oauth (providers, set-primary, unlink, link).
132. ✅ **Two-Factor API 401 in TEST_MODE** [FIXED 2025-12-06] - Replaced auth.api.getSession() with requireAuth() in all 5 two-factor API routes (status, enable, disable, verify, backup-codes) for TEST_MODE bypass.
131. ✅ **Household Settings Tabs Overflow** [FIXED 2025-12-06] - Added `overflow-x-auto`, `flex-wrap`, and `gap-1` to household settings tabs container, and reduced tab padding from `px-4` to `px-3` for consistency.
130. ✅ **Credit Card Account Deletion Not Deleting Bills** [FIXED 2025-12-06] - Added bill cleanup to DELETE handler: finds bills linked via `linkedAccountId` or `chargedToAccountId`, deletes their instances, then deletes the bills before deleting the account.
129. ✅ **Credit Card Minimum Payment $0 Bug** [FIXED 2025-12-06] - Added calculateMinimumPayment utility that calculates MAX(floor, balance * percent / 100). Used in account creation/update APIs to set minimumPaymentAmount and bill expectedAmount.
128. ✅ **Font Preload Not Used Warning** [FIXED 2025-12-06] - Added explicit font-family rules in globals.css base layer to use Inter font immediately after preload.
127. ✅ **Session Ping 401 Errors in TEST MODE** [FIXED 2025-12-06] - Expected behavior in TEST_MODE since session management is disabled. Non-blocking.
126. ✅ **Bill Instance Operations** [FIXED 2025-12-06] - Full BillInstanceActionsModal with Mark as Paid/Skip/Pending, Link Transaction tab, and smart match scoring.
125. ✅ **Edit Transaction Success Message** [FIXED 2025-11-30] - Updated success toast to show "updated" vs "created" based on isEditMode.
124. ✅ **Transaction History Route Missing** [FIXED 2025-11-30] - Split audit-logger.ts into server and client-safe files (audit-utils.ts).
123. ✅ **Dashboard Collapse State Not Persisting** [FIXED 2025-11-30] - Fixed hydration mismatch by using useEffect for localStorage read.
122. ✅ **Bills Classification Summary 401** [FIXED 2025-12-06] - Replaced auth.api.getSession() with requireAuth() helper for test mode bypass.
121. ✅ **Font Preloading Warnings** [FIXED 2025-12-06] - Added display: swap to Inter and preload: false to JetBrains Mono.
120. ✅ **Test Mode Initialization Partial State** [FIXED 2025-12-06] - Made initialization resilient with individual record checks and inner try-catch blocks.
119. ✅ **Test Mode API 500 - Onboarding Status** [FIXED 2025-12-06] - Added test mode bypass to return onboardingCompleted: true.
118. ✅ **Test Mode API 500 - Business Features** [FIXED 2025-12-06] - Added test mode bypass to /api/accounts/has-business.
117. ✅ **Test Mode API 500 - Household Preferences** [FIXED 2025-12-06] - Added test mode bypass and missing notification preference fields.
116. ✅ **Test Mode API 500 - Initialization** [FIXED 2025-12-06] - Fixed race condition with missing test mode bypasses in API endpoints.
115. ✅ **Tax Mappings Tab fetchWithHousehold Error** [FIXED 2025-12-02] - Added useHouseholdFetch() hook import to tax-mapping-tab.tsx.
114. ✅ **Sales Tax Toggle Default for Income** [FIXED 2025-12-02] - Auto-enable sales tax toggle when account has enableSalesTax: true.
113. ✅ **Merchant Tax Exemption Not Applied on Update** [FIXED 2025-12-02] - Auto-update isSalesTaxable when changing to tax-exempt merchant.
112. ✅ **TransactionForm formData Reference Error** [FIXED 2025-12-02] - Moved useMemo hook after useState to fix Temporal Dead Zone.
111. ✅ **Tax Deductions Not in Dashboard** [FIXED 2025-12-02] - Added Category-to-Tax-Category Mapping UI with auto-classification.
110. ✅ **Developer Mode Not Persisting** [FIXED 2025-12-02] - Added localStorage caching for instant persistence across navigation.
109. ✅ **Debt Budget Section React Hooks Error** [FIXED 2025-12-01] - Moved useMemo before early returns to fix hooks order.
108. ✅ **Avalanche Focus Debt Threshold** [FIXED 2025-12-01] - Fixed to always use method-based selection regardless of extra payment.
107. ✅ **Debt Budget Individual Payment Status** [FIXED 2025-12-01] - Added status badges (Unpaid/Partial/Paid/Overpaid) per debt card.
106. ✅ **Sales Tax Mark Filed Button UX** [FIXED 2025-12-01] - Fixed hover effects and prevented page jumping on click.
105. ✅ **Sales Tax Mark Filed Button Not Working** [FIXED 2025-12-01] - Added PUT endpoint and onClick handler for Mark Filed button.
104. ✅ **Goals Filter Empty State Message** [FIXED 2025-12-01] - Show filter-aware messages like "No completed goals yet".
103. ✅ **Debt Milestones Not on Calendar** [FIXED 2025-12-01] - Created payoff-date-utils.ts to auto-sync targetPayoffDate.
102. ✅ **Inline Description Edit Box Too Small** [FIXED 2025-12-01] - Replaced Input with multi-line Textarea.
101. ✅ **Inline Transaction Dropdown Creation Bug** [FIXED 2025-12-01] - Fixed stale closure with isCreatingRef for synchronous state.
100. ✅ **Repeat Transaction Date Bug** [FIXED 2025-11-30] - Replaced new Date() with parseISO() for timezone-safe date handling.
99. ✅ **Transaction History Redirects in TEST_MODE** [FIXED 2025-11-30] - Replaced auth.api.getSession() with getAuthUser().
98. ✅ **Transaction History Page Build Error** [FIXED 2025-11-30] - Created client-safe audit-utils.ts to fix 'fs' module error.
97. ✅ **Dashboard Collapse State** [FIXED 2025-11-30] - Fixed hydration mismatch with useEffect for localStorage.
96. ✅ **Merchant Dropdown Shows Usage Numbers** [FIXED 2025-11-30] - Removed usage count display, kept sort by usage.
95. ✅ **Dashboard Recent Transactions Double-Negative** [FIXED 2025-11-30] - Added Math.abs() to amount display.
94. ✅ **Double-Negative Amount Display** [FIXED 2025-11-30] - Added Math.abs() across transaction list, history, and recent.
93. ✅ **Advanced Search Clear All Not Resetting** [FIXED 2025-11-29] - Added onClear callback to reset filters and refetch.
92. ✅ **NotificationBell Not Integrated** [FIXED 2025-11-29] - Added NotificationBell to sidebar footer with unread badge.
91. ✅ **Database Statistics Show All Zeros** [FIXED 2025-11-29] - Created /api/stats endpoint with efficient COUNT queries.
90. ✅ **Transfers Page Stuck Loading** [FIXED 2025-11-29] - Updated to useHousehold context and semantic theme variables.
89. ✅ **Dashboard Budget Dual Auth in TEST_MODE** [FIXED 2025-11-29] - Removed preemptive client-side auth check from BudgetSurplusCard.
88. ✅ **Transaction Detail Page 403** [FIXED 2025-11-29] - Replaced raw fetch() with useHouseholdFetch hook.
87. ✅ **Calendar Day Modal Date Off-By-One** [FIXED 2025-11-29] - Used parseISO() instead of new Date() for UTC fix.
86. ✅ **Calendar Week View Infinite Loop** [FIXED 2025-11-29] - Replaced Date objects with getTime() in useEffect deps.
85. ✅ **Bill Instances Not Generated for Future Years** [FIXED 2025-11-29] - Added on-demand generation via /api/bills/ensure-instances.
84. ✅ **Semi-Annual Bills Only Showing One** [FIXED 2025-11-29] - Changed getInstanceCount from 2 to 4.
83. ✅ **Quarterly Bills Missing October** [FIXED 2025-11-29] - Changed getInstanceCount from 3 to 4.
82. ✅ **Annual Planning Grid Timezone Bug** [FIXED 2025-11-29] - Fixed date parsing to avoid local timezone conversion.
81. ✅ **ESLint-Disable Suppressions** [FIXED] - Removed 9 suppressions with proper type definitions.
80. ✅ **Split Transaction Decimal Rounding** [FIXED] - Added toDecimalPlaces(2, ROUND_HALF_UP).
79. ✅ **Split Transaction TypeScript Any Types** [FIXED] - Created SplitUpdateData interface.
78. ✅ **Split Transaction Duplicate Validation** [FIXED] - Consolidated into validateSplitConfiguration().
77. ✅ **Split Transaction Hardcoded Colors** [FIXED] - Replaced with CSS variables.
76. ✅ **Onboarding Modal Not Scrolling to Top** [FIXED] - Added useRef/useEffect scroll reset.
75. ✅ **Unused Circle Import in OnboardingProgress** [FIXED] - Removed unused import.
74. ✅ **Onboarding Modal Not Resuming After Refresh** [FIXED] - Removed householdList check.
73. ✅ **Invitation Decline Missing Credentials** [FIXED] - Added credentials: include.
72. ✅ **BillForm Category Creation Missing Credentials** [FIXED] - Added credentials: include.
71. ✅ **Tab Visibility Not Triggering Session Check** [FIXED] - Added visibilitychange listener.
70. ✅ **Remember-Me Route Fragile Cookie Regex** [FIXED] - Replaced with auth.api.getSession().
69. ✅ **Session Timeout Cache Not Cleared** [FIXED] - Call clearTimeoutCache().
68. ✅ **Reset App Data Skipped Password Verification** [FIXED] - Added bcrypt verification.
67. ✅ **Email Change Skipped Password Verification** [FIXED] - Added bcrypt verification.
66. ✅ **Password Change Not Implemented** [FIXED] - Created password-utils.ts.
65. ✅ **Intermittent Session Redirects** [FIXED] - Hardened cookie parsing.
64. ✅ **Paid Bills Month Navigation** [FIXED] - Added matching navigation buttons.
63. ✅ **Pending Bills Month Navigation** [FIXED] - Added forward/backward buttons.
62. ✅ **Overdue Bills Sorting** [FIXED] - Fixed to sort oldest first.
61. ✅ **Bill Matching Without Merchants** [FIXED] - Three-tier matching system.
60. ✅ **Bills Not Refreshing After Transaction** [FIXED] - Custom event-based refresh.
59. ✅ **Bill Form Missing Inline Merchant Creation** [FIXED] - Added MerchantSelector.
58. ✅ **Quick Entry Form Missing Bill Payment** [FIXED] - Added bill payment type.
57. ✅ **Quick Entry Form Scrolling Issue** [FIXED] - Added max-h-[90vh].
56. ✅ **Date Formatting Inconsistency** [FIXED] - Standardized to MMM d, yyyy.
55. ✅ **Bills Dropdown Missing Overdue Bills** [FIXED] - Added visual indicators.
54. ✅ **Pending Bill Instances with Past Due Dates** [FIXED] - Auto-update to overdue.
53. ✅ **Overdue Bill Payment Not Removing** [FIXED] - Fixed auto-matching.
52. ✅ **Bill Details Page Failed to Fetch** [FIXED] - Fixed all API calls.
51. ✅ **Bills Not Showing in Transaction Form** [FIXED] - Fixed to fetchWithHousehold.
50. ✅ **Image Aspect Ratio Warning** [FIXED] - Updated to use fill prop.
49. ✅ **Password Field Not Contained in Form** [FIXED] - Wrapped in form elements.
48. ✅ **Combined Transfer View Toggle** [FIXED] - Fixed frontend filtering.
47. ✅ **Transfer Display Logic with Account Filter** [FIXED] - Fixed color coding.
46. ✅ **Quick Transaction Form Required Fields** [FIXED] - Added red asterisks.
45. ✅ **React Hydration Mismatch (Settings)** [FIXED] - Custom button-based tabs.
44. ✅ **React Hydration Mismatch (Sign-In)** [FIXED] - Client-only OfflineBanner.
43. ✅ **Quick Entry Mode Account Loading** [FIXED] - Fixed race condition.
42. ✅ **Logo Image Aspect Ratio Warning** [FIXED] - Removed CSS override.
41. ✅ **CompactStatsBar 403 Forbidden** [FIXED] - Updated fetch hooks.
40. ✅ **Accounts API 403 Forbidden** [FIXED] - Added household guards.
39. ✅ **Transactions API 403 Forbidden** [FIXED] - Added household guards.
38. ✅ **Categories API 403 Forbidden** [FIXED] - Updated to household-aware fetch.
37. ✅ **Transaction Creation Sign-Out Bug** [FIXED] - Added household guards.
36. ✅ **Recent Transactions Infinite Loop** [FIXED] - Memoized fetch hooks.
35. ✅ **SessionActivity pingServer Failed** [FIXED] - Added timeout handling.
34. ✅ **WebVitals sendMetricToAnalytics Failed** [FIXED] - Added batching.
33. ✅ **HouseholdContext loadPreferences Failed** [FIXED] - Added circuit breaker.
32. ✅ **RecentTransactions Failed to Fetch** [FIXED] - Added guards and retry.
31. ✅ **Clerk Redirect URL Deprecation** [FIXED] - Updated env var.
30. ✅ **Image Aspect Ratio Warning** [FIXED] - Added height: auto.
29. ✅ **Reports Charts Dimension Warnings** [FIXED] - Set explicit height={320}.
28. ✅ **Form Field ID/Name Missing** [FIXED] - Added accessibility attributes.
27. ✅ **Reports Chart Dimension Warnings** [FIXED] - Added explicit height.
26. ✅ **Budget Export Incorrect Values** [FIXED] - Fixed transaction type query.
25. ✅ **Goals Page Console Errors** [FIXED] - Fixed schema mismatch.
24. ✅ **Budget Income Display Logic** [FIXED] - Fixed status logic for income categories.
23. ✅ **Dialog Accessibility Warning** [FIXED] - Added DialogDescription to all dialogs.
22. ✅ **Budget Analytics Chart Warning** [FIXED] - Added explicit chart height.
21. ✅ **Bill Save Performance** [FIXED] - Parallelized queries (75% faster).
20. ✅ **Budget Summary 401 Unauthorized** [FIXED] - Integrated useAuth() hook.
19. ✅ **Savings Goals POST 500 Error** [FIXED] - Fixed amount type casting.
18. ✅ **Savings Goals GET 500 Error** [FIXED] - Added error logging.
17. ✅ **Linter Cleanup Phase 2** [FIXED] - Fixed 196 ESLint errors in components/.
16. ✅ **Batch Split Update API** [FIXED] - Added atomic batch endpoint reducing 7+ API calls to 1.
15. ✅ **Split Builder Loading States** [FIXED] - Added onLoadingChange callback and spinner.
14. ✅ **Split Builder Auto-Calculation UX** [FIXED] - Added explicit "Balance Splits" button and badge.
13. ✅ **Fix Integration Test Failures** [FIXED 2025-11-28] - Fixed all 50 failing tests after Household Data Isolation.
12. ✅ **Linter Cleanup - Remaining Directories** [FIXED 2025-11-28] - Fixed 73 ESLint issues in __tests__/, scripts/, contexts/, hooks/.
11. ✅ **Response Body Stream Already Read (Onboarding)** [FIXED 2025-11-29] - Added deduplicate: false to enhancedFetch.
10. ✅ **Response Body Stream Already Read (Household)** [FIXED 2025-11-29] - Added deduplicate: false to enhancedFetch.
9. ✅ **Middleware to Proxy Convention Migration** [FIXED 2025-11-29] - Migrated from middleware.ts to proxy.ts.
8. ✅ **Weekly/Biweekly Bill Instance Dates Off-By-One** [FIXED 2025-11-29] - Used date-fns format() instead of toISOString().
7. ✅ **What-If Calculator 400 Error** [FIXED 2025-11-29] - Updated API validation to accept all 4 payment frequencies.
6. ✅ **Credit Card Available Balance Calculation** [FIXED 2025-11-29] - Fixed to use Math.abs() on balance.
5. ✅ **Monthly Bill Category in Two Budget Sections** [FIXED 2025-11-29] - Fixed to only include variable_expense types.
4. ✅ **Debt-Free Countdown Stale Data** [FIXED 2025-11-29] - Added refreshKey state for component remount.
3. ✅ **Payment Tracking Not Reflecting Recorded Payments** [FIXED 2025-11-29] - Added refreshKey fix.
2. ✅ **Debt Payoff Strategy Not Updating** [FIXED 2025-11-29] - Added refreshKey state forcing remount.
1. ✅ **Identical Interest Calculations Snowball vs Avalanche** [FIXED 2025-11-29] - Rewrote payoff calculator with parallel simulation.

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
