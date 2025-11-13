# Settings Page - Comprehensive Implementation Plan

**Created:** 2025-11-13
**Status:** Ready to Implement
**Priority:** High - Consolidates scattered settings into unified page

---

## Overview

Create a comprehensive Settings page at `/dashboard/settings` that consolidates all user, app, and system settings into one location with tabbed navigation. This will move existing settings pages (Notifications, Theme, Household) into the Settings page and remove them from the main sidebar.

---

## Goals

1. **Unified Experience** - All settings in one place
2. **Better UX** - Tabbed interface for easy navigation
3. **Cleaner Sidebar** - Remove clutter by consolidating settings
4. **Extensibility** - Easy to add new settings categories
5. **Theme Integration** - Full theme variable usage throughout

---

## Architecture

### Page Structure
```
/dashboard/settings
├── [tab] → URL param for active tab (e.g., /dashboard/settings?tab=profile)
└── Tabs:
    ├── Profile (email, username, password)
    ├── Preferences (currency, date format, defaults)
    ├── Financial (budget settings, fiscal year)
    ├── Notifications (moved from /dashboard/notifications)
    ├── Theme (moved from /dashboard/theme)
    ├── Household (moved from /dashboard/households or new)
    ├── Privacy & Security (sessions, data export, delete account)
    ├── Data Management (import/export preferences)
    └── Advanced (developer mode, experimental features)
```

### Tab Navigation Pattern
- Use shadcn/ui `Tabs` component
- URL params preserve tab state (shareable links)
- Responsive: horizontal tabs on desktop, dropdown on mobile
- Scroll to restore position on page reload

---

## Database Schema Changes

### New Table: `userSettings`

```typescript
export const userSettings = sqliteTable('user_settings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),

  // Preferences
  defaultCurrency: text('default_currency').default('USD'),
  dateFormat: text('date_format').default('MM/DD/YYYY'), // MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
  numberFormat: text('number_format').default('1,000.00'), // 1,000.00, 1.000,00, 1 000,00
  fiscalYearStart: integer('fiscal_year_start').default(1), // 1-12 (January = 1)
  defaultAccountId: text('default_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  startOfWeek: integer('start_of_week').default(0), // 0 = Sunday, 1 = Monday

  // Financial Preferences
  defaultBudgetMethod: text('default_budget_method').default('monthly'), // monthly, zero-based, 50/30/20
  budgetPeriod: text('budget_period').default('monthly'), // monthly, bi-weekly, weekly
  showCents: integer('show_cents', { mode: 'boolean' }).default(true),
  negativeNumberFormat: text('negative_number_format').default('-$100'), // -$100, ($100), $100-
  defaultTransactionType: text('default_transaction_type').default('expense'), // income, expense, ask
  autoCategorization: integer('auto_categorization', { mode: 'boolean' }).default(true),

  // Privacy & Security
  sessionTimeout: integer('session_timeout').default(30), // minutes of inactivity
  dataRetentionYears: integer('data_retention_years').default(7), // years to keep transactions

  // Advanced
  developerMode: integer('developer_mode', { mode: 'boolean' }).default(false),
  enableAnimations: integer('enable_animations', { mode: 'boolean' }).default(true),
  experimentalFeatures: integer('experimental_features', { mode: 'boolean' }).default(false),

  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
```

**Note:** Theme settings already exist in separate table (keep as-is). Notification preferences already exist (keep as-is). Household settings are in separate tables (keep as-is).

### New Table: `userSessions` (for session management)

```typescript
export const userSessions = sqliteTable('user_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  sessionToken: text('session_token').notNull().unique(),
  deviceInfo: text('device_info'), // Browser, OS, etc.
  ipAddress: text('ip_address'),
  location: text('location'), // City, Country
  lastActive: text('last_active').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text('expires_at').notNull(),
});
```

---

## API Routes

### 1. User Settings CRUD

**`/api/user/settings/route.ts`**

```typescript
// GET - Get user settings (create defaults if not exists)
// POST - Update user settings (partial updates allowed)
// PATCH - Reset to defaults
```

**Fields:**
- All fields from `userSettings` table
- Returns merged with defaults if no record exists

### 2. Profile Updates

**`/api/user/profile/route.ts`** (NEW)

```typescript
// GET - Get user profile (name, email from betterAuthUser)
// PATCH - Update name
```

**`/api/user/email/route.ts`** (NEW)

```typescript
// POST - Update email
// Body: { newEmail, password }
// Validates password before allowing change
// Future: sends verification email
```

**`/api/user/password/route.ts`** (NEW)

```typescript
// POST - Change password
// Body: { currentPassword, newPassword, confirmPassword }
// Validates current password
// Enforces password requirements (min 8 chars)
```

### 3. Session Management

**`/api/user/sessions/route.ts`** (NEW)

```typescript
// GET - List all active sessions for user
// DELETE - Revoke session by ID (except current session)
```

**`/api/user/sessions/revoke-all/route.ts`** (NEW)

```typescript
// POST - Revoke all sessions except current
```

### 4. Data Export

**`/api/user/export/route.ts`** (NEW)

```typescript
// GET - Export all user data as JSON
// Includes: profile, transactions, accounts, budgets, bills, goals, debts
// Returns downloadable JSON file
```

**`/api/user/export/csv/route.ts`** (NEW)

```typescript
// GET - Export transactions as CSV
// Query params: startDate, endDate, accountId
```

### 5. Account Deletion

**`/api/user/delete-account/route.ts`** (NEW)

```typescript
// POST - Request account deletion
// Body: { password, confirmation: "DELETE MY ACCOUNT" }
// Validates password
// Soft delete with 30-day grace period (or hard delete immediately)
```

### 6. Move Existing Routes

**Keep these existing routes (just call them from settings):**
- `/api/user/settings/theme` - Already exists
- `/api/notification-preferences` - Already exists
- `/api/households/*` - Already exists

---

## Page Implementation

### Main Settings Page

**File:** `app/dashboard/settings/page.tsx`

**Structure:**
```typescript
'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';

// Tab Components
import { ProfileTab } from '@/components/settings/profile-tab';
import { PreferencesTab } from '@/components/settings/preferences-tab';
import { FinancialTab } from '@/components/settings/financial-tab';
import { NotificationsTab } from '@/components/settings/notifications-tab';
import { ThemeTab } from '@/components/settings/theme-tab';
import { HouseholdTab } from '@/components/settings/household-tab';
import { PrivacyTab } from '@/components/settings/privacy-tab';
import { DataTab } from '@/components/settings/data-tab';
import { AdvancedTab } from '@/components/settings/advanced-tab';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'preferences', label: 'Preferences', icon: Settings },
  { id: 'financial', label: 'Financial', icon: DollarSign },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'household', label: 'Household', icon: Users },
  { id: 'privacy', label: 'Privacy & Security', icon: Lock },
  { id: 'data', label: 'Data Management', icon: Database },
  { id: 'advanced', label: 'Advanced', icon: Code },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'profile';

  const handleTabChange = (tab: string) => {
    router.push(`/dashboard/settings?tab=${tab}`);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account, preferences, and application settings
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* Desktop: Horizontal Tabs */}
          <TabsList className="hidden lg:flex w-full justify-start bg-elevated border-border overflow-x-auto">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 data-[state=active]:bg-card"
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden xl:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Mobile: Dropdown */}
          <div className="lg:hidden mb-4">
            <Select value={activeTab} onValueChange={handleTabChange}>
              <SelectTrigger className="w-full bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABS.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    <div className="flex items-center gap-2">
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tab Content */}
          <Card className="border-border bg-card p-6">
            <TabsContent value="profile">
              <ProfileTab />
            </TabsContent>
            <TabsContent value="preferences">
              <PreferencesTab />
            </TabsContent>
            <TabsContent value="financial">
              <FinancialTab />
            </TabsContent>
            <TabsContent value="notifications">
              <NotificationsTab />
            </TabsContent>
            <TabsContent value="theme">
              <ThemeTab />
            </TabsContent>
            <TabsContent value="household">
              <HouseholdTab />
            </TabsContent>
            <TabsContent value="privacy">
              <PrivacyTab />
            </TabsContent>
            <TabsContent value="data">
              <DataTab />
            </TabsContent>
            <TabsContent value="advanced">
              <AdvancedTab />
            </TabsContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
```

---

## Tab Components Implementation

### Tab 1: Profile

**File:** `components/settings/profile-tab.tsx`

**Features:**
- Display current name, email
- Form to update name
- Form to update email (requires password)
- Form to change password (current, new, confirm)
- Profile picture upload placeholder (future)

**UI Layout:**
```
┌─────────────────────────────────────┐
│ Profile Information                 │
├─────────────────────────────────────┤
│ Full Name: [________] [Update]      │
│ Email: [________] [Update]          │
│   (requires password confirmation)   │
├─────────────────────────────────────┤
│ Change Password                     │
│ Current Password: [________]        │
│ New Password: [________]            │
│ Confirm Password: [________]        │
│ [Change Password]                   │
└─────────────────────────────────────┘
```

**Validation:**
- Email: valid format, not already taken
- Password: min 8 chars, confirmation match
- Current password: verified before changes

### Tab 2: Preferences

**File:** `components/settings/preferences-tab.tsx`

**Features:**
- Default Currency (dropdown: USD, EUR, CAD, GBP, etc.)
- Date Format (dropdown: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
- Number Format (dropdown: 1,000.00, 1.000,00, 1 000,00)
- Fiscal Year Start (dropdown: January - December)
- Default Account (dropdown: load from user's accounts)
- Start of Week (toggle: Sunday / Monday)
- Auto-save on change

**UI Layout:**
```
┌─────────────────────────────────────┐
│ App Preferences                     │
├─────────────────────────────────────┤
│ Default Currency: [USD ▼]           │
│ Date Format: [MM/DD/YYYY ▼]         │
│ Number Format: [1,000.00 ▼]         │
│ Fiscal Year Start: [January ▼]     │
│ Default Account: [Checking ▼]       │
│ Start of Week: [○ Sunday ● Monday]  │
└─────────────────────────────────────┘
```

### Tab 3: Financial

**File:** `components/settings/financial-tab.tsx`

**Features:**
- Default Budget Method (monthly, zero-based, 50/30/20)
- Budget Period (monthly, bi-weekly, weekly)
- Show Cents (toggle)
- Negative Number Format (-$100, ($100), $100-)
- Default Transaction Type (income, expense, ask)
- Auto-categorization (toggle: enable rules engine)

**UI Layout:**
```
┌─────────────────────────────────────┐
│ Financial Settings                  │
├─────────────────────────────────────┤
│ Budget Method: [Monthly ▼]          │
│ Budget Period: [Monthly ▼]          │
│ Show Cents: [○ Hide ● Show]         │
│ Negative Format: [-$100 ▼]          │
│ Default Transaction: [Expense ▼]    │
│ Auto-categorization: [✓ Enabled]    │
└─────────────────────────────────────┘
```

### Tab 4: Notifications

**File:** `components/settings/notifications-tab.tsx`

**Features:**
- **Move existing `/dashboard/notifications` page content here**
- Notification preferences (already implemented)
- Email notifications toggle
- In-app notifications toggle
- Per-notification-type settings:
  - Bill reminders
  - Budget warnings
  - Low balance alerts
  - Goal milestones
  - Debt payoff reminders
  - Budget reviews
  - Household activity
  - Transfer suggestions
  - Import completion
  - System updates

**Implementation:**
- Import and reuse existing `NotificationSettings` component
- Keep existing API routes (`/api/notification-preferences`)
- No changes to functionality, just location

### Tab 5: Theme

**File:** `components/settings/theme-tab.tsx`

**Features:**
- **Move existing `/dashboard/theme` page content here**
- Theme selector with 7 themes
- Preview cards
- Apply theme button

**Implementation:**
- Import and reuse existing theme selection component
- Keep existing API route (`/api/user/settings/theme`)
- No changes to functionality, just location

### Tab 6: Household

**File:** `components/settings/household-tab.tsx`

**Features:**
- Display current household info
- List household members with roles
- Invite new members (admin only)
- Edit member permissions (admin only)
- Leave household button
- Create new household (if not in one)

**UI Layout:**
```
┌─────────────────────────────────────┐
│ Household: "The Smiths"             │
├─────────────────────────────────────┤
│ Members:                            │
│ • John Smith (Owner)                │
│ • Jane Smith (Admin)    [Edit]      │
│ • Kid Smith (Viewer)    [Edit]      │
│                                     │
│ [+ Invite Member] (admin only)      │
│ [Leave Household]                   │
└─────────────────────────────────────┘
```

**Implementation:**
- Use existing household API routes
- Integrate with `HouseholdSelector` component
- Show household activity log (optional)

### Tab 7: Privacy & Security

**File:** `components/settings/privacy-tab.tsx`

**Features:**

**Section 1: Active Sessions**
- List all active sessions:
  - Device info (browser, OS)
  - IP address
  - Location (city, country)
  - Last active timestamp
  - "Current Session" badge
  - Revoke button (except current)
- "Revoke All Other Sessions" button

**Section 2: Session Settings**
- Auto-logout after inactivity (dropdown: 15, 30, 60 mins, Never)

**Section 3: Data Export**
- "Export All Data (JSON)" button - downloads complete data
- "Export Transactions (CSV)" button - prompts for date range

**Section 4: Account Deletion**
- Warning box explaining consequences
- "Delete My Account" button (requires password + typing "DELETE MY ACCOUNT")

**UI Layout:**
```
┌─────────────────────────────────────┐
│ Active Sessions                     │
├─────────────────────────────────────┤
│ ● Chrome on macOS (Current)         │
│   IP: 192.168.1.1                   │
│   Last active: 2 minutes ago        │
│                                     │
│ ● Safari on iPhone                  │
│   IP: 10.0.0.5         [Revoke]     │
│   Last active: 1 hour ago           │
│                                     │
│ [Revoke All Other Sessions]         │
├─────────────────────────────────────┤
│ Session Timeout: [30 minutes ▼]     │
├─────────────────────────────────────┤
│ Data Export                         │
│ [Export All Data (JSON)]            │
│ [Export Transactions (CSV)]         │
├─────────────────────────────────────┤
│ Danger Zone                         │
│ ⚠ Delete Account (irreversible)     │
│ [Delete My Account]                 │
└─────────────────────────────────────┘
```

### Tab 8: Data Management

**File:** `components/settings/data-tab.tsx`

**Features:**
- Default import template (dropdown)
- Auto-backup settings (future)
- Data retention policy (years to keep transactions)
- Clear cache button
- Reset app data button (with confirmation)

**UI Layout:**
```
┌─────────────────────────────────────┐
│ Import Settings                     │
│ Default Template: [None ▼]          │
├─────────────────────────────────────┤
│ Data Retention                      │
│ Keep transactions for: [7 years ▼]  │
│ (Older transactions auto-archived)  │
├─────────────────────────────────────┤
│ Maintenance                         │
│ [Clear Cache]                       │
│ [Reset App Data]                    │
└─────────────────────────────────────┘
```

### Tab 9: Advanced

**File:** `components/settings/advanced-tab.tsx`

**Features:**
- Developer Mode toggle (shows IDs, debug info)
- Enable Animations toggle
- Experimental Features toggle
- App version info
- Database statistics (# of transactions, accounts, etc.)

**UI Layout:**
```
┌─────────────────────────────────────┐
│ Developer Settings                  │
│ Developer Mode: [✓ Enabled]         │
│ Enable Animations: [✓ Enabled]      │
│ Experimental Features: [  Disabled] │
├─────────────────────────────────────┤
│ App Information                     │
│ Version: 1.0.0                      │
│ Database Size: 12.5 MB              │
│ Total Transactions: 1,234           │
│ Total Accounts: 5                   │
└─────────────────────────────────────┘
```

---

## Navigation Updates

### Remove from Sidebar

**File:** `components/navigation/sidebar.tsx` AND `mobile-nav.tsx`

**Remove these items from navSections:**
```typescript
// REMOVE from Settings section:
{ label: 'Notifications', href: '/dashboard/notifications', icon: <Bell /> },
{ label: 'Theme', href: '/dashboard/theme', icon: <Palette /> },

// Keep Settings link (but update it):
{ label: 'Settings', href: '/dashboard/settings', icon: <Settings /> },
```

**New Settings section:**
```typescript
{
  title: 'Settings',
  items: [
    { label: 'Categories', href: '/dashboard/categories', icon: <PieChart /> },
    { label: 'Merchants', href: '/dashboard/merchants', icon: <Store /> },
    { label: 'Rules', href: '/dashboard/rules', icon: <AlertCircle /> },
    { label: 'Settings', href: '/dashboard/settings', icon: <Settings /> }, // NEW unified settings
  ],
}
```

### Update UserMenu

**File:** `components/auth/user-menu.tsx`

**Keep Settings link** - now goes to `/dashboard/settings?tab=profile`
**Remove Theme link** - now in Settings

```typescript
// BEFORE
<DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
  <Settings className="w-4 h-4 mr-2" />
  Settings
</DropdownMenuItem>
<DropdownMenuItem onClick={() => router.push('/dashboard/theme')}>
  <Palette className="w-4 h-4 mr-2" />
  Theme
</DropdownMenuItem>

// AFTER
<DropdownMenuItem onClick={() => router.push('/dashboard/settings?tab=profile')}>
  <Settings className="w-4 h-4 mr-2" />
  Settings
</DropdownMenuItem>
```

---

## Migration Strategy

### Step 1: Database Schema
1. Create migration for `userSettings` table
2. Create migration for `userSessions` table
3. Run migrations

### Step 2: API Routes (Phase 1 - Profile)
1. Create `/api/user/settings/route.ts`
2. Create `/api/user/profile/route.ts`
3. Create `/api/user/email/route.ts`
4. Create `/api/user/password/route.ts`
5. Test all routes

### Step 3: Settings Page Shell
1. Create main `app/dashboard/settings/page.tsx`
2. Set up tabbed layout (empty tabs)
3. Add routing with URL params
4. Test tab navigation

### Step 4: Profile Tab (Phase 1)
1. Create `components/settings/profile-tab.tsx`
2. Implement name update form
3. Implement email update form
4. Implement password change form
5. Test all forms

### Step 5: Preferences Tab (Phase 1)
1. Create `components/settings/preferences-tab.tsx`
2. Implement currency, date, number format selectors
3. Implement fiscal year, default account selectors
4. Implement start of week toggle
5. Auto-save functionality
6. Test all options

### Step 6: Financial Tab (Phase 1)
1. Create `components/settings/financial-tab.tsx`
2. Implement budget method, period selectors
3. Implement display options (cents, negative format)
4. Implement default transaction type
5. Implement auto-categorization toggle
6. Test all options

### Step 7: Move Notifications Tab (Phase 1)
1. Create `components/settings/notifications-tab.tsx`
2. Copy content from `/dashboard/notifications/page.tsx`
3. Adapt to tab context
4. Test functionality
5. Remove old page after verification

### Step 8: Move Theme Tab (Phase 1)
1. Create `components/settings/theme-tab.tsx`
2. Copy content from `/dashboard/theme/page.tsx`
3. Adapt to tab context
4. Test theme switching
5. Remove old page after verification

### Step 9: Privacy Tab (Phase 2)
1. Create `/api/user/sessions/route.ts`
2. Create `/api/user/export/route.ts`
3. Create `/api/user/delete-account/route.ts`
4. Create `components/settings/privacy-tab.tsx`
5. Implement session management UI
6. Implement data export UI
7. Implement account deletion UI
8. Test all features

### Step 10: Household Tab (Phase 2)
1. Create `components/settings/household-tab.tsx`
2. Integrate existing household components
3. Display household info, members
4. Implement invite, leave functions
5. Test permissions and roles

### Step 11: Data Tab (Phase 3)
1. Create `components/settings/data-tab.tsx`
2. Implement import preferences
3. Implement data retention settings
4. Implement cache clear, reset data
5. Test all functions

### Step 12: Advanced Tab (Phase 3)
1. Create `components/settings/advanced-tab.tsx`
2. Implement developer mode toggle
3. Implement animation toggle
4. Implement experimental features toggle
5. Display app info, database stats
6. Test all toggles

### Step 13: Navigation Updates
1. Update `sidebar.tsx` - remove Notifications, Theme
2. Update `mobile-nav.tsx` - remove Notifications, Theme
3. Update `user-menu.tsx` - remove Theme link
4. Test navigation on desktop and mobile

### Step 14: Cleanup
1. Delete `/dashboard/notifications/page.tsx`
2. Delete `/dashboard/theme/page.tsx`
3. Update any hardcoded links to old pages
4. Update documentation
5. Final testing

---

## Theme Integration

**All components must use theme variables:**

### Colors
- `bg-background` - Page background
- `bg-card` - Card backgrounds
- `bg-elevated` - Tab backgrounds, hover states
- `border-border` - All borders
- `text-foreground` - Primary text
- `text-muted-foreground` - Labels, descriptions
- `text-[var(--color-primary)]` - Active tabs, links
- `text-[var(--color-success)]` - Success messages
- `text-[var(--color-error)]` - Error messages, danger zone
- `text-[var(--color-warning)]` - Warning messages

### Components
- Use shadcn/ui components throughout
- Apply theme classes consistently
- Test across all 7 themes before deployment

---

## Testing Checklist

### Functionality Testing
- [ ] All tabs load without errors
- [ ] URL params preserve tab state
- [ ] Profile updates work (name, email, password)
- [ ] Preferences save correctly and apply
- [ ] Financial settings save and affect app behavior
- [ ] Notification preferences work (moved from old page)
- [ ] Theme switching works (moved from old page)
- [ ] Household settings display and work
- [ ] Session management displays and revokes correctly
- [ ] Data export generates correct files
- [ ] Account deletion requires confirmation and password
- [ ] Navigation updates reflect removed pages
- [ ] Mobile responsive design works

### Security Testing
- [ ] Password required for sensitive changes (email, password)
- [ ] Current session cannot be revoked
- [ ] Account deletion requires strong confirmation
- [ ] API routes verify user ownership
- [ ] Session tokens validated correctly

### Performance Testing
- [ ] Page loads quickly (<2s)
- [ ] Tab switching is instant
- [ ] No unnecessary re-renders
- [ ] Forms submit without lag

### Theme Testing
- [ ] Works in Dark Green theme
- [ ] Works in Dark Pink theme
- [ ] Works in Dark Blue theme
- [ ] Works in Dark Turquoise theme
- [ ] Works in Light Bubblegum theme
- [ ] Works in Light Turquoise theme
- [ ] Works in Light Blue theme

---

## File Structure

```
unifiedledger/
├── app/
│   ├── dashboard/
│   │   └── settings/
│   │       └── page.tsx (NEW - Main settings page)
│   └── api/
│       └── user/
│           ├── settings/route.ts (NEW)
│           ├── profile/route.ts (NEW)
│           ├── email/route.ts (NEW)
│           ├── password/route.ts (NEW)
│           ├── sessions/
│           │   ├── route.ts (NEW)
│           │   └── revoke-all/route.ts (NEW)
│           ├── export/
│           │   ├── route.ts (NEW)
│           │   └── csv/route.ts (NEW)
│           └── delete-account/route.ts (NEW)
├── components/
│   ├── settings/ (NEW directory)
│   │   ├── profile-tab.tsx
│   │   ├── preferences-tab.tsx
│   │   ├── financial-tab.tsx
│   │   ├── notifications-tab.tsx
│   │   ├── theme-tab.tsx
│   │   ├── household-tab.tsx
│   │   ├── privacy-tab.tsx
│   │   ├── data-tab.tsx
│   │   └── advanced-tab.tsx
│   ├── navigation/
│   │   ├── sidebar.tsx (MODIFY)
│   │   └── mobile-nav.tsx (MODIFY)
│   └── auth/
│       └── user-menu.tsx (MODIFY)
├── lib/
│   └── db/
│       └── schema.ts (MODIFY - add userSettings, userSessions)
└── docs/
    └── SETTINGS-PAGE-IMPLEMENTATION-PLAN.md (this file)
```

---

## Implementation Phases Summary

### Phase 1 (Essential - 8-10 hours)
**Goal:** Basic settings page with profile, preferences, financial, notifications, and theme

1. Database schema (userSettings table)
2. API routes (settings, profile, email, password)
3. Main settings page with tabs
4. Profile tab (name, email, password)
5. Preferences tab (currency, date, number formats)
6. Financial tab (budget, display options)
7. Move notifications tab
8. Move theme tab
9. Update navigation (remove old links)

**Deliverables:**
- Functional settings page with 5 tabs
- Profile management working
- App preferences working
- Existing notifications/theme moved successfully
- Cleaner sidebar navigation

### Phase 2 (Important - 6-8 hours)
**Goal:** Privacy, security, and household management

1. userSessions table
2. Session management API routes
3. Data export API routes
4. Account deletion API route
5. Privacy & Security tab
6. Household tab
7. Testing and bug fixes

**Deliverables:**
- Session management UI
- Data export functionality
- Account deletion with safeguards
- Household settings consolidated

### Phase 3 (Nice to Have - 4-6 hours)
**Goal:** Data management and advanced features

1. Data management tab
2. Advanced tab
3. Import preferences
4. Developer mode
5. App statistics
6. Final polish and testing

**Deliverables:**
- Complete settings page with all 9 tabs
- Data management tools
- Advanced developer options
- Full documentation

---

## Success Criteria

### Must Have (Phase 1)
- ✅ Users can update profile (name, email, password)
- ✅ Users can set app preferences (currency, date format, etc.)
- ✅ Users can configure financial settings
- ✅ Notifications settings accessible from Settings page
- ✅ Theme selection accessible from Settings page
- ✅ Sidebar simplified (Notifications, Theme removed)
- ✅ All changes save and persist correctly
- ✅ Theme variables used throughout

### Should Have (Phase 2)
- ✅ Users can view and manage active sessions
- ✅ Users can export their data (JSON, CSV)
- ✅ Users can delete their account with safeguards
- ✅ Household settings integrated into Settings page

### Nice to Have (Phase 3)
- ✅ Data retention and cleanup options
- ✅ Developer mode for debugging
- ✅ App statistics and information
- ✅ Experimental features toggle

---

## Notes

### Design Principles
1. **Consistency** - Same patterns across all tabs
2. **Clarity** - Clear labels, helpful descriptions
3. **Safety** - Confirmations for destructive actions
4. **Responsiveness** - Works on mobile and desktop
5. **Performance** - Fast loading, instant tab switching

### User Experience
- Auto-save where possible (preferences, financial)
- Explicit save for critical changes (profile, password)
- Clear success/error messages
- Loading states for async operations
- Confirmation dialogs for destructive actions

### Future Enhancements
- Profile picture upload
- Two-factor authentication (2FA)
- Email verification
- OAuth provider management
- Scheduled data backups
- Advanced permission system

---

## Ready to Implement! 🚀

This plan provides a complete roadmap for building a comprehensive Settings page. Start with Phase 1 to get the essential features working, then progressively add Phase 2 and Phase 3 features.

**Recommended approach:** Implement Phase 1 first, test thoroughly, then move to Phase 2.
