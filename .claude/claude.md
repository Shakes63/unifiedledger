# Unified Ledger - Finance App Project

## Project Overview
A comprehensive mobile-first personal finance application built with Next.js, featuring transaction tracking, bill management, budgeting, and household financial collaboration.

## Tech Stack
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5.9
- **Styling:** Tailwind CSS v4 + shadcn/ui (17 components)
- **Database:** SQLite with Drizzle ORM
- **Authentication:** Clerk
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
│   │   ├── sales-tax/            # Sales tax reporting
│   │   └── user/settings/theme/  # Theme preferences API
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
│       ├── theme/                # Theme settings
│       └── [others]/             # Categories, merchants, rules, notifications
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
│   ├── themes/                  # Theme system
│   │   ├── theme-config.ts      # Theme definitions
│   │   └── theme-utils.ts       # Theme utilities
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

### Design System & Theming
**Theming System:**
- Dynamic theme switching with CSS variables
- Two available themes: Dark Mode (default) and Dark Pink Theme
- Themes defined in `lib/themes/theme-config.ts`
- Applied via `applyTheme()` function in `lib/themes/theme-utils.ts`
- Preference saved to database and persists across sessions

**Use Semantic Color Tokens (NOT hardcoded hex colors):**
- Background: `bg-background` or `bg-card` (NOT `bg-[#1a1a1a]`)
- Text: `text-foreground`, `text-muted-foreground` (NOT `text-white`, `text-gray-400`)
- Borders: `border-border` (NOT `border-[#2a2a2a]`)
- Accent: `bg-accent`, `text-accent` (NOT `bg-[#10b981]`)
- Hover: `hover:bg-elevated` (NOT `hover:bg-[#242424]`)

**Complete CSS Color Variables Reference:**

All color variables are defined in `app/globals.css` and can be accessed via:
- Tailwind classes: `bg-background`, `text-foreground`, `border-border`, etc.
- CSS variables: `var(--color-background)`, `var(--color-foreground)`, `var(--color-border)`, etc.

**Background & Surface Colors:**
- `--color-background` / `bg-background` - Main page background
- `--color-card` / `bg-card` - Card/surface background
- `--color-card-foreground` / `text-card-foreground` - Text on cards
- `--color-elevated` / `bg-elevated` - Hover states, elevated surfaces
- `--color-popover` / `bg-popover` - Popover/dropdown backgrounds
- `--color-popover-foreground` / `text-popover-foreground` - Text in popovers
- `--color-input` / `bg-input` - Input field backgrounds

**Border & Outline Colors:**
- `--color-border` / `border-border` - All borders and dividers
- `--color-ring` / `ring-ring` - Focus ring color

**Text Colors:**
- `--color-foreground` / `text-foreground` - Primary text color
- `--color-muted` / `bg-muted` - Muted background
- `--color-muted-foreground` / `text-muted-foreground` - Secondary/muted text

**Semantic Transaction Colors:**
- `--color-income` / `text-[var(--color-income)]` - Income transactions (green/turquoise)
- `--color-expense` / `text-[var(--color-expense)]` - Expense transactions (red/pink)
- `--color-transfer` / `text-[var(--color-transfer)]` - Transfer transactions (blue/purple)

**UI State Colors:**
- `--color-primary` / `bg-[var(--color-primary)]` - Primary actions, buttons (pink)
- `--color-primary-foreground` / `text-primary-foreground` - Text on primary buttons (black)
- `--color-secondary` / `bg-secondary` - Secondary actions
- `--color-secondary-foreground` / `text-secondary-foreground` - Text on secondary
- `--color-accent` / `bg-accent` - Accent highlights
- `--color-accent-foreground` / `text-accent-foreground` - Text on accent
- `--color-destructive` / `bg-destructive` - Delete/destructive actions
- `--color-destructive-foreground` / `text-destructive-foreground` - Text on destructive
- `--color-success` / `bg-[var(--color-success)]` - Success states (green/turquoise)
- `--color-warning` / `bg-[var(--color-warning)]` - Warning states (amber/yellow)
- `--color-error` / `bg-[var(--color-error)]` - Error states (red/rose)

**Theme-Specific Values:**

**Dark Mode Theme (default):**
- Background: `oklch(0.144788 0.000000 0.000000)` - Near-black (#0a0a0a)
- Card: `oklch(0.217787 0.000000 0.000000)` - Dark gray (#1a1a1a)
- Elevated: `oklch(0.260325 0.000000 0.000000)` - Lighter gray (#242424)
- Border: `oklch(0.285017 0.000000 0.000000)` - Medium gray (#2a2a2a)
- Income: `oklch(0.695873 0.149074 162.479602)` - Emerald green
- Expense: `oklch(0.710627 0.166148 22.216224)` - Red
- Transfer: `oklch(0.713740 0.143381 254.624021)` - Blue
- Primary: `oklch(0.655920 0.211773 354.308441)` - Pink
- Success: `oklch(0.695873 0.149074 162.479602)` - Emerald (same as income)
- Warning: `oklch(0.768590 0.164659 70.080390)` - Amber
- Error: `oklch(0.636834 0.207849 25.331328)` - Red

**Dark Pink Theme:**
- Background: `oklch(0.155506 0.018491 312.515996)` - Deep aubergine (#0f0a12)
- Card: `oklch(0.199368 0.029768 309.973432)` - Purple-tinted (#1a1220)
- Elevated: `oklch(0.228815 0.043923 313.832051)` - Lighter purple (#24162b)
- Border: `oklch(0.316141 0.052839 309.805027)` - Purple border
- Income: `oklch(0.797116 0.133888 211.530189)` - Turquoise/cyan
- Expense: `oklch(0.725266 0.175227 349.760748)` - Pink
- Transfer: `oklch(0.708969 0.159168 293.541199)` - Purple/violet
- Primary: `oklch(0.655920 0.211773 354.308441)` - Pink (same as dark mode)
- Success: `oklch(0.784520 0.132529 181.911977)` - Turquoise/teal
- Warning: `oklch(0.836861 0.164422 84.428628)` - Amber
- Error: `oklch(0.719186 0.168984 13.427993)` - Rose

**Usage Examples:**
```tsx
// Background colors
<div className="bg-background">Main background</div>
<div className="bg-card">Card background</div>
<div className="bg-elevated hover:bg-elevated">Hover state</div>

// Text colors
<p className="text-foreground">Primary text</p>
<p className="text-muted-foreground">Secondary text</p>

// Transaction type colors
<span className="text-[var(--color-income)]">Income</span>
<span className="text-[var(--color-expense)]">Expense</span>
<span className="text-[var(--color-transfer)]">Transfer</span>

// Primary buttons (pink with white text)
<button className="bg-[var(--color-primary)] text-white hover:opacity-90">
  Primary Action
</button>

// State colors
<div className="bg-[var(--color-success)]">Success</div>
<div className="bg-[var(--color-warning)]">Warning</div>
<div className="bg-[var(--color-error)]">Error</div>
```

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
- **Principal vs Interest Pie Charts:** Payment composition visualization at different stages
- **Credit Utilization Tracking:** Complete credit card utilization monitoring with dashboard widget, inline badges, API endpoint, and collapsible sections
- **Collapsible Debt Cards:** Enhanced debt UI with payment history and amortization sections (in progress)

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

## Recent Updates - Session Summary

### Latest: Payment Frequency Options (2025-11-09) ✅
- **Payment Frequency Expansion**: Complete implementation of weekly and quarterly payment options
  - **Database Schema**: Updated paymentFrequency enum to support all four frequencies ('weekly', 'biweekly', 'monthly', 'quarterly')
  - **Type System**: Updated PaymentFrequency type throughout codebase
  - **Interest Calculation Updates** (lib/debts/payoff-calculator.ts):
    - Weekly: 7-day periods for revolving credit, annual rate ÷ 52 for installment loans
    - Quarterly: 91.25-day periods for revolving credit, annual rate ÷ 4 for installment loans
    - Maintains existing monthly and bi-weekly calculations
    - Accurate for both revolving credit and installment loans
  - **UI Components Updated**:
    - Debt Payoff Strategy: 2x2 responsive grid, color-coded buttons, educational helper text
    - What-If Calculator: Quick templates for weekly and quarterly scenarios
    - Scenario Builder: Full frequency selection per scenario
  - **Color Coding**: Weekly (green/success), Bi-weekly (pink/primary), Monthly (accent), Quarterly (amber/warning)
  - **API Updates**: Settings API validation accepts all four frequencies
  - **User Education**: Helper text explains payments/year and payoff speed for each frequency
  - **Performance**: Build verified successful, no degradation with weekly schedules

### Collapsible Debt Cards & Page Reorganization (2025-11-09) ✅
- **Collapsible Debt Cards**: Complete implementation with localStorage persistence
  - **DebtPayoffTracker Enhancement**: Clickable headers to expand/collapse entire card
  - **PaymentHistoryList Component**: Displays all payments with principal/interest breakdown, large payment highlighting
  - **DebtAmortizationSection Component**: Per-debt amortization schedules with three-tab view
  - **useDebtExpansion Hook**: Custom hook for state management with localStorage persistence
  - **Expand/Collapse All Controls**: Bulk controls for managing multiple debts
  - **Default State**: All debts collapsed by default for clean UI
  - **Theme Integration**: All components use CSS variables
  - **Smooth Animations**: 300ms CSS transitions for all interactions

- **Debts Page Reorganization**: Improved information hierarchy
  - Debt cards moved above analysis sections for better UX
  - Payoff Strategy section moved up in priority
  - Payment Tracking (Adherence & Streak) now in collapsible section
  - Minimum Payment Warning moved to bottom
  - Logical flow: View debts → Strategy → Tracking → Analysis → Warning

- **Reports Page Enhancement**: Advanced debt analysis consolidated
  - **Payment Breakdown Analysis**: Principal vs Interest pie charts moved from debts page
  - **Debt Reduction Progress**: Historical + projected charts moved from debts page
  - **Interactive Amortization Schedule**: Full schedule view moved from debts page
  - New "Debt Analysis" section with three collapsible subsections
  - All debt visualizations now accessible in Reports alongside financial reports

### Credit Utilization Tracking (2025-11-09) ✅
- **Credit Utilization Tracking**: Completed full implementation for credit card monitoring
  - **Debt Form Enhancement**: Credit limit input field (credit cards only) with real-time utilization display
  - **API Endpoint** (app/api/debts/credit-utilization/route.ts): Aggregate statistics, per-card details, recommendations
  - **CreditUtilizationBadge Component**: Inline badge with emoji, color-coding, and hover tooltip
  - **CreditUtilizationWidget Component**: Dashboard widget with progress ring, health score, quick stats
  - **DebtPayoffTracker Enhancement**: Collapsible utilization section, payment calculator, warning indicators
  - **Dashboard Integration**: Widget auto-displays when credit cards with limits exist
  - **Health Levels**: Color-coded (Excellent 0-10%, Good 10-30%, Fair 30-50%, Poor 50-75%, Critical 75%+)
  - **Smart Recommendations**: Actionable advice based on utilization level
  - **Payment Calculator**: Shows exact amount needed to reach 30% target
  - **Theme Integration**: All components use CSS variables, works with both themes
  - **Responsive**: Optimized for mobile, tablet, and desktop

### Principal vs Interest Pie Chart ✅
- **Principal vs Interest Pie Chart**: Completed comprehensive payment breakdown visualization
  - PaymentComparisonPieCharts showing first, midpoint, and final payment composition
  - TotalCostPieChart displaying overall principal vs interest breakdown
  - Interest multiplier calculation and warnings for high-cost debt
  - Collapsible PaymentBreakdownSection with multi-debt support
  - Educational insights explaining payment dynamics
  - Integrated between Payment Tracking and Debt Reduction Chart

### Theme System & Dashboard Styling ✅
- Full theme infrastructure with Dark Mode (default) + Dark Pink Theme
- Theme persistence to database, loads on app start
- Dynamic CSS variable application - changes apply instantly
- All dashboard & transactions pages converted to semantic color tokens
- Settings section reorganized (Categories, Merchants, Rules, Notifications moved to Settings)
- Theme settings page at `/dashboard/theme` with full color palette preview

### Payment Features ✅
- **Debt Payoff Strategy**: Snowball & Avalanche algorithms with payment frequency support (monthly/bi-weekly)
- **Interactive Amortization Schedules**: Virtual-scrolled 360-month tables with charts and month-detail modals
- **Payment Adherence**: Weighted scoring (recent 3mo 50%, 4-6mo 30%, older 20%) comparing actual vs expected
- **Payment Streaks**: Gamified consecutive payment tracking with milestones (🔥💪🏆🥇💎)
- **Budget Integration**: Surplus calculator with one-click debt application, DTI indicator

### Debt Management ✅
- Comprehensive interest calculations (revolving credit: daily compounding, installment: amortization)
- Minimum payment warning showing cost comparison
- Debt-free countdown widget with progress ring & milestone tracking
- What-If Scenario Calculator (up to 4 scenarios with lump sums)
- Bi-weekly payment support with automatic 13th payment effect
- NULL handling, infinite loop prevention, payment cascade on debt payoff
- **Debt Reduction Chart**: Historical + projected balance tracking (12mo history + 24mo projection)
  - Total debt chart (projected vs actual with area fill)
  - Individual debt stacked area chart (toggleable visibility)
  - Uses real payoff calculator for accurate projections with interest
  - Summary metrics (total paid, % complete, debt-free date)
  - View mode toggle (combined/individual/both)

### Transaction Features ✅
- **2-Transaction Transfer Model**: transfer_out + transfer_in linked pairs
- **Split Transactions**: Visual editor with amount/percentage support
- **CSV Import**: Auto-detection, column mapping, duplicate checking
- **Convert to Transfer**: Convert existing transactions with smart matching (±1% amount, ±7 days date)
- Advanced search (11 filter types), saved searches, pagination
- Category-based bill/debt payment auto-detection

### Bill Management ✅
- Category-based payment matching (reliable, simple)
- Multiple frequency support (monthly, quarterly, semi-annual, annual)
- Auto-payment detection marks oldest unpaid instance as paid
- Overdue bill auto-detection
- Bill display on calendar with status colors

### Database Migrations Applied
All 19 migrations successfully applied including: theme preferences, payment frequency, debt loan fields, principal/interest tracking, amortization schedule support, transfer model conversion, bill frequency support, category-based debt tracking, comprehensive debt fields, and credit limit for utilization tracking.

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
