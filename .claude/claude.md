# Unified Ledger - Finance App Project

## Project Overview
A comprehensive mobile-first personal finance application built with Next.js, featuring transaction tracking, bill management, budgeting, and household financial collaboration.

## Tech Stack
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5.9
- **Styling:** Tailwind CSS v4 + shadcn/ui (17 components)
- **Database:** SQLite with Drizzle ORM
- **Authentication:** Better Auth (fully migrated from Clerk - 100% complete)
- **Package Manager:** pnpm
- **PWA:** next-pwa (temporarily disabled - awaiting Next.js 16 Turbopack support)

## Critical Dependencies
- `decimal.js@10.6.0` - Precise financial calculations (ALWAYS use for money)
- `fastest-levenshtein@1.0.16` - String similarity for duplicate detection
- `papaparse@5.5.3` - CSV parsing
- `recharts@3.3.0` - Charts
- `sonner@2.0.7` - Toast notifications
- `uuid@13.0.0` - UUID generation for database records
- `sharp@0.34.5` - Image processing and optimization for avatars
- `resend@6.4.2` - Email delivery service (primary email provider)
- `nodemailer@7.0.10` - SMTP email client (fallback for self-hosting)
- `react-email@5.0.4` + `@react-email/components@1.0.1` - Email template system

## Project Structure
```
unifiedledger/
├── app/
│   ├── api/                      # API routes (transactions, accounts, bills, rules, settings, etc.)
│   └── dashboard/                # All dashboard pages (main, transactions, accounts, bills, calendar, goals, debts, reports, tax, sales-tax, settings, etc.)
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── transactions/             # Transaction components
│   ├── accounts/                 # Account components
│   ├── bills/                    # Bill components
│   ├── rules/                    # Rules builder
│   ├── charts/                   # Chart components
│   ├── navigation/               # Sidebar + mobile nav
│   ├── settings/                 # Settings page tabs
│   └── [others]/                 # Goals, debts, tags, etc.
├── lib/
│   ├── db/                       # schema.ts, index.ts
│   ├── themes/                   # theme-config.ts, theme-utils.ts
│   ├── rules/                    # Rules engine
│   ├── bills/                    # Bill matching
│   ├── notifications/            # Notification service
│   ├── email/                    # Email service (Resend + SMTP providers)
│   ├── tax/                      # Tax utilities
│   ├── sales-tax/                # Sales tax utilities
│   ├── avatar-client-utils.ts    # Client-safe avatar utilities
│   └── avatar-utils.ts           # Server-only avatar utilities (sharp)
└── docs/                         # Documentation
```

## Development Guidelines

### Always Use pnpm
```bash
pnpm install       # Install dependencies
pnpm dev           # Start dev server
pnpm build         # Build for production
pnpm test          # Run tests
```

### Financial Calculations
**CRITICAL:** Always use `decimal.js` for money calculations to avoid floating-point errors.
```typescript
import Decimal from 'decimal.js';
const total = new Decimal(100.50).plus(new Decimal(25.25)); // ✓ Correct
const wrong = 100.50 + 25.25; // ✗ Never use this
```

### Design System & Theming
**Theming System:**
- 7 themes: Dark (Green, Pink, Blue, Turquoise), Light (Bubblegum, Turquoise, Blue)
- Dynamic theme switching with CSS variables
- Themes defined in `lib/themes/theme-config.ts`, applied via `applyTheme()`
- Preference saved to database

**Always Use Semantic Color Tokens (NOT hardcoded colors):**
- Background: `bg-background`, `bg-card`, `bg-elevated`
- Text: `text-foreground`, `text-muted-foreground`
- Borders: `border-border`
- Transactions: `text-[var(--color-income)]`, `text-[var(--color-expense)]`, `text-[var(--color-transfer)]`
- UI States: `bg-[var(--color-primary)]`, `bg-[var(--color-success)]`, `bg-[var(--color-warning)]`, `bg-[var(--color-error)]`

**Key CSS Variables:**
```
--color-background, --color-card, --color-elevated
--color-foreground, --color-muted-foreground
--color-border, --color-ring
--color-income, --color-expense, --color-transfer
--color-primary, --color-success, --color-warning, --color-error
```

**Typography:** Inter (primary), JetBrains Mono (amounts)
**Border Radius:** 12px (xl), 8px (lg), 6px (md)

### Database
- Drizzle ORM for type-safe queries
- SQLite for local storage
- Schema: `lib/db/schema.ts`
- Migrations: `drizzle-kit generate` and `drizzle-kit migrate`

## Key Features Summary

**All 8 phases complete (100%):**
1. ✅ **Foundation:** Transaction entry (income/expense/transfer), multi-account, categories, merchants, templates, household management
2. ✅ **Intelligence:** Usage tracking, smart categorization, rules system (14 operators, 11 action types), transaction history, splits, advanced search, duplicate detection, CSV import
3. ✅ **Accounts & Calendar:** Transfers with usage-based suggestions, calendar view (month/week), account filtering
4. ✅ **Bills & Budgets:** Auto-detection, payment matching, budget tracking with adherence scoring, templates, variable bill tracking, tags, custom fields, notifications (10 types)
5. ✅ **Goals & Activity:** Savings goals with milestones, debt management with payoff projections, household activity audit trail
6. ✅ **Mobile & Performance:** Offline mode (IndexedDB queue), household system with roles, responsive navigation, service worker caching, performance monitoring, data cleanup cron jobs
7. ✅ **Reporting & Tax:** 6 report types with 7 chart types, tax dashboard, sales tax quarterly reporting (all 50 states), credit utilization tracking, collapsible debt cards
8. ✅ **Testing:** 386 tests (99.5% of plan), 100% unit test coverage, 93% integration test coverage (28/30 passing)

**Recent Additions:**
- Developer Mode Feature (100% COMPLETE - entity ID badges, DEV indicator, developer tools panel)
- Household Favorite Feature (100% COMPLETE - star/favorite households to pin to top of sidebar)
- Household Tab-Based UI (100% COMPLETE - tab-based interface for household settings with member count badges)
- Household Management System (100% COMPLETE - multi-household support with role-based permissions)
- Notifications Tab (100% COMPLETE - granular channel selection for 9 notification types)
- Unified Settings Page (100% COMPLETE - `/dashboard/settings` with 9 comprehensive tabs)
- Transaction save performance optimization (65-75% faster)
- Income frequency tracking (weekly/biweekly/monthly)
- Goals dashboard widget
- All 12 tracked bugs fixed (100% completion)

## Important Architecture Decisions

### Transaction Types
- `income` - Money coming in
- `expense` - Money going out
- `transfer_out` - Money leaving source account
- `transfer_in` - Money arriving at destination account

**Transfer Model:** Creates TWO linked transactions via `transferId`. Main view shows only `transfer_out` to avoid duplicates, account-filtered view shows relevant transaction.

### Rules System
- Priority-based matching (lower number = higher priority)
- First matching rule applies
- Only applies to uncategorized transactions
- 14 operators: equals, not_equals, contains, not_contains, starts_with, ends_with, greater_than, less_than, between, regex, in_list, matches_day, matches_weekday, matches_month
- 8 fields: description, amount, account_name, date, day_of_month, weekday, month, notes
- 11 action types: set_category, set_merchant, set_description, prepend_description, append_description, set_tax_deduction, set_sales_tax, convert_to_transfer, create_split, set_account

### Bill Frequencies
**Supported Frequencies (7 types):**
- **one-time:** Single payment on a specific date (auto-deactivates after payment)
- **weekly:** Repeats every 7 days on the same day of week (creates 8 instances ~2 months ahead)
- **biweekly:** Repeats every 14 days on the same day of week (creates 4 instances ~2 months ahead)
- **monthly:** Repeats every month on the same day of month (creates 3 instances)
- **quarterly:** Repeats every 3 months (creates 3 instances)
- **semi-annual:** Repeats every 6 months (creates 2 instances)
- **annual:** Repeats once per year (creates 2 instances)

**Due Date Field Semantics:**
- one-time: Uses `specificDueDate` field (ISO date string)
- weekly/biweekly: `dueDate` is day of week (0=Sunday, 6=Saturday)
- monthly+: `dueDate` is day of month (1-31)

**Auto-Deactivation:**
- One-time bills automatically become inactive after their instance is marked as paid
- Other frequencies remain active and continue generating future instances

### Bill Matching
- Multi-factor matching using Levenshtein distance
- String similarity (40%), amount tolerance ±5% (30%), date pattern (20%), payee pattern (10%)
- Only auto-links matches ≥90% confidence

### Offline Sync
- IndexedDB queue for pending transactions
- Auto-sync when connection restored
- Retry logic with max 3 attempts
- 30-second timeout per request

## API Patterns

**Standard Response Format:**
```typescript
// List: { data: [...], total: number, limit: number, offset: number }
// Create: { id: string, ...createdItem }
// Error: { error: string }
```

**Common Parameters:** `limit` (default: 50), `offset` (default: 0), `sortBy`, `sortOrder` (asc|desc)

## Database Schema Highlights

**Core:** users, households, householdMembers, accounts, budgetCategories, transactions, transactionSplits, merchants
**Settings:** userSettings, userSessions
**Bills:** bills, billInstances
**Rules:** categorizationRules, ruleExecutionLog
**Tags:** tags, transactionTags, customFields, customFieldValues
**Goals:** savingsGoals, savingsMilestones
**Debts:** debts, debtPayments, debtPayoffMilestones
**Tax:** taxCategories, categoryTaxMappings, transactionTaxClassifications, salesTaxSettings, salesTaxCategories, salesTaxTransactions, quarterlyFilingRecords
**Notifications:** notifications, notificationPreferences, householdActivityLog
**Search:** savedSearchFilters, searchHistory, importTemplates, importHistory, importStaging

## Recent Updates

**All 12 tracked bugs fixed (100%)** - See `docs/bugs.md`

**Latest (2025-11-14):**
- GeoIP Location Lookup (100% COMPLETE): Session location display in Privacy & Security settings
  - ✅ Added location fields (city, region, country, countryCode) to Better Auth session table
  - ✅ Created GeoIP service module using ip-api.com (free tier, 45 req/min)
  - ✅ Special case handling: localhost → "Local Device", private IPs → "Private Network"
  - ✅ In-memory caching with 24-hour TTL for performance
  - ✅ Better Auth hooks to populate location on sign-in/sign-up (asynchronous, non-blocking)
  - ✅ UI displays formatted location with country flag emoji and tooltip
  - ✅ All styling uses semantic theme variables
  - ✅ Graceful degradation if GeoIP service fails
  - Migrations: `0039_add_session_location.sql`, `0040_add_session_location_better_auth.sql`
- Import Preferences (28% COMPLETE): Default CSV import template selection in Data Management settings
  - ✅ Phase 1: Database Schema - Added `defaultImportTemplateId` to userSettings table
  - ✅ Phase 2: API Updates - Updated /api/user/settings with validation
  - ⏳ Phase 3-7: UI, CSV modal integration, transactions page, testing, documentation
  - See `docs/import-preferences-implementation-plan.md` for remaining work
  - Migration: `0041_add_default_import_template.sql`
- Email Verification Flow (100% COMPLETE): Complete email verification system implemented
  - ✅ Email service infrastructure with Resend (primary) and SMTP/Nodemailer (fallback for self-hosting)
  - ✅ Email configuration utility with automatic provider selection (`lib/email/email-config.ts`)
  - ✅ Email templates for verification, email change verification, and welcome emails
  - ✅ Better Auth integration - sends verification emails during signup automatically
  - ✅ Resend verification email API endpoint with rate limiting (max 3 requests per hour)
  - ✅ ProfileTab UI with verification status banner and "Resend Verification Email" button
  - ✅ Email change endpoint with verification flow - sends verification to new email before changing
  - ✅ Email change verification callback handler (`/api/auth/verify-email-change`)
  - ✅ Cancel pending email change endpoint (`/api/user/cancel-email-change`)
  - ✅ Pending email change banner in ProfileTab with cancel option
  - ✅ Email verification success page (`/email-verified`) with auto-redirect
  - ✅ Verification guard utilities (server-side and client-side) for sensitive operations
  - ✅ Applied verification guards to data export endpoint
  - **Currently in "soft launch" mode** - emails sent but verification not enforced for login
  - Migration: `0038_add_pending_email.sql` - Added `pendingEmail` field to user table
- Session Timeout Enforcement (100% COMPLETE): Automatic logout after configurable inactivity period
  - ✅ UI in Privacy & Security settings with 7 timeout options (15min-8hrs, or Never)
  - ✅ Database schema with `lastActivityAt` and `rememberMe` fields on sessions
  - ✅ Middleware validation checking absolute expiration and inactivity timeout
  - ✅ Client-side activity tracking (mouse, keyboard, scroll, touch events)
  - ✅ Remember Me option on sign-in page to bypass inactivity timeout
  - ✅ Activity ping API endpoint with debounced updates (max 1/minute)
  - ✅ Automatic redirect with reason (`?reason=timeout` or `?reason=expired`)
  - ✅ All styling uses semantic theme variables
- Developer Mode Feature (100% COMPLETE): Full debugging utility with developer tools
  - ✅ Entity ID badges integrated into 8 pages (Transactions, Accounts, Bills, Categories, Merchants, Goals, Debts, Budgets)
  - ✅ Copy-to-clipboard functionality with toast notifications
  - ✅ DEV badge indicator in sidebar (visible in both expanded and collapsed states)
  - ✅ Developer Tools Panel - Fixed bottom-right panel with user/household info, route display, debug data export, cache clearing
  - ✅ All components use semantic theme variables for full theme integration
  - ✅ Zero overhead when developer mode is disabled (conditional rendering)
  - ✅ Fixed bug: Corrected `/api/goals` endpoint to `/api/savings-goals` in Advanced settings tab
- Household Data Isolation Phase 0 (85% COMPLETE): Settings architecture nearly complete
  - ✅ Phase 0.1: Database & Migration - Created `user_household_preferences` and `household_settings` tables with migrations (4 migration files, data migrated)
  - ✅ Phase 0.2: API Endpoints - 6 new endpoints for managing user-per-household preferences and household settings with proper authorization
  - ✅ Phase 0.3: UI Restructure - Redesigned settings page with 3-tier structure (User Settings / My Settings / Household Settings tabs)
  - ✅ Phase 0.4: Theme & Notifications (85% complete) - Core implementation complete, testing pending
    - ✅ Household Context Provider updated with preference loading and automatic theme switching
    - ✅ Theme Provider simplified to use household context
    - ✅ Theme Tab migrated to per-household API
    - ✅ Notifications Tab completely migrated to per-household API (all field names updated, deprecated fields removed)
    - ✅ Household switcher updated with async handling and loading states (shows "Switching..." with spinner)
    - ✅ Migration helper utility created (`lib/migrations/migrate-to-household-preferences.ts`) for automatic data migration
    - ⏳ Manual testing pending (~2-3 hours)
    - See `docs/phase-0.4-implementation-plan.md`, `docs/phase-0.4-remaining-tasks-plan.md` for detailed plans
  - ⏳ Phase 0.5: Testing & Polish (pending) - Comprehensive testing and bug fixes
  - See `docs/phase-0-implementation-progress.md` for detailed status
- Household Favorite Feature (100% COMPLETE): Star/favorite households to pin them to top of sidebar
- Household Settings Decoupling (100% COMPLETE): Sidebar dropdown and settings tabs operate independently
- Household Sort by Join Date (100% COMPLETE): Households ordered chronologically by when user joined them

**Previous (2025-11-14):**
- Reset App Data (100% COMPLETE): Fully functional settings reset feature in Data Management tab
  - Backend API endpoint (`/api/user/reset-app-data`) with password confirmation requirement
  - Rate limiting: Max 3 resets per 24 hours per user
  - Comprehensive UI with clear "what resets" vs "what stays safe" sections
  - Resets: User settings, notification preferences, saved searches, import templates, cached data
  - Preserves: All financial data (transactions, accounts, budgets, bills, goals, debts, tax records)
  - Automatic logout after reset with 3-second countdown
  - Client-side cache clearing (localStorage, sessionStorage, browser caches)
- Household Tab Switching Fix (100% COMPLETE): Fixed household context management in settings
  - Separated viewing household settings from switching active household
  - Active household only changes from sidebar, not from settings page tabs
  - Replaced nested Tabs component with custom button-based implementation
  - Fixed React hydration mismatch error caused by nested Radix UI Tabs components
- Avatar Upload (100% COMPLETE): Full profile picture upload system with display throughout app
  - **Integrated everywhere:** UserMenu (sidebar + mobile nav), Activity Feed, Household Members list
- Household Tab-Based UI (100% COMPLETE): Redesigned household settings from card-based selector to tab-based interface

**Previous (2025-11-13):**
- Notifications Tab (FULLY COMPLETE): Implemented granular notification channel selection system
  - Per-notification-type delivery channels (push/email) with extendable architecture for future channels (SMS, Slack, Webhook)
  - 9 notification types with independent channel preferences: Bill Reminders, Budget Warnings, Budget Exceeded, Budget Reviews, Low Balance, Savings Milestones, Debt Milestones, Weekly Summaries, Monthly Summaries
  - Auto-save with optimistic UI updates and validation (requires at least one channel per notification)
  - Database schema updated with JSON channel arrays stored per notification type
  - API validation for channel arrays with extensible `VALID_CHANNELS` list
  - Created migrations: `0028_add_budget_review_enabled.sql`, `0029_add_notification_channels.sql`
- Settings Page (ALL 3 PHASES COMPLETE): Created comprehensive `/dashboard/settings` page with 9 tabs
  - **Phase 1:** Profile (name, email, password), Preferences (currency, date, fiscal year), Financial (budget method, display options), Theme (moved from `/dashboard/theme`), Notifications (moved from `/dashboard/notifications`)
  - **Phase 2:** Privacy & Security (session management with device detection, JSON/CSV data export, account deletion), Household (create/join households, invite members, role management)
  - **Phase 3:** Data Management (retention policies, cache management), Advanced (developer mode, animations toggle, experimental features, app info, database statistics)
  - Created 7 new API routes for sessions, data export, and account deletion
  - Installed `ua-parser-js` for user agent parsing
  - All components use semantic theme variables for full theme integration

**Previous (2025-11-12):**
- Bug #12: Reports Charts Dimension Warnings - Changed ResponsiveContainer to explicit `height={320}` in all chart components
- Bug #11: Form Field ID/Name Attributes - Added id, name, aria-label to select dropdowns
- Bug #10: Reports Page Chart Dimension Warnings - Added explicit height to ChartContainer
- Bug #9: Budget Export Incorrect Values - Fixed transaction type query and calculations
- Bug #8: Goals Page Console Errors - Fixed database schema mismatch
- Bug #7: Budget Income Display Logic - Reversed status logic for income categories
- Bug #6: Dialog Accessibility - Added DialogDescription to all 7 dialogs
- Bugs #1-5: Savings Goals errors, Budget Summary auth, Bill Save performance, Budget Analytics chart

**Recent Features:**
- Session Timeout Enforcement: Configurable inactivity-based automatic logout (15min-8hrs or Never). Middleware validates sessions against database on every request, checks both absolute expiration and inactivity timeout. Client-side activity tracking with debounced server pings. Remember Me option on sign-in bypasses inactivity timeout. Migration added `lastActivityAt` and `rememberMe` fields to sessions table.
- Notifications Tab: Granular per-notification-type channel selection (push/email) with auto-save, validation, and extendable architecture for future channels (SMS, Slack, Webhook). 9 notification types with independent delivery preferences.
- Unified Settings Page: Comprehensive settings at `/dashboard/settings` with 3-tier structure (User Settings / My Settings / Household Settings). User Settings includes Profile, Privacy & Security, and Advanced. My Settings includes per-household Preferences, Financial, Theme, and Notifications. Household Settings includes shared Preferences, Financial, Data Management, and Members. Includes session management, data export (JSON/CSV), account deletion, household management, data retention policies, developer mode, and database statistics.
- Transaction Save Performance: 65-75% faster via parallel queries, batch updates, database indexes
- Income Frequency Tracking: Category-level frequency field (weekly/biweekly/monthly/variable)
- Goals Dashboard Widget: Inline stat card showing overall progress

## Important Notes

### Transaction Creation Flow
1. User selects account, type, amount, category, merchant
2. Auto-apply learned category from merchant history
3. Check categorization rules (priority order)
4. Check budget warnings (real-time impact)
5. Check for duplicates (Levenshtein matching)
6. Create transaction with Decimal.js for amounts
7. Update account balance
8. Apply tags and custom fields
9. Log to household activity feed

### Bill Payment Auto-Detection
1. Expense transaction created
2. Search active bills
3. Multi-factor matching (description, amount ±5%, date ±2 days)
4. If confidence ≥90% → auto-link and mark paid
5. Update bill instance status

### Budget Warning System
- Real-time calculation during transaction entry
- Color-coded indicators (0-80% blue, 80-100% amber, 100%+ red)
- Shows remaining budget and projected impact
- Creates notifications when thresholds crossed

### Cron Jobs
- Bill reminders (daily 9 AM UTC)
- Budget warnings (daily 9 AM UTC)
- Low balance alerts (daily 8 AM UTC)
- Budget reviews (monthly last day 8 PM UTC)
- Data cleanup (weekly)
- Usage decay (weekly)

See `docs/CRON_JOB_SETUP.md` for setup instructions.

### Never Do
- ❌ Never use floating-point arithmetic for money (use Decimal.js)
- ❌ Never commit without meaningful message
- ❌ Never skip user authentication checks in API routes
- ❌ Never start dev servers to leave running for user
- ❌ Never use hardcoded colors (use CSS variables)
- ❌ Never use emojis unless explicitly requested

### Always Do
- ✅ Always use pnpm (not npm or yarn)
- ✅ Always verify user owns data before returning
- ✅ Always use Decimal.js for financial calculations
- ✅ Always include toast notifications for user actions
- ✅ Always use semantic color tokens (CSS variables)
- ✅ Always commit meaningful changes

## Development Commands
```bash
pnpm dev                    # Start development server (localhost:3000)
pnpm build                  # Build for production
pnpm test                   # Run tests
pnpm test:watch             # Watch mode for tests
pnpm test:coverage          # Generate coverage report
pnpm drizzle-kit generate   # Generate database migration
pnpm drizzle-kit migrate    # Apply database migration
```

## Current Status
**All core features implemented and working!**
- ✅ Transaction management with splits, search, CSV import
- ✅ Bill tracking with auto-detection
- ✅ Budget tracking with real-time progress, templates
- ✅ Savings goals and debt management with milestones
- ✅ Rules-based auto-categorization (14 operators, 11 actions)
- ✅ Comprehensive notification system (10 types)
- ✅ Tax and sales tax tracking with quarterly reporting
- ✅ Financial reports (6 types, 7 chart types)
- ✅ Household collaboration with activity feed
- ✅ Offline mode with automatic sync
- ✅ PWA support for mobile app experience
- ✅ Unified Settings Page (3-tier structure with User Settings, My Settings, and Household Settings tabs)
- ✅ Avatar Upload (100% complete - upload, display, initials fallback throughout app)
- ✅ Reset App Data (100% complete - settings reset with password confirmation and rate limiting)
- ✅ Household Tab Switching Fix (100% complete - fixed context not updating, removed nested Tabs)
- ✅ Household Favorite Feature (100% complete - star/favorite households to pin to top)
- ✅ Developer Mode Feature (100% complete - entity ID badges, DEV indicator, developer tools panel)
- ✅ GeoIP Location Lookup (100% complete - session location display with country flags)
- ⏳ Import Preferences (28% complete - backend ready, UI pending)
- ⏳ Household Data Isolation Phase 0 (85% complete - core implementation done, testing pending)
- ✅ Testing complete (386 tests, 99.5% of plan, 100% unit coverage, 93% integration coverage)
- ✅ All 12 tracked bugs fixed (100%)

**⚠️ CRITICAL LIMITATION:**
- Multi-household data is NOT fully isolated yet - Phase 0 (settings architecture) is 85% complete
- Settings architecture foundation complete (new tables, APIs, UI restructure)
- Theme and notification systems now work per-household (users can have different themes/notifications per household)
- All financial data (transactions, accounts, budgets, etc.) still shared across households
- Security risk: Household data is not properly separated
- **In Progress:** Phase 0.4 testing (~2-3 hours)
- **Next:** Phase 0.5 (Testing & Polish), then Phases 1-4 (Data Isolation) - Add household_id filtering to all data tables

## Next Steps

### CRITICAL PRIORITY: Household Data Isolation
**Status:** Phase 0 - 85% Complete (4.5 of 5 phases done)
**Estimated Remaining Effort:** 1 day (Phase 0) + 5-9 days (Phases 1-4)

The multi-household feature is being implemented in phases. Phase 0 (settings architecture) core implementation is complete, testing pending. Financial data is still shared across households.

**Implementation Plans:**
- `docs/phase-0-implementation-progress.md` - Detailed progress tracking
- `docs/settings-three-tier-architecture.md` - Phase 0 architecture
- `docs/household-data-isolation-plan.md` - Phases 1-4 plan

**Phase 0: Settings Reorganization** (7 days - 85% COMPLETE)
- ✅ Phase 0.1: Database & Migration - Tables created, data migrated
- ✅ Phase 0.2: API Endpoints - 6 new endpoints with authorization
- ✅ Phase 0.3: UI Restructure - 3-tier settings page (User Settings / My Settings / Household Settings)
- ✅ Phase 0.4: Theme & Notifications (85% complete) - Core implementation done, testing pending (~2-3 hours)
- ⏳ Phase 0.5: Testing & Polish (1 day) - Comprehensive testing and bug fixes

**Phases 1-4: Data Isolation** (5-9 days - NOT STARTED)
- Add `household_id` to 20+ tables
- Migrate existing data to user's first household
- Update 90+ API endpoints to filter by household
- Update 50+ components to pass household context
- Add security checks to prevent cross-household access

### Other Next Steps
1. ✅ **Authentication Migration** - Complete
2. ✅ **Settings Page** - Complete
3. ✅ **Avatar Upload** - Complete
4. ✅ **Household Favorite Feature** - Complete
5. ✅ **Developer Mode Feature** - Complete
6. ⏳ **Household Data Isolation** - Phase 0: 85% complete, Phases 1-4: Not started
7. ⏳ Fix 2 date handling edge cases in transfer matching tests (optional)
8. Docker configuration for deployment
9. Performance optimizations as needed
10. User feedback and iterations
