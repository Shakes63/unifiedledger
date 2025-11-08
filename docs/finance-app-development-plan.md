# Personal Finance Dashboard - Mobile-First Web Application Plan

> **🎯 Ready to Build?** Follow the [8-Step Quick Start Guide](#-quick-start-guide---build-your-app-in-8-steps) below to set up your development environment in ~15 minutes. Then jump to the [14-Week Development Timeline](#-development-timeline---transaction-first-approach) to start building features.

### 🗺️ Your Development Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│  START HERE                                                          │
│  ↓                                                                   │
│  1. Quick Start Guide (Steps 1-8) → Get project running            │
│     ├─ Install dependencies                                         │
│     ├─ Configure dark mode theme                                    │
│     └─ Set up database                                              │
│  ↓                                                                   │
│  2. Phase 1: Foundation (Week 1-2) → Core transaction entry        │
│     └─ Goal: 10-second transaction entry                           │
│  ↓                                                                   │
│  3. Phase 2: Intelligence (Week 3-4) → Smart features              │
│     └─ Goal: 5-second repeat transactions                          │
│  ↓                                                                   │
│  4. Phase 3-5: Features (Week 5-10) → All major functionality      │
│     ├─ Multi-account & transfers                                    │
│     ├─ Bills & budgets                                              │
│     ├─ Goals & debt tracking                                        │
│     └─ Household sharing                                            │
│  ↓                                                                   │
│  5. Phase 6-7: Polish (Week 11-14) → Mobile optimization & deploy  │
│     └─ Goal: Production-ready PWA                                   │
│  ↓                                                                   │
│  🎉 LAUNCH!                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Project Setup Completion Status

### Initial Setup - COMPLETED ✨

| Task | Status | Details |
|------|--------|---------|
| Create Next.js Project | ✅ DONE | Next.js 16 with App Router |
| Install Core Dependencies | ✅ DONE | React 19, TypeScript 5.9 |
| Install UI Packages | ✅ DONE | shadcn/ui with 14 components installed |
| Initialize shadcn/ui | ✅ DONE | Using shadcn CLI (updated from deprecated shadcn-ui) |
| Install Database Packages | ✅ DONE | Drizzle ORM 0.44.7 + better-sqlite3 12.4.1 |
| Install Authentication | ✅ DONE | Clerk 6.34.5 installed |
| Install Forms & Validation | ✅ DONE | React Hook Form 7.66.0 + Zod 4.1.12 |
| Install Utilities & Charts | ✅ DONE | recharts, date-fns, papaparse, decimal.js, etc. |
| Install Dev Tools | ✅ DONE | Prettier, ESLint, TypeScript, Vitest |
| Initialize Git Repository | ✅ DONE | Repository initialized and pushed to GitHub |
| Configure GitHub Remote | ✅ DONE | Remote: git@github-shakes63:Shakes63/unifiedledger.git |
| Create .claude/claude.md | ✅ DONE | Project documentation and guidelines |
| Update Tech Stack Versions | ✅ DONE | Updated plan to reflect Next.js 16 + React 19 |

### Remaining Setup Steps

| Task | Status | Details |
|------|--------|---------|
| Create Database Schema | ✅ DONE | Comprehensive Drizzle ORM schema with all tables |
| Configure Environment Variables | ✅ DONE | Created .env.local with placeholder Clerk credentials |
| Set up PWA Manifest | ✅ DONE | PWA manifest configured with app shortcuts |
| Configure drizzle.config.ts | ✅ DONE | Database configuration ready for migrations |
| Start Development Server | ✅ DONE | Dev server running on http://localhost:3000 |

### Next Steps to Deploy

| Task | Status | Details |
|------|--------|---------|
| Update Clerk Credentials | ✅ DONE | Real Clerk API keys configured in .env.local |
| Create PWA Icons | ✅ DONE | Generated 96x192x512 icons (regular + maskable) from UnitedLedgerIcon.png |
| Generate Database | ✅ DONE | Database schema defined in lib/db/schema.ts - tables created on first app usage |
| Create Core Pages | ✅ DONE | Landing page, sign-in, sign-up, and dashboard pages complete |
| Implement Phase 1 Features | ✅ DONE | Full transaction entry system with accounts, categories, and smart features |
| Update Design System | ✅ DONE | Applied dark mode first design system to all pages and components |
| Update Layout & Typography | ✅ DONE | Configured Inter font, dark mode root class, and color variables |
| Commit Phase 1 Changes | ✅ DONE | All Phase 1 features committed to repository |

---

## 🚀 Quick Start Guide - Build Your App in 8 Steps

### Step 1: Create Project
```bash
pnpm create next-app@latest unifiedledger --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd unifiedledger
```

**Related Sections:**
- [Tech Stack Details](#-technical-architecture)
- [Development Timeline Phase 1](#phase-1-foundation--core-transaction-entry-week-1-2)

---

### Step 2: Install Core Dependencies
```bash
# UI & Styling
pnpm add tailwindcss-animate class-variance-authority clsx tailwind-merge lucide-react

# Database
pnpm add drizzle-orm better-sqlite3
pnpm add -D drizzle-kit @types/better-sqlite3

# Authentication
pnpm add @clerk/nextjs

# Forms & Validation
pnpm add react-hook-form zod @hookform/resolvers

# Date, Charts, CSV
pnpm add date-fns recharts papaparse fastest-levenshtein decimal.js nanoid
pnpm add -D @types/papaparse

# PWA
pnpm add next-pwa
pnpm add -D webpack

# Notifications (in-app only, no email)
pnpm add sonner
```

**Related Sections:**
- [Dependencies & Modules](#-dependencies--modules)
- [Configuration Files](#configuration-files)

---

### Step 3: Initialize shadcn/ui
```bash
pnpm dlx shadcn-ui@latest init

# Select options:
# - Style: Default
# - Base color: Zinc
# - CSS variables: Yes
```

**Related Sections:**
- [UI/UX Design Approach](#uiux-design-approach)
- [Dark Mode Color System](#dark-mode-color-system)

---

### Step 4: Install shadcn/ui Components
```bash
pnpm dlx shadcn-ui@latest add button card input label select separator badge dropdown-menu dialog sheet tabs toast switch slider progress avatar popover command calendar textarea checkbox radio-group scroll-area
```

**Related Sections:**
- [Component Patterns](#component-patterns)
- [Dark Mode First Design](#uiux-design-approach)

---

### Step 5: Set up Database Schema
```bash
# Create lib/db/schema.ts with your database schema
# Copy the complete schema from this plan
# Then run:
pnpm run db:generate  # Generate migrations
pnpm run db:push      # Push to database
```

**Related Sections:**
- [Complete Database Schema](#-complete-database-schema)
- [Core Tables: Accounts, Transactions, Categories](#complete-database-schema)
- [Household Management Schema](#database-schema-added)
- [All Feature-Specific Tables](#complete-database-schema)

---

### Step 6: Configure Environment Variables
Create `.env.local`:
```bash
# Clerk Authentication (get from https://clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Database
DATABASE_URL=file:./local.db

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Note: No email service needed - all notifications are in-app only
```

**Related Sections:**
- [Configuration Files](#configuration-files)
- [Authentication with Clerk](#tech-stack)

---

### Step 7: Set up PWA Manifest
Create `public/manifest.json`:
```json
{
  "name": "UnifiedLedger",
  "short_name": "UnifiedLedger",
  "description": "Personal finance management app",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Related Sections:**
- [PWA Configuration](#configuration-files)
- [Phase 6: Mobile Optimization](#phase-6-mobile-optimization--performance-week-11-12)

---

### Step 8: Start Development Server
```bash
pnpm dev
```

Then begin implementing features following the **[Development Timeline](#-development-timeline---transaction-first-approach)** starting with Phase 1.

**Next Steps:**
- [Phase 1: Foundation & Core Transaction Entry](#phase-1-foundation--core-transaction-entry-week-1-2)
- [Complete Development Timeline (14 weeks)](#-development-timeline---transaction-first-approach)
- [Success Criteria Checklists](#debt-payoff-strategy-success-criteria)

---

## 📑 Table of Contents

### Planning & Architecture
1. [Current System Analysis](#-current-system-analysis) - Understanding the spreadsheet we're replacing
2. [Technical Architecture](#-technical-architecture) - Tech stack and tools
3. [Dependencies & Modules](#-dependencies--modules) - All packages needed
4. [Configuration Files](#configuration-files) - Setup files and configs
5. [Project Structure](#project-structure) - Folder organization
6. [UI/UX Design Approach](#uiux-design-approach) - Dark mode first design system

### Database & Backend
7. [Complete Database Schema](#-complete-database-schema) - All tables and relationships
8. [Business Logic Functions](#business-logic--functions) - Core functions for each feature

### Features (Detailed Implementation)
9. [Debt Payoff Strategy](#debt-payoff-strategy-functions) - Snowball/Avalanche methods
10. [Usage-Based Sorting](#usage-based-sorting--smart-item-ordering) - Smart suggestions
11. [Multi-User/Household Management](#multi-user-household-management) - Sharing & collaboration
12. [Notifications & Reminders](#notifications--reminders-system) - In-app notifications
13. [Charts & Visual Reports](#charts--visual-reports) - Data visualization
14. [Split Transactions](#split-transactions) - Multi-category transactions
15. [Calendar View](#calendar-view) - Visual transaction calendar
16. [Tags & Custom Fields](#tags--custom-fields) - Flexible organization
17. [Tax Category Mapping](#tax-category-mapping) - Tax preparation
18. [Sales Tax Tracking](#sales-tax-tracking) - Income tax reporting
19. [Advanced Search & Filtering](#advanced-search--filtering) - Powerful search
20. [Audit Log & Version History](#audit-log--version-history) - Change tracking
21. [CSV Import](#csv-import-with-manual-mapping--duplicate-detection) - Bank statement import
22. [Custom Categorization Rules](#custom-transaction-categorization-rules) - Auto-categorization
23. [User Settings & Profile](#user-settings--profile-management) - User preferences

### Development
24. [API Endpoints](#transaction-management) - All API routes
25. [Development Timeline](#-development-timeline---transaction-first-approach) - 14-week roadmap
26. [Success Criteria](#debt-payoff-strategy-success-criteria) - Quality checklists
27. [Key Features Summary](#key-features) - Benefits overview

---

## 📊 Current System Analysis

### Spreadsheet Structure Analyzed
Based on the "Pink/Purple Complete Finance Dashboard and Annual Budget System" CSV export, your current system includes:

**Core Sections:**
1. **Income Tracking** - Multiple income sources with budgeted amounts
2. **Variable Expenses** - Flexible spending categories with budget allocations
3. **Monthly Bills** - Fixed recurring expenses with due dates
4. **Savings Goals** - Target amounts with start dates, finish lines, and recommended monthly savings
5. **Debt Management** - Current balances, minimum payments, interest rates, payoff start date tracking
6. **Non-Monthly Bills** - Annual irregular expenses distributed across 12 months

**Key Calculations:**
- Total income vs. total expenses
- Savings goal progress and timeline calculations
- Debt payoff projections with interest calculations and progress tracking since start date
- Debt milestone detection (25%, 50%, 75% paid off)
- Debt payoff momentum indicators (accelerating/steady/slowing)
- Monthly budget surplus/deficit analysis
- Annual bill distribution and planning

### Enhanced Requirements
- **Multi-Account Support** - Track multiple bank accounts simultaneously
- **Transfer Linking** - Mark and link transfers between accounts
- **Mobile-First Design** - Optimized for smartphone usage
- **Real-time Balance Updates** - Account balances update with transactions

---

## 🏗️ Technical Architecture

### Tech Stack
```
Frontend: Next.js 16 (App Router) + React 19 + TypeScript
Styling: Tailwind CSS v4 + shadcn/ui components (Dark Mode First)
Database: SQLite with Drizzle ORM
Authentication: Clerk
Package Manager: pnpm
Deployment: Coolify (self-hosted)
PWA: next-pwa for mobile app experience
```

---

## 📦 Dependencies & Modules

### Initial Project Setup

**Create Next.js Project:**
```bash
pnpm create next-app@latest unifiedledger --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd unifiedledger
```

### Core Dependencies

**Framework & React:**
```bash
pnpm add next@latest react@latest react-dom@latest
pnpm add -D typescript @types/node @types/react @types/react-dom
```

**Styling & UI:**
```bash
# Tailwind CSS (already included in Next.js setup)
pnpm add tailwindcss-animate class-variance-authority clsx tailwind-merge

# shadcn/ui (CLI for component installation)
pnpm dlx shadcn-ui@latest init

# Install shadcn/ui components as needed:
pnpm dlx shadcn-ui@latest add button card input label select separator badge dropdown-menu dialog sheet tabs toast switch slider progress
```

**Typography:**
```bash
# Inter font via next/font (no installation needed, built into Next.js)
# Import in layout: import { Inter } from 'next/font/google'
```

**Icons:**
```bash
pnpm add lucide-react  # Icon library that works perfectly with shadcn/ui
```

### Database & ORM

**Drizzle ORM + SQLite:**
```bash
pnpm add drizzle-orm better-sqlite3
pnpm add -D drizzle-kit @types/better-sqlite3

# Alternative: Turso (cloud SQLite) for easier deployment
# pnpm add @libsql/client
```

### Authentication

**Clerk:**
```bash
pnpm add @clerk/nextjs
```

### Forms & Validation

**React Hook Form + Zod:**
```bash
pnpm add react-hook-form zod @hookform/resolvers
```

### Date & Time Handling

**date-fns:**
```bash
pnpm add date-fns  # For date formatting, manipulation, and relative time
```

### Charts & Visualizations

**Recharts:**
```bash
pnpm add recharts  # React charting library for financial charts
```

### CSV Import/Export

**CSV Parsing:**
```bash
pnpm add papaparse  # Powerful CSV parser
pnpm add -D @types/papaparse
```

### String Similarity (Duplicate Detection)

**Levenshtein Distance:**
```bash
pnpm add fastest-levenshtein  # Fast string similarity for duplicate detection
```

### State Management (Optional)

**Zustand (lightweight alternative to Redux):**
```bash
pnpm add zustand  # For client-side state if needed (optional)
```

### PWA Support

**next-pwa:**
```bash
pnpm add next-pwa
pnpm add -D webpack  # Required peer dependency
```

### Notifications & Toast

**Sonner (Toast notifications):**
```bash
pnpm add sonner  # Beautiful toast notifications
# Or use shadcn's toast component
```

### Email (NOT USED)

**Email notifications are NOT part of this application.**
- Household invitations will use shareable invite links instead
- All notifications are in-app only (no email alerts)

### Utilities

**General Utilities:**
```bash
pnpm add nanoid  # For generating unique IDs
pnpm add decimal.js  # For precise decimal calculations (financial data)
```

### Development Tools

**Code Quality:**
```bash
pnpm add -D eslint prettier eslint-config-prettier
pnpm add -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Testing (Optional but recommended):**
```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
pnpm add -D @vitejs/plugin-react jsdom
```

---

## ⚙️ Configuration Files

### 1. **drizzle.config.ts** (Drizzle ORM Configuration)
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: './sqlite.db',
  },
} satisfies Config;
```

### 2. **tailwind.config.ts** (Custom Colors)
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#1a1a1a',
        elevated: '#242424',
        border: '#2a2a2a',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

### 3. **next.config.js** (PWA Configuration)
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
```

### 4. **.env.local** (Environment Variables)
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Database
DATABASE_URL=./sqlite.db

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Note: No email service needed - all notifications are in-app only
```

### 5. **package.json** scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:push": "drizzle-kit push:sqlite",
    "db:studio": "drizzle-kit studio",
    "db:generate": "drizzle-kit generate:sqlite",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

---

## 🗂️ Project Structure

```
unifiedledger/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── transactions/page.tsx
│   │   ├── accounts/page.tsx
│   │   ├── budget/page.tsx
│   │   ├── bills/page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── accounts/route.ts
│   │   ├── transactions/route.ts
│   │   ├── rules/route.ts
│   │   ├── household/route.ts
│   │   └── [...other api routes]
│   ├── layout.tsx (root layout with Inter font)
│   ├── globals.css
│   └── page.tsx
├── components/
│   ├── ui/ (shadcn/ui components)
│   ├── dashboard/
│   ├── transactions/
│   ├── accounts/
│   └── shared/
├── lib/
│   ├── db/
│   │   ├── schema.ts (Drizzle schema definitions)
│   │   ├── index.ts (Database connection)
│   │   └── queries/
│   ├── utils.ts (utility functions)
│   ├── validations.ts (Zod schemas)
│   └── hooks/ (custom React hooks)
├── public/
│   ├── manifest.json (PWA manifest)
│   └── icons/ (PWA icons)
├── drizzle/ (generated migrations)
├── .env.local
├── drizzle.config.ts
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── package.json
```

---

### UI/UX Design Approach
**Dark Mode First Philosophy:**
- Dark theme is the default and primary design
- All components designed and optimized for dark mode viewing
- Color palette selected for excellent dark mode readability
- Reduced eye strain for frequent daily use
- OLED-friendly near-blacks for battery savings on mobile
- High contrast text and UI elements for clarity
- Optional light mode as secondary theme (if needed)

**Dark Mode Color System** (based on design reference):

*Background & Surfaces:*
- Background: `bg-black` / `#000000` or `bg-[#0a0a0a]` (pure/near-black for OLED)
- Surface/Cards: `bg-[#1a1a1a]` / `#1a1a1a` (card backgrounds, panels)
- Surface Elevated: `bg-[#242424]` / `#242424` (hover states, elevated cards)
- Border/Divider: `border-[#2a2a2a]` / `#2a2a2a` (subtle borders)

*Text Colors:*
- Text Primary: `text-white` / `#ffffff` (headings, important text)
- Text Secondary: `text-gray-400` / `#9ca3af` (labels, descriptions, metadata)
- Text Tertiary: `text-gray-500` / `#6b7280` (timestamps, auxiliary info)

*Semantic Colors:*
- Success/Income: `text-emerald-400` / `#34d399` (positive transactions, income, gains)
- Danger/Expense: `text-red-400` / `#f87171` (negative transactions, expenses, debt)
- Warning: `text-amber-400` / `#fbbf24` (alerts, pending items, warnings)
- Info: `text-blue-400` / `#60a5fa` (informational states)

*Account Type Icon Colors:*
- Savings: `bg-teal-500/20` with `text-teal-400` (teal/cyan accent)
- Checking: `bg-blue-500/20` with `text-blue-400` (blue accent)
- Investment: `bg-purple-500/20` with `text-purple-400` (purple accent)
- Credit Card: `bg-red-500/20` with `text-red-400` (red accent)
- Emergency: `bg-emerald-500/20` with `text-emerald-400` (green accent)

*Interactive Elements:*
- Primary Button: `bg-white` with `text-black` (high contrast CTA)
- Secondary Button: `bg-[#242424]` with `text-white` and `border-[#3a3a3a]`
- Hover State: `hover:bg-[#2a2a2a]` (subtle lift)
- Focus Ring: `ring-white/20` (accessible focus indicators)

**Typography System:**
- Font Family: Inter or similar modern sans-serif
- Headings: Bold weight (700), white color
- Body: Regular weight (400), gray-400 color
- Small Text: Regular weight (400), gray-500 color
- Numbers/Amounts: Medium weight (500-600) for emphasis
- Monospace: For monetary amounts (optional, for alignment)

**Spacing & Layout:**
- Card Padding: `p-6` (24px)
- Card Border Radius: `rounded-xl` (12px)
- Card Gap: `gap-6` (24px between cards)
- List Item Padding: `p-4` (16px)
- Icon Size: `w-10 h-10` (40px) for account icons
- Icon Padding: `p-2.5` (10px) inside colored background

**Component Patterns:**

*Transaction List Items:*
```tsx
- Icon in colored rounded square background (e.g., shopping cart, wallet)
- Transaction name in white (medium weight)
- Timestamp in gray-500 below name
- Amount on right in red (expenses) or green (income)
- Arrow icon next to amount for outgoing transactions
- Hover state: bg-[#1f1f1f]
```

*Account Cards:*
```tsx
- White account name (medium-bold)
- Gray description below
- Large balance amount on right (white, bold)
- Colored icon on left in semi-transparent background
- Separator lines between accounts in gray-800
```

*Action Buttons:*
```tsx
- Primary (Add, Send): White background, black text, medium weight
- Secondary (Top-up, More): Dark background, white text, border
- Icon + Text combination
- Rounded corners (rounded-lg)
- Hover: subtle brightness increase
```

**Implementation Notes:**
- Set `<html class="dark">` by default in root layout
- Configure Tailwind with `darkMode: 'class'` strategy
- Install Inter font from Google Fonts or use next/font
- Use custom colors in `tailwind.config.ts`:
  ```ts
  colors: {
    background: '#0a0a0a',
    surface: '#1a1a1a',
    elevated: '#242424',
    border: '#2a2a2a',
  }
  ```
- All shadcn/ui components styled with these custom colors
- No light mode toggle needed (optional for future enhancement)
- Use `backdrop-blur-sm` for modals/overlays
- Consistent 12px border radius for modern feel

**Example Component Implementations:**

*Account Card Component:*
```tsx
<div className="bg-[#1a1a1a] rounded-xl p-6 space-y-4">
  <div className="flex items-center justify-between">
    <h2 className="text-white font-bold text-lg">Accounts</h2>
  </div>
  
  <div className="space-y-1">
    <p className="text-gray-400 text-sm">Total Balance</p>
    <p className="text-white font-bold text-3xl">$26,540.25</p>
  </div>
  
  <div className="space-y-3 pt-4">
    <div className="flex items-center gap-3 hover:bg-[#1f1f1f] p-3 rounded-lg transition-colors">
      <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
        <WalletIcon className="w-5 h-5 text-teal-400" />
      </div>
      <div className="flex-1">
        <p className="text-white font-medium">Main Savings</p>
        <p className="text-gray-400 text-sm">Personal savings</p>
      </div>
      <p className="text-white font-semibold">$8,459.45</p>
    </div>
  </div>
</div>
```

*Transaction List Item:*
```tsx
<div className="flex items-center gap-3 hover:bg-[#1f1f1f] p-4 rounded-lg transition-colors">
  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
    <ShoppingCartIcon className="w-5 h-5 text-red-400" />
  </div>
  <div className="flex-1">
    <p className="text-white font-medium">Apple Store Purchase</p>
    <p className="text-gray-500 text-sm">Today, 2:45 PM</p>
  </div>
  <div className="flex items-center gap-1">
    <p className="text-red-400 font-semibold">-$999.00</p>
    <ArrowUpRightIcon className="w-4 h-4 text-red-400" />
  </div>
</div>
```

*Primary Action Button:*
```tsx
<button className="bg-white text-black font-medium px-6 py-2.5 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2">
  <PlusIcon className="w-5 h-5" />
  Add
</button>
```

*Secondary Action Button:*
```tsx
<button className="bg-[#242424] text-white font-medium px-6 py-2.5 rounded-lg border border-[#3a3a3a] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2">
  <ArrowUpIcon className="w-5 h-5" />
  Send
</button>
```

### Database Schema Design

```sql
-- Enhanced accounts with usage tracking
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'investment', 'cash')),
  bank_name TEXT,
  account_number_last4 TEXT,
  current_balance DECIMAL(12,2) DEFAULT 0,
  available_balance DECIMAL(12,2), -- for credit accounts
  credit_limit DECIMAL(12,2), -- for credit accounts
  is_active BOOLEAN DEFAULT true,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT DEFAULT 'wallet',
  sort_order INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0, -- NEW: track how often this account is used
  last_used_at DATETIME, -- NEW: when this account was last used
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced budget categories with usage tracking
CREATE TABLE budget_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'variable_expense', 'monthly_bill', 'savings', 'debt', 'non_monthly_bill')),
  monthly_budget DECIMAL(12,2) DEFAULT 0,
  due_date INTEGER, -- day of month for bills
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0, -- NEW: track category usage frequency
  last_used_at DATETIME, -- NEW: when this category was last used
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- NEW: Merchant/vendor usage tracking
CREATE TABLE merchants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, -- lowercase, no spaces for matching
  category_id TEXT, -- most commonly associated category
  usage_count INTEGER DEFAULT 1,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_spent DECIMAL(12,2) DEFAULT 0, -- total amount spent at this merchant
  average_transaction DECIMAL(8,2) DEFAULT 0, -- average transaction amount
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES budget_categories(id),
  
  -- Ensure unique merchant names per user
  UNIQUE(user_id, normalized_name)
);

-- NEW: Usage analytics table for general frequency tracking
CREATE TABLE usage_analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('account', 'category', 'merchant', 'transfer_pair', 'bill')),
  item_id TEXT NOT NULL,
  item_secondary_id TEXT, -- for pairs like transfer combinations
  usage_count INTEGER DEFAULT 1,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  context_data TEXT, -- JSON for additional context (e.g., time of day, amount range)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Composite key for tracking different item types
  UNIQUE(user_id, item_type, item_id, item_secondary_id)
);

-- Enhanced transactions with account linking and transfers
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  category_id TEXT,
  bill_id TEXT, -- NEW: Links transaction to a specific bill payment
  date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  notes TEXT,
  type TEXT DEFAULT 'expense' CHECK (type IN ('income', 'expense', 'transfer_in', 'transfer_out')),
  transfer_id TEXT, -- links to transfers table
  is_pending BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  recurring_rule TEXT, -- JSON for recurring logic
  receipt_url TEXT,
  is_split BOOLEAN DEFAULT false, -- NEW: marks if this is a split transaction parent
  split_parent_id TEXT, -- NEW: references parent transaction if this is a split item (deprecated approach)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (category_id) REFERENCES budget_categories(id),
  FOREIGN KEY (transfer_id) REFERENCES transfers(id),
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);

-- NEW: Split transaction items
CREATE TABLE transaction_splits (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL, -- parent transaction
  category_id TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  percentage DECIMAL(5,2), -- optional percentage of total
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES budget_categories(id),
  
  -- Index for fast split lookups
  INDEX idx_transaction_splits (transaction_id)
);

-- NEW: Bills tracking table
CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT,
  expected_amount DECIMAL(12,2) NOT NULL,
  due_date INTEGER NOT NULL, -- day of month (1-31)
  is_variable_amount BOOLEAN DEFAULT false, -- true for bills like utilities that vary
  amount_tolerance DECIMAL(5,2) DEFAULT 5.00, -- tolerance for auto-matching (±$5)
  payee_patterns TEXT, -- JSON array of merchant name patterns to match
  account_id TEXT, -- preferred account for this bill
  is_active BOOLEAN DEFAULT true,
  auto_mark_paid BOOLEAN DEFAULT true, -- auto-mark when matching transaction found
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES budget_categories(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- NEW: Bill instances for tracking individual due dates and payment status
CREATE TABLE bill_instances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  due_date DATE NOT NULL, -- actual due date for this instance
  expected_amount DECIMAL(12,2) NOT NULL,
  actual_amount DECIMAL(12,2), -- amount actually paid
  paid_date DATE, -- when it was actually paid
  transaction_id TEXT, -- which transaction paid this bill
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'skipped')),
  days_late INTEGER DEFAULT 0,
  late_fee DECIMAL(8,2) DEFAULT 0,
  is_manual_override BOOLEAN DEFAULT false, -- true if manually marked paid without transaction
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  
  -- Ensure one instance per bill per month
  UNIQUE(bill_id, due_date)
);

-- Transfer linking system
CREATE TABLE transfers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  from_account_id TEXT NOT NULL,
  to_account_id TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  from_transaction_id TEXT,
  to_transaction_id TEXT,
  fees DECIMAL(8,2) DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_account_id) REFERENCES accounts(id),
  FOREIGN KEY (to_account_id) REFERENCES accounts(id),
  FOREIGN KEY (from_transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (to_transaction_id) REFERENCES transactions(id)
);

-- Savings goals from your spreadsheet
CREATE TABLE savings_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL,
  starting_amount DECIMAL(12,2) DEFAULT 0,
  current_amount DECIMAL(12,2) DEFAULT 0,
  start_date DATE NOT NULL,
  target_date DATE,
  monthly_contribution DECIMAL(12,2) DEFAULT 0,
  account_id TEXT, -- which account this goal is tied to
  is_completed BOOLEAN DEFAULT false,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Debt tracking from your debt section with payoff strategy
CREATE TABLE debts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  current_balance DECIMAL(12,2) NOT NULL,
  minimum_payment DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,4), -- e.g., 0.1850 for 18.5%
  due_date INTEGER, -- day of month
  additional_payment DECIMAL(12,2) DEFAULT 0,
  account_id TEXT, -- which account payments come from
  is_active BOOLEAN DEFAULT true,
  priority_order INTEGER DEFAULT 0, -- for custom ordering
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- NEW: User debt payoff preferences
CREATE TABLE debt_payoff_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  strategy TEXT DEFAULT 'snowball' CHECK (strategy IN ('snowball', 'avalanche', 'custom')),
  total_extra_payment DECIMAL(12,2) DEFAULT 0,
  auto_allocate_extra BOOLEAN DEFAULT true, -- automatically allocate extra payment based on strategy
  show_comparison BOOLEAN DEFAULT true, -- show both methods for comparison
  payoff_start_date DATE, -- when user started their debt payoff journey
  starting_total_debt DECIMAL(12,2) DEFAULT 0, -- total debt at start for progress tracking
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Debt payoff milestones tracking
CREATE TABLE debt_payoff_milestones (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  milestone_type TEXT NOT NULL CHECK (milestone_type IN ('25_percent', '50_percent', '75_percent', 'first_debt_paid', 'halfway', 'final_debt')),
  achieved_date DATE NOT NULL,
  total_paid_off DECIMAL(12,2) NOT NULL,
  remaining_debt DECIMAL(12,2) NOT NULL,
  months_since_start INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES household_members(user_id),
  INDEX idx_milestones_user (user_id, achieved_date DESC)
);

-- Non-monthly bills annual planning
CREATE TABLE non_monthly_bills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  january_due INTEGER,
  january_amount DECIMAL(12,2) DEFAULT 0,
  february_due INTEGER,
  february_amount DECIMAL(12,2) DEFAULT 0,
  march_due INTEGER,
  march_amount DECIMAL(12,2) DEFAULT 0,
  april_due INTEGER,
  april_amount DECIMAL(12,2) DEFAULT 0,
  may_due INTEGER,
  may_amount DECIMAL(12,2) DEFAULT 0,
  june_due INTEGER,
  june_amount DECIMAL(12,2) DEFAULT 0,
  july_due INTEGER,
  july_amount DECIMAL(12,2) DEFAULT 0,
  august_due INTEGER,
  august_amount DECIMAL(12,2) DEFAULT 0,
  september_due INTEGER,
  september_amount DECIMAL(12,2) DEFAULT 0,
  october_due INTEGER,
  october_amount DECIMAL(12,2) DEFAULT 0,
  november_due INTEGER,
  november_amount DECIMAL(12,2) DEFAULT 0,
  december_due INTEGER,
  december_amount DECIMAL(12,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Budget periods for monthly tracking
CREATE TABLE budget_periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_income DECIMAL(12,2) DEFAULT 0,
  total_variable_expenses DECIMAL(12,2) DEFAULT 0,
  total_monthly_bills DECIMAL(12,2) DEFAULT 0,
  total_savings DECIMAL(12,2) DEFAULT 0,
  total_debt_payments DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, month, year)
);

-- NEW: Household/family groups for multi-user access
CREATE TABLE households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL, -- user_id of creator
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- NEW: Household members and their roles
CREATE TABLE household_members (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL, -- Clerk user ID
  user_email TEXT NOT NULL,
  user_name TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invited_by TEXT, -- user_id who sent invitation
  is_active BOOLEAN DEFAULT true,
  FOREIGN KEY (household_id) REFERENCES households(id),
  
  -- Ensure user can't be added to same household twice
  UNIQUE(household_id, user_id)
);

-- NEW: Household invitations
CREATE TABLE household_invitations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  invited_email TEXT NOT NULL,
  invited_by TEXT NOT NULL, -- user_id
  role TEXT DEFAULT 'member',
  invitation_token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id)
);

-- NEW: Activity log for household transparency
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('transaction_created', 'transaction_updated', 'transaction_deleted', 'bill_paid', 'transfer_created', 'account_created', 'budget_updated', 'settings_changed')),
  entity_type TEXT NOT NULL, -- 'transaction', 'account', 'bill', etc.
  entity_id TEXT NOT NULL,
  details TEXT, -- JSON with additional info
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id),
  
  -- Index for fast activity feed queries
  INDEX idx_household_activity (household_id, created_at DESC)
);

-- NEW: Resource sharing permissions
CREATE TABLE resource_permissions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('account', 'budget_category', 'savings_goal', 'debt')),
  resource_id TEXT NOT NULL,
  visibility TEXT DEFAULT 'shared' CHECK (visibility IN ('shared', 'private')),
  can_view TEXT DEFAULT 'all', -- 'all', 'specific_users', 'owner_only'
  can_edit TEXT DEFAULT 'all', -- 'all', 'specific_users', 'owner_only'
  allowed_user_ids TEXT, -- JSON array of user IDs if specific_users
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id),
  
  -- One permission record per resource
  UNIQUE(household_id, resource_type, resource_id)
);

-- NEW: Notifications and reminders system
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('bill_due', 'bill_overdue', 'budget_warning', 'budget_exceeded', 'low_balance', 'savings_milestone', 'debt_milestone', 'spending_summary', 'reminder', 'system')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT, -- URL to navigate to when clicked
  entity_type TEXT, -- 'bill', 'account', 'budget_category', etc.
  entity_id TEXT,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  is_actionable BOOLEAN DEFAULT true, -- can user take action?
  action_label TEXT, -- e.g., "Pay Bill", "View Budget"
  scheduled_for DATETIME, -- when to send (for scheduled notifications)
  sent_at DATETIME,
  read_at DATETIME,
  dismissed_at DATETIME,
  expires_at DATETIME, -- auto-dismiss after this date
  metadata TEXT, -- JSON for additional data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Index for fast queries
  INDEX idx_user_notifications (user_id, is_read, created_at DESC),
  INDEX idx_scheduled_notifications (scheduled_for, sent_at)
);

-- NEW: User notification preferences
CREATE TABLE notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  household_id TEXT,
  
  -- Bill reminders
  bill_reminder_enabled BOOLEAN DEFAULT true,
  bill_reminder_days_before INTEGER DEFAULT 3, -- remind X days before due
  bill_reminder_on_due_date BOOLEAN DEFAULT true,
  bill_overdue_reminder BOOLEAN DEFAULT true,
  
  -- Budget alerts
  budget_warning_enabled BOOLEAN DEFAULT true,
  budget_warning_threshold INTEGER DEFAULT 80, -- warn at 80% of budget
  budget_exceeded_alert BOOLEAN DEFAULT true,
  
  -- Account alerts
  low_balance_alert_enabled BOOLEAN DEFAULT true,
  low_balance_threshold DECIMAL(10,2) DEFAULT 100.00,
  
  -- Milestone notifications
  savings_milestone_enabled BOOLEAN DEFAULT true,
  debt_milestone_enabled BOOLEAN DEFAULT true,
  
  -- Summary notifications
  weekly_summary_enabled BOOLEAN DEFAULT true,
  weekly_summary_day TEXT DEFAULT 'sunday', -- day of week
  monthly_summary_enabled BOOLEAN DEFAULT true,
  monthly_summary_day INTEGER DEFAULT 1, -- day of month
  
  -- Delivery preferences
  push_notifications_enabled BOOLEAN DEFAULT true,
  email_notifications_enabled BOOLEAN DEFAULT false,
  email_address TEXT,
  quiet_hours_start TIME, -- e.g., '22:00'
  quiet_hours_end TIME, -- e.g., '07:00'
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id)
);

-- NEW: Push notification subscriptions (for PWA)
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL, -- encryption key
  auth_key TEXT NOT NULL, -- authentication key
  user_agent TEXT,
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES household_members(user_id)
);

-- User Settings and Preferences
CREATE TABLE user_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  
  -- Profile information
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  
  -- Display preferences
  timezone TEXT DEFAULT 'America/New_York',
  currency TEXT DEFAULT 'USD',
  currency_symbol TEXT DEFAULT '$',
  date_format TEXT DEFAULT 'MM/DD/YYYY' CHECK (date_format IN ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD')),
  number_format TEXT DEFAULT 'en-US' CHECK (number_format IN ('en-US', 'en-GB', 'de-DE', 'fr-FR')),
  first_day_of_week TEXT DEFAULT 'sunday' CHECK (first_day_of_week IN ('sunday', 'monday')),
  time_format TEXT DEFAULT '12h' CHECK (time_format IN ('12h', '24h')),
  
  -- Default household
  default_household_id TEXT,
  
  -- Privacy settings
  profile_visibility TEXT DEFAULT 'household' CHECK (profile_visibility IN ('public', 'household', 'private')),
  show_activity BOOLEAN DEFAULT true,
  allow_analytics BOOLEAN DEFAULT true,
  
  -- Accessibility
  reduce_motion BOOLEAN DEFAULT false,
  high_contrast BOOLEAN DEFAULT false,
  text_size TEXT DEFAULT 'medium' CHECK (text_size IN ('small', 'medium', 'large', 'x-large')),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES household_members(user_id),
  FOREIGN KEY (default_household_id) REFERENCES households(id)
);

-- Active user sessions (for device management)
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  device_name TEXT,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  browser TEXT,
  ip_address TEXT,
  user_agent TEXT,
  is_current BOOLEAN DEFAULT false,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES household_members(user_id),
  INDEX idx_user_sessions_user (user_id, last_active_at DESC)
);

-- User data export requests (GDPR compliance)
CREATE TABLE data_export_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  export_format TEXT DEFAULT 'json' CHECK (export_format IN ('json', 'csv', 'zip')),
  file_url TEXT,
  file_size INTEGER, -- in bytes
  expires_at DATETIME, -- export files expire after 7 days
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES household_members(user_id)
);

-- Account deletion requests (soft delete with grace period)
CREATE TABLE account_deletion_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reason TEXT,
  scheduled_deletion_date DATETIME NOT NULL, -- 30 days from request
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'completed')),
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  cancelled_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES household_members(user_id)
);
```

---

## 👤 User Settings & Profile Management

### Overview
Comprehensive user profile and settings management system that allows users to customize their experience, manage their account, handle privacy settings, and export their data.

### Core User Settings Functions

```typescript
// Get user settings
export const getUserSettings = async (userId: string) => {
  const settings = await db
    .select()
    .from(user_settings)
    .where(eq(user_settings.user_id, userId))
    .limit(1);
  
  if (settings.length === 0) {
    // Create default settings if they don't exist
    return await createDefaultUserSettings(userId);
  }
  
  return settings[0];
};

// Create default settings for new user
export const createDefaultUserSettings = async (userId: string) => {
  const [settings] = await db
    .insert(user_settings)
    .values({
      id: generateId(),
      user_id: userId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Auto-detect
      currency: 'USD',
      currency_symbol: '$',
      date_format: 'MM/DD/YYYY',
      number_format: 'en-US',
      first_day_of_week: 'sunday',
      time_format: '12h'
    })
    .returning();
  
  return settings;
};

// Update user profile
export const updateUserProfile = async (
  userId: string,
  updates: {
    display_name?: string;
    avatar_url?: string;
    bio?: string;
  }
) => {
  const [updated] = await db
    .update(user_settings)
    .set({
      ...updates,
      updated_at: new Date()
    })
    .where(eq(user_settings.user_id, userId))
    .returning();
  
  return updated;
};

// Update display preferences
export const updateDisplayPreferences = async (
  userId: string,
  preferences: {
    timezone?: string;
    currency?: string;
    currency_symbol?: string;
    date_format?: string;
    number_format?: string;
    first_day_of_week?: string;
    time_format?: string;
  }
) => {
  const [updated] = await db
    .update(user_settings)
    .set({
      ...preferences,
      updated_at: new Date()
    })
    .where(eq(user_settings.user_id, userId))
    .returning();
  
  return updated;
};

// Update privacy settings
export const updatePrivacySettings = async (
  userId: string,
  privacy: {
    profile_visibility?: 'public' | 'household' | 'private';
    show_activity?: boolean;
    allow_analytics?: boolean;
  }
) => {
  const [updated] = await db
    .update(user_settings)
    .set({
      ...privacy,
      updated_at: new Date()
    })
    .where(eq(user_settings.user_id, userId))
    .returning();
  
  return updated;
};

// Update accessibility settings
export const updateAccessibilitySettings = async (
  userId: string,
  accessibility: {
    reduce_motion?: boolean;
    high_contrast?: boolean;
    text_size?: 'small' | 'medium' | 'large' | 'x-large';
  }
) => {
  const [updated] = await db
    .update(user_settings)
    .set({
      ...accessibility,
      updated_at: new Date()
    })
    .where(eq(user_settings.user_id, userId))
    .returning();
  
  return updated;
};

// Get user active sessions
export const getUserSessions = async (userId: string) => {
  const sessions = await db
    .select()
    .from(user_sessions)
    .where(eq(user_sessions.user_id, userId))
    .orderBy(desc(user_sessions.last_active_at));
  
  return sessions;
};

// Revoke session (logout from device)
export const revokeSession = async (sessionId: string, userId: string) => {
  await db
    .delete(user_sessions)
    .where(and(
      eq(user_sessions.id, sessionId),
      eq(user_sessions.user_id, userId)
    ));
};

// Revoke all other sessions (logout from all other devices)
export const revokeAllOtherSessions = async (userId: string, currentSessionId: string) => {
  await db
    .delete(user_sessions)
    .where(and(
      eq(user_sessions.user_id, userId),
      ne(user_sessions.id, currentSessionId)
    ));
};

// Request data export (GDPR)
export const requestDataExport = async (
  userId: string,
  format: 'json' | 'csv' | 'zip' = 'json'
) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Export available for 7 days
  
  const [exportRequest] = await db
    .insert(data_export_requests)
    .values({
      id: generateId(),
      user_id: userId,
      status: 'pending',
      export_format: format,
      expires_at: expiresAt
    })
    .returning();
  
  // Trigger background job to generate export
  await generateDataExport(exportRequest.id);
  
  return exportRequest;
};

// Generate data export (background job)
export const generateDataExport = async (exportId: string) => {
  const exportRequest = await db
    .select()
    .from(data_export_requests)
    .where(eq(data_export_requests.id, exportId))
    .limit(1);
  
  if (exportRequest.length === 0) return;
  
  const request = exportRequest[0];
  
  try {
    // Update status to processing
    await db
      .update(data_export_requests)
      .set({ status: 'processing' })
      .where(eq(data_export_requests.id, exportId));
    
    // Gather all user data
    const userData = await gatherAllUserData(request.user_id);
    
    // Generate export file
    const fileUrl = await createExportFile(userData, request.export_format);
    const fileSize = await getFileSize(fileUrl);
    
    // Update with completed status
    await db
      .update(data_export_requests)
      .set({
        status: 'completed',
        file_url: fileUrl,
        file_size: fileSize,
        completed_at: new Date()
      })
      .where(eq(data_export_requests.id, exportId));
    
    // Notify user
    await createNotification(request.user_id, null, {
      type: 'system',
      title: 'Data Export Ready',
      message: 'Your data export is ready for download',
      action_url: `/settings/data-export/${exportId}`
    });
  } catch (error) {
    // Update with failed status
    await db
      .update(data_export_requests)
      .set({ status: 'failed' })
      .where(eq(data_export_requests.id, exportId));
  }
};

// Gather all user data for export
const gatherAllUserData = async (userId: string) => {
  // Collect all user data from all tables
  const [
    accounts,
    transactions,
    budgetCategories,
    bills,
    savingsGoals,
    debts,
    households,
    notifications,
    settings
  ] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.user_id, userId)),
    db.select().from(transactions).where(eq(transactions.user_id, userId)),
    db.select().from(budget_categories).where(eq(budget_categories.user_id, userId)),
    db.select().from(bills).where(eq(bills.user_id, userId)),
    db.select().from(savings_goals).where(eq(savings_goals.user_id, userId)),
    db.select().from(debts).where(eq(debts.user_id, userId)),
    // Get households where user is a member
    db
      .select()
      .from(household_members)
      .where(eq(household_members.user_id, userId)),
    db.select().from(notifications).where(eq(notifications.user_id, userId)),
    db.select().from(user_settings).where(eq(user_settings.user_id, userId))
  ]);
  
  return {
    user_id: userId,
    export_date: new Date().toISOString(),
    accounts,
    transactions,
    budget_categories: budgetCategories,
    bills,
    savings_goals: savingsGoals,
    debts,
    households,
    notifications,
    settings
  };
};

// Request account deletion
export const requestAccountDeletion = async (
  userId: string,
  reason?: string
) => {
  // Check if user owns any households
  const ownedHouseholds = await db
    .select()
    .from(household_members)
    .where(and(
      eq(household_members.user_id, userId),
      eq(household_members.role, 'owner')
    ));
  
  if (ownedHouseholds.length > 0) {
    throw new Error(
      'You must transfer ownership or delete your households before deleting your account'
    );
  }
  
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 30); // 30-day grace period
  
  const [deletionRequest] = await db
    .insert(account_deletion_requests)
    .values({
      id: generateId(),
      user_id: userId,
      reason,
      scheduled_deletion_date: scheduledDate,
      status: 'pending'
    })
    .returning();
  
  // Notify user
  await createNotification(userId, null, {
    type: 'system',
    priority: 'high',
    title: 'Account Deletion Scheduled',
    message: `Your account will be deleted on ${scheduledDate.toLocaleDateString()}. You can cancel this anytime before then.`,
    action_url: '/settings/account'
  });
  
  return deletionRequest;
};

// Cancel account deletion
export const cancelAccountDeletion = async (userId: string) => {
  const [cancelled] = await db
    .update(account_deletion_requests)
    .set({
      status: 'cancelled',
      cancelled_at: new Date()
    })
    .where(and(
      eq(account_deletion_requests.user_id, userId),
      eq(account_deletion_requests.status, 'pending')
    ))
    .returning();
  
  if (cancelled) {
    await createNotification(userId, null, {
      type: 'system',
      title: 'Account Deletion Cancelled',
      message: 'Your account deletion has been cancelled. Your account is safe.',
      action_url: '/settings/account'
    });
  }
  
  return cancelled;
};

// Execute account deletion (cron job)
export const executeScheduledDeletions = async () => {
  const now = new Date();
  
  const pendingDeletions = await db
    .select()
    .from(account_deletion_requests)
    .where(and(
      eq(account_deletion_requests.status, 'pending'),
      lte(account_deletion_requests.scheduled_deletion_date, now)
    ));
  
  for (const deletion of pendingDeletions) {
    await deleteUserAccount(deletion.user_id);
    
    await db
      .update(account_deletion_requests)
      .set({
        status: 'completed',
        completed_at: new Date()
      })
      .where(eq(account_deletion_requests.id, deletion.id));
  }
};

// Permanently delete user account
const deleteUserAccount = async (userId: string) => {
  // Delete all user data (cascading deletes via foreign keys)
  await db.transaction(async (tx) => {
    // Remove from all households
    await tx.delete(household_members).where(eq(household_members.user_id, userId));
    
    // Delete user-specific data
    await tx.delete(transactions).where(eq(transactions.user_id, userId));
    await tx.delete(accounts).where(eq(accounts.user_id, userId));
    await tx.delete(bills).where(eq(bills.user_id, userId));
    await tx.delete(savings_goals).where(eq(savings_goals.user_id, userId));
    await tx.delete(debts).where(eq(debts.user_id, userId));
    await tx.delete(budget_categories).where(eq(budget_categories.user_id, userId));
    await tx.delete(notifications).where(eq(notifications.user_id, userId));
    await tx.delete(user_settings).where(eq(user_settings.user_id, userId));
    await tx.delete(user_sessions).where(eq(user_sessions.user_id, userId));
  });
};
```

### UI Components for Settings

```tsx
// Main Settings Page
const SettingsPage = ({ userId }) => {
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await getUserSettings(userId);
    setSettings(data);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Display</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings userId={userId} settings={settings} onUpdate={loadSettings} />
        </TabsContent>

        <TabsContent value="preferences">
          <DisplayPreferences userId={userId} settings={settings} onUpdate={loadSettings} />
        </TabsContent>

        <TabsContent value="privacy">
          <PrivacySettings userId={userId} settings={settings} onUpdate={loadSettings} />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettings userId={userId} />
        </TabsContent>

        <TabsContent value="account">
          <AccountSettings userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Profile Settings Component
const ProfileSettings = ({ userId, settings, onUpdate }) => {
  const [displayName, setDisplayName] = useState(settings?.display_name || '');
  const [bio, setBio] = useState(settings?.bio || '');
  const [isUploading, setIsUploading] = useState(false);

  const handleSave = async () => {
    await updateUserProfile(userId, {
      display_name: displayName,
      bio
    });
    toast.success('Profile updated successfully');
    onUpdate();
  };

  const handleAvatarUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const avatarUrl = await uploadAvatar(file);
      await updateUserProfile(userId, { avatar_url: avatarUrl });
      toast.success('Avatar updated');
      onUpdate();
    } catch (error) {
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your public profile information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="w-20 h-20">
              <AvatarImage src={settings?.avatar_url} />
              <AvatarFallback>{displayName?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 p-1 bg-white rounded-full cursor-pointer hover:bg-gray-100">
              <CameraIcon className="w-4 h-4 text-black" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
              />
            </label>
          </div>
          <div className="flex-1">
            <p className="font-medium text-white">Profile Picture</p>
            <p className="text-sm text-gray-400">
              JPG, PNG or GIF. Max 5MB.
            </p>
          </div>
        </div>

        <div>
          <Label>Display Name</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            className="mt-1"
          />
        </div>

        <div>
          <Label>Bio (Optional)</Label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself"
            rows={3}
            className="mt-1"
          />
        </div>

        <Button onClick={handleSave}>Save Changes</Button>
      </CardContent>
    </Card>
  );
};

// Display Preferences Component
const DisplayPreferences = ({ userId, settings, onUpdate }) => {
  const [preferences, setPreferences] = useState({
    timezone: settings?.timezone || 'America/New_York',
    currency: settings?.currency || 'USD',
    currency_symbol: settings?.currency_symbol || '$',
    date_format: settings?.date_format || 'MM/DD/YYYY',
    number_format: settings?.number_format || 'en-US',
    first_day_of_week: settings?.first_day_of_week || 'sunday',
    time_format: settings?.time_format || '12h'
  });

  const handleSave = async () => {
    await updateDisplayPreferences(userId, preferences);
    toast.success('Preferences updated');
    onUpdate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Display Preferences</CardTitle>
        <CardDescription>Customize how data is displayed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Timezone</Label>
          <Select
            value={preferences.timezone}
            onValueChange={(v) => setPreferences({ ...preferences, timezone: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/New_York">Eastern Time</SelectItem>
              <SelectItem value="America/Chicago">Central Time</SelectItem>
              <SelectItem value="America/Denver">Mountain Time</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
              <SelectItem value="Europe/London">London</SelectItem>
              <SelectItem value="Europe/Paris">Paris</SelectItem>
              <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Currency</Label>
            <Select
              value={preferences.currency}
              onValueChange={(v) => setPreferences({ ...preferences, currency: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="CAD">CAD ($)</SelectItem>
                <SelectItem value="JPY">JPY (¥)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Date Format</Label>
            <Select
              value={preferences.date_format}
              onValueChange={(v) => setPreferences({ ...preferences, date_format: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Number Format</Label>
            <Select
              value={preferences.number_format}
              onValueChange={(v) => setPreferences({ ...preferences, number_format: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">1,000.00 (US)</SelectItem>
                <SelectItem value="de-DE">1.000,00 (Europe)</SelectItem>
                <SelectItem value="en-GB">1,000.00 (UK)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Time Format</Label>
            <Select
              value={preferences.time_format}
              onValueChange={(v) => setPreferences({ ...preferences, time_format: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>First Day of Week</Label>
          <Select
            value={preferences.first_day_of_week}
            onValueChange={(v) => setPreferences({ ...preferences, first_day_of_week: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sunday">Sunday</SelectItem>
              <SelectItem value="monday">Monday</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave}>Save Preferences</Button>
      </CardContent>
    </Card>
  );
};

// Security Settings Component
const SecuritySettings = ({ userId }) => {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const data = await getUserSessions(userId);
    setSessions(data);
  };

  const handleRevokeSession = async (sessionId: string) => {
    await revokeSession(sessionId, userId);
    toast.success('Session revoked');
    loadSessions();
  };

  const handleRevokeAll = async () => {
    const currentSessionId = sessions.find(s => s.is_current)?.id;
    if (currentSessionId) {
      await revokeAllOtherSessions(userId, currentSessionId);
      toast.success('All other sessions logged out');
      loadSessions();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Password & Authentication</CardTitle>
          <CardDescription>Managed by Clerk</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 mb-4">
            Password, two-factor authentication, and social logins are managed through Clerk.
          </p>
          <Button variant="outline" asChild>
            <a href="https://accounts.clerk.dev" target="_blank" rel="noopener">
              Manage Authentication →
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Devices where you're currently logged in</CardDescription>
            </div>
            {sessions.length > 1 && (
              <Button variant="outline" size="sm" onClick={handleRevokeAll}>
                Logout All Others
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-start justify-between p-4 bg-surface rounded-lg border border-border"
            >
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  {session.device_type === 'mobile' ? (
                    <SmartphoneIcon className="w-5 h-5 text-blue-400" />
                  ) : (
                    <MonitorIcon className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">
                      {session.device_name || session.browser || 'Unknown Device'}
                    </p>
                    {session.is_current && (
                      <Badge variant="outline" className="text-xs">Current</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{session.ip_address}</p>
                  <p className="text-xs text-gray-500">
                    Last active {formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              {!session.is_current && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevokeSession(session.id)}
                >
                  Logout
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

// Account Settings Component
const AccountSettings = ({ userId }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  const handleExportData = async () => {
    await requestDataExport(userId, 'json');
    toast.success('Data export requested. You\'ll be notified when it\'s ready.');
  };

  const handleDeleteAccount = async () => {
    try {
      await requestAccountDeletion(userId, deleteReason);
      toast.success('Account deletion scheduled. You have 30 days to cancel.');
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
          <CardDescription>Download a copy of your data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 mb-4">
            Export all your financial data in JSON format. This includes transactions, accounts, bills, budgets, and more.
          </p>
          <Button onClick={handleExportData}>
            <DownloadIcon className="w-4 h-4 mr-2" />
            Request Data Export
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-white mb-2">Delete Account</h4>
            <p className="text-sm text-gray-400 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone, but you'll have a 30-day grace period to cancel.
            </p>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {showDeleteConfirm && (
        <Dialog open onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-400">Delete Account</DialogTitle>
              <DialogDescription>
                This action will permanently delete your account after 30 days. You can cancel anytime before then.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <h4 className="font-medium text-red-400 mb-2">What will be deleted:</h4>
                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                  <li>All your transactions and financial data</li>
                  <li>All accounts, budgets, and bills</li>
                  <li>All household memberships (if not owner)</li>
                  <li>All notifications and settings</li>
                </ul>
              </div>

              <div>
                <Label>Reason for leaving (optional)</Label>
                <Textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Help us improve..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <p className="text-sm text-yellow-400">
                ⚠️ Note: You must transfer ownership or delete any households you own before deleting your account.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteAccount}>
                Schedule Deletion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
```

---

## 📱 Mobile-First UI/UX Design - Transaction-Focused

### Core Design Philosophy
**Transaction Entry First** - The application is designed around making transaction entry as fast and frictionless as possible. Users should be able to log a transaction in under 10 seconds with minimal taps.

### Ease of Use Focus Areas:
- **Single-Screen Entry** - All transaction details entered on one screen, no navigation required
- **Smart Auto-Complete** - App learns your patterns and suggests merchants, amounts, and categories
- **One-Tap Templates** - Coffee, gas, groceries accessible in a single tap
- **Gesture Controls** - Swipe to adjust amounts, long-press to duplicate transactions  
- **Voice Input** - Hands-free entry while driving or shopping
- **Contextual Intelligence** - Morning suggestions different from evening suggestions
- **Instant Feedback** - See budget impact immediately, no separate budget check required
- **Minimal Navigation** - 3-tab bottom navigation, everything else in quick-access sheets

### Primary Interface: Quick Entry Dashboard

#### Main Dashboard Layout
- **Floating Action Button** - Large, prominent "+" button for instant transaction entry
- **Quick Entry Bar** - Always visible at top with amount input and category suggestions
- **Recent Transactions** - Live feed of recent entries for context and quick editing
- **Account Balance Strip** - Horizontal scroll of account balances for quick reference
- **Smart Suggestions** - Context-aware transaction suggestions based on time, location, and history

#### Transaction Entry Flow (Single Screen)
```tsx
// Primary transaction entry interface - all on one screen
<div className="transaction-entry-dashboard">
  {/* Quick Entry Bar - Always Visible */}
  <div className="quick-entry-bar sticky top-0 bg-background border-b p-4">
    <div className="flex gap-2">
      <Input 
        type="number" 
        placeholder="$0.00" 
        className="text-2xl font-bold text-center"
        autoFocus
        onFocus={(e) => e.target.select()}
      />
      <Button size="lg" className="px-8">Add</Button>
    </div>
    
    {/* Smart Category Suggestions */}
    <div className="flex gap-2 mt-2 overflow-x-auto">
      {suggestedCategories.map(cat => (
        <Badge key={cat} variant="outline" className="cursor-pointer">
          {cat}
        </Badge>
      ))}
    </div>
  </div>

  {/* Account Quick Select */}
  <div className="account-strip flex gap-3 p-4 overflow-x-auto">
    {accounts.map(account => (
      <div 
        key={account.id}
        className={`account-chip ${selectedAccount === account.id ? 'selected' : ''}`}
        onClick={() => setSelectedAccount(account.id)}
      >
        <div className="font-medium text-sm">{account.name}</div>
        <div className="text-xs text-muted-foreground">
          ${account.balance.toLocaleString()}
        </div>
      </div>
    ))}
  </div>

  {/* Recent Transactions with Quick Actions */}
  <div className="recent-transactions flex-1 p-4">
    <h3 className="font-semibold mb-3">Recent Transactions</h3>
    {recentTransactions.map(transaction => (
      <div key={transaction.id} className="transaction-item">
        <div className="flex justify-between items-center p-3 border rounded-lg mb-2">
          <div>
            <div className="font-medium">{transaction.description}</div>
            <div className="text-sm text-muted-foreground">
              {transaction.category} • {transaction.account}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold">${transaction.amount}</div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => duplicateTransaction(transaction)}
            >
              Repeat
            </Button>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
```

### Smart Transaction Entry Features

#### 1. Predictive Input System with Bill Detection
```tsx
// Enhanced auto-complete with bill matching
const SmartTransactionEntry = () => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [possibleBillMatch, setPossibleBillMatch] = useState(null);

  // Real-time suggestions and bill matching
  useEffect(() => {
    if (amount && description) {
      // Check for possible bill matches
      const billMatch = findMatchingBill({
        amount: parseFloat(amount),
        description,
        currentDate: new Date()
      });
      
      setPossibleBillMatch(billMatch);

      // Generate contextual suggestions
      const contextSuggestions = generateSmartSuggestions({
        amount: parseFloat(amount),
        description,
        timeOfDay: new Date().getHours(),
        recentTransactions,
        upcomingBills: billMatch ? [billMatch] : []
      });
      
      setSuggestions(contextSuggestions);
    }
  }, [amount, description]);

  return (
    <div className="smart-entry">
      {/* Amount Input */}
      <Input
        type="tel"
        value={amount}
        onChange={(e) => setAmount(formatCurrencyInput(e.target.value))}
        placeholder="$0.00"
        className="text-3xl text-center font-bold"
      />

      {/* Description Input */}
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What did you pay for?"
        className="mt-2"
      />

      {/* Bill Match Alert */}
      {possibleBillMatch && (
        <Alert className="mt-3 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            This looks like your <strong>{possibleBillMatch.name}</strong> bill 
            (Due: {format(possibleBillMatch.dueDate, 'MMM d')}, 
            Expected: ${possibleBillMatch.expectedAmount})
            <div className="mt-2">
              <Button 
                size="sm" 
                onClick={() => confirmBillPayment(possibleBillMatch)}
                className="mr-2"
              >
                Mark Bill Paid
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPossibleBillMatch(null)}
              >
                Not This Bill
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Smart Suggestions Grid */}
      <div className="suggestions-grid grid grid-cols-2 gap-2 mt-4">
        {suggestions.map((suggestion, index) => (
          <Button
            key={index}
            variant="outline"
            className="text-left p-4 h-auto"
            onClick={() => applyQuickSuggestion(suggestion)}
          >
            <div>
              <div className="font-medium">{suggestion.description}</div>
              <div className="text-sm text-muted-foreground">
                {suggestion.category} • {suggestion.account}
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};

// Bill matching algorithm
const findMatchingBill = ({ amount, description, currentDate }) => {
  const upcomingBills = getUpcomingAndOverdueBills(currentDate);
  
  return upcomingBills.find(bill => {
    // Check amount tolerance
    const amountMatch = Math.abs(amount - bill.expectedAmount) <= bill.amountTolerance;
    
    // Check description patterns
    const descriptionMatch = bill.payeePatterns.some(pattern => 
      description.toLowerCase().includes(pattern.toLowerCase())
    );
    
    // Check if bill is due within reasonable timeframe (30 days before or after due date)
    const dueDate = new Date(bill.dueDate);
    const daysDifference = Math.abs((currentDate - dueDate) / (1000 * 60 * 60 * 24));
    const timeFrameMatch = daysDifference <= 30;
    
    return (amountMatch || bill.isVariableAmount) && 
           (descriptionMatch || description.toLowerCase().includes(bill.name.toLowerCase())) && 
           timeFrameMatch;
  });
};
```

#### 2. Bill Dashboard & Management
```tsx
const BillsOverviewCard = () => {
  const [bills, setBills] = useState([]);
  const [overdueBills, setOverdueBills] = useState([]);
  const [upcomingBills, setUpcomingBills] = useState([]);

  useEffect(() => {
    loadBillStatus();
  }, []);

  return (
    <Card className="bill-overview">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Bills & Payments</span>
          <Badge variant={overdueBills.length > 0 ? 'destructive' : 'default'}>
            {overdueBills.length} overdue
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overdue Bills - Always Show First */}
        {overdueBills.length > 0 && (
          <div className="overdue-section">
            <h4 className="font-medium text-red-600 mb-2">Overdue Bills</h4>
            {overdueBills.map(bill => (
              <div key={bill.id} className="bill-item overdue bg-red-50 border-red-200 rounded-lg p-3 mb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-red-800">{bill.name}</div>
                    <div className="text-sm text-red-600">
                      Due {format(bill.dueDate, 'MMM d')} • {bill.daysLate} days late
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-800">${bill.expectedAmount}</div>
                    <div className="space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => payBillNow(bill)}
                      >
                        Pay Now
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => markBillPaid(bill)}
                      >
                        Mark Paid
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming Bills */}
        <div className="upcoming-section">
          <h4 className="font-medium mb-2">Due Soon</h4>
          {upcomingBills.slice(0, 5).map(bill => (
            <div key={bill.id} className="bill-item upcoming flex justify-between items-center py-2 border-b">
              <div>
                <div className="font-medium">{bill.name}</div>
                <div className="text-sm text-muted-foreground">
                  Due {format(bill.dueDate, 'MMM d')}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">${bill.expectedAmount}</div>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => openPayBillModal(bill)}
                >
                  Pay
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openBillSetup()}>
            Add Bill
          </Button>
          <Button variant="outline" size="sm" onClick={() => openBillHistory()}>
            Payment History
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

#### 3. Automatic Bill Payment Detection
```tsx
// Automatic bill payment processing
const AutoBillPaymentDetection = () => {
  const processTransaction = async (transaction) => {
    try {
      // Save the transaction first
      const savedTransaction = await saveTransaction(transaction);
      
      // Check if this transaction matches any pending bills
      const matchingBill = await findMatchingBill({
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.date,
        account: transaction.accountId
      });

      if (matchingBill && matchingBill.autoMarkPaid) {
        // Automatically mark the bill as paid
        await markBillPaid({
          billInstanceId: matchingBill.instanceId,
          transactionId: savedTransaction.id,
          actualAmount: transaction.amount,
          paidDate: transaction.date,
          isAutomatic: true
        });

        // Link the transaction to the bill
        await linkTransactionToBill(savedTransaction.id, matchingBill.instanceId);

        // Show confirmation to user
        showNotification({
          type: 'success',
          title: 'Bill Automatically Marked Paid',
          message: `${matchingBill.name} has been marked as paid`,
          action: {
            label: 'Undo',
            onClick: () => undoBillPayment(matchingBill.instanceId, savedTransaction.id)
          }
        });
      }

      return { transaction: savedTransaction, billMatched: !!matchingBill };
    } catch (error) {
      console.error('Error processing transaction:', error);
      throw error;
    }
  };

  return { processTransaction };
};

// Bill matching with enhanced logic
const findMatchingBill = async ({ amount, description, date, account }) => {
  const pendingBills = await getBillInstancesByStatus('pending', {
    includeOverdue: true,
    userId: getCurrentUserId()
  });

  // Score each bill for match likelihood
  const scoredBills = pendingBills.map(bill => {
    let score = 0;
    
    // Amount matching (weighted heavily)
    if (bill.isVariableAmount) {
      score += 30; // Variable bills get base points for amount
    } else if (Math.abs(amount - bill.expectedAmount) <= bill.amountTolerance) {
      score += 50; // Exact amount match
    } else if (Math.abs(amount - bill.expectedAmount) <= bill.expectedAmount * 0.1) {
      score += 30; // Within 10% of expected amount
    }
    
    // Description/payee matching
    bill.payeePatterns?.forEach(pattern => {
      if (description.toLowerCase().includes(pattern.toLowerCase())) {
        score += 40;
      }
    });
    
    // Bill name matching
    if (description.toLowerCase().includes(bill.name.toLowerCase())) {
      score += 30;
    }
    
    // Date proximity to due date
    const daysDifference = Math.abs((new Date(date) - new Date(bill.dueDate)) / (1000 * 60 * 60 * 24));
    if (daysDifference <= 7) score += 20;
    else if (daysDifference <= 30) score += 10;
    
    // Account preference matching
    if (account === bill.accountId) {
      score += 15;
    }
    
    return { ...bill, matchScore: score };
  });

  // Return the highest scoring bill if it meets minimum threshold
  const bestMatch = scoredBills.sort((a, b) => b.matchScore - a.matchScore)[0];
  return bestMatch?.matchScore >= 60 ? bestMatch : null;
};
```

#### 4. Manual Bill Management
```tsx
const BillManagementInterface = () => {
  const [bills, setBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);

  return (
    <div className="bill-management">
      {/* Bill Setup Form */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Add New Bill</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input placeholder="Bill name" />
            <Input type="number" placeholder="Expected amount" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Due day of month" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({length: 31}, (_, i) => (
                  <SelectItem key={i+1} value={String(i+1)}>{i+1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Payment account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Payee patterns (for auto-detection)</label>
            <Input 
              placeholder="e.g., 'Electric Company', 'UTIL-ELECTRIC'" 
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Add merchant names or partial text that appears on your bank statement
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="variable-amount" />
            <label htmlFor="variable-amount" className="text-sm">
              Variable amount (utilities, credit cards)
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="auto-mark" defaultChecked />
            <label htmlFor="auto-mark" className="text-sm">
              Automatically mark paid when matching transaction is entered
            </label>
          </div>

          <Button className="w-full">Add Bill</Button>
        </CardContent>
      </Card>

      {/* Existing Bills List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Bills</CardTitle>
        </CardHeader>
        <CardContent>
          {bills.map(bill => (
            <div key={bill.id} className="bill-entry flex justify-between items-center py-3 border-b">
              <div>
                <div className="font-medium">{bill.name}</div>
                <div className="text-sm text-muted-foreground">
                  Due {bill.dueDate}th • ${bill.expectedAmount} • {bill.accountName}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" onClick={() => editBill(bill)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleBillActive(bill)}>
                  {bill.isActive ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
```

#### 2. One-Tap Transaction Templates
```tsx
// Quick transaction templates for common expenses
const QuickTemplates = () => {
  const commonTransactions = [
    { name: 'Coffee', amount: 5.50, category: 'Food & Dining', emoji: '☕' },
    { name: 'Gas', amount: 45.00, category: 'Transportation', emoji: '⛽' },
    { name: 'Grocery', amount: 85.00, category: 'Groceries', emoji: '🛒' },
    { name: 'Parking', amount: 2.00, category: 'Transportation', emoji: '🅿️' }
  ];

  return (
    <div className="quick-templates">
      <h3 className="font-semibold mb-3">Quick Add</h3>
      <div className="grid grid-cols-2 gap-3">
        {commonTransactions.map((template, index) => (
          <Button
            key={index}
            variant="outline"
            className="p-4 h-auto"
            onClick={() => addQuickTransaction(template)}
          >
            <div className="text-center">
              <div className="text-2xl mb-1">{template.emoji}</div>
              <div className="font-medium">{template.name}</div>
              <div className="text-sm text-muted-foreground">
                ${template.amount}
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};
```

#### 3. Voice-to-Text Entry (Optional)
```tsx
// Voice input for hands-free transaction entry
const VoiceTransactionEntry = () => {
  const [isListening, setIsListening] = useState(false);
  
  const startVoiceEntry = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        parseVoiceTransaction(transcript);
      };
      
      recognition.start();
    }
  };

  return (
    <Button
      variant={isListening ? "default" : "outline"}
      onClick={startVoiceEntry}
      className="flex items-center gap-2"
    >
      <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
      {isListening ? 'Listening...' : 'Voice Entry'}
    </Button>
  );
};
```

### Simplified Navigation Structure

#### Bottom Tab Navigation (3 Main Screens Only)
1. **Transactions** (Primary) - Transaction entry and recent history
2. **Accounts** - Account balances and quick transfers  
3. **Budget** - Budget overview and goals

#### No Deep Menu Hierarchies
- **Quick Actions Sheet** - Slide-up panel for less common actions
- **Account Switching** - Horizontal swipe between accounts
- **Category Management** - Inline editing within transaction entry
- **Settings** - Single settings screen accessible from profile

### Bulk Entry Features

#### Photo Receipt Scanning (Future Enhancement)
```tsx
// Receipt photo processing for bulk entry
const ReceiptScanner = () => {
  return (
    <Button
      variant="outline"
      onClick={() => openCamera()}
      className="flex items-center gap-2"
    >
      <Camera className="h-4 w-4" />
      Scan Receipt
    </Button>
  );
};
```

#### CSV Import for Bank Statement Processing
```tsx
// Bank statement import and categorization
const BankStatementImport = () => {
  return (
    <div className="import-section">
      <Button
        variant="outline"
        onClick={() => triggerFileInput()}
        className="w-full"
      >
        <Upload className="h-4 w-4 mr-2" />
        Import Bank Statement
      </Button>
      
      {/* Auto-categorization suggestions for imported transactions */}
      {importedTransactions.map(transaction => (
        <div key={transaction.id} className="import-item">
          <div className="transaction-details">
            <span>{transaction.description}</span>
            <span>${transaction.amount}</span>
          </div>
          <Select
            value={transaction.suggestedCategory}
            onValueChange={(category) => updateTransactionCategory(transaction.id, category)}
          >
            {/* Category options */}
          </Select>
        </div>
      ))}
    </div>
  );
};
```

### Mobile Gestures & Speed Shortcuts

#### Gesture Controls for Lightning-Fast Entry
```tsx
// Gesture-based transaction entry
const GestureTransactionEntry = () => {
  const [gestureAmount, setGestureAmount] = useState(0);
  
  const handleSwipeGestures = {
    // Swipe up on amount = add $5 (for quick coffee/snack amounts)
    swipeUp: () => setGestureAmount(prev => prev + 5),
    
    // Swipe down = subtract $5
    swipeDown: () => setGestureAmount(prev => Math.max(0, prev - 5)),
    
    // Long press on recent transaction = duplicate instantly
    longPress: (transaction) => duplicateTransactionInstantly(transaction),
    
    // Double tap on account chip = quick transfer to default account
    doubleTap: (account) => initiateQuickTransfer(account),
    
    // Swipe left on transaction = mark as recurring
    swipeLeft: (transaction) => markAsRecurring(transaction),
    
    // Swipe right on transaction = duplicate for today
    swipeRight: (transaction) => duplicateForToday(transaction)
  };

  return (
    <div className="gesture-enabled-entry">
      {/* Amount input with gesture controls */}
      <div 
        className="amount-input-gesture"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Input
          type="number"
          value={gestureAmount}
          className="text-4xl text-center font-bold"
          placeholder="Swipe ↑↓ to adjust"
        />
        <div className="gesture-hint text-xs text-muted-foreground text-center mt-1">
          Swipe up/down to adjust by $5
        </div>
      </div>
    </div>
  );
};
```

#### Keyboard Shortcuts for Power Users
```tsx
// Keyboard shortcuts when external keyboard connected (iPad/Android tablets)
const KeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyboard = (e) => {
      // Ctrl/Cmd + N = New transaction
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openQuickEntry();
      }
      
      // Ctrl/Cmd + T = Quick transfer
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        openQuickTransfer();
      }
      
      // Ctrl/Cmd + D = Duplicate last transaction
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateLastTransaction();
      }
      
      // Number keys 1-9 = Quick category selection
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey) {
        const categoryIndex = parseInt(e.key) - 1;
        selectQuickCategory(categoryIndex);
      }
      
      // Enter = Save transaction
      if (e.key === 'Enter' && canSaveTransaction()) {
        e.preventDefault();
        saveCurrentTransaction();
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, []);
};
```

#### Haptic Feedback for Transaction Confirmation
```tsx
// Haptic feedback on mobile for instant confirmation
const HapticConfirmation = () => {
  const triggerHaptic = (type) => {
    if ('vibrate' in navigator) {
      switch(type) {
        case 'success':
          navigator.vibrate([50, 10, 50]); // Double pulse for successful save
          break;
        case 'error':
          navigator.vibrate([100, 50, 100, 50, 100]); // Error pattern
          break;
        case 'tap':
          navigator.vibrate(10); // Light tap for button presses
          break;
      }
    }
  };

  const saveWithConfirmation = async (transaction) => {
    try {
      await saveTransaction(transaction);
      triggerHaptic('success');
      showToast('Transaction saved!');
    } catch (error) {
      triggerHaptic('error');
      showToast('Error saving transaction');
    }
  };
};
```

---

## ⚙️ Core Business Logic

### Transfer System Implementation

```typescript
interface TransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description: string;
  date: string;
}

async function createLinkedTransfer(transferData: TransferRequest) {
  return await db.transaction(async (tx) => {
    // Create the transfer record
    const transfer = await tx.insert(transfers).values({
      ...transferData,
      status: 'completed'
    }).returning();

    // Create outgoing transaction
    const outgoingTransaction = await tx.insert(transactions).values({
      accountId: transferData.fromAccountId,
      amount: -Math.abs(transferData.amount),
      description: `Transfer to ${await getAccountName(transferData.toAccountId)}`,
      date: transferData.date,
      type: 'transfer_out',
      transferId: transfer[0].id,
    }).returning();

    // Create incoming transaction
    const incomingTransaction = await tx.insert(transactions).values({
      accountId: transferData.toAccountId,
      amount: Math.abs(transferData.amount),
      description: `Transfer from ${await getAccountName(transferData.fromAccountId)}`,
      date: transferData.date,
      type: 'transfer_in',
      transferId: transfer[0].id,
    }).returning();

    // Link transactions to transfer
    await tx.update(transfers)
      .set({
        fromTransactionId: outgoingTransaction[0].id,
        toTransactionId: incomingTransaction[0].id
      })
      .where(eq(transfers.id, transfer[0].id));

    // Update account balances
    await Promise.all([
      updateAccountBalance(transferData.fromAccountId),
      updateAccountBalance(transferData.toAccountId)
    ]);

    return { transfer: transfer[0], outgoing: outgoingTransaction[0], incoming: incomingTransaction[0] };
  });
}
```

### Savings Goal Calculator

```typescript
export const calculateSavingsProgress = (goal: SavingsGoal) => {
  const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  const remaining = Math.max(goal.target_amount - goal.current_amount, 0);
  
  if (goal.target_date) {
    const monthsRemaining = Math.max(differenceInMonths(new Date(goal.target_date), new Date()), 0);
    const recommendedMonthly = monthsRemaining > 0 ? remaining / monthsRemaining : 0;
    
    return {
      progress,
      remaining,
      monthsRemaining,
      recommendedMonthly,
      onTrack: goal.monthly_contribution >= recommendedMonthly,
      completionDate: goal.monthly_contribution > 0 
        ? addMonths(new Date(), Math.ceil(remaining / goal.monthly_contribution))
        : null
    };
  }

  const monthsToComplete = goal.monthly_contribution > 0 
    ? Math.ceil(remaining / goal.monthly_contribution) 
    : Infinity;

  return { 
    progress, 
    remaining, 
    monthsToComplete: monthsToComplete === Infinity ? null : monthsToComplete
  };
};
```

### Debt Payoff Calculator with Strategy Selection

```typescript
export const calculateDebtPayoff = (debt: Debt, extraPayment: number = 0) => {
  const totalPayment = debt.minimum_payment + extraPayment;
  const monthlyInterestRate = debt.interest_rate / 12;
  
  // Check if payment covers interest
  if (totalPayment <= (debt.current_balance * monthlyInterestRate)) {
    return { 
      payoffMonths: Infinity, 
      totalInterest: Infinity,
      warning: "Payment doesn't cover minimum interest" 
    };
  }

  let balance = debt.current_balance;
  let months = 0;
  let totalInterest = 0;

  while (balance > 0.01 && months < 1000) {
    const interestPayment = balance * monthlyInterestRate;
    const principalPayment = Math.min(totalPayment - interestPayment, balance);
    
    balance -= principalPayment;
    totalInterest += interestPayment;
    months++;
  }

  const payoffDate = addMonths(new Date(), months);
  const minPaymentTime = calculateMinPaymentTime(debt);
  const interestSavings = minPaymentTime.totalInterest - totalInterest;

  return { 
    payoffMonths: months, 
    payoffDate,
    totalInterest,
    interestSavings,
    monthsSaved: minPaymentTime.months - months
  };
};

// NEW: Debt payoff strategy calculators
export const calculateSnowballStrategy = (debts: Debt[], totalExtraPayment: number) => {
  // Sort debts by balance (smallest first)
  const sortedDebts = [...debts]
    .filter(debt => debt.current_balance > 0)
    .sort((a, b) => a.current_balance - b.current_balance);

  return calculateDebtPayoffPlan(sortedDebts, totalExtraPayment, 'snowball');
};

export const calculateAvalancheStrategy = (debts: Debt[], totalExtraPayment: number) => {
  // Sort debts by interest rate (highest first)
  const sortedDebts = [...debts]
    .filter(debt => debt.current_balance > 0)
    .sort((a, b) => b.interest_rate - a.interest_rate);

  return calculateDebtPayoffPlan(sortedDebts, totalExtraPayment, 'avalanche');
};

const calculateDebtPayoffPlan = (sortedDebts: Debt[], totalExtraPayment: number, strategy: string) => {
  const plan = {
    strategy,
    totalMonths: 0,
    totalInterest: 0,
    totalPaid: 0,
    monthlySavings: 0,
    payoffOrder: [],
    monthlyPlan: []
  };

  let remainingDebts = sortedDebts.map(debt => ({
    ...debt,
    remainingBalance: debt.current_balance,
    isComplete: false
  }));

  let currentMonth = 0;
  let availableExtraPayment = totalExtraPayment;

  while (remainingDebts.some(debt => !debt.isComplete && debt.remainingBalance > 0)) {
    currentMonth++;
    let monthlyInterest = 0;
    let monthlyPrincipal = 0;

    // Calculate minimum payments and interest for all debts
    for (const debt of remainingDebts) {
      if (debt.isComplete || debt.remainingBalance <= 0) continue;

      const monthlyInterestRate = debt.interest_rate / 12;
      const interestPayment = debt.remainingBalance * monthlyInterestRate;
      const minimumPrincipal = Math.min(
        debt.minimum_payment - interestPayment, 
        debt.remainingBalance
      );

      debt.remainingBalance -= minimumPrincipal;
      monthlyInterest += interestPayment;
      monthlyPrincipal += minimumPrincipal;

      if (debt.remainingBalance <= 0) {
        debt.isComplete = true;
        plan.payoffOrder.push({
          name: debt.name,
          month: currentMonth,
          finalPayment: debt.minimum_payment + (debt.remainingBalance < 0 ? debt.remainingBalance : 0)
        });
      }
    }

    // Apply extra payment to the first non-complete debt (already sorted by strategy)
    const targetDebt = remainingDebts.find(debt => !debt.isComplete && debt.remainingBalance > 0);
    if (targetDebt && availableExtraPayment > 0) {
      const extraPrincipal = Math.min(availableExtraPayment, targetDebt.remainingBalance);
      targetDebt.remainingBalance -= extraPrincipal;
      monthlyPrincipal += extraPrincipal;

      if (targetDebt.remainingBalance <= 0) {
        targetDebt.isComplete = true;
        // Add this debt's minimum payment to available extra payment (snowball effect)
        availableExtraPayment += targetDebt.minimum_payment;
        
        if (!plan.payoffOrder.find(p => p.name === targetDebt.name)) {
          plan.payoffOrder.push({
            name: targetDebt.name,
            month: currentMonth,
            finalPayment: targetDebt.minimum_payment + extraPrincipal
          });
        }
      }
    }

    plan.monthlyPlan.push({
      month: currentMonth,
      totalPayment: monthlyInterest + monthlyPrincipal,
      interestPaid: monthlyInterest,
      principalPaid: monthlyPrincipal,
      remainingDebts: remainingDebts.filter(d => !d.isComplete).length,
      totalRemainingBalance: remainingDebts.reduce((sum, debt) => 
        sum + (debt.isComplete ? 0 : debt.remainingBalance), 0
      )
    });

    plan.totalInterest += monthlyInterest;
    plan.totalPaid += monthlyInterest + monthlyPrincipal;

    // Safety check to prevent infinite loops
    if (currentMonth > 1000) break;
  }

  plan.totalMonths = currentMonth;
  
  // Calculate savings vs minimum payments only
  const minimumOnlyPlan = calculateMinimumOnlyPayoff(sortedDebts);
  plan.monthlySavings = minimumOnlyPlan.totalInterest - plan.totalInterest;

  return plan;
};

const calculateMinimumOnlyPayoff = (debts: Debt[]) => {
  let totalMonths = 0;
  let totalInterest = 0;

  for (const debt of debts) {
    const payoff = calculateDebtPayoff(debt, 0);
    totalMonths = Math.max(totalMonths, payoff.payoffMonths);
    totalInterest += payoff.totalInterest;
  }

  return { totalMonths, totalInterest };
};

// Compare both strategies
export const compareDebtStrategies = (debts: Debt[], totalExtraPayment: number) => {
  const snowball = calculateSnowballStrategy(debts, totalExtraPayment);
  const avalanche = calculateAvalancheStrategy(debts, totalExtraPayment);

  return {
    snowball: {
      ...snowball,
      pros: [
        'Quick psychological wins',
        'Builds momentum and motivation',
        'Simplifies debt management faster'
      ],
      cons: snowball.totalInterest > avalanche.totalInterest ? 
        [`Costs $${(snowball.totalInterest - avalanche.totalInterest).toLocaleString()} more in interest`] : []
    },
    avalanche: {
      ...avalanche,
      pros: [
        'Minimizes total interest paid',
        'Mathematically optimal',
        avalanche.totalInterest < snowball.totalInterest ? 
          `Saves $${(snowball.totalInterest - avalanche.totalInterest).toLocaleString()} vs snowball` : ''
      ].filter(Boolean),
      cons: avalanche.payoffOrder[0]?.month > snowball.payoffOrder[0]?.month ?
        ['First debt takes longer to pay off', 'May be less motivating initially'] : []
    },
    recommendation: snowball.totalInterest < avalanche.totalInterest ? 'snowball' : 
                    (avalanche.totalInterest - snowball.totalInterest) < 1000 ? 'snowball' :
                    'avalanche'
  };
};

// NEW: Debt Payoff Progress Tracking (from Start Date)
export const initializeDebtPayoffJourney = async (userId: string, startDate: Date) => {
  // Calculate total starting debt
  const debts = await db
    .select()
    .from(debts_table)
    .where(and(
      eq(debts_table.user_id, userId),
      eq(debts_table.is_active, true)
    ));

  const totalStartingDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.current_balance.toString()), 0);

  // Create or update debt payoff settings
  await db
    .insert(debt_payoff_settings)
    .values({
      id: nanoid(),
      user_id: userId,
      payoff_start_date: startDate,
      starting_total_debt: totalStartingDebt,
      created_at: new Date()
    })
    .onConflictDoUpdate({
      target: debt_payoff_settings.user_id,
      set: {
        payoff_start_date: startDate,
        starting_total_debt: totalStartingDebt,
        updated_at: new Date()
      }
    });

  return {
    startDate,
    startingTotalDebt: totalStartingDebt,
    debtCount: debts.length
  };
};

export const getDebtPayoffProgress = async (userId: string) => {
  // Get settings
  const settings = await db
    .select()
    .from(debt_payoff_settings)
    .where(eq(debt_payoff_settings.user_id, userId))
    .limit(1);

  if (!settings[0] || !settings[0].payoff_start_date) {
    return null;
  }

  const startDate = new Date(settings[0].payoff_start_date);
  const startingDebt = parseFloat(settings[0].starting_total_debt?.toString() || '0');
  
  // Get current debt total
  const currentDebts = await db
    .select()
    .from(debts_table)
    .where(and(
      eq(debts_table.user_id, userId),
      eq(debts_table.is_active, true)
    ));

  const currentTotalDebt = currentDebts.reduce((sum, debt) => sum + parseFloat(debt.current_balance.toString()), 0);
  const totalPaidOff = startingDebt - currentTotalDebt;
  const percentPaidOff = startingDebt > 0 ? (totalPaidOff / startingDebt) * 100 : 0;

  // Calculate months since start
  const monthsSinceStart = Math.floor(
    (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  );

  // Calculate average monthly payoff
  const averageMonthlyPayoff = monthsSinceStart > 0 ? totalPaidOff / monthsSinceStart : 0;

  // Estimate debt-free date
  const monthsRemaining = averageMonthlyPayoff > 0 ? Math.ceil(currentTotalDebt / averageMonthlyPayoff) : null;
  const estimatedDebtFreeDate = monthsRemaining ? addMonths(new Date(), monthsRemaining) : null;

  // Get milestones achieved
  const milestones = await db
    .select()
    .from(debt_payoff_milestones)
    .where(eq(debt_payoff_milestones.user_id, userId))
    .orderBy(desc(debt_payoff_milestones.achieved_date));

  return {
    startDate,
    startingDebt,
    currentDebt: currentTotalDebt,
    totalPaidOff,
    percentPaidOff,
    monthsSinceStart,
    averageMonthlyPayoff,
    estimatedDebtFreeDate,
    debtCount: currentDebts.length,
    milestones: milestones || []
  };
};

export const checkAndRecordMilestone = async (userId: string) => {
  const progress = await getDebtPayoffProgress(userId);
  
  if (!progress) return null;

  const { percentPaidOff, totalPaidOff, currentDebt, monthsSinceStart } = progress;

  // Check for percentage milestones
  const milestoneChecks = [
    { type: '25_percent', threshold: 25 },
    { type: '50_percent', threshold: 50 },
    { type: '75_percent', threshold: 75 }
  ];

  for (const check of milestoneChecks) {
    if (percentPaidOff >= check.threshold) {
      // Check if milestone already recorded
      const existing = await db
        .select()
        .from(debt_payoff_milestones)
        .where(and(
          eq(debt_payoff_milestones.user_id, userId),
          eq(debt_payoff_milestones.milestone_type, check.type)
        ))
        .limit(1);

      if (!existing[0]) {
        // Record new milestone
        await db.insert(debt_payoff_milestones).values({
          id: nanoid(),
          user_id: userId,
          milestone_type: check.type,
          achieved_date: new Date(),
          total_paid_off: totalPaidOff,
          remaining_debt: currentDebt,
          months_since_start: monthsSinceStart,
          created_at: new Date()
        });

        // Create notification for milestone achievement
        await createNotification(userId, null, {
          type: 'milestone',
          title: `🎉 Debt Payoff Milestone: ${check.threshold}% Complete!`,
          message: `You've paid off ${check.threshold}% of your debt! Keep up the great work!`,
          priority: 'high',
          action_url: '/debt'
        });

        return {
          type: check.type,
          percentComplete: check.threshold,
          totalPaidOff,
          remainingDebt: currentDebt
        };
      }
    }
  }

  return null;
};

export const getDebtPayoffStats = async (userId: string) => {
  const progress = await getDebtPayoffProgress(userId);
  
  if (!progress) {
    return {
      hasStarted: false,
      message: 'Start your debt payoff journey by setting a start date!'
    };
  }

  const { 
    startDate, 
    startingDebt, 
    currentDebt, 
    totalPaidOff, 
    percentPaidOff,
    monthsSinceStart,
    averageMonthlyPayoff,
    estimatedDebtFreeDate,
    debtCount,
    milestones
  } = progress;

  // Calculate momentum (comparing last 3 months to previous 3 months)
  const recentPayments = await db
    .select({
      month: sql<string>`strftime('%Y-%m', ${transactions.date})`,
      total: sql<number>`SUM(${transactions.amount})`
    })
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      eq(transactions.type, 'expense'),
      sql`${transactions.category_id} IN (SELECT id FROM ${budget_categories} WHERE type = 'debt')`,
      sql`${transactions.date} >= date('now', '-6 months')`
    ))
    .groupBy(sql`strftime('%Y-%m', ${transactions.date})`)
    .orderBy(sql`strftime('%Y-%m', ${transactions.date}) DESC`);

  const last3Months = recentPayments.slice(0, 3).reduce((sum, r) => sum + r.total, 0) / 3;
  const previous3Months = recentPayments.slice(3, 6).reduce((sum, r) => sum + r.total, 0) / 3;
  const momentum = previous3Months > 0 ? ((last3Months - previous3Months) / previous3Months) * 100 : 0;

  return {
    hasStarted: true,
    startDate: format(startDate, 'MMMM yyyy'),
    journey: {
      monthsInPayoff: monthsSinceStart,
      startingDebt: `$${startingDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      currentDebt: `$${currentDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      totalPaidOff: `$${totalPaidOff.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      percentComplete: percentPaidOff.toFixed(1),
      remainingDebts: debtCount
    },
    performance: {
      averageMonthlyPayoff: `$${averageMonthlyPayoff.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      momentum: momentum.toFixed(1),
      momentumIndicator: momentum > 5 ? '📈 Accelerating!' : momentum < -5 ? '📉 Slowing' : '➡️ Steady',
      estimatedDebtFreeDate: estimatedDebtFreeDate ? format(estimatedDebtFreeDate, 'MMMM yyyy') : 'Calculating...'
    },
    milestones: milestones.map(m => ({
      type: m.milestone_type,
      date: format(new Date(m.achieved_date), 'MMM d, yyyy'),
      monthsToAchieve: m.months_since_start
    })),
    nextMilestone: percentPaidOff < 25 ? '25% paid off' :
                   percentPaidOff < 50 ? '50% paid off' :
                   percentPaidOff < 75 ? '75% paid off' :
                   'Debt free! 🎉'
  };
};
```

### Budget Analysis Engine with Bill Tracking

```typescript
export const analyzeBudget = async (userId: string, month: number, year: number) => {
  // Get all budget categories totals
  const budgetTotals = await db
    .select({
      type: budget_categories.type,
      total: sql<number>`COALESCE(SUM(${budget_categories.monthly_budget}), 0)`
    })
    .from(budget_categories)
    .where(and(
      eq(budget_categories.user_id, userId),
      eq(budget_categories.is_active, true)
    ))
    .groupBy(budget_categories.type);

  const totals = budgetTotals.reduce((acc, item) => {
    acc[item.type] = item.total;
    return acc;
  }, {} as Record<string, number>);

  const totalIncome = totals.income || 0;
  const totalVariableExpenses = totals.variable_expense || 0;
  const totalMonthlyBills = totals.monthly_bill || 0;
  const totalSavings = totals.savings || 0;
  const totalDebtPayments = totals.debt || 0;

  const totalExpenses = totalVariableExpenses + totalMonthlyBills + totalSavings + totalDebtPayments;
  const surplus = totalIncome - totalExpenses;

  // Get actual spending for the month
  const actualSpending = await getActualSpending(userId, month, year);
  
  // Get bill payment status
  const billStatus = await getBillPaymentStatus(userId, month, year);
  
  return {
    budget: {
      totalIncome,
      totalVariableExpenses,
      totalMonthlyBills,
      totalSavings,
      totalDebtPayments,
      totalExpenses,
      surplus
    },
    actual: actualSpending,
    bills: billStatus,
    analysis: {
      percentages: {
        housing: Math.round((totalMonthlyBills / totalIncome) * 100),
        savings: Math.round((totalSavings / totalIncome) * 100),
        debt: Math.round((totalDebtPayments / totalIncome) * 100),
        variable: Math.round((totalVariableExpenses / totalIncome) * 100)
      },
      recommendations: generateBudgetRecommendations(surplus, totalIncome, billStatus),
      alerts: generateBudgetAlerts(surplus, totalIncome, actualSpending, billStatus)
    }
  };
};

// Bill tracking and payment status functions
const getBillPaymentStatus = async (userId: string, month: number, year: number) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const billInstances = await db
    .select({
      billId: bill_instances.billId,
      billName: bills.name,
      dueDate: bill_instances.dueDate,
      expectedAmount: bill_instances.expectedAmount,
      actualAmount: bill_instances.actualAmount,
      status: bill_instances.status,
      daysLate: bill_instances.daysLate,
      paidDate: bill_instances.paidDate
    })
    .from(bill_instances)
    .leftJoin(bills, eq(bills.id, bill_instances.billId))
    .where(and(
      eq(bill_instances.user_id, userId),
      gte(bill_instances.dueDate, startDate),
      lte(bill_instances.dueDate, endDate)
    ))
    .orderBy(bill_instances.dueDate);

  const summary = {
    totalBills: billInstances.length,
    paidBills: billInstances.filter(b => b.status === 'paid').length,
    overdueBills: billInstances.filter(b => b.status === 'overdue').length,
    totalExpected: billInstances.reduce((sum, bill) => sum + bill.expectedAmount, 0),
    totalPaid: billInstances.reduce((sum, bill) => sum + (bill.actualAmount || 0), 0),
    totalLateFees: billInstances.reduce((sum, bill) => sum + (bill.lateFee || 0), 0)
  };

  return { instances: billInstances, summary };
};

const generateBillInstances = async (userId: string, month: number, year: number) => {
  // Get all active bills for the user
  const activeBills = await db
    .select()
    .from(bills)
    .where(and(
      eq(bills.user_id, userId),
      eq(bills.is_active, true)
    ));

  const billInstances = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (const bill of activeBills) {
    // Calculate due date for this month
    let dueDay = bill.dueDate;
    if (dueDay > daysInMonth) {
      dueDay = daysInMonth; // Handle months with fewer days
    }
    
    const dueDate = new Date(year, month - 1, dueDay);
    
    // Check if instance already exists
    const existingInstance = await db
      .select()
      .from(bill_instances)
      .where(and(
        eq(bill_instances.bill_id, bill.id),
        eq(bill_instances.due_date, dueDate)
      ))
      .limit(1);

    if (existingInstance.length === 0) {
      billInstances.push({
        billId: bill.id,
        userId: userId,
        dueDate: dueDate,
        expectedAmount: bill.expectedAmount,
        status: 'pending'
      });
    }
  }

  // Bulk insert new bill instances
  if (billInstances.length > 0) {
    await db.insert(bill_instances).values(billInstances);
  }

  return billInstances;
};

const markBillAsPaid = async (billInstanceId: string, transactionId: string, paidAmount: number, paidDate: Date) => {
  const today = new Date();
  const billInstance = await db
    .select()
    .from(bill_instances)
    .where(eq(bill_instances.id, billInstanceId))
    .limit(1);

  if (billInstance.length === 0) {
    throw new Error('Bill instance not found');
  }

  const bill = billInstance[0];
  const dueDate = new Date(bill.dueDate);
  const daysLate = Math.max(0, Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

  await db
    .update(bill_instances)
    .set({
      status: 'paid',
      actualAmount: paidAmount,
      paidDate: paidDate,
      transactionId: transactionId,
      daysLate: daysLate,
      updatedAt: today
    })
    .where(eq(bill_instances.id, billInstanceId));

  // Update the transaction to link back to the bill
  await db
    .update(transactions)
    .set({
      billId: billInstanceId,
      updatedAt: today
    })
    .where(eq(transactions.id, transactionId));

  return { success: true, daysLate };
};

const checkForOverdueBills = async (userId: string) => {
  const today = new Date();
  
  // Find all pending bills that are now overdue
  const overdueBills = await db
    .update(bill_instances)
    .set({
      status: 'overdue',
      daysLate: sql<number>`CAST((julianday('now') - julianday(${bill_instances.dueDate})) AS INTEGER)`,
      updatedAt: today
    })
    .where(and(
      eq(bill_instances.user_id, userId),
      eq(bill_instances.status, 'pending'),
      lt(bill_instances.dueDate, today)
    ))
    .returning();

  return overdueBills;
};

const generateBudgetRecommendations = (surplus: number, totalIncome: number, billStatus: any) => {
  const recommendations = [];
  
  if (surplus < 0) {
    recommendations.push({
      type: 'warning',
      message: `Budget deficit of $${Math.abs(surplus).toLocaleString()}. Review expenses or increase income.`
    });
  } else if (surplus > totalIncome * 0.1) {
    recommendations.push({
      type: 'success',
      message: `Great! You have $${surplus.toLocaleString()} surplus. Consider increasing savings goals.`
    });
  }

  if (billStatus.summary.overdueBills > 0) {
    recommendations.push({
      type: 'urgent',
      message: `You have ${billStatus.summary.overdueBills} overdue bill${billStatus.summary.overdueBills > 1 ? 's' : ''}. Pay immediately to avoid late fees.`
    });
  }

  const savingsRate = (surplus / totalIncome) * 100;
  if (savingsRate < 10) {
    recommendations.push({
      type: 'info',
      message: `Try to save at least 10% of income. Current savings rate: ${savingsRate.toFixed(1)}%`
    });
  }

  return recommendations;
};
```

### Debt Management UI Components with Strategy Selection

```tsx
const DebtManagementSection = () => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche' | 'comparison'>('snowball');
  const [totalExtraPayment, setTotalExtraPayment] = useState(0);
  const [strategyComparison, setStrategyComparison] = useState(null);

  useEffect(() => {
    if (debts.length > 0) {
      const comparison = compareDebtStrategies(debts, totalExtraPayment);
      setStrategyComparison(comparison);
    }
  }, [debts, totalExtraPayment]);

  return (
    <div className="space-y-4">
      {/* Strategy Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Debt Payoff Strategy</CardTitle>
          <CardDescription>Choose how you want to tackle your debts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Extra Payment Input */}
          <div>
            <label className="text-sm font-medium">Total Extra Payment Monthly</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                placeholder="0.00"
                value={totalExtraPayment}
                onChange={(e) => setTotalExtraPayment(parseFloat(e.target.value) || 0)}
                className="pl-6"
              />
            </div>
          </div>

          {/* Strategy Toggle */}
          <div className="flex gap-2">
            <Button
              variant={strategy === 'snowball' ? 'default' : 'outline'}
              onClick={() => setStrategy('snowball')}
              className="flex-1"
            >
              <div className="text-center">
                <div>❄️ Snowball</div>
                <div className="text-xs">Smallest Balance First</div>
              </div>
            </Button>
            <Button
              variant={strategy === 'avalanche' ? 'default' : 'outline'}
              onClick={() => setStrategy('avalanche')}
              className="flex-1"
            >
              <div className="text-center">
                <div>🏔️ Avalanche</div>
                <div className="text-xs">Highest Interest First</div>
              </div>
            </Button>
            <Button
              variant={strategy === 'comparison' ? 'default' : 'outline'}
              onClick={() => setStrategy('comparison')}
              className="flex-1"
            >
              <div className="text-center">
                <div>📊 Compare</div>
                <div className="text-xs">Side by Side</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Results */}
      {strategy !== 'comparison' && strategyComparison && (
        <StrategyResultsCard 
          strategy={strategy} 
          results={strategyComparison[strategy]}
          debts={debts}
        />
      )}

      {/* Comparison View */}
      {strategy === 'comparison' && strategyComparison && (
        <StrategyComparisonCard comparison={strategyComparison} />
      )}

      {/* Debt Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Debt Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                ${debts.reduce((sum, debt) => sum + debt.current_balance, 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Total Debt</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                ${debts.reduce((sum, debt) => sum + debt.minimum_payment, 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Min Payments</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Debts */}
      {debts.map((debt) => (
        <DebtCard key={debt.id} debt={debt} strategy={strategy} />
      ))}
    </div>
  );
};

// NEW: Debt Payoff Progress Tracker Component
const DebtPayoffProgressTracker = ({ userId }: { userId: string }) => {
  const [progress, setProgress] = useState<any>(null);
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, [userId]);

  const loadProgress = async () => {
    try {
      const stats = await fetch(`/api/debt/progress?userId=${userId}`).then(r => r.json());
      setProgress(stats);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load debt progress:', error);
      setLoading(false);
    }
  };

  const handleSetStartDate = async () => {
    if (!startDate) return;
    
    try {
      await fetch('/api/debt/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, startDate: new Date(startDate) })
      });
      
      setShowStartDateModal(false);
      await loadProgress();
    } catch (error) {
      console.error('Failed to set start date:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading progress...</div>;
  }

  if (!progress?.hasStarted) {
    return (
      <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <CardContent className="py-8 text-center">
          <h3 className="text-xl font-bold mb-2">Start Your Debt Payoff Journey</h3>
          <p className="text-muted-foreground mb-4">
            Track your progress and celebrate milestones along the way!
          </p>
          <Button onClick={() => setShowStartDateModal(true)}>
            Set Start Date
          </Button>
          
          {showStartDateModal && (
            <div className="mt-4 space-y-3">
              <Input
                type="month"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Select start month"
              />
              <div className="flex gap-2 justify-center">
                <Button onClick={handleSetStartDate} disabled={!startDate}>
                  Start Journey
                </Button>
                <Button variant="outline" onClick={() => setShowStartDateModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const { journey, performance, milestones, nextMilestone } = progress;

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <Card className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border-emerald-500/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🎯 Debt Payoff Journey</span>
            <span className="text-sm font-normal text-muted-foreground">
              Started {progress.startDate}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Progress to Debt Free</span>
              <span className="text-sm font-bold text-emerald-400">{journey.percentComplete}%</span>
            </div>
            <div className="w-full bg-[#242424] rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-blue-400 transition-all duration-500"
                style={{ width: `${journey.percentComplete}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Next: {nextMilestone}</p>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1a1a1a] rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Starting Debt</p>
              <p className="text-lg font-bold">{journey.startingDebt}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Current Debt</p>
              <p className="text-lg font-bold text-red-400">{journey.currentDebt}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Total Paid Off</p>
              <p className="text-lg font-bold text-emerald-400">{journey.totalPaidOff}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Months in Payoff</p>
              <p className="text-lg font-bold">{journey.monthsInPayoff}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📊 Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Average Monthly Payoff</p>
              <p className="text-xl font-bold">{performance.averageMonthlyPayoff}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Momentum</p>
              <p className="text-xl font-bold">{performance.momentumIndicator}</p>
              <p className="text-xs text-gray-400">{performance.momentum}% vs last 3 months</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Estimated Debt Free</p>
              <p className="text-xl font-bold text-emerald-400">{performance.estimatedDebtFreeDate}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      {milestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🏆 Milestones Achieved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {milestones.map((milestone: any, idx: number) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <span className="text-xl">🎉</span>
                    </div>
                    <div>
                      <p className="font-medium">
                        {milestone.type.replace('_', ' ').replace('percent', '% Paid Off')}
                      </p>
                      <p className="text-xs text-gray-400">{milestone.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-emerald-400 font-medium">
                      {milestone.monthsToAchieve} months
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const StrategyResultsCard = ({ strategy, results, debts }) => {
  const strategyInfo = {
    snowball: {
      title: '❄️ Debt Snowball Method',
      description: 'Pay minimums on all debts, then put extra money toward the smallest balance first.',
      benefits: 'Builds momentum with quick wins and psychological motivation.'
    },
    avalanche: {
      title: '🏔️ Debt Avalanche Method', 
      description: 'Pay minimums on all debts, then put extra money toward the highest interest rate first.',
      benefits: 'Mathematically optimal - saves the most money in interest.'
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{strategyInfo[strategy].title}</CardTitle>
        <CardDescription>{strategyInfo[strategy].description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-600">
              {results.totalMonths} mo
            </p>
            <p className="text-sm text-muted-foreground">Debt Free</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              ${results.totalInterest.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Total Interest</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">
              ${results.monthlySavings.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Interest Saved</p>
          </div>
        </div>

        {/* Payoff Order */}
        <div>
          <h4 className="font-medium mb-2">Payoff Order</h4>
          <div className="space-y-2">
            {results.payoffOrder.map((item, index) => (
              <div key={item.name} className="flex justify-between items-center p-2 bg-muted rounded">
                <div>
                  <span className="font-medium">#{index + 1} {item.name}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Month {item.month} • Final: ${item.finalPayment.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>{strategyInfo[strategy].benefits}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

const StrategyComparisonCard = ({ comparison }) => {
  const { snowball, avalanche, recommendation } = comparison;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Comparison</CardTitle>
        <CardDescription>
          Recommended: <Badge variant="default">
            {recommendation === 'snowball' ? '❄️ Snowball' : '🏔️ Avalanche'}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {/* Snowball Column */}
          <div className="space-y-4">
            <h3 className="font-semibold text-center">❄️ Debt Snowball</h3>
            
            <div className="space-y-2 text-center">
              <div>
                <p className="text-xl font-bold">{snowball.totalMonths} months</p>
                <p className="text-sm text-muted-foreground">Debt Free</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-red-600">
                  ${snowball.totalInterest.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Total Interest</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-green-600 mb-1">Pros:</p>
              <ul className="text-xs space-y-1">
                {snowball.pros.map((pro, i) => (
                  <li key={i}>✓ {pro}</li>
                ))}
              </ul>
            </div>

            {snowball.cons.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-600 mb-1">Cons:</p>
                <ul className="text-xs space-y-1">
                  {snowball.cons.map((con, i) => (
                    <li key={i}>✗ {con}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Avalanche Column */}
          <div className="space-y-4">
            <h3 className="font-semibold text-center">🏔️ Debt Avalanche</h3>
            
            <div className="space-y-2 text-center">
              <div>
                <p className="text-xl font-bold">{avalanche.totalMonths} months</p>
                <p className="text-sm text-muted-foreground">Debt Free</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-red-600">
                  ${avalanche.totalInterest.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Total Interest</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-green-600 mb-1">Pros:</p>
              <ul className="text-xs space-y-1">
                {avalanche.pros.map((pro, i) => (
                  <li key={i}>✓ {pro}</li>
                ))}
              </ul>
            </div>

            {avalanche.cons.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-600 mb-1">Cons:</p>
                <ul className="text-xs space-y-1">
                  {avalanche.cons.map((con, i) => (
                    <li key={i}>✗ {con}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Line Comparison */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="text-center">
            {avalanche.totalInterest < snowball.totalInterest ? (
              <p className="text-sm">
                <strong>Avalanche saves ${(snowball.totalInterest - avalanche.totalInterest).toLocaleString()}</strong> in interest
                but snowball provides faster psychological wins.
              </p>
            ) : (
              <p className="text-sm">
                <strong>Snowball costs ${(avalanche.totalInterest - snowball.totalInterest).toLocaleString()}</strong> extra in interest
                but provides faster psychological wins.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const DebtCard = ({ debt, strategy }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-medium">{debt.name}</h3>
            <p className="text-sm text-muted-foreground">
              {debt.interest_rate}% APR • Due {debt.due_date}th
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-red-600">
              ${debt.current_balance.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Balance</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Minimum Payment:</span>
            <p className="font-medium">${debt.minimum_payment}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Strategy Priority:</span>
            <p className="font-medium">
              {strategy === 'snowball' ? 
                `#${getSortedPosition(debt, 'balance')}` : 
                `#${getSortedPosition(debt, 'rate')}`
              }
              {strategy === 'snowball' ? ' (by balance)' : ' (by rate)'}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full mt-3"
        >
          {showDetails ? 'Hide' : 'Show'} Payoff Details
          <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </Button>

        {showDetails && (
          <div className="mt-3 p-3 bg-muted rounded text-sm space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Min Payment Only:</span>
                <p className="font-medium">{calculateDebtPayoff(debt, 0).payoffMonths} months</p>
              </div>
              <div>
                <span className="text-muted-foreground">With Extra Payment:</span>
                <p className="font-medium">{calculateDebtPayoff(debt, debt.additional_payment).payoffMonths} months</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

---

## 👥 Multi-User Household Management

### Overview
The application supports household/family sharing where multiple users can access shared financial data. This allows couples, families, or roommates to collaborate on finances with appropriate permissions and transparency.

### Household Roles & Permissions

```typescript
enum HouseholdRole {
  OWNER = 'owner',       // Full control, can delete household
  ADMIN = 'admin',       // Can manage members and all finances
  MEMBER = 'member',     // Can create/edit transactions and view all data
  VIEWER = 'viewer'      // Read-only access to shared resources
}

// Permission matrix
const PERMISSIONS = {
  owner: {
    invite_members: true,
    remove_members: true,
    manage_permissions: true,
    create_accounts: true,
    edit_accounts: true,
    delete_accounts: true,
    create_transactions: true,
    edit_all_transactions: true,
    view_all_data: true,
    manage_budget: true,
    delete_household: true
  },
  admin: {
    invite_members: true,
    remove_members: true,
    manage_permissions: true,
    create_accounts: true,
    edit_accounts: true,
    delete_accounts: false,
    create_transactions: true,
    edit_all_transactions: true,
    view_all_data: true,
    manage_budget: true,
    delete_household: false
  },
  member: {
    invite_members: false,
    remove_members: false,
    manage_permissions: false,
    create_accounts: false,
    edit_accounts: false,
    delete_accounts: false,
    create_transactions: true,
    edit_all_transactions: true,
    view_all_data: true,
    manage_budget: false,
    delete_household: false
  },
  viewer: {
    invite_members: false,
    remove_members: false,
    manage_permissions: false,
    create_accounts: false,
    edit_accounts: false,
    delete_accounts: false,
    create_transactions: false,
    edit_all_transactions: false,
    view_all_data: true,
    manage_budget: false,
    delete_household: false
  }
};
```

### Household Management Functions

```typescript
// Create a new household
export const createHousehold = async (userId: string, householdName: string) => {
  return await db.transaction(async (tx) => {
    // Create household
    const household = await tx
      .insert(households)
      .values({
        name: householdName,
        created_by: userId,
        created_at: new Date()
      })
      .returning();

    // Add creator as owner
    await tx
      .insert(household_members)
      .values({
        household_id: household[0].id,
        user_id: userId,
        user_email: await getUserEmail(userId),
        user_name: await getUserName(userId),
        role: 'owner',
        joined_at: new Date()
      });

    return household[0];
  });
};

// Invite member to household
export const inviteHouseholdMember = async (
  householdId: string,
  invitedByUserId: string,
  invitedEmail: string,
  role: HouseholdRole = 'member'
) => {
  // Check if inviter has permission
  const hasPermission = await checkPermission(
    householdId,
    invitedByUserId,
    'invite_members'
  );

  if (!hasPermission) {
    throw new Error('You do not have permission to invite members');
  }

  // Check if user already in household
  const existing = await db
    .select()
    .from(household_members)
    .where(and(
      eq(household_members.household_id, householdId),
      eq(household_members.user_email, invitedEmail)
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('User is already a member of this household');
  }

  // Generate invitation token
  const token = generateSecureToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiration

  const invitation = await db
    .insert(household_invitations)
    .values({
      household_id: householdId,
      invited_email: invitedEmail,
      invited_by: invitedByUserId,
      role,
      invitation_token: token,
      expires_at: expiresAt,
      status: 'pending',
      created_at: new Date()
    })
    .returning();

  // Generate shareable invitation link (no email sent)
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
  
  // Return invitation with shareable link
  return {
    ...invitation[0],
    inviteLink
  };
};

// Accept household invitation
export const acceptHouseholdInvitation = async (
  token: string,
  acceptingUserId: string
) => {
  const invitation = await db
    .select()
    .from(household_invitations)
    .where(eq(household_invitations.invitation_token, token))
    .limit(1);

  if (invitation.length === 0) {
    throw new Error('Invalid invitation');
  }

  const inv = invitation[0];

  if (inv.status !== 'pending') {
    throw new Error('Invitation has already been processed');
  }

  if (new Date() > new Date(inv.expires_at)) {
    throw new Error('Invitation has expired');
  }

  return await db.transaction(async (tx) => {
    // Add user to household
    await tx
      .insert(household_members)
      .values({
        household_id: inv.household_id,
        user_id: acceptingUserId,
        user_email: inv.invited_email,
        user_name: await getUserName(acceptingUserId),
        role: inv.role,
        invited_by: inv.invited_by,
        joined_at: new Date()
      });

    // Update invitation status
    await tx
      .update(household_invitations)
      .set({
        status: 'accepted',
        accepted_at: new Date()
      })
      .where(eq(household_invitations.id, inv.id));

    // Log activity
    await logActivity(
      inv.household_id,
      acceptingUserId,
      'settings_changed',
      'household',
      inv.household_id,
      { action: 'member_joined', email: inv.invited_email }
    );

    return { success: true, household_id: inv.household_id };
  });
};

// Remove member from household
export const removeHouseholdMember = async (
  householdId: string,
  removingUserId: string,
  memberIdToRemove: string
) => {
  const hasPermission = await checkPermission(
    householdId,
    removingUserId,
    'remove_members'
  );

  if (!hasPermission) {
    throw new Error('You do not have permission to remove members');
  }

  // Can't remove the owner
  const member = await db
    .select()
    .from(household_members)
    .where(and(
      eq(household_members.household_id, householdId),
      eq(household_members.user_id, memberIdToRemove)
    ))
    .limit(1);

  if (member[0]?.role === 'owner') {
    throw new Error('Cannot remove household owner');
  }

  await db
    .update(household_members)
    .set({ is_active: false })
    .where(and(
      eq(household_members.household_id, householdId),
      eq(household_members.user_id, memberIdToRemove)
    ));

  await logActivity(
    householdId,
    removingUserId,
    'settings_changed',
    'household',
    householdId,
    { action: 'member_removed', removed_user_id: memberIdToRemove }
  );
};

// Get household members
export const getHouseholdMembers = async (householdId: string) => {
  return await db
    .select()
    .from(household_members)
    .where(and(
      eq(household_members.household_id, householdId),
      eq(household_members.is_active, true)
    ))
    .orderBy(
      // Owner first, then by join date
      sql`CASE ${household_members.role} 
        WHEN 'owner' THEN 1 
        WHEN 'admin' THEN 2 
        WHEN 'member' THEN 3 
        WHEN 'viewer' THEN 4 
      END`,
      asc(household_members.joined_at)
    );
};

// Check if user has permission
export const checkPermission = async (
  householdId: string,
  userId: string,
  permission: string
): Promise<boolean> => {
  const member = await db
    .select()
    .from(household_members)
    .where(and(
      eq(household_members.household_id, householdId),
      eq(household_members.user_id, userId),
      eq(household_members.is_active, true)
    ))
    .limit(1);

  if (member.length === 0) return false;

  return PERMISSIONS[member[0].role]?.[permission] || false;
};

// Get user's households
export const getUserHouseholds = async (userId: string) => {
  const memberships = await db
    .select({
      household_id: household_members.household_id,
      household_name: households.name,
      role: household_members.role,
      joined_at: household_members.joined_at,
      member_count: sql<number>`COUNT(DISTINCT ${household_members.id})`
    })
    .from(household_members)
    .innerJoin(households, eq(household_members.household_id, households.id))
    .where(and(
      eq(household_members.user_id, userId),
      eq(household_members.is_active, true)
    ))
    .groupBy(household_members.household_id, households.name, household_members.role);

  return memberships;
};

// Activity logging
export const logActivity = async (
  householdId: string,
  userId: string,
  actionType: string,
  entityType: string,
  entityId: string,
  details: any = {}
) => {
  await db
    .insert(activity_log)
    .values({
      household_id: householdId,
      user_id: userId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      details: JSON.stringify(details),
      created_at: new Date()
    });
};

// Get activity feed
export const getActivityFeed = async (
  householdId: string,
  limit: number = 50
) => {
  return await db
    .select({
      id: activity_log.id,
      user_name: household_members.user_name,
      user_email: household_members.user_email,
      action_type: activity_log.action_type,
      entity_type: activity_log.entity_type,
      entity_id: activity_log.entity_id,
      details: activity_log.details,
      created_at: activity_log.created_at
    })
    .from(activity_log)
    .innerJoin(
      household_members,
      and(
        eq(activity_log.user_id, household_members.user_id),
        eq(activity_log.household_id, household_members.household_id)
      )
    )
    .where(eq(activity_log.household_id, householdId))
    .orderBy(desc(activity_log.created_at))
    .limit(limit);
};

// Switch active household for user
export const switchActiveHousehold = async (
  userId: string,
  householdId: string
) => {
  // Verify user is member of this household
  const member = await db
    .select()
    .from(household_members)
    .where(and(
      eq(household_members.user_id, userId),
      eq(household_members.household_id, householdId),
      eq(household_members.is_active, true)
    ))
    .limit(1);

  if (member.length === 0) {
    throw new Error('You are not a member of this household');
  }

  // Store active household in user session/preferences
  // This would be stored in a user_preferences table or session storage
  return { active_household_id: householdId, role: member[0].role };
};
```

### UI Components for Household Management

```tsx
// Household Selector Component
const HouseholdSelector = ({ userId, currentHouseholdId, onSwitch }) => {
  const [households, setHouseholds] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const loadHouseholds = async () => {
      const userHouseholds = await getUserHouseholds(userId);
      setHouseholds(userHouseholds);
    };
    loadHouseholds();
  }, [userId]);

  const currentHousehold = households.find(h => h.household_id === currentHouseholdId);

  return (
    <div className="household-selector">
      <Button
        variant="outline"
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full justify-between"
      >
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4" />
          <div className="text-left">
            <div className="font-medium">{currentHousehold?.household_name}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {currentHousehold?.role}
            </div>
          </div>
        </div>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg">
          {households.map((household) => (
            <div
              key={household.household_id}
              className="px-4 py-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
              onClick={() => {
                onSwitch(household.household_id);
                setShowDropdown(false);
              }}
            >
              <div className="font-medium">{household.household_name}</div>
              <div className="text-xs text-muted-foreground">
                {household.member_count} members • {household.role}
              </div>
            </div>
          ))}
          
          <div
            className="px-4 py-3 hover:bg-muted cursor-pointer text-blue-600 flex items-center gap-2"
            onClick={() => {/* Open create household modal */}}
          >
            <Plus className="h-4 w-4" />
            Create New Household
          </div>
        </div>
      )}
    </div>
  );
};

// Household Settings Component
const HouseholdSettings = ({ householdId, currentUserId }) => {
  const [members, setMembers] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userPermissions, setUserPermissions] = useState({});

  useEffect(() => {
    const loadData = async () => {
      const householdMembers = await getHouseholdMembers(householdId);
      setMembers(householdMembers);
      
      // Check current user's permissions
      const permissions = {};
      for (const perm of Object.keys(PERMISSIONS.owner)) {
        permissions[perm] = await checkPermission(householdId, currentUserId, perm);
      }
      setUserPermissions(permissions);
    };
    loadData();
  }, [householdId, currentUserId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Household Members</CardTitle>
          {userPermissions.invite_members && (
            <Button size="sm" onClick={() => setShowInviteModal(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {member.user_name?.charAt(0) || member.user_email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{member.user_name || member.user_email}</div>
                <div className="text-sm text-muted-foreground">
                  {member.user_email}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                {member.role}
              </Badge>
              
              {userPermissions.remove_members && member.role !== 'owner' && member.user_id !== currentUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveMember(member.user_id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// Activity Feed Component
const HouseholdActivityFeed = ({ householdId }) => {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const loadActivity = async () => {
      const feed = await getActivityFeed(householdId, 20);
      setActivities(feed);
    };
    loadActivity();
  }, [householdId]);

  const formatActivity = (activity) => {
    const actions = {
      transaction_created: '💰 created a transaction',
      transaction_updated: '✏️ updated a transaction',
      transaction_deleted: '🗑️ deleted a transaction',
      bill_paid: '💵 paid a bill',
      transfer_created: '↔️ created a transfer',
      account_created: '🏦 added an account',
      budget_updated: '📊 updated the budget',
      settings_changed: '⚙️ changed settings'
    };

    return actions[activity.action_type] || 'performed an action';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>See what your household members have been up to</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {activity.user_name?.charAt(0) || activity.user_email.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{activity.user_name || activity.user_email}</span>
                {' '}
                <span className="text-muted-foreground">{formatActivity(activity)}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// Invite Member Modal (with shareable link, no email)
const InviteMemberModal = ({ householdId, currentUserId, onClose }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateInvite = async () => {
    setIsLoading(true);
    try {
      const result = await inviteHouseholdMember(householdId, currentUserId, email, role);
      setInviteLink(result.inviteLink);
      showToast('Invitation link generated!');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    showToast('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Household Member</DialogTitle>
          <DialogDescription>
            Generate a shareable invitation link to add someone to your household
          </DialogDescription>
        </DialogHeader>
        
        {!inviteLink ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email Address (optional)</label>
              <Input
                type="email"
                placeholder="their.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used to track who the invite is for (not sent via email)
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    <div>
                      <div className="font-medium">Member</div>
                      <div className="text-xs text-muted-foreground">
                        Can create transactions and view all data
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div>
                      <div className="font-medium">Admin</div>
                      <div className="text-xs text-muted-foreground">
                        Can manage members and all finances
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div>
                      <div className="font-medium">Viewer</div>
                      <div className="text-xs text-muted-foreground">
                        Read-only access to shared data
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-surface rounded-lg border border-border">
              <label className="text-sm font-medium mb-2 block">Shareable Link</label>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="flex-1 font-mono text-xs"
                />
                <Button onClick={handleCopyLink} variant="outline">
                  {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Share this link with the person you want to invite. Link expires in 7 days.
              </p>
            </div>
            
            <div className="text-sm text-gray-400">
              <p className="font-medium mb-1">What to do next:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Copy the link above</li>
                <li>Share it with your household member via text, messaging app, etc.</li>
                <li>They'll click the link and accept the invitation</li>
              </ol>
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {inviteLink ? 'Done' : 'Cancel'}
          </Button>
          {!inviteLink && (
            <Button onClick={handleGenerateInvite} disabled={isLoading}>
              {isLoading ? 'Generating...' : 'Generate Invite Link'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

### Modified Transaction Creation with Activity Logging

```typescript
// Enhanced transaction creation with household activity logging
export const createTransactionWithHousehold = async (
  userId: string,
  householdId: string,
  transactionData: TransactionInput
) => {
  return await db.transaction(async (tx) => {
    // Check if user has permission
    const canCreate = await checkPermission(householdId, userId, 'create_transactions');
    if (!canCreate) {
      throw new Error('You do not have permission to create transactions');
    }

    // Create the transaction
    const transaction = await createTransaction(userId, transactionData);

    // Log activity for household
    await logActivity(
      householdId,
      userId,
      'transaction_created',
      'transaction',
      transaction.id,
      {
        amount: transactionData.amount,
        description: transactionData.description,
        account_id: transactionData.account_id
      }
    );

    return transaction;
  });
};
```

---

## 🔔 Notifications & Reminders System

### Overview
A comprehensive notification system keeps users informed about bills, budgets, and financial milestones. Supports both in-app notifications and PWA push notifications with customizable preferences. **Note: Email notifications are NOT used - all notifications are in-app only.**

### Notification Service Functions

```typescript
// Notification types enum
enum NotificationType {
  BILL_DUE = 'bill_due',
  BILL_OVERDUE = 'bill_overdue',
  BUDGET_WARNING = 'budget_warning',
  BUDGET_EXCEEDED = 'budget_exceeded',
  LOW_BALANCE = 'low_balance',
  SAVINGS_MILESTONE = 'savings_milestone',
  DEBT_MILESTONE = 'debt_milestone',
  SPENDING_SUMMARY = 'spending_summary',
  REMINDER = 'reminder',
  SYSTEM = 'system'
}

// Create notification
export const createNotification = async (
  userId: string,
  householdId: string | null,
  notification: {
    type: NotificationType;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    title: string;
    message: string;
    actionUrl?: string;
    entityType?: string;
    entityId?: string;
    actionLabel?: string;
    scheduledFor?: Date;
    expiresAt?: Date;
    metadata?: any;
  }
) => {
  const notif = await db
    .insert(notifications)
    .values({
      user_id: userId,
      household_id: householdId,
      type: notification.type,
      priority: notification.priority || 'normal',
      title: notification.title,
      message: notification.message,
      action_url: notification.actionUrl,
      entity_type: notification.entityType,
      entity_id: notification.entityId,
      action_label: notification.actionLabel,
      scheduled_for: notification.scheduledFor,
      expires_at: notification.expiresAt,
      metadata: notification.metadata ? JSON.stringify(notification.metadata) : null,
      sent_at: notification.scheduledFor ? null : new Date(),
      created_at: new Date()
    })
    .returning();

  // Send push notification if not scheduled
  if (!notification.scheduledFor) {
    await sendPushNotification(userId, notif[0]);
  }

  return notif[0];
};

// Get user notifications
export const getUserNotifications = async (
  userId: string,
  filters: {
    unreadOnly?: boolean;
    type?: NotificationType;
    limit?: number;
  } = {}
) => {
  const conditions = [
    eq(notifications.user_id, userId),
    eq(notifications.is_dismissed, false)
  ];

  if (filters.unreadOnly) {
    conditions.push(eq(notifications.is_read, false));
  }

  if (filters.type) {
    conditions.push(eq(notifications.type, filters.type));
  }

  const query = db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(
      desc(notifications.priority),
      desc(notifications.created_at)
    );

  if (filters.limit) {
    return await query.limit(filters.limit);
  }

  return await query;
};

// Mark notification as read
export const markNotificationRead = async (notificationId: string, userId: string) => {
  await db
    .update(notifications)
    .set({
      is_read: true,
      read_at: new Date()
    })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.user_id, userId)
    ));
};

// Mark all notifications as read
export const markAllNotificationsRead = async (userId: string) => {
  await db
    .update(notifications)
    .set({
      is_read: true,
      read_at: new Date()
    })
    .where(and(
      eq(notifications.user_id, userId),
      eq(notifications.is_read, false)
    ));
};

// Dismiss notification
export const dismissNotification = async (notificationId: string, userId: string) => {
  await db
    .update(notifications)
    .set({
      is_dismissed: true,
      dismissed_at: new Date()
    })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.user_id, userId)
    ));
};

// Get unread count
export const getUnreadNotificationCount = async (userId: string) => {
  const result = await db
    .select({
      count: sql<number>`COUNT(*)`
    })
    .from(notifications)
    .where(and(
      eq(notifications.user_id, userId),
      eq(notifications.is_read, false),
      eq(notifications.is_dismissed, false)
    ));

  return result[0]?.count || 0;
};

// Get/create user notification preferences
export const getUserNotificationPreferences = async (userId: string) => {
  const existing = await db
    .select()
    .from(notification_preferences)
    .where(eq(notification_preferences.user_id, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create default preferences
  const newPrefs = await db
    .insert(notification_preferences)
    .values({
      user_id: userId,
      created_at: new Date()
    })
    .returning();

  return newPrefs[0];
};

// Update notification preferences
export const updateNotificationPreferences = async (
  userId: string,
  preferences: Partial<NotificationPreferences>
) => {
  await db
    .update(notification_preferences)
    .set({
      ...preferences,
      updated_at: new Date()
    })
    .where(eq(notification_preferences.user_id, userId));
};

// Bill reminder generator (run daily via cron)
export const generateBillReminders = async () => {
  const today = new Date();
  
  // Get all active bill instances
  const upcomingBills = await db
    .select({
      bill_instance_id: bill_instances.id,
      bill_name: bills.name,
      user_id: bills.user_id,
      household_id: household_members.household_id,
      due_date: bill_instances.due_date,
      expected_amount: bill_instances.expected_amount,
      status: bill_instances.status
    })
    .from(bill_instances)
    .innerJoin(bills, eq(bill_instances.bill_id, bills.id))
    .leftJoin(household_members, eq(bills.user_id, household_members.user_id))
    .where(eq(bill_instances.status, 'pending'));

  for (const bill of upcomingBills) {
    const dueDate = new Date(bill.due_date);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Get user preferences
    const prefs = await getUserNotificationPreferences(bill.user_id);
    
    // Check if already sent reminder for this bill today
    const existingReminder = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.user_id, bill.user_id),
        eq(notifications.entity_id, bill.bill_instance_id),
        gte(notifications.created_at, new Date(today.setHours(0, 0, 0, 0)))
      ))
      .limit(1);

    if (existingReminder.length > 0) continue;

    // Send reminder X days before
    if (daysUntilDue === prefs.bill_reminder_days_before && prefs.bill_reminder_enabled) {
      await createNotification(bill.user_id, bill.household_id, {
        type: NotificationType.BILL_DUE,
        priority: 'normal',
        title: `Bill Due in ${daysUntilDue} Days`,
        message: `${bill.bill_name} ($${bill.expected_amount}) is due on ${format(dueDate, 'MMM d')}`,
        actionUrl: `/bills/${bill.bill_instance_id}`,
        actionLabel: 'Pay Bill',
        entityType: 'bill_instance',
        entityId: bill.bill_instance_id,
        expiresAt: dueDate
      });
    }

    // Send reminder on due date
    if (daysUntilDue === 0 && prefs.bill_reminder_on_due_date) {
      await createNotification(bill.user_id, bill.household_id, {
        type: NotificationType.BILL_DUE,
        priority: 'high',
        title: 'Bill Due Today',
        message: `${bill.bill_name} ($${bill.expected_amount}) is due today`,
        actionUrl: `/bills/${bill.bill_instance_id}`,
        actionLabel: 'Pay Now',
        entityType: 'bill_instance',
        entityId: bill.bill_instance_id
      });
    }

    // Send overdue reminder
    if (daysUntilDue < 0 && prefs.bill_overdue_reminder) {
      await createNotification(bill.user_id, bill.household_id, {
        type: NotificationType.BILL_OVERDUE,
        priority: 'urgent',
        title: 'Overdue Bill',
        message: `${bill.bill_name} ($${bill.expected_amount}) is ${Math.abs(daysUntilDue)} days overdue`,
        actionUrl: `/bills/${bill.bill_instance_id}`,
        actionLabel: 'Pay Now',
        entityType: 'bill_instance',
        entityId: bill.bill_instance_id
      });
    }
  }
};

// Budget warning checker (run after each transaction)
export const checkBudgetWarnings = async (
  userId: string,
  householdId: string | null,
  categoryId: string,
  month: number,
  year: number
) => {
  const prefs = await getUserNotificationPreferences(userId);
  if (!prefs.budget_warning_enabled && !prefs.budget_exceeded_alert) return;

  // Get category budget and actual spending
  const category = await db
    .select()
    .from(budget_categories)
    .where(eq(budget_categories.id, categoryId))
    .limit(1);

  if (category.length === 0 || category[0].monthly_budget === 0) return;

  const budget = category[0].monthly_budget;
  
  // Get actual spending for this month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const spendingResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
    })
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      eq(transactions.category_id, categoryId),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate)
    ));

  const spending = Math.abs(spendingResult[0]?.total || 0);
  const percentUsed = (spending / budget) * 100;

  // Check if exceeded
  if (percentUsed >= 100 && prefs.budget_exceeded_alert) {
    await createNotification(userId, householdId, {
      type: NotificationType.BUDGET_EXCEEDED,
      priority: 'high',
      title: 'Budget Exceeded',
      message: `You've exceeded your ${category[0].name} budget by $${(spending - budget).toFixed(2)}`,
      actionUrl: `/budget/${categoryId}`,
      actionLabel: 'View Budget',
      entityType: 'budget_category',
      entityId: categoryId
    });
  }
  // Check if approaching limit
  else if (percentUsed >= prefs.budget_warning_threshold && prefs.budget_warning_enabled) {
    await createNotification(userId, householdId, {
      type: NotificationType.BUDGET_WARNING,
      priority: 'normal',
      title: 'Budget Warning',
      message: `You've used ${percentUsed.toFixed(0)}% of your ${category[0].name} budget ($${spending.toFixed(2)} of $${budget})`,
      actionUrl: `/budget/${categoryId}`,
      actionLabel: 'View Budget',
      entityType: 'budget_category',
      entityId: categoryId
    });
  }
};

// Low balance checker (run after each transaction)
export const checkLowBalance = async (
  userId: string,
  householdId: string | null,
  accountId: string
) => {
  const prefs = await getUserNotificationPreferences(userId);
  if (!prefs.low_balance_alert_enabled) return;

  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (account.length === 0) return;

  const balance = account[0].current_balance;
  
  // Check if balance is below threshold
  if (balance < prefs.low_balance_threshold && balance > 0) {
    await createNotification(userId, householdId, {
      type: NotificationType.LOW_BALANCE,
      priority: 'high',
      title: 'Low Account Balance',
      message: `${account[0].name} balance is low: $${balance.toFixed(2)}`,
      actionUrl: `/accounts/${accountId}`,
      actionLabel: 'View Account',
      entityType: 'account',
      entityId: accountId
    });
  }
};

// Savings milestone checker
export const checkSavingsMilestone = async (
  userId: string,
  householdId: string | null,
  goalId: string
) => {
  const prefs = await getUserNotificationPreferences(userId);
  if (!prefs.savings_milestone_enabled) return;

  const goal = await db
    .select()
    .from(savings_goals)
    .where(eq(savings_goals.id, goalId))
    .limit(1);

  if (goal.length === 0) return;

  const percentComplete = (goal[0].current_amount / goal[0].target_amount) * 100;
  
  // Notify at 25%, 50%, 75%, and 100%
  const milestones = [25, 50, 75, 100];
  for (const milestone of milestones) {
    if (Math.floor(percentComplete) === milestone) {
      await createNotification(userId, householdId, {
        type: NotificationType.SAVINGS_MILESTONE,
        priority: milestone === 100 ? 'high' : 'normal',
        title: milestone === 100 ? '🎉 Goal Completed!' : `${milestone}% to Goal`,
        message: milestone === 100 
          ? `Congratulations! You've reached your ${goal[0].name} goal of $${goal[0].target_amount}!`
          : `You're ${milestone}% of the way to your ${goal[0].name} goal ($${goal[0].current_amount} of $${goal[0].target_amount})`,
        actionUrl: `/goals/${goalId}`,
        actionLabel: 'View Goal',
        entityType: 'savings_goal',
        entityId: goalId
      });
    }
  }
};

// Weekly spending summary (run via cron)
export const generateWeeklySummary = async (userId: string, householdId: string | null) => {
  const prefs = await getUserNotificationPreferences(userId);
  if (!prefs.weekly_summary_enabled) return;

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get spending for last week
  const spendingResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`,
      count: sql<number>`COUNT(*)`
    })
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      eq(transactions.type, 'expense'),
      gte(transactions.date, weekAgo),
      lte(transactions.date, today)
    ));

  const totalSpent = spendingResult[0]?.total || 0;
  const transactionCount = spendingResult[0]?.count || 0;

  await createNotification(userId, householdId, {
    type: NotificationType.SPENDING_SUMMARY,
    priority: 'low',
    title: 'Weekly Spending Summary',
    message: `Last week you spent $${totalSpent.toFixed(2)} across ${transactionCount} transactions`,
    actionUrl: '/reports/weekly',
    actionLabel: 'View Details',
    expiresAt: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) // Expire in 1 week
  });
};

// Push notification sender (for PWA)
export const sendPushNotification = async (userId: string, notification: any) => {
  // Get user's push subscriptions
  const subscriptions = await db
    .select()
    .from(push_subscriptions)
    .where(and(
      eq(push_subscriptions.user_id, userId),
      eq(push_subscriptions.is_active, true)
    ));

  if (subscriptions.length === 0) return;

  // Check quiet hours
  const prefs = await getUserNotificationPreferences(userId);
  if (!prefs.push_notifications_enabled) return;

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

  if (prefs.quiet_hours_start && prefs.quiet_hours_end) {
    if (currentTime >= prefs.quiet_hours_start || currentTime <= prefs.quiet_hours_end) {
      // In quiet hours, skip
      return;
    }
  }

  // Send to all subscriptions
  const webPush = require('web-push');
  
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: {
      url: notification.action_url,
      notificationId: notification.id
    }
  });

  const promises = subscriptions.map(sub =>
    webPush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh_key,
          auth: sub.auth_key
        }
      },
      payload
    ).catch(error => {
      // If subscription is no longer valid, mark as inactive
      if (error.statusCode === 410) {
        db.update(push_subscriptions)
          .set({ is_active: false })
          .where(eq(push_subscriptions.id, sub.id));
      }
    })
  );

  await Promise.all(promises);
};

// Subscribe to push notifications
export const subscribeToPushNotifications = async (
  userId: string,
  subscription: PushSubscription
) => {
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys.p256dh;
  const auth = subscription.keys.auth;

  await db
    .insert(push_subscriptions)
    .values({
      user_id: userId,
      endpoint,
      p256dh_key: p256dh,
      auth_key: auth,
      user_agent: navigator.userAgent,
      is_active: true,
      created_at: new Date()
    })
    .onConflictDoUpdate({
      target: [push_subscriptions.endpoint],
      set: {
        is_active: true,
        last_used_at: new Date()
      }
    });
};
```

### UI Components for Notifications

```tsx
// Notification Bell Icon with Badge
const NotificationBell = ({ userId }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const loadNotifications = async () => {
      const count = await getUnreadNotificationCount(userId);
      setUnreadCount(count);
      
      const notifs = await getUserNotifications(userId, { limit: 5 });
      setNotifications(notifs);
    };
    
    loadNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-background border rounded-lg shadow-lg z-50">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await markAllNotificationsRead(userId);
                  setUnreadCount(0);
                }}
              >
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map(notif => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onRead={() => {
                    markNotificationRead(notif.id, userId);
                    setUnreadCount(prev => Math.max(0, prev - 1));
                  }}
                  onDismiss={() => {
                    dismissNotification(notif.id, userId);
                    setNotifications(prev => prev.filter(n => n.id !== notif.id));
                  }}
                />
              ))
            )}
          </div>

          <div className="p-2 border-t">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => window.location.href = '/notifications'}
            >
              View All Notifications
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// Individual Notification Item
const NotificationItem = ({ notification, onRead, onDismiss }) => {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'border-l-4 border-l-red-500 bg-red-50';
      case 'high': return 'border-l-4 border-l-orange-500 bg-orange-50';
      case 'normal': return 'border-l-4 border-l-blue-500';
      case 'low': return 'border-l-4 border-l-gray-300';
      default: return '';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'bill_due':
      case 'bill_overdue':
        return <Receipt className="h-5 w-5" />;
      case 'budget_warning':
      case 'budget_exceeded':
        return <AlertTriangle className="h-5 w-5" />;
      case 'low_balance':
        return <DollarSign className="h-5 w-5" />;
      case 'savings_milestone':
        return <TrendingUp className="h-5 w-5" />;
      case 'debt_milestone':
        return <CreditCard className="h-5 w-5" />;
      case 'spending_summary':
        return <BarChart3 className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  return (
    <div
      className={`p-3 border-b hover:bg-muted cursor-pointer ${getPriorityColor(notification.priority)} ${!notification.is_read ? 'bg-blue-50/50' : ''}`}
      onClick={() => {
        if (!notification.is_read) onRead();
        if (notification.action_url) {
          window.location.href = notification.action_url;
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${notification.priority === 'urgent' ? 'text-red-600' : notification.priority === 'high' ? 'text-orange-600' : 'text-blue-600'}`}>
          {getTypeIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm">{notification.title}</h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </span>
            
            {notification.action_label && (
              <span className="text-xs font-medium text-blue-600">
                {notification.action_label} →
              </span>
            )}
          </div>
        </div>

        {!notification.is_read && (
          <div className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
        )}
      </div>
    </div>
  );
};

// Notification Preferences Settings
const NotificationPreferencesSettings = ({ userId }) => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      const prefs = await getUserNotificationPreferences(userId);
      setPreferences(prefs);
      setLoading(false);
    };
    loadPreferences();
  }, [userId]);

  const handleUpdate = async (updates) => {
    await updateNotificationPreferences(userId, updates);
    setPreferences({ ...preferences, ...updates });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose when and how you want to be notified</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Bill Reminders */}
        <div className="space-y-4">
          <h3 className="font-medium">Bill Reminders</h3>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Enable bill reminders</label>
              <p className="text-xs text-muted-foreground">Get reminded before bills are due</p>
            </div>
            <Switch
              checked={preferences.bill_reminder_enabled}
              onCheckedChange={(checked) => handleUpdate({ bill_reminder_enabled: checked })}
            />
          </div>

          {preferences.bill_reminder_enabled && (
            <div>
              <label className="text-sm font-medium">Remind me</label>
              <Select
                value={String(preferences.bill_reminder_days_before)}
                onValueChange={(value) => handleUpdate({ bill_reminder_days_before: parseInt(value) })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day before</SelectItem>
                  <SelectItem value="2">2 days before</SelectItem>
                  <SelectItem value="3">3 days before</SelectItem>
                  <SelectItem value="5">5 days before</SelectItem>
                  <SelectItem value="7">7 days before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Remind on due date</label>
            <Switch
              checked={preferences.bill_reminder_on_due_date}
              onCheckedChange={(checked) => handleUpdate({ bill_reminder_on_due_date: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Overdue bill alerts</label>
            <Switch
              checked={preferences.bill_overdue_reminder}
              onCheckedChange={(checked) => handleUpdate({ bill_overdue_reminder: checked })}
            />
          </div>
        </div>

        <Separator />

        {/* Budget Alerts */}
        <div className="space-y-4">
          <h3 className="font-medium">Budget Alerts</h3>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Budget warnings</label>
              <p className="text-xs text-muted-foreground">Get warned when approaching budget limit</p>
            </div>
            <Switch
              checked={preferences.budget_warning_enabled}
              onCheckedChange={(checked) => handleUpdate({ budget_warning_enabled: checked })}
            />
          </div>

          {preferences.budget_warning_enabled && (
            <div>
              <label className="text-sm font-medium">Warning threshold</label>
              <Select
                value={String(preferences.budget_warning_threshold)}
                onValueChange={(value) => handleUpdate({ budget_warning_threshold: parseInt(value) })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="70">70% of budget</SelectItem>
                  <SelectItem value="80">80% of budget</SelectItem>
                  <SelectItem value="90">90% of budget</SelectItem>
                  <SelectItem value="95">95% of budget</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Budget exceeded alerts</label>
            <Switch
              checked={preferences.budget_exceeded_alert}
              onCheckedChange={(checked) => handleUpdate({ budget_exceeded_alert: checked })}
            />
          </div>
        </div>

        <Separator />

        {/* Account Alerts */}
        <div className="space-y-4">
          <h3 className="font-medium">Account Alerts</h3>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Low balance alerts</label>
              <p className="text-xs text-muted-foreground">Get notified when account balance is low</p>
            </div>
            <Switch
              checked={preferences.low_balance_alert_enabled}
              onCheckedChange={(checked) => handleUpdate({ low_balance_alert_enabled: checked })}
            />
          </div>

          {preferences.low_balance_alert_enabled && (
            <div>
              <label className="text-sm font-medium">Low balance threshold</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2">$</span>
                <Input
                  type="number"
                  value={preferences.low_balance_threshold}
                  onChange={(e) => handleUpdate({ low_balance_threshold: parseFloat(e.target.value) })}
                  className="pl-6"
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Delivery Preferences */}
        <div className="space-y-4">
          <h3 className="font-medium">Delivery Preferences</h3>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Push notifications</label>
              <p className="text-xs text-muted-foreground">Receive notifications on this device</p>
            </div>
            <Switch
              checked={preferences.push_notifications_enabled}
              onCheckedChange={(checked) => handleUpdate({ push_notifications_enabled: checked })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Quiet hours start</label>
              <Input
                type="time"
                value={preferences.quiet_hours_start || '22:00'}
                onChange={(e) => handleUpdate({ quiet_hours_start: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Quiet hours end</label>
              <Input
                type="time"
                value={preferences.quiet_hours_end || '07:00'}
                onChange={(e) => handleUpdate({ quiet_hours_end: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Request push notification permission
const RequestPushNotificationPermission = ({ userId }) => {
  const [permission, setPermission] = useState(Notification.permission);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      // Register service worker and subscribe
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      });

      await subscribeToPushNotifications(userId, subscription);
      showToast('Push notifications enabled!');
    }
  };

  if (permission === 'granted') {
    return null; // Already granted
  }

  return (
    <Alert>
      <Bell className="h-4 w-4" />
      <AlertTitle>Enable Notifications</AlertTitle>
      <AlertDescription>
        Get important reminders about bills, budgets, and financial milestones.
        <Button onClick={requestPermission} size="sm" className="mt-2">
          Enable Notifications
        </Button>
      </AlertDescription>
    </Alert>
  );
};
```

---

## 📊 Charts & Visual Reports

### Overview
Visual representation of financial data helps users understand spending patterns, budget performance, and financial health at a glance. The system provides interactive charts and reports optimized for mobile viewing.

**Dependencies:**
- `recharts` - React charting library built on D3, mobile-friendly and responsive
- `date-fns` - Date formatting and manipulation

### Chart Components & Visualizations

```tsx
// Spending by Category Pie Chart
const SpendingByCategoryChart = ({ userId, month, year }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSpending, setTotalSpending] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      const spending = await getSpendingByCategory(userId, month, year);
      setData(spending);
      setTotalSpending(spending.reduce((sum, item) => sum + item.amount, 0));
      setLoading(false);
    };
    loadData();
  }, [userId, month, year]);

  if (loading) return <Skeleton className="h-80" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
        <CardDescription>
          {format(new Date(year, month - 1), 'MMMM yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="amount"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown list */}
        <div className="mt-4 space-y-2">
          {data.map((category, index) => {
            const percentage = (category.amount / totalSpending) * 100;
            return (
              <div key={category.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color || COLORS[index % COLORS.length] }}
                  />
                  <span>{category.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>
                  <span className="font-medium">${category.amount.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// Income vs Expenses Line Chart
const IncomeVsExpensesChart = ({ userId, months = 6 }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const chartData = await getIncomeVsExpenses(userId, months);
      setData(chartData);
      setLoading(false);
    };
    loadData();
  }, [userId, months]);

  if (loading) return <Skeleton className="h-80" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs Expenses</CardTitle>
        <CardDescription>Last {months} months</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                formatter={(value) => `$${value.toFixed(2)}`}
                labelStyle={{ color: '#000' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="income" 
                stroke="#22c55e" 
                strokeWidth={2}
                name="Income"
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="expenses" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="Expenses"
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="net" 
                stroke="#3b82f6" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Net"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Monthly Spending Trends Bar Chart
const MonthlySpendingTrendsChart = ({ userId, categoryId, months = 6 }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const trends = await getMonthlySpendingTrends(userId, categoryId, months);
      setData(trends);
      setLoading(false);
    };
    loadData();
  }, [userId, categoryId, months]);

  if (loading) return <Skeleton className="h-80" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Spending Trends</CardTitle>
        <CardDescription>Last {months} months</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                formatter={(value) => `$${value.toFixed(2)}`}
                labelStyle={{ color: '#000' }}
              />
              <Bar dataKey="amount" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Average spending indicator */}
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Average: </span>
            <span className="font-medium">
              ${(data.reduce((sum, d) => sum + d.amount, 0) / data.length).toFixed(2)}
            </span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div>
            <span className="text-muted-foreground">Highest: </span>
            <span className="font-medium">
              ${Math.max(...data.map(d => d.amount)).toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Budget Progress Bars
const BudgetProgressChart = ({ userId, month, year }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const budgetData = await getBudgetProgress(userId, month, year);
      setCategories(budgetData);
      setLoading(false);
    };
    loadData();
  }, [userId, month, year]);

  if (loading) return <Skeleton className="h-80" />;

  const getProgressColor = (percent) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 80) return 'bg-orange-500';
    if (percent >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Progress</CardTitle>
        <CardDescription>
          {format(new Date(year, month - 1), 'MMMM yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.map((category) => {
          const percent = (category.spent / category.budget) * 100;
          const remaining = Math.max(0, category.budget - category.spent);
          
          return (
            <div key={category.id} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{category.name}</span>
                <span className="text-muted-foreground">
                  ${category.spent.toFixed(2)} / ${category.budget.toFixed(2)}
                </span>
              </div>
              
              <div className="relative">
                <Progress 
                  value={Math.min(percent, 100)} 
                  className="h-3"
                />
                <div 
                  className={`absolute top-0 left-0 h-3 rounded-full transition-all ${getProgressColor(percent)}`}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {percent.toFixed(0)}% used
                </span>
                {remaining > 0 ? (
                  <span className="text-green-600">
                    ${remaining.toFixed(2)} remaining
                  </span>
                ) : (
                  <span className="text-red-600">
                    ${Math.abs(remaining).toFixed(2)} over budget
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

// Net Worth Over Time Area Chart
const NetWorthChart = ({ userId, months = 12 }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const netWorthData = await getNetWorthHistory(userId, months);
      setData(netWorthData);
      setLoading(false);
    };
    loadData();
  }, [userId, months]);

  if (loading) return <Skeleton className="h-80" />;

  const currentNetWorth = data[data.length - 1]?.netWorth || 0;
  const previousNetWorth = data[0]?.netWorth || 0;
  const change = currentNetWorth - previousNetWorth;
  const changePercent = previousNetWorth !== 0 ? (change / Math.abs(previousNetWorth)) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Net Worth</CardTitle>
            <CardDescription>Last {months} months</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              ${currentNetWorth.toLocaleString()}
            </div>
            <div className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{change.toLocaleString()} ({changePercent.toFixed(1)}%)
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip 
                formatter={(value) => `$${value.toLocaleString()}`}
                labelStyle={{ color: '#000' }}
              />
              <Area 
                type="monotone" 
                dataKey="netWorth" 
                stroke="#3b82f6" 
                fillOpacity={1} 
                fill="url(#colorNetWorth)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Category Comparison Chart (current vs previous month)
const CategoryComparisonChart = ({ userId, currentMonth, currentYear }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const comparison = await getCategoryComparison(userId, currentMonth, currentYear);
      setData(comparison);
      setLoading(false);
    };
    loadData();
  }, [userId, currentMonth, currentYear]);

  if (loading) return <Skeleton className="h-80" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Month-over-Month Comparison</CardTitle>
        <CardDescription>Current vs Previous Month</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => `$${value}`} />
              <YAxis dataKey="category" type="category" width={100} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="current" fill="#3b82f6" name="This Month" />
              <Bar dataKey="previous" fill="#94a3b8" name="Last Month" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Debt Payoff Progress Chart
const DebtPayoffProgressChart = ({ userId, strategy = 'snowball' }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const projection = await getDebtPayoffProjection(userId, strategy);
      setData(projection);
      setLoading(false);
    };
    loadData();
  }, [userId, strategy]);

  if (loading) return <Skeleton className="h-80" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Debt Payoff Projection</CardTitle>
        <CardDescription>{strategy === 'snowball' ? 'Snowball' : 'Avalanche'} Method</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip 
                formatter={(value) => `$${value.toLocaleString()}`}
                labelStyle={{ color: '#000' }}
              />
              <Area 
                type="monotone" 
                dataKey="totalDebt" 
                stroke="#ef4444" 
                fillOpacity={1} 
                fill="url(#colorDebt)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Debt-free date */}
        {data.length > 0 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">Debt-free date</p>
            <p className="text-lg font-bold text-green-600">
              {format(new Date(data[data.length - 1].date), 'MMMM yyyy')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Savings Goals Progress
const SavingsGoalsChart = ({ userId }) => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const savingsGoals = await getSavingsGoalsWithProgress(userId);
      setGoals(savingsGoals);
      setLoading(false);
    };
    loadData();
  }, [userId]);

  if (loading) return <Skeleton className="h-80" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings Goals</CardTitle>
        <CardDescription>Progress towards your goals</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {goals.map((goal) => {
          const percent = (goal.current / goal.target) * 100;
          const remaining = goal.target - goal.current;
          const monthsRemaining = goal.monthlyContribution > 0 
            ? Math.ceil(remaining / goal.monthlyContribution)
            : null;

          return (
            <div key={goal.id} className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium">{goal.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    ${goal.current.toLocaleString()} of ${goal.target.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{percent.toFixed(0)}%</div>
                  {monthsRemaining && (
                    <div className="text-xs text-muted-foreground">
                      {monthsRemaining} months left
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <Progress value={Math.min(percent, 100)} className="h-4" />
                <div 
                  className="absolute top-0 left-0 h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>

              {remaining > 0 && (
                <div className="text-sm text-muted-foreground">
                  ${remaining.toLocaleString()} remaining
                  {goal.monthlyContribution > 0 && (
                    <span> • ${goal.monthlyContribution}/month</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {goals.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No savings goals yet</p>
            <Button variant="outline" size="sm" className="mt-2">
              Create Your First Goal
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Dashboard Summary Cards
const DashboardSummaryCards = ({ userId, month, year }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const data = await getDashboardSummary(userId, month, year);
      setSummary(data);
      setLoading(false);
    };
    loadData();
  }, [userId, month, year]);

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Income</p>
              <p className="text-2xl font-bold text-green-600">
                ${summary.income.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600 opacity-20" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                ${summary.expenses.toLocaleString()}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600 opacity-20" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net</p>
              <p className={`text-2xl font-bold ${summary.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.net >= 0 ? '+' : ''}${summary.net.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 opacity-20" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Savings Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {summary.savingsRate.toFixed(1)}%
              </p>
            </div>
            <PiggyBank className="h-8 w-8 text-blue-600 opacity-20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

### Data Fetching Functions

```typescript
// Get spending by category
export const getSpendingByCategory = async (
  userId: string,
  month: number,
  year: number
) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const result = await db
    .select({
      categoryId: transactions.category_id,
      categoryName: budget_categories.name,
      categoryColor: budget_categories.color,
      amount: sql<number>`SUM(ABS(${transactions.amount}))`
    })
    .from(transactions)
    .leftJoin(budget_categories, eq(transactions.category_id, budget_categories.id))
    .where(and(
      eq(transactions.user_id, userId),
      eq(transactions.type, 'expense'),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate)
    ))
    .groupBy(transactions.category_id, budget_categories.name)
    .orderBy(desc(sql`SUM(ABS(${transactions.amount}))`));

  return result.map(item => ({
    name: item.categoryName || 'Uncategorized',
    amount: item.amount,
    color: item.categoryColor
  }));
};

// Get income vs expenses over time
export const getIncomeVsExpenses = async (userId: string, months: number) => {
  const data = [];
  const today = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const [incomeResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
      })
      .from(transactions)
      .where(and(
        eq(transactions.user_id, userId),
        eq(transactions.type, 'income'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      ));

    const [expensesResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`
      })
      .from(transactions)
      .where(and(
        eq(transactions.user_id, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      ));

    const income = incomeResult.total;
    const expenses = expensesResult.total;

    data.push({
      month: format(date, 'MMM'),
      income,
      expenses,
      net: income - expenses
    });
  }

  return data;
};

// Get budget progress
export const getBudgetProgress = async (
  userId: string,
  month: number,
  year: number
) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Get all categories with budgets
  const categories = await db
    .select()
    .from(budget_categories)
    .where(and(
      eq(budget_categories.user_id, userId),
      eq(budget_categories.is_active, true),
      gt(budget_categories.monthly_budget, 0)
    ));

  // Get spending for each category
  const progress = await Promise.all(
    categories.map(async (category) => {
      const [result] = await db
        .select({
          spent: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`
        })
        .from(transactions)
        .where(and(
          eq(transactions.user_id, userId),
          eq(transactions.category_id, category.id),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        ));

      return {
        id: category.id,
        name: category.name,
        budget: category.monthly_budget,
        spent: result.spent
      };
    })
  );

  return progress;
};

// Get net worth history
export const getNetWorthHistory = async (userId: string, months: number) => {
  const data = [];
  const today = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    // Calculate total assets (account balances at end of month)
    const assets = await calculateAssetsAtDate(userId, endDate);
    
    // Calculate total debts at end of month
    const debts = await calculateDebtsAtDate(userId, endDate);

    data.push({
      month: format(date, 'MMM yy'),
      netWorth: assets - debts,
      date: endDate
    });
  }

  return data;
};

// Get dashboard summary
export const getDashboardSummary = async (
  userId: string,
  month: number,
  year: number
) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const [incomeResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
    })
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      eq(transactions.type, 'income'),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate)
    ));

  const [expensesResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`
    })
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      eq(transactions.type, 'expense'),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate)
    ));

  const income = incomeResult.total;
  const expenses = expensesResult.total;
  const net = income - expenses;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;

  return {
    income,
    expenses,
    net,
    savingsRate
  };
};
```

### Reports Dashboard Page

```tsx
const ReportsDashboard = ({ userId }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [timeRange, setTimeRange] = useState(6); // months

  return (
    <div className="space-y-6 p-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Financial Reports</h1>
        
        <div className="flex items-center gap-2">
          <Select value={String(timeRange)} onValueChange={(v) => setTimeRange(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 months</SelectItem>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
              <SelectItem value="24">24 months</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <DashboardSummaryCards userId={userId} month={selectedMonth} year={selectedYear} />

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeVsExpensesChart userId={userId} months={timeRange} />
        <SpendingByCategoryChart userId={userId} month={selectedMonth} year={selectedYear} />
        <BudgetProgressChart userId={userId} month={selectedMonth} year={selectedYear} />
        <NetWorthChart userId={userId} months={timeRange} />
        <CategoryComparisonChart userId={userId} currentMonth={selectedMonth} currentYear={selectedYear} />
        <MonthlySpendingTrendsChart userId={userId} categoryId={null} months={timeRange} />
      </div>

      {/* Savings and debt section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SavingsGoalsChart userId={userId} />
        <DebtPayoffProgressChart userId={userId} strategy="snowball" />
      </div>
    </div>
  );
};
```

---

## ✂️ Split Transactions

### Overview
Split transactions allow users to divide a single purchase across multiple budget categories. This is essential for stores like Target or Costco where you might buy groceries, household items, and clothing in one transaction. The system maintains the original transaction total while breaking down the categorical spending.

### Core Split Transaction Functions

```typescript
// Create a split transaction
export const createSplitTransaction = async (
  userId: string,
  transactionData: {
    accountId: string;
    date: Date;
    amount: number;
    description: string;
    notes?: string;
    splits: Array<{
      categoryId: string;
      amount: number;
      description?: string;
    }>;
  }
) => {
  // Validate that splits add up to total
  const splitTotal = transactionData.splits.reduce((sum, split) => sum + split.amount, 0);
  if (Math.abs(splitTotal - transactionData.amount) > 0.01) {
    throw new Error(`Split amounts ($${splitTotal}) must equal transaction total ($${transactionData.amount})`);
  }

  // Validate at least 2 splits
  if (transactionData.splits.length < 2) {
    throw new Error('Split transactions must have at least 2 categories');
  }

  return await db.transaction(async (tx) => {
    // Create parent transaction with is_split = true
    const [transaction] = await tx
      .insert(transactions)
      .values({
        id: generateId(),
        user_id: userId,
        account_id: transactionData.accountId,
        date: transactionData.date,
        amount: transactionData.amount,
        description: transactionData.description,
        notes: transactionData.notes,
        type: 'expense',
        is_split: true,
        category_id: null // Split transactions don't have a single category
      })
      .returning();

    // Create split items
    const splitItems = await Promise.all(
      transactionData.splits.map(async (split, index) => {
        const [splitItem] = await tx
          .insert(transaction_splits)
          .values({
            id: generateId(),
            transaction_id: transaction.id,
            category_id: split.categoryId,
            amount: split.amount,
            description: split.description,
            percentage: (split.amount / transactionData.amount) * 100,
            sort_order: index
          })
          .returning();

        // Track category usage for each split
        await trackCategoryUsage(userId, split.categoryId);

        return splitItem;
      })
    );

    // Update account balance
    await tx
      .update(accounts)
      .set({
        current_balance: sql`${accounts.current_balance} - ${transactionData.amount}`,
        updated_at: new Date()
      })
      .where(eq(accounts.id, transactionData.accountId));

    // Track account usage
    await trackAccountUsage(userId, transactionData.accountId);

    return {
      transaction,
      splits: splitItems
    };
  });
};

// Get transaction with splits
export const getTransactionWithSplits = async (transactionId: string) => {
  const transaction = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!transaction.length) {
    throw new Error('Transaction not found');
  }

  if (!transaction[0].is_split) {
    return {
      transaction: transaction[0],
      splits: []
    };
  }

  const splits = await db
    .select({
      id: transaction_splits.id,
      categoryId: transaction_splits.category_id,
      categoryName: budget_categories.name,
      categoryColor: budget_categories.color,
      amount: transaction_splits.amount,
      description: transaction_splits.description,
      percentage: transaction_splits.percentage,
      sortOrder: transaction_splits.sort_order
    })
    .from(transaction_splits)
    .leftJoin(budget_categories, eq(transaction_splits.category_id, budget_categories.id))
    .where(eq(transaction_splits.transaction_id, transactionId))
    .orderBy(transaction_splits.sort_order);

  return {
    transaction: transaction[0],
    splits
  };
};

// Update split transaction
export const updateSplitTransaction = async (
  transactionId: string,
  userId: string,
  updates: {
    date?: Date;
    amount?: number;
    description?: string;
    notes?: string;
    splits?: Array<{
      id?: string; // if updating existing split
      categoryId: string;
      amount: number;
      description?: string;
    }>;
  }
) => {
  const existing = await getTransactionWithSplits(transactionId);

  if (!existing.transaction.is_split) {
    throw new Error('Transaction is not a split transaction');
  }

  // If splits are being updated, validate totals
  if (updates.splits) {
    const newTotal = updates.amount || existing.transaction.amount;
    const splitTotal = updates.splits.reduce((sum, split) => sum + split.amount, 0);
    
    if (Math.abs(splitTotal - newTotal) > 0.01) {
      throw new Error(`Split amounts ($${splitTotal}) must equal transaction total ($${newTotal})`);
    }
  }

  return await db.transaction(async (tx) => {
    // Update parent transaction
    const updateData: any = {
      updated_at: new Date()
    };

    if (updates.date) updateData.date = updates.date;
    if (updates.amount) {
      // Adjust account balance
      const balanceDiff = updates.amount - existing.transaction.amount;
      await tx
        .update(accounts)
        .set({
          current_balance: sql`${accounts.current_balance} - ${balanceDiff}`,
          updated_at: new Date()
        })
        .where(eq(accounts.id, existing.transaction.account_id));
      
      updateData.amount = updates.amount;
    }
    if (updates.description) updateData.description = updates.description;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const [updatedTransaction] = await tx
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.id, transactionId))
      .returning();

    // Update splits if provided
    if (updates.splits) {
      // Delete existing splits
      await tx
        .delete(transaction_splits)
        .where(eq(transaction_splits.transaction_id, transactionId));

      // Create new splits
      const newSplits = await Promise.all(
        updates.splits.map(async (split, index) => {
          const [splitItem] = await tx
            .insert(transaction_splits)
            .values({
              id: generateId(),
              transaction_id: transactionId,
              category_id: split.categoryId,
              amount: split.amount,
              description: split.description,
              percentage: (split.amount / updatedTransaction.amount) * 100,
              sort_order: index
            })
            .returning();

          return splitItem;
        })
      );

      return {
        transaction: updatedTransaction,
        splits: newSplits
      };
    }

    return {
      transaction: updatedTransaction,
      splits: existing.splits
    };
  });
};

// Convert regular transaction to split transaction
export const convertToSplitTransaction = async (
  transactionId: string,
  userId: string,
  splits: Array<{
    categoryId: string;
    amount: number;
    description?: string;
  }>
) => {
  const [existing] = await db
    .select()
    .from(transactions)
    .where(and(
      eq(transactions.id, transactionId),
      eq(transactions.user_id, userId)
    ))
    .limit(1);

  if (!existing) {
    throw new Error('Transaction not found');
  }

  if (existing.is_split) {
    throw new Error('Transaction is already split');
  }

  // Validate splits
  const splitTotal = splits.reduce((sum, split) => sum + split.amount, 0);
  if (Math.abs(splitTotal - existing.amount) > 0.01) {
    throw new Error(`Split amounts must equal transaction total of $${existing.amount}`);
  }

  if (splits.length < 2) {
    throw new Error('Must provide at least 2 split categories');
  }

  return await db.transaction(async (tx) => {
    // Update transaction to be split
    await tx
      .update(transactions)
      .set({
        is_split: true,
        category_id: null,
        updated_at: new Date()
      })
      .where(eq(transactions.id, transactionId));

    // Create split items
    const splitItems = await Promise.all(
      splits.map(async (split, index) => {
        const [splitItem] = await tx
          .insert(transaction_splits)
          .values({
            id: generateId(),
            transaction_id: transactionId,
            category_id: split.categoryId,
            amount: split.amount,
            description: split.description,
            percentage: (split.amount / existing.amount) * 100,
            sort_order: index
          })
          .returning();

        return splitItem;
      })
    );

    return {
      transaction: { ...existing, is_split: true, category_id: null },
      splits: splitItems
    };
  });
};

// Convert split transaction back to regular transaction
export const convertToRegularTransaction = async (
  transactionId: string,
  userId: string,
  categoryId: string
) => {
  const existing = await getTransactionWithSplits(transactionId);

  if (!existing.transaction.is_split) {
    throw new Error('Transaction is not split');
  }

  return await db.transaction(async (tx) => {
    // Delete all splits
    await tx
      .delete(transaction_splits)
      .where(eq(transaction_splits.transaction_id, transactionId));

    // Update transaction to regular
    const [updated] = await tx
      .update(transactions)
      .set({
        is_split: false,
        category_id: categoryId,
        updated_at: new Date()
      })
      .where(eq(transactions.id, transactionId))
      .returning();

    return updated;
  });
};

// Get split transaction summary for budget calculations
export const getSplitTransactionsByCategory = async (
  userId: string,
  categoryId: string,
  startDate: Date,
  endDate: Date
) => {
  const splits = await db
    .select({
      transactionId: transactions.id,
      date: transactions.date,
      description: transactions.description,
      totalAmount: transactions.amount,
      splitAmount: transaction_splits.amount,
      splitDescription: transaction_splits.description,
      accountName: accounts.name
    })
    .from(transaction_splits)
    .innerJoin(transactions, eq(transaction_splits.transaction_id, transactions.id))
    .leftJoin(accounts, eq(transactions.account_id, accounts.id))
    .where(and(
      eq(transactions.user_id, userId),
      eq(transaction_splits.category_id, categoryId),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate)
    ))
    .orderBy(desc(transactions.date));

  return splits;
};
```

### UI Components for Split Transactions

```tsx
// Split Transaction Builder Component
const SplitTransactionBuilder = ({ 
  totalAmount, 
  onSplitsChange, 
  initialSplits = [],
  userId 
}) => {
  const [splits, setSplits] = useState(initialSplits.length > 0 ? initialSplits : [
    { categoryId: '', amount: 0, description: '' },
    { categoryId: '', amount: 0, description: '' }
  ]);
  const [categories, setCategories] = useState([]);
  const [splitMethod, setSplitMethod] = useState<'amount' | 'percentage'>('amount');

  useEffect(() => {
    loadCategories();
  }, [userId]);

  const loadCategories = async () => {
    const cats = await getCategoriesByUsage(userId, 'expense');
    setCategories(cats);
  };

  const addSplit = () => {
    setSplits([...splits, { categoryId: '', amount: 0, description: '' }]);
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 2) {
      toast.error('Split transactions must have at least 2 categories');
      return;
    }
    const newSplits = splits.filter((_, i) => i !== index);
    setSplits(newSplits);
    onSplitsChange(newSplits);
  };

  const updateSplit = (index: number, field: string, value: any) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setSplits(newSplits);
    onSplitsChange(newSplits);
  };

  const calculateRemaining = () => {
    const used = splits.reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0);
    return totalAmount - used;
  };

  const autoDistribute = () => {
    const emptyCount = splits.filter(s => !s.amount || s.amount === 0).length;
    if (emptyCount === 0) return;

    const remaining = calculateRemaining();
    const perSplit = remaining / emptyCount;

    const newSplits = splits.map(split => {
      if (!split.amount || split.amount === 0) {
        return { ...split, amount: perSplit };
      }
      return split;
    });

    setSplits(newSplits);
    onSplitsChange(newSplits);
  };

  const distributPercentage = (index: number, percentage: number) => {
    const amount = (totalAmount * percentage) / 100;
    updateSplit(index, 'amount', amount);
  };

  const remaining = calculateRemaining();
  const isValid = Math.abs(remaining) < 0.01 && splits.every(s => s.categoryId && s.amount > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Split Transaction</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={autoDistribute}
            disabled={remaining <= 0}
          >
            Auto-Distribute
          </Button>
          <Select value={splitMethod} onValueChange={setSplitMethod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amount">Amount</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Total Amount Display */}
      <Card className={cn(
        "p-4",
        Math.abs(remaining) < 0.01 ? "border-green-500" : "border-orange-500"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Transaction</p>
            <p className="text-2xl font-bold">${totalAmount.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className={cn(
              "text-2xl font-bold",
              Math.abs(remaining) < 0.01 ? "text-green-600" : "text-orange-600"
            )}>
              ${Math.abs(remaining).toFixed(2)}
            </p>
          </div>
        </div>
        {Math.abs(remaining) > 0.01 && (
          <Alert variant="warning" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Splits must add up to total amount
            </AlertDescription>
          </Alert>
        )}
      </Card>

      {/* Split Items */}
      <div className="space-y-3">
        {splits.map((split, index) => (
          <Card key={index} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  {/* Category Selection */}
                  <Select
                    value={split.categoryId}
                    onValueChange={(value) => updateSplit(index, 'categoryId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Amount Input */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={split.amount || ''}
                      onChange={(e) => updateSplit(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="flex-1"
                    />
                    {splitMethod === 'percentage' && (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => distributPercentage(index, 25)}
                        >
                          25%
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => distributPercentage(index, 50)}
                        >
                          50%
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => distributPercentage(index, 75)}
                        >
                          75%
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Optional Description */}
                  <Input
                    placeholder="Description (optional)"
                    value={split.description || ''}
                    onChange={(e) => updateSplit(index, 'description', e.target.value)}
                  />

                  {/* Percentage Display */}
                  {split.amount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {((split.amount / totalAmount) * 100).toFixed(1)}% of total
                    </p>
                  )}
                </div>

                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSplit(index)}
                  disabled={splits.length <= 2}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Split Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={addSplit}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Category
      </Button>

      {/* Validation Status */}
      {!isValid && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {splits.some(s => !s.categoryId) && 'Select a category for each split. '}
            {splits.some(s => !s.amount || s.amount <= 0) && 'Enter an amount for each split. '}
            {Math.abs(remaining) >= 0.01 && 'Splits must equal total amount.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// Split Transaction Display Component (for viewing)
const SplitTransactionDisplay = ({ transaction, splits }) => {
  if (!transaction.is_split || splits.length === 0) {
    return null;
  }

  return (
    <Card className="mt-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Split className="h-4 w-4" />
          Split Transaction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {splits.map((split, index) => (
          <div key={split.id} className="flex items-center justify-between py-2 border-b last:border-0">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: split.categoryColor }}
              />
              <div>
                <p className="font-medium text-sm">{split.categoryName}</p>
                {split.description && (
                  <p className="text-xs text-muted-foreground">{split.description}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium">${split.amount.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                {split.percentage.toFixed(1)}%
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// Split Transaction Quick Action (in transaction form)
const TransactionFormWithSplit = ({ userId, onSubmit }) => {
  const [isSplit, setIsSplit] = useState(false);
  const [amount, setAmount] = useState(0);
  const [splits, setSplits] = useState([]);
  // ... other form fields

  const handleSubmit = async () => {
    if (isSplit) {
      await createSplitTransaction(userId, {
        accountId,
        date,
        amount,
        description,
        notes,
        splits
      });
    } else {
      // Regular transaction creation
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Standard fields: account, date, amount, description */}
      
      {/* Split Toggle */}
      <div className="flex items-center justify-between">
        <Label>Split across categories?</Label>
        <Switch checked={isSplit} onCheckedChange={setIsSplit} />
      </div>

      {/* Show split builder or single category selector */}
      {isSplit ? (
        <SplitTransactionBuilder
          totalAmount={amount}
          onSplitsChange={setSplits}
          userId={userId}
        />
      ) : (
        <CategorySelector userId={userId} value={categoryId} onChange={setCategoryId} />
      )}

      <Button type="submit" disabled={isSplit && !isValidSplits(splits, amount)}>
        Create Transaction
      </Button>
    </form>
  );
};

// Convert to Split Transaction Dialog
const ConvertToSplitDialog = ({ transaction, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [splits, setSplits] = useState([]);

  const handleConvert = async () => {
    try {
      await convertToSplitTransaction(transaction.id, transaction.user_id, splits);
      toast.success('Transaction converted to split');
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Split className="h-4 w-4 mr-2" />
          Split
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Split Transaction</DialogTitle>
          <DialogDescription>
            Divide ${transaction.amount.toFixed(2)} across multiple categories
          </DialogDescription>
        </DialogHeader>

        <SplitTransactionBuilder
          totalAmount={transaction.amount}
          onSplitsChange={setSplits}
          userId={transaction.user_id}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConvert}
            disabled={!isValidSplits(splits, transaction.amount)}
          >
            Convert to Split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

---

## 📅 Calendar View

### Overview
The calendar view provides a visual, date-based interface for viewing transactions, bills, and upcoming expenses. It helps users plan spending, see patterns, and never miss important payment dates. The calendar integrates transactions, bills, recurring expenses, and budget projections in an intuitive monthly/weekly view.

### Calendar Components

```tsx
// Main Calendar View Component
const FinancialCalendar = ({ userId, householdId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarData, setCalendarData] = useState({
    transactions: [],
    bills: [],
    recurring: [],
    projections: []
  });
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  useEffect(() => {
    loadCalendarData();
  }, [currentDate, view, userId, householdId]);

  const loadCalendarData = async () => {
    const startDate = view === 'month' 
      ? startOfMonth(currentDate)
      : startOfWeek(currentDate);
    const endDate = view === 'month'
      ? endOfMonth(currentDate)
      : endOfWeek(currentDate);

    const data = await getCalendarData(userId, householdId, startDate, endDate);
    setCalendarData(data);
  };

  const getDayData = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const dayTransactions = calendarData.transactions.filter(t => 
      format(new Date(t.date), 'yyyy-MM-dd') === dateStr
    );
    
    const dayBills = calendarData.bills.filter(b => 
      format(new Date(b.due_date), 'yyyy-MM-dd') === dateStr
    );

    const dayTotal = dayTransactions.reduce((sum, t) => {
      if (t.type === 'income') return sum + t.amount;
      if (t.type === 'expense') return sum - t.amount;
      return sum;
    }, 0);

    return {
      transactions: dayTransactions,
      bills: dayBills,
      total: dayTotal,
      hasActivity: dayTransactions.length > 0 || dayBills.length > 0
    };
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowTransactionModal(true);
  };

  const handleQuickAdd = (date: Date) => {
    setSelectedDate(date);
    setShowTransactionModal(true);
  };

  return (
    <div className="space-y-4 p-4">
      {/* Calendar Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-2xl font-bold">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex border rounded-lg">
                <Button
                  variant={view === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('month')}
                >
                  Month
                </Button>
                <Button
                  variant={view === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('week')}
                >
                  Week
                </Button>
              </div>

              {/* Filter Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuCheckboxItem checked>
                    Transactions
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked>
                    Bills
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked>
                    Recurring Items
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        {/* Month Summary */}
        <CardContent>
          <MonthSummaryBar 
            transactions={calendarData.transactions}
            bills={calendarData.bills}
            currentDate={currentDate}
          />
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      {view === 'month' ? (
        <MonthCalendarGrid
          currentDate={currentDate}
          getDayData={getDayData}
          onDateClick={handleDateClick}
          onQuickAdd={handleQuickAdd}
        />
      ) : (
        <WeekCalendarView
          currentDate={currentDate}
          getDayData={getDayData}
          onDateClick={handleDateClick}
          onQuickAdd={handleQuickAdd}
        />
      )}

      {/* Transaction Modal for Selected Date */}
      {showTransactionModal && selectedDate && (
        <DayDetailModal
          date={selectedDate}
          data={getDayData(selectedDate)}
          onClose={() => setShowTransactionModal(false)}
          onAddTransaction={() => handleQuickAdd(selectedDate)}
        />
      )}
    </div>
  );
};

// Month Calendar Grid Component
const MonthCalendarGrid = ({ currentDate, getDayData, onDateClick, onQuickAdd }) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = [];
  
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <Card>
      <CardContent className="p-2">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map(day => {
                const dayData = getDayData(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());
                const isPast = isBefore(day, startOfDay(new Date()));

                return (
                  <CalendarDayCell
                    key={day.toString()}
                    date={day}
                    dayData={dayData}
                    isCurrentMonth={isCurrentMonth}
                    isToday={isToday}
                    isPast={isPast}
                    onClick={() => onDateClick(day)}
                    onQuickAdd={() => onQuickAdd(day)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Calendar Day Cell Component
const CalendarDayCell = ({ 
  date, 
  dayData, 
  isCurrentMonth, 
  isToday, 
  isPast,
  onClick,
  onQuickAdd
}) => {
  const hasOverdueBills = dayData.bills.some(b => b.status === 'overdue');
  const hasPendingBills = dayData.bills.some(b => b.status === 'pending');

  return (
    <div
      className={cn(
        "relative min-h-24 p-2 border rounded-lg cursor-pointer transition-all hover:shadow-md",
        !isCurrentMonth && "bg-muted/30 text-muted-foreground",
        isToday && "border-2 border-primary",
        hasOverdueBills && "border-red-500",
        !dayData.hasActivity && !isCurrentMonth && "opacity-50"
      )}
      onClick={onClick}
    >
      {/* Date Number */}
      <div className="flex items-center justify-between mb-1">
        <span className={cn(
          "text-sm font-medium",
          isToday && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
        )}>
          {format(date, 'd')}
        </span>
        
        {/* Quick Add Button */}
        {isCurrentMonth && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd();
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Day Content */}
      <div className="space-y-1">
        {/* Bills Indicator */}
        {dayData.bills.map((bill, index) => (
          <div
            key={bill.id}
            className={cn(
              "text-xs px-1 py-0.5 rounded truncate",
              bill.status === 'overdue' && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
              bill.status === 'pending' && "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
              bill.status === 'paid' && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            )}
          >
            💳 {bill.name}
          </div>
        ))}

        {/* Transaction Count */}
        {dayData.transactions.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {dayData.transactions.length} transaction{dayData.transactions.length > 1 ? 's' : ''}
          </div>
        )}

        {/* Daily Total */}
        {dayData.total !== 0 && (
          <div className={cn(
            "text-xs font-medium",
            dayData.total > 0 ? "text-green-600" : "text-red-600"
          )}>
            {dayData.total > 0 ? '+' : ''}{formatCurrency(dayData.total)}
          </div>
        )}

        {/* Activity Dots */}
        {dayData.transactions.length > 3 && (
          <div className="flex gap-0.5">
            {Array(Math.min(5, dayData.transactions.length)).fill(0).map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-primary" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Month Summary Bar Component
const MonthSummaryBar = ({ transactions, bills, currentDate }) => {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingBills = bills.filter(b => b.status === 'pending');
  const overdueBills = bills.filter(b => b.status === 'overdue');
  
  const totalPendingBills = pendingBills.reduce((sum, b) => sum + b.expected_amount, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Income</p>
        <p className="text-xl font-bold text-green-600">
          ${income.toFixed(2)}
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Expenses</p>
        <p className="text-xl font-bold text-red-600">
          ${expenses.toFixed(2)}
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Net</p>
        <p className={cn(
          "text-xl font-bold",
          (income - expenses) >= 0 ? "text-green-600" : "text-red-600"
        )}>
          {(income - expenses) >= 0 ? '+' : ''}${(income - expenses).toFixed(2)}
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Pending Bills</p>
        <p className="text-xl font-bold">
          ${totalPendingBills.toFixed(2)}
        </p>
        {overdueBills.length > 0 && (
          <p className="text-xs text-red-600">
            {overdueBills.length} overdue
          </p>
        )}
      </div>
    </div>
  );
};

// Day Detail Modal Component
const DayDetailModal = ({ date, data, onClose, onAddTransaction }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'transactions' | 'bills'>('all');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{format(date, 'EEEE, MMMM d, yyyy')}</span>
            <Button size="sm" onClick={onAddTransaction}>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTitle>
          <DialogDescription>
            {data.transactions.length} transaction{data.transactions.length !== 1 ? 's' : ''} • 
            {data.bills.length} bill{data.bills.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              All ({data.transactions.length + data.bills.length})
            </TabsTrigger>
            <TabsTrigger value="transactions">
              Transactions ({data.transactions.length})
            </TabsTrigger>
            <TabsTrigger value="bills">
              Bills ({data.bills.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-2 mt-4">
            {data.bills.map(bill => (
              <BillItemCard key={bill.id} bill={bill} />
            ))}
            {data.transactions.map(transaction => (
              <TransactionItemCard key={transaction.id} transaction={transaction} />
            ))}
            {data.transactions.length === 0 && data.bills.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>No activity on this day</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions" className="space-y-2 mt-4">
            {data.transactions.map(transaction => (
              <TransactionItemCard key={transaction.id} transaction={transaction} />
            ))}
            {data.transactions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transactions on this day</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="bills" className="space-y-2 mt-4">
            {data.bills.map(bill => (
              <BillItemCard key={bill.id} bill={bill} />
            ))}
            {data.bills.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No bills due on this day</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Daily Total */}
        {data.total !== 0 && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Daily Total</span>
              <span className={cn(
                "text-xl font-bold",
                data.total > 0 ? "text-green-600" : "text-red-600"
              )}>
                {data.total > 0 ? '+' : ''}${data.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Week Calendar View Component
const WeekCalendarView = ({ currentDate, getDayData, onDateClick, onQuickAdd }) => {
  const weekStart = startOfWeek(currentDate);
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6)
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {weekDays.map(day => {
            const dayData = getDayData(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div key={day.toString()} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className={cn(
                      "text-lg font-semibold",
                      isToday && "text-primary"
                    )}>
                      {format(day, 'EEEE')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {format(day, 'MMMM d, yyyy')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQuickAdd(day)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>

                {/* Day's Activities */}
                <div className="space-y-2">
                  {dayData.bills.map(bill => (
                    <BillItemCard key={bill.id} bill={bill} compact />
                  ))}
                  {dayData.transactions.map(transaction => (
                    <TransactionItemCard key={transaction.id} transaction={transaction} compact />
                  ))}
                  {dayData.transactions.length === 0 && dayData.bills.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No activity
                    </p>
                  )}
                </div>

                {/* Daily Total */}
                {dayData.total !== 0 && (
                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <span className="text-sm font-medium">Total</span>
                    <span className={cn(
                      "font-bold",
                      dayData.total > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {dayData.total > 0 ? '+' : ''}${dayData.total.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
```

### Data Fetching Functions

```typescript
// Get all calendar data for date range
export const getCalendarData = async (
  userId: string,
  householdId: string | null,
  startDate: Date,
  endDate: Date
) => {
  // Get transactions
  const transactions = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      description: transactions.description,
      type: transactions.type,
      categoryName: budget_categories.name,
      categoryColor: budget_categories.color,
      accountName: accounts.name,
      isSplit: transactions.is_split
    })
    .from(transactions)
    .leftJoin(budget_categories, eq(transactions.category_id, budget_categories.id))
    .leftJoin(accounts, eq(transactions.account_id, accounts.id))
    .where(and(
      eq(transactions.user_id, userId),
      householdId ? eq(transactions.household_id, householdId) : sql`1=1`,
      gte(transactions.date, startDate),
      lte(transactions.date, endDate)
    ))
    .orderBy(transactions.date);

  // Get bill instances
  const bills = await db
    .select({
      id: bill_instances.id,
      billId: bill_instances.bill_id,
      name: bills.name,
      dueDate: bill_instances.due_date,
      expectedAmount: bill_instances.expected_amount,
      actualAmount: bill_instances.actual_amount,
      status: bill_instances.status,
      daysLate: bill_instances.days_late
    })
    .from(bill_instances)
    .innerJoin(bills, eq(bill_instances.bill_id, bills.id))
    .where(and(
      eq(bills.user_id, userId),
      householdId ? eq(bills.household_id, householdId) : sql`1=1`,
      gte(bill_instances.due_date, startDate),
      lte(bill_instances.due_date, endDate)
    ))
    .orderBy(bill_instances.due_date);

  // Get recurring transactions (future projections)
  const recurringTransactions = await getRecurringProjections(
    userId,
    householdId,
    startDate,
    endDate
  );

  return {
    transactions,
    bills,
    recurring: recurringTransactions,
    projections: [] // Could add budget projections here
  };
};

// Get recurring transaction projections
export const getRecurringProjections = async (
  userId: string,
  householdId: string | null,
  startDate: Date,
  endDate: Date
) => {
  // Get recurring transaction templates
  const recurringTemplates = await db
    .select()
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      householdId ? eq(transactions.household_id, householdId) : sql`1=1`,
      eq(transactions.is_recurring, true)
    ));

  const projections = [];

  // Generate projected occurrences for each template
  for (const template of recurringTemplates) {
    const rule = JSON.parse(template.recurring_rule);
    const occurrences = generateRecurringDates(
      rule,
      startDate,
      endDate
    );

    for (const date of occurrences) {
      projections.push({
        ...template,
        date,
        isProjected: true
      });
    }
  }

  return projections;
};

// Generate dates for recurring transactions
const generateRecurringDates = (
  rule: { frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly', dayOfMonth?: number, dayOfWeek?: number },
  startDate: Date,
  endDate: Date
): Date[] => {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    switch (rule.frequency) {
      case 'daily':
        dates.push(new Date(currentDate));
        currentDate = addDays(currentDate, 1);
        break;
      case 'weekly':
        if (!rule.dayOfWeek || getDay(currentDate) === rule.dayOfWeek) {
          dates.push(new Date(currentDate));
        }
        currentDate = addWeeks(currentDate, 1);
        break;
      case 'biweekly':
        if (!rule.dayOfWeek || getDay(currentDate) === rule.dayOfWeek) {
          dates.push(new Date(currentDate));
        }
        currentDate = addWeeks(currentDate, 2);
        break;
      case 'monthly':
        if (!rule.dayOfMonth || getDate(currentDate) === rule.dayOfMonth) {
          dates.push(new Date(currentDate));
        }
        currentDate = addMonths(currentDate, 1);
        break;
      case 'yearly':
        dates.push(new Date(currentDate));
        currentDate = addYears(currentDate, 1);
        break;
    }
  }

  return dates;
};

// Get spending pattern analysis for calendar heat map
export const getSpendingHeatmap = async (
  userId: string,
  householdId: string | null,
  year: number
) => {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  const dailyTotals = await db
    .select({
      date: transactions.date,
      total: sql<number>`SUM(CASE WHEN ${transactions.type} = 'expense' THEN ABS(${transactions.amount}) ELSE 0 END)`
    })
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      householdId ? eq(transactions.household_id, householdId) : sql`1=1`,
      gte(transactions.date, startDate),
      lte(transactions.date, endDate)
    ))
    .groupBy(transactions.date)
    .orderBy(transactions.date);

  return dailyTotals;
};
```

### Calendar Navigation Features

```typescript
// Quick Date Navigation Component
const QuickDateJump = ({ onDateSelect }) => {
  const [open, setOpen] = useState(false);

  const quickOptions = [
    { label: 'Today', date: new Date() },
    { label: 'Tomorrow', date: addDays(new Date(), 1) },
    { label: 'Next Week', date: addWeeks(new Date(), 1) },
    { label: 'Next Month', date: addMonths(new Date(), 1) },
    { label: 'End of Month', date: endOfMonth(new Date()) },
    { label: 'Payday (15th)', date: new Date(new Date().getFullYear(), new Date().getMonth(), 15) },
    { label: 'Payday (30th)', date: endOfMonth(new Date()) }
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Calendar className="h-4 w-4 mr-2" />
          Jump to Date
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Quick Navigation</h4>
          <div className="grid gap-2">
            {quickOptions.map(option => (
              <Button
                key={option.label}
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  onDateSelect(option.date);
                  setOpen(false);
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Separator />
          <div>
            <Label>Custom Date</Label>
            <Input
              type="date"
              onChange={(e) => {
                onDateSelect(new Date(e.target.value));
                setOpen(false);
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Mini Calendar Component for Date Picker
const MiniCalendar = ({ selectedDate, onDateSelect }) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-medium">{format(currentMonth, 'MMMM yyyy')}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs text-muted-foreground">
            {day}
          </div>
        ))}
        {/* Calendar days... */}
      </div>
    </div>
  );
};
```

---

## 🏷️ Tags & Custom Fields

### Overview
Tags and custom fields provide flexible, user-defined organization beyond standard categories. Users can tag transactions for specific purposes (vacation, tax-deductible, reimbursable, gift, business) and add custom data fields for tracking additional information like project names, client references, or warranty details.

### Database Schema

```sql
-- Tags system
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT,
  description TEXT,
  usage_count INTEGER DEFAULT 0,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (household_id) REFERENCES households(id),
  
  -- Unique tag names per user/household
  UNIQUE(user_id, household_id, name)
);

-- Transaction-to-tag many-to-many relationship
CREATE TABLE transaction_tags (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  
  -- Prevent duplicate tag assignments
  UNIQUE(transaction_id, tag_id),
  
  -- Index for fast lookups
  INDEX idx_transaction_tags_transaction (transaction_id),
  INDEX idx_transaction_tags_tag (tag_id)
);

-- Custom field definitions
CREATE TABLE custom_fields (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select', 'multiselect')),
  options TEXT, -- JSON array for select/multiselect types
  default_value TEXT,
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  applies_to TEXT DEFAULT 'transaction' CHECK (applies_to IN ('transaction', 'account', 'bill', 'goal')),
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (household_id) REFERENCES households(id),
  
  -- Unique field names per user/household and entity type
  UNIQUE(user_id, household_id, name, applies_to)
);

-- Custom field values
CREATE TABLE custom_field_values (
  id TEXT PRIMARY KEY,
  custom_field_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('transaction', 'account', 'bill', 'goal')),
  entity_id TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (custom_field_id) REFERENCES custom_fields(id) ON DELETE CASCADE,
  
  -- One value per field per entity
  UNIQUE(custom_field_id, entity_type, entity_id),
  
  -- Index for fast lookups
  INDEX idx_custom_field_values_entity (entity_type, entity_id),
  INDEX idx_custom_field_values_field (custom_field_id)
);
```

### Core Tag Functions

```typescript
// Create a new tag
export const createTag = async (
  userId: string,
  householdId: string | null,
  tagData: {
    name: string;
    color?: string;
    icon?: string;
    description?: string;
  }
) => {
  const [tag] = await db
    .insert(tags)
    .values({
      id: generateId(),
      user_id: userId,
      household_id: householdId,
      name: tagData.name.trim(),
      color: tagData.color || '#3b82f6',
      icon: tagData.icon,
      description: tagData.description
    })
    .returning();

  return tag;
};

// Get all tags for user/household
export const getTags = async (
  userId: string,
  householdId: string | null,
  orderBy: 'name' | 'usage' | 'recent' = 'name'
) => {
  let query = db
    .select()
    .from(tags)
    .where(and(
      eq(tags.user_id, userId),
      householdId ? eq(tags.household_id, householdId) : sql`${tags.household_id} IS NULL`
    ));

  switch (orderBy) {
    case 'usage':
      query = query.orderBy(desc(tags.usage_count), tags.name);
      break;
    case 'recent':
      query = query.orderBy(desc(tags.last_used_at), tags.name);
      break;
    default:
      query = query.orderBy(tags.name);
  }

  return await query;
};

// Add tags to transaction
export const addTagsToTransaction = async (
  transactionId: string,
  tagIds: string[]
) => {
  if (tagIds.length === 0) return [];

  // Remove duplicates
  const uniqueTagIds = [...new Set(tagIds)];

  const tagAssignments = await Promise.all(
    uniqueTagIds.map(async (tagId) => {
      const [assignment] = await db
        .insert(transaction_tags)
        .values({
          id: generateId(),
          transaction_id: transactionId,
          tag_id: tagId
        })
        .onConflictDoNothing()
        .returning();

      // Update tag usage
      await db
        .update(tags)
        .set({
          usage_count: sql`${tags.usage_count} + 1`,
          last_used_at: new Date()
        })
        .where(eq(tags.id, tagId));

      return assignment;
    })
  );

  return tagAssignments.filter(Boolean);
};

// Remove tag from transaction
export const removeTagFromTransaction = async (
  transactionId: string,
  tagId: string
) => {
  await db
    .delete(transaction_tags)
    .where(and(
      eq(transaction_tags.transaction_id, transactionId),
      eq(transaction_tags.tag_id, tagId)
    ));

  // Decrement usage count
  await db
    .update(tags)
    .set({
      usage_count: sql`GREATEST(0, ${tags.usage_count} - 1)`
    })
    .where(eq(tags.id, tagId));
};

// Get transaction with tags
export const getTransactionWithTags = async (transactionId: string) => {
  const result = await db
    .select({
      tag: tags
    })
    .from(transaction_tags)
    .innerJoin(tags, eq(transaction_tags.tag_id, tags.id))
    .where(eq(transaction_tags.transaction_id, transactionId));

  return result.map(r => r.tag);
};

// Search transactions by tags
export const searchTransactionsByTags = async (
  userId: string,
  householdId: string | null,
  tagIds: string[],
  matchAll: boolean = false // true = AND, false = OR
) => {
  if (tagIds.length === 0) return [];

  if (matchAll) {
    // Must have ALL specified tags
    const result = await db
      .select({
        transaction: transactions,
        tagCount: sql<number>`COUNT(DISTINCT ${transaction_tags.tag_id})`
      })
      .from(transactions)
      .innerJoin(transaction_tags, eq(transactions.id, transaction_tags.transaction_id))
      .where(and(
        eq(transactions.user_id, userId),
        householdId ? eq(transactions.household_id, householdId) : sql`1=1`,
        inArray(transaction_tags.tag_id, tagIds)
      ))
      .groupBy(transactions.id)
      .having(sql`COUNT(DISTINCT ${transaction_tags.tag_id}) = ${tagIds.length}`)
      .orderBy(desc(transactions.date));

    return result.map(r => r.transaction);
  } else {
    // Must have ANY of the specified tags
    const result = await db
      .select({
        transaction: transactions
      })
      .from(transactions)
      .innerJoin(transaction_tags, eq(transactions.id, transaction_tags.transaction_id))
      .where(and(
        eq(transactions.user_id, userId),
        householdId ? eq(transactions.household_id, householdId) : sql`1=1`,
        inArray(transaction_tags.tag_id, tagIds)
      ))
      .groupBy(transactions.id)
      .orderBy(desc(transactions.date));

    return result.map(r => r.transaction);
  }
};

// Get tag statistics
export const getTagStatistics = async (
  userId: string,
  householdId: string | null,
  startDate?: Date,
  endDate?: Date
) => {
  const result = await db
    .select({
      tag: tags,
      transactionCount: sql<number>`COUNT(DISTINCT ${transaction_tags.transaction_id})`,
      totalAmount: sql<number>`SUM(ABS(${transactions.amount}))`,
      avgAmount: sql<number>`AVG(ABS(${transactions.amount}))`
    })
    .from(tags)
    .leftJoin(transaction_tags, eq(tags.id, transaction_tags.tag_id))
    .leftJoin(transactions, eq(transaction_tags.transaction_id, transactions.id))
    .where(and(
      eq(tags.user_id, userId),
      householdId ? eq(tags.household_id, householdId) : sql`${tags.household_id} IS NULL`,
      startDate ? gte(transactions.date, startDate) : sql`1=1`,
      endDate ? lte(transactions.date, endDate) : sql`1=1`
    ))
    .groupBy(tags.id)
    .orderBy(desc(sql`COUNT(DISTINCT ${transaction_tags.transaction_id})`));

  return result;
};
```

### Custom Fields Functions

```typescript
// Create custom field definition
export const createCustomField = async (
  userId: string,
  householdId: string | null,
  fieldData: {
    name: string;
    fieldType: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
    options?: string[];
    defaultValue?: string;
    isRequired?: boolean;
    appliesTo?: 'transaction' | 'account' | 'bill' | 'goal';
  }
) => {
  const [field] = await db
    .insert(custom_fields)
    .values({
      id: generateId(),
      user_id: userId,
      household_id: householdId,
      name: fieldData.name,
      field_type: fieldData.fieldType,
      options: fieldData.options ? JSON.stringify(fieldData.options) : null,
      default_value: fieldData.defaultValue,
      is_required: fieldData.isRequired || false,
      applies_to: fieldData.appliesTo || 'transaction'
    })
    .returning();

  return field;
};

// Get custom fields for entity type
export const getCustomFields = async (
  userId: string,
  householdId: string | null,
  appliesTo: 'transaction' | 'account' | 'bill' | 'goal'
) => {
  return await db
    .select()
    .from(custom_fields)
    .where(and(
      eq(custom_fields.user_id, userId),
      householdId ? eq(custom_fields.household_id, householdId) : sql`${custom_fields.household_id} IS NULL`,
      eq(custom_fields.applies_to, appliesTo),
      eq(custom_fields.is_active, true)
    ))
    .orderBy(custom_fields.sort_order, custom_fields.name);
};

// Set custom field value
export const setCustomFieldValue = async (
  customFieldId: string,
  entityType: 'transaction' | 'account' | 'bill' | 'goal',
  entityId: string,
  value: string
) => {
  const [fieldValue] = await db
    .insert(custom_field_values)
    .values({
      id: generateId(),
      custom_field_id: customFieldId,
      entity_type: entityType,
      entity_id: entityId,
      value: value
    })
    .onConflictDoUpdate({
      target: [custom_field_values.custom_field_id, custom_field_values.entity_type, custom_field_values.entity_id],
      set: {
        value: value,
        updated_at: new Date()
      }
    })
    .returning();

  return fieldValue;
};

// Get custom field values for entity
export const getCustomFieldValues = async (
  entityType: 'transaction' | 'account' | 'bill' | 'goal',
  entityId: string
) => {
  const result = await db
    .select({
      field: custom_fields,
      value: custom_field_values.value
    })
    .from(custom_field_values)
    .innerJoin(custom_fields, eq(custom_field_values.custom_field_id, custom_fields.id))
    .where(and(
      eq(custom_field_values.entity_type, entityType),
      eq(custom_field_values.entity_id, entityId)
    ))
    .orderBy(custom_fields.sort_order);

  return result;
};

// Search by custom field value
export const searchByCustomField = async (
  userId: string,
  householdId: string | null,
  customFieldId: string,
  searchValue: string,
  entityType: 'transaction' | 'account' | 'bill' | 'goal' = 'transaction'
) => {
  return await db
    .select({
      entityId: custom_field_values.entity_id,
      value: custom_field_values.value
    })
    .from(custom_field_values)
    .innerJoin(custom_fields, eq(custom_field_values.custom_field_id, custom_fields.id))
    .where(and(
      eq(custom_fields.user_id, userId),
      householdId ? eq(custom_fields.household_id, householdId) : sql`${custom_fields.household_id} IS NULL`,
      eq(custom_field_values.custom_field_id, customFieldId),
      eq(custom_field_values.entity_type, entityType),
      sql`LOWER(${custom_field_values.value}) LIKE LOWER(${'%' + searchValue + '%'})`
    ));
};
```

### UI Components

```tsx
// Tag Manager Component
const TagManager = ({ userId, householdId }) => {
  const [tags, setTags] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: '#3b82f6', icon: '' });

  useEffect(() => {
    loadTags();
  }, [userId, householdId]);

  const loadTags = async () => {
    const allTags = await getTags(userId, householdId, 'usage');
    setTags(allTags);
  };

  const handleCreate = async () => {
    if (!newTag.name.trim()) return;
    
    await createTag(userId, householdId, newTag);
    setNewTag({ name: '', color: '#3b82f6', icon: '' });
    setIsCreating(false);
    loadTags();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Tags</CardTitle>
          <Button size="sm" onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Tag
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Existing tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map(tag => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="cursor-pointer"
              style={{ backgroundColor: tag.color + '20', borderColor: tag.color }}
            >
              {tag.icon && <span className="mr-1">{tag.icon}</span>}
              {tag.name}
              <span className="ml-2 text-xs opacity-60">({tag.usage_count})</span>
            </Badge>
          ))}
        </div>

        {/* Create new tag */}
        {isCreating && (
          <div className="space-y-3 p-4 border rounded-lg">
            <Input
              placeholder="Tag name"
              value={newTag.name}
              onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <Label>Color:</Label>
              <Input
                type="color"
                value={newTag.color}
                onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                className="w-20"
              />
              <Input
                placeholder="Icon (emoji)"
                value={newTag.icon}
                onChange={(e) => setNewTag({ ...newTag, icon: e.target.value })}
                className="w-20"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate}>Create</Button>
              <Button size="sm" variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Tag Selector for Transactions
const TagSelector = ({ transactionId, userId, householdId, selectedTags, onChange }) => {
  const [availableTags, setAvailableTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTags();
  }, [userId, householdId]);

  const loadTags = async () => {
    const tags = await getTags(userId, householdId, 'usage');
    setAvailableTags(tags);
  };

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTag = async (tagId: string) => {
    const isSelected = selectedTags.includes(tagId);
    
    if (isSelected) {
      if (transactionId) {
        await removeTagFromTransaction(transactionId, tagId);
      }
      onChange(selectedTags.filter(id => id !== tagId));
    } else {
      if (transactionId) {
        await addTagsToTransaction(transactionId, [tagId]);
      }
      onChange([...selectedTags, tagId]);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Tags</Label>
      
      {/* Search */}
      <Input
        placeholder="Search tags..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Tag list */}
      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
        {filteredTags.map(tag => {
          const isSelected = selectedTags.includes(tag.id);
          return (
            <Badge
              key={tag.id}
              variant={isSelected ? "default" : "outline"}
              className="cursor-pointer"
              style={isSelected ? { backgroundColor: tag.color } : { borderColor: tag.color }}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.icon && <span className="mr-1">{tag.icon}</span>}
              {tag.name}
            </Badge>
          );
        })}
      </div>
    </div>
  );
};

// Custom Field Manager
const CustomFieldManager = ({ userId, householdId, appliesTo = 'transaction' }) => {
  const [fields, setFields] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadFields();
  }, [userId, householdId, appliesTo]);

  const loadFields = async () => {
    const customFields = await getCustomFields(userId, householdId, appliesTo);
    setFields(customFields);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Custom Fields</CardTitle>
          <Button size="sm" onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {fields.map(field => (
            <div key={field.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <p className="font-medium">{field.name}</p>
                <p className="text-sm text-muted-foreground">{field.field_type}</p>
              </div>
              {field.is_required && (
                <Badge variant="secondary">Required</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Custom Field Input Component
const CustomFieldInput = ({ field, value, onChange }) => {
  switch (field.field_type) {
    case 'text':
      return (
        <Input
          placeholder={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    
    case 'number':
      return (
        <Input
          type="number"
          placeholder={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    
    case 'date':
      return (
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    
    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={value === 'true'}
            onCheckedChange={(checked) => onChange(String(checked))}
          />
          <Label>{field.name}</Label>
        </div>
      );
    
    case 'select':
      const options = JSON.parse(field.options || '[]');
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.name}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option: string) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    
    case 'multiselect':
      // Implement multi-select UI
      return <div>Multi-select not yet implemented</div>;
    
    default:
      return null;
  }
};

// Transaction form with tags and custom fields
const TransactionFormWithMetadata = ({ userId, householdId, onSubmit }) => {
  const [selectedTags, setSelectedTags] = useState([]);
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [customFields, setCustomFields] = useState([]);

  useEffect(() => {
    loadCustomFields();
  }, [userId, householdId]);

  const loadCustomFields = async () => {
    const fields = await getCustomFields(userId, householdId, 'transaction');
    setCustomFields(fields);
  };

  const handleSubmit = async () => {
    // Create transaction first
    const transaction = await createTransaction(/* ... */);
    
    // Add tags
    if (selectedTags.length > 0) {
      await addTagsToTransaction(transaction.id, selectedTags);
    }
    
    // Save custom field values
    for (const [fieldId, value] of Object.entries(customFieldValues)) {
      if (value) {
        await setCustomFieldValue(fieldId, 'transaction', transaction.id, value);
      }
    }
    
    onSubmit(transaction);
  };

  return (
    <form className="space-y-4">
      {/* Standard transaction fields */}
      
      {/* Tags */}
      <TagSelector
        userId={userId}
        householdId={householdId}
        selectedTags={selectedTags}
        onChange={setSelectedTags}
      />
      
      {/* Custom fields */}
      {customFields.length > 0 && (
        <div className="space-y-3">
          <Label>Additional Information</Label>
          {customFields.map(field => (
            <div key={field.id}>
              <Label>
                {field.name}
                {field.is_required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <CustomFieldInput
                field={field}
                value={customFieldValues[field.id]}
                onChange={(value) => setCustomFieldValues({
                  ...customFieldValues,
                  [field.id]: value
                })}
              />
            </div>
          ))}
        </div>
      )}
      
      <Button type="button" onClick={handleSubmit}>
        Create Transaction
      </Button>
    </form>
  );
};
```

---

## 💼 Tax Category Mapping

### Overview
Tax category mapping allows users to assign tax classifications to expense categories for simplified tax preparation and reporting. This feature helps track deductible expenses, generate tax reports, and export data in tax-ready formats. Common use cases include business expense tracking, home office deductions, charitable contributions, medical expenses, and investment-related costs.

### Database Schema

```sql
-- Tax categories/classifications
CREATE TABLE tax_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT, -- e.g., "Schedule C Line 8", "Form 8829", etc.
  description TEXT,
  tax_form TEXT, -- Which tax form this applies to
  deduction_type TEXT CHECK (deduction_type IN ('standard', 'itemized', 'business', 'investment', 'medical', 'charitable', 'other')),
  percentage_deductible DECIMAL(5,2) DEFAULT 100.00, -- Some expenses are only partially deductible
  is_system BOOLEAN DEFAULT false, -- System-provided vs user-created
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mapping between budget categories and tax categories
CREATE TABLE category_tax_mappings (
  id TEXT PRIMARY KEY,
  budget_category_id TEXT NOT NULL,
  tax_category_id TEXT NOT NULL,
  percentage DECIMAL(5,2) DEFAULT 100.00, -- For split categories (e.g., 50% business use)
  notes TEXT,
  effective_from DATE, -- When this mapping starts
  effective_to DATE, -- When this mapping ends (null = ongoing)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (budget_category_id) REFERENCES budget_categories(id) ON DELETE CASCADE,
  FOREIGN KEY (tax_category_id) REFERENCES tax_categories(id),
  
  -- Index for fast lookups
  INDEX idx_category_tax_mappings_budget (budget_category_id),
  INDEX idx_category_tax_mappings_tax (tax_category_id)
);

-- Tax year settings and configurations
CREATE TABLE tax_year_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  filing_status TEXT CHECK (filing_status IN ('single', 'married_joint', 'married_separate', 'head_of_household')),
  standard_deduction DECIMAL(12,2),
  use_standard_deduction BOOLEAN DEFAULT true,
  estimated_tax_rate DECIMAL(5,2), -- For projections
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  
  UNIQUE(user_id, tax_year)
);

-- Tax deduction tracking (for manual entries or adjustments)
CREATE TABLE tax_deductions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  tax_category_id TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  notes TEXT,
  receipt_url TEXT,
  is_auto_calculated BOOLEAN DEFAULT false, -- True if derived from transactions
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tax_category_id) REFERENCES tax_categories(id),
  
  INDEX idx_tax_deductions_user_year (user_id, tax_year)
);
```

### Core Tax Category Functions

```typescript
// Predefined system tax categories
const SYSTEM_TAX_CATEGORIES = [
  {
    name: 'Business Expenses - Advertising',
    code: 'Schedule C Line 8',
    taxForm: 'Schedule C',
    deductionType: 'business',
    description: 'Advertising and marketing expenses'
  },
  {
    name: 'Business Expenses - Office Supplies',
    code: 'Schedule C Line 18',
    taxForm: 'Schedule C',
    deductionType: 'business',
    description: 'Office supplies and materials'
  },
  {
    name: 'Business Expenses - Travel',
    code: 'Schedule C Line 24a',
    taxForm: 'Schedule C',
    deductionType: 'business',
    description: 'Business travel expenses'
  },
  {
    name: 'Business Expenses - Meals (50%)',
    code: 'Schedule C Line 24b',
    taxForm: 'Schedule C',
    deductionType: 'business',
    percentageDeductible: 50.00,
    description: 'Business meals (50% deductible)'
  },
  {
    name: 'Home Office Deduction',
    code: 'Form 8829',
    taxForm: 'Form 8829',
    deductionType: 'business',
    description: 'Home office expenses'
  },
  {
    name: 'Vehicle Expenses - Business',
    code: 'Schedule C Line 9',
    taxForm: 'Schedule C',
    deductionType: 'business',
    description: 'Business use of vehicle'
  },
  {
    name: 'Medical Expenses',
    code: 'Schedule A Line 1',
    taxForm: 'Schedule A',
    deductionType: 'medical',
    description: 'Medical and dental expenses'
  },
  {
    name: 'Charitable Contributions - Cash',
    code: 'Schedule A Line 11',
    taxForm: 'Schedule A',
    deductionType: 'charitable',
    description: 'Cash donations to qualified charities'
  },
  {
    name: 'State and Local Taxes',
    code: 'Schedule A Line 5',
    taxForm: 'Schedule A',
    deductionType: 'itemized',
    description: 'State and local income/sales/property taxes'
  },
  {
    name: 'Mortgage Interest',
    code: 'Schedule A Line 8',
    taxForm: 'Schedule A',
    deductionType: 'itemized',
    description: 'Home mortgage interest'
  },
  {
    name: 'Investment Expenses',
    code: 'Schedule A Line 16',
    taxForm: 'Schedule A',
    deductionType: 'investment',
    description: 'Investment-related expenses'
  }
];

// Initialize system tax categories
export const initializeSystemTaxCategories = async () => {
  for (const category of SYSTEM_TAX_CATEGORIES) {
    await db
      .insert(tax_categories)
      .values({
        id: generateId(),
        name: category.name,
        code: category.code,
        tax_form: category.taxForm,
        deduction_type: category.deductionType,
        percentage_deductible: category.percentageDeductible || 100.00,
        description: category.description,
        is_system: true,
        is_active: true
      })
      .onConflictDoNothing();
  }
};

// Create custom tax category
export const createTaxCategory = async (
  categoryData: {
    name: string;
    code?: string;
    description?: string;
    taxForm?: string;
    deductionType: string;
    percentageDeductible?: number;
  }
) => {
  const [taxCategory] = await db
    .insert(tax_categories)
    .values({
      id: generateId(),
      name: categoryData.name,
      code: categoryData.code,
      description: categoryData.description,
      tax_form: categoryData.taxForm,
      deduction_type: categoryData.deductionType,
      percentage_deductible: categoryData.percentageDeductible || 100.00,
      is_system: false,
      is_active: true
    })
    .returning();

  return taxCategory;
};

// Map budget category to tax category
export const mapCategoryToTax = async (
  budgetCategoryId: string,
  taxCategoryId: string,
  options: {
    percentage?: number;
    notes?: string;
    effectiveFrom?: Date;
    effectiveTo?: Date;
  } = {}
) => {
  const [mapping] = await db
    .insert(category_tax_mappings)
    .values({
      id: generateId(),
      budget_category_id: budgetCategoryId,
      tax_category_id: taxCategoryId,
      percentage: options.percentage || 100.00,
      notes: options.notes,
      effective_from: options.effectiveFrom,
      effective_to: options.effectiveTo
    })
    .returning();

  return mapping;
};

// Get tax categories for budget category
export const getTaxMappingsForCategory = async (budgetCategoryId: string) => {
  const result = await db
    .select({
      mapping: category_tax_mappings,
      taxCategory: tax_categories
    })
    .from(category_tax_mappings)
    .innerJoin(tax_categories, eq(category_tax_mappings.tax_category_id, tax_categories.id))
    .where(and(
      eq(category_tax_mappings.budget_category_id, budgetCategoryId),
      eq(tax_categories.is_active, true)
    ));

  return result;
};

// Calculate tax deductions for year
export const calculateTaxDeductions = async (
  userId: string,
  taxYear: number
) => {
  const startDate = new Date(taxYear, 0, 1);
  const endDate = new Date(taxYear, 11, 31);

  // Get all transactions for the year
  const transactions = await db
    .select({
      transaction: transactions,
      category: budget_categories,
      splits: transaction_splits
    })
    .from(transactions)
    .leftJoin(budget_categories, eq(transactions.category_id, budget_categories.id))
    .leftJoin(transaction_splits, eq(transactions.id, transaction_splits.transaction_id))
    .where(and(
      eq(transactions.user_id, userId),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate),
      eq(transactions.type, 'expense')
    ));

  // Group by tax category
  const deductionsByTaxCategory: Record<string, {
    taxCategory: any;
    transactions: any[];
    totalAmount: number;
    deductibleAmount: number;
  }> = {};

  for (const row of transactions) {
    let categoryId: string;
    let amount: number;

    if (row.transaction.is_split && row.splits) {
      // Handle split transactions
      categoryId = row.splits.category_id;
      amount = row.splits.amount;
    } else {
      categoryId = row.transaction.category_id;
      amount = row.transaction.amount;
    }

    if (!categoryId) continue;

    // Get tax mappings for this category
    const mappings = await getTaxMappingsForCategory(categoryId);

    for (const { mapping, taxCategory } of mappings) {
      // Check if mapping is effective for this transaction date
      const transactionDate = new Date(row.transaction.date);
      if (mapping.effective_from && transactionDate < new Date(mapping.effective_from)) continue;
      if (mapping.effective_to && transactionDate > new Date(mapping.effective_to)) continue;

      const taxCategoryId = taxCategory.id;
      
      if (!deductionsByTaxCategory[taxCategoryId]) {
        deductionsByTaxCategory[taxCategoryId] = {
          taxCategory,
          transactions: [],
          totalAmount: 0,
          deductibleAmount: 0
        };
      }

      const categoryPercentage = mapping.percentage / 100;
      const taxPercentage = taxCategory.percentage_deductible / 100;
      const deductibleAmount = Math.abs(amount) * categoryPercentage * taxPercentage;

      deductionsByTaxCategory[taxCategoryId].transactions.push({
        ...row.transaction,
        categoryName: row.category?.name,
        mappingPercentage: mapping.percentage,
        deductibleAmount
      });
      deductionsByTaxCategory[taxCategoryId].totalAmount += Math.abs(amount);
      deductionsByTaxCategory[taxCategoryId].deductibleAmount += deductibleAmount;
    }
  }

  return Object.values(deductionsByTaxCategory);
};

// Generate tax report
export const generateTaxReport = async (
  userId: string,
  taxYear: number,
  format: 'summary' | 'detailed' | 'by_form' = 'summary'
) => {
  const deductions = await calculateTaxDeductions(userId, taxYear);

  if (format === 'summary') {
    // Summary by deduction type
    const summary: Record<string, { total: number; categories: any[] }> = {};

    for (const deduction of deductions) {
      const type = deduction.taxCategory.deduction_type;
      if (!summary[type]) {
        summary[type] = { total: 0, categories: [] };
      }
      summary[type].total += deduction.deductibleAmount;
      summary[type].categories.push({
        name: deduction.taxCategory.name,
        amount: deduction.deductibleAmount,
        transactionCount: deduction.transactions.length
      });
    }

    return { taxYear, format: 'summary', data: summary };
  }

  if (format === 'by_form') {
    // Group by tax form
    const byForm: Record<string, any[]> = {};

    for (const deduction of deductions) {
      const form = deduction.taxCategory.tax_form || 'Other';
      if (!byForm[form]) {
        byForm[form] = [];
      }
      byForm[form].push({
        code: deduction.taxCategory.code,
        name: deduction.taxCategory.name,
        amount: deduction.deductibleAmount,
        transactionCount: deduction.transactions.length
      });
    }

    return { taxYear, format: 'by_form', data: byForm };
  }

  // Detailed report with all transactions
  return { taxYear, format: 'detailed', data: deductions };
};

// Export tax data to CSV
export const exportTaxDataToCSV = async (
  userId: string,
  taxYear: number
) => {
  const deductions = await calculateTaxDeductions(userId, taxYear);
  
  const csvRows = [];
  csvRows.push(['Tax Category', 'Form/Schedule', 'Code', 'Transaction Date', 'Description', 'Amount', 'Deductible %', 'Deductible Amount']);

  for (const deduction of deductions) {
    for (const transaction of deduction.transactions) {
      csvRows.push([
        deduction.taxCategory.name,
        deduction.taxCategory.tax_form || '',
        deduction.taxCategory.code || '',
        format(new Date(transaction.date), 'yyyy-MM-dd'),
        transaction.description,
        transaction.amount.toFixed(2),
        transaction.mappingPercentage.toFixed(0) + '%',
        transaction.deductibleAmount.toFixed(2)
      ]);
    }
  }

  return csvRows;
};

// Get tax summary for dashboard
export const getTaxSummary = async (userId: string, taxYear: number) => {
  const deductions = await calculateTaxDeductions(userId, taxYear);
  
  let totalDeductions = 0;
  let businessExpenses = 0;
  let itemizedDeductions = 0;
  let charitableGiving = 0;

  for (const deduction of deductions) {
    totalDeductions += deduction.deductibleAmount;
    
    switch (deduction.taxCategory.deduction_type) {
      case 'business':
        businessExpenses += deduction.deductibleAmount;
        break;
      case 'itemized':
        itemizedDeductions += deduction.deductibleAmount;
        break;
      case 'charitable':
        charitableGiving += deduction.deductibleAmount;
        break;
    }
  }

  return {
    taxYear,
    totalDeductions,
    businessExpenses,
    itemizedDeductions,
    charitableGiving,
    categoryCount: deductions.length
  };
};
```

### UI Components

```tsx
// Tax Category Mapper Component
const TaxCategoryMapper = ({ budgetCategory }) => {
  const [taxCategories, setTaxCategories] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [selectedTaxCategory, setSelectedTaxCategory] = useState('');
  const [percentage, setPercentage] = useState(100);

  useEffect(() => {
    loadTaxCategories();
    loadMappings();
  }, [budgetCategory.id]);

  const loadTaxCategories = async () => {
    const categories = await db
      .select()
      .from(tax_categories)
      .where(eq(tax_categories.is_active, true))
      .orderBy(tax_categories.deduction_type, tax_categories.name);
    
    setTaxCategories(categories);
  };

  const loadMappings = async () => {
    const categoryMappings = await getTaxMappingsForCategory(budgetCategory.id);
    setMappings(categoryMappings);
  };

  const handleAddMapping = async () => {
    if (!selectedTaxCategory) return;

    await mapCategoryToTax(budgetCategory.id, selectedTaxCategory, {
      percentage
    });

    setIsAddingMapping(false);
    setSelectedTaxCategory('');
    setPercentage(100);
    loadMappings();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax Category Mapping</CardTitle>
        <CardDescription>
          Map "{budgetCategory.name}" to tax deduction categories
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing mappings */}
        {mappings.length > 0 && (
          <div className="space-y-2">
            <Label>Current Tax Categories</Label>
            {mappings.map(({ mapping, taxCategory }) => (
              <div key={mapping.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{taxCategory.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {taxCategory.tax_form} - {taxCategory.code}
                  </p>
                  {mapping.percentage < 100 && (
                    <Badge variant="secondary" className="mt-1">
                      {mapping.percentage}% deductible
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMapping(mapping.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new mapping */}
        {!isAddingMapping ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsAddingMapping(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tax Category
          </Button>
        ) : (
          <div className="space-y-3 p-4 border rounded-lg">
            <div>
              <Label>Tax Category</Label>
              <Select value={selectedTaxCategory} onValueChange={setSelectedTaxCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tax category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(
                    taxCategories.reduce((acc, cat) => {
                      const type = cat.deduction_type;
                      if (!acc[type]) acc[type] = [];
                      acc[type].push(cat);
                      return acc;
                    }, {})
                  ).map(([type, categories]) => (
                    <SelectGroup key={type}>
                      <SelectLabel className="capitalize">{type.replace('_', ' ')}</SelectLabel>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                          {cat.percentage_deductible < 100 && ` (${cat.percentage_deductible}%)`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Deductible Percentage</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[percentage]}
                  onValueChange={(v) => setPercentage(v[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="w-12 text-center">{percentage}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use less than 100% for partially deductible expenses (e.g., 50% business use of vehicle)
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddMapping}>Add Mapping</Button>
              <Button variant="outline" onClick={() => setIsAddingMapping(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Tax Dashboard Component
const TaxDashboard = ({ userId }) => {
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [userId, taxYear]);

  const loadSummary = async () => {
    setLoading(true);
    const taxSummary = await getTaxSummary(userId, taxYear);
    setSummary(taxSummary);
    setLoading(false);
  };

  const handleExport = async () => {
    const csvData = await exportTaxDataToCSV(userId, taxYear);
    // Trigger CSV download
    downloadCSV(csvData, `tax-report-${taxYear}.csv`);
  };

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tax Summary</CardTitle>
              <CardDescription>Deduction tracking for tax year {taxYear}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(taxYear)}
                onValueChange={(v) => setTaxYear(parseInt(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map(offset => {
                    const year = new Date().getFullYear() - offset;
                    return (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Deductions</p>
              <p className="text-2xl font-bold">
                ${summary.totalDeductions.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Business Expenses</p>
              <p className="text-2xl font-bold text-blue-600">
                ${summary.businessExpenses.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Itemized Deductions</p>
              <p className="text-2xl font-bold text-purple-600">
                ${summary.itemizedDeductions.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Charitable Giving</p>
              <p className="text-2xl font-bold text-green-600">
                ${summary.charitableGiving.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed breakdown */}
      <TaxDeductionBreakdown userId={userId} taxYear={taxYear} />
    </div>
  );
};

// Tax Report Viewer
const TaxReportViewer = ({ userId, taxYear }) => {
  const [report, setReport] = useState(null);
  const [format, setFormat] = useState<'summary' | 'detailed' | 'by_form'>('summary');

  useEffect(() => {
    loadReport();
  }, [userId, taxYear, format]);

  const loadReport = async () => {
    const taxReport = await generateTaxReport(userId, taxYear, format);
    setReport(taxReport);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Tax Report</CardTitle>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Summary</SelectItem>
              <SelectItem value="by_form">By Tax Form</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {report && format === 'summary' && (
          <div className="space-y-4">
            {Object.entries(report.data).map(([type, data]: [string, any]) => (
              <div key={type}>
                <h3 className="font-semibold capitalize mb-2">
                  {type.replace('_', ' ')}
                </h3>
                <p className="text-2xl font-bold mb-2">
                  ${data.total.toLocaleString()}
                </p>
                <div className="space-y-1">
                  {data.categories.map((cat: any) => (
                    <div key={cat.name} className="flex justify-between text-sm">
                      <span>{cat.name}</span>
                      <span className="text-muted-foreground">
                        ${cat.amount.toLocaleString()} ({cat.transactionCount} items)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {report && format === 'by_form' && (
          <div className="space-y-4">
            {Object.entries(report.data).map(([form, items]: [string, any[]]) => (
              <div key={form}>
                <h3 className="font-semibold mb-2">{form}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line/Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any) => (
                      <TableRow key={item.code}>
                        <TableCell className="font-mono">{item.code}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">
                          ${item.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

---

## 💵 Sales Tax Tracking

### Overview
Sales tax tracking allows businesses to mark income transactions as taxable or non-taxable, set applicable tax rates, and generate quarterly reports for sales tax remittance. The system supports multiple tax rates (state, local, combined), quarterly reporting periods, and automatic calculation of taxes owed.

### Database Schema Extensions

```sql
-- Add sales tax fields to transactions table
ALTER TABLE transactions ADD COLUMN is_taxable BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN tax_rate DECIMAL(5,2); -- e.g., 8.25 for 8.25%
ALTER TABLE transactions ADD COLUMN tax_amount DECIMAL(12,2); -- calculated tax amount
ALTER TABLE transactions ADD COLUMN tax_jurisdiction TEXT; -- state, province, or locality

-- Sales tax settings per user/household
CREATE TABLE sales_tax_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT,
  tax_jurisdiction TEXT NOT NULL, -- e.g., "California", "New York", "Ontario"
  default_tax_rate DECIMAL(5,2) NOT NULL, -- default rate for new income
  state_tax_rate DECIMAL(5,2), -- separate state rate if applicable
  local_tax_rate DECIMAL(5,2), -- separate local rate if applicable
  filing_frequency TEXT CHECK (filing_frequency IN ('monthly', 'quarterly', 'annually')),
  nexus_states TEXT, -- JSON array of states where business has nexus
  tax_id_number TEXT, -- sales tax permit number
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (household_id) REFERENCES households(id)
);

-- Sales tax liability tracking
CREATE TABLE sales_tax_periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annually')),
  period_year INTEGER NOT NULL,
  period_number INTEGER NOT NULL, -- 1-4 for quarterly, 1-12 for monthly
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_taxable_income DECIMAL(12,2) DEFAULT 0,
  total_tax_collected DECIMAL(12,2) DEFAULT 0,
  total_tax_due DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'calculated', 'filed', 'paid')),
  filed_date DATE,
  paid_date DATE,
  payment_confirmation TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (household_id) REFERENCES households(id),
  
  UNIQUE(user_id, household_id, period_type, period_year, period_number)
);

-- Tax exemption certificates for customers/clients
CREATE TABLE tax_exemptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT,
  customer_name TEXT NOT NULL,
  exemption_type TEXT CHECK (exemption_type IN ('resale', 'nonprofit', 'government', 'agriculture', 'other')),
  certificate_number TEXT,
  expiration_date DATE,
  issuing_state TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (household_id) REFERENCES households(id)
);
```

### Core Sales Tax Functions

```typescript
// Set transaction as taxable with rate
export const setTransactionTaxable = async (
  transactionId: string,
  isTaxable: boolean,
  taxRate?: number,
  taxJurisdiction?: string
) => {
  const updateData: any = {
    is_taxable: isTaxable,
    updated_at: new Date()
  };

  if (isTaxable && taxRate !== undefined) {
    // Get transaction amount
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);

    if (transaction) {
      const taxAmount = (transaction.amount * taxRate) / 100;
      updateData.tax_rate = taxRate;
      updateData.tax_amount = taxAmount;
      updateData.tax_jurisdiction = taxJurisdiction;
    }
  } else {
    // Clear tax data if marking as non-taxable
    updateData.tax_rate = null;
    updateData.tax_amount = null;
    updateData.tax_jurisdiction = null;
  }

  const [updated] = await db
    .update(transactions)
    .set(updateData)
    .where(eq(transactions.id, transactionId))
    .returning();

  return updated;
};

// Calculate taxable income for period
export const calculateTaxableIncome = async (
  userId: string,
  householdId: string | null,
  startDate: Date,
  endDate: Date
) => {
  const result = await db
    .select({
      totalTaxableIncome: sql<number>`SUM(${transactions.amount})`,
      totalTaxCollected: sql<number>`SUM(COALESCE(${transactions.tax_amount}, 0))`,
      transactionCount: sql<number>`COUNT(*)`,
      avgTaxRate: sql<number>`AVG(${transactions.tax_rate})`
    })
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      householdId ? eq(transactions.household_id, householdId) : sql`1=1`,
      eq(transactions.type, 'income'),
      eq(transactions.is_taxable, true),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate)
    ));

  return result[0] || {
    totalTaxableIncome: 0,
    totalTaxCollected: 0,
    transactionCount: 0,
    avgTaxRate: 0
  };
};

// Get quarterly periods
export const getQuarterDates = (year: number, quarter: number) => {
  const quarters = {
    1: { start: new Date(year, 0, 1), end: new Date(year, 2, 31) },
    2: { start: new Date(year, 3, 1), end: new Date(year, 5, 30) },
    3: { start: new Date(year, 6, 1), end: new Date(year, 8, 30) },
    4: { start: new Date(year, 9, 1), end: new Date(year, 11, 31) }
  };
  return quarters[quarter];
};

// Get current quarter
export const getCurrentQuarter = () => {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return { year: now.getFullYear(), quarter };
};

// Generate sales tax report for quarter
export const generateSalesTaxReport = async (
  userId: string,
  householdId: string | null,
  year: number,
  quarter: number
) => {
  const { start, end } = getQuarterDates(year, quarter);
  
  const taxableData = await calculateTaxableIncome(userId, householdId, start, end);
  
  // Get breakdown by tax rate
  const byRate = await db
    .select({
      taxRate: transactions.tax_rate,
      taxJurisdiction: transactions.tax_jurisdiction,
      totalIncome: sql<number>`SUM(${transactions.amount})`,
      totalTax: sql<number>`SUM(${transactions.tax_amount})`,
      count: sql<number>`COUNT(*)`
    })
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      householdId ? eq(transactions.household_id, householdId) : sql`1=1`,
      eq(transactions.type, 'income'),
      eq(transactions.is_taxable, true),
      gte(transactions.date, start),
      lte(transactions.date, end)
    ))
    .groupBy(transactions.tax_rate, transactions.tax_jurisdiction)
    .orderBy(desc(sql`SUM(${transactions.amount})`));

  // Get all transactions
  const transactions_list = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      description: transactions.description,
      taxRate: transactions.tax_rate,
      taxAmount: transactions.tax_amount,
      taxJurisdiction: transactions.tax_jurisdiction,
      categoryName: budget_categories.name
    })
    .from(transactions)
    .leftJoin(budget_categories, eq(transactions.category_id, budget_categories.id))
    .where(and(
      eq(transactions.user_id, userId),
      householdId ? eq(transactions.household_id, householdId) : sql`1=1`,
      eq(transactions.type, 'income'),
      eq(transactions.is_taxable, true),
      gte(transactions.date, start),
      lte(transactions.date, end)
    ))
    .orderBy(transactions.date);

  return {
    period: `Q${quarter} ${year}`,
    startDate: start,
    endDate: end,
    summary: taxableData,
    byRate,
    transactions: transactions_list
  };
};

// Create or update sales tax period
export const saveSalesTaxPeriod = async (
  userId: string,
  householdId: string | null,
  year: number,
  quarter: number
) => {
  const { start, end } = getQuarterDates(year, quarter);
  const taxableData = await calculateTaxableIncome(userId, householdId, start, end);

  const [period] = await db
    .insert(sales_tax_periods)
    .values({
      id: generateId(),
      user_id: userId,
      household_id: householdId,
      period_type: 'quarterly',
      period_year: year,
      period_number: quarter,
      start_date: start,
      end_date: end,
      total_taxable_income: taxableData.totalTaxableIncome,
      total_tax_collected: taxableData.totalTaxCollected,
      total_tax_due: taxableData.totalTaxCollected,
      status: 'calculated'
    })
    .onConflictDoUpdate({
      target: [sales_tax_periods.user_id, sales_tax_periods.household_id, sales_tax_periods.period_type, sales_tax_periods.period_year, sales_tax_periods.period_number],
      set: {
        total_taxable_income: taxableData.totalTaxableIncome,
        total_tax_collected: taxableData.totalTaxCollected,
        total_tax_due: taxableData.totalTaxCollected,
        updated_at: new Date()
      }
    })
    .returning();

  return period;
};

// Mark period as filed
export const markSalesTaxPeriodFiled = async (
  periodId: string,
  filedDate: Date,
  paymentConfirmation?: string
) => {
  const [period] = await db
    .update(sales_tax_periods)
    .set({
      status: 'filed',
      filed_date: filedDate,
      payment_confirmation: paymentConfirmation,
      updated_at: new Date()
    })
    .where(eq(sales_tax_periods.id, periodId))
    .returning();

  return period;
};

// Export sales tax data to CSV
export const exportSalesTaxCSV = async (
  userId: string,
  householdId: string | null,
  year: number,
  quarter: number
) => {
  const report = await generateSalesTaxReport(userId, householdId, year, quarter);
  
  const csvRows = [];
  csvRows.push(['Date', 'Description', 'Category', 'Amount', 'Tax Rate', 'Tax Amount', 'Jurisdiction']);

  for (const transaction of report.transactions) {
    csvRows.push([
      format(new Date(transaction.date), 'yyyy-MM-dd'),
      transaction.description,
      transaction.categoryName || '',
      transaction.amount.toFixed(2),
      transaction.taxRate?.toFixed(2) + '%' || '',
      transaction.taxAmount?.toFixed(2) || '0.00',
      transaction.taxJurisdiction || ''
    ]);
  }

  // Add summary row
  csvRows.push([]);
  csvRows.push(['TOTALS', '', '', 
    report.summary.totalTaxableIncome.toFixed(2), 
    '', 
    report.summary.totalTaxCollected.toFixed(2),
    ''
  ]);

  return csvRows;
};

// Get sales tax dashboard data
export const getSalesTaxDashboard = async (
  userId: string,
  householdId: string | null
) => {
  const { year, quarter } = getCurrentQuarter();
  
  // Current quarter
  const currentQuarter = await calculateTaxableIncome(
    userId,
    householdId,
    getQuarterDates(year, quarter).start,
    getQuarterDates(year, quarter).end
  );

  // Last quarter
  const lastQ = quarter === 1 ? 4 : quarter - 1;
  const lastQYear = quarter === 1 ? year - 1 : year;
  const lastQuarter = await calculateTaxableIncome(
    userId,
    householdId,
    getQuarterDates(lastQYear, lastQ).start,
    getQuarterDates(lastQYear, lastQ).end
  );

  // Year to date
  const ytd = await calculateTaxableIncome(
    userId,
    householdId,
    new Date(year, 0, 1),
    new Date()
  );

  // Get recent periods
  const periods = await db
    .select()
    .from(sales_tax_periods)
    .where(and(
      eq(sales_tax_periods.user_id, userId),
      householdId ? eq(sales_tax_periods.household_id, householdId) : sql`1=1`
    ))
    .orderBy(desc(sales_tax_periods.period_year), desc(sales_tax_periods.period_number))
    .limit(8);

  return {
    currentQuarter: {
      period: `Q${quarter} ${year}`,
      ...currentQuarter
    },
    lastQuarter: {
      period: `Q${lastQ} ${lastQYear}`,
      ...lastQuarter
    },
    yearToDate: {
      period: `YTD ${year}`,
      ...ytd
    },
    periods
  };
};
```

### UI Components

```tsx
// Sales Tax Toggle Component (for income transactions)
const SalesTaxToggle = ({ transaction, onUpdate }) => {
  const [isTaxable, setIsTaxable] = useState(transaction.is_taxable || false);
  const [taxRate, setTaxRate] = useState(transaction.tax_rate || 0);
  const [showRateInput, setShowRateInput] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsTaxable(checked);
    if (checked) {
      setShowRateInput(true);
    } else {
      await setTransactionTaxable(transaction.id, false);
      onUpdate();
    }
  };

  const handleSaveTaxRate = async () => {
    await setTransactionTaxable(transaction.id, true, taxRate);
    setShowRateInput(false);
    onUpdate();
  };

  const taxAmount = (transaction.amount * taxRate) / 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Taxable Income</Label>
        <Switch checked={isTaxable} onCheckedChange={handleToggle} />
      </div>

      {isTaxable && !showRateInput && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div>
            <p className="text-sm font-medium">Tax Rate: {taxRate}%</p>
            <p className="text-xs text-muted-foreground">
              Tax Amount: ${taxAmount.toFixed(2)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowRateInput(true)}>
            Edit
          </Button>
        </div>
      )}

      {showRateInput && (
        <div className="space-y-3 p-4 border rounded-lg">
          <div>
            <Label>Tax Rate (%)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Transaction Amount: ${transaction.amount.toFixed(2)}</p>
            <p className="font-medium">Tax Amount: ${taxAmount.toFixed(2)}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveTaxRate}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setShowRateInput(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// Sales Tax Dashboard
const SalesTaxDashboard = ({ userId, householdId }) => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [userId, householdId]);

  const loadDashboard = async () => {
    setLoading(true);
    const data = await getSalesTaxDashboard(userId, householdId);
    setDashboard(data);
    setLoading(false);
  };

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current Quarter</CardTitle>
            <CardDescription>{dashboard.currentQuarter.period}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Taxable Income</p>
                <p className="text-2xl font-bold">
                  ${dashboard.currentQuarter.totalTaxableIncome.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tax Collected</p>
                <p className="text-lg font-semibold text-blue-600">
                  ${dashboard.currentQuarter.totalTaxCollected.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Last Quarter</CardTitle>
            <CardDescription>{dashboard.lastQuarter.period}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Taxable Income</p>
                <p className="text-2xl font-bold">
                  ${dashboard.lastQuarter.totalTaxableIncome.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tax Collected</p>
                <p className="text-lg font-semibold">
                  ${dashboard.lastQuarter.totalTaxCollected.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Year to Date</CardTitle>
            <CardDescription>{dashboard.yearToDate.period}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Taxable Income</p>
                <p className="text-2xl font-bold">
                  ${dashboard.yearToDate.totalTaxableIncome.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tax Collected</p>
                <p className="text-lg font-semibold text-purple-600">
                  ${dashboard.yearToDate.totalTaxCollected.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period History */}
      <Card>
        <CardHeader>
          <CardTitle>Filing History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Taxable Income</TableHead>
                <TableHead>Tax Collected</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.periods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell>
                    Q{period.period_number} {period.period_year}
                  </TableCell>
                  <TableCell>
                    ${period.total_taxable_income.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    ${period.total_tax_collected.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      period.status === 'paid' ? 'success' :
                      period.status === 'filed' ? 'secondary' :
                      period.status === 'calculated' ? 'default' : 'outline'
                    }>
                      {period.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// Quarterly Sales Tax Report Viewer
const QuarterlySalesTaxReport = ({ userId, householdId }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(getCurrentQuarter().quarter);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [userId, householdId, year, quarter]);

  const loadReport = async () => {
    setLoading(true);
    const data = await generateSalesTaxReport(userId, householdId, year, quarter);
    setReport(data);
    setLoading(false);
  };

  const handleExport = async () => {
    const csvData = await exportSalesTaxCSV(userId, householdId, year, quarter);
    downloadCSV(csvData, `sales-tax-Q${quarter}-${year}.csv`);
  };

  if (loading) return <Skeleton className="h-96" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sales Tax Report</CardTitle>
            <CardDescription>{report.period}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(quarter)} onValueChange={(v) => setQuarter(parseInt(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Q1</SelectItem>
                <SelectItem value="2">Q2</SelectItem>
                <SelectItem value="3">Q3</SelectItem>
                <SelectItem value="4">Q4</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2].map(offset => {
                  const y = new Date().getFullYear() - offset;
                  return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Taxable Income</p>
            <p className="text-2xl font-bold">
              ${report.summary.totalTaxableIncome.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Tax Collected</p>
            <p className="text-2xl font-bold text-blue-600">
              ${report.summary.totalTaxCollected.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Transactions</p>
            <p className="text-2xl font-bold">
              {report.summary.transactionCount}
            </p>
          </div>
        </div>

        {/* By Tax Rate */}
        {report.byRate.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Breakdown by Tax Rate</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tax Rate</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead className="text-right">Taxable Income</TableHead>
                  <TableHead className="text-right">Tax Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byRate.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.taxRate}%</TableCell>
                    <TableCell>{item.taxJurisdiction || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      ${item.totalIncome.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ${item.totalTax.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

---

## 🔍 Advanced Search & Filtering

### Overview
Powerful transaction search system with multiple filter criteria, Boolean logic, saved search presets, and export capabilities. Users can quickly find specific transactions or groups of transactions across any time period using flexible, combinable filters.

### Database Schema Extensions

```sql
-- Saved search presets
CREATE TABLE search_presets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  filter_criteria TEXT NOT NULL, -- JSON object of filter parameters
  is_favorite BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (household_id) REFERENCES households(id),
  INDEX idx_search_presets_user (user_id, household_id),
  INDEX idx_search_presets_favorite (user_id, is_favorite)
);

-- Search history for quick re-search
CREATE TABLE search_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  search_criteria TEXT NOT NULL, -- JSON object
  results_count INTEGER,
  searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_search_history_user (user_id),
  INDEX idx_search_history_recent (user_id, searched_at DESC)
);
```

### Core Search Functions

```typescript
// Search filter interface
interface TransactionSearchFilters {
  // Date filters
  dateFrom?: Date;
  dateTo?: Date;
  datePreset?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'custom';
  
  // Amount filters
  amountMin?: number;
  amountMax?: number;
  amountExact?: number;
  
  // Transaction attributes
  type?: 'income' | 'expense' | 'transfer';
  accountIds?: string[];
  categoryIds?: string[];
  merchantNames?: string[];
  description?: string; // partial match
  notes?: string; // partial match
  
  // Tags and custom fields
  tagIds?: string[];
  tagMatchAll?: boolean; // true = AND, false = OR
  customFieldFilters?: Array<{
    fieldId: string;
    value: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  }>;
  
  // Special filters
  isSplit?: boolean;
  isRecurring?: boolean;
  isTaxable?: boolean; // for sales tax
  hasReceipt?: boolean;
  hasNotes?: boolean;
  isCleared?: boolean;
  isPending?: boolean;
  
  // Tax filters
  taxCategoryIds?: string[];
  isDeductible?: boolean;
  
  // Household filters
  householdId?: string;
  createdByUserId?: string;
  
  // Sort options
  sortBy?: 'date' | 'amount' | 'description' | 'category' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  
  // Pagination
  limit?: number;
  offset?: number;
}

// Main search function
export const searchTransactions = async (
  userId: string,
  filters: TransactionSearchFilters
) => {
  let query = db
    .select({
      transaction: transactions,
      category: budget_categories,
      account: accounts,
      tags: sql<string[]>`COALESCE(
        JSON_GROUP_ARRAY(
          CASE WHEN ${tags.id} IS NOT NULL 
          THEN JSON_OBJECT('id', ${tags.id}, 'name', ${tags.name}, 'color', ${tags.color})
          END
        ), '[]'
      )`,
      customFields: sql<any[]>`'[]'`, // placeholder for custom field values
      splits: sql<any[]>`'[]'` // placeholder for split details
    })
    .from(transactions)
    .leftJoin(budget_categories, eq(transactions.category_id, budget_categories.id))
    .leftJoin(accounts, eq(transactions.account_id, accounts.id))
    .leftJoin(transaction_tags, eq(transactions.id, transaction_tags.transaction_id))
    .leftJoin(tags, eq(transaction_tags.tag_id, tags.id))
    .where(eq(transactions.user_id, userId));

  // Apply date filters
  if (filters.dateFrom) {
    query = query.where(gte(transactions.date, filters.dateFrom));
  }
  if (filters.dateTo) {
    query = query.where(lte(transactions.date, filters.dateTo));
  }
  
  // Apply date presets
  if (filters.datePreset) {
    const dateRange = getDateRangeFromPreset(filters.datePreset);
    query = query.where(
      and(
        gte(transactions.date, dateRange.start),
        lte(transactions.date, dateRange.end)
      )
    );
  }

  // Apply amount filters
  if (filters.amountMin !== undefined) {
    query = query.where(gte(transactions.amount, filters.amountMin));
  }
  if (filters.amountMax !== undefined) {
    query = query.where(lte(transactions.amount, filters.amountMax));
  }
  if (filters.amountExact !== undefined) {
    query = query.where(eq(transactions.amount, filters.amountExact));
  }

  // Apply type filter
  if (filters.type) {
    query = query.where(eq(transactions.type, filters.type));
  }

  // Apply account filters
  if (filters.accountIds && filters.accountIds.length > 0) {
    query = query.where(inArray(transactions.account_id, filters.accountIds));
  }

  // Apply category filters
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    query = query.where(inArray(transactions.category_id, filters.categoryIds));
  }

  // Apply merchant filter (partial match, case-insensitive)
  if (filters.merchantNames && filters.merchantNames.length > 0) {
    const merchantConditions = filters.merchantNames.map(name =>
      sql`LOWER(${transactions.merchant}) LIKE LOWER('%${name}%')`
    );
    query = query.where(or(...merchantConditions));
  }

  // Apply description filter (partial match, case-insensitive)
  if (filters.description) {
    query = query.where(
      sql`LOWER(${transactions.description}) LIKE LOWER('%${filters.description}%')`
    );
  }

  // Apply notes filter (partial match, case-insensitive)
  if (filters.notes) {
    query = query.where(
      sql`LOWER(${transactions.notes}) LIKE LOWER('%${filters.notes}%')`
    );
  }

  // Apply special filters
  if (filters.isSplit !== undefined) {
    query = query.where(eq(transactions.is_split, filters.isSplit));
  }
  if (filters.isTaxable !== undefined) {
    query = query.where(eq(transactions.is_taxable, filters.isTaxable));
  }
  if (filters.hasNotes !== undefined) {
    query = query.where(
      filters.hasNotes 
        ? sql`${transactions.notes} IS NOT NULL AND ${transactions.notes} != ''`
        : sql`${transactions.notes} IS NULL OR ${transactions.notes} = ''`
    );
  }

  // Apply household filter
  if (filters.householdId) {
    query = query.where(eq(transactions.household_id, filters.householdId));
  }

  // Apply created by user filter
  if (filters.createdByUserId) {
    query = query.where(eq(transactions.user_id, filters.createdByUserId));
  }

  // Group by transaction id to handle joins
  query = query.groupBy(transactions.id);

  // Apply sorting
  const sortBy = filters.sortBy || 'date';
  const sortOrder = filters.sortOrder || 'desc';
  const sortColumn = {
    date: transactions.date,
    amount: transactions.amount,
    description: transactions.description,
    category: budget_categories.name,
    created_at: transactions.created_at
  }[sortBy];

  if (sortOrder === 'asc') {
    query = query.orderBy(asc(sortColumn));
  } else {
    query = query.orderBy(desc(sortColumn));
  }

  // Apply pagination
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  if (filters.offset) {
    query = query.offset(filters.offset);
  }

  const results = await query;

  // Post-process for tags filtering if specified
  let filteredResults = results;
  if (filters.tagIds && filters.tagIds.length > 0) {
    filteredResults = results.filter(result => {
      const transactionTagIds = result.tags.map(t => t.id);
      if (filters.tagMatchAll) {
        // AND logic - transaction must have ALL specified tags
        return filters.tagIds.every(tagId => transactionTagIds.includes(tagId));
      } else {
        // OR logic - transaction must have AT LEAST ONE specified tag
        return filters.tagIds.some(tagId => transactionTagIds.includes(tagId));
      }
    });
  }

  return {
    results: filteredResults,
    count: filteredResults.length,
    filters: filters
  };
};

// Helper function for date presets
const getDateRangeFromPreset = (preset: string) => {
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  switch (preset) {
    case 'today':
      return { start: startOfDay, end: endOfDay };
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { 
        start: new Date(yesterday.setHours(0, 0, 0, 0)), 
        end: new Date(yesterday.setHours(23, 59, 59, 999)) 
      };
    case 'this_week':
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      return { start: new Date(startOfWeek.setHours(0, 0, 0, 0)), end: endOfDay };
    case 'last_week':
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      return { 
        start: new Date(lastWeekStart.setHours(0, 0, 0, 0)), 
        end: new Date(lastWeekEnd.setHours(23, 59, 59, 999)) 
      };
    case 'this_month':
      return { 
        start: new Date(now.getFullYear(), now.getMonth(), 1), 
        end: endOfDay 
      };
    case 'last_month':
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { 
        start: lastMonth, 
        end: new Date(lastMonthEnd.setHours(23, 59, 59, 999)) 
      };
    case 'this_quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      return { 
        start: new Date(now.getFullYear(), quarter * 3, 1), 
        end: endOfDay 
      };
    case 'this_year':
      return { 
        start: new Date(now.getFullYear(), 0, 1), 
        end: endOfDay 
      };
    case 'last_year':
      return { 
        start: new Date(now.getFullYear() - 1, 0, 1), 
        end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999) 
      };
    default:
      return { start: new Date(0), end: endOfDay };
  }
};

// Save search preset
export const saveSearchPreset = async (
  userId: string,
  householdId: string | null,
  name: string,
  filters: TransactionSearchFilters,
  description?: string
) => {
  const [preset] = await db
    .insert(search_presets)
    .values({
      id: generateId(),
      user_id: userId,
      household_id: householdId,
      name,
      description,
      filter_criteria: JSON.stringify(filters)
    })
    .returning();

  return preset;
};

// Get saved search presets
export const getSearchPresets = async (
  userId: string,
  householdId: string | null
) => {
  const presets = await db
    .select()
    .from(search_presets)
    .where(and(
      eq(search_presets.user_id, userId),
      householdId ? eq(search_presets.household_id, householdId) : sql`1=1`
    ))
    .orderBy(
      desc(search_presets.is_favorite),
      desc(search_presets.usage_count),
      desc(search_presets.updated_at)
    );

  return presets.map(preset => ({
    ...preset,
    filter_criteria: JSON.parse(preset.filter_criteria)
  }));
};

// Execute saved search preset
export const executeSearchPreset = async (
  userId: string,
  presetId: string
) => {
  const [preset] = await db
    .select()
    .from(search_presets)
    .where(eq(search_presets.id, presetId))
    .limit(1);

  if (!preset) {
    throw new Error('Search preset not found');
  }

  // Update usage tracking
  await db
    .update(search_presets)
    .set({
      usage_count: sql`${search_presets.usage_count} + 1`,
      last_used_at: new Date()
    })
    .where(eq(search_presets.id, presetId));

  const filters = JSON.parse(preset.filter_criteria);
  return await searchTransactions(userId, filters);
};

// Delete search preset
export const deleteSearchPreset = async (presetId: string, userId: string) => {
  await db
    .delete(search_presets)
    .where(and(
      eq(search_presets.id, presetId),
      eq(search_presets.user_id, userId)
    ));
};

// Toggle favorite status
export const togglePresetFavorite = async (presetId: string, userId: string) => {
  const [preset] = await db
    .select()
    .from(search_presets)
    .where(and(
      eq(search_presets.id, presetId),
      eq(search_presets.user_id, userId)
    ))
    .limit(1);

  if (preset) {
    const [updated] = await db
      .update(search_presets)
      .set({ is_favorite: !preset.is_favorite })
      .where(eq(search_presets.id, presetId))
      .returning();
    
    return updated;
  }
};

// Save search to history
export const saveSearchHistory = async (
  userId: string,
  filters: TransactionSearchFilters,
  resultsCount: number
) => {
  await db.insert(search_history).values({
    id: generateId(),
    user_id: userId,
    search_criteria: JSON.stringify(filters),
    results_count: resultsCount
  });

  // Keep only last 20 searches
  const allHistory = await db
    .select()
    .from(search_history)
    .where(eq(search_history.user_id, userId))
    .orderBy(desc(search_history.searched_at));

  if (allHistory.length > 20) {
    const idsToDelete = allHistory.slice(20).map(h => h.id);
    await db
      .delete(search_history)
      .where(inArray(search_history.id, idsToDelete));
  }
};

// Get search history
export const getSearchHistory = async (userId: string, limit: number = 10) => {
  const history = await db
    .select()
    .from(search_history)
    .where(eq(search_history.user_id, userId))
    .orderBy(desc(search_history.searched_at))
    .limit(limit);

  return history.map(h => ({
    ...h,
    search_criteria: JSON.parse(h.search_criteria)
  }));
};

// Quick filters (commonly used presets)
export const QUICK_FILTERS = {
  unreconciled: (userId: string) => searchTransactions(userId, { isCleared: false }),
  largeExpenses: (userId: string) => searchTransactions(userId, { type: 'expense', amountMin: 100, sortBy: 'amount', sortOrder: 'desc' }),
  taxDeductible: (userId: string) => searchTransactions(userId, { isDeductible: true }),
  thisMonthIncome: (userId: string) => searchTransactions(userId, { type: 'income', datePreset: 'this_month' }),
  thisMonthExpenses: (userId: string) => searchTransactions(userId, { type: 'expense', datePreset: 'this_month' }),
  recentSplits: (userId: string) => searchTransactions(userId, { isSplit: true, sortBy: 'date', sortOrder: 'desc', limit: 50 })
};

// Export search results to CSV
export const exportSearchResultsCSV = (results: any[], filters: TransactionSearchFilters) => {
  const csvRows = [];
  csvRows.push([
    'Date',
    'Description',
    'Merchant',
    'Category',
    'Account',
    'Type',
    'Amount',
    'Tags',
    'Notes',
    'Is Split',
    'Tax Deductible'
  ]);

  for (const result of results) {
    const tagNames = result.tags.map(t => t.name).join(', ');
    csvRows.push([
      format(new Date(result.transaction.date), 'yyyy-MM-dd'),
      result.transaction.description,
      result.transaction.merchant || '',
      result.category?.name || '',
      result.account?.name || '',
      result.transaction.type,
      result.transaction.amount.toFixed(2),
      tagNames,
      result.transaction.notes || '',
      result.transaction.is_split ? 'Yes' : 'No',
      result.transaction.is_deductible ? 'Yes' : 'No'
    ]);
  }

  return csvRows;
};
```

### UI Components

```tsx
// Advanced Search Component
const AdvancedSearch = ({ userId, householdId, onResultsUpdate }) => {
  const [filters, setFilters] = useState<TransactionSearchFilters>({
    sortBy: 'date',
    sortOrder: 'desc'
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [expandedSections, setExpandedSections] = useState(['date', 'amount']);

  const handleSearch = async () => {
    setLoading(true);
    const searchResults = await searchTransactions(userId, filters);
    setResults(searchResults.results);
    await saveSearchHistory(userId, filters, searchResults.count);
    onResultsUpdate(searchResults);
    setLoading(false);
  };

  const handleClearFilters = () => {
    setFilters({ sortBy: 'date', sortOrder: 'desc' });
    setResults([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Advanced Search</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClearFilters}>
            Clear All
          </Button>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="cursor-pointer hover:bg-accent">
          This Month
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-accent">
          Large Expenses
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-accent">
          Tax Deductible
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-accent">
          Unreconciled
        </Badge>
      </div>

      <Accordion type="multiple" value={expandedSections} onValueChange={setExpandedSections}>
        {/* Date Filters */}
        <AccordionItem value="date">
          <AccordionTrigger>Date Range</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <Select 
                value={filters.datePreset || ''} 
                onValueChange={(v) => setFilters({...filters, datePreset: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select preset..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="last_year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {filters.datePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>From</Label>
                    <Input 
                      type="date" 
                      value={filters.dateFrom ? format(filters.dateFrom, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setFilters({...filters, dateFrom: new Date(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>To</Label>
                    <Input 
                      type="date" 
                      value={filters.dateTo ? format(filters.dateTo, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setFilters({...filters, dateTo: new Date(e.target.value)})}
                    />
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Amount Filters */}
        <AccordionItem value="amount">
          <AccordionTrigger>Amount</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Amount</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  value={filters.amountMin || ''}
                  onChange={(e) => setFilters({...filters, amountMin: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <Label>Max Amount</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  value={filters.amountMax || ''}
                  onChange={(e) => setFilters({...filters, amountMax: parseFloat(e.target.value)})}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Category & Account Filters */}
        <AccordionItem value="categories">
          <AccordionTrigger>Categories & Accounts</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <div>
                <Label>Transaction Type</Label>
                <Select 
                  value={filters.type || ''} 
                  onValueChange={(v) => setFilters({...filters, type: v as any})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Category multi-select */}
              {/* Account multi-select */}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Text Search */}
        <AccordionItem value="text">
          <AccordionTrigger>Description & Notes</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <div>
                <Label>Description contains</Label>
                <Input 
                  placeholder="Search description..."
                  value={filters.description || ''}
                  onChange={(e) => setFilters({...filters, description: e.target.value})}
                />
              </div>
              <div>
                <Label>Notes contain</Label>
                <Input 
                  placeholder="Search notes..."
                  value={filters.notes || ''}
                  onChange={(e) => setFilters({...filters, notes: e.target.value})}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Special Filters */}
        <AccordionItem value="special">
          <AccordionTrigger>Special Filters</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="split" 
                  checked={filters.isSplit === true}
                  onCheckedChange={(checked) => 
                    setFilters({...filters, isSplit: checked ? true : undefined})
                  }
                />
                <Label htmlFor="split">Split Transactions Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="taxable" 
                  checked={filters.isTaxable === true}
                  onCheckedChange={(checked) => 
                    setFilters({...filters, isTaxable: checked ? true : undefined})
                  }
                />
                <Label htmlFor="taxable">Taxable Income Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="deductible" 
                  checked={filters.isDeductible === true}
                  onCheckedChange={(checked) => 
                    setFilters({...filters, isDeductible: checked ? true : undefined})
                  }
                />
                <Label htmlFor="deductible">Tax Deductible Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="notes" 
                  checked={filters.hasNotes === true}
                  onCheckedChange={(checked) => 
                    setFilters({...filters, hasNotes: checked ? true : undefined})
                  }
                />
                <Label htmlFor="notes">Has Notes</Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Active Filters Display */}
      {Object.keys(filters).filter(k => k !== 'sortBy' && k !== 'sortOrder').length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {/* Display active filter badges */}
        </div>
      )}

      {/* Save Search Button */}
      {results.length > 0 && (
        <Button variant="outline" onClick={() => setShowSavePreset(true)}>
          <Star className="h-4 w-4 mr-2" />
          Save Search
        </Button>
      )}
    </div>
  );
};

// Saved Search Presets Sidebar
const SearchPresetsSidebar = ({ userId, householdId, onPresetSelect }) => {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPresets();
  }, [userId, householdId]);

  const loadPresets = async () => {
    setLoading(true);
    const data = await getSearchPresets(userId, householdId);
    setPresets(data);
    setLoading(false);
  };

  const handleExecutePreset = async (presetId: string) => {
    const results = await executeSearchPreset(userId, presetId);
    onPresetSelect(results);
    loadPresets(); // Refresh to update usage count
  };

  const handleToggleFavorite = async (presetId: string) => {
    await togglePresetFavorite(presetId, userId);
    loadPresets();
  };

  const handleDelete = async (presetId: string) => {
    await deleteSearchPreset(presetId, userId);
    loadPresets();
  };

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Saved Searches</h3>
      
      {presets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No saved searches yet. Run a search and click "Save Search" to create one.
        </p>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <Card key={preset.id} className="p-3 cursor-pointer hover:bg-accent">
              <div className="flex items-start justify-between">
                <div 
                  className="flex-1"
                  onClick={() => handleExecutePreset(preset.id)}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{preset.name}</p>
                    {preset.is_favorite && (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    )}
                  </div>
                  {preset.description && (
                    <p className="text-xs text-muted-foreground">{preset.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Used {preset.usage_count} times
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleToggleFavorite(preset.id)}>
                      {preset.is_favorite ? 'Remove from' : 'Add to'} Favorites
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(preset.id)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// Search Results Display with Export
const SearchResults = ({ results, filters }) => {
  const handleExport = () => {
    const csvData = exportSearchResultsCSV(results, filters);
    downloadCSV(csvData, `search-results-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {results.length} {results.length === 1 ? 'Result' : 'Results'}
        </h3>
        {results.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>

      {results.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No transactions found matching your filters.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {results.map((result) => (
            <TransactionCard key={result.transaction.id} transaction={result} />
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 📜 Audit Log & Version History

### Overview
Complete audit trail system that tracks all changes to transactions, accounts, budgets, and other financial data. Users can see who made what changes and when, compare versions side-by-side, and revert to previous versions if needed. Essential for household transparency and error recovery.

### Database Schema Extensions

```sql
-- Audit log table for tracking all changes
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('transaction', 'account', 'budget', 'bill', 'goal', 'category', 'tag', 'custom_field')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  changes TEXT NOT NULL, -- JSON object with before/after values
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (household_id) REFERENCES households(id),
  INDEX idx_audit_log_entity (entity_type, entity_id),
  INDEX idx_audit_log_user (user_id, created_at DESC),
  INDEX idx_audit_log_household (household_id, created_at DESC)
);

-- Transaction versions for complete history
CREATE TABLE transaction_versions (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  data TEXT NOT NULL, -- Complete JSON snapshot of transaction at this version
  user_id TEXT NOT NULL, -- Who made this version
  change_summary TEXT, -- Brief description of what changed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(transaction_id, version_number),
  INDEX idx_transaction_versions (transaction_id, version_number DESC)
);

-- Add version tracking to transactions table
ALTER TABLE transactions ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE transactions ADD COLUMN last_modified_by TEXT;
ALTER TABLE transactions ADD COLUMN last_modified_at DATETIME;

-- Soft delete support
ALTER TABLE transactions ADD COLUMN deleted_at DATETIME;
ALTER TABLE transactions ADD COLUMN deleted_by TEXT;

-- Add version tracking to accounts
ALTER TABLE accounts ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE accounts ADD COLUMN last_modified_by TEXT;
ALTER TABLE accounts ADD COLUMN last_modified_at DATETIME;
ALTER TABLE accounts ADD COLUMN deleted_at DATETIME;
ALTER TABLE accounts ADD COLUMN deleted_by TEXT;
```

### Core Audit Functions

```typescript
// Log any change to the audit log
export const logAuditEntry = async (
  userId: string,
  householdId: string | null,
  entityType: 'transaction' | 'account' | 'budget' | 'bill' | 'goal' | 'category' | 'tag' | 'custom_field',
  entityId: string,
  action: 'create' | 'update' | 'delete' | 'restore',
  changes: {
    before?: any;
    after?: any;
    fields?: string[]; // List of fields that changed
  },
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  }
) => {
  const [auditEntry] = await db
    .insert(audit_log)
    .values({
      id: generateId(),
      user_id: userId,
      household_id: householdId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      changes: JSON.stringify(changes),
      ip_address: metadata?.ipAddress,
      user_agent: metadata?.userAgent
    })
    .returning();

  return auditEntry;
};

// Create transaction version snapshot
export const createTransactionVersion = async (
  transactionId: string,
  userId: string,
  changeSummary?: string
) => {
  // Get current transaction data
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Get current version number
  const [latestVersion] = await db
    .select({ version: transaction_versions.version_number })
    .from(transaction_versions)
    .where(eq(transaction_versions.transaction_id, transactionId))
    .orderBy(desc(transaction_versions.version_number))
    .limit(1);

  const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

  // Create version snapshot
  const [version] = await db
    .insert(transaction_versions)
    .values({
      id: generateId(),
      transaction_id: transactionId,
      version_number: newVersionNumber,
      data: JSON.stringify(transaction),
      user_id: userId,
      change_summary: changeSummary
    })
    .returning();

  // Update transaction version number
  await db
    .update(transactions)
    .set({
      version: newVersionNumber,
      last_modified_by: userId,
      last_modified_at: new Date()
    })
    .where(eq(transactions.id, transactionId));

  return version;
};

// Update transaction with automatic versioning and audit logging
export const updateTransactionWithAudit = async (
  transactionId: string,
  userId: string,
  householdId: string | null,
  updates: Partial<Transaction>,
  metadata?: { ipAddress?: string; userAgent?: string }
) => {
  // Get current transaction data
  const [before] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!before) {
    throw new Error('Transaction not found');
  }

  // Create version snapshot before update
  await createTransactionVersion(transactionId, userId, 'Manual edit');

  // Apply updates
  const [after] = await db
    .update(transactions)
    .set({
      ...updates,
      last_modified_by: userId,
      last_modified_at: new Date()
    })
    .where(eq(transactions.id, transactionId))
    .returning();

  // Determine which fields changed
  const changedFields = Object.keys(updates).filter(
    key => before[key] !== updates[key]
  );

  // Log to audit log
  await logAuditEntry(
    userId,
    householdId,
    'transaction',
    transactionId,
    'update',
    {
      before: Object.fromEntries(changedFields.map(k => [k, before[k]])),
      after: Object.fromEntries(changedFields.map(k => [k, after[k]])),
      fields: changedFields
    },
    metadata
  );

  return after;
};

// Soft delete transaction with audit
export const deleteTransactionWithAudit = async (
  transactionId: string,
  userId: string,
  householdId: string | null,
  metadata?: { ipAddress?: string; userAgent?: string }
) => {
  // Get current transaction
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Create version snapshot
  await createTransactionVersion(transactionId, userId, 'Deleted');

  // Soft delete
  const [deleted] = await db
    .update(transactions)
    .set({
      deleted_at: new Date(),
      deleted_by: userId
    })
    .where(eq(transactions.id, transactionId))
    .returning();

  // Log deletion
  await logAuditEntry(
    userId,
    householdId,
    'transaction',
    transactionId,
    'delete',
    { before: transaction },
    metadata
  );

  return deleted;
};

// Restore deleted transaction
export const restoreTransactionWithAudit = async (
  transactionId: string,
  userId: string,
  householdId: string | null
) => {
  const [restored] = await db
    .update(transactions)
    .set({
      deleted_at: null,
      deleted_by: null,
      last_modified_by: userId,
      last_modified_at: new Date()
    })
    .where(eq(transactions.id, transactionId))
    .returning();

  await logAuditEntry(
    userId,
    householdId,
    'transaction',
    transactionId,
    'restore',
    { after: restored }
  );

  return restored;
};

// Get transaction version history
export const getTransactionVersions = async (transactionId: string) => {
  const versions = await db
    .select({
      version: transaction_versions,
      user: users
    })
    .from(transaction_versions)
    .leftJoin(users, eq(transaction_versions.user_id, users.id))
    .where(eq(transaction_versions.transaction_id, transactionId))
    .orderBy(desc(transaction_versions.version_number));

  return versions.map(v => ({
    ...v.version,
    data: JSON.parse(v.version.data),
    user: v.user
  }));
};

// Revert transaction to specific version
export const revertTransactionToVersion = async (
  transactionId: string,
  versionNumber: number,
  userId: string,
  householdId: string | null
) => {
  // Get the version to revert to
  const [targetVersion] = await db
    .select()
    .from(transaction_versions)
    .where(and(
      eq(transaction_versions.transaction_id, transactionId),
      eq(transaction_versions.version_number, versionNumber)
    ))
    .limit(1);

  if (!targetVersion) {
    throw new Error('Version not found');
  }

  const versionData = JSON.parse(targetVersion.data);

  // Create a new version snapshot before reverting
  await createTransactionVersion(transactionId, userId, `Reverted to version ${versionNumber}`);

  // Apply the old data
  const [reverted] = await db
    .update(transactions)
    .set({
      ...versionData,
      id: transactionId, // Keep the same ID
      last_modified_by: userId,
      last_modified_at: new Date()
    })
    .where(eq(transactions.id, transactionId))
    .returning();

  // Log the revert action
  await logAuditEntry(
    userId,
    householdId,
    'transaction',
    transactionId,
    'update',
    {
      before: null,
      after: reverted,
      fields: ['reverted_to_version_' + versionNumber]
    }
  );

  return reverted;
};

// Get audit log for entity
export const getAuditLog = async (
  entityType: string,
  entityId: string,
  limit: number = 50
) => {
  const logs = await db
    .select({
      audit: audit_log,
      user: users
    })
    .from(audit_log)
    .leftJoin(users, eq(audit_log.user_id, users.id))
    .where(and(
      eq(audit_log.entity_type, entityType),
      eq(audit_log.entity_id, entityId)
    ))
    .orderBy(desc(audit_log.created_at))
    .limit(limit);

  return logs.map(l => ({
    ...l.audit,
    changes: JSON.parse(l.audit.changes),
    user: l.user
  }));
};

// Get user's recent activity
export const getUserRecentActivity = async (
  userId: string,
  householdId: string | null,
  limit: number = 50
) => {
  const activity = await db
    .select({
      audit: audit_log,
      user: users
    })
    .from(audit_log)
    .leftJoin(users, eq(audit_log.user_id, users.id))
    .where(and(
      eq(audit_log.user_id, userId),
      householdId ? eq(audit_log.household_id, householdId) : sql`1=1`
    ))
    .orderBy(desc(audit_log.created_at))
    .limit(limit);

  return activity.map(a => ({
    ...a.audit,
    changes: JSON.parse(a.audit.changes),
    user: a.user
  }));
};

// Get household activity feed
export const getHouseholdActivityFeed = async (
  householdId: string,
  limit: number = 100
) => {
  const activity = await db
    .select({
      audit: audit_log,
      user: users
    })
    .from(audit_log)
    .leftJoin(users, eq(audit_log.user_id, users.id))
    .where(eq(audit_log.household_id, householdId))
    .orderBy(desc(audit_log.created_at))
    .limit(limit);

  return activity.map(a => ({
    ...a.audit,
    changes: JSON.parse(a.audit.changes),
    user: a.user
  }));
};

// Compare two versions
export const compareVersions = (version1: any, version2: any) => {
  const differences = [];
  const allKeys = new Set([...Object.keys(version1), ...Object.keys(version2)]);

  for (const key of allKeys) {
    if (version1[key] !== version2[key]) {
      differences.push({
        field: key,
        oldValue: version1[key],
        newValue: version2[key]
      });
    }
  }

  return differences;
};
```

### UI Components

```tsx
// Transaction History Viewer
const TransactionHistory = ({ transactionId, userId, householdId }) => {
  const [versions, setVersions] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);

  useEffect(() => {
    loadHistory();
  }, [transactionId]);

  const loadHistory = async () => {
    setLoading(true);
    const [versionData, auditData] = await Promise.all([
      getTransactionVersions(transactionId),
      getAuditLog('transaction', transactionId)
    ]);
    setVersions(versionData);
    setAuditLog(auditData);
    setLoading(false);
  };

  const handleRevert = async (versionNumber: number) => {
    if (confirm(`Revert to version ${versionNumber}? This will create a new version with the old data.`)) {
      await revertTransactionToVersion(transactionId, versionNumber, userId, householdId);
      loadHistory();
      toast.success(`Reverted to version ${versionNumber}`);
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length !== 2) {
      toast.error('Select exactly 2 versions to compare');
      return;
    }
    // Open comparison modal
  };

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        {selectedVersions.length === 2 && (
          <Button onClick={handleCompare}>
            <GitCompare className="h-4 w-4 mr-2" />
            Compare Versions
          </Button>
        )}
      </div>

      <Tabs defaultValue="versions">
        <TabsList>
          <TabsTrigger value="versions">Versions ({versions.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit Log ({auditLog.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="versions" className="space-y-3">
          {versions.map((version) => (
            <Card key={version.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Checkbox
                      checked={selectedVersions.includes(version.version_number)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedVersions([...selectedVersions, version.version_number]);
                        } else {
                          setSelectedVersions(selectedVersions.filter(v => v !== version.version_number));
                        }
                      }}
                    />
                    <Badge variant={version.version_number === versions[0].version_number ? 'default' : 'outline'}>
                      Version {version.version_number}
                      {version.version_number === versions[0].version_number && ' (Current)'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(version.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm font-medium mb-1">
                    By {version.user?.name || 'Unknown User'}
                  </p>
                  {version.change_summary && (
                    <p className="text-sm text-muted-foreground">{version.change_summary}</p>
                  )}
                  <div className="mt-3 p-3 bg-muted rounded text-sm">
                    <p>Amount: ${version.data.amount}</p>
                    <p>Description: {version.data.description}</p>
                    <p>Date: {format(new Date(version.data.date), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                {version.version_number !== versions[0].version_number && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevert(version.version_number)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Revert
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="space-y-2">
          {auditLog.map((entry) => (
            <Card key={entry.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${
                  entry.action === 'create' ? 'bg-green-100' :
                  entry.action === 'update' ? 'bg-blue-100' :
                  entry.action === 'delete' ? 'bg-red-100' :
                  'bg-purple-100'
                }`}>
                  {entry.action === 'create' && <Plus className="h-4 w-4" />}
                  {entry.action === 'update' && <Edit className="h-4 w-4" />}
                  {entry.action === 'delete' && <Trash className="h-4 w-4" />}
                  {entry.action === 'restore' && <RotateCcw className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{entry.action}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm font-medium mb-2">
                    {entry.user?.name || 'Unknown User'}
                  </p>
                  {entry.changes.fields && (
                    <p className="text-sm text-muted-foreground">
                      Changed: {entry.changes.fields.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Version Comparison Modal
const VersionComparisonModal = ({ version1, version2, onClose }) => {
  const differences = compareVersions(version1.data, version2.data);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Compare Version {version1.version_number} vs Version {version2.version_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {differences.length === 0 ? (
            <p className="text-center text-muted-foreground">No differences found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Version {version1.version_number}</TableHead>
                  <TableHead>Version {version2.version_number}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {differences.map((diff, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{diff.field}</TableCell>
                    <TableCell className="bg-red-50">{String(diff.oldValue)}</TableCell>
                    <TableCell className="bg-green-50">{String(diff.newValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Recent Activity Feed Component
const RecentActivityFeed = ({ userId, householdId, limit = 20 }) => {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, [userId, householdId]);

  const loadActivity = async () => {
    setLoading(true);
    const data = householdId 
      ? await getHouseholdActivityFeed(householdId, limit)
      : await getUserRecentActivity(userId, null, limit);
    setActivity(data);
    setLoading(false);
  };

  if (loading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activity.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{entry.user?.name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{entry.user?.name || 'Unknown'}</span>
                  {' '}
                  <span className="text-muted-foreground">
                    {entry.action}d a {entry.entity_type}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
```

---

## 📥 CSV Import with Manual Mapping & Duplicate Detection ✅ COMPLETED

### Overview
Flexible CSV import system that allows users to import transactions from any bank, credit card, or financial application. Features intelligent column mapping, preview before import, duplicate detection with resolution options, and import history with rollback capability.

**Status:** Phase 2 implementation complete ✅ - All features implemented and integrated into the transactions dashboard.

### Phase 3 Implementation Status: IN PROGRESS 🟢
- Phase 3 Part 1: **Multi-Account Transfers** ✅ COMPLETED
  - Transfer CRUD APIs (POST, GET, PUT, DELETE)
  - Transfer suggestion engine based on usage pairs
  - Transfer form component with quick transfer buttons
  - Transfer list and history display
  - Dashboard integration with "Transfer Money" button
  - Full transaction audit trail and balance synchronization

- Phase 3 Part 2: **Calendar View** ✅ COMPLETED
  - Month and week view layouts
  - Day cells with transaction/bill indicators
  - Day detail modal with transaction listing
  - Transaction indicator component (color-coded by type)
  - Calendar header with navigation and quick date buttons
  - Calendar month and day API endpoints
  - Dashboard integration with "Calendar View" button

### Database Schema Extensions

```sql
-- Import templates for different banks/sources
CREATE TABLE import_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT,
  name TEXT NOT NULL, -- e.g., "Chase Credit Card", "Wells Fargo Checking"
  description TEXT,
  column_mappings TEXT NOT NULL, -- JSON object mapping CSV columns to app fields
  date_format TEXT, -- e.g., "MM/DD/YYYY", "YYYY-MM-DD"
  delimiter TEXT DEFAULT ',', -- CSV delimiter
  has_header_row BOOLEAN DEFAULT true,
  skip_rows INTEGER DEFAULT 0, -- Number of rows to skip at start
  default_account_id TEXT, -- Default account for imports
  is_favorite BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (household_id) REFERENCES households(id),
  FOREIGN KEY (default_account_id) REFERENCES accounts(id),
  INDEX idx_import_templates_user (user_id, household_id)
);

-- Import history
CREATE TABLE import_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT,
  template_id TEXT, -- Template used (if any)
  filename TEXT NOT NULL,
  file_size INTEGER,
  rows_total INTEGER NOT NULL,
  rows_imported INTEGER NOT NULL,
  rows_skipped INTEGER NOT NULL,
  rows_duplicates INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rolled_back')),
  error_message TEXT,
  import_settings TEXT, -- JSON of import configuration
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  rolled_back_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (household_id) REFERENCES households(id),
  FOREIGN KEY (template_id) REFERENCES import_templates(id),
  INDEX idx_import_history_user (user_id, created_at DESC)
);

-- Imported transactions (before final commit)
CREATE TABLE import_staging (
  id TEXT PRIMARY KEY,
  import_history_id TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  raw_data TEXT NOT NULL, -- JSON of original CSV row
  mapped_data TEXT NOT NULL, -- JSON of mapped transaction data
  duplicate_of TEXT, -- ID of existing transaction if duplicate detected
  duplicate_score DECIMAL(5,2), -- Similarity score (0-100)
  status TEXT NOT NULL CHECK (status IN ('pending', 'review', 'approved', 'skipped', 'imported')),
  validation_errors TEXT, -- JSON array of validation errors
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (import_history_id) REFERENCES import_history(id) ON DELETE CASCADE,
  INDEX idx_import_staging_history (import_history_id)
);

-- Track which transactions came from imports (for rollback)
ALTER TABLE transactions ADD COLUMN import_history_id TEXT;
ALTER TABLE transactions ADD COLUMN import_row_number INTEGER;
CREATE INDEX idx_transactions_import ON transactions(import_history_id);
```

### Core Import Functions

```typescript
// Column mapping interface
interface ColumnMapping {
  csvColumn: string; // Name or index of CSV column
  appField: 'date' | 'description' | 'amount' | 'category' | 'merchant' | 'notes' | 'account' | 'type';
  transform?: 'negate' | 'absolute' | 'trim' | 'uppercase' | 'lowercase';
  defaultValue?: any;
}

interface ImportTemplate {
  name: string;
  description?: string;
  columnMappings: ColumnMapping[];
  dateFormat: string;
  delimiter: string;
  hasHeaderRow: boolean;
  skipRows: number;
  defaultAccountId?: string;
}

// Parse CSV file
export const parseCSVFile = async (
  file: File,
  delimiter: string = ',',
  hasHeaderRow: boolean = true,
  skipRows: number = 0
) => {
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());
  
  // Skip specified rows
  const dataLines = lines.slice(skipRows);
  
  // Extract headers
  const headers = hasHeaderRow 
    ? dataLines[0].split(delimiter).map(h => h.trim())
    : dataLines[0].split(delimiter).map((_, i) => `Column ${i + 1}`);
  
  // Parse data rows
  const rows = (hasHeaderRow ? dataLines.slice(1) : dataLines).map((line, index) => {
    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const row: any = { _rowNumber: index + 1 };
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });
  
  return { headers, rows, totalRows: rows.length };
};

// Auto-detect column mappings
export const autoDetectMappings = (headers: string[]): ColumnMapping[] => {
  const mappings: ColumnMapping[] = [];
  
  const patterns = {
    date: /date|posted|transaction.*date/i,
    description: /description|memo|detail|merchant|payee/i,
    amount: /amount|value|total/i,
    category: /category|type|class/i,
    merchant: /merchant|vendor|payee|store/i,
    notes: /note|comment|memo/i
  };
  
  headers.forEach(header => {
    for (const [field, pattern] of Object.entries(patterns)) {
      if (pattern.test(header)) {
        mappings.push({
          csvColumn: header,
          appField: field as any
        });
        break;
      }
    }
  });
  
  return mappings;
};

// Apply mappings to transform CSV row to transaction
export const applyMappings = (
  row: any,
  mappings: ColumnMapping[],
  dateFormat: string,
  defaultAccountId?: string
): Partial<Transaction> => {
  const transaction: any = {
    account_id: defaultAccountId
  };
  
  mappings.forEach(mapping => {
    let value = row[mapping.csvColumn];
    
    // Apply transforms
    if (mapping.transform) {
      switch (mapping.transform) {
        case 'negate':
          value = -parseFloat(value);
          break;
        case 'absolute':
          value = Math.abs(parseFloat(value));
          break;
        case 'trim':
          value = value.trim();
          break;
        case 'uppercase':
          value = value.toUpperCase();
          break;
        case 'lowercase':
          value = value.toLowerCase();
          break;
      }
    }
    
    // Parse dates
    if (mapping.appField === 'date') {
      value = parseDate(value, dateFormat);
    }
    
    // Parse amounts
    if (mapping.appField === 'amount') {
      value = parseFloat(value.replace(/[,$]/g, ''));
      // Determine transaction type based on amount
      transaction.type = value < 0 ? 'expense' : 'income';
      value = Math.abs(value);
    }
    
    transaction[mapping.appField] = value || mapping.defaultValue;
  });
  
  return transaction;
};

// Duplicate detection algorithm
export const detectDuplicates = async (
  userId: string,
  householdId: string | null,
  transaction: Partial<Transaction>,
  lookbackDays: number = 7
) => {
  const targetDate = new Date(transaction.date);
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - lookbackDays);
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + lookbackDays);
  
  // Find potential duplicates
  const potentialDuplicates = await db
    .select()
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      householdId ? eq(transactions.household_id, householdId) : sql`1=1`,
      gte(transactions.date, startDate),
      lte(transactions.date, endDate),
      eq(transactions.account_id, transaction.account_id)
    ));
  
  // Calculate similarity scores
  const matches = potentialDuplicates.map(existing => {
    let score = 0;
    
    // Exact amount match (40 points)
    if (Math.abs(existing.amount - transaction.amount) < 0.01) {
      score += 40;
    } else if (Math.abs(existing.amount - transaction.amount) < 5) {
      score += 20; // Close amount
    }
    
    // Date proximity (30 points)
    const daysDiff = Math.abs(
      (new Date(existing.date).getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff === 0) {
      score += 30;
    } else if (daysDiff <= 2) {
      score += 20;
    } else if (daysDiff <= 5) {
      score += 10;
    }
    
    // Description similarity (30 points)
    const descSimilarity = calculateStringSimilarity(
      existing.description.toLowerCase(),
      (transaction.description || '').toLowerCase()
    );
    score += descSimilarity * 30;
    
    return {
      transaction: existing,
      score,
      reasons: [
        Math.abs(existing.amount - transaction.amount) < 0.01 && 'Exact amount match',
        daysDiff === 0 && 'Same date',
        descSimilarity > 0.8 && 'Very similar description'
      ].filter(Boolean)
    };
  });
  
  // Return matches with score >= 70 (high confidence duplicates)
  return matches.filter(m => m.score >= 70).sort((a, b) => b.score - a.score);
};

// String similarity using Levenshtein distance
const calculateStringSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

// Stage import for review
export const stageImport = async (
  userId: string,
  householdId: string | null,
  file: File,
  template: ImportTemplate
) => {
  // Create import history record
  const [importRecord] = await db
    .insert(import_history)
    .values({
      id: generateId(),
      user_id: userId,
      household_id: householdId,
      template_id: template.id,
      filename: file.name,
      file_size: file.size,
      rows_total: 0,
      rows_imported: 0,
      rows_skipped: 0,
      rows_duplicates: 0,
      status: 'processing',
      import_settings: JSON.stringify(template)
    })
    .returning();
  
  // Parse CSV
  const { headers, rows } = await parseCSVFile(
    file,
    template.delimiter,
    template.hasHeaderRow,
    template.skipRows
  );
  
  // Update total rows
  await db
    .update(import_history)
    .set({ rows_total: rows.length })
    .where(eq(import_history.id, importRecord.id));
  
  // Process each row
  const stagingRecords = [];
  
  for (const [index, row] of rows.entries()) {
    const mappedData = applyMappings(
      row,
      template.columnMappings,
      template.dateFormat,
      template.defaultAccountId
    );
    
    // Detect duplicates
    const duplicates = await detectDuplicates(userId, householdId, mappedData);
    
    const stagingRecord = {
      id: generateId(),
      import_history_id: importRecord.id,
      row_number: index + 1,
      raw_data: JSON.stringify(row),
      mapped_data: JSON.stringify(mappedData),
      duplicate_of: duplicates[0]?.transaction.id,
      duplicate_score: duplicates[0]?.score,
      status: duplicates.length > 0 ? 'review' : 'approved',
      validation_errors: validateTransaction(mappedData)
    };
    
    stagingRecords.push(stagingRecord);
  }
  
  // Insert staging records
  await db.insert(import_staging).values(stagingRecords);
  
  return {
    importId: importRecord.id,
    totalRows: rows.length,
    needsReview: stagingRecords.filter(r => r.status === 'review').length
  };
};

// Validate transaction data
const validateTransaction = (transaction: Partial<Transaction>): string | null => {
  const errors = [];
  
  if (!transaction.date) errors.push('Date is required');
  if (!transaction.amount || transaction.amount <= 0) errors.push('Valid amount is required');
  if (!transaction.description) errors.push('Description is required');
  if (!transaction.account_id) errors.push('Account is required');
  
  return errors.length > 0 ? JSON.stringify(errors) : null;
};

// Commit import (create actual transactions)
export const commitImport = async (
  importId: string,
  userId: string,
  householdId: string | null
) => {
  // Get approved staging records
  const stagingRecords = await db
    .select()
    .from(import_staging)
    .where(and(
      eq(import_staging.import_history_id, importId),
      eq(import_staging.status, 'approved')
    ));
  
  let imported = 0;
  let skipped = 0;
  
  // Create transactions
  for (const record of stagingRecords) {
    const transactionData = JSON.parse(record.mapped_data);
    
    try {
      await db.insert(transactions).values({
        ...transactionData,
        id: generateId(),
        user_id: userId,
        household_id: householdId,
        import_history_id: importId,
        import_row_number: record.row_number,
        created_at: new Date()
      });
      imported++;
    } catch (error) {
      skipped++;
      console.error(`Failed to import row ${record.row_number}:`, error);
    }
  }
  
  // Count duplicates
  const duplicates = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(import_staging)
    .where(and(
      eq(import_staging.import_history_id, importId),
      eq(import_staging.status, 'skipped')
    ));
  
  // Update import history
  await db
    .update(import_history)
    .set({
      rows_imported: imported,
      rows_skipped: skipped,
      rows_duplicates: duplicates[0].count,
      status: 'completed',
      completed_at: new Date()
    })
    .where(eq(import_history.id, importId));
  
  return { imported, skipped, duplicates: duplicates[0].count };
};

// Rollback import
export const rollbackImport = async (importId: string, userId: string) => {
  // Delete all transactions from this import
  const deleted = await db
    .delete(transactions)
    .where(eq(transactions.import_history_id, importId))
    .returning();
  
  // Update import history
  await db
    .update(import_history)
    .set({
      status: 'rolled_back',
      rolled_back_at: new Date()
    })
    .where(eq(import_history.id, importId));
  
  return { deletedCount: deleted.length };
};

// Save import template
export const saveImportTemplate = async (
  userId: string,
  householdId: string | null,
  template: ImportTemplate
) => {
  const [saved] = await db
    .insert(import_templates)
    .values({
      id: generateId(),
      user_id: userId,
      household_id: householdId,
      name: template.name,
      description: template.description,
      column_mappings: JSON.stringify(template.columnMappings),
      date_format: template.dateFormat,
      delimiter: template.delimiter,
      has_header_row: template.hasHeaderRow,
      skip_rows: template.skipRows,
      default_account_id: template.defaultAccountId
    })
    .returning();
  
  return saved;
};

// Get import templates
export const getImportTemplates = async (
  userId: string,
  householdId: string | null
) => {
  const templates = await db
    .select()
    .from(import_templates)
    .where(and(
      eq(import_templates.user_id, userId),
      householdId ? eq(import_templates.household_id, householdId) : sql`1=1`
    ))
    .orderBy(
      desc(import_templates.is_favorite),
      desc(import_templates.usage_count),
      desc(import_templates.updated_at)
    );
  
  return templates.map(t => ({
    ...t,
    columnMappings: JSON.parse(t.column_mappings)
  }));
};
```

### UI Components

```tsx
// CSV Import Wizard
const CSVImportWizard = ({ userId, householdId, onComplete }) => {
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Review, 4: Complete
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<any[]>([]);
  const [template, setTemplate] = useState<Partial<ImportTemplate>>({
    delimiter: ',',
    hasHeaderRow: true,
    skipRows: 0,
    columnMappings: []
  });
  const [importId, setImportId] = useState<string | null>(null);
  const [stagingData, setStagingData] = useState([]);

  // Step 1: File Upload
  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    const parsed = await parseCSVFile(
      uploadedFile,
      template.delimiter,
      template.hasHeaderRow,
      template.skipRows
    );
    setHeaders(parsed.headers);
    setSampleRows(parsed.rows.slice(0, 5)); // Show first 5 rows
    
    // Auto-detect mappings
    const autoMappings = autoDetectMappings(parsed.headers);
    setTemplate({ ...template, columnMappings: autoMappings });
    
    setStep(2);
  };

  // Step 2: Column Mapping
  const renderMappingStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Map Columns</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
          <Button onClick={() => proceedToReview()}>Next: Review</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Column Mappings</CardTitle>
          <CardDescription>
            Match your CSV columns to transaction fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {headers.map((header, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-1/3">
                <Label className="font-mono text-sm">{header}</Label>
                <p className="text-xs text-muted-foreground">
                  {sampleRows[0]?.[header]}
                </p>
              </div>
              <ArrowRight className="h-4 w-4" />
              <Select
                value={template.columnMappings.find(m => m.csvColumn === header)?.appField || 'ignore'}
                onValueChange={(value) => updateMapping(header, value)}
              >
                <SelectTrigger className="w-1/3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ignore">Don't Import</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="description">Description</SelectItem>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="merchant">Merchant</SelectItem>
                  <SelectItem value="notes">Notes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Date Format</Label>
            <Select
              value={template.dateFormat}
              onValueChange={(v) => setTemplate({ ...template, dateFormat: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                <SelectItem value="M/D/YY">M/D/YY</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Default Account</Label>
            <AccountSelector
              value={template.defaultAccountId}
              onChange={(id) => setTemplate({ ...template, defaultAccountId: id })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="save-template"
              checked={template.saveAsTemplate}
              onCheckedChange={(checked) => 
                setTemplate({ ...template, saveAsTemplate: checked })
              }
            />
            <Label htmlFor="save-template">Save as template for future imports</Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Step 3: Review & Duplicate Detection
  const proceedToReview = async () => {
    const result = await stageImport(userId, householdId, file, template);
    setImportId(result.importId);
    
    // Load staging data
    const staging = await db
      .select()
      .from(import_staging)
      .where(eq(import_staging.import_history_id, result.importId));
    setStagingData(staging);
    
    setStep(3);
  };

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Review Import</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
          <Button onClick={handleCommitImport}>Import {approvedCount} Transactions</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stagingData.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Needs Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">
              {stagingData.filter(r => r.status === 'review').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Ready to Import</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {stagingData.filter(r => r.status === 'approved').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review">
            Needs Review ({stagingData.filter(r => r.status === 'review').length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({stagingData.filter(r => r.status === 'approved').length})
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="space-y-2">
          {stagingData.filter(r => r.status === 'review').map((record) => {
            const data = JSON.parse(record.mapped_data);
            return (
              <Card key={record.id} className="border-yellow-300">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <div>
                          <p className="font-medium">{data.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(data.date), 'MMM d, yyyy')} • ${data.amount}
                          </p>
                        </div>
                      </div>
                      {record.duplicate_of && (
                        <div className="mt-3 p-3 bg-yellow-50 rounded">
                          <p className="text-sm font-medium mb-1">
                            Possible Duplicate ({record.duplicate_score}% match)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Similar transaction already exists
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(record.id)}
                      >
                        Import
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSkip(record.id)}
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="approved">
          {/* Show approved transactions */}
        </TabsContent>
      </Tabs>
    </div>
  );

  const handleCommitImport = async () => {
    const result = await commitImport(importId, userId, householdId);
    setStep(4);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Map Columns' },
            { num: 3, label: 'Review' },
            { num: 4, label: 'Complete' }
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              <div className={`flex items-center gap-2 ${step >= s.num ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= s.num ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  {s.num}
                </div>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              {i < 3 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  step > s.num ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step content */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Upload CSV File</h2>
          <FileUpload
            accept=".csv"
            onUpload={handleFileUpload}
            description="Upload a CSV file from your bank or financial application"
          />
          
          {/* Template selector */}
          <Card>
            <CardHeader>
              <CardTitle>Or Use a Saved Template</CardTitle>
            </CardHeader>
            <CardContent>
              <TemplateSelector
                userId={userId}
                householdId={householdId}
                onSelect={(template) => {
                  setTemplate(template);
                  // Prompt for file with this template
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
      {step === 2 && renderMappingStep()}
      {step === 3 && renderReviewStep()}
      {step === 4 && (
        <div className="text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
          <h2 className="text-2xl font-bold">Import Complete!</h2>
          <p className="text-muted-foreground">
            Successfully imported transactions
          </p>
          <Button onClick={onComplete}>View Transactions</Button>
        </div>
      )}
    </div>
  );
};

// Import History Viewer
const ImportHistory = ({ userId, householdId }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const records = await db
      .select()
      .from(import_history)
      .where(and(
        eq(import_history.user_id, userId),
        householdId ? eq(import_history.household_id, householdId) : sql`1=1`
      ))
      .orderBy(desc(import_history.started_at))
      .limit(20);
    setHistory(records);
  };

  const handleRollback = async (importId: string) => {
    if (confirm('This will delete all transactions from this import. Continue?')) {
      await rollbackImport(importId, userId);
      toast.success('Import rolled back successfully');
      loadHistory();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Imported</TableHead>
              <TableHead>Skipped</TableHead>
              <TableHead>Duplicates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  {format(new Date(record.started_at), 'MMM d, yyyy h:mm a')}
                </TableCell>
                <TableCell>{record.filename}</TableCell>
                <TableCell>{record.rows_imported}</TableCell>
                <TableCell>{record.rows_skipped}</TableCell>
                <TableCell>{record.rows_duplicates}</TableCell>
                <TableCell>
                  <Badge variant={
                    record.status === 'completed' ? 'success' :
                    record.status === 'failed' ? 'destructive' :
                    record.status === 'rolled_back' ? 'secondary' :
                    'default'
                  }>
                    {record.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {record.status === 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRollback(record.id)}
                    >
                      <Undo className="h-4 w-4 mr-2" />
                      Rollback
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
```

---

## 📋 Custom Transaction Categorization Rules

### Overview
User-defined rules that automatically categorize transactions based on merchant name, description, amount ranges, and other criteria. Rules execute in priority order and can be tested before applying. Supports complex conditions with AND/OR logic, making transaction entry hands-free for recurring transactions.

### Database Schema Extensions

```sql
-- Categorization rules
CREATE TABLE categorization_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Lower number = higher priority
  
  -- Matching conditions (JSON object)
  conditions TEXT NOT NULL, -- { field, operator, value, logicalOperator }
  
  -- Actions when matched (JSON object)
  actions TEXT NOT NULL, -- { categoryId, merchantName, notes, tags }
  
  -- Statistics
  match_count INTEGER DEFAULT 0,
  last_matched_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (household_id) REFERENCES households(id),
  INDEX idx_categorization_rules_user (user_id, household_id),
  INDEX idx_categorization_rules_priority (user_id, priority ASC, is_active)
);

-- Rule execution history
CREATE TABLE rule_execution_log (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  was_manual_override BOOLEAN DEFAULT false, -- User changed category after rule applied
  FOREIGN KEY (rule_id) REFERENCES categorization_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  INDEX idx_rule_execution_log_rule (rule_id, executed_at DESC),
  INDEX idx_rule_execution_log_transaction (transaction_id)
);

-- Track which rule categorized a transaction (for transparency)
ALTER TABLE transactions ADD COLUMN categorized_by_rule_id TEXT;
CREATE INDEX idx_transactions_rule ON transactions(categorized_by_rule_id);
```

### Core Rule Functions

```typescript
// Rule condition interface
interface RuleCondition {
  field: 'merchant' | 'description' | 'amount' | 'account_id' | 'type' | 'notes';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'between';
  value: string | number;
  value2?: number; // For 'between' operator
  caseSensitive?: boolean;
}

interface RuleConditionGroup {
  conditions: RuleCondition[];
  logicalOperator: 'AND' | 'OR';
  nestedGroups?: RuleConditionGroup[]; // Allow nested logic
}

interface RuleAction {
  categoryId: string;
  merchantName?: string; // Optionally override merchant name
  notes?: string; // Add automatic notes
  tagIds?: string[]; // Auto-apply tags
}

interface CategorizationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  conditions: RuleConditionGroup;
  actions: RuleAction;
}

// Evaluate a single condition
const evaluateCondition = (transaction: Transaction, condition: RuleCondition): boolean => {
  let fieldValue: any;
  
  switch (condition.field) {
    case 'merchant':
      fieldValue = transaction.merchant || '';
      break;
    case 'description':
      fieldValue = transaction.description || '';
      break;
    case 'amount':
      fieldValue = transaction.amount;
      break;
    case 'account_id':
      fieldValue = transaction.account_id;
      break;
    case 'type':
      fieldValue = transaction.type;
      break;
    case 'notes':
      fieldValue = transaction.notes || '';
      break;
  }
  
  // Convert to lowercase for case-insensitive comparison
  if (typeof fieldValue === 'string' && !condition.caseSensitive) {
    fieldValue = fieldValue.toLowerCase();
    if (typeof condition.value === 'string') {
      condition.value = condition.value.toLowerCase();
    }
  }
  
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    
    case 'contains':
      return typeof fieldValue === 'string' && 
             fieldValue.includes(String(condition.value));
    
    case 'starts_with':
      return typeof fieldValue === 'string' && 
             fieldValue.startsWith(String(condition.value));
    
    case 'ends_with':
      return typeof fieldValue === 'string' && 
             fieldValue.endsWith(String(condition.value));
    
    case 'greater_than':
      return Number(fieldValue) > Number(condition.value);
    
    case 'less_than':
      return Number(fieldValue) < Number(condition.value);
    
    case 'between':
      return Number(fieldValue) >= Number(condition.value) && 
             Number(fieldValue) <= Number(condition.value2);
    
    default:
      return false;
  }
};

// Evaluate condition group with nested logic
const evaluateConditionGroup = (transaction: Transaction, group: RuleConditionGroup): boolean => {
  // Evaluate all conditions in this group
  const conditionResults = group.conditions.map(condition => 
    evaluateCondition(transaction, condition)
  );
  
  // Evaluate nested groups
  const nestedResults = (group.nestedGroups || []).map(nestedGroup =>
    evaluateConditionGroup(transaction, nestedGroup)
  );
  
  const allResults = [...conditionResults, ...nestedResults];
  
  // Apply logical operator
  if (group.logicalOperator === 'AND') {
    return allResults.every(result => result === true);
  } else {
    return allResults.some(result => result === true);
  }
};

// Find matching rule for transaction
export const findMatchingRule = async (
  userId: string,
  householdId: string | null,
  transaction: Partial<Transaction>
): Promise<CategorizationRule | null> => {
  // Get all active rules sorted by priority
  const rules = await db
    .select()
    .from(categorization_rules)
    .where(and(
      eq(categorization_rules.user_id, userId),
      householdId ? eq(categorization_rules.household_id, householdId) : sql`1=1`,
      eq(categorization_rules.is_active, true)
    ))
    .orderBy(asc(categorization_rules.priority));
  
  // Test each rule until we find a match
  for (const rule of rules) {
    const conditions: RuleConditionGroup = JSON.parse(rule.conditions);
    
    if (evaluateConditionGroup(transaction as Transaction, conditions)) {
      return {
        ...rule,
        conditions,
        actions: JSON.parse(rule.actions)
      };
    }
  }
  
  return null;
};

// Apply rule to transaction
export const applyRule = async (
  rule: CategorizationRule,
  transaction: Partial<Transaction>
): Promise<Partial<Transaction>> => {
  const updatedTransaction = { ...transaction };
  
  // Apply category
  if (rule.actions.categoryId) {
    updatedTransaction.category_id = rule.actions.categoryId;
  }
  
  // Override merchant name if specified
  if (rule.actions.merchantName) {
    updatedTransaction.merchant = rule.actions.merchantName;
  }
  
  // Add notes
  if (rule.actions.notes) {
    updatedTransaction.notes = transaction.notes 
      ? `${transaction.notes}\n${rule.actions.notes}`
      : rule.actions.notes;
  }
  
  // Mark which rule categorized this
  updatedTransaction.categorized_by_rule_id = rule.id;
  
  return updatedTransaction;
};

// Auto-categorize transaction (called during creation)
export const autoCategorizeTransaction = async (
  userId: string,
  householdId: string | null,
  transaction: Partial<Transaction>
): Promise<Partial<Transaction>> => {
  const matchingRule = await findMatchingRule(userId, householdId, transaction);
  
  if (matchingRule) {
    const categorizedTransaction = await applyRule(matchingRule, transaction);
    
    // Update rule statistics
    await db
      .update(categorization_rules)
      .set({
        match_count: sql`${categorization_rules.match_count} + 1`,
        last_matched_at: new Date()
      })
      .where(eq(categorization_rules.id, matchingRule.id));
    
    return categorizedTransaction;
  }
  
  return transaction;
};

// Log rule execution
export const logRuleExecution = async (
  ruleId: string,
  transactionId: string
) => {
  await db.insert(rule_execution_log).values({
    id: generateId(),
    rule_id: ruleId,
    transaction_id: transactionId
  });
};

// Test rule against existing transactions (for preview)
export const testRule = async (
  userId: string,
  householdId: string | null,
  rule: CategorizationRule,
  limit: number = 50
) => {
  // Get recent transactions
  const recentTransactions = await db
    .select()
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      householdId ? eq(transactions.household_id, householdId) : sql`1=1`
    ))
    .orderBy(desc(transactions.date))
    .limit(limit);
  
  // Test rule against each transaction
  const matches = recentTransactions.filter(transaction => 
    evaluateConditionGroup(transaction, rule.conditions)
  );
  
  return {
    totalTested: recentTransactions.length,
    matchCount: matches.length,
    matches: matches.slice(0, 10) // Return first 10 matches for preview
  };
};

// Create categorization rule
export const createCategorizationRule = async (
  userId: string,
  householdId: string | null,
  rule: Omit<CategorizationRule, 'id'>
) => {
  const [created] = await db
    .insert(categorization_rules)
    .values({
      id: generateId(),
      user_id: userId,
      household_id: householdId,
      name: rule.name,
      description: rule.description,
      is_active: rule.isActive,
      priority: rule.priority,
      conditions: JSON.stringify(rule.conditions),
      actions: JSON.stringify(rule.actions)
    })
    .returning();
  
  return created;
};

// Update rule priority (for reordering)
export const updateRulePriority = async (ruleId: string, newPriority: number) => {
  await db
    .update(categorization_rules)
    .set({ priority: newPriority, updated_at: new Date() })
    .where(eq(categorization_rules.id, ruleId));
};

// Get rules with statistics
export const getRulesWithStats = async (
  userId: string,
  householdId: string | null
) => {
  const rules = await db
    .select()
    .from(categorization_rules)
    .where(and(
      eq(categorization_rules.user_id, userId),
      householdId ? eq(categorization_rules.household_id, householdId) : sql`1=1`
    ))
    .orderBy(asc(categorization_rules.priority));
  
  return rules.map(rule => ({
    ...rule,
    conditions: JSON.parse(rule.conditions),
    actions: JSON.parse(rule.actions)
  }));
};

// Bulk apply rules to existing transactions
export const bulkApplyRules = async (
  userId: string,
  householdId: string | null,
  ruleId?: string // If provided, only apply this rule
) => {
  const transactions = await db
    .select()
    .from(transactions)
    .where(and(
      eq(transactions.user_id, userId),
      householdId ? eq(transactions.household_id, householdId) : sql`1=1`,
      sql`${transactions.categorized_by_rule_id} IS NULL` // Only uncategorized
    ));
  
  let categorizedCount = 0;
  
  for (const transaction of transactions) {
    const matchingRule = ruleId 
      ? await db.select().from(categorization_rules).where(eq(categorization_rules.id, ruleId)).limit(1)
      : await findMatchingRule(userId, householdId, transaction);
    
    if (matchingRule) {
      const categorized = await applyRule(matchingRule as any, transaction);
      await db
        .update(transactions)
        .set({
          category_id: categorized.category_id,
          merchant: categorized.merchant,
          notes: categorized.notes,
          categorized_by_rule_id: matchingRule.id
        })
        .where(eq(transactions.id, transaction.id));
      
      categorizedCount++;
    }
  }
  
  return { categorizedCount, totalTransactions: transactions.length };
};
```

### UI Components

```tsx
// Rule Builder Component
const RuleBuilder = ({ userId, householdId, existingRule, onSave, onCancel }) => {
  const [rule, setRule] = useState<Partial<CategorizationRule>>(
    existingRule || {
      name: '',
      description: '',
      isActive: true,
      priority: 0,
      conditions: { conditions: [], logicalOperator: 'AND' },
      actions: { categoryId: '' }
    }
  );
  const [testResults, setTestResults] = useState(null);

  const addCondition = () => {
    const newCondition: RuleCondition = {
      field: 'merchant',
      operator: 'contains',
      value: ''
    };
    setRule({
      ...rule,
      conditions: {
        ...rule.conditions,
        conditions: [...rule.conditions.conditions, newCondition]
      }
    });
  };

  const removeCondition = (index: number) => {
    const updatedConditions = [...rule.conditions.conditions];
    updatedConditions.splice(index, 1);
    setRule({
      ...rule,
      conditions: {
        ...rule.conditions,
        conditions: updatedConditions
      }
    });
  };

  const updateCondition = (index: number, field: keyof RuleCondition, value: any) => {
    const updatedConditions = [...rule.conditions.conditions];
    updatedConditions[index] = { ...updatedConditions[index], [field]: value };
    setRule({
      ...rule,
      conditions: {
        ...rule.conditions,
        conditions: updatedConditions
      }
    });
  };

  const handleTest = async () => {
    const results = await testRule(userId, householdId, rule as CategorizationRule);
    setTestResults(results);
  };

  const handleSave = async () => {
    if (existingRule) {
      await updateCategorizationRule(existingRule.id, rule);
    } else {
      await createCategorizationRule(userId, householdId, rule);
    }
    onSave();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{existingRule ? 'Edit' : 'Create'} Categorization Rule</CardTitle>
          <CardDescription>
            Automatically categorize transactions based on custom conditions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Rule Name</Label>
            <Input
              value={rule.name}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
              placeholder="e.g., Starbucks → Coffee"
            />
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <Input
              value={rule.description || ''}
              onChange={(e) => setRule({ ...rule, description: e.target.value })}
              placeholder="What does this rule do?"
            />
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Conditions</Label>
              <Select
                value={rule.conditions.logicalOperator}
                onValueChange={(v) => setRule({
                  ...rule,
                  conditions: { ...rule.conditions, logicalOperator: v as 'AND' | 'OR' }
                })}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND</SelectItem>
                  <SelectItem value="OR">OR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {rule.conditions.conditions.map((condition, index) => (
              <div key={index} className="flex items-end gap-2 mb-3">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Field</Label>
                    <Select
                      value={condition.field}
                      onValueChange={(v) => updateCondition(index, 'field', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="merchant">Merchant</SelectItem>
                        <SelectItem value="description">Description</SelectItem>
                        <SelectItem value="amount">Amount</SelectItem>
                        <SelectItem value="account_id">Account</SelectItem>
                        <SelectItem value="type">Type</SelectItem>
                        <SelectItem value="notes">Notes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Operator</Label>
                    <Select
                      value={condition.operator}
                      onValueChange={(v) => updateCondition(index, 'operator', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="starts_with">Starts With</SelectItem>
                        <SelectItem value="ends_with">Ends With</SelectItem>
                        {condition.field === 'amount' && (
                          <>
                            <SelectItem value="greater_than">Greater Than</SelectItem>
                            <SelectItem value="less_than">Less Than</SelectItem>
                            <SelectItem value="between">Between</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Value</Label>
                    <Input
                      value={condition.value}
                      onChange={(e) => updateCondition(index, 'value', e.target.value)}
                      placeholder="Enter value"
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCondition(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addCondition}>
              <Plus className="h-4 w-4 mr-2" />
              Add Condition
            </Button>
          </div>

          <Separator />

          <div>
            <Label className="mb-3 block">Actions</Label>
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Category</Label>
                <CategorySelector
                  value={rule.actions.categoryId}
                  onChange={(id) => setRule({
                    ...rule,
                    actions: { ...rule.actions, categoryId: id }
                  })}
                />
              </div>

              <div>
                <Label className="text-xs">Override Merchant Name (Optional)</Label>
                <Input
                  value={rule.actions.merchantName || ''}
                  onChange={(e) => setRule({
                    ...rule,
                    actions: { ...rule.actions, merchantName: e.target.value }
                  })}
                  placeholder="e.g., Starbucks"
                />
              </div>

              <div>
                <Label className="text-xs">Auto-add Notes (Optional)</Label>
                <Input
                  value={rule.actions.notes || ''}
                  onChange={(e) => setRule({
                    ...rule,
                    actions: { ...rule.actions, notes: e.target.value }
                  })}
                  placeholder="e.g., Business expense"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                Matched <span className="font-bold">{testResults.matchCount}</span> of{' '}
                {testResults.totalTested} recent transactions
              </p>
              {testResults.matches.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs text-muted-foreground">Sample matches:</p>
                  {testResults.matches.map((match) => (
                    <div key={match.id} className="p-2 bg-muted rounded text-sm">
                      {match.description} • ${match.amount}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={handleTest}>
          Test Rule
        </Button>
        <Button onClick={handleSave} disabled={!rule.name || !rule.actions.categoryId}>
          Save Rule
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

// Rules List with Drag-and-Drop Reordering
const RulesManager = ({ userId, householdId }) => {
  const [rules, setRules] = useState([]);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const data = await getRulesWithStats(userId, householdId);
    setRules(data);
  };

  const handleToggleActive = async (ruleId: string, isActive: boolean) => {
    await db
      .update(categorization_rules)
      .set({ is_active: !isActive })
      .where(eq(categorization_rules.id, ruleId));
    loadRules();
  };

  const handleDelete = async (ruleId: string) => {
    if (confirm('Delete this rule?')) {
      await db
        .delete(categorization_rules)
        .where(eq(categorization_rules.id, ruleId));
      loadRules();
    }
  };

  const handleApplyToExisting = async (ruleId: string) => {
    const result = await bulkApplyRules(userId, householdId, ruleId);
    toast.success(`Categorized ${result.categorizedCount} transactions`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Categorization Rules</h2>
        <Button onClick={() => setEditingRule({})}>
          <Plus className="h-4 w-4 mr-2" />
          New Rule
        </Button>
      </div>

      {editingRule ? (
        <RuleBuilder
          userId={userId}
          householdId={householdId}
          existingRule={editingRule.id ? editingRule : null}
          onSave={() => {
            setEditingRule(null);
            loadRules();
          }}
          onCancel={() => setEditingRule(null)}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            {rules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No rules yet. Create your first rule to automate categorization!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      <Badge variant="outline">{index + 1}</Badge>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{rule.name}</p>
                        {!rule.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Matched {rule.match_count} times
                        {rule.last_matched_at && ` • Last used ${formatDistanceToNow(new Date(rule.last_matched_at), { addSuffix: true })}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => handleToggleActive(rule.id, rule.is_active)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => setEditingRule(rule)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleApplyToExisting(rule.id)}>
                            Apply to Existing Transactions
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(rule.id)}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
```

---

## 📈 Usage-Based Sorting & Smart Item Ordering

### Overview
The application tracks how frequently users interact with accounts, categories, merchants, bills, and transfer pairs. Items used most often automatically appear at the top of selection lists, making transaction entry faster over time.

### Core Usage Tracking Functions

```typescript
// Centralized usage tracking service
interface UsageTrackingService {
  trackAccountUsage(userId: string, accountId: string): Promise<void>;
  trackCategoryUsage(userId: string, categoryId: string): Promise<void>;
  trackMerchantUsage(userId: string, merchantName: string, categoryId?: string): Promise<void>;
  trackTransferPairUsage(userId: string, fromAccountId: string, toAccountId: string): Promise<void>;
  trackBillUsage(userId: string, billId: string): Promise<void>;
}

// Account usage tracking
export const trackAccountUsage = async (userId: string, accountId: string) => {
  await db.transaction(async (tx) => {
    // Update account-specific usage count
    await tx
      .update(accounts)
      .set({
        usage_count: sql`${accounts.usage_count} + 1`,
        last_used_at: new Date(),
        updated_at: new Date()
      })
      .where(and(
        eq(accounts.id, accountId),
        eq(accounts.user_id, userId)
      ));

    // Also track in general analytics table for cross-reference
    await tx
      .insert(usage_analytics)
      .values({
        user_id: userId,
        item_type: 'account',
        item_id: accountId,
        usage_count: 1,
        last_used_at: new Date()
      })
      .onConflictDoUpdate({
        target: [usage_analytics.user_id, usage_analytics.item_type, usage_analytics.item_id],
        set: {
          usage_count: sql`${usage_analytics.usage_count} + 1`,
          last_used_at: new Date()
        }
      });
  });
};

// Category usage tracking
export const trackCategoryUsage = async (userId: string, categoryId: string) => {
  await db.transaction(async (tx) => {
    await tx
      .update(budget_categories)
      .set({
        usage_count: sql`${budget_categories.usage_count} + 1`,
        last_used_at: new Date()
      })
      .where(and(
        eq(budget_categories.id, categoryId),
        eq(budget_categories.user_id, userId)
      ));

    await tx
      .insert(usage_analytics)
      .values({
        user_id: userId,
        item_type: 'category',
        item_id: categoryId,
        usage_count: 1,
        last_used_at: new Date()
      })
      .onConflictDoUpdate({
        target: [usage_analytics.user_id, usage_analytics.item_type, usage_analytics.item_id],
        set: {
          usage_count: sql`${usage_analytics.usage_count} + 1`,
          last_used_at: new Date()
        }
      });
  });
};

// Merchant usage tracking with auto-creation
export const trackMerchantUsage = async (
  userId: string, 
  merchantName: string, 
  categoryId?: string,
  transactionAmount?: number
) => {
  const normalizedName = merchantName.toLowerCase().replace(/\s+/g, '');
  
  await db.transaction(async (tx) => {
    // Check if merchant exists
    const existingMerchant = await tx
      .select()
      .from(merchants)
      .where(and(
        eq(merchants.user_id, userId),
        eq(merchants.normalized_name, normalizedName)
      ))
      .limit(1);

    if (existingMerchant.length > 0) {
      // Update existing merchant
      const merchant = existingMerchant[0];
      const newUsageCount = merchant.usage_count + 1;
      const newTotalSpent = merchant.total_spent + (transactionAmount || 0);
      const newAverageTransaction = newTotalSpent / newUsageCount;

      await tx
        .update(merchants)
        .set({
          usage_count: newUsageCount,
          last_used_at: new Date(),
          total_spent: newTotalSpent,
          average_transaction: newAverageTransaction,
          category_id: categoryId || merchant.category_id, // Update category if provided
          updated_at: new Date()
        })
        .where(eq(merchants.id, merchant.id));
    } else {
      // Create new merchant
      await tx
        .insert(merchants)
        .values({
          user_id: userId,
          name: merchantName,
          normalized_name: normalizedName,
          category_id: categoryId,
          usage_count: 1,
          last_used_at: new Date(),
          total_spent: transactionAmount || 0,
          average_transaction: transactionAmount || 0
        });
    }
  });
};

// Transfer pair usage tracking
export const trackTransferPairUsage = async (
  userId: string,
  fromAccountId: string,
  toAccountId: string
) => {
  await db
    .insert(usage_analytics)
    .values({
      user_id: userId,
      item_type: 'transfer_pair',
      item_id: fromAccountId,
      item_secondary_id: toAccountId,
      usage_count: 1,
      last_used_at: new Date()
    })
    .onConflictDoUpdate({
      target: [
        usage_analytics.user_id,
        usage_analytics.item_type,
        usage_analytics.item_id,
        usage_analytics.item_secondary_id
      ],
      set: {
        usage_count: sql`${usage_analytics.usage_count} + 1`,
        last_used_at: new Date()
      }
    });
};

// Bill usage tracking
export const trackBillUsage = async (userId: string, billId: string) => {
  await db
    .insert(usage_analytics)
    .values({
      user_id: userId,
      item_type: 'bill',
      item_id: billId,
      usage_count: 1,
      last_used_at: new Date()
    })
    .onConflictDoUpdate({
      target: [usage_analytics.user_id, usage_analytics.item_type, usage_analytics.item_id],
      set: {
        usage_count: sql`${usage_analytics.usage_count} + 1`,
        last_used_at: new Date()
      }
    });
};
```

### Smart Query Functions with Usage-Based Sorting

```typescript
// Get accounts sorted by usage frequency
export const getAccountsByUsage = async (userId: string, limit?: number) => {
  const query = db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      bank_name: accounts.bank_name,
      current_balance: accounts.current_balance,
      available_balance: accounts.available_balance,
      credit_limit: accounts.credit_limit,
      color: accounts.color,
      icon: accounts.icon,
      usage_count: accounts.usage_count,
      last_used_at: accounts.last_used_at,
      is_active: accounts.is_active
    })
    .from(accounts)
    .where(and(
      eq(accounts.user_id, userId),
      eq(accounts.is_active, true)
    ))
    .orderBy(
      desc(accounts.usage_count),
      desc(accounts.last_used_at),
      asc(accounts.sort_order),
      asc(accounts.name)
    );

  if (limit) {
    return await query.limit(limit);
  }

  return await query;
};

// Get categories sorted by usage and type
export const getCategoriesByUsage = async (
  userId: string, 
  type?: string,
  limit?: number
) => {
  const conditions = [
    eq(budget_categories.user_id, userId),
    eq(budget_categories.is_active, true)
  ];

  if (type) {
    conditions.push(eq(budget_categories.type, type));
  }

  const query = db
    .select()
    .from(budget_categories)
    .where(and(...conditions))
    .orderBy(
      desc(budget_categories.usage_count),
      desc(budget_categories.last_used_at),
      asc(budget_categories.sort_order),
      asc(budget_categories.name)
    );

  if (limit) {
    return await query.limit(limit);
  }

  return await query;
};

// Get merchants with autocomplete and usage-based sorting
export const getMerchantSuggestions = async (
  userId: string,
  searchQuery?: string,
  limit: number = 10
) => {
  let query = db
    .select({
      id: merchants.id,
      name: merchants.name,
      category_id: merchants.category_id,
      category_name: budget_categories.name,
      usage_count: merchants.usage_count,
      last_used_at: merchants.last_used_at,
      average_transaction: merchants.average_transaction,
      total_spent: merchants.total_spent
    })
    .from(merchants)
    .leftJoin(budget_categories, eq(merchants.category_id, budget_categories.id))
    .where(eq(merchants.user_id, userId));

  if (searchQuery && searchQuery.length > 0) {
    const searchTerm = `%${searchQuery.toLowerCase()}%`;
    query = query.where(
      or(
        sql`LOWER(${merchants.name}) LIKE ${searchTerm}`,
        sql`LOWER(${merchants.normalized_name}) LIKE ${searchTerm}`
      )
    );
  }

  return await query
    .orderBy(
      desc(merchants.usage_count),
      desc(merchants.last_used_at),
      asc(merchants.name)
    )
    .limit(limit);
};

// Get most common transfer pairs
export const getCommonTransferPairs = async (userId: string, limit: number = 5) => {
  const transferPairs = await db
    .select({
      from_account_id: usage_analytics.item_id,
      to_account_id: usage_analytics.item_secondary_id,
      usage_count: usage_analytics.usage_count,
      last_used_at: usage_analytics.last_used_at
    })
    .from(usage_analytics)
    .where(and(
      eq(usage_analytics.user_id, userId),
      eq(usage_analytics.item_type, 'transfer_pair')
    ))
    .orderBy(
      desc(usage_analytics.usage_count),
      desc(usage_analytics.last_used_at)
    )
    .limit(limit);

  // Enrich with account details
  const enrichedPairs = await Promise.all(
    transferPairs.map(async (pair) => {
      const [fromAccount, toAccount] = await Promise.all([
        db.select().from(accounts).where(eq(accounts.id, pair.from_account_id)).limit(1),
        db.select().from(accounts).where(eq(accounts.id, pair.to_account_id)).limit(1)
      ]);

      return {
        ...pair,
        from_account: fromAccount[0],
        to_account: toAccount[0]
      };
    })
  );

  return enrichedPairs;
};

// Get contextual suggestions based on time, amount, and usage
export const getContextualSuggestions = async (
  userId: string,
  context: {
    amount?: number;
    timeOfDay?: number; // 0-23
    dayOfWeek?: number; // 0-6
  }
) => {
  // Get recent and frequently used combinations
  const recentTransactions = await db
    .select({
      description: transactions.description,
      amount: transactions.amount,
      category_id: transactions.category_id,
      category_name: budget_categories.name,
      account_id: transactions.account_id,
      account_name: accounts.name,
      date: transactions.date
    })
    .from(transactions)
    .leftJoin(budget_categories, eq(transactions.category_id, budget_categories.id))
    .leftJoin(accounts, eq(transactions.account_id, accounts.id))
    .where(eq(transactions.user_id, userId))
    .orderBy(desc(transactions.date))
    .limit(100);

  // Filter and score based on context
  const scoredSuggestions = recentTransactions.map(tx => {
    let score = 0;
    
    // Amount similarity (within 20%)
    if (context.amount && tx.amount) {
      const amountDiff = Math.abs(context.amount - Math.abs(tx.amount));
      const amountPercent = (amountDiff / Math.abs(tx.amount)) * 100;
      if (amountPercent <= 20) {
        score += 50;
      } else if (amountPercent <= 50) {
        score += 20;
      }
    }

    // Time of day similarity (for contextual suggestions)
    if (context.timeOfDay !== undefined) {
      const txDate = new Date(tx.date);
      const txHour = txDate.getHours();
      const hourDiff = Math.abs(context.timeOfDay - txHour);
      if (hourDiff <= 2) {
        score += 30;
      } else if (hourDiff <= 4) {
        score += 10;
      }
    }

    // Recency bonus
    const daysSince = Math.floor(
      (Date.now() - new Date(tx.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince <= 7) {
      score += 20;
    } else if (daysSince <= 30) {
      score += 10;
    }

    return { ...tx, score };
  });

  // Sort by score and return top suggestions
  return scoredSuggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
};
```

### Automatic Usage Tracking in Transaction Creation

```typescript
// Enhanced transaction creation with automatic usage tracking
export const createTransaction = async (userId: string, transactionData: TransactionInput) => {
  return await db.transaction(async (tx) => {
    // Create the transaction
    const transaction = await tx
      .insert(transactions)
      .values({
        user_id: userId,
        ...transactionData,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning();

    // Track all usage automatically
    await Promise.all([
      // Track account usage
      trackAccountUsage(userId, transactionData.account_id),
      
      // Track category usage (if provided)
      transactionData.category_id 
        ? trackCategoryUsage(userId, transactionData.category_id)
        : Promise.resolve(),
      
      // Track merchant usage (if description looks like a merchant)
      transactionData.description
        ? trackMerchantUsage(
            userId,
            transactionData.description,
            transactionData.category_id,
            Math.abs(transactionData.amount)
          )
        : Promise.resolve()
    ]);

    // Update account balance
    await updateAccountBalance(tx, transactionData.account_id);

    return transaction[0];
  });
};

// Enhanced transfer creation with pair tracking
export const createTransferWithUsageTracking = async (
  userId: string,
  transferData: TransferRequest
) => {
  const result = await createLinkedTransfer(transferData);
  
  // Track the transfer pair usage
  await trackTransferPairUsage(userId, transferData.fromAccountId, transferData.toAccountId);
  
  // Track individual account usage
  await Promise.all([
    trackAccountUsage(userId, transferData.fromAccountId),
    trackAccountUsage(userId, transferData.toAccountId)
  ]);

  return result;
};
```

### UI Components with Usage-Based Sorting

```tsx
// Smart Account Selector Component
const SmartAccountSelector = ({ userId, onSelect, selectedAccountId }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAccounts = async () => {
      const sortedAccounts = await getAccountsByUsage(userId);
      setAccounts(sortedAccounts);
      setLoading(false);
    };
    loadAccounts();
  }, [userId]);

  return (
    <div className="account-selector">
      <h3 className="text-sm font-medium mb-2">Select Account</h3>
      <div className="grid grid-cols-2 gap-2">
        {accounts.map((account, index) => (
          <Button
            key={account.id}
            variant={selectedAccountId === account.id ? 'default' : 'outline'}
            onClick={() => onSelect(account)}
            className="relative h-auto p-3 text-left"
          >
            {/* Usage indicator badge for top 3 */}
            {index < 3 && (
              <Badge 
                variant="secondary" 
                className="absolute -top-1 -right-1 text-xs px-1"
              >
                {index === 0 ? '⭐' : index === 1 ? '🥈' : '🥉'}
              </Badge>
            )}
            
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: account.color }}
              />
              <div>
                <div className="font-medium text-sm">{account.name}</div>
                <div className="text-xs text-muted-foreground">
                  ${account.current_balance.toLocaleString()}
                </div>
              </div>
            </div>
            
            {/* Show usage count for frequent accounts */}
            {account.usage_count > 10 && (
              <div className="text-xs text-muted-foreground mt-1">
                Used {account.usage_count} times
              </div>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
};

// Smart Category Selector with Usage Ordering
const SmartCategorySelector = ({ userId, type, onSelect, selectedCategoryId }) => {
  const [categories, setCategories] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      const sorted = await getCategoriesByUsage(userId, type);
      setCategories(sorted);
    };
    loadCategories();
  }, [userId, type]);

  const displayedCategories = showAll ? categories : categories.slice(0, 8);
  const frequentCategories = categories.slice(0, 3);

  return (
    <div className="category-selector">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Category</h3>
        {categories.length > 8 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : 'Show All'}
          </Button>
        )}
      </div>

      {/* Frequent categories as pills */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
        {frequentCategories.map((category) => (
          <Badge
            key={category.id}
            variant={selectedCategoryId === category.id ? 'default' : 'outline'}
            className="cursor-pointer px-3 py-1 whitespace-nowrap"
            onClick={() => onSelect(category)}
          >
            {category.name}
          </Badge>
        ))}
      </div>

      {/* All categories grid */}
      <div className="grid grid-cols-2 gap-2">
        {displayedCategories.map((category, index) => (
          <Button
            key={category.id}
            variant={selectedCategoryId === category.id ? 'default' : 'outline'}
            onClick={() => onSelect(category)}
            className="justify-start h-auto py-2"
          >
            <div className="flex items-center gap-2 w-full">
              <span className="text-sm">{category.name}</span>
              {index < 3 && (
                <span className="ml-auto text-xs">⭐</span>
              )}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};

// Smart Merchant Autocomplete
const SmartMerchantInput = ({ userId, value, onChange, onSelect }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSuggestions = async () => {
      if (value.length >= 2) {
        setLoading(true);
        const merchants = await getMerchantSuggestions(userId, value, 10);
        setSuggestions(merchants);
        setShowSuggestions(true);
        setLoading(false);
      } else if (value.length === 0) {
        // Show most frequent merchants when empty
        const merchants = await getMerchantSuggestions(userId, '', 5);
        setSuggestions(merchants);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const debounce = setTimeout(loadSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [value, userId]);

  return (
    <div className="relative">
      <Input
        type="text"
        placeholder="Merchant or description"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        className="w-full"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((merchant) => (
            <div
              key={merchant.id}
              className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
              onClick={() => {
                onSelect(merchant);
                setShowSuggestions(false);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{merchant.name}</div>
                  {merchant.category_name && (
                    <div className="text-xs text-muted-foreground">
                      {merchant.category_name} • ${merchant.average_transaction.toFixed(2)} avg
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {merchant.usage_count > 5 && `${merchant.usage_count}×`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Quick Transfer Shortcuts Component
const QuickTransferShortcuts = ({ userId, onTransferSelect }) => {
  const [commonPairs, setCommonPairs] = useState([]);

  useEffect(() => {
    const loadCommonPairs = async () => {
      const pairs = await getCommonTransferPairs(userId, 5);
      setCommonPairs(pairs);
    };
    loadCommonPairs();
  }, [userId]);

  if (commonPairs.length === 0) return null;

  return (
    <div className="quick-transfers mb-4">
      <h3 className="text-sm font-medium mb-2">Quick Transfers</h3>
      <div className="space-y-2">
        {commonPairs.map((pair, index) => (
          <Button
            key={`${pair.from_account_id}-${pair.to_account_id}`}
            variant="outline"
            onClick={() => onTransferSelect(pair)}
            className="w-full justify-between h-auto py-2"
          >
            <div className="flex items-center gap-2">
              {index === 0 && <span className="text-xs">⭐</span>}
              <span className="text-sm">
                {pair.from_account?.name} → {pair.to_account?.name}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {pair.usage_count} times
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
};
```

### Performance Optimization: Usage Data Cleanup

```typescript
// Periodic cleanup of stale usage data (run as cron job)
export const cleanupStaleUsageData = async () => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Archive or decay old usage analytics
  await db
    .delete(usage_analytics)
    .where(
      and(
        lt(usage_analytics.last_used_at, sixMonthsAgo),
        lt(usage_analytics.usage_count, 3) // Only delete items used less than 3 times
      )
    );

  // Reset usage counts for merchants not used in 6 months (decay, not delete)
  await db
    .update(merchants)
    .set({
      usage_count: sql`CAST(${merchants.usage_count} * 0.5 AS INTEGER)`, // Decay by 50%
      updated_at: new Date()
    })
    .where(lt(merchants.last_used_at, sixMonthsAgo));
};

// Weekly usage decay to keep data fresh (prevents old habits from dominating forever)
export const applyWeeklyUsageDecay = async () => {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  // Gradually decay usage counts for items not used recently
  // This ensures recent patterns are weighted more heavily
  await Promise.all([
    // Decay account usage
    db.update(accounts)
      .set({
        usage_count: sql`GREATEST(CAST(${accounts.usage_count} * 0.95 AS INTEGER), 1)`,
        updated_at: new Date()
      })
      .where(lt(accounts.last_used_at, oneMonthAgo)),

    // Decay category usage
    db.update(budget_categories)
      .set({
        usage_count: sql`GREATEST(CAST(${budget_categories.usage_count} * 0.95 AS INTEGER), 1)`
      })
      .where(lt(budget_categories.last_used_at, oneMonthAgo)),

    // Decay merchant usage
    db.update(merchants)
      .set({
        usage_count: sql`GREATEST(CAST(${merchants.usage_count} * 0.95 AS INTEGER), 1)`,
        updated_at: new Date()
      })
      .where(lt(merchants.last_used_at, oneMonthAgo))
  ]);
};
```

---

## 🔌 API Endpoints

### Account Management
- `GET /api/accounts` - List all accounts for user (sorted by usage)
- `GET /api/accounts/by-usage` - Get accounts explicitly sorted by usage frequency
- `POST /api/accounts` - Create new account
- `PUT /api/accounts/[id]` - Update account details
- `DELETE /api/accounts/[id]` - Archive account
- `GET /api/accounts/[id]/balance` - Get real-time balance
- `GET /api/accounts/[id]/transactions` - Get account transaction history

### Transaction Management
- `GET /api/transactions` - List transactions with filtering
- `POST /api/transactions` - Create new transaction
- `PUT /api/transactions/[id]` - Update transaction
- `DELETE /api/transactions/[id]` - Delete transaction
- `POST /api/transactions/recurring` - Set up recurring transaction

### Transfer System
- `POST /api/transfers` - Create linked transfer
- `GET /api/transfers` - List all transfers
- `PUT /api/transfers/[id]` - Update transfer
- `DELETE /api/transfers/[id]` - Delete transfer (and linked transactions)

### Budget Management
- `GET /api/budget/categories` - List budget categories by type (sorted by usage)
- `GET /api/budget/categories/by-usage` - Get categories sorted by usage frequency
- `POST /api/budget/categories` - Create budget category
- `PUT /api/budget/categories/[id]` - Update category
- `GET /api/budget/analysis/[year]/[month]` - Get budget analysis

### Savings & Debt
- `GET /api/savings-goals` - List savings goals with progress
- `POST /api/savings-goals` - Create new savings goal
- `PUT /api/savings-goals/[id]` - Update goal progress
- `GET /api/debts` - List debts with payoff calculations
- `POST /api/debts` - Add new debt
- `PUT /api/debts/[id]` - Update debt details

### Debt Payoff Strategy Management
- `GET /api/debt/strategy` - Get user's current debt payoff strategy settings
- `PUT /api/debt/strategy` - Update debt payoff strategy (snowball/avalanche)
- `GET /api/debt/strategy/snowball` - Calculate snowball method payoff plan
- `GET /api/debt/strategy/avalanche` - Calculate avalanche method payoff plan
- `GET /api/debt/strategy/compare` - Compare both strategies side by side
- `POST /api/debt/strategy/allocate` - Auto-allocate extra payments based on strategy
- `GET /api/debt/strategy/progress` - Track progress toward debt-free goal
- **`POST /api/debt/initialize`** - Initialize debt payoff journey with start date and starting debt total
- **`GET /api/debt/progress`** - Get comprehensive debt payoff progress since start date
- **`POST /api/debt/milestone/check`** - Check and record milestone achievements (called after debt payments)
- **`GET /api/debt/stats`** - Get formatted debt payoff statistics with momentum and projections

### Dashboard Data
- `GET /api/dashboard` - Get complete dashboard data
- `GET /api/reports/spending-trends` - Monthly spending trends
- `GET /api/reports/net-worth` - Net worth calculation over time
- `GET /api/health` - Health check endpoint for Coolify monitoring

### Speed Optimization APIs
- `GET /api/suggestions/quick-entry` - Get contextual transaction suggestions
- `POST /api/transactions/voice` - Process voice-to-text transaction entry
- `GET /api/templates/frequent` - Get user's most frequent transaction templates
- `POST /api/transactions/duplicate/[id]` - Instantly duplicate a transaction
- `POST /api/import/bank-statement` - Process and auto-categorize bank imports
- `GET /api/autocomplete/merchants` - Real-time merchant name autocomplete
- `POST /api/transactions/bulk` - Save multiple transactions at once

### Usage Tracking & Smart Sorting APIs
- `GET /api/usage/accounts` - Get accounts sorted by usage frequency
- `GET /api/usage/categories` - Get categories sorted by usage frequency  
- `GET /api/usage/merchants` - Get merchant suggestions with usage-based sorting
- `GET /api/usage/merchants/search?q={query}` - Search merchants with autocomplete
- `GET /api/usage/transfer-pairs` - Get most common transfer pairs
- `GET /api/usage/contextual-suggestions` - Get smart suggestions based on context (time, amount)
- `POST /api/usage/track` - Manual usage tracking (if needed for special cases)
- `GET /api/usage/analytics` - Get usage analytics for user's patterns
- `POST /api/usage/cleanup` - Trigger usage data cleanup (admin/cron)

### Custom Categorization Rules APIs
- `GET /api/rules` - Get all categorization rules for user (sorted by priority)
- `GET /api/rules/[id]` - Get specific rule details
- `POST /api/rules` - Create new categorization rule
- `PUT /api/rules/[id]` - Update existing rule
- `DELETE /api/rules/[id]` - Delete rule
- `POST /api/rules/[id]/toggle` - Toggle rule active/inactive status
- `PUT /api/rules/reorder` - Update rule priorities (for drag-and-drop reordering)
- `POST /api/rules/[id]/test` - Test rule against recent transactions (preview matches)
- `POST /api/rules/[id]/apply` - Apply specific rule to existing uncategorized transactions
- `POST /api/rules/apply-all` - Bulk apply all active rules to uncategorized transactions
- `GET /api/rules/[id]/stats` - Get rule statistics (match count, last used, etc.)
- `GET /api/rules/[id]/execution-log` - Get execution history for rule
- `POST /api/transactions/auto-categorize` - Manually trigger auto-categorization for transaction

### User Settings & Profile Management APIs
- `GET /api/user/settings` - Get user settings and preferences
- `PUT /api/user/profile` - Update user profile (name, avatar, bio)
- `PUT /api/user/preferences` - Update display preferences (timezone, currency, date format)
- `PUT /api/user/privacy` - Update privacy settings
- `PUT /api/user/accessibility` - Update accessibility settings
- `POST /api/user/avatar` - Upload profile picture
- `GET /api/user/sessions` - Get all active sessions
- `DELETE /api/user/sessions/[id]` - Revoke specific session (logout device)
- `DELETE /api/user/sessions/others` - Revoke all other sessions
- `POST /api/user/export` - Request data export (GDPR)
- `GET /api/user/export/[id]` - Download data export file
- `GET /api/user/export/history` - List all export requests
- `POST /api/user/delete` - Request account deletion (30-day grace period)
- `POST /api/user/delete/cancel` - Cancel pending account deletion
- `GET /api/user/delete/status` - Check account deletion status

### Household/Multi-User Management APIs
- `POST /api/household` - Create new household
- `GET /api/household` - Get user's households
- `GET /api/household/[id]` - Get household details
- `PUT /api/household/[id]` - Update household settings
- `DELETE /api/household/[id]` - Delete household (owner only)
- `POST /api/household/[id]/switch` - Switch active household for user
- `GET /api/household/[id]/members` - List household members
- `POST /api/household/[id]/invite` - Invite member to household
- `POST /api/household/invite/accept` - Accept household invitation
- `POST /api/household/invite/decline` - Decline household invitation
- `DELETE /api/household/[id]/members/[userId]` - Remove member from household
- `PUT /api/household/[id]/members/[userId]/role` - Update member role
- `GET /api/household/[id]/activity` - Get household activity feed
- `GET /api/household/[id]/permissions` - Get current user's permissions in household
- `POST /api/household/[id]/leave` - Leave household (non-owners)

### Notifications & Reminders APIs
- `GET /api/notifications` - Get user notifications with filters
- `GET /api/notifications/unread-count` - Get count of unread notifications
- `POST /api/notifications/[id]/read` - Mark notification as read
- `POST /api/notifications/read-all` - Mark all notifications as read
- `POST /api/notifications/[id]/dismiss` - Dismiss notification
- `GET /api/notifications/preferences` - Get user notification preferences
- `PUT /api/notifications/preferences` - Update notification preferences
- `POST /api/notifications/push/subscribe` - Subscribe to push notifications
- `POST /api/notifications/push/unsubscribe` - Unsubscribe from push notifications
- `POST /api/notifications/test` - Send test notification (for setup)

### Charts & Reports APIs
- `GET /api/reports/spending-by-category` - Get spending breakdown by category (month/year params)
- `GET /api/reports/income-vs-expenses` - Get income vs expenses over time (months param)
- `GET /api/reports/budget-progress` - Get budget progress for all categories (month/year params)
- `GET /api/reports/net-worth-history` - Get net worth over time (months param)
- `GET /api/reports/category-comparison` - Compare current vs previous month
- `GET /api/reports/monthly-trends` - Get spending trends by category (categoryId, months params)
- `GET /api/reports/dashboard-summary` - Get summary cards data (month/year params)
- `GET /api/reports/savings-goals` - Get all savings goals with current progress
- `GET /api/reports/debt-projection` - Get debt payoff projection (strategy param)
- `GET /api/reports/export` - Export report data as CSV/PDF (format, type, dateRange params)

### Split Transactions APIs
- `POST /api/transactions/split` - Create a new split transaction
- `GET /api/transactions/[id]/splits` - Get transaction with all split details
- `PUT /api/transactions/[id]/splits` - Update split transaction and splits
- `POST /api/transactions/[id]/convert-to-split` - Convert regular transaction to split
- `POST /api/transactions/[id]/convert-to-regular` - Convert split back to regular transaction
- `GET /api/transactions/splits/by-category/[categoryId]` - Get all split items for a category (for budget calculations)
- `DELETE /api/transactions/[id]/splits/[splitId]` - Remove a single split item (requires recalculating remaining)

### Calendar View APIs
- `GET /api/calendar/data` - Get all calendar data (transactions, bills, recurring) for date range
- `GET /api/calendar/month/[year]/[month]` - Get calendar data for specific month
- `GET /api/calendar/week/[date]` - Get calendar data for week containing date
- `GET /api/calendar/day/[date]` - Get detailed data for specific day
- `GET /api/calendar/heatmap/[year]` - Get spending heatmap data for year
- `POST /api/calendar/quick-add` - Quick add transaction with pre-filled date
- `GET /api/calendar/recurring-projections` - Get projected recurring transactions

### Tags & Custom Fields APIs
- `GET /api/tags` - Get all tags for user/household (with orderBy param: name/usage/recent)
- `POST /api/tags` - Create new tag
- `PUT /api/tags/[id]` - Update tag
- `DELETE /api/tags/[id]` - Delete tag
- `POST /api/transactions/[id]/tags` - Add tags to transaction
- `DELETE /api/transactions/[id]/tags/[tagId]` - Remove tag from transaction
- `GET /api/transactions/[id]/tags` - Get all tags for transaction
- `GET /api/tags/search` - Search transactions by tags (with matchAll param)
- `GET /api/tags/statistics` - Get tag usage statistics (with date range)
- `GET /api/custom-fields` - Get custom field definitions (appliesTo param)
- `POST /api/custom-fields` - Create custom field definition
- `PUT /api/custom-fields/[id]` - Update custom field
- `DELETE /api/custom-fields/[id]` - Delete custom field
- `GET /api/custom-fields/[entityType]/[entityId]` - Get custom field values for entity
- `POST /api/custom-fields/values` - Set custom field value
- `GET /api/custom-fields/search` - Search by custom field value

### Tax Category Mapping APIs
- `GET /api/tax-categories` - Get all tax categories (system + custom)
- `POST /api/tax-categories` - Create custom tax category
- `PUT /api/tax-categories/[id]` - Update tax category
- `DELETE /api/tax-categories/[id]` - Delete/deactivate tax category
- `GET /api/tax-categories/[id]/mappings` - Get category mappings for tax category
- `POST /api/category-tax-mappings` - Map budget category to tax category
- `DELETE /api/category-tax-mappings/[id]` - Remove tax mapping
- `GET /api/budget-categories/[id]/tax-mappings` - Get tax mappings for budget category
- `GET /api/tax/calculate/[year]` - Calculate tax deductions for year
- `GET /api/tax/report/[year]` - Generate tax report (format param: summary/detailed/by_form)
- `GET /api/tax/summary/[year]` - Get tax summary dashboard data
- `GET /api/tax/export/[year]` - Export tax data as CSV
- `GET /api/tax/year-settings/[year]` - Get tax year settings
- `PUT /api/tax/year-settings/[year]` - Update tax year settings

### Sales Tax Tracking APIs
- `PUT /api/transactions/[id]/sales-tax` - Mark transaction as taxable/non-taxable and set tax rate
- `GET /api/sales-tax/calculate` - Calculate taxable income for date range (params: startDate, endDate)
- `GET /api/sales-tax/report/[year]/[quarter]` - Generate quarterly sales tax report
- `POST /api/sales-tax/periods` - Create/update sales tax period
- `PUT /api/sales-tax/periods/[id]/filed` - Mark period as filed
- `GET /api/sales-tax/periods` - Get all sales tax periods
- `GET /api/sales-tax/dashboard` - Get sales tax dashboard (current quarter, last quarter, YTD)
- `GET /api/sales-tax/export/[year]/[quarter]` - Export sales tax data as CSV
- `GET /api/sales-tax/settings` - Get user sales tax settings
- `PUT /api/sales-tax/settings` - Update sales tax settings (default rate, jurisdiction, etc.)
- `POST /api/sales-tax/exemptions` - Add tax exemption certificate
- `GET /api/sales-tax/exemptions` - List all tax exemption certificates
- `PUT /api/sales-tax/exemptions/[id]` - Update exemption certificate
- `DELETE /api/sales-tax/exemptions/[id]` - Delete exemption certificate

### Advanced Search & Filtering APIs
- `POST /api/search/transactions` - Search transactions with filter criteria (body contains filter JSON)
- `GET /api/search/presets` - Get user's saved search presets
- `POST /api/search/presets` - Create new search preset
- `PUT /api/search/presets/[id]` - Update search preset
- `DELETE /api/search/presets/[id]` - Delete search preset
- `PUT /api/search/presets/[id]/favorite` - Toggle favorite status
- `POST /api/search/presets/[id]/execute` - Execute saved search preset
- `GET /api/search/history` - Get recent search history
- `GET /api/search/quick/[filterType]` - Execute quick filter (unreconciled, largeExpenses, etc.)
- `POST /api/search/export` - Export search results to CSV

### Audit Log & Version History APIs
- `GET /api/transactions/[id]/versions` - Get all versions of a transaction
- `POST /api/transactions/[id]/versions/[versionNumber]/revert` - Revert transaction to specific version
- `GET /api/transactions/[id]/audit` - Get audit log for a transaction
- `GET /api/audit/entity/[entityType]/[entityId]` - Get audit log for any entity
- `GET /api/audit/user/recent` - Get user's recent activity
- `GET /api/audit/household/[householdId]` - Get household activity feed
- `POST /api/transactions/[id]/restore` - Restore soft-deleted transaction
- `GET /api/versions/compare` - Compare two versions (params: version1Id, version2Id)
- `DELETE /api/transactions/[id]` - Soft delete transaction with audit trail
- `PUT /api/transactions/[id]` - Update transaction with automatic versioning and audit

### CSV Import APIs
- `POST /api/import/parse` - Parse CSV file and return headers/sample rows
- `POST /api/import/stage` - Stage import with mappings for review
- `GET /api/import/[id]/staging` - Get staged transactions with duplicate detection results
- `POST /api/import/[id]/approve` - Approve specific staging record
- `POST /api/import/[id]/skip` - Skip specific staging record
- `POST /api/import/[id]/commit` - Commit import (create actual transactions)
- `POST /api/import/[id]/rollback` - Rollback import (delete imported transactions)
- `GET /api/import/history` - Get import history
- `POST /api/import/templates` - Save import template
- `GET /api/import/templates` - Get user's import templates
- `PUT /api/import/templates/[id]` - Update import template
- `DELETE /api/import/templates/[id]` - Delete import template
- `PUT /api/import/templates/[id]/favorite` - Toggle template favorite status
- `POST /api/import/detect-duplicates` - Detect duplicates for a transaction

### Bill Tracking & Management
- `GET /api/bills` - List all user bills with current status
- `POST /api/bills` - Create new bill
- `PUT /api/bills/[id]` - Update bill details
- `DELETE /api/bills/[id]` - Delete/deactivate bill
- `GET /api/bills/instances/[year]/[month]` - Get bill instances for specific month
- `POST /api/bills/instances/generate` - Generate bill instances for upcoming months
- `POST /api/bills/instances/[id]/mark-paid` - Manually mark bill as paid
- `POST /api/bills/instances/[id]/skip` - Skip bill for this month
- `GET /api/bills/overdue` - Get all overdue bills
- `POST /api/bills/auto-detect` - Check if transaction matches any pending bills
- `GET /api/bills/payment-history/[billId]` - Get payment history for specific bill
- `POST /api/bills/bulk-update-status` - Update multiple bill statuses at once

---

## 🚀 Development Timeline - Transaction-First Approach

### Phase 1: Foundation & Core Transaction Entry (Week 1-2)
**Goal:** Get basic transaction entry working immediately

**Priority Tasks:**
- [ ] Initialize Next.js 14 project with TypeScript and Clerk authentication
- [ ] **Configure Tailwind CSS with dark mode as default (class strategy)**
- [ ] **Install Inter font via next/font/google**
- [ ] **Set up custom color palette in tailwind.config.ts (background, surface, elevated, border)**
- [ ] **Install and configure shadcn/ui with custom dark theme**
- [ ] **Set up dark mode color system (#0a0a0a background, #1a1a1a surfaces)**
- [ ] **Configure global dark mode styles and typography (Inter font, white headings, gray-400 body)**
- [ ] **Create reusable Card component with #1a1a1a background and rounded-xl**
- [ ] **Create colored icon background component for account types**
- [ ] **Set up household management infrastructure**
- [ ] **Implement household creation and member invitation system**
- [ ] Set up basic database schema (accounts, transactions, categories, households, user_settings)
- [ ] **Build user_settings, user_sessions, data_export_requests, account_deletion_requests tables**
- [ ] **Create default user settings on first login (auto-detect timezone, set defaults)**
- [ ] **Build audit log database schema (audit_log, transaction_versions tables)**
- [ ] **Add version tracking fields to core tables (version, last_modified_by, last_modified_at)**
- [ ] **Implement core audit logging function**
- [ ] **Build primary transaction entry interface** (floating action button + quick entry)
- [ ] **Implement smart amount formatting and category suggestions**
- [ ] **Create one-tap transaction templates for common expenses**
- [ ] Basic account selection and balance display
- [ ] **Household selector in navigation**

**Deliverables:**
- Working authentication with Clerk
- Fully configured dark mode theme as default (#0a0a0a background, #1a1a1a surfaces)
- Inter font implemented throughout application
- Custom Tailwind color palette configured
- Dark mode optimized UI components from shadcn/ui with custom styling
- Reusable Card, Button, and Icon components matching design reference
- Household creation and invitation system
- Working transaction entry (10-second goal)
- Smart suggestions based on amount/time
- Quick templates for common transactions
- Users can invite household members

### Phase 2: Transaction Intelligence & Speed Features (Week 3-4)
**Goal:** Make data entry as fast as possible with advanced search and duplicate detection

**Status: 12/24 core tasks + 10+ additional features (50%+ progress)** 🟢 → 🟡 (APPROACHING COMPLETION)

#### Completed Tasks (Session 7 - Current):
- ✅ **Advanced Search Database Schema & API**
  - 5 new performance indexes on transactions table (category, type, amount, date ranges)
  - `/api/transactions/search` endpoint with 11 filter types
  - Pagination support (limit/offset) with 100 max per request
  - Automatic search history tracking to database
  - Multi-factor filtering: text, categories, accounts, types, amounts, dates, toggles
  - Sorting options: date, amount, description (asc/desc)
  - Response includes execution metadata and applied filters

- ✅ **Saved Searches CRUD System**
  - `/api/saved-searches` - Create, list, search filters with sorting
  - `/api/saved-searches/[id]` - Get, update, delete individual searches
  - Usage tracking (usage count, last used timestamp)
  - Default search management
  - Search descriptions and metadata storage
  - SavedSearches UI component with expandable details
  - Load button auto-executes search with loaded filters
  - One-click delete with confirmation

- ✅ **Pagination Controls**
  - Previous/Next navigation buttons
  - Shows current page range (e.g., "Showing 1-50 of 342")
  - Respects search filters when paginating
  - Proper disabled state management
  - Integrated into transactions page

- ✅ **Duplicate Detection with Levenshtein Distance**
  - `lib/duplicate-detection.ts` utility with Levenshtein string similarity
  - `/api/transactions/check-duplicates` endpoint
  - Normalized string matching (removes common words, special chars)
  - Multi-factor matching: description + amount + date range
  - Configurable thresholds (description: 0.7, amount: 5%, date range: 7 days)
  - Risk level calculation (low/medium/high based on match strength)
  - DuplicateWarning UI component with color-coded risk levels
  - Match percentage display and expandable details
  - "View" button to navigate to duplicate, "Continue anyway" override
  - useDuplicateCheck hook for easy integration
  - Toast notifications for high-risk matches

- ✅ **Implement full split transaction editing UI and transaction details workflow**
  - **Transaction Details Page** (`/dashboard/transactions/[id]`)
    - View complete transaction information with all metadata
    - Display full transaction history with type badges and color coding
    - Show transaction status (Pending/Completed)
    - Display creation and last modified timestamps
    - Back navigation to transactions list
  - **Transaction Details Component** (`transaction-details.tsx`)
    - Fetch and display transaction by ID
    - Edit and Delete buttons with proper error handling
    - Full metadata display (date, type, amount, account)
    - Optional notes display
    - Integration with splits list component
    - Proper error states and user feedback
  - **Splits List Component** (`splits-list.tsx`)
    - Display all splits for a transaction in table format
    - Show split category, amount/percentage, and description
    - Calculate and display split totals
    - Pagination and error handling
  - **Edit Transaction Page** (`/dashboard/transactions/[id]/edit`)
    - Load existing transaction data with pre-filled form
    - Full transaction form in edit mode
    - Load and display existing splits
    - Handle split updates with deletion and recreation
    - Back navigation to transaction details
  - **Enhanced Transaction Form** - Edit mode support
    - Auto-load transaction data when in edit mode
    - Load existing splits for modification
    - Support both creation and editing workflows
    - Dynamic button text based on mode (Create/Update)
    - Handle split updates seamlessly
    - Proper form reset after submission
  - **Updated Transactions List** - Navigation and indicators
    - Clickable transaction cards linking to details
    - Split indicator badge (blue split icon) for split transactions
    - Improved visual feedback with hover states
    - Prevent default link navigation on repeat button
  - **Backend Transaction APIs** - Full CRUD operations
    - GET `/api/transactions/[id]` - Fetch single transaction
    - PUT `/api/transactions/[id]` - Update transaction with balance management
    - DELETE `/api/transactions/[id]` - Delete transaction with cascade cleanup
    - Automatic account balance adjustments on edits/deletes
    - User ownership verification on all operations
    - Proper handling of Next.js 16 async params
  - Status: Zero TypeScript errors, ~2,000 lines of production code

#### Completed Tasks (Session 5):
- ✅ **Implement split transaction creation and editing UI**
  - **SplitBuilder component** - Full split transaction builder with validation
    - Toggle between fixed amount and percentage splits
    - Add/remove split entries dynamically
    - Real-time validation with detailed error messages
    - Auto-calculate remaining amount/percentage for new splits
    - Split metrics display (shows both amount and percentage)
    - Summary card with transaction total and split count
  - **TransactionForm integration** - "Add Splits" button to enable/disable split mode
    - Auto-hides category selector when using splits
    - Split builder appears only when amount is entered
    - Saves all splits after transaction creation via API
    - Proper state management and form reset
  - **Validation system** - Uses split-calculator utility
    - Prevents mixing percentage and amount splits
    - Validates sum to 100% (percentage) or total amount (fixed)
    - Shows validation errors and success badges
  - **Dark mode UI** - Matches design system colors and spacing
  - Status: Zero TypeScript errors, ~390 lines of production code

#### Completed Tasks (Session 4):
- ✅ **Enhanced transaction history with repeat functionality & templates system**
  - **New `transactionTemplates` table** - Save transactions as reusable templates
  - **Transaction history endpoint** (`/api/transactions/history`) - Browse past transactions with optional account filtering
  - **Template CRUD endpoints** (`/api/transactions/templates` + `/api/templates/[id]`) - Create, read, update, delete templates
  - **Repeat from template endpoint** (`/api/transactions/repeat`) - Create new transactions from templates with rule auto-application
  - **TransactionHistory component** - Display history with repeat/template-save buttons
  - **TransactionTemplatesManager component** - Modal dialog for selecting and managing templates
  - **Enhanced TransactionForm** - "Use Template" and "Save as Template" buttons for quick template workflow
  - **New page** `/dashboard/transaction-history` - Dedicated history and templates management page
  - **Template usage tracking** - Templates track usage count and last-used timestamp (most-used first)
  - **Proper null-checking** - Fixed all TypeScript null safety issues across repeat/template endpoints
  - Status: Zero TypeScript errors, ready for production

#### Completed Tasks (Session 3):
- ✅ Transaction history with "repeat" functionality (previous implementation)
  - Repeat button on transaction list with one-click duplication
  - Repeat functionality on dashboard recent transactions widget
  - Automatic date update to today's date when repeating
  - Toast notifications for user feedback
  - New reusable component: `components/transactions/recent-transactions.tsx`

- ✅ Split transaction database schema
  - Enhanced `transactionSplits` table with userId, isPercentage fields
  - Added proper indexes for performance (user, transaction, category, composite)
  - Improved tracking with notes and updatedAt fields
  - Full category relations established
  - API endpoints: GET/POST splits, PUT/DELETE individual splits
  - Created split calculator utility (`lib/transactions/split-calculator.ts`)
    - Validates percentage/amount splits
    - Calculates actual amounts from percentages
    - Computes split metrics and remaining amounts

#### Completed Tasks (Session 2):
- ✅ 5 foundational features (usage tracking, sorting, autocomplete, smart categorization, rules schema)
- ✅ 7 comprehensive rule system features (engine, matcher, testing, auto-apply, UI builder, manager, bulk operation)
- ✅ **Total: ~2,100 lines of code across 13 new files**
- ✅ **Zero TypeScript compilation errors**

#### Recent Commits:
- `[Session 3]` - Phase 2: Add transaction repeat functionality for fast transaction entry
- `d24fbef` - Phase 2: Implement foundational transaction intelligence features
- `338bb4d` - Phase 2: Implement comprehensive categorization rules engine
- `c8f9560` - Phase 2: Add bulk rule application for existing transactions

**Priority Tasks:**
- [x] **Implement usage tracking system for accounts, categories, and merchants** ✅ COMPLETED
  - Usage tracking automatically updates on transaction creation
  - Merchant table tracks totalSpent and averageTransaction
  - UsageAnalytics table records all item usage (accounts, categories, merchants, transfer pairs, bills)
- [x] **Build usage-based sorting for all selection lists** ✅ COMPLETED
  - Accounts API endpoint sorted by usageCount descending, then sortOrder
  - Categories API endpoint sorted by usageCount descending, then sortOrder
  - Merchants API endpoint sorted by usageCount descending
  - Selection components now automatically display most-used items first
- [x] **Implement auto-complete for transaction descriptions with usage sorting** ✅ COMPLETED
  - MerchantAutocomplete component integrated into transaction form
  - Suggestions from /api/suggestions already sorted by usage frequency
  - Shows frequency count and average amount for each merchant
- [x] **Build smart categorization engine based on merchant history** ✅ COMPLETED
  - Created /api/categorization/suggest endpoint
  - Analyzes merchant transaction history and returns category suggestion with confidence score
  - Auto-applies suggested category when merchant is selected
  - Handles new merchants gracefully (no suggestion for unknown merchants)
- [x] **Build custom categorization rules database schema (categorization_rules, rule_execution_log)** ✅ COMPLETED
  - categorizationRules table: supports complex condition matching (JSON), priority ordering, match statistics
  - ruleExecutionLog table: tracks rule application history with proper indexing
  - Relations established with budgetCategories and transactions
  - Ready for condition evaluation engine implementation
- [x] **Implement rule condition evaluation engine (field, operator, value matching)** ✅ COMPLETED
  - 14 comparison operators: equals, not_equals, contains, not_contains, starts_with, ends_with, greater_than, less_than, between, regex, in_list, matches_day, matches_weekday, matches_month
  - 8 transaction fields: description, amount, account_name, date, day_of_month, weekday, month, notes
  - Recursive condition groups with AND/OR logic
  - Comprehensive validation system for condition syntax
  - Located: `lib/rules/condition-evaluator.ts`
- [x] **Create rule matching algorithm with priority ordering** ✅ COMPLETED
  - Priority-based matching (lower priority number = higher priority)
  - Find highest-priority matching rule (first match wins)
  - Find all matching rules for debugging/testing
  - Database queries with proper sorting and filtering
  - Located: `lib/rules/rule-matcher.ts`
- [x] **Build rule testing function for preview before saving** ✅ COMPLETED
  - Test rule against single transaction
  - Test rule against multiple sample transactions
  - Returns detailed match results with errors
  - API endpoint: `/api/rules/test` with POST method
- [x] **Add automatic rule application on transaction creation** ✅ COMPLETED
  - Enhanced `/api/transactions` POST endpoint
  - Automatically applies rules to transactions without manual category
  - Respects skip conditions (transfers can't be auto-categorized)
  - Logs rule execution to ruleExecutionLog table
  - Returns applied rule ID and category in response
- [x] **Create Rule Builder UI component with condition groups and AND/OR logic** ✅ COMPLETED
  - Visual condition builder with nested groups
  - AND/OR logic toggle for condition groups
  - Add/remove conditions and groups dynamically
  - Field and operator selectors with validation
  - Tips for common matching patterns
  - Real-time updates with JSON condition serialization
  - Located: `components/rules/rule-builder.tsx`
- [x] **Build Rules Manager interface with drag-and-drop priority reordering** ✅ COMPLETED
  - List all rules with statistics (match count, last used)
  - Priority reordering with up/down arrows
  - Toggle rules active/inactive without deletion
  - Edit and delete rules with confirmation dialogs
  - Category display with usage indicators
  - Empty state with quick create button
  - Info panel explaining rule execution order
  - Located: `components/rules/rules-manager.tsx`
- [x] **Implement "Apply to Existing Transactions" bulk operation** ✅ COMPLETED
  - Endpoint: `/api/rules/apply-bulk` with POST method
  - Date range filtering (startDate, endDate parameters)
  - Limit parameter to control batch size (default 100)
  - Only processes transactions without categories
  - Respects rule priority ordering
  - Logs all applications for audit trail
  - Returns detailed statistics: processed, updated, errors
  - UI Component: `components/rules/bulk-apply-rules.tsx`
  - Shows progress, results, applied rules, and error logs
  - "Run Again" button for repeated operations
- [x] **Add rule statistics tracking (match count, last used)** ✅ COMPLETED
  - Match count tracked in categorizationRules table
  - Last matched timestamp stored and updated
  - Displayed in Rules Manager UI
  - Logged in ruleExecutionLog for audit trail
  - Used to identify most effective rules
- [x] **Add transaction history with "repeat" functionality** ✅ COMPLETED
  - Quick repeat button on transaction list (one-click duplication)
  - Repeat functionality on dashboard widget (recent transactions)
  - Preserves category, amount, description, and notes
  - Auto-sets date to today when repeating
  - Toast notifications for user feedback
  - Location: `app/dashboard/transactions/page.tsx`, `components/dashboard/recent-transactions.tsx`
- [x] **Build split transaction database schema (transaction_splits table)** ✅ COMPLETED
  - Enhanced schema for split entries (amount/percentage per split)
  - Added userId field for better security and query filtering
  - Added isPercentage field to clarify split type
  - Proper indexes: single-field and composite indexes for performance
  - Transaction split relations fully established
  - API endpoints implemented for CRUD operations
  - Split calculator utility for validation and calculations
  - Location: `lib/db/schema.ts`, `app/api/transactions/[id]/splits/route.ts`, `lib/transactions/split-calculator.ts`
- [x] **Implement split transaction creation and editing UI** ✅ COMPLETED
  - SplitBuilder component with full split management (add/remove/edit)
  - Toggle between percentage and fixed amount splits
  - Validation to ensure splits sum to 100% or total amount
  - Real-time validation feedback with error messages
  - Location: `components/transactions/split-builder.tsx`
- [x] **Add split transaction builder component with validation** ✅ COMPLETED
  - Reusable component for creating/editing splits in transactions
  - Auto-calculate remaining percentage/amount for new splits
  - Real-time validation feedback with success/error badges
  - Split metrics display (shows both amount and percentage)
  - Integrated into TransactionForm with "Add Splits" toggle
- [x] **Build advanced search database schema (search_presets, search_history)** ✅ COMPLETED
  - ✅ Save/load search filter combinations
  - ✅ Track search history for quick re-use
  - ✅ Saved searches with usage tracking
- [x] **Implement core search function with multi-criteria filtering** ✅ COMPLETED
  - ✅ Search by description, notes, category, account, type
  - ✅ Amount range filtering
  - ✅ Custom date range selection
  - ✅ Pagination support
- [ ] **Build CSV import database schema (import_templates, import_history, import_staging)**
  - Store import templates for different banks
  - Track import history with rollback capability
  - Staging table for preview before commit
- [ ] **Implement CSV parser with delimiter and header detection**
  - Auto-detect delimiter (comma, tab, semicolon)
  - Auto-detect headers and skip rows
  - Handle quoted fields and escape sequences
- [ ] **Build auto-detect column mapping algorithm**
  - Suggest column types based on content analysis
  - Learn from previous imports (templates)
  - Validate mapped columns before import
- [x] **Duplicate detection with Levenshtein distance algorithm** ✅ COMPLETED
  - ✅ Calculate string similarity between transactions
  - ✅ Flag similar transactions (amount, description, date)
  - ✅ UI for reviewing and navigating to duplicates
  - ✅ Risk level assessment
- [x] **Voice-to-text transaction entry (if supported)** ❌ REMOVED BY USER REQUEST
  - Removed from Phase 2 plan per user feedback (2024-11-08)
- [ ] Bulk import from bank statements with auto-categorization

**Deliverables (Session 7):**
- Sub-5-second transaction entry for repeat transactions ✅
- Usage-based sorting operational for all lists ✅
- Intelligent auto-categorization with merchant learning ✅
- Custom rule-based auto-categorization system with test-before-save ✅
- Full split transaction support with percentage/amount modes ✅
- Advanced search with 11+ filter types ✅
- Saved searches with usage tracking ✅
- Pagination support for search results ✅
- Duplicate detection with Levenshtein distance ✅
- Merchant autocomplete with usage frequency ✅
- Bank statement import (IN PROGRESS - CSV phase)

### Phase 3: Account Management & Transfers (Week 5-6)
**Goal:** Multi-account support with easy transfers

**Priority Tasks:**
- [ ] Complete multi-account management
- [ ] **Streamlined transfer interface (account chips, not dropdowns)**
- [ ] Real-time balance updates
- [ ] **Quick transfer shortcuts based on usage tracking of account pairs**
- [ ] **Transfer pair usage tracking and learning**
- [ ] Account balance notifications
- [ ] Transfer linking system
- [ ] **Display most-used transfer pairs for one-tap transfers**
- [ ] **Build calendar view month grid component**
- [ ] **Implement calendar day cells with transaction/bill indicators**
- [ ] **Create day detail modal for viewing/adding transactions**
- [ ] **Add week view alternative layout**
- [ ] **Implement quick date navigation (today, tomorrow, payday, etc.)**
- [ ] **Build advanced search UI with accordion filters**
- [ ] **Add text search for description and notes**
- [ ] **Implement category, account, and merchant multi-select filters**
- [ ] **Create search results display with export to CSV**
- [ ] **Add quick filter buttons (large expenses, tax deductible, unreconciled)**
- [ ] **Build CSV Import Wizard (4-step: Upload, Map, Review, Complete)**
- [ ] **Implement column mapping UI with sample data preview**
- [ ] **Create duplicate detection review interface**
- [ ] **Add import staging approval/skip functionality**
- [ ] **Build import history viewer with rollback capability**
- [ ] **Implement import template save and management**

**Deliverables:**
- Seamless multi-account transaction entry
- One-tap transfers between common account pairs (learned from usage)
- Real-time balance tracking
- Transfer pair suggestions based on history
- Full calendar view with month/week toggle
- Visual indicators for bills and spending on calendar
- Powerful search with multiple filter combinations
- Quick filters for common searches
- CSV import with manual column mapping
- Duplicate detection and resolution
- Import templates for different banks
- Import history with rollback

### Phase 4: Budget Integration, Bill Tracking & Notifications (Week 7-8)
**Goal:** Budget tracking, automatic bill payment detection, and notification system

**Progress: 27/27 tasks completed (100%) - Phase 4 COMPLETED ✅**

**All Phase 4 Tasks Completed:**
- ✅ Budget warning notifications (real-time) - Cron job checks spending and creates notifications
- ✅ Low balance notifications - API endpoint and cron job check account balances
- ✅ Real-time budget impact display during transaction entry - Shows projected spending, warnings, etc.

**Priority Tasks:**
- [x] **Build bill setup and management system** ✅
  - Bills CRUD API endpoints (POST, GET, PUT, DELETE)
  - Bill instance CRUD endpoints
  - Automatic 3-month instance generation
  - Bill active/inactive toggling
- [x] **Implement automatic bill payment detection and matching** ✅
  - Bill matcher utility with Levenshtein distance (lib/bills/bill-matcher.ts)
  - Multi-factor matching (string, amount, date, payee patterns)
  - Confidence scoring (0-100)
  - Batch transaction analysis
  - Auto-linking on transaction creation (90%+ confidence)
  - Bill detection from transaction history
  - Match preview API endpoint
- [x] **Create bill dashboard showing overdue and upcoming bills** ✅
  - `/dashboard/bills` page with 30-day preview
  - Upcoming, overdue, and paid bills sections
  - Statistics cards with totals and counts
- [x] **Set up notifications database schema** ✅ (Already in schema)
- [x] **Implement notification service with push notification support** ✅
  - Comprehensive notification service with 10 types
  - Scheduled notifications with metadata
  - Unread count tracking and cleanup
- [x] **Build notification bell UI component** ✅
  - Real-time unread badge
  - Sheet-based notification drawer
  - 30-second auto-refresh
- [x] **Create notification preferences interface** ✅
  - Toggle push/email notifications
  - Configure bill reminders, budget warnings, low balance alerts
  - Weekly/monthly summary scheduling
- [x] **Set up bill reminder cron job (daily)** ✅
  - Comprehensive cron job documentation
  - 5 deployment options (Vercel, cron-job.org, EasyCron, AWS, Coolify)
  - Testing and monitoring guides
- [x] **Implement budget warning notifications (real-time)** ✅
  - Budget warnings utility (`lib/notifications/budget-warnings.ts`)
  - Checks spending thresholds and creates notifications
  - API endpoint: `POST /api/notifications/budget-warnings`
  - Cron-compatible for scheduled execution
- [x] **Add low balance notifications** ✅
  - Low balance alerts utility (`lib/notifications/low-balance-alerts.ts`)
  - Checks account balances against thresholds
  - API endpoint: `POST /api/notifications/low-balance-alerts`
  - Priority levels based on severity
- [x] **Real-time budget impact display during transaction entry** ✅ (Already implemented)
- [x] **Bill payment status tracking (paid, overdue, pending)** ✅ (In schema and endpoints)
- [x] **Build tags database schema and many-to-many relationships** ✅
- [x] **Implement tag creation and management UI** ✅
  - Tag manager component with color picker
  - Create, edit, delete, toggle active
- [x] **Add tag selector to transaction form** ✅
  - Tag selector dropdown component
  - Color-coded visual badges
  - Usage count display
  - Full integration into transaction form
- [x] **Add tag filtering to advanced search** ✅
  - Tag selection UI with color indicators
  - SQL join-based filtering
  - Filter persistence in saved searches
- [x] **Create custom fields database schema** ✅
- [x] **Build custom field definition manager** ✅
  - Custom field manager component
  - 8 field types: text, number, date, select, multiselect, checkbox, url, email
  - Validation patterns and defaults
- [x] **Add dynamic custom field inputs to forms** ✅
  - All 8 field types supported
  - Proper input rendering and validation
  - Values saved with transactions
  - Values loaded in edit mode
- [x] **Add custom field filtering to advanced search** ✅
  - API infrastructure prepared
  - Parameter parsing complete
- [x] **Implement saved search presets feature** ✅
  - (Already fully implemented in Phase 2)
  - Full CRUD API with `/api/saved-searches`
- [x] **Build search presets sidebar with usage tracking** ✅
  - Usage count and sorting
  - Last used timestamps
- [x] **Add budget warnings during transaction entry** ✅
  - `/api/budgets/check` endpoint
  - Budget status indicator component
  - Real-time spending calculations
  - Visual warnings and alerts
- [x] **Real-time budget impact display** ✅
  - Projected percentage calculation
  - Dynamic progress bars
  - Current vs. projected display
- [x] **Implement spending summaries (weekly/monthly)** ✅
  - `/api/spending-summary` endpoint
  - Weekly and monthly views
  - Category breakdown
  - Top merchants tracking
  - Period navigation component
- [x] **Monthly bill instance generation and management** ✅ (Automatic in bill creation)

**Deliverables:**
- [x] Complete bill tracking system with auto-payment detection ✅
  - REST API for full bill lifecycle management
  - Multi-factor matching algorithm (90%+ confidence for auto-linking)
  - Transaction-to-bill detection from history
  - Monthly instance generation and management
- [x] Bill dashboard with 30-day preview ✅
  - Upcoming, overdue, and paid bills sections
  - Statistics cards with real-time counts
  - Color-coded status indicators
- Bills never "fall off" until marked paid (Implemented in bill instances)
- [x] Full notification system with PWA push support ✅
  - Notification service infrastructure
  - 10 notification types with priority levels
  - Notification bell with unread badge
  - Notification center page with filtering
- [x] Bill reminders (3 days before, on due date, overdue) ✅
  - Automatic bill reminder checks
  - Customizable reminder days per user
  - Overdue detection with days late tracking
- [x] Budget warnings and exceeded alerts ✅
  - Real-time budget status checking
  - Color-coded visual indicators
  - Projected spending after transaction
- [x] Real-time budget feedback during transaction entry ✅
  - Dynamic budget status display
  - Remaining budget calculation
  - Over-budget warnings
- [x] Customizable notification preferences ✅
  - User preference management interface
  - Granular notification controls
  - Quiet hours support (structure ready)
- [x] Overdue bill alerts and management ✅
  - Automatic detection of overdue bills
  - Days late tracking
  - Notification integration
- [x] Full tagging system with usage tracking ✅
  - Tag manager component
  - Tag selector component
  - Usage count and last used tracking
  - Color picker with presets
- [x] Flexible custom fields for transactions ✅
  - Custom field manager component
  - 8 field types with validation
  - Optional fields and defaults
- [x] Advanced search with multiple filter types ✅
  - Tag filtering with SQL joins
  - Custom field infrastructure
  - Full integration with saved searches
- [x] Saved search presets with favorites ✅
  - Full CRUD API (`/api/saved-searches`)
  - Usage tracking and sorting
  - Default search management
- [x] Spending summaries and analytics ✅
  - Weekly and monthly spending views
  - Category breakdown with percentages
  - Top merchants tracking
  - Income vs. expense analysis

### Phase 5: Goals, Advanced Features & Household Activity (Week 9-10)
**Goal:** Add spreadsheet functionality and household collaboration features
**Status:** IN PROGRESS - Part 1 (Savings Goals), Part 2 (Debt Management), Part 3 (Activity Feed) COMPLETED ✅

**Priority Tasks:**
- [x] **Savings goals with simple progress tracking**
- [x] **Savings milestone notifications (25%, 50%, 75%, 100%)**
- [x] **Debt management integrated into transaction entry**
- [x] **Implement debt payoff start date initialization**
- [x] **Create debt_payoff_milestones table and tracking functions**
- [x] **Build DebtPayoffProgressTracker component with progress bar**
- [x] **Add automatic milestone detection and notifications (25%, 50%, 75%)**
- [ ] **Implement momentum indicator comparing last 3 months to previous 3 months**
- [x] **Create debt payoff stats API endpoint with journey and performance metrics**
- [x] **Debt milestone notifications**
- [ ] **Annual bill planning (simplified interface)**
- [x] **Build household activity feed**
- [x] **Implement activity logging for all major actions**
- [ ] **Add household member management interface**
- [ ] **Permission-based UI rendering**
- [ ] **Build transaction version history viewer**
- [ ] **Implement version comparison modal**
- [ ] **Add revert to version functionality**
- [x] **Create recent activity feed component**
- [x] **Integrate audit logging into all CRUD operations**
- [ ] **Add soft delete support with restore capability**
- [ ] **Build Settings page with 5 tabs (Profile, Display, Privacy, Security, Account)**
- [ ] **Implement profile settings UI (display name, avatar upload, bio)**
- [ ] **Create display preferences UI (timezone, currency, date format, number format)**
- [ ] **Add privacy settings UI (profile visibility, activity tracking, analytics)**
- [ ] **Build accessibility settings UI (reduce motion, high contrast, text size)**
- [ ] **Implement session management UI (active devices, logout functionality)**
- [ ] **Create data export request flow with background job**
- [ ] **Build account deletion flow with 30-day grace period**
- [ ] **Set up cron job for executing scheduled account deletions**
- [ ] **Apply user settings throughout app (date formatting, currency display, etc.)**
- [ ] **Weekly/monthly spending summary notifications**
- [ ] **Set up spending summary cron job (weekly/monthly)**
- [ ] **Implement basic chart components (spending by category, income vs expenses)**
- [ ] **Create dashboard summary cards (income, expenses, net, savings rate)**
- [ ] Debt payoff projections
- [ ] Financial health dashboard

**Deliverables:**
- Complete feature parity with spreadsheet
- Goal tracking without complex navigation
- Savings and debt milestone notifications
- Weekly/monthly spending summaries
- Simple debt management
- Full audit trail and version history
- Transaction revert capability
- Full household activity transparency
- Member management and permissions working
- Complete user settings and profile management system
- Multi-timezone and multi-currency support
- Session management and device control
- GDPR-compliant data export
- Account deletion with grace period
- Basic visual reports and charts

### Phase 6: Mobile Optimization & Performance (Week 11-12)
**Goal:** Perfect mobile experience and speed

**Priority Tasks:**
- [ ] **Optimize transaction entry for one-handed use**
- [ ] **Add haptic feedback for transaction confirmation**
- [ ] Progressive Web App setup
- [ ] **Offline transaction entry with sync**
- [ ] Performance optimization (< 2-second load times)
- [ ] **Quick shortcuts and gestures**
- [ ] **Optimize usage tracking queries for performance**
- [ ] **Set up usage data cleanup cron jobs**
- [ ] **Implement usage decay algorithm for fresh recommendations**

**Deliverables:**
- Lightning-fast mobile performance
- Offline capability
- One-handed operation optimization
- Usage-based sorting responds in <100ms
- Automated usage data maintenance

### Phase 7: Testing & Deployment (Week 13-14)
**Goal:** Production-ready with focus on user experience

**Priority Tasks:**
- [ ] **User testing focused on transaction entry speed**
- [ ] **Test usage-based sorting accuracy and speed improvements**
- [ ] **Verify usage tracking across all transaction types**
- [ ] **A/B test different entry interfaces**
- [ ] **Complete advanced chart components (net worth, budget progress, debt payoff)**
- [ ] **Add category comparison and monthly trends charts**
- [ ] **Implement savings goals visualization**
- [ ] **Build comprehensive Reports Dashboard page**
- [ ] **Add chart export functionality (CSV/PDF)**
- [ ] **Optimize chart rendering performance for mobile**
- [ ] **Initialize system tax categories (Schedule C, Schedule A, etc.)**
- [ ] **Build tax category mapper UI for budget categories**
- [ ] **Implement tax deduction calculation engine**
- [ ] **Create tax dashboard with year selector**
- [ ] **Add tax report generation (summary, detailed, by form)**
- [ ] **Implement tax data CSV export**
- [ ] **Build sales tax tracking database schema**
- [ ] **Implement sales tax toggle for income transactions**
- [ ] **Add sales tax dashboard (current quarter, last quarter, YTD)**
- [ ] **Create quarterly sales tax report with breakdown by rate**
- [ ] **Implement sales tax period management and filing status**
- [ ] **Add sales tax CSV export for quarterly filing**
- [ ] **Build sales tax settings (default rate, jurisdiction)**
- [ ] Performance benchmarking (transaction entry < 10 seconds)
- [ ] Docker containerization for Coolify
- [ ] Production deployment
- [ ] **User onboarding focused on quick entry and learning features**
- [ ] Set up automated cron jobs for usage data maintenance

**Deliverables:**
- Deployed application optimized for speed
- User onboarding that teaches fast entry and explains learning features
- Performance metrics meeting speed goals
- Usage-based sorting demonstrably improving selection speed
- Automated maintenance tasks operational
- Complete visual reporting dashboard with all charts
- Export capabilities for reports
- Full tax preparation and reporting system
- Sales tax tracking with quarterly reporting

---

## 🐳 Deployment Configuration (Coolify)

### Docker Setup
Since Coolify uses containerized deployment, the application will need Docker configuration:

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build application
RUN pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create database directory with proper permissions
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Run database migrations on startup
CMD ["sh", "-c", "pnpm db:push && node server.js"]
```

### Coolify Environment Configuration
```bash
# Environment variables for Coolify
NODE_ENV=production
DATABASE_URL=file:/app/data/finance.db
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secure-secret-here

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Optional: Analytics/Monitoring
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

### Coolify Service Configuration
```yaml
# coolify.yaml (if using configuration file)
services:
  - name: finance-app
    image: your-registry/finance-app:latest
    port: 3000
    env:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/finance.db
    volumes:
      - finance-data:/app/data
    healthcheck:
      enabled: true
      path: /api/health
      interval: 30s
      timeout: 10s
      retries: 3
```

### Next.js Configuration for Coolify
```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Optimize for container deployment
  experimental: {
    outputFileTracingRoot: __dirname,
  },
  
  // Asset optimization
  images: {
    domains: ['your-domain.com'],
    unoptimized: false,
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
});
```

### Database Persistence
Since SQLite is file-based, ensure persistent volume mounting:
- **Volume Mount**: `/app/data` for SQLite database file
- **Backup Strategy**: Regular database file backups
- **Migration Handling**: Automatic migrations on container startup

---

## 🛡️ Security & Performance

### Security Measures
- **Row-Level Security** - All queries filtered by authenticated user ID
- **Input Validation** - Comprehensive validation on all inputs
- **SQL Injection Prevention** - Parameterized queries via Drizzle ORM
- **Authentication** - Clerk handles secure user authentication
- **Data Encryption** - Sensitive account information encrypted at rest
- **API Rate Limiting** - Prevent abuse of API endpoints

### Performance Optimizations
- **Database Indexing** - Optimize queries with proper indexes
- **Caching Strategy** - Redis for frequently accessed data
- **Image Optimization** - Next.js automatic image optimization
- **Code Splitting** - Automatic code splitting with Next.js
- **Progressive Loading** - Skeleton screens and lazy loading
- **Mobile Performance** - Optimized bundles and critical path CSS

### Data Backup Strategy
- **Automated Volume Backups** - Daily backups of the `/app/data` volume containing SQLite database
- **Container Registry** - Application images stored in private registry for rollback capability
- **Database Export** - Weekly exports to external storage (S3-compatible or local backup server)
- **Export Functionality** - Users can export their data as CSV/JSON through the application
- **Disaster Recovery** - Full restoration procedures for Coolify server migration
- **Privacy Controls** - User data deletion and account closure with GDPR compliance

---

## 📊 Key Metrics & Success Criteria

### Transaction Entry Speed Metrics (Primary Goals)
- **New Transaction Entry** < 10 seconds (from app open to saved)
- **Repeat Transaction** < 5 seconds (using templates or recent history)
- **Transfer Between Accounts** < 8 seconds
- **Voice Transaction Entry** < 15 seconds (if implemented)
- **Bulk Import Processing** < 2 minutes for 100 transactions

### User Experience Metrics  
- **Taps to Complete Transaction** ≤ 4 taps for new transaction
- **Taps for Repeat Transaction** ≤ 2 taps (using quick templates)
- **Auto-Categorization Accuracy** > 85% for repeat merchants (>95% with custom rules configured)
- **One-Handed Usability** All primary functions reachable with thumb
- **Offline Transaction Entry** Full functionality without internet connection

### Technical Performance Metrics
- **App Launch Time** < 2 seconds on mobile 3G
- **Transaction Save Time** < 1 second
- **Database Query Time** < 100ms for transaction list
- **Sync Speed** < 5 seconds when coming back online
- **Battery Usage** Minimal impact on device battery

### Feature Parity & Accuracy Metrics
- **Spreadsheet Feature Coverage** 100% of core financial calculations
- **Transfer Linking Accuracy** 100% correct linking between accounts
- **Balance Calculation Accuracy** Zero discrepancies in account balances
- **Budget Tracking Accuracy** Real-time budget impact calculations
- **Data Integrity** No transaction loss or duplication

### Dark Mode UI Success Criteria
- [ ] **Dark theme applied by default on first launch**
- [ ] **All components optimized for dark mode readability**
- [ ] **OLED-friendly pure blacks (#000000 or #0a0a0a) for background**
- [ ] **High contrast white text on dark backgrounds for readability**
- [ ] **Pure white (#ffffff) used for primary headings and important text**
- [ ] **Gray-400 used for secondary text, gray-500 for tertiary**
- [ ] **Color-coded financial data (emerald-400 for income, red-400 for expenses)**
- [ ] **Account type icons use semi-transparent colored backgrounds (e.g., teal-500/20)**
- [ ] **Charts and graphs use dark-mode-optimized color palettes**
- [ ] **Form inputs clearly visible with proper contrast on #1a1a1a surface**
- [ ] **Focus states use white/20 ring for accessibility**
- [ ] **Hover states use subtle #2a2a2a background**
- [ ] **Primary buttons use white background with black text**
- [ ] **Secondary buttons use #242424 background with borders**
- [ ] **Card backgrounds use #1a1a1a on #0a0a0a page background**
- [ ] **Borders use #2a2a2a for subtle separation**
- [ ] **Inter font or similar modern sans-serif implemented**
- [ ] **Consistent 12px (rounded-xl) border radius across all cards**
- [ ] **40x40px colored icon squares for account types**
- [ ] **Transaction amounts right-aligned with proper color coding**
- [ ] **Upward/downward arrows next to transaction amounts**
- [ ] **No accessibility contrast issues (WCAG AA minimum)**
- [ ] **Battery efficient on OLED displays (pure blacks)**
- [ ] **Comfortable for extended viewing sessions (reduced eye strain)**
- [ ] **All shadcn/ui components styled with custom dark colors**
- [ ] **Icons and graphics optimized for dark backgrounds**

### Ease of Use Success Criteria
- [ ] **Primary Goal: Enter common transaction in under 10 seconds**
- [ ] New users can enter their first transaction within 2 minutes of setup
- [ ] 90% of transactions use suggested categories (minimal manual categorization)
- [ ] 95% of transactions auto-categorize with custom rules configured
- [ ] Voice entry works for 80% of common transaction types
- [ ] Quick templates cover 60% of user's typical transactions
- [ ] Bank import processes with 90% auto-categorization accuracy (95% with custom rules)
- [ ] Transfer between accounts requires no manual category assignment
- [ ] Budget impact visible immediately during transaction entry
- [ ] Transaction history searchable and editable in-place
- [ ] Recurring transaction detection and automation works for monthly bills

### Bill Tracking Success Criteria
- [ ] **Bills remain visible until manually marked paid (never fall off automatically)**
- [ ] **85% accuracy in automatic bill payment detection and matching**
- [ ] Overdue bills prominently displayed with days late calculation
- [ ] **Bill payment confirmation in under 3 taps when detected automatically**
- [ ] Manual bill marking available with override option
- [ ] Bill setup completed in under 2 minutes per bill
- [ ] Monthly bill instances generated automatically
- [ ] Payment history tracking for all bills
- [ ] Late fee tracking and alerts
- [ ] **Zero missed bill payments due to system not tracking properly**

### Debt Payoff Strategy Success Criteria
- [ ] **Toggle between snowball and avalanche methods in under 2 taps**
- [ ] **Side-by-side comparison shows clear differences in payoff time and interest**
- [ ] Strategy recommendations based on psychological vs mathematical benefits
- [ ] **Real-time recalculation when extra payment amounts change**
- [ ] Clear payoff order display for chosen strategy
- [ ] **Interest savings calculations accurate within $1**
- [ ] Debt-free timeline projections accurate within 1 month
- [ ] **Strategy choice saves and applies to all debt management features**
- [ ] Progress tracking toward debt-free goal
- [ ] **Auto-allocation of extra payments based on chosen strategy**

### Debt Payoff Progress Tracking Success Criteria
- [ ] **Set debt payoff start date in under 3 taps**
- [ ] **Starting total debt captured automatically from current debts**
- [ ] **Progress percentage displayed prominently with visual progress bar**
- [ ] **"Months in payoff" counter shows time since start date**
- [ ] **Average monthly payoff calculated accurately from historical data**
- [ ] **Momentum indicator (📈/➡️/📉) shows recent 3-month trend vs previous 3 months**
- [ ] **Total paid off since start displayed in dashboard**
- [ ] **Estimated debt-free date calculated based on current payment rate**
- [ ] **Milestone notifications trigger at 25%, 50%, 75% completion**
- [ ] **Milestone achievements displayed in chronological order with dates**
- [ ] **"First debt paid off" milestone automatically recorded**
- [ ] **Progress stats load in under 1 second**
- [ ] **Journey start date editable if user made a mistake**
- [ ] **Empty state encourages user to set start date with clear CTA**
- [ ] **Progress tracker integrates with existing debt strategy components**
- [ ] **All monetary values formatted with $ and proper commas**
- [ ] **Milestones show "months to achieve" for each accomplishment**
- [ ] **Performance metrics compare recent vs historical payoff rates**

### Usage-Based Sorting Success Criteria
- [ ] **Most-used accounts appear at top of list within 3 uses**
- [ ] **Most-used categories appear at top of list within 3 uses**
- [ ] **Most-used merchants appear in autocomplete suggestions**
- [ ] **Top 3 items visually indicated with badges (⭐🥈🥉)**
- [ ] **Transfer pair shortcuts appear after 2 identical transfers**
- [ ] **Usage tracking happens automatically without user intervention**
- [ ] **Merchant autocomplete responds in under 300ms**
- [ ] **Usage counts displayed for frequently used items (>10 uses)**
- [ ] **Contextual suggestions accuracy >70% based on time/amount**
- [ ] **Usage data decays over time to reflect current habits**
- [ ] **Stale usage data cleaned up automatically (6+ months old)**
- [ ] **Quick category pills show top 3 most-used categories**
- [ ] **Account/category selection reduced from 5+ taps to 1-2 taps for frequent items**

### Custom Categorization Rules Success Criteria
- [ ] **Rule creation completed in under 2 minutes**
- [ ] **Rule conditions support all transaction fields (merchant, description, amount, account, type, notes)**
- [ ] **Rule condition operators include equals, contains, starts_with, ends_with, greater_than, less_than, between**
- [ ] **AND/OR logical operators work correctly for condition groups**
- [ ] **Rule priority ordering works with drag-and-drop reordering**
- [ ] **Rules execute in correct priority order (lowest number = highest priority)**
- [ ] **Test function previews matches against recent 50 transactions**
- [ ] **Test results show match count and sample transactions**
- [ ] **Rules apply automatically on new transaction creation**
- [ ] **Rules apply automatically during CSV import**
- [ ] **"Apply to Existing Transactions" bulk operation works correctly**
- [ ] **Rule statistics track match count and last used date accurately**
- [ ] **Rules can be toggled active/inactive without deleting**
- [ ] **Rule execution logged with transaction ID and rule ID**
- [ ] **Manual override tracked when user changes category after rule application**
- [ ] **Rules can set category, override merchant name, add notes, and apply tags**
- [ ] **Rule execution completes in <50ms per transaction**
- [ ] **Multiple rules don't conflict (first match wins based on priority)**
- [ ] **Rules UI shows clear examples and help text**
- [ ] **Rules list shows usage statistics for each rule**
- [ ] **Inactive rules don't execute but remain saved**
- [ ] **Case-insensitive matching works correctly for text fields**
- [ ] **Amount range conditions work with decimal precision**
- [ ] **Rule deletion removes all execution logs (cascading delete)**
- [ ] **Transaction shows which rule categorized it (transparency)**
- [ ] **Users can create unlimited rules without performance impact**
- [ ] **Rule Builder validates conditions before saving**
- [ ] **Empty or invalid rules can't be saved**
- [ ] **Rule names and descriptions support special characters**

### Multi-User Household Management Success Criteria
- [ ] **Household creation completed in under 1 minute**
- [ ] **Invitation link generated in under 30 seconds**
- [ ] **Shareable link can be copied to clipboard with one click**
- [ ] **Invitation link works when shared via any method (text, messaging app, etc.)**
- [ ] **New member can accept and access household in under 2 minutes**
- [ ] **Household switching happens instantly (<500ms)**
- [ ] **All household members see shared data in real-time**
- [ ] **Activity feed updates within 5 seconds of action**
- [ ] **Activity feed shows who did what for full transparency**
- [ ] **Permission checks execute in <100ms**
- [ ] **Users can't perform actions they don't have permission for**
- [ ] **Owner can remove members successfully**
- [ ] **Members can leave household (except owner)**
- [ ] **Role changes take effect immediately**
- [ ] **4 distinct roles working correctly (owner, admin, member, viewer)**
- [ ] **Viewer role can't create or edit transactions**
- [ ] **Member role can create transactions but not manage members**
- [ ] **Admin role can do everything except delete household**
- [ ] **Owner has full control including household deletion**
- [ ] **Each user sees only households they belong to**
- [ ] **Invitation tokens expire after 7 days**
- [ ] **Expired invitations can't be accepted**

### User Settings & Profile Management Success Criteria
- [ ] **Settings page loads within 1 second**
- [ ] **Settings organized into 5 clear tabs (Profile, Display, Privacy, Security, Account)**
- [ ] **Profile picture upload works with drag-and-drop or file selection**
- [ ] **Avatar displays correctly throughout app after upload**
- [ ] **Avatar upload validates file type (JPG, PNG, GIF) and size (max 5MB)**
- [ ] **Display name updates immediately across all UI**
- [ ] **Timezone auto-detected on first login**
- [ ] **Currency selection affects all monetary displays**
- [ ] **Date format applies to all dates (transaction list, calendar, reports)**
- [ ] **Number format applies to all numbers (1,000.00 vs 1.000,00)**
- [ ] **First day of week affects calendar display**
- [ ] **Time format (12h/24h) applies to all time displays**
- [ ] **Default household auto-selected on login**
- [ ] **Privacy settings take effect immediately**
- [ ] **Reduce motion setting affects all animations**
- [ ] **High contrast mode improves readability significantly**
- [ ] **Text size changes affect all text consistently**
- [ ] **Session list shows all active devices with accurate device info**
- [ ] **Current session marked clearly and cannot be revoked**
- [ ] **"Logout from Device" immediately terminates that session**
- [ ] **"Logout All Others" works correctly, keeping current session**
- [ ] **Session last active time updates within 5 minutes**
- [ ] **Data export request processes within 5 minutes for average user**
- [ ] **Export notification sent when data ready**
- [ ] **Export file downloadable for 7 days**
- [ ] **Export includes all user data (transactions, accounts, bills, budgets, etc.)**
- [ ] **Export format (JSON) is valid and parseable**
- [ ] **Account deletion requires confirmation**
- [ ] **Account deletion checks for owned households and prevents if owner**
- [ ] **Deletion scheduled for 30 days in future**
- [ ] **Deletion notification sent immediately after scheduling**
- [ ] **Cancel deletion works anytime during grace period**
- [ ] **Cancel notification sent after cancellation**
- [ ] **Scheduled deletion executes automatically via cron job**
- [ ] **All user data completely removed after deletion**
- [ ] **User can't login after account deletion completes**
- [ ] **Settings persist across browser sessions**
- [ ] **Settings sync across devices for same user**
- [ ] **Invalid settings prevented (proper validation)**
- [ ] **Settings changes save with visual confirmation**
- [ ] **Error messages clear and helpful for all setting failures**

### Notifications & Reminders Success Criteria
- [ ] **Notification bell shows unread count badge**
- [ ] **Unread count updates in real-time (<5 seconds)**
- [ ] **Bill reminders sent at configured time (3 days before by default)**
- [ ] **Bill due date reminders sent on due date**
- [ ] **Overdue bill alerts sent daily until paid**
- [ ] **Budget warning sent when reaching threshold (80% by default)**
- [ ] **Budget exceeded alert sent immediately when over 100%**
- [ ] **Low balance alert sent when account below threshold ($100 default)**
- [ ] **Savings milestone notifications sent at 25%, 50%, 75%, 100%**
- [ ] **Weekly spending summary sent on configured day**
- [ ] **Monthly spending summary sent on configured day**
- [ ] **Push notifications work on PWA**
- [ ] **Notifications respect quiet hours (no alerts between 10pm-7am default)**
- [ ] **Notifications can be marked as read**
- [ ] **Notifications can be dismissed**
- [ ] **"Mark all read" function works correctly**
- [ ] **Notification preferences save and apply immediately**
- [ ] **Push notification permission request works**
- [ ] **Push notifications appear even when app is closed**
- [ ] **Notification click navigates to relevant page**
- [ ] **Action buttons in notifications work (e.g., "Pay Bill")**
- [ ] **Priority-based visual indicators (urgent=red, high=orange, normal=blue)**
- [ ] **Expired notifications auto-dismiss**
- [ ] **No duplicate notifications sent for same event**
- [ ] **Notification count accurate at all times**
- [ ] **Cron jobs run reliably (daily for bills, weekly/monthly for summaries)**

### Charts & Visual Reports Success Criteria
- [ ] **All charts render correctly on mobile and desktop**
- [ ] **Charts load within 2 seconds for 12 months of data**
- [ ] **Spending by category pie chart shows correct percentages**
- [ ] **Income vs expenses line chart displays 6/12 month view correctly**
- [ ] **Budget progress bars accurately reflect spending vs budget**
- [ ] **Budget progress color-codes correctly (green<60%, yellow 60-79%, orange 80-99%, red≥100%)**
- [ ] **Net worth chart shows accurate historical data**
- [ ] **Net worth change calculation correct**
- [ ] **Category comparison chart shows month-over-month differences**
- [ ] **Monthly spending trends bar chart displays accurately**
- [ ] **Debt payoff projection matches strategy calculations (snowball/avalanche)**
- [ ] **Savings goals progress bars show correct percentages**
- [ ] **Savings goals show months remaining calculation**
- [ ] **Dashboard summary cards display correct current month totals**
- [ ] **Savings rate calculation accurate (net/income * 100)**
- [ ] **Charts respect household context (show household data when in household)**
- [ ] **Chart data updates in real-time when transactions added**
- [ ] **Time range selector works (3, 6, 12, 24 months)**
- [ ] **Charts are touch-friendly with tap-to-view details**
- [ ] **Chart tooltips show on hover/tap**
- [ ] **Charts use category colors consistently**
- [ ] **Empty state displays when no data available**
- [ ] **Export functionality generates correct CSV/PDF**
- [ ] **Charts animate smoothly without lag**
- [ ] **Responsive design works on all screen sizes**
- [ ] **Charts use dark mode colors appropriately**
- [ ] **No chart rendering errors or crashes**
- [ ] **Charts support accessibility features (ARIA labels)**

### Split Transactions Success Criteria
- [ ] **Can create split transaction with 2+ categories**
- [ ] **Split amounts must equal total transaction amount (validation)**
- [ ] **Cannot save split transaction if validation fails**
- [ ] **Split transaction builder shows remaining amount in real-time**
- [ ] **Can add/remove split items (minimum 2 required)**
- [ ] **Each split item requires category and amount**
- [ ] **Optional description field works for each split**
- [ ] **Auto-distribute button evenly splits remaining amount**
- [ ] **Percentage buttons (25%, 50%, 75%) calculate amounts correctly**
- [ ] **Toggle between amount and percentage input modes**
- [ ] **Percentage display shows correct % of total for each split**
- [ ] **Can convert existing regular transaction to split**
- [ ] **Can convert split transaction back to regular (with category selection)**
- [ ] **Split transaction displays correctly in transaction list**
- [ ] **Split transaction details show all split items with colors**
- [ ] **Split items appear in category-specific transaction lists**
- [ ] **Budget calculations include split transaction amounts**
- [ ] **Category spending totals correctly sum split amounts**
- [ ] **Split transactions export correctly in reports**
- [ ] **Editing split transaction recalculates account balance correctly**
- [ ] **Deleting split transaction removes all split items**
- [ ] **Split transactions work with household permissions**
- [ ] **Split transaction usage tracks all categories involved**
- [ ] **Mobile UI for split builder is touch-friendly and scrollable**
- [ ] **Validation messages are clear and helpful**
- [ ] **Split transaction icon/indicator visible in lists**
- [ ] **Can search for split transactions separately**
- [ ] **Split transaction totals match in all reports and summaries**

### Calendar View Success Criteria
- [ ] **Calendar displays current month by default**
- [ ] **Can navigate between months with prev/next buttons**
- [ ] **"Today" button jumps to current date**
- [ ] **Toggle between month and week view works**
- [ ] **Calendar shows all days including adjacent month days (dimmed)**
- [ ] **Today's date is clearly highlighted**
- [ ] **Days with transactions show transaction count**
- [ ] **Days with bills show bill indicators (color-coded by status)**
- [ ] **Overdue bills display in red on calendar**
- [ ] **Pending bills display in orange on calendar**
- [ ] **Paid bills display in green on calendar**
- [ ] **Daily totals display on calendar cells**
- [ ] **Positive daily totals show in green, negative in red**
- [ ] **Clicking a day opens detail modal**
- [ ] **Day detail modal shows all transactions for that day**
- [ ] **Day detail modal shows all bills for that day**
- [ ] **Day detail modal has tabs (All, Transactions, Bills)**
- [ ] **Quick add button in day detail modal pre-fills date**
- [ ] **Month summary bar shows income, expenses, net, pending bills**
- [ ] **Week view displays one week with expanded details**
- [ ] **Week view shows daily activity inline**
- [ ] **Week view has quick add button per day**
- [ ] **Quick date jump menu works (Today, Tomorrow, Next Week, etc.)**
- [ ] **Custom date picker allows jumping to any date**
- [ ] **Payday shortcuts (15th, 30th) work correctly**
- [ ] **Filter options work (show/hide transactions, bills, recurring)**
- [ ] **Calendar loads data within 2 seconds**
- [ ] **Recurring transactions project correctly on future dates**
- [ ] **Mobile calendar is touch-friendly and swipeable**
- [ ] **Calendar respects household context**
- [ ] **Empty days display cleanly without clutter**
- [ ] **Activity dots show for days with many transactions**
- [ ] **Calendar works in dark mode**
- [ ] **Calendar exports/prints correctly**

### Tags & Custom Fields Success Criteria
- [ ] **Can create new tags with name, color, and optional icon**
- [ ] **Tag names must be unique per user/household**
- [ ] **Tags display with custom colors and icons**
- [ ] **Tag usage count tracks correctly**
- [ ] **Tags can be sorted by name, usage, or recent**
- [ ] **Can add multiple tags to a single transaction**
- [ ] **Can remove tags from transactions**
- [ ] **Tag selector shows most-used tags first (when sorted by usage)**
- [ ] **Tag search/filter works correctly**
- [ ] **Clicking tag badge toggles selection**
- [ ] **Selected tags display with colored background**
- [ ] **Unselected tags display with colored border only**
- [ ] **Tags persist when transaction is saved**
- [ ] **Tags display on transaction list items**
- [ ] **Can search transactions by tag (single or multiple)**
- [ ] **Tag search supports AND/OR logic (match all vs match any)**
- [ ] **Tag statistics show transaction count, total amount, avg amount**
- [ ] **Tags respect household context (household tags vs personal)**
- [ ] **Can create custom field definitions (6 types supported)**
- [ ] **Custom fields can be text, number, date, boolean, select, multiselect**
- [ ] **Custom fields can be marked as required**
- [ ] **Custom fields can apply to transactions, accounts, bills, or goals**
- [ ] **Select fields allow defining dropdown options**
- [ ] **Custom field inputs render correctly based on type**
- [ ] **Required custom fields block form submission if empty**
- [ ] **Custom field values save correctly with entity**
- [ ] **Custom field values display on entity detail pages**
- [ ] **Can search/filter by custom field values**
- [ ] **Custom fields can be reordered (sort_order)**
- [ ] **Custom fields can be deactivated without deleting data**
- [ ] **Date fields use native date picker**
- [ ] **Boolean fields use switch/toggle UI**
- [ ] **Select fields use dropdown UI**
- [ ] **Custom fields load efficiently (no performance issues)**
- [ ] **Custom field values are included in exports**
- [ ] **Custom fields work with household permissions**
- [ ] **Tags and custom fields work together on same entity**
- [ ] **Mobile UI for tags and fields is touch-friendly**

### Tax Category Mapping Success Criteria
- [ ] **System tax categories initialize on first run (11 predefined categories)**
- [ ] **Can create custom tax categories**
- [ ] **Tax categories organized by deduction type (business, itemized, etc.)**
- [ ] **Can map budget category to one or more tax categories**
- [ ] **Percentage slider allows partial deductibility (0-100%)**
- [ ] **Mappings can have effective date ranges**
- [ ] **Can remove tax mappings from budget categories**
- [ ] **Tax calculation engine processes full year transactions**
- [ ] **Split transactions included in tax calculations**
- [ ] **Partial deductions calculate correctly (e.g., 50% meals)**
- [ ] **Tax dashboard shows total deductions for selected year**
- [ ] **Business expenses total displays correctly**
- [ ] **Itemized deductions total displays correctly**
- [ ] **Charitable giving total displays correctly**
- [ ] **Can switch between tax years (current, previous 2)**
- [ ] **Tax report generates in 3 formats (summary, detailed, by_form)**
- [ ] **Summary report groups by deduction type**
- [ ] **By form report groups by tax schedule (Schedule C, Schedule A, etc.)**
- [ ] **Detailed report shows all individual transactions**
- [ ] **CSV export includes all required columns**
- [ ] **CSV export format is compatible with tax software**
- [ ] **Tax report includes transaction dates and descriptions**
- [ ] **Deductible percentage displays correctly for each transaction**
- [ ] **Deductible amount calculates: amount × category% × tax%**
- [ ] **Tax categories display with form codes (Schedule C Line 8, etc.)**
- [ ] **System tax categories cannot be deleted (only deactivated)**
- [ ] **Custom tax categories can be edited and deleted**
- [ ] **Tax mappings respect budget category deletion (cascade)**
- [ ] **Year-to-year comparison available for tax planning**
- [ ] **Tax summary loads within 3 seconds for full year**
- [ ] **Tax export downloads immediately**
- [ ] **Mobile UI for tax dashboard is responsive**
- [ ] **Tax reports print correctly**

### Sales Tax Tracking Success Criteria
- [ ] **Income transactions have taxable toggle switch**
- [ ] **Toggle switch saves taxable status immediately**
- [ ] **Tax rate input appears when marking income as taxable**
- [ ] **Tax amount calculates automatically (amount × rate / 100)**
- [ ] **Tax amount displays immediately after calculation**
- [ ] **Can edit tax rate after initial save**
- [ ] **Can mark income as non-taxable and clear tax data**
- [ ] **Sales tax dashboard loads within 2 seconds**
- [ ] **Current quarter summary displays correct totals**
- [ ] **Last quarter summary displays correct totals**
- [ ] **Year-to-date summary displays correct totals**
- [ ] **Quarter selector allows choosing Q1-Q4**
- [ ] **Year selector shows current and previous 2 years**
- [ ] **Quarterly report generates for selected period**
- [ ] **Report shows total taxable income**
- [ ] **Report shows total tax collected**
- [ ] **Report shows transaction count**
- [ ] **Report breaks down by tax rate**
- [ ] **Report breaks down by jurisdiction**
- [ ] **Each rate/jurisdiction row shows subtotals**
- [ ] **Export to CSV includes all transaction details**
- [ ] **CSV export filename includes quarter and year**
- [ ] **CSV totals match dashboard totals**
- [ ] **Can create/update sales tax periods**
- [ ] **Period status updates (open, calculated, filed, paid)**
- [ ] **Filing history table shows all periods**
- [ ] **Filing status badges display correctly**
- [ ] **Can mark period as filed with date**
- [ ] **Filed periods show filed date**
- [ ] **Sales tax settings store default rate**
- [ ] **Settings store tax jurisdiction**
- [ ] **Settings apply to new income transactions**
- [ ] **Tax exemption certificates can be added**
- [ ] **Exemptions show customer name and type**
- [ ] **Exemptions have expiration date tracking**
- [ ] **Mobile UI for sales tax toggle is one-tap**
- [ ] **Sales tax dashboard is mobile-responsive**
- [ ] **Quarterly report displays well on mobile**
- [ ] **All calculations accurate to 2 decimal places**

### Advanced Search & Filtering Success Criteria
- [ ] **Search interface accessible from main navigation**
- [ ] **Date range filter with presets (today, this week, this month, etc.)**
- [ ] **Custom date range picker for "from" and "to" dates**
- [ ] **Amount filters (min, max, exact)**
- [ ] **Transaction type filter (income, expense, transfer)**
- [ ] **Category multi-select filter**
- [ ] **Account multi-select filter**
- [ ] **Merchant partial name search (case-insensitive)**
- [ ] **Description text search (partial match)**
- [ ] **Notes text search (partial match)**
- [ ] **Tag filter with AND/OR logic**
- [ ] **Split transaction filter (show only splits)**
- [ ] **Tax deductible filter**
- [ ] **Taxable income filter**
- [ ] **Has notes filter**
- [ ] **Household member filter (who created)**
- [ ] **Search results display within 1 second**
- [ ] **Results show transaction count**
- [ ] **Results sortable by date, amount, description, category**
- [ ] **Sort order toggleable (ascending/descending)**
- [ ] **Pagination for large result sets**
- [ ] **Quick filter buttons for common searches**
- [ ] **"This Month" quick filter works correctly**
- [ ] **"Large Expenses" quick filter (>$100)**
- [ ] **"Tax Deductible" quick filter**
- [ ] **"Unreconciled" quick filter**
- [ ] **Active filters display as badges**
- [ ] **Can remove individual filter badges**
- [ ] **Clear All filters button resets all criteria**
- [ ] **Can save search as preset**
- [ ] **Save preset modal prompts for name and description**
- [ ] **Saved presets appear in sidebar**
- [ ] **Presets sortable by name, usage, favorites**
- [ ] **Can execute saved preset with one click**
- [ ] **Executing preset increments usage count**
- [ ] **Can favorite/unfavorite presets**
- [ ] **Favorites appear at top of preset list**
- [ ] **Can edit preset name and description**
- [ ] **Can delete saved presets**
- [ ] **Search history tracks last 20 searches**
- [ ] **Search history shows result count**
- [ ] **Can re-execute search from history**
- [ ] **Export search results to CSV**
- [ ] **CSV includes all relevant transaction fields**
- [ ] **CSV export filename includes date**
- [ ] **Export includes tags as comma-separated**
- [ ] **Accordion sections for filter categories**
- [ ] **Filter sections expand/collapse smoothly**
- [ ] **Mobile UI uses full screen for search**
- [ ] **Mobile search is touch-friendly**
- [ ] **Search respects user permissions (household filters)**
- [ ] **Empty search results show helpful message**
- [ ] **Search works with split transactions**
- [ ] **Can search within split transaction items**

### CSV Import with Manual Mapping Success Criteria
- [ ] **CSV upload accepts .csv files**
- [ ] **CSV parser handles different delimiters (comma, semicolon, tab)**
- [ ] **Parser handles files with/without header rows**
- [ ] **Can configure rows to skip at file start**
- [ ] **Headers display correctly in mapping interface**
- [ ] **Sample data shows first 5 rows for verification**
- [ ] **Auto-detect column mappings work for common formats**
- [ ] **Can manually map each CSV column to app field**
- [ ] **Can choose "Don't Import" for irrelevant columns**
- [ ] **Date format selector (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)**
- [ ] **Default account selector for all imported transactions**
- [ ] **Can save mapping as template for future imports**
- [ ] **Template name and description fields**
- [ ] **Saved templates appear in template selector**
- [ ] **Duplicate detection runs automatically during staging**
- [ ] **Duplicates flagged based on date, amount, and description similarity**
- [ ] **Similarity score displays as percentage (0-100%)**
- [ ] **Duplicate detection uses 7-day lookback window**
- [ ] **Exact amount match scores 40 points**
- [ ] **Date proximity scores up to 30 points**
- [ ] **Description similarity scores up to 30 points (Levenshtein)**
- [ ] **Matches >= 70% marked for review**
- [ ] **Staging shows Total, Needs Review, and Ready counts**
- [ ] **Review tab shows only flagged duplicates**
- [ ] **Can approve individual transactions for import**
- [ ] **Can skip individual transactions**
- [ ] **Approved transactions move to approved list**
- [ ] **Skipped transactions don't import**
- [ ] **Import button shows count of approved transactions**
- [ ] **Commit creates actual transactions in database**
- [ ] **Import history records all import attempts**
- [ ] **History shows filename, date, and row counts**
- [ ] **History shows imported, skipped, and duplicate counts**
- [ ] **History shows status (completed, failed, rolled back)**
- [ ] **Can rollback completed imports**
- [ ] **Rollback deletes all transactions from that import**
- [ ] **Rollback updates import status**
- [ ] **Imported transactions link back to import history**
- [ ] **Can view which import created a transaction**
- [ ] **Import templates track usage count**
- [ ] **Most-used templates appear first**
- [ ] **Can favorite templates**
- [ ] **Favorites appear at top of list**
- [ ] **Can edit template mappings**
- [ ] **Can delete templates**
- [ ] **Validation errors show on staging records**
- [ ] **Missing required fields flagged**
- [ ] **Invalid amounts flagged**
- [ ] **Invalid dates flagged**
- [ ] **Progress indicator shows current step (1-4)**
- [ ] **Can navigate back through wizard steps**
- [ ] **Back navigation preserves entered data**
- [ ] **Wizard completes with success message**
- [ ] **Import completes within 30 seconds for 100 transactions**
- [ ] **Large imports (1000+ transactions) process without timeout**
- [ ] **Duplicate detection accurate for common transaction types**
- [ ] **Mobile UI shows wizard in full-screen**
- [ ] **Column mapping readable on mobile**
- [ ] **Review interface usable on mobile**

### Audit Log & Version History Success Criteria
- [ ] **All transaction updates create version snapshots automatically**
- [ ] **Version number increments with each change**
- [ ] **Version history accessible from transaction details**
- [ ] **Version list shows version number, date, user, and change summary**
- [ ] **Current version clearly marked in version list**
- [ ] **Can view full transaction data for any version**
- [ ] **Can select two versions to compare side-by-side**
- [ ] **Comparison shows field-by-field differences**
- [ ] **Comparison highlights added (green) and removed (red) values**
- [ ] **Can revert to any previous version with confirmation**
- [ ] **Reverting creates a new version (doesn't delete history)**
- [ ] **Revert operation logged in audit trail**
- [ ] **Audit log shows all actions (create, update, delete, restore)**
- [ ] **Audit log displays user who made each change**
- [ ] **Audit log shows timestamp for each action**
- [ ] **Audit log shows which fields were changed**
- [ ] **Audit log shows before/after values**
- [ ] **Can view audit log in transaction details**
- [ ] **Recent activity feed shows household-wide changes**
- [ ] **Activity feed displays user avatar and name**
- [ ] **Activity feed shows relative time (2 hours ago, yesterday, etc.)**
- [ ] **Activity feed groups recent actions**
- [ ] **Can filter activity feed by action type**
- [ ] **Can filter activity feed by user**
- [ ] **Can filter activity feed by entity type**
- [ ] **Soft delete preserves transaction data**
- [ ] **Deleted transactions don't appear in normal lists**
- [ ] **Can restore soft-deleted transactions**
- [ ] **Restore operation logged in audit trail**
- [ ] **IP address captured for audit entries**
- [ ] **User agent captured for audit entries**
- [ ] **Audit log entries are immutable (can't be edited)**
- [ ] **Version history loads within 2 seconds**
- [ ] **Comparison modal loads instantly**
- [ ] **Activity feed loads within 2 seconds**
- [ ] **Audit log respects household permissions**
- [ ] **Users can only view versions they have permission to see**
- [ ] **Revert requires edit permission**
- [ ] **Version history works with split transactions**
- [ ] **Tags and custom fields included in version snapshots**
- [ ] **Mobile UI for version history is touch-friendly**
- [ ] **Mobile comparison view shows differences clearly**
- [ ] **Activity feed updates in real-time for households**
- [ ] **Empty version history shows helpful message**
- [ ] **Error messages are clear and helpful**

---

## 🎯 Conclusion

This comprehensive plan transforms your spreadsheet-based financial management into a **transaction-first, mobile-optimized** web application designed for **maximum ease of data entry**. The core philosophy prioritizes getting transaction data into the system as quickly and effortlessly as possible.

### Key Design Principles:
- **Speed First** - Primary goal of sub-10-second transaction entry
- **Dark Mode First** - OLED-friendly dark theme optimized for reduced eye strain and battery efficiency
- **Intelligence Built-In** - Smart categorization and auto-complete reduce manual work
- **One-Screen Operations** - No deep menu navigation required for common tasks
- **Context-Aware** - App learns patterns and suggests appropriate transactions
- **Minimal Taps** - Every interaction optimized for speed and efficiency
- **Bill Tracking** - Bills stay visible until paid, with automatic payment detection

### Major Benefits Over Current Spreadsheet:
- **Instant Entry** - Log transactions in seconds, not minutes
- **Dark Mode Optimized** - Beautiful OLED-friendly dark theme reduces eye strain and saves battery on mobile devices
- **Smart Suggestions** - Automatic categorization based on merchant history and patterns  
- **Custom Automation Rules** - Define your own rules to auto-categorize transactions based on any criteria (merchant, amount, description)
- **Test Before Apply** - Preview which transactions match your rules before saving them
- **Zero Manual Categorization** - Set up rules once and let transactions categorize themselves automatically
- **Usage-Based Intelligence** - Most-used accounts, categories, and merchants automatically appear at the top
- **Learning System** - App learns your habits and gets faster the more you use it
- **Multi-User Household Support** - You and your wife can both access and manage finances together
- **Activity Transparency** - See who entered what transaction for full household visibility
- **Role-Based Permissions** - Fine-grained control over who can do what
- **Personalized Experience** - Customize timezone, currency, date formats to match your preferences
- **Multi-Currency Support** - Choose from USD, EUR, GBP, CAD, JPY with proper formatting
- **Multi-Timezone Support** - Accurate time display regardless of your location
- **Accessibility Features** - High contrast mode, adjustable text size, reduced motion for better usability
- **Session Management** - See and control all logged-in devices from one place
- **Privacy Controls** - Choose who can see your profile and activity
- **GDPR Compliant** - Export all your data anytime in standard JSON format
- **Account Control** - Delete your account with 30-day grace period for safety
- **Profile Customization** - Add profile picture and display name for household identity
- **Proactive Notifications** - Never miss a bill or exceed a budget with smart reminders
- **Customizable Alerts** - Choose when and how you want to be notified
- **Bill Reminders** - Get reminded 3 days before, on due date, and if overdue
- **Budget Warnings** - Automatic alerts when approaching or exceeding budget limits
- **Visual Financial Insights** - Interactive charts and graphs for spending patterns, income vs expenses, and net worth tracking
- **Mobile-Optimized Charts** - Touch-friendly visualizations designed specifically for smartphone viewing
- **Real-Time Reporting** - Charts and reports update instantly as new transactions are added
- **Split Transactions** - Divide single purchases across multiple categories for accurate budget tracking
- **Flexible Splitting** - Split by exact amounts or percentages with auto-distribute functionality
- **Convert Anytime** - Transform regular transactions into splits or merge splits back to single category
- **Calendar Planning View** - Visual monthly/weekly calendar showing all transactions, bills, and upcoming expenses
- **Date-Based Navigation** - Quick jump to today, tomorrow, payday, or any custom date
- **Bill Due Date Visibility** - Never miss a payment with color-coded bill indicators on calendar
- **Spending Patterns** - See spending habits and patterns in calendar format
- **Flexible Tagging System** - Tag transactions for custom organization (vacation, tax-deductible, reimbursable, etc.)
- **Tag-Based Searching** - Find all transactions with specific tags instantly
- **Custom Data Fields** - Add your own fields to track project names, clients, warranty info, or any custom data
- **Multiple Field Types** - Text, number, date, boolean, select dropdowns, and multi-select options
- **Tax Preparation Ready** - Automatic categorization of deductible expenses for Schedule C, Schedule A, and more
- **IRS Form Mapping** - Budget categories map directly to tax form line items for easy filing
- **Partial Deductions** - Handle partially deductible expenses (50% meals, mixed-use vehicle, home office)
- **Year-End Reports** - Generate complete tax reports with one click, export to CSV for your accountant
- **Sales Tax Tracking** - Mark income as taxable and track sales tax collected for quarterly filing
- **Quarterly Tax Reports** - Automatically calculate taxable income and tax collected for each quarter
- **Multi-Rate Support** - Handle different tax rates and jurisdictions for varying income types
- **Tax Filing Management** - Track filing status and payment confirmation for each tax period
- **Advanced Search & Filtering** - Find any transaction quickly with powerful multi-criteria search
- **Saved Search Presets** - Save common searches and reuse them with one click
- **Smart Quick Filters** - One-tap access to frequent searches (large expenses, tax deductible, unreconciled)
- **Search History** - Revisit recent searches without rebuilding filter criteria
- **Export Search Results** - Download filtered transactions as CSV for analysis or reporting
- **Complete Audit Trail** - Every change tracked with who, what, when for full accountability
- **Version History** - See all past versions of any transaction with complete change history
- **Time Travel** - Revert transactions to any previous version with one click
- **Side-by-Side Comparison** - Compare any two versions to see exactly what changed
- **Soft Delete with Restore** - Never permanently lose data, restore deleted transactions anytime
- **Household Transparency** - Activity feed shows all changes made by household members in real-time
- **Error Recovery** - Made a mistake? Revert to the correct version instantly
- **CSV Import** - Import transactions from any bank or credit card with flexible column mapping
- **Smart Duplicate Detection** - Automatically identify and skip duplicate transactions using algorithmic pattern matching
- **Import Templates** - Save column mappings for your banks and reuse with one click
- **Preview Before Import** - Review and approve transactions before committing to database
- **Import Rollback** - Made a mistake? Completely undo any import with one click
- **Import History** - Complete audit trail of all imports with filename, dates, and counts
- **Multi-Account Made Simple** - Account switching and transfers with minimal friction
- **Real-Time Feedback** - See budget impact immediately as you enter transactions
- **Automatic Bill Tracking** - Bills never fall off until marked paid, auto-detection of payments
- **Overdue Bill Management** - Clear visibility of late payments with day counts
- **Smart Debt Payoff** - Toggle between snowball and avalanche methods with side-by-side comparison
- **Debt Strategy Intelligence** - Automatic extra payment allocation based on chosen method
- **Debt Payoff Journey Tracking** - Track progress from start date with visual progress bars and momentum indicators
- **Debt Milestones** - Automatic notifications at 25%, 50%, 75% completion with achievement history
- **Debt Payoff Projections** - Estimated debt-free date based on actual payment performance
- **Milestone Celebrations** - Get notified when reaching savings goals
- **Spending Summaries** - Weekly and monthly spending reports delivered automatically
- **Offline Capability** - Enter transactions anywhere, sync when connected
- **Voice Input** - Hands-free transaction entry while driving or shopping
- **Mobile Optimized** - Designed specifically for one-handed smartphone use

### Speed Optimizations:
1. **Quick Templates** - One-tap entry for coffee, gas, groceries, parking
2. **Smart Auto-Complete** - Learns your merchants and suggests as you type
3. **Usage-Based Sorting** - Your most-used items automatically appear first
4. **Recent Transaction Repeat** - Duplicate yesterday's coffee purchase in 2 taps
5. **Contextual Suggestions** - Morning = coffee suggestions, Evening = dinner
6. **Bulk Import** - Process entire bank statements with auto-categorization
7. **Transfer Shortcuts** - Pre-configured quick transfers between favorite accounts (learned from usage)
8. **Automatic Bill Detection** - App recognizes bill payments and marks them automatically
9. **Bill Payment Shortcuts** - Pay overdue bills directly from notification/dashboard
10. **Proactive Reminders** - Never forget a bill or budget check with smart notifications
11. **Adaptive Learning** - App gets faster as it learns your unique spending patterns

### Success Metrics:
- **Primary Goal**: Enter any transaction in under 10 seconds
- **Stretch Goal**: Repeat transactions in under 5 seconds  
- **User Experience**: 90% of transactions auto-categorize correctly
- **Mobile Performance**: App launches in under 2 seconds

The application will eliminate the friction of financial tracking, making it so easy to log transactions that it becomes a natural habit rather than a chore. By focusing on speed and intelligence, you'll capture more accurate financial data with significantly less effort.

**Perfect for household collaboration** - You and your wife can both use the app simultaneously with full transparency about who entered what. The activity feed shows all changes in real-time, and role-based permissions ensure everyone has the appropriate level of access. No more "did you enter that grocery transaction?" questions - you'll both always know exactly what's been recorded.

**Ready for daily use by you and your wife within 14 weeks**, providing a transformative upgrade from spreadsheet management while maintaining all the financial calculations and insights you depend on.
