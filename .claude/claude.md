# Unified Ledger - Finance App Project

## Project Overview
A comprehensive mobile-first personal finance application built with Next.js, featuring transaction tracking, bill management, budgeting, and household financial collaboration.

## Tech Stack
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5.9
- **Styling:** Tailwind CSS v4 + shadcn/ui (17 components)
- **Database:** SQLite with Drizzle ORM
- **Authentication:** Clerk
- **Package Manager:** pnpm
- **PWA:** next-pwa for mobile app experience

## Critical Dependencies
- `decimal.js@10.6.0` - Precise financial calculations (ALWAYS use for money)
- `fastest-levenshtein@1.0.16` - String similarity for duplicate detection
- `papaparse@5.5.3` - CSV parsing
- `recharts@3.3.0` - Charts
- `sonner@2.0.7` - Toast notifications

## Project Structure
```
unifiedledger/
├── app/
│   ├── api/                      # API routes
│   │   ├── transactions/         # Full CRUD + splits + search
│   │   ├── accounts/             # Account management
│   │   ├── categories/           # Category management
│   │   ├── merchants/            # Merchant management
│   │   ├── bills/                # Bills + auto-detection
│   │   ├── rules/                # Auto-categorization rules
│   │   ├── tags/                 # Tag system
│   │   ├── custom-fields/        # Custom field system
│   │   ├── notifications/        # Notification system
│   │   ├── savings-goals/        # Goals tracking
│   │   ├── debts/                # Debt management
│   │   ├── reports/              # Financial reports
│   │   ├── tax/                  # Tax tracking
│   │   └── sales-tax/            # Sales tax reporting
│   └── dashboard/
│       ├── page.tsx              # Main dashboard
│       ├── transactions/         # Transaction management
│       ├── accounts/             # Account list
│       ├── bills/                # Bill tracking
│       ├── calendar/             # Calendar view
│       ├── goals/                # Savings goals
│       ├── debts/                # Debt tracking
│       ├── reports/              # Reports dashboard
│       ├── tax/                  # Tax dashboard
│       ├── sales-tax/            # Sales tax dashboard
│       └── [others]/             # Categories, merchants, rules, etc.
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── transactions/             # Transaction components
│   ├── accounts/                 # Account components
│   ├── bills/                    # Bill components
│   ├── rules/                    # Rules builder
│   ├── charts/                   # Chart components
│   ├── navigation/               # Sidebar + mobile nav
│   └── [others]/                 # Goals, debts, tags, etc.
├── lib/
│   ├── db/
│   │   ├── schema.ts            # Complete database schema
│   │   └── index.ts             # Database client
│   ├── rules/                   # Rules engine
│   ├── bills/                   # Bill matching
│   ├── notifications/           # Notification service
│   ├── tax/                     # Tax utilities
│   └── sales-tax/               # Sales tax utilities
└── docs/                        # Documentation
```

## Development Guidelines

### Always Use pnpm
```bash
pnpm install       # Install dependencies
pnpm dev           # Start dev server
pnpm build         # Build for production
```

### Financial Calculations
**CRITICAL:** Always use `decimal.js` for money calculations to avoid floating-point errors.
```typescript
import Decimal from 'decimal.js';
const total = new Decimal(100.50).plus(new Decimal(25.25)); // ✓ Correct
const wrong = 100.50 + 25.25; // ✗ Never use this
```

### Design System (Dark Mode First)
**Colors:**
- Background: `#0a0a0a` (near-black)
- Surface: `#1a1a1a` (cards)
- Elevated: `#242424` (hover states)
- Border: `#2a2a2a` (dividers)
- Income: `#10b981` (emerald)
- Expense: `#f87171` (red)
- Transfer: `#60a5fa` (blue)

**Typography:** Inter (primary), JetBrains Mono (amounts)
**Border Radius:** 12px (xl), 8px (lg), 6px (md)

### Database
- Drizzle ORM for type-safe queries
- SQLite for local storage
- Schema: `lib/db/schema.ts`
- Migrations: `drizzle-kit`

## Key Features Implemented

### Phase 1: Foundation ✅
- Transaction entry (income, expense, transfer)
- Multi-account support with balance tracking
- Smart category system with auto-suggestions
- Merchant autocomplete
- Transaction templates
- Household management
- User auto-initialization
- Dark mode design system

### Phase 2: Intelligence & Speed ✅
- **Usage Tracking:** Accounts, categories, merchants sorted by usage
- **Smart Categorization:** Auto-apply categories based on merchant history
- **Rules System:** 14 operators, 8 fields, recursive AND/OR groups, priority-based matching
- **Transaction History:** Repeat/clone functionality, save as templates
- **Split Transactions:** Visual editor, amount/percentage support, full CRUD
- **Advanced Search:** 11 filter types, saved searches, pagination
- **Duplicate Detection:** Levenshtein distance matching with risk levels
- **CSV Import:** Auto-detection, column mapping, duplicate checking

### Phase 3: Accounts & Calendar ✅
- **Transfers:** Multi-account transfers with usage-based suggestions
- **Calendar View:** Month/week layouts with transaction/bill indicators
- **Account Filtering:** Click account → view all transactions

### Phase 4: Bills, Budgets & Notifications ✅
- **Bills:** Auto-detection, payment matching (Levenshtein), 3-month instance generation
- **Tags:** Color-coded tags with usage tracking
- **Custom Fields:** 8 field types (text, number, date, select, etc.)
- **Notifications:** 10 types (bill reminders, budget warnings, low balance, etc.)
- **Budget Warnings:** Real-time impact during transaction entry
- **Spending Summaries:** Weekly/monthly views

### Phase 5: Goals & Activity ✅
- **Savings Goals:** Progress tracking, milestone detection (25%, 50%, 75%, 100%)
- **Debt Management:** Payment tracking, payoff projections, interest tracking
- **Household Activity:** Comprehensive audit trail (20+ activity types)

### Phase 6: Mobile & Performance ✅
- **Offline Mode:** IndexedDB queue, automatic sync when online
- **Household System:** Role-based permissions, invitations
- **Responsive Navigation:** Collapsible sidebar + mobile hamburger
- **Service Worker:** Advanced caching (5-10x performance improvement)
- **Performance Monitoring:** Core Web Vitals tracking
- **Data Cleanup:** Automated maintenance cron jobs
- **Usage Decay:** Time-weighted scoring algorithm

### Phase 7: Reporting & Tax ✅
- **Charts Library:** 7 reusable chart types (Line, Bar, Pie, Area, etc.)
- **Reports:** 6 endpoints (income vs expenses, category breakdown, cash flow, net worth, budget vs actual, merchant analysis)
- **Tax Dashboard:** Deduction tracking, quarterly payment estimates, form type organization
- **Sales Tax:** Quarterly reporting, all 50 states, filing deadlines

### Phase 8: Testing 🟢 (In Progress)
- Test infrastructure complete
- Split calculator tests: 80+ test cases, 100% coverage
- Target: 80%+ overall coverage

## Important Architecture Decisions

### Transaction Types
- `income` - Money coming in
- `expense` - Money going out
- `transfer_out` - Money leaving source account in a transfer
- `transfer_in` - Money arriving at destination account in a transfer

**Transfer Model:** Transfers create TWO linked transactions:
- Main view shows only `transfer_out` to avoid duplicates
- Account-filtered view shows relevant transaction for that account
- Both transactions linked via `transferId` field
- Deletion of either side removes both transactions

### Rules System
- Priority-based matching (lower number = higher priority)
- First matching rule applies
- Only applies to transactions without manual category
- 14 operators: equals, not_equals, contains, not_contains, starts_with, ends_with, greater_than, less_than, between, regex, in_list, matches_day, matches_weekday, matches_month
- 8 fields: description, amount, account_name, date, day_of_month, weekday, month, notes

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

### Standard Response Format
```typescript
// List endpoints
{ data: [...], total: number, limit: number, offset: number }

// Create endpoints
{ id: string, ...createdItem }

// Error responses
{ error: string }
```

### Common Parameters
- `limit` - Pagination limit (default: 50)
- `offset` - Pagination offset (default: 0)
- `sortBy` - Sort field
- `sortOrder` - asc | desc

## Database Schema Highlights

### Core Tables
- `users` - User profiles
- `households` - Household/family units
- `householdMembers` - Membership with roles
- `accounts` - Financial accounts
- `budgetCategories` - Income/expense categories
- `transactions` - All financial transactions
- `transactionSplits` - Split transaction allocations
- `merchants` - Merchant/vendor tracking

### Bills & Payments
- `bills` - Recurring bill definitions
- `billInstances` - Monthly bill occurrences

### Rules & Intelligence
- `categorizationRules` - Auto-categorization rules
- `ruleExecutionLog` - Audit trail

### Tags & Custom Fields
- `tags` - User-defined tags
- `transactionTags` - Tag associations
- `customFields` - Field definitions
- `customFieldValues` - Field values

### Goals & Debts
- `savingsGoals` + `savingsMilestones`
- `debts` + `debtPayments` + `debtPayoffMilestones`

### Tax
- `taxCategories` + `categoryTaxMappings` + `transactionTaxClassifications`
- `salesTaxSettings` + `salesTaxCategories` + `salesTaxTransactions` + `quarterlyFilingRecords`

### Notifications & Activity
- `notifications` + `notificationPreferences`
- `householdActivityLog`

### Search & Import
- `savedSearchFilters` + `searchHistory`
- `importTemplates` + `importHistory` + `importStaging`

## Common Tasks

### Adding a New Feature
1. Create API route(s) in `app/api/`
2. Update database schema in `lib/db/schema.ts` if needed
3. Create migration with `drizzle-kit generate`
4. Create component(s) in `components/`
5. Create/update page(s) in `app/dashboard/`
6. Apply design system styling
7. Test and commit

### Database Migrations
```bash
pnpm drizzle-kit generate  # Generate migration
pnpm drizzle-kit migrate   # Apply migration
```

### Styling Components
- Use design system hex colors
- Follow 12px radius rule
- Always include hover states
- Mobile-first responsive design

## Recent Updates (Current Session)

### Latest Session - CSV Import Preview & Amount Fix ✅

1. **Bug #60: Fixed CSV Import Preview Button Not Responding** - Major multi-part fix
   - **Root Cause 1:** UI navigation issues when preview failed to load
   - **Root Cause 2:** Node.js `Buffer` API used in browser client code causing errors
   - **Root Cause 3:** Browser `FileReader` API used in Node.js server code causing crashes
   - **Root Cause 4:** Validation didn't accept withdrawal/deposit as alternative to amount field
   - **Solution Part 1:** Added console logging and Back button to preview for better UX
   - **Solution Part 2:** Replaced `Buffer.from()` with native browser `btoa()` for base64 encoding
   - **Solution Part 3:** Replaced `FileReader` with direct PapaParse parsing on server side
   - **Solution Part 4:** Updated validation to accept withdrawal/deposit OR amount field
   - **Solution Part 5:** Smart error handling - only fails if errors AND no data parsed
   - Files: `csv-import-modal.tsx`, `import-preview.tsx`, `app/api/csv-import/route.ts`
   - CSV import preview now works end-to-end with comprehensive error handling

2. **Bug #61: Fixed CSV Import Showing $0 Amounts for All Transactions**
   - Root cause: Dual-column CSVs have both withdrawal AND deposit columns per row
   - Example: `Withdrawal="82.21", Deposit="0.00"` for expense transactions
   - Second column with "0.00" was overwriting the first column's valid amount
   - Solution: Added Decimal.js `.isZero()` check - only set amount if value is non-zero
   - Now correctly shows $82.21 for withdrawals, $98.25 for deposits
   - No more $0.00 transactions from dual-column CSV bank exports
   - Files: `lib/csv-import.ts` (lines 289-321)

3. **Bug #62: Fixed CSV Import Button Doing Nothing (400 Bad Request)**
   - Root cause: Data format mismatch between frontend and backend
   - Frontend sent row numbers as strings: `['1', '2', '3', ...]`
   - Backend was checking against staging record IDs (nanoid): `'BfUcRieZARAQKTD95NKL-'`
   - Filter never found matches, returned "No records to import" error
   - Solution: Updated backend to filter by row numbers instead of staging IDs
   - Convert strings to integers and use Set for fast O(1) lookup
   - Files: `app/api/csv-import/[importId]/confirm/route.ts` (lines 60-72)
   - Import button now successfully imports all selected transactions into database

4. **Bug #63: Added Auto-Refresh After CSV Import Success**
   - Enhancement: Transactions page should automatically refresh after import
   - Added optional `onSuccess` callback prop to CSVImportModal component
   - Triggers automatic refresh when user closes the import success modal
   - Fetches latest transactions from API and updates component state
   - Shows "Transactions refreshed" toast notification for user feedback
   - Files: `csv-import-modal.tsx` (lines 34, 41, 241-244), `transactions/page.tsx` (lines 511-524)
   - User immediately sees newly imported transactions without manual page refresh

### Previous Session - Transfer Model & Split UI ✅

1. **Bug #51: Implemented 2-Transaction Transfer Model** - Complete architectural refactor
   - Transfers now create TWO transactions (transfer_out + transfer_in)
   - Database migration converts existing transfers to paired model
   - Main view shows only transfer_out to avoid duplicates
   - Account-filtered view shows relevant transaction side
   - DELETE endpoint removes both sides of transfer
   - Both account balances properly updated
   - Created migration: `0006_convert_transfers_to_paired_model.sql`

2. **Bug #52: Fixed CSV Import Select.Item Error** - Empty value validation
   - TRANSFORMS array had empty string value for "None" option
   - Select component doesn't allow empty string values
   - Changed to `'none'` value with proper handling
   - Updated type definitions and transform logic
   - CSV import now works without errors

3. **Bug #53: Enhanced Split Transaction UI** - Major UX improvements
   - Removed complex "Add Split" form at top
   - Replaced with simple "Add Split" button below splits
   - Each split auto-prepopulated with main category and description
   - Added CategorySelector to each split card
   - Amount auto-calculated as remaining balance
   - One-click to add new split with smart defaults

### Files Modified
- `drizzle/0006_convert_transfers_to_paired_model.sql` - Migration for 2-transaction model
- `app/api/transactions/route.ts` - POST creates 2 transactions, GET filters transfer_in
- `app/api/transactions/[id]/route.ts` - DELETE handles both transfer sides
- `app/dashboard/transactions/page.tsx` - Updated transfer display logic
- `components/dashboard/recent-transactions.tsx` - Updated transfer display
- `components/csv-import/column-mapper.tsx` - Fixed empty string value
- `lib/csv-import.ts` - Added 'none' transform type
- `components/transactions/split-builder.tsx` - Complete UI reorganization
- `components/transactions/transaction-form.tsx` - Pass category/description to splits

## Important Notes

### Transaction Creation Flow
1. User selects account, type, amount, category, merchant
2. If merchant selected with learned category → auto-apply
3. Check categorization rules (priority order)
4. Check budget warnings (show real-time impact)
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
Setup cron jobs for:
- Bill reminders (daily at 9 AM UTC)
- Budget warnings (daily at 9 AM UTC)
- Low balance alerts (daily at 8 AM UTC)
- Data cleanup (weekly)
- Usage decay (weekly)

See `docs/CRON_JOB_SETUP.md` for detailed instructions.

### Never Do
- ❌ Never use floating-point arithmetic for money (use Decimal.js)
- ❌ Never commit without meaningful message
- ❌ Never skip user authentication checks in API routes
- ❌ Never start dev servers to leave running for user
- ❌ Never use light mode (dark mode only)
- ❌ Never use emojis unless explicitly requested

### Always Do
- ✅ Always use pnpm (not npm or yarn)
- ✅ Always verify user owns data before returning
- ✅ Always use Decimal.js for financial calculations
- ✅ Always include toast notifications for user actions
- ✅ Always apply dark mode design system colors
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
- ✅ Transaction management with splits, search, and CSV import
- ✅ Bill tracking with auto-detection and payment matching
- ✅ Savings goals and debt management with milestone tracking
- ✅ Rules-based auto-categorization with 14 operators
- ✅ Comprehensive notification system with 10 types
- ✅ Tax and sales tax tracking with quarterly reporting
- ✅ Financial reports with 6 chart types
- ✅ Household collaboration with activity feed
- ✅ Offline mode with automatic sync
- ✅ PWA support for mobile app experience
- 🟢 Testing infrastructure complete (in progress)

## Next Steps
1. Complete testing coverage (target 80%+)
2. Docker configuration for deployment
3. Performance optimizations as needed
4. User feedback and iterations
