# Features to Implement

## New Features

- **Debt Rolldown Payment Visualization** - Enhance the Debt Payoff Strategy UI to clearly show how payments change as debts are paid off. Currently only shows minimum payments per debt; should display:
  1. Actual payment amount for the focus debt (minimum + extra)
  2. Projected payment amounts for each subsequent debt after rolldown
  3. Clear progression showing how freed-up payments flow to the next debt
  
  Example display:
  ```
  1. Chase Sapphire - $4,200 @ 22.99%
     → Pay $334/mo ($84 min + $250 extra) - Payoff: Month 15
  
  2. Auto Loan - $8,500 @ 8.9%  
     → After Chase pays off, pay $714/mo ($380 min + $334 rolled) - Payoff: Month 30
  ```

---

## Incomplete Features

_No incomplete features at this time.

---

## Completed Features

1. **Transaction History/Audit Trail** [COMPLETED] - View modification history for transactions showing who made changes, what changed, and when. Displays timeline of all creates, updates, and deletes with field-level change tracking.
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
