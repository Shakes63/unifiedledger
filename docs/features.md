# Features to Implement

## New Features

_Add new feature ideas here_

---

## Incomplete Features

### Testing Backlog (still needs tests)

_These features are implemented, but still need dedicated automated test coverage (unit/integration/component as appropriate)._

- [x] **Google Calendar Sync (Test Coverage)** - Automated coverage for calendar sync API routes + sync service logic (event creation/update/delete, sync modes, error handling). **Plan:** `docs/google-calendar-sync-tests-plan.md` (✅ status/enable/settings/sync/calendars/disconnect route tests, ✅ `lib/calendar/sync-service.ts` unit coverage incl. incremental `syncEntity` branches).
- [x] **TickTick Calendar Sync (Test Coverage)** - API routes + sync service logic (OAuth token handling, project selection, task upsert, sync modes). **Plan:** `docs/ticktick-calendar-sync-tests-plan.md` (✅ Phase 1: `GET /api/calendar-sync/ticktick/connect` + `GET/POST /api/calendar-sync/projects` tests; ✅ Phase 2: `/api/calendar-sync/ticktick/callback` redirect + token/project upsert coverage; ✅ Phase 3: TickTick provider paths covered in `lib/calendar/sync-service.ts` unit tests; ✅ Optional: `lib/calendar/ticktick-calendar.ts` unit coverage (token refresh + reminders via task payload)).
- [x] **Two-Factor Authentication (2FA) (Test Coverage)** - Added automated tests for 2FA API routes + core utilities (status/enable/verify/backup-codes/disable/verify-login + `lib/auth/two-factor-utils.ts`). **Plan:** `docs/two-factor-auth-test-coverage-plan.md`
- [x] **Autopay System (Test Coverage)** - Added automated coverage for calculator, cron route contract, processor selection, transaction creation, and autopay notifications. **Plan:** `docs/autopay-system-tests-plan.md`
- [x] **Offline Sync Queue (Test Coverage)** [COMPLETED 2025-12-13] - Added automated coverage for offline transaction sync orchestration + queuing (sync, retries, status, discard), including real IndexedDB-backed queue tests for `lib/offline/transaction-queue.ts`.
- [x] **Admin User Management (Test Coverage)** [COMPLETED 2025-12-13] - Added automated API coverage for `/api/admin/users` GET/POST and `/api/admin/users/[userId]` PUT/DELETE, including owner gating and key validation/error cases.
- [x] **Notification Delivery & Preferences** [COMPLETED 2025-12-13] - Implemented per-type channel routing, best-effort push/email delivery dispatch, and rate limiting with unit test coverage.
- [x] **PDF Export** (Tax Dashboard) [COMPLETED 2025-12-13] - Added server-backed PDF export route (`/api/tax/export/pdf`) and automated coverage for generator output + response headers/body.
- [x] **Sales Tax Pipeline (Test Coverage)** [COMPLETED 2025-12-13] - Added API contract tests for `GET /api/sales-tax/quarterly`, covering validation, by-account grouping, quarter filtering, and tax breakdown shape.
- [x] **Email Flows** [COMPLETED 2025-12-13] - Added automated coverage for resend verification rate limiting + email-change verification callback, and implemented tested provider fallback behavior (Resend → SMTP, SMTP → Resend).
- [x] **Backup System** [COMPLETED 2025-12-14] - Added automated coverage for backup retention logic and backup download/delete permissions (user + household isolation) across API + lib.
- [ ] **Household Data Isolation (end-to-end)** - cross-household access attempts blocked across all household-scoped modules (beyond unit checks)

---

## Completed Features

61. **Backup System** [COMPLETED 2025-12-14] - Scheduled backups with retention policies and secure download/delete flows, now with automated API + lib test coverage.
60. **TickTick Calendar Sync** [COMPLETED 2025-12-07] - Sync bills, milestones, and payoff dates to TickTick as tasks with due dates. Uses OAuth2 authentication, project selection, and same sync modes as Google Calendar integration.

59. **Google Calendar Sync** [COMPLETED 2025-12-07] - Sync bill due dates, savings milestones, debt milestones, and payoff dates to Google Calendar. Features two sync modes: Direct (events on actual dates) and Budget Period (grouped by pay period). Includes OAuth integration, auto-sync triggers when data changes, deep links back to app, and reminder configuration.

58. **Unified Debt, Bill & Credit Card Architecture** [COMPLETED 2025-12-04] - Major refactor unifying credit cards, lines of credit, and debt bills into a single financial obligation tracking system with 19 phases: enhanced schemas, account/bill forms, autopay, budget integration, payoff strategies, calendar, notifications, tax integration, CSV import improvements, dashboard widgets, balance history, category simplification, recurring income, budget rollover, savings goals integration, and bill classification.

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
