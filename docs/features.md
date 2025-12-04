# Features to Implement

## New Features

_Add new feature ideas here_

---

## Incomplete Features

58. **Unified Debt, Bill & Credit Card Architecture** [IN PROGRESS] - Major refactor to simplify financial obligation tracking. 19 implementation phases. See [Architecture Document](./unified-debt-bill-credit-card-architecture.md) for details.
    - **Phase 1.1: Accounts Enhancement** [COMPLETED 2025-12-03] - Added credit card fields, line of credit type, credit limit history, and balance history tracking tables.
    - **Phase 1.2: Bills Enhancement** [COMPLETED 2025-12-03] - Added bill type/classification, account linking, autopay settings, debt extension fields, and tax deduction settings.
    - **Phase 1.3: Bill Instances & Payments** [COMPLETED 2025-12-03] - Added partial payment tracking, principal/interest breakdown, bill_payments table, and bill_milestones table.
    - **Phase 1.4: Categories & Household Settings** [COMPLETED 2025-12-03] - Added system/interest category flags, budget rollover fields, and debt payoff strategy settings.
    - **Phase 1.5: Transactions Enhancement** [COMPLETED 2025-12-03] - Added savings goal link to transactions. Note: Debt-to-bill migration deferred to separate phase.
    - **Phase 2: Account Creation Flow** [COMPLETED 2025-12-03] - Enhanced account form for credit cards and lines of credit with APR, payment due day, minimum payment settings, annual fee tracking, auto-bill creation toggle, and payoff strategy inclusion. Auto-creates linked payment bills and annual fee bills.
    - **Phase 3: Bill Form Updates** [COMPLETED 2025-12-03] - Enhanced bill form with debt toggle (balance, interest, compounding, payoff strategy, tax deduction settings), credit card linking (linkedAccountId for card payments, chargedToAccountId for auto-charges), autopay configuration (account, amount type, days before due), and bill classification dropdown.
    - **Phase 4: Display Updates** [COMPLETED 2025-12-03] - Accounts page grouped by Cash vs Credit with section totals. Debts page unified view combining credit accounts and debt bills with filter tabs. Dashboard shows cash vs credit separation. Enhanced AccountCard with line of credit support, APR display, overpayment handling, strategy inclusion status. Utilization trends and balance history charts added.
    - **Phase 5: Transaction Flow Updates** [COMPLETED 2025-12-04] - Credit card payments via transfers with auto-detection of linked bills. Partial payment handling with shortfall tracking. Payment history recording in bill_payments table. Balance transfers between credit cards (isBalanceTransfer flag). Credit card refunds detection (isRefund flag). Debt bill payments with principal/interest breakdown. Auto-match for chargedToAccountId bills.
    - **Phase 6: Autopay System** [COMPLETED 2025-12-04] - Automatic bill payment processing via daily cron job. Supports fixed, minimum payment, statement balance, and full balance amounts. Creates transfers for credit card payments, expenses for regular bills. Records all payments in bill_payments table. Sends success/failure notifications. Suppresses reminders for autopay bills.
    - **Phase 7: Budget Integration** [COMPLETED 2025-12-04] - Debt strategy toggle in household settings. Strategy mode shows single "Debt Payments" line managed by snowball/avalanche. Manual mode shows individual editable debt lines. Mixed mode supports strategy debts grouped with excluded debts as manual lines. Unified debt budget API combines credit accounts and debt bills.
    - **Phase 8: Payoff Strategy & Per-Debt Inclusion** [COMPLETED 2025-12-04] - Updated payoff strategy calculations to use unified debt sources (credit accounts + debt bills). Added strategy toggle API for per-debt inclusion/exclusion. Migrated settings from debtSettings to householdSettings. Updated debt stats API to support unified mode. UI shows excluded debts separately with toggle buttons.
    - **Phase 9: Calendar Integration** [COMPLETED 2025-12-04] - Bill due dates on calendar including credit card payment bills with linked account display. Autopay processing dates shown on calendar with scheduled payment details. Projected payoff dates from unified sources (credit accounts + debt bills). Bill milestones from unified architecture displayed with achievement celebration styling.
    - **Phase 10: Notifications** [COMPLETED 2025-12-04] - High utilization warnings at configurable thresholds (30%, 50%, 75%, 90%). Credit limit change notifications with utilization impact. Unified debt milestone notifications for credit accounts and debt bills. Notification settings UI with threshold selector and channel configuration.
    - **Phase 11: Tax Integration** [COMPLETED 2025-12-04] - Auto-classification of interest payments from tax-deductible debt bills. Annual limit tracking for student loan interest ($2,500). Interest deduction summary in tax dashboard with progress bars. Limit warning notifications at 80% and 100%. New tax categories for HELOC and business interest.
    - **Phase 12: CSV Import Enhancements** [COMPLETED 2025-12-04] - Credit card statement auto-detection (headers and transaction patterns). Transaction type classification (purchase, payment, refund, interest, fee, cash advance, balance transfer, reward). Statement info extraction (balance, due date, minimum payment). Transfer duplicate prevention (detects other side of existing transfers). Pre-built templates for 7 major card issuers (Chase, Amex, Capital One, Discover, Citi, BoA, Wells Fargo).
    - **Phase 13: Dashboard Widgets** [COMPLETED 2025-12-04] - Updated debt-free countdown widget to use unified debt sources (credit accounts + debt bills). Updated credit utilization widget to use accounts table. Added new Next Payment Due widget showing upcoming bills with overdue highlighting, autopay indicators, and credit card payment linking.
    - **Phase 14: Balance History & Trends** [COMPLETED 2025-12-04] - Daily cron job for balance snapshots (`/api/cron/balance-snapshots`). Utilization trends and balance history charts on Accounts page. Interest Paid report with monthly breakdown and per-account analysis on Debts page.
    - **Phase 15: Category Simplification** [COMPLETED 2025-12-04] - Simplified category types from 6 to 3 (income, expense, savings). Removed variable_expense, monthly_bill, non_monthly_bill, debt types - all consolidated to `expense`. Updated all category forms, APIs, budget displays, and selectors. Migration auto-converts existing categories.
    - **Phase 16: Recurring Income** [COMPLETED 2025-12-04] - Added billType='income' support with income bill creation form, income classification (salary, rental, investment, freelance, benefits, refund), bills page filter tabs (All/Expenses/Income), income-specific statistics cards, late income notifications with cron job, calendar integration with income styling, expected vs actual income tracking in budget overview, and notification preferences for income alerts.
    - **Phase 17: Budget Rollover** [COMPLETED 2025-12-04] - Monthly budget rollover system allowing unused budget to carry forward. Features include: rollover toggle per category, rollover limit settings, monthly cron job for automatic rollover calculation, rollover history audit trail, effective budget display (base + rollover), rollover summary component in budgets page, negative rollover option (household setting), and API endpoints for rollover management.
    - **Phases 18-19** - _Not started_

---

## Completed Features

57. **Merchant Sales Tax Exemption** [COMPLETED] - Mark merchants as sales tax exempt so all income transactions from that merchant are automatically excluded from sales tax calculations. Includes badge display in merchant selector, toggle in merchants page, and auto-exemption indicator in transaction forms.

56. **Sales Tax Exemption for Transactions** [COMPLETED] - Mark income transactions as tax exempt with visual badge indicators, help text in transaction form, and checkbox in quick entry modal.

55. **Category-to-Tax-Category Mapping UI** [COMPLETED] - Settings interface to link budget categories to IRS tax categories with auto-classification when transactions are marked tax deductible.

54. **Business Categories** [COMPLETED] - Categories can be marked as business categories and appear in a dedicated "Business" section in category dropdowns. When selecting categories for a business account transaction, the Business section moves to the top.

53. **Business Account Feature Toggles** [COMPLETED] - Separate toggles for Sales Tax Tracking and Tax Deduction Tracking on accounts, allowing granular control over business features per account.

52. **Business Features Visibility** [COMPLETED] - Tax Dashboard and Sales Tax pages hidden from navigation unless at least one business account exists in the current household.

51. **Multi-Level Sales Tax Rates** [COMPLETED] - Configure separate State, County, City, and Special District tax rates with quarterly estimated payment breakdown by jurisdiction.



50. **Enhanced Debt Free Countdown** [COMPLETED] - Focus debt card showing current target debt name, progress bar, payoff date with months/days countdown, active payment amount with extra payment indicator, and strategy method (snowball/avalanche).

49. **Debt Budget Integration** [COMPLETED] - Debts automatically appear in the budgeting system with auto-populated minimum payments and recommended payment amounts based on the selected payoff strategy. Focus debt is highlighted with strategy-recommended payments.

48. **Sidebar Reorganization** [COMPLETED] - Reorganized sidebar navigation from 5 sections to 6 workflow-based sections: Overview, Track, Plan, Goals, Analyze, Configure. Fixed mobile nav hardcoded colors to use semantic CSS variables.

47. **Tax Dashboard PDF Export** [COMPLETED] - Export button in Tax Dashboard to generate professional PDF reports with summary, deductions by category, and form type organization for accountants.

46. **Budget Adherence Tooltip** [COMPLETED] - Tooltips explaining budget adherence score in CompactStatsBar and BudgetSummaryWidget with help icon and score level explanations.

45. **Business vs Personal Tax Deductions** [COMPLETED] - Filter and track tax deductions separately by business or personal type with auto-detection based on account's business flag, split summary cards, and type badges in the deductions table.

1. **Transaction History/Audit Trail** [COMPLETED] - View modification history for transactions showing who made changes, what changed, and when. Displays timeline of all creates, updates, and deletes with field-level change tracking.
44. **Debt Rolldown Payment Visualization** [COMPLETED] - Enhanced Debt Payoff Strategy UI showing how payments change as debts are paid off, with rolldown arrows, payment breakdowns, and payoff timelines for each debt.
2. **Test Mode Feature** [COMPLETED] - Environment variable to bypass authentication for development/testing with auto-created test user.
3. **Non-Monthly Bill Month Selection** [COMPLETED] - Select specific start month for quarterly, semi-annual, and annual bills.
4. **Budget Summary Dashboard** [COMPLETED] - High-level overview page with allocation chart, surplus tracking, and trends.
5. **Persistent Additional Monthly Payment on Debts** [COMPLETED] - Per-debt extra payment commitments for payoff projections.
6. **12-Month Annual Bill Planning Grid** [COMPLETED] - Year-at-a-glance grid for non-monthly bills with status tracking and quick actions.
7. **Recommended Monthly Savings Auto-Calculation** [COMPLETED] - Auto-calculates suggested monthly contribution for goals based on target date.
8. **Onboarding Flow** [COMPLETED] - Step-by-step wizard with demo data option and educational content.
9. **Reports Advanced Filtering** [COMPLETED] - Custom date range picker and multi-field filtering with localStorage persistence.
10. **Admin User Creation** [COMPLETED] - Admin user management UI for CRUD operations with search and pagination.
11. **Invited User Onboarding** [COMPLETED] - Special onboarding flow for invited users with demo data choice.
12. **Household Invite Flow with Email** [COMPLETED] - Invitation system with email notifications and invitation page.
13. **Bill Merchant Field** [COMPLETED] - Optional merchant field for bills with auto-fill from transaction form.
14. **Settings Reorganization** [COMPLETED] - 2-tier navigation (Account/Households) with improved organization.
15. **Quick Entry Mode Enhancement** [COMPLETED] - Keyboard-focused rapid transaction entry modal with smart defaults.
16. **Advanced Permission System** [COMPLETED] - Granular permission management with custom overrides per household member.
17. **OAuth Provider Management** [COMPLETED] - Google/GitHub OAuth with provider linking/unlinking and primary login method.
18. **Admin Backend Section** [COMPLETED] - Admin section with OAuth settings and owner-only access control.
19. **Two-Factor Authentication (2FA)** [COMPLETED] - TOTP-based 2FA with QR code setup and backup codes.
20. **Enhanced Error Handling & Network Infrastructure** [COMPLETED] - Offline request queue with automatic retry and network status monitoring.
21. **Household Data Isolation (Phases 0-4)** [COMPLETED] - Complete data isolation for multi-household support across all financial data.
22. **Better Auth Authentication** [COMPLETED] - Session cookie handling with proper authentication and middleware.
23. **Experimental Features System** [COMPLETED] - Feature gating with Quick Entry, Enhanced Search, Advanced Charts.
24. **Import Preferences** [COMPLETED] - Default CSV import template selection with auto-load.
25. **GeoIP Location Lookup** [COMPLETED] - Session location display with country flags and caching.
26. **Email Verification Flow** [COMPLETED] - Email verification system with email change flow and verification guards.
27. **Session Timeout Enforcement** [COMPLETED] - Automatic logout after configurable inactivity period with activity tracking.
28. **Developer Mode** [COMPLETED] - Debug utility with entity ID badges and developer tools panel.
29. **Household Features** [COMPLETED] - Favorites, sorting, tab-based UI, and role-based management.
30. **Unified Settings Page** [COMPLETED] - Comprehensive settings interface with 2-tier structure (Account/Households).
31. **Avatar Upload** [COMPLETED] - Profile picture upload with display throughout app and initials fallback.
32. **Notifications Tab** [COMPLETED] - Granular per-notification-type channel selection (push/email).
33. **Transaction Performance** [COMPLETED] - 65-75% faster transaction creation via parallel queries.
34. **Income Frequency Tracking** [COMPLETED] - Category-level frequency tracking for budget projections.
35. **Goals Dashboard Widget** [COMPLETED] - Overall progress display across all active savings goals.
36. **Bill Frequency Expansion** [COMPLETED] - Support for one-time, weekly, and biweekly bill frequencies.
37. **Auto-Backup Settings** [COMPLETED] - Automatic backup system with scheduler and backup history.
38. **Authentication Migration** [COMPLETED] - Complete Clerk to Better Auth migration.
39. **Bill Instance Operations** [COMPLETED] - UI for managing bill payment status with Mark as Paid, Mark as Pending, Skip, and Link to Transaction.
40. **Goal Deadlines on Calendar** [COMPLETED] - Display savings goal target dates on calendar with progress indicators, goal colors, and detailed view in day modal.
41. **Debt Milestones on Calendar** [COMPLETED] - Display debt target payoff dates and achieved milestones (25%, 50%, 75%, 100%) on calendar with progress indicators, debt colors, trophy/credit card icons, and detailed view in day modal.
42. **Inline Transaction Dropdowns** [COMPLETED] - Category and merchant fields editable as inline dropdowns on transaction cards with yellow outline for missing fields.
43. **Extended Inline Transaction Editing** [COMPLETED] - Date, account, amount, and description fields editable directly on transaction cards alongside existing category and merchant dropdowns.
