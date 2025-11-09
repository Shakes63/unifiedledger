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

### Latest Session - Minimum Payment Warning & Debt-Free Countdown ✅

1. **Implemented Minimum Payment Warning System**
   - Created dramatic comparison showing cost of paying only minimums
   - API endpoint: `/api/debts/minimum-warning`
   - Side-by-side comparison: minimum-only vs current plan
   - Shows time saved, interest saved with real multipliers (e.g., "pay 3x more in interest")
   - Red/amber warning colors for visual impact
   - Encouragement message when user has no extra payment set
   - Fully integrated into debts page as collapsible section
   - Files: `app/api/debts/minimum-warning/route.ts`, `components/debts/minimum-payment-warning.tsx`

2. **Implemented Debt-Free Countdown Widget**
   - Created motivational countdown showing months until debt-free
   - API endpoint: `/api/debts/countdown`
   - Reusable ProgressRing component with animated SVG circular progress
   - Auto-selects gradient colors based on progress (red→orange→blue→green→gold)
   - Milestone tracking (25%, 50%, 75%, 100%) with emoji indicators (🏅🥈🥇🎉)
   - Dynamic motivational messages based on progress
   - Uses actual payment history for accurate progress tracking
   - Two versions created:
     - **Full widget**: On debts page with large ring, all details, milestone progress
     - **Compact card**: On dashboard with horizontal layout, essential info only
   - Files: `app/api/debts/countdown/route.ts`, `components/ui/progress-ring.tsx`, `components/dashboard/debt-free-countdown.tsx`, `components/dashboard/debt-countdown-card.tsx`

3. **Dashboard Quick Overview Enhancement**
   - Replaced "Coming soon" empty card with compact debt countdown
   - Three cards now show:
     - Monthly Spending (with category filter)
     - Accounts (with total balance and clickable account list)
     - Debt Countdown (compact version with progress ring)
   - All cards match height and styling
   - Files: `app/dashboard/page.tsx`

4. **Debts Page Organization**
   - Added full debt-free countdown widget at top
   - Order: Countdown → Stats → Minimum Warning → What-If → Strategy → Debts list
   - Files: `app/dashboard/debts/page.tsx`

### Key Features Delivered:
- **Motivational design**: Progress rings, dynamic messages, milestone celebrations
- **Accurate calculations**: Uses existing payoff calculator with proper interest calculations
- **Smart progress tracking**: Uses max of time-based or amount-based progress
- **Responsive layouts**: Full version for debts page, compact for dashboard
- **Visual impact**: Gradient colors, animations, emoji indicators
- **Edge case handling**: No debts (celebration), no extra payment (encouragement), errors (graceful)

### Previous Session - What-If Scenario Calculator for Debt Payoff ✅

1. **Implemented What-If Scenario Calculator**
   - Created comprehensive scenario comparison system for debt payoff strategies
   - Users can test different payment approaches side-by-side (up to 4 scenarios)
   - Enhanced payoff calculator to support lump sum payments at specific months
   - Real-time calculation with 500ms debounce for smooth UX
   - Files: `lib/debts/payoff-calculator.ts`, `app/api/debts/scenarios/route.ts`

2. **Created Scenario Management Components**
   - **ScenarioBuilder**: Configure individual scenarios with:
     - Custom name and extra monthly payment amount
     - Add/remove multiple lump sum payments (amount + month)
     - Choose payment method (snowball vs avalanche)
     - Visual validation and feedback
   - **ScenarioComparisonCard**: Display results showing:
     - Total months to debt-free, debt-free date, total interest paid
     - Savings vs baseline (time + money) with color-coded indicators
     - Trophy badges for best scenarios (fastest, saves most $, most balanced)
     - Expandable payoff order details
   - **WhatIfCalculator**: Main container with:
     - Quick scenario templates (+$50/mo, +$100/mo, Tax Refund, Bonus, etc.)
     - Add/remove custom scenarios
     - Reset functionality
     - Recommendation summary
   - Files: `components/debts/scenario-builder.tsx`, `components/debts/scenario-comparison-card.tsx`, `components/debts/what-if-calculator.tsx`

3. **Enhanced Payoff Calculator Backend**
   - Added `LumpSumPayment` interface for one-time payments
   - Added `PayoffScenario` interface for scenario configuration
   - Updated `calculateDebtSchedule()` to apply lump sums at specified months
   - Created `calculateScenarioComparison()` to process multiple scenarios
   - Calculates best scenario for time, money, and balanced approach
   - Accurate interest calculations with proper compounding
   - Files: `lib/debts/payoff-calculator.ts`

4. **Created Scenarios API Endpoint**
   - POST `/api/debts/scenarios` accepts multiple scenarios
   - Comprehensive validation for all inputs (scenarios, lump sums, methods)
   - Returns comparison results with recommendations
   - Integrates with existing debt data and settings
   - Files: `app/api/debts/scenarios/route.ts`

5. **Integrated into Debts Page**
   - Added collapsible "What-If Scenario Calculator" section
   - Loads user's current debt settings automatically
   - Positioned above existing Payoff Strategy section
   - Only shows when user has active debts and settings loaded
   - Files: `app/dashboard/debts/page.tsx`

6. **Quick Scenario Templates**
   - "+$50/month", "+$100/month", "+$200/month" extra payments
   - "Tax Refund" ($5k lump sum in month 4)
   - "Year-End Bonus" ($3k lump sum in month 12)
   - "Double Payments" (2x current extra payment)
   - One-click to add, fully customizable after adding

7. **Smart Recommendations**
   - Identifies fastest payoff scenario
   - Identifies scenario that saves most interest
   - Calculates most balanced approach (50% time + 50% money weight)
   - Visual badges and highlights for best options
   - Recommendation summary showing all three categories

### Key Technical Features:
- Uses existing professional-grade interest calculations (daily compounding for credit cards, proper amortization for loans)
- Lump sum payments properly integrated into month-by-month calculations
- Supports targeting specific debts or following strategy order
- Maximum 4 scenarios for comparison to keep UI manageable
- Real-time updates with debounced calculation (500ms)
- Mobile-responsive design with dark mode styling
- Full TypeScript type safety throughout

### User Benefits:
- Test "what if" questions without commitment
- See exact impact of tax refunds, bonuses, or pay raises
- Compare multiple strategies simultaneously
- Get personalized recommendations based on goals
- Make informed decisions about debt payoff
- Visual, intuitive interface for complex calculations

### Documentation:
- Created detailed implementation plan: `docs/what-if-scenario-calculator-plan.md`
- Updated features list: `docs/features.md`
- All components fully documented with inline comments

---

### Previous Session - Professional-Grade Debt Interest Calculations & Persistent Settings ✅

1. **Implemented Comprehensive Interest Calculation System**
   - Added database migrations for loan tracking fields (0014, 0015, 0016)
   - Added `loanType` field: 'revolving' (credit cards) vs 'installment' (mortgages, car loans)
   - Added `loanTermMonths`: Total loan term (60 for 5-year, 360 for 30-year)
   - Added `originationDate`: When the loan started
   - Added `compoundingFrequency`: daily, monthly, quarterly, annually
   - Added `billingCycleDays`: Days in billing cycle (credit cards vary 28-31)
   - Added `lastStatementDate` and `lastStatementBalance` for credit card tracking
   - Files: `drizzle/0014_*.sql`, `drizzle/0015_*.sql`, `drizzle/0016_*.sql`, `lib/db/schema.ts`

2. **Enhanced Payment Calculator with Accurate Interest Formulas**
   - **Revolving Credit (Credit Cards):**
     - Daily compounding: `(balance × APR ÷ 365) × billing_cycle_days`
     - Monthly compounding: `balance × APR ÷ 12`
     - Quarterly/Annual compounding supported
   - **Installment Loans (Mortgages, Car Loans):**
     - Standard amortization: `balance × monthly_rate`
     - Proper interest/principal split matching real amortization schedules
   - All calculations use Decimal.js for precision
   - Files: `lib/debts/payment-calculator.ts`

3. **Updated All Three Debt Payment Locations**
   - Bill-linked debt payments (automatic via category)
   - Category-based debt payments (automatic for debts with their own category)
   - Direct debt payments (manual selection in transaction form)
   - Each now calculates proper interest/principal breakdown
   - Stores `principalAmount` and `interestAmount` separately in `debt_payments` table
   - Only `principalAmount` reduces the `remainingBalance`
   - Files: `app/api/transactions/route.ts`

4. **Fixed Critical Payoff Calculator Bug**
   - Paid-off debt's minimum payment now properly rolls over to next debt
   - Fixed line where `availablePayment` wasn't actually increasing
   - Now correctly implements snowball/avalanche cascading payment effect
   - Example: Pay off $50 minimum → Next debt gets $50 more toward it
   - Files: `lib/debts/payoff-calculator.ts`

5. **Implemented Persistent Debt Settings**
   - Created `debt_settings` table to store user preferences
   - Saves `extraMonthlyPayment` amount (no more reset to $0 on refresh)
   - Saves `preferredMethod` (snowball or avalanche)
   - API endpoints: GET/PUT `/api/debts/settings`
   - Auto-loads settings on component mount
   - Auto-saves with 500ms debounce when values change
   - Files: `drizzle/0015_*.sql`, `app/api/debts/settings/route.ts`, `components/debts/debt-payoff-strategy.tsx`

6. **Enhanced Debt Form with Conditional Fields**
   - Added loan type selector (revolving vs installment)
   - **For Installment Loans** (shows when type = installment):
     - Loan term input (months) with helpful hints
     - Origination date picker
   - **For Revolving Credit** (shows when type = revolving):
     - Compounding frequency selector
     - Billing cycle days input
     - Last statement date/balance tracking
   - Smart defaults and validation throughout
   - Conditional display keeps form clean and relevant
   - Files: `components/debts/debt-form.tsx`

7. **Updated Payoff Strategy Calculator**
   - Now uses proper interest calculations based on loan type
   - Passes `loanType`, `compoundingFrequency`, `billingCycleDays` to calculator
   - Projections now match real-world amortization schedules
   - Files: `lib/debts/payoff-calculator.ts`, `app/api/debts/payoff-strategy/route.ts`

8. **Fixed Build Errors & Wrapped useSearchParams in Suspense**
   - Added debounce to extra payment input (500ms)
   - Wrapped transactions page in Suspense boundary for Next.js 15+
   - Created `TransactionsContent` component and wrapped in `<Suspense>`
   - All builds now successful
   - Files: `app/dashboard/transactions/page.tsx`, `components/debts/debt-payoff-strategy.tsx`

9. **Documentation Updates**
   - Updated `docs/debtsystemplan.md` with comprehensive interest calculation details
   - Added formulas and real-world examples for all debt types
   - Documented all new fields and their purposes
   - Added accuracy comparisons (before vs after)
   - Files: `docs/debtsystemplan.md`

### Database Migrations Applied This Session:
- `0014_add_principal_interest_to_debt_payments.sql` - Track principal vs interest
- `0015_add_debt_settings.sql` - Persist user preferences
- `0016_add_debt_loan_fields.sql` - Comprehensive loan tracking

### Real-World Accuracy Examples:

**Credit Card (18.99% APR, Daily Compounding):**
- Old calculation: $5,000 × 18.99% ÷ 12 = $79.13/month
- New calculation: $5,000 × (18.99% ÷ 365) × 30 days = $77.96/month ✓

**Car Loan ($20,000, 6% APR, 5 years):**
- Old: Interest always $100/month ✗
- New: Month 1 = $100, Month 60 = $1.92 (proper amortization) ✓

**Mortgage ($300,000, 4.5% APR, 30 years):**
- Old: Interest always $1,125/month ✗
- New: Month 1 = $1,125, Month 360 = $5.66 (proper amortization) ✓

---

### Previous Session - Debt Payoff Strategy Implementation & Build Fixes ✅

1. **Implemented Complete Debt Payoff Strategy System**
   - Created payoff calculator utility with Snowball & Avalanche algorithms
   - Snowball method: Pays smallest balance first for psychological wins
   - Avalanche method: Pays highest interest first for maximum savings
   - Calculates month-by-month payment breakdown with principal/interest split
   - Projects total payoff time and interest paid for each method
   - Uses Decimal.js for precise financial calculations
   - Files: `lib/debts/payoff-calculator.ts`

2. **Created Debt Payoff Strategy API Endpoint**
   - GET `/api/debts/payoff-strategy` with method, extraPayment, and compare params
   - Fetches all active debts for authenticated user
   - Returns detailed strategy results or full comparison
   - Supports both individual strategy and side-by-side comparison
   - Files: `app/api/debts/payoff-strategy/route.ts`

3. **Built Debt Payoff Strategy UI Component**
   - Toggle switch to compare Snowball vs Avalanche methods
   - Input field for extra monthly payment amount (beyond minimums)
   - "Pay This Next" card showing recommended debt, payment, months, and interest
   - Payoff order list showing all debts in priority order with details
   - Method comparison showing time to debt-free and total interest for both methods
   - Savings display (time & money) with recommendation when alternate method saves more
   - Real-time recalculation when extra payment changes
   - Files: `components/debts/debt-payoff-strategy.tsx`

4. **Created Payoff Timeline Visualization**
   - Horizontal timeline chart with colored bars for each debt
   - Length represents months to payoff
   - Milestone markers at 25%, 50%, 75%, 100% debt-free
   - Month-by-month payment breakdown table (payment, principal, interest, balance)
   - Collapsible view showing first 3 and last payment for each debt
   - Files: `components/debts/payoff-timeline.tsx`

5. **Integrated Payoff Strategy into Debts Page**
   - Added collapsible section above debt list
   - Only shows when user has active debts
   - Toggle button with description and expand/collapse functionality
   - Seamlessly integrated with existing debt management features
   - Files: `app/dashboard/debts/page.tsx`

6. **Fixed Multiple Build Errors (20+ TypeScript errors)**
   - Fixed non-existent `users` table import (changed to use Clerk userId directly)
   - Fixed type mismatches (string | null vs string | undefined)
   - Fixed missing properties in form data objects (merchantId, toAccountId)
   - Fixed implicit any[] types with explicit type annotations
   - Removed obsolete 'transfer' type references (now transfer_in/transfer_out)
   - Fixed JSX.Element to React.ReactElement type
   - Fixed Transaction type mismatches with type casting
   - Fixed TransactionType incompatibilities in mobile form
   - Fixed pie chart data type issues
   - Fixed sales tax and tax utils null vs undefined issues
   - Excluded test files from build (test-setup.ts, vitest.config.ts)
   - Fixed rules page to use RulesManager component correctly
   - Files: Multiple API routes, components, and utilities

7. **TypeScript Compilation Success**
   - All TypeScript errors resolved
   - Build compiles successfully through TypeScript phase
   - Remaining issue: Runtime pre-rendering error on transactions page (useSearchParams)
   - Solution documented: Needs Suspense boundary wrapper

### Previous Session - Transaction Details, Dashboard Enhancements & Planning ✅

1. **Enhanced Transaction Detail View**
   - Added comprehensive data display showing all available transaction information
   - Now displays: account, category, merchant, linked bills, linked debts, tags, custom fields
   - Shows receipt URLs, recurring info, import details, and sync status
   - Merchant name displayed as main heading with description as field below
   - API endpoint enriched to fetch all related data (merchants, bills, debts, tags, custom fields)
   - Fixed schema references (customFieldId vs fieldId)
   - Files: `app/api/transactions/[id]/route.ts`, `components/transactions/transaction-details.tsx`

2. **Fixed Calendar Week View Merchant Display**
   - Updated calendar day API to fetch actual merchant names from merchants table
   - Previously showed merchantId instead of merchant name
   - Week view now correctly displays merchant name or falls back to description
   - Files: `app/api/calendar/day/route.ts`, `components/calendar/calendar-week.tsx`

3. **Dashboard Quick Overview Reorganization**
   - **Card 1 (Monthly Spending)**: Added category dropdown to filter spending by category
   - **Card 2 (Accounts)**: Combined total balance and account list
     - Total balance displayed at top right
     - Account list shows: name, last 4 digits (inline), balance
     - Accounts are clickable and link to filtered transactions page
   - **Card 3**: Empty placeholder for future features
   - Removed account count and wallet icon for cleaner design
   - Files: `app/dashboard/page.tsx`

4. **Account-Filtered Transaction Navigation**
   - Clicking account on dashboard navigates to `/dashboard/transactions?accountId={id}`
   - Advanced search automatically reflects URL filter parameters
   - Search section stays collapsed but filter is active in background
   - When expanded, account checkbox is pre-selected
   - Files: `app/dashboard/page.tsx`, `app/dashboard/transactions/page.tsx`, `components/transactions/advanced-search.tsx`

5. **Created Planning Documents**
   - **Debt Payoff Strategy System** (`docs/debtsystemplan.md`)
     - Snowball vs Avalanche method comparison
     - Payoff order recommendations
     - Timeline visualization planning
     - Extra payment impact calculations
   - **Budget Tracking System** (`docs/budgetsystemplan.md`)
     - Category budget vs actual tracking
     - Variable bill budget comparison
     - Real-time progress monitoring
     - Budget analytics and insights

### Previous Session - Calendar Enhancements & Bill Display ✅

1. **Fixed Merchants Page Select.Item Error**
   - Changed empty string value to 'none' in merchant category selector
   - Prevents React error: "A <Select.Item /> must have a value prop that is not an empty string"
   - Files: `app/dashboard/merchants/page.tsx`

2. **Fixed Merchants API for Next.js 15+**
   - Updated merchants API to await params promise (required in Next.js 15+)
   - Changed params type from `{ params: { id: string } }` to `{ params: Promise<{ id: string }> }`
   - Files: `app/api/merchants/[id]/route.ts`

3. **Calendar Bill Display on Due Dates**
   - Bills now show on their correct due dates in the calendar
   - Updated month and day APIs to fetch bill instances with bill names
   - Each day shows bill names as color-coded badges
   - Files: `app/api/calendar/month/route.ts`, `app/api/calendar/day/route.ts`

4. **Automatic Overdue Bill Detection**
   - Bills automatically marked as "overdue" when due date passes
   - Overdue check runs on calendar load and bill instances fetch
   - Updates all pending bills where `dueDate < today` to status "overdue"
   - Files: `app/api/calendar/month/route.ts`, `app/api/calendar/day/route.ts`, `app/api/bills/instances/route.ts`

5. **Paid Bills Display with Checkmarks**
   - Paid bills now show in calendar with green background
   - Green checkmark (✓) icon displayed before bill name
   - Updated `hasActivity` check to include paid bills
   - Files: `components/calendar/calendar-day.tsx`, `components/calendar/calendar-week.tsx`

6. **Calendar Header Reorganization**
   - Navigation bar moved to top with Month/Year centered
   - Month/Week view buttons moved below navigation bar (centered)
   - Removed quick navigation buttons (Today, Tomorrow, etc.)
   - Files: `components/calendar/calendar-header.tsx`

7. **Week View Navigation Enhancement**
   - Previous/Next buttons now move by 1 week in week view (instead of 1 month)
   - Conditionally applies week or month navigation based on viewMode
   - Files: `components/calendar/calendar-header.tsx`

8. **Week View Transaction Details**
   - Week view completely redesigned to show transaction lists
   - Displays merchant name and amount for each transaction
   - Transfers show account name
   - Bills appear at top of each day with status colors
   - Each day column is scrollable for multiple transactions
   - Files: `components/calendar/calendar-week.tsx`, `app/api/calendar/day/route.ts`

9. **Merchant Display Fix in Calendar**
   - Fixed logic to properly show merchant names instead of descriptions
   - Added trim() check to handle empty merchant strings
   - Shows merchant if set, otherwise falls back to description
   - Files: `components/calendar/calendar-week.tsx`

### Previous Session - Category-Based Debt Tracking & Bill Payment UX ✅

1. **Implemented Category-Based Debt Tracking System**
   - Added `categoryId` field to debts table (migration `0013_add_category_id_to_debts.sql`)
   - Auto-creates category when debt is created (named "Debt: {debt name}")
   - Exception: If debt has monthly bill, no category created (uses bill's category)
   - Automatic debt payment detection via category matching
   - Three ways to pay debts:
     - Via bill category (for recurring monthly payments)
     - Via debt category (for irregular/ad-hoc payments)
     - Via direct debtId (legacy, still supported)
   - Files: `lib/db/schema.ts`, `app/api/debts/route.ts`, `app/api/transactions/route.ts`
   - Result: Simplified UX - select category and debt auto-updates

2. **Enhanced Category Selector with Grouped Display**
   - Fetches bills and debts in addition to regular categories
   - Groups categories with visual separators:
     - **Bills** section - Active bills with categories
     - **Debts** section - Active debts with categories
     - **Categories** section - Regular expense categories
   - Smart deduplication prevents duplicate category IDs from appearing
   - Bills/debts show by name but use their category ID behind the scenes
   - Files: `components/transactions/category-selector.tsx`
   - Result: Easy to find and pay bills/debts by name

3. **Added "Bill Payment" Transaction Type**
   - New transaction type appears first in dropdown for quick access
   - Shows dropdown of pending bills when selected
   - Auto-populates form with bill data:
     - Amount (expected amount)
     - Description (bill name)
     - Category (bill's category)
     - Notes (payment details with due date)
   - All fields remain editable before submission
   - Converts to 'expense' type on submission
   - Disables split transactions for bills
   - Files: `components/transactions/transaction-form.tsx`
   - Result: Much faster bill payment workflow

4. **Bug Fixes - Select.Item Empty String Values**
   - Fixed transaction form debt selector
   - Fixed bill form debt selector
   - Changed empty string values to 'none' with proper conversion
   - Files: `components/transactions/transaction-form.tsx`, `components/bills/bill-form.tsx`
   - Result: No more React errors about empty SelectItem values

5. **Fixed Component Initialization Order**
   - Moved `formData` state declaration before useEffect hooks
   - Prevents "Cannot access before initialization" errors
   - Files: `components/transactions/transaction-form.tsx`
   - Result: Transaction form loads without errors

### Database Migrations Applied This Session:
- `0013_add_category_id_to_debts.sql` - Added categoryId to debts table with index

### Previous Session - Debt Payment Integration & Bill Frequency Support ✅

1. **Fixed Missing debt_payments Table Error**
   - Root cause: Database schema defined `debtPayments` table but migration never created it
   - Solution: Created migration `0008_add_debt_payments_table.sql`
   - Also fixed `debt_payoff_milestones` table structure to match schema
   - Added missing indexes for both tables
   - Files: `drizzle/0008_add_debt_payments_table.sql`
   - Result: Debt management features now fully functional

2. **Implemented Complete Transaction → Bill → Debt Integration**
   - Added `debtId` field to bills table (migration `0010_add_debt_id_to_bills.sql`)
   - Enhanced bill form with debt selector dropdown (shows active debts with remaining balance)
   - Updated bills API to validate and store debt linkage
   - **Automatic Debt Payment Flow**: When expense transaction matches bill category:
     - Bill instance marked as paid
     - Debt payment record created automatically
     - Debt balance reduced by payment amount
     - Debt status updated to 'paid_off' if balance reaches $0
     - Milestones checked and marked as achieved (25%, 50%, 75%, 100%)
   - Files: `lib/db/schema.ts`, `components/bills/bill-form.tsx`, `app/api/bills/route.ts`, `app/api/transactions/route.ts`
   - Result: Seamless debt tracking through regular bill payments

3. **Added Direct Debt Payment Support (Non-Scheduled Payments)**
   - Added `debtId` field to transactions table (migration `0011_add_debt_id_to_transactions.sql`)
   - Enhanced transaction form with debt selector (only for expenses)
   - Shows helpful text: "Link this payment to a debt to automatically reduce the balance"
   - **Two Ways to Pay Debts**:
     - Regular bill payments (monthly/scheduled) → automatic via category matching
     - Ad-hoc payments (irregular/extra) → manual selection in transaction form
   - Both methods create debt payment records and update balance/milestones
   - Files: `lib/db/schema.ts`, `components/transactions/transaction-form.tsx`, `app/api/transactions/route.ts`
   - Result: Full flexibility for all debt payment scenarios

4. **Added Bill Frequency Support (Quarterly, Semi-Annual, Annual)**
   - Added `frequency` field to bills table (migration `0012_add_frequency_to_bills.sql`)
   - Options: Monthly, Quarterly (3 months), Semi-Annual (6 months), Annual (12 months)
   - Enhanced bill form with frequency selector dropdown
   - **Smart Instance Generation**:
     - Monthly: Creates 3 instances (next 3 months)
     - Quarterly: Creates 3 instances (next 9 months)
     - Semi-Annual: Creates 2 instances (next 12 months)
     - Annual: Creates 2 instances (next 2 years)
   - Auto-payment matching works with all frequencies
   - Files: `lib/db/schema.ts`, `components/bills/bill-form.tsx`, `app/api/bills/route.ts`
   - Result: Support for property taxes, insurance premiums, annual subscriptions, etc.

5. **Enhanced Debt Form with Required Field Indicators**
   - Added red asterisks (*) to all required field labels
   - Added `required` HTML attribute for browser-level validation
   - Added helpful notice: "Fields marked with * are required"
   - Three layers of validation: browser, JavaScript, visual feedback
   - Files: `components/debts/debt-form.tsx`
   - Result: Clear user guidance for debt creation

### Database Migrations Applied This Session:
- `0008_add_debt_payments_table.sql` - Created debt_payments and fixed debt_payoff_milestones
- `0009_fix_debts_table_structure.sql` - Fixed debts table column names (current_balance → remaining_balance, etc.)
- `0010_add_debt_id_to_bills.sql` - Added debt_id to bills for linking
- `0011_add_debt_id_to_transactions.sql` - Added debt_id to transactions for direct payments
- `0012_add_frequency_to_bills.sql` - Added frequency field to bills

### Previous Session - Category-Based Bill Matching & UI Fixes ✅

1. **Bug #69: Implemented Category-Based Bill Matching System**
   - Root cause: Complex fuzzy matching was unreliable and confusing
   - Solution: Replaced Levenshtein matching with simple category-based matching
   - When bill created, user selects a category
   - Any expense with that category marks the oldest unpaid bill instance as paid
   - Removed 7-day date restriction - now handles late/early/multiple payments automatically
   - Sorts pending instances by due date and matches to oldest first
   - Files: `app/api/transactions/route.ts`, `app/api/transactions/[id]/route.ts`, `components/bills/bill-form.tsx`
   - Result: Much more intuitive and predictable bill payment tracking

2. **Bug #70: Fixed Bill Edit Button Not Working**
   - Root cause: Prop name mismatch - edit page passed `initialData` but form expected `bill`
   - Solution: Fixed prop name and button text logic
   - Form now pre-populates correctly and shows "Update Bill" instead of "Create Bill"
   - Files: `app/dashboard/bills/edit/[id]/page.tsx`, `components/bills/bill-form.tsx`

3. **Bug #71: Fixed Transaction Sorting Showing Oldest First**
   - Root cause: Multiple `.reverse()` calls left over from when API sorted ascending
   - Solution: Removed all reverse() calls after fixing API to sort descending
   - Files: `app/api/transactions/route.ts`, `app/dashboard/transactions/page.tsx`, `components/transactions/recent-transactions.tsx`
   - Transactions now consistently show newest first everywhere

4. **Bug #72: Fixed Sidebar Not Sticky**
   - Root cause: Parent layout used `min-h-screen` allowing unlimited growth
   - Solution: Changed layout to `h-screen` with proper overflow handling
   - Only main content scrolls, sidebar stays fixed
   - Files: `components/navigation/sidebar.tsx`, `components/navigation/dashboard-layout.tsx`

5. **Bug #73: Added Category Display to Transaction Lists**
   - Enhancement: Show category name in recent transactions widget
   - Display format: "Jan 15 • Groceries • Split"
   - Files: `components/dashboard/recent-transactions.tsx`

### Previous Session - CSV Import Preview & Amount Fix ✅

1. **Bug #60: Fixed CSV Import Preview Button Not Responding** - Major multi-part fix
   - Replaced Node.js Buffer with browser btoa() for base64 encoding
   - Replaced browser FileReader with server-side PapaParse parsing
   - Updated validation to accept withdrawal/deposit OR amount field
   - Files: `csv-import-modal.tsx`, `import-preview.tsx`, `app/api/csv-import/route.ts`

2. **Bug #61: Fixed CSV Import Showing $0 Amounts**
   - Added Decimal.js `.isZero()` check - only set amount if non-zero
   - Files: `lib/csv-import.ts`

3. **Bug #62: Fixed CSV Import Button 400 Error**
   - Updated backend to filter by row numbers instead of IDs
   - Files: `app/api/csv-import/[importId]/confirm/route.ts`

4. **Bug #63: Added Auto-Refresh After CSV Import**
   - Added `onSuccess` callback to refresh transactions
   - Files: `csv-import-modal.tsx`, `transactions/page.tsx`

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

### Latest Session - Convert to Transfer Feature & Bug Fixes ✅

1. **Convert to Transfer Feature** - New feature for converting existing transactions
   - Created API endpoint `/api/transactions/[id]/convert-to-transfer`
   - Two modes: Create new paired transaction OR match with existing transaction
   - Smart matching: finds opposite-type transactions with similar amounts (±1%) and dates (±7 days)
   - Properly handles balance reversals and applies new transfer effects
   - Supports both expense→transfer_out and income→transfer_in conversions
   - Created ConvertToTransferModal component with account selection and transaction matching UI
   - Added radio-group UI component for mode selection
   - Integrated "Convert to Transfer" button in transaction details page
   - Files: `app/api/transactions/[id]/convert-to-transfer/route.ts`, `components/transactions/convert-to-transfer-modal.tsx`, `components/ui/radio-group.tsx`

2. **Bug #64: Bills not showing on dashboard**
   - Fixed bill instances API to join with bills table
   - Updated BillsWidget to transform new API response structure `{ instance, bill }`
   - Fixed interface to use `expectedAmount`/`actualAmount` instead of `amount`
   - Files: `app/api/bills/instances/route.ts`, `components/dashboard/bills-widget.tsx`

3. **Bug #65: Debt stats fetch error**
   - Added missing `export const dynamic = 'force-dynamic'` directive
   - Files: `app/api/debts/stats/route.ts`

4. **Bug #66: Bills page parseISO error**
   - Updated bills page to transform API response structure
   - Files: `app/dashboard/bills/page.tsx`

5. **Bug #67: Debt creation SQL error**
   - Created migration 0007 to add missing columns to debts table
   - Added: description, creditorName, originalAmount, remainingBalance, interestType, type, color, icon, startDate, targetPayoffDate, status, priority, notes, updatedAt
   - Files: `drizzle/0007_update_debts_schema.sql`

6. **Bug #68: Dashboard bills widget empty**
   - Fixed multi-status filtering to handle comma-separated values (e.g., "pending,paid")
   - Added inArray support for status parameter
   - Files: `app/api/bills/instances/route.ts`

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
