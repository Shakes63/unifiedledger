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
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── db/               # Database schema and utilities
│   └── utils.ts          # Utility functions
├── public/               # Static assets
├── docs/
│   └── finance-app-development-plan.md  # Full development plan
├── .claude/
│   └── claude.md         # This file
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── drizzle.config.ts     # To be created
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

### Testing
- Use Vitest for unit tests
- Use React Testing Library for component tests
- Test files should be colocated with source files as `*.test.ts` or `*.test.tsx`

## Current Setup Status
✅ Project initialized with Next.js 16
✅ All core dependencies installed
✅ shadcn/ui initialized with 14 components
✅ TypeScript configured
✅ Tailwind CSS v4 configured
✅ ESLint and Prettier configured
⏳ Database schema needs to be created
⏳ Environment variables need to be configured
⏳ Clerk authentication needs to be set up
⏳ Application pages need to be built

## Next Steps
1. Create database schema in `lib/db/schema.ts` based on the development plan
2. Set up environment variables (`.env.local`)
3. Configure Clerk authentication
4. Create core pages and components
5. Implement features according to the development plan

## Important Notes
- The development plan is located in `docs/finance-app-development-plan.md`
- Use `pnpm dev` to start the development server (runs on http://localhost:3000)
- Git repository is initialized and ready for commits
- PWA manifest needs to be configured for mobile app functionality
