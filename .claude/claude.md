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
│   │   ├── transactions/              # Transaction CRUD endpoints
│   │   ├── accounts/                  # Account management endpoints
│   │   ├── categories/                # Category management endpoints
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
│   └── household/
│       └── household-selector.tsx
├── lib/
│   ├── db/
│   │   ├── schema.ts                  # Complete database schema
│   │   └── index.ts                   # Database client
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

## Next Phase: Phase 2 - Smart Features (Weeks 3-4)
The next phase will focus on:
1. Recurring transactions and smart templates
2. Advanced category suggestions based on patterns
3. Smart amount predictions
4. Transaction categorization rules
5. Improved dashboard with analytics
6. Monthly budget tracking
7. Bill management system
8. Savings goals tracking

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