# Features to Implement

## New Features

_Add new feature requests here. Include a brief description of what the feature should do._

---

## Incomplete Features

1. **Transaction History/Audit Trail** - View modification history for transactions showing who made changes, what changed, and when.
   - **Status:** Not started
   - **Notes:** Route `/dashboard/transaction-history` exists but shows transaction repeat functionality, not audit logs. Would need new database table for change tracking and modification of transaction update endpoints.

2. **Goal Deadlines on Calendar** - Display savings goal target dates on the calendar view.
   - **Status:** Not started
   - **Notes:** Requires updating calendar API endpoints to fetch goals and calendar components to render goal deadlines.

3. **Debt Milestones on Calendar** - Show debt payoff dates and milestones on the calendar view.
   - **Status:** Not started
   - **Notes:** Requires updating calendar API endpoints to fetch debts and calendar components to render payoff milestones.

---

## Completed Features

1. **Test Mode Feature** [COMPLETED] - Environment variable to bypass authentication for development/testing with auto-created test user.
2. **Non-Monthly Bill Month Selection** [COMPLETED] - Select specific start month for quarterly, semi-annual, and annual bills.
3. **Budget Summary Dashboard** [COMPLETED] - High-level overview page with allocation chart, surplus tracking, and trends.
4. **Persistent Additional Monthly Payment on Debts** [COMPLETED] - Per-debt extra payment commitments for payoff projections.
5. **12-Month Annual Bill Planning Grid** [COMPLETED] - Year-at-a-glance grid for non-monthly bills with status tracking and quick actions.
6. **Recommended Monthly Savings Auto-Calculation** [COMPLETED] - Auto-calculates suggested monthly contribution for goals based on target date.
7. **Onboarding Flow** [COMPLETED] - Step-by-step wizard with demo data option and educational content.
8. **Reports Advanced Filtering** [COMPLETED] - Custom date range picker and multi-field filtering with localStorage persistence.
9. **Admin User Creation** [COMPLETED] - Admin user management UI for CRUD operations with search and pagination.
10. **Invited User Onboarding** [COMPLETED] - Special onboarding flow for invited users with demo data choice.
11. **Household Invite Flow with Email** [COMPLETED] - Invitation system with email notifications and invitation page.
12. **Bill Merchant Field** [COMPLETED] - Optional merchant field for bills with auto-fill from transaction form.
13. **Settings Reorganization** [COMPLETED] - 2-tier navigation (Account/Households) with improved organization.
14. **Quick Entry Mode Enhancement** [COMPLETED] - Keyboard-focused rapid transaction entry modal with smart defaults.
15. **Advanced Permission System** [COMPLETED] - Granular permission management with custom overrides per household member.
16. **OAuth Provider Management** [COMPLETED] - Google/GitHub OAuth with provider linking/unlinking and primary login method.
17. **Admin Backend Section** [COMPLETED] - Admin section with OAuth settings and owner-only access control.
18. **Two-Factor Authentication (2FA)** [COMPLETED] - TOTP-based 2FA with QR code setup and backup codes.
19. **Enhanced Error Handling & Network Infrastructure** [COMPLETED] - Offline request queue with automatic retry and network status monitoring.
20. **Household Data Isolation (Phases 0-4)** [COMPLETED] - Complete data isolation for multi-household support across all financial data.
21. **Better Auth Authentication** [COMPLETED] - Session cookie handling with proper authentication and middleware.
22. **Experimental Features System** [COMPLETED] - Feature gating with Quick Entry, Enhanced Search, Advanced Charts.
23. **Import Preferences** [COMPLETED] - Default CSV import template selection with auto-load.
24. **GeoIP Location Lookup** [COMPLETED] - Session location display with country flags and caching.
25. **Email Verification Flow** [COMPLETED] - Email verification system with email change flow and verification guards.
26. **Session Timeout Enforcement** [COMPLETED] - Automatic logout after configurable inactivity period with activity tracking.
27. **Developer Mode** [COMPLETED] - Debug utility with entity ID badges and developer tools panel.
28. **Household Features** [COMPLETED] - Favorites, sorting, tab-based UI, and role-based management.
29. **Unified Settings Page** [COMPLETED] - Comprehensive settings interface with 2-tier structure (Account/Households).
30. **Avatar Upload** [COMPLETED] - Profile picture upload with display throughout app and initials fallback.
31. **Notifications Tab** [COMPLETED] - Granular per-notification-type channel selection (push/email).
32. **Transaction Performance** [COMPLETED] - 65-75% faster transaction creation via parallel queries.
33. **Income Frequency Tracking** [COMPLETED] - Category-level frequency tracking for budget projections.
34. **Goals Dashboard Widget** [COMPLETED] - Overall progress display across all active savings goals.
35. **Bill Frequency Expansion** [COMPLETED] - Support for one-time, weekly, and biweekly bill frequencies.
36. **Auto-Backup Settings** [COMPLETED] - Automatic backup system with scheduler and backup history.
37. **Authentication Migration** [COMPLETED] - Complete Clerk to Better Auth migration.
38. **Bill Instance Operations** [COMPLETED] - UI for managing bill payment status with Mark as Paid, Mark as Pending, Skip, and Link to Transaction.
