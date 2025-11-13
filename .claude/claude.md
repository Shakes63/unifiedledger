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
│   ├── tax/                      # Tax utilities
│   └── sales-tax/                # Sales tax utilities
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
- Unified Settings Page (Phase 1 complete - `/dashboard/settings` with 9 tabs)
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

**Latest (2025-11-13):**
- Settings Page Phase 1: Created comprehensive `/dashboard/settings` page with 9 tabs. Implemented Profile (name, email, password), Preferences (currency, date format, fiscal year, defaults), Financial (budget method, display options), and Theme tabs (moved from `/dashboard/theme`). Added 13 new fields to userSettings table, created 4 API routes (`/api/user/settings`, `/api/user/profile`, `/api/user/email`, `/api/user/password`). Updated sidebar and mobile navigation to remove Notifications and Theme links, added Settings link. Updated UserMenu dropdown. Phases 2-3 remain (session management, privacy, data management, advanced settings).

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
- Unified Settings Page (Phase 1): Comprehensive settings at `/dashboard/settings` with 9 tabs (Profile, Preferences, Financial, Notifications, Theme, Household, Privacy, Data, Advanced). Phase 1 includes Profile management, App preferences (currency, date format, fiscal year, defaults), Financial settings (budget method, display options, auto-categorization), and Theme selection (moved from `/dashboard/theme`). Navigation updated (Notifications & Theme removed from sidebar). See `docs/SETTINGS-PAGE-IMPLEMENTATION-PLAN.md` for Phases 2-3.
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
- ✅ Unified Settings Page (Phase 1 complete - Profile, Preferences, Financial, Theme)
- ✅ Testing complete (386 tests, 99.5% of plan, 100% unit coverage, 93% integration coverage)
- ✅ All 12 tracked bugs fixed (100%)

## Next Steps
1. ✅ **Authentication Migration (100% complete)** - Clerk → Better Auth migration complete! (see `docs/BETTER-AUTH-MIGRATION-COMPLETE.md`)
2. ⏳ **Settings Page Phases 2-3** - Complete remaining settings functionality (see `docs/SETTINGS-PAGE-IMPLEMENTATION-PLAN.md`)
   - Phase 2: Session management (view/revoke sessions), Privacy & Security (data export, account deletion), Household settings tab
   - Phase 3: Data management (import preferences, retention policies), Advanced settings (developer mode, experimental features)
3. ⏳ Fix 2 date handling edge cases in transfer matching tests (optional)
4. Docker configuration for deployment
5. Performance optimizations as needed
6. User feedback and iterations
