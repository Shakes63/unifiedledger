# Unified Ledger - Finance App Project

## Project Overview
A comprehensive mobile-first personal finance application built with Next.js, featuring transaction tracking, bill management, budgeting, and household financial collaboration.

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **Database:** SQLite with Drizzle ORM
- **Authentication:** Clerk
- **Package Manager:** pnpm
- **Testing:** Vitest + React Testing Library
- **PWA:** next-pwa for mobile app experience

## Key Dependencies
### Core Framework
- `next@16.0.1` - Framework
- `react@19.2.0` - UI library
- `typescript@5.9.3` - Type checking

### UI & Styling
- `tailwindcss@4.1.17` - Utility-first CSS
- `shadcn/ui` - Component library (14 components installed)
- `lucide-react@0.553.0` - Icons
- `class-variance-authority` - Component variant management
- `tailwindcss-animate` - Animation utilities

### Database & ORM
- `drizzle-orm@0.44.7` - ORM
- `better-sqlite3@12.4.1` - SQLite database
- `drizzle-kit@0.31.6` - Schema migrations

### Authentication
- `@clerk/nextjs@6.34.5` - User authentication

### Forms & Validation
- `react-hook-form@7.66.0` - Form state management
- `zod@4.1.12` - Schema validation
- `@hookform/resolvers@5.2.2` - Form validation integration

### Data & Utilities
- `date-fns@4.1.0` - Date manipulation
- `recharts@3.3.0` - Charting library
- `papaparse@5.5.3` - CSV parsing
- `fastest-levenshtein@1.0.16` - String similarity for duplicate detection
- `nanoid@5.1.6` - Unique ID generation
- `decimal.js@10.6.0` - Precise decimal calculations (critical for financial data)

### State Management & Notifications
- `zustand@5.0.8` - Lightweight state management
- `sonner@2.0.7` - Toast notifications
- `next-pwa@5.6.0` - Progressive Web App support

## Project Structure
```
unifiedledger/
├── app/
│   ├── api/                           # API routes
│   │   ├── transactions/              # Transaction CRUD endpoints (with auto-categorization)
│   │   ├── accounts/                  # Account management endpoints (usage-sorted)
│   │   ├── categories/                # Category management endpoints (usage-sorted)
│   │   ├── merchants/                 # Merchant listing (usage-sorted)
│   │   ├── rules/                     # Categorization rules CRUD
│   │   │   ├── route.ts              # List, create, update, delete rules
│   │   │   ├── test/route.ts         # Test rules against transactions
│   │   │   └── apply-bulk/route.ts   # Bulk apply rules to existing txns
│   │   ├── categorization/
│   │   │   └── suggest/route.ts      # Smart category suggestions
│   │   ├── auth/init/                 # User initialization
│   │   ├── households/                # Household management
│   │   ├── suggestions/               # Smart suggestions
│   │   └── ...
│   ├── dashboard/
│   │   ├── page.tsx                   # Dashboard home
│   │   ├── transactions/
│   │   │   ├── page.tsx               # Transactions list
│   │   │   └── new/page.tsx           # New transaction form
│   │   └── ...
│   ├── layout.tsx                     # Root layout with dark mode
│   ├── page.tsx                       # Landing page
│   ├── globals.css                    # Design system CSS variables
│   ├── sign-in/                       # Clerk authentication pages
│   ├── sign-up/
│   └── ...
├── components/
│   ├── ui/                            # shadcn/ui components
│   ├── dashboard/
│   │   └── recent-transactions.tsx    # Dashboard widget
│   ├── transactions/                  # Transaction components
│   │   ├── transaction-form.tsx
│   │   ├── account-selector.tsx
│   │   ├── category-selector.tsx
│   │   ├── quick-transaction-modal.tsx
│   │   ├── merchant-autocomplete.tsx
│   │   └── transaction-templates.tsx
│   ├── rules/                         # Categorization rules components
│   │   ├── rule-builder.tsx           # Visual condition builder
│   │   ├── rules-manager.tsx          # Rule listing and management
│   │   └── bulk-apply-rules.tsx       # Bulk operation interface
│   └── household/
│       └── household-selector.tsx
├── lib/
│   ├── db/
│   │   ├── schema.ts                  # Complete database schema
│   │   └── index.ts                   # Database client
│   ├── rules/                         # Rules engine and utilities
│   │   ├── condition-evaluator.ts     # Condition matching logic
│   │   └── rule-matcher.ts            # Rule matching algorithm
│   └── utils.ts
├── public/
│   ├── logo.png                       # Unified Ledger branding icon
│   └── manifest.json
├── docs/
│   └── finance-app-development-plan.md
├── middleware.ts                      # Clerk authentication middleware
├── drizzle.config.ts                  # Database configuration
├── next.config.ts                     # Next.js configuration
├── tailwind.config.ts                 # Tailwind configuration (commented)
├── package.json
├── tsconfig.json
└── pnpm-lock.yaml
```

## Development Guidelines

### Using pnpm
Always use `pnpm` instead of npm or yarn:
```bash
pnpm install       # Install dependencies
pnpm add <pkg>     # Add dependency
pnpm add -D <pkg>  # Add dev dependency
pnpm dev           # Start dev server
pnpm build         # Build for production
```

### Code Quality
- ESLint configured for code linting
- Prettier configured for code formatting
- TypeScript strict mode for type safety
- Use shadcn/ui components for consistent UI

### Database
- Drizzle ORM for type-safe database queries
- SQLite for local storage
- Schema defined in `lib/db/schema.ts`
- Migrations managed with drizzle-kit

### Financial Calculations
- Always use `decimal.js` for money calculations (avoid JavaScript number precision issues)
- Never use floating-point arithmetic for financial data

### Categorization Rules System
The application has a sophisticated rules engine for automatic transaction categorization:

**Rule Conditions:**
- 14 operators: equals, not_equals, contains, not_contains, starts_with, ends_with, greater_than, less_than, between, regex, in_list, matches_day, matches_weekday, matches_month
- 8 fields: description, amount, account_name, date, day_of_month, weekday, month, notes
- Recursive AND/OR groups for complex logic
- Full validation with detailed error messages

**Rule Matching:**
- Priority-based (lower number = higher priority)
- First matching rule applies (stops at first match)
- Only applies to transactions without manual category
- Automatic logging to ruleExecutionLog table
- Test endpoint available for preview before saving

**Database Schema:**
- `categorizationRules` - Rule definitions with conditions as JSON
- `ruleExecutionLog` - Audit trail of rule applications
- Both tables include proper indexing for performance

**Usage:**
```typescript
// Test a rule before saving
POST /api/rules/test { rule, transactions }

// Apply rules to existing transactions
POST /api/rules/apply-bulk?startDate=2024-01-01&endDate=2024-12-31&limit=100

// Manage rules
GET/POST/PUT/DELETE /api/rules
```

### Component Development
- Use shadcn/ui as the base for components
- Follow the existing component structure in `components/ui/`
- Use TypeScript for all components
- Apply dark mode first approach with Tailwind CSS
- Use design system colors defined in `app/globals.css`

### Design System
The application uses a comprehensive dark mode first design system:

**Colors:**
- **Background:** `#0a0a0a` (near-black for OLED efficiency)
- **Surface:** `#1a1a1a` (card/panel backgrounds)
- **Elevated:** `#242424` (hover states, elevated cards)
- **Border:** `#2a2a2a` (subtle dividers)
- **Text Primary:** `#ffffff` (headings, important text)
- **Text Secondary:** `#9ca3af` (labels, descriptions)
- **Text Tertiary:** `#6b7280` (metadata, auxiliary info)
- **Semantic Colors:**
  - Income: `#10b981` (emerald-400)
  - Expense: `#f87171` (red-400)
  - Transfer: `#60a5fa` (blue-400)
  - Warning: `#fbbf24` (amber-400)

**Typography:**
- **Primary Font:** Inter (modern, clean sans-serif)
- **Mono Font:** JetBrains Mono (for code/amounts)
- **Headings:** Bold (700 weight), white
- **Body Text:** Regular (400), gray-400
- **Small Text:** Regular (400), gray-500

**Spacing & Radius:**
- **Border Radius:** 12px (xl), 8px (lg), 6px (md)
- **Spacing:** 6px units (p-3=12px, p-4=16px, p-6=24px)
- **Gap Between Cards:** 6px/24px

**Dark Mode:**
- Enabled globally via `<html class="dark">`
- All colors optimized for dark backgrounds
- Reduced eye strain for frequent use

### Testing
- Use Vitest for unit tests
- Use React Testing Library for component tests
- Test files should be colocated with source files as `*.test.ts` or `*.test.tsx`

## Phase 1: Foundation & Core Transaction Entry - COMPLETED ✅

### Setup & Configuration
✅ Project initialized with Next.js 16
✅ All core dependencies installed
✅ shadcn/ui initialized with 14 components
✅ TypeScript configured
✅ Tailwind CSS v4 configured
✅ ESLint and Prettier configured
✅ Database schema with comprehensive Drizzle ORM setup
✅ Environment variables configured (.env.local)
✅ Clerk authentication configured and working
✅ PWA manifest and icons configured
✅ Dark mode first design system implemented
✅ Application scaffold complete

### Phase 1 Features Implemented
✅ Transaction entry system (form + quick modal)
✅ Multi-account support with balance tracking
✅ Smart category system with auto-suggestions
✅ Merchant autocomplete for repeat transactions
✅ Transaction templates for common expenses
✅ Transactions list with filtering and search
✅ Household management system with invitations
✅ User auto-initialization with defaults
✅ Recent transactions dashboard widget
✅ Design system applied to all pages
✅ Brand identity (logo on navbar, landing page)

### Phase 1 API Endpoints
✅ `/api/transactions` - Full transaction CRUD
✅ `/api/accounts` - Account management
✅ `/api/categories` - Category management with defaults
✅ `/api/auth/init` - Auto-initialize user
✅ `/api/households` - Household management
✅ `/api/households/[id]/invitations` - Invitations
✅ `/api/suggestions` - Smart suggestions

## Phase 2: Transaction Intelligence & Speed Features - IN PROGRESS 🟢

**Progress: 11/24 tasks completed (45.8%)**

### Completed Phase 2 Features

#### Usage Tracking & Smart Sorting
- ✅ Usage tracking system for accounts, categories, and merchants
- ✅ Usage-based sorting on all selection lists (most-used first)
- ✅ Merchant table with totalSpent and averageTransaction tracking
- ✅ UsageAnalytics table for comprehensive usage history

#### Smart Categorization
- ✅ Smart category suggestion engine based on merchant history
- ✅ Merchant autocomplete with frequency display
- ✅ Auto-apply category on merchant selection (if learned)
- ✅ Confidence score display for category suggestions

#### Comprehensive Rules System
- ✅ **Condition Evaluator:** 14 operators, 8 fields, recursive AND/OR groups
- ✅ **Rule Matcher:** Priority-based matching algorithm (first match wins)
- ✅ **Rule Testing:** Test rules against sample transactions before saving
- ✅ **Auto-Application:** Rules applied automatically on transaction creation
- ✅ **Rule Builder UI:** Visual condition editor with nested groups
- ✅ **Rules Manager UI:** List, prioritize, toggle, and manage rules
- ✅ **Bulk Operations:** Apply rules to existing uncategorized transactions
- ✅ **Rule Statistics:** Track match count and last used timestamps

#### Transaction History & Repeat
- ✅ Transaction history with pagination
- ✅ Repeat/clone transaction functionality (creates copy with new date)
- ✅ Save transactions as templates for quick re-entry
- ✅ Load and apply saved templates

#### Split Transaction Management
- ✅ **Database Schema:** `transactionSplits` table with amount/percentage support
- ✅ **Split Builder UI:** Visual editor for creating splits during transaction creation
- ✅ **Split Validation:** Ensures percentage/amount splits match transaction total
- ✅ **Split CRUD APIs:** Full GET, POST, PUT, DELETE endpoints for splits
- ✅ **Transaction Details Page:** View full transaction info with splits display
- ✅ **Transaction Editing:** Full edit capability for existing transactions
- ✅ **Split Editing:** Add, modify, or delete splits from existing transactions
- ✅ **Transaction Deletion:** Cascade deletion with automatic cleanup of splits
- ✅ **Balance Management:** Automatic account balance adjustments on edits
- ✅ **Split Indicators:** Visual badges showing which transactions are split
- ✅ **Clickable Transaction List:** Navigate to transaction details from list

#### Advanced Search & Filtering
- ✅ **Database Indexes:** 5 new performance indexes on transactions table
  - `idx_transactions_category` - for category filtering
  - `idx_transactions_type` - for transaction type queries
  - `idx_transactions_amount` - for amount range filtering
  - `idx_transactions_user_date` - composite for date range queries
  - `idx_transactions_user_category` - composite for user+category queries
- ✅ **Optional Tables:** `savedSearchFilters` and `searchHistory` for search persistence
- ✅ **Search API Endpoint:** `/api/transactions/search` with 11 filter types
  - Text search in description & notes
  - Category, account, and type filtering
  - Amount range filtering
  - Date range filtering
  - Pending/split/has-notes toggles
  - Multiple sort options (date, amount, description)
  - Automatic search tracking to history
  - Pagination support with limit and offset
- ✅ **Advanced Search UI:** Comprehensive filter component with 8+ filter options
- ✅ **Saved Searches:** Full CRUD API for managing saved search filters
  - `/api/saved-searches` - Create, list, and manage saved searches
  - `/api/saved-searches/[id]` - Get, update, delete individual searches
  - Usage tracking (usage count, last used timestamp)
  - Default search management
  - Search description and metadata
- ✅ **Saved Searches UI:** Component for loading, creating, and managing saved searches
  - Quick save button to save current search
  - Expandable saved search list with details
  - Load with single click (auto-executes search)
  - Delete saved searches
  - Set as default search
  - Usage statistics display
- ✅ **Pagination UI:** Full pagination support with Previous/Next navigation
  - Displays current page range
  - Shows total result count
  - Respects search filters on pagination
  - Disabled state management for edge cases
- ✅ **Integration:** Full integration into transactions page with real-time search and pagination

### Split Transaction System Architecture

**Backend:**
- `app/api/transactions/[id]/route.ts` - GET, PUT, DELETE transaction endpoints
- Split CRUD endpoints already existed and are fully integrated

**Frontend:**
- `components/transactions/transaction-details.tsx` - Full transaction view
- `components/transactions/splits-list.tsx` - Display all splits for transaction
- `components/transactions/transaction-form.tsx` - Enhanced with edit mode support
- `app/dashboard/transactions/[id]/page.tsx` - Transaction details route
- `app/dashboard/transactions/[id]/edit/page.tsx` - Transaction editing route
- `app/dashboard/transactions/page.tsx` - Updated with navigation and split indicators

### Rules System Architecture

**Backend:**
- `lib/rules/condition-evaluator.ts` - Core matching logic with validation
- `lib/rules/rule-matcher.ts` - Priority-based rule selection algorithm
- `app/api/rules/route.ts` - CRUD operations for rule management
- `app/api/rules/test/route.ts` - Test endpoint for preview before saving
- `app/api/rules/apply-bulk/route.ts` - Bulk apply with date filtering

**Frontend:**
- `components/rules/rule-builder.tsx` - Visual condition builder
- `components/rules/rules-manager.tsx` - Rule management interface
- `components/rules/bulk-apply-rules.tsx` - Bulk operation UI

### Next Phase 2 Tasks
1. ✅ Add transaction history with "repeat" functionality
2. ✅ Build split transaction database schema
3. ✅ Implement split transaction creation and editing UI
4. ✅ Build advanced search database schema
5. ✅ Implement core search function with filtering (pagination & saved searches)
6. [ ] Duplicate detection with Levenshtein distance
7. [ ] CSV import with auto-detection

### Phase 3 Goals (After Phase 2)
1. Multi-account transfers with usage-based suggestions
2. Calendar view with transaction indicators
3. Advanced search with filters
4. CSV import with column mapping
5. Budget tracking and analytics

## Important Notes
- The development plan is located in `docs/finance-app-development-plan.md`
- Use `pnpm dev` to start the development server (runs on http://localhost:3000)
- Git repository is initialized with commits; always commit meaningful changes
- PWA is configured and ready for mobile app deployment
- Dark mode is the default and only theme; no light mode toggle needed
- Never start dev servers for the purpose of leaving them running for the user. You can start them to see if they successfully run but then always kill the process after.

## Key Development Decisions

### Architecture
- **API Routes:** RESTful API in Next.js app/api directory
- **Database:** SQLite with Drizzle ORM for type safety
- **Client State:** React hooks for component state, Zustand for app-wide state if needed
- **Form Handling:** React Hook Form with Zod validation

### Financial Data
- All monetary amounts use `decimal.js` to avoid floating-point errors
- Currency is in dollars (can be configured via environment)
- Balances update immediately on transaction creation

### Authentication
- Clerk handles all auth via middleware
- User initialization happens automatically on first dashboard visit
- Household creation optional; users can work individually

### Branding
- Logo: `public/logo.png` (Unified Ledger icon)
- Brand name: "Unified Ledger" (with space)
- Font: Inter for all branding/UI

## Common Tasks

### Adding a New Feature
1. Create API route(s) if needed in `app/api/`
2. Create database schema if needed (update `lib/db/schema.ts`)
3. Create component(s) in `components/`
4. Create or update page(s) in `app/`
5. Apply design system colors and styling
6. Test with dev server
7. Commit changes

### Styling Components
- Use hex colors from globals.css (or inline: `bg-[#1a1a1a]`)
- Use Tailwind classes with our custom color palette
- Follow the 12px radius rule for consistency
- Always include hover states for interactive elements

### Database Queries
- Use Drizzle ORM helpers from `lib/db/index.ts`
- Import schema from `lib/db/schema.ts`
- Always verify user owns the data before returning
- Use proper indexes from schema for performance
- turbopack is no longer experimental in Nextjs 16 just run it normally