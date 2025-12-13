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
├── proxy.ts                      # Route protection (renamed from middleware.ts per Next.js 16)
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
│   ├── bills/                    # Bill matching, autopay
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
- **Push-based workflow** (no migration files)

**Schema Change Workflow:**
```bash
# 1. Edit lib/db/schema.ts
# 2. Push changes directly to database
pnpm drizzle-kit push
```

**Important:**
- We use `push` instead of `generate`/`migrate` for simplicity
- `push` syncs schema directly to database without migration files
- May require interactive input for table renames - run in terminal manually if needed
- Always backup database before major schema changes

### Route Protection (Proxy)
- **File:** `proxy.ts` in project root (NOT `middleware.ts`)
- **Convention:** Next.js 16 deprecated "middleware" in favor of "proxy"
- **Function:** Export `proxy(request)` not `middleware(request)`
- **Runtime:** Always Node.js (no `export const runtime` needed)
- **Purpose:** Session validation, authentication checks, activity tracking, test mode bypass

## Key Features Summary

**All 8 phases complete (100%):**
1. ✅ **Foundation:** Transaction entry (income/expense/transfer), multi-account, categories, merchants, templates, household management
2. ✅ **Intelligence:** Usage tracking, smart categorization, rules system (14 operators, 11 action types), transaction history, splits, advanced search, duplicate detection, CSV import
3. ✅ **Accounts & Calendar:** Transfers with usage-based suggestions, calendar view (month/week), account filtering
4. ✅ **Bills & Budgets:** Auto-detection, payment matching, budget tracking with adherence scoring, templates, variable bill tracking, tags, custom fields, notifications (10 types)
5. ✅ **Goals & Activity:** Savings goals with milestones, debt management with payoff projections, household activity audit trail
6. ✅ **Mobile & Performance:** Offline mode (IndexedDB queue), household system with roles, responsive navigation, service worker caching, performance monitoring, data cleanup cron jobs
7. ✅ **Reporting & Tax:** 6 report types with 7 chart types, tax dashboard, sales tax quarterly reporting (all 50 states), credit utilization tracking, collapsible debt cards
8. ✅ **Testing:** 590 tests (100% passing)

## Important Architecture Decisions

### Transaction Types
- `income` - Money coming in
- `expense` - Money going out
- `transfer_out` - Money leaving source account
- `transfer_in` - Money arriving at destination account

**Transfer Model:** Creates TWO linked transactions via `transferId`. Transactions page combines transfers into single transaction when no filter or both accounts filtered (shows `transfer_out` only). When filtered by single account, shows individual transactions with appropriate colors: red (-) for source account, green (+) for destination account.

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
- **quarterly:** Repeats every 3 months (creates 4 instances)
- **semi-annual:** Repeats every 6 months (creates 4 instances)
- **annual:** Repeats once per year (creates 2 instances)

**Due Date Field Semantics:**
- one-time: Uses `specificDueDate` field (ISO date string)
- weekly/biweekly: `dueDate` is day of week (0=Sunday, 6=Saturday)
- monthly+: `dueDate` is day of month (1-31)

**Auto-Deactivation:**
- One-time bills automatically become inactive after their instance is marked as paid
- Other frequencies remain active and continue generating future instances

### Bill Matching
**Three-Tier Matching System:**
1. Direct bill instance ID matching for explicit bill payments (bypasses all matching logic)
2. Bill-matcher utility for description/amount/date matching (40% similarity, 30% amount, 20% date, 10% payee patterns, 70% confidence threshold)
3. Category-only matching as fallback

**Matching Logic:** Bills match transactions with matching category, regardless of merchantId (null or set). Bills without merchants match correctly using description/amount/date matching.

**Direct Bill Payments:** When `billInstanceId` is provided, directly links to that bill instance regardless of category/date/description/merchant

**Auto-Matching:** Happens automatically when expense transactions are created. Uses bill-matcher first, falls back to category-only matching if no match found.

**Legacy Multi-Factor Matching:** Available via `/api/bills/match` endpoint using Levenshtein distance (string similarity 40%, amount tolerance ±5% 30%, date pattern 20%, payee pattern 10%, requires ≥90% confidence)

### Business Account Features
- **Two Independent Toggles:** Each account has `enableSalesTax` and `enableTaxDeductions` toggles
- **Sales Tax Tracking:** When enabled, income transactions can be marked as sales taxable
- **Tax Deduction Tracking:** When enabled, expenses auto-detect as business deductions
- **Navigation Visibility:** Tax Dashboard shows when any account has tax deduction tracking; Sales Tax page shows when any account has sales tax tracking
- **Backward Compatibility:** `isBusinessAccount` field computed from either toggle being enabled
- **Auto-Detection:** Transaction `taxDeductionType` uses `enableTaxDeductions` flag (falls back to `isBusinessAccount`)

### Permission System
- Role-based permissions: owner, admin, member, viewer
- 13 permissions across 4 roles (invite_members, remove_members, manage_permissions, create_accounts, edit_accounts, delete_accounts, create_transactions, edit_all_transactions, view_all_data, manage_budget, delete_household, leave_household)
- Custom permission overrides: Admins/owners can set custom permission overrides per member (beyond role defaults)
- Permission resolution: Custom permissions override role defaults, deny takes precedence over allow
- Owners always have all permissions and cannot have custom permissions modified
- Last admin protection: Cannot remove manage_permissions from last admin
- See `lib/household/permissions.ts` for permission logic

### Autopay System
**Daily Cron Job:** Runs at 6:00 AM UTC (before bill reminders at 9:00 AM)

**Bill Processing Logic:**
1. Find all bills with `isAutopayEnabled=true` and `autopayAccountId` set
2. Filter pending instances where (dueDate - autopayDaysBefore) = today
3. Calculate payment amount based on `autopayAmountType`:
   - `fixed`: Use `autopayFixedAmount`
   - `minimum_payment`: Use linked credit account's `minimumPaymentAmount`
   - `statement_balance`: Use linked credit account's `statementBalance`
   - `full_balance`: Use absolute value of credit account's `currentBalance`
4. Create transaction:
   - **Credit card payments:** Create transfer from autopayAccount to linkedAccountId
   - **Regular bills:** Create expense from autopayAccount
5. Call `processBillPayment()` to update instance and create payment record
6. Send notification (success or failure)

**Files:**
- `lib/bills/autopay-calculator.ts` - Amount calculation utility
- `lib/bills/autopay-transaction.ts` - Transaction creator
- `lib/bills/autopay-processor.ts` - Batch processor
- `app/api/cron/autopay/route.ts` - Cron endpoint
- `lib/notifications/autopay-notifications.ts` - Notification handlers

**Bill Reminders:** Autopay-enabled bills are skipped by bill reminder system

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

**Authentication:**
- All API routes must verify user authentication
- Use Better Auth session validation
- Always verify user owns data before returning
- Include `credentials: "include"` in fetch calls for cookie support

**Household Context:**
- Core financial data (transactions, accounts, categories, merchants, bills, budgets, goals, debts) is household-isolated
- Use `lib/api/household-auth.ts` helpers for household validation
- Frontend should use `lib/hooks/use-household-fetch.ts` for household-aware HTTP methods
- Always filter by `household_id` when querying household-scoped data

**Enhanced Fetch Utility:**
- Use `lib/utils/enhanced-fetch.ts` for all fetch calls (replaces standard fetch)
- Features: Exponential backoff retry (3 attempts: 1s, 2s, 4s), timeout handling (10s default), request deduplication, detailed error categorization
- Error types: network, timeout, server, client, abort

## Database Schema Highlights

**Core:** users, households, householdMembers, accounts, budgetCategories, transactions, transactionSplits, merchants
**Settings:** userSettings, userSessions, user_household_preferences, household_settings
**Bills:** bills (household-scoped), billInstances (household-scoped)
**Rules:** categorizationRules, ruleExecutionLog
**Tags:** tags, transactionTags, customFields, customFieldValues
**Goals:** savingsGoals, savingsMilestones
**Debts:** debts, debtPayments, debtPayoffMilestones
**Tax:** taxCategories, categoryTaxMappings, transactionTaxClassifications, salesTaxSettings, salesTaxCategories, salesTaxTransactions, quarterlyFilingRecords
**Notifications:** notifications, notificationPreferences, householdActivityLog
**Search:** savedSearchFilters, searchHistory, importTemplates, importHistory, importStaging

**Household Data Isolation:**
- **Phase 1 Complete:** `accounts`, `transactions`, `budgetCategories`, `merchants`, `transactionSplits`, `usageAnalytics` all have `household_id`
- **Phase 2 Complete:** `bills`, `billInstances` have `household_id`
- **Phase 3 Complete:** Goals & Debts API isolation
- **Phase 4 Complete:** Business logic isolation (categorization rules, rule execution logs)
- All queries must filter by `household_id` for household-scoped tables
- Use `lib/api/household-auth.ts` helpers for validation

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
- Autopay processing (daily 6 AM UTC)
- Bill reminders (daily 9 AM UTC)
- Budget warnings (daily 9 AM UTC)
- Low balance alerts (daily 8 AM UTC)
- Budget reviews (monthly last day 8 PM UTC)
- Data cleanup (weekly)
- Usage decay (weekly)

See `docs/CRON_JOB_SETUP.md` for setup instructions.

### Never Do
- Never use floating-point arithmetic for money (use Decimal.js)
- Never commit without meaningful message
- Never skip user authentication checks in API routes
- Never start dev servers to leave running for user
- Never use hardcoded colors (use CSS variables)
- Never use emojis unless explicitly requested
- Never create `middleware.ts` (use `proxy.ts` per Next.js 16 convention)
- Never use `drizzle-kit generate` or `drizzle-kit migrate` (use `push` workflow)

### Always Do
- Always use pnpm (not npm or yarn)
- Always verify user owns data before returning
- Always use Decimal.js for financial calculations
- Always include toast notifications for user actions
- Always use semantic color tokens (CSS variables)
- Always commit meaningful changes
- Always use `drizzle-kit push` for schema changes

## Bug Tracking Guidelines

**File:** `docs/bugs.md`

**Adding New Bugs:**
- Add to the "New Bugs" section at the top of `bugs.md`
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
2. Format: `N. **Bug Name** [FIXED YYYY-MM-DD] - 1-2 line description of the fix`
3. Update metrics table (decrement Active Bugs, increment Fixed count)
4. Delete the associated plan file from `docs/`
5. Commit and push changes

## Development Commands
```bash
pnpm dev                    # Start development server (localhost:3000)
pnpm build                  # Build for production
pnpm test                   # Run tests
pnpm test:watch             # Watch mode for tests
pnpm test:coverage          # Generate coverage report
pnpm drizzle-kit push       # Sync schema changes to database
pnpm drizzle-kit studio     # Open Drizzle Studio (database GUI)
```

## Current Status
**All core features implemented and working!**
- ✅ Transaction management with splits, search, CSV import
- ✅ Bill tracking with auto-detection and autopay
- ✅ Budget tracking with real-time progress, templates, debt integration
- ✅ Savings goals and debt management with milestones and payoff strategies
- ✅ Rules-based auto-categorization (14 operators, 11 actions)
- ✅ Comprehensive notification system (10 types)
- ✅ Tax and sales tax tracking with quarterly reporting
- ✅ Financial reports (6 types, 7 chart types) with advanced filtering
- ✅ Household collaboration with activity feed
- ✅ Offline mode with automatic sync
- ✅ PWA support for mobile app experience
- ✅ Unified Settings Page (2-tier structure: Account/Households)
- ✅ Testing: 590/590 passing (100%)
- ✅ Enhanced Error Handling & Network Infrastructure (100% COMPLETE)
- ✅ Household Data Isolation (100% COMPLETE - All phases 0-4)
- ✅ All bugs fixed (85 total)

## Household Data Isolation Status

**✅ Phase 0 - COMPLETE:** Three-tier settings architecture fully implemented and tested
**✅ Phase 1 - COMPLETE:** Core financial data isolation (transactions, accounts, categories, merchants) - PRODUCTION READY
**✅ Phase 2 - COMPLETE:** Bills & Budgets API isolation - All 23 endpoints isolated, 13 frontend components updated
**✅ Phase 3 - COMPLETE:** Goals & Debts API isolation - All 19 endpoints isolated, 20 frontend components updated
**✅ Phase 4 - COMPLETE:** Business logic isolation - Rules engine, 6 API endpoints isolated, 4 frontend components updated

**What works:** Users can switch between households and see fully isolated transactions, accounts, categories, merchants, bills, budgets, goals, debts, and categorization rules. Rules engine filters by household. All API endpoints are updated for household isolation.

## Recent Major Features

**Latest (2025-12-04):**
- **Unified Debt, Bill & Credit Card Architecture** (ALL 19 PHASES COMPLETE)
  - Major refactor unifying credit cards, lines of credit, and debt bills into a single financial obligation tracking system
  - Key features: Enhanced schemas, account/bill forms, autopay system, budget integration with debt strategy toggle, payoff strategies (snowball/avalanche), calendar integration, notifications (utilization warnings, milestones), tax integration (interest deductions), CSV import improvements, dashboard widgets, balance history/trends, category simplification (3 types), recurring income tracking, budget rollover, savings goals integration, bill classification & subscription management

**Previous:**
- Sales Tax Exemption for Transactions - Mark income transactions as tax exempt
- Category-to-Tax-Category Mapping UI - Link budget categories to IRS tax categories
- Business Features Visibility - Tax pages hidden unless business account exists
- Debt Budget Integration - Debts appear in budgeting with auto-populated payments
- 12-Month Annual Bill Planning Grid - Year-at-a-glance view for non-monthly bills
- Budget Summary Dashboard - High-level overview with donut chart and trends
- Reports Advanced Filtering & Custom Date Range
- Admin User Management
- Onboarding Flow (9-step wizard)
- Two-Factor Authentication (2FA)
- Advanced Permission System
- OAuth Provider Management (Google, GitHub)
- Auto-Backup Settings

For detailed bug tracking, see `docs/bugs.md`.
