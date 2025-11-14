# Settings Architecture - Three-Tier System

## Overview

**Three-Tier Settings Model:**
1. **User-Only Settings** - Follows user across ALL households (profile, security, accessibility)
2. **Household-Only Settings** - Shared by ALL members of household (currency, fiscal year, budget method)
3. **User-Per-Household Settings** - User can set different value for EACH household (theme, date format, notifications)

This allows maximum flexibility: Users can have different themes/preferences per household while the household still shares core financial settings.

---

## Settings Classification

### Tier 1: User-Only Settings
**Stored in:** `user_settings` table
**Scope:** Follows user across all households
**Example:** John has the same bio/timezone no matter which household he's viewing

**Settings:**
- **Profile:**
  - Display name
  - Email
  - Bio
  - Avatar
  - Timezone (user's local timezone)

- **Privacy & Security:**
  - Profile visibility (public/household/private)
  - Show activity in household feed
  - Allow analytics
  - Session timeout
  - Session management
  - Data export
  - Account deletion

- **Accessibility:**
  - Reduce motion
  - High contrast
  - Text size
  - Default household (which to show on login)

- **Advanced:**
  - Developer mode
  - Enable animations
  - Experimental features

---

### Tier 2: User-Per-Household Settings
**Stored in:** `user_household_preferences` table (NEW)
**Scope:** User can set different value for each household
**Example:** John uses Dark Green theme in "Family" household but Light Bubblegum in "Business" household

**Settings:**

**Preferences:**
- ✅ Date Format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
- ✅ Number Format (1,000.00 vs 1.000,00)
- ✅ Default Account (quick-select account for transactions)
- ✅ First Day of Week (Sunday/Monday)

**Financial:**
- ✅ Amount Display / Show Cents ($100 vs $100.00)
- ✅ Negative Number Format (-$100, ($100), $100-)
- ✅ Default Transaction Type (income/expense/transfer)

**Theme:**
- ✅ Active Theme (Dark Green, Dark Pink, Light Bubblegum, etc.)

**Notifications (ALL):**
- ✅ Bill Reminders (enabled, channels)
- ✅ Budget Warnings (enabled, channels)
- ✅ Budget Exceeded (enabled, channels)
- ✅ Budget Reviews (enabled, channels)
- ✅ Low Balance (enabled, channels)
- ✅ Savings Milestones (enabled, channels)
- ✅ Debt Milestones (enabled, channels)
- ✅ Weekly Summaries (enabled, channels)
- ✅ Monthly Summaries (enabled, channels)

**Why User-Per-Household?**
- User might want different themes per household (professional vs personal)
- User might want different date formats per household (if managing international households)
- User might want notifications for work household but not family household
- User might have different default accounts per household

---

### Tier 3: Household-Only Settings
**Stored in:** `household_settings` table
**Scope:** Shared by ALL members of household
**Example:** All members of "Neudorf Family" use USD currency and monthly budget period

**Settings:**

**Preferences:**
- ✅ Currency (USD, EUR, GBP, etc.)
- ✅ Currency Symbol ($, €, £, etc.)
- ✅ Time Format (12h/24h)
- ✅ Fiscal Year Start (month 1-12)

**Financial:**
- ✅ Default Budget Method (monthly, zero-based, 50/30/20)
- ✅ Budget Period (monthly, bi-weekly, weekly)
- ✅ Auto-Categorization Enabled (global toggle)

**Rules:**
- ✅ Categorization Rules (shared by household)

**Data Management:**
- ✅ Data Retention Years (7 years default)
- ✅ Auto-Cleanup Enabled
- ✅ Cache Strategy

**Why Household-Only?**
- Currency must be consistent for all household members (shared accounts)
- Budget method should be agreed upon by household
- Rules should apply consistently to all transactions
- Data retention is a household-wide policy decision

---

## Database Schema

### Table 1: user_settings (User-Only)

```typescript
export const userSettings = sqliteTable('user_settings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),

  // Profile
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  timezone: text('timezone').default('America/New_York'),

  // Privacy & Security
  profileVisibility: text('profile_visibility', {
    enum: ['public', 'household', 'private'],
  }).default('household'),
  showActivity: integer('show_activity', { mode: 'boolean' }).default(true),
  allowAnalytics: integer('allow_analytics', { mode: 'boolean' }).default(true),
  sessionTimeout: integer('session_timeout').default(30),

  // Accessibility
  reduceMotion: integer('reduce_motion', { mode: 'boolean' }).default(false),
  highContrast: integer('high_contrast', { mode: 'boolean' }).default(false),
  textSize: text('text_size', {
    enum: ['small', 'medium', 'large', 'x-large'],
  }).default('medium'),

  // Advanced
  developerMode: integer('developer_mode', { mode: 'boolean' }).default(false),
  enableAnimations: integer('enable_animations', { mode: 'boolean' }).default(true),
  experimentalFeatures: integer('experimental_features', { mode: 'boolean' }).default(false),

  // Default household preference
  defaultHouseholdId: text('default_household_id'),

  createdAt: text('created_at').default(new Date().toISOString()),
  updatedAt: text('updated_at').default(new Date().toISOString()),
});
```

### Table 2: user_household_preferences (User-Per-Household) - NEW

```typescript
export const userHouseholdPreferences = sqliteTable(
  'user_household_preferences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),

    // Preferences
    dateFormat: text('date_format', {
      enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
    }).default('MM/DD/YYYY'),
    numberFormat: text('number_format', {
      enum: ['en-US', 'en-GB', 'de-DE', 'fr-FR'],
    }).default('en-US'),
    defaultAccountId: text('default_account_id'),
    firstDayOfWeek: text('first_day_of_week', {
      enum: ['sunday', 'monday'],
    }).default('sunday'),

    // Financial
    showCents: integer('show_cents', { mode: 'boolean' }).default(true),
    negativeNumberFormat: text('negative_number_format').default('-$100'),
    defaultTransactionType: text('default_transaction_type').default('expense'),

    // Theme
    theme: text('theme').default('dark-mode'),

    // Notifications (all per-user-per-household)
    billRemindersEnabled: integer('bill_reminders_enabled', { mode: 'boolean' }).default(true),
    billRemindersChannels: text('bill_reminders_channels').default('["push","email"]'),

    budgetWarningsEnabled: integer('budget_warnings_enabled', { mode: 'boolean' }).default(true),
    budgetWarningsChannels: text('budget_warnings_channels').default('["push","email"]'),

    budgetExceededEnabled: integer('budget_exceeded_enabled', { mode: 'boolean' }).default(true),
    budgetExceededChannels: text('budget_exceeded_channels').default('["push","email"]'),

    budgetReviewEnabled: integer('budget_review_enabled', { mode: 'boolean' }).default(true),
    budgetReviewChannels: text('budget_review_channels').default('["push","email"]'),

    lowBalanceEnabled: integer('low_balance_enabled', { mode: 'boolean' }).default(true),
    lowBalanceChannels: text('low_balance_channels').default('["push","email"]'),

    savingsMilestonesEnabled: integer('savings_milestones_enabled', { mode: 'boolean' }).default(true),
    savingsMilestonesChannels: text('savings_milestones_channels').default('["push","email"]'),

    debtMilestonesEnabled: integer('debt_milestones_enabled', { mode: 'boolean' }).default(true),
    debtMilestonesChannels: text('debt_milestones_channels').default('["push","email"]'),

    weeklySummariesEnabled: integer('weekly_summaries_enabled', { mode: 'boolean' }).default(false),
    weeklySummariesChannels: text('weekly_summaries_channels').default('["email"]'),

    monthlySummariesEnabled: integer('monthly_summaries_enabled', { mode: 'boolean' }).default(true),
    monthlySummariesChannels: text('monthly_summaries_channels').default('["email"]'),

    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    // Composite unique constraint: one record per user per household
    userHouseholdUnique: uniqueIndex('idx_user_household_prefs_unique').on(
      table.userId,
      table.householdId
    ),
    userIdIdx: index('idx_user_household_prefs_user').on(table.userId),
    householdIdIdx: index('idx_user_household_prefs_household').on(table.householdId),
  })
);
```

### Table 3: household_settings (Household-Only)

```typescript
export const householdSettings = sqliteTable('household_settings', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull().unique(),

  // Preferences
  currency: text('currency').default('USD'),
  currencySymbol: text('currency_symbol').default('$'),
  timeFormat: text('time_format', {
    enum: ['12h', '24h'],
  }).default('12h'),
  fiscalYearStart: integer('fiscal_year_start').default(1), // 1-12

  // Financial
  defaultBudgetMethod: text('default_budget_method').default('monthly'),
  budgetPeriod: text('budget_period').default('monthly'),
  autoCategorization: integer('auto_categorization', { mode: 'boolean' }).default(true),

  // Data Management
  dataRetentionYears: integer('data_retention_years').default(7),
  autoCleanupEnabled: integer('auto_cleanup_enabled', { mode: 'boolean' }).default(false),
  cacheStrategy: text('cache_strategy').default('normal'),

  createdAt: text('created_at').default(new Date().toISOString()),
  updatedAt: text('updated_at').default(new Date().toISOString()),
}, (table) => ({
  householdIdIdx: index('idx_household_settings_household').on(table.householdId),
}));
```

---

## API Endpoints

### User-Only Settings
```
GET    /api/user/settings
PUT    /api/user/settings
PATCH  /api/user/settings
```

### User-Per-Household Settings
```
GET    /api/user/households/[householdId]/preferences
PUT    /api/user/households/[householdId]/preferences
PATCH  /api/user/households/[householdId]/preferences
```

### Household-Only Settings
```
GET    /api/households/[householdId]/settings
PUT    /api/households/[householdId]/settings  (requires admin/owner role)
PATCH  /api/households/[householdId]/settings  (requires admin/owner role)
```

---

## Settings Page UI Structure

### New Three-Section Layout

```
Settings Page
├── 🏠 HOUSEHOLD SETTINGS (Neudorf Household)
│   │   "Settings shared by all household members"
│   ├── Preferences (Currency, Time Format, Fiscal Year)
│   ├── Financial (Budget Method, Budget Period, Auto-Categorization)
│   ├── Rules (Categorization Rules)
│   ├── Data Management (Retention, Cleanup, Cache)
│   └── Members (Household Member Management)
│
├── 👤 MY PREFERENCES (for Neudorf Household)
│   │   "Your personal preferences for this household"
│   ├── Preferences (Date Format, Number Format, Default Account, Start of Week)
│   ├── Financial (Amount Display, Negative Format, Default Transaction Type)
│   ├── Theme (Active Theme)
│   └── Notifications (All notification settings with channels)
│
└── 🔧 USER SETTINGS (Personal)
    │   "Settings that follow you across all households"
    ├── Profile (Name, Email, Bio, Avatar, Timezone)
    ├── Privacy & Security (Visibility, Sessions, Data Export, Account Deletion)
    └── Accessibility & Advanced (Motion, Contrast, Text Size, Developer Mode)
```

### Visual Hierarchy

```
┌─────────────────────────────────────────────────────┐
│ Settings                                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 🏠 HOUSEHOLD SETTINGS (Neudorf Household)          │
│ Shared by all members                              │
│ [Preferences] [Financial] [Rules] [Data] [Members] │
│                                                     │
│ ─────────────────────────────────────────────────  │
│                                                     │
│ 👤 MY PREFERENCES (for Neudorf Household)          │
│ Your personal settings for this household          │
│ [Preferences] [Financial] [Theme] [Notifications]  │
│                                                     │
│ ─────────────────────────────────────────────────  │
│                                                     │
│ 🔧 USER SETTINGS (Personal)                        │
│ Follow you across all households                   │
│ [Profile] [Privacy & Security] [Accessibility]     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Migration Strategy

### Step 1: Create user_household_preferences table
```sql
CREATE TABLE user_household_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,

  -- Preferences
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  number_format TEXT DEFAULT 'en-US',
  default_account_id TEXT,
  first_day_of_week TEXT DEFAULT 'sunday',

  -- Financial
  show_cents INTEGER DEFAULT 1,
  negative_number_format TEXT DEFAULT '-$100',
  default_transaction_type TEXT DEFAULT 'expense',

  -- Theme
  theme TEXT DEFAULT 'dark-mode',

  -- Notifications (9 types * 2 fields each)
  bill_reminders_enabled INTEGER DEFAULT 1,
  bill_reminders_channels TEXT DEFAULT '["push","email"]',
  -- ... (repeat for all 9 notification types)

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(user_id, household_id)
);

CREATE INDEX idx_user_household_prefs_user ON user_household_preferences(user_id);
CREATE INDEX idx_user_household_prefs_household ON user_household_preferences(household_id);
```

### Step 2: Populate user_household_preferences
For each user's household membership, create preference record with user's current settings:

```sql
INSERT INTO user_household_preferences (
  id, user_id, household_id, date_format, number_format,
  first_day_of_week, show_cents, negative_number_format,
  default_transaction_type, theme,
  bill_reminders_enabled, bill_reminders_channels
  -- ... all other fields
)
SELECT
  lower(hex(randomblob(16))) as id,
  hm.user_id,
  hm.household_id,
  us.date_format,
  us.number_format,
  us.first_day_of_week,
  us.show_cents,
  us.negative_number_format,
  us.default_transaction_type,
  us.theme,
  np.bill_reminders_enabled,
  np.bill_reminders_channels
  -- ... all other fields
FROM household_members hm
INNER JOIN user_settings us ON us.user_id = hm.user_id
LEFT JOIN notification_preferences np ON np.user_id = hm.user_id
WHERE hm.is_active = 1;
```

### Step 3: Create household_settings table
```sql
CREATE TABLE household_settings (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL UNIQUE,

  -- Preferences
  currency TEXT DEFAULT 'USD',
  currency_symbol TEXT DEFAULT '$',
  time_format TEXT DEFAULT '12h',
  fiscal_year_start INTEGER DEFAULT 1,

  -- Financial
  default_budget_method TEXT DEFAULT 'monthly',
  budget_period TEXT DEFAULT 'monthly',
  auto_categorization INTEGER DEFAULT 1,

  -- Data Management
  data_retention_years INTEGER DEFAULT 7,
  auto_cleanup_enabled INTEGER DEFAULT 0,
  cache_strategy TEXT DEFAULT 'normal',

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_household_settings_household ON household_settings(household_id);
```

### Step 4: Populate household_settings
For each household, use creator's settings as default:

```sql
INSERT INTO household_settings (
  id, household_id, currency, currency_symbol,
  time_format, fiscal_year_start, default_budget_method,
  budget_period, auto_categorization, data_retention_years
)
SELECT
  lower(hex(randomblob(16))) as id,
  h.id as household_id,
  us.currency,
  us.currency_symbol,
  us.time_format,
  us.fiscal_year_start,
  us.default_budget_method,
  us.budget_period,
  us.auto_categorization,
  us.data_retention_years
FROM households h
INNER JOIN user_settings us ON us.user_id = h.created_by;
```

### Step 5: Clean up user_settings table
Remove fields that moved to other tables:
- Move to user_household_preferences: dateFormat, numberFormat, firstDayOfWeek, showCents, negativeNumberFormat, defaultTransactionType, theme, defaultAccountId
- Move to household_settings: currency, currencySymbol, timeFormat, fiscalYearStart, defaultBudgetMethod, budgetPeriod, autoCategorization, dataRetentionYears

(Keep in user_settings temporarily until code is updated, then drop in final migration)

---

## Theme System Updates

### Current: User-level theme
```typescript
// Load theme from user_settings
const theme = userSettings.theme;
applyTheme(theme);
```

### New: User-per-household theme
```typescript
// Load theme from user_household_preferences
const prefs = await getUserHouseholdPreferences(userId, householdId);
const theme = prefs.theme;
applyTheme(theme);
```

### Switching Households
When user switches households, immediately load and apply that household's theme preference:

```typescript
function handleHouseholdSwitch(newHouseholdId: string) {
  setSelectedHouseholdId(newHouseholdId);

  // Load user's preferences for this household
  const prefs = await fetch(`/api/user/households/${newHouseholdId}/preferences`);
  const { theme } = await prefs.json();

  // Apply theme immediately
  applyTheme(theme);

  // Reload data for new household
  refreshData();
}
```

---

## Benefits of Three-Tier System

### Flexibility
- Users can have different themes per household (professional vs casual)
- Users can have different notification preferences per household
- Users can have different default accounts per household

### Collaboration
- Household still shares currency, budget method, rules
- Core financial settings remain consistent
- All members see same currency/fiscal year

### Personalization
- Each user gets their preferred theme
- Each user gets their preferred date format
- Each user controls their own notifications

### Example Scenario
**John is in 3 households:**

1. **"Neudorf Family"**
   - John's preferences: Dark Green theme, MM/DD/YYYY dates, all notifications ON
   - Household settings: USD currency, monthly budgets

2. **"Side Business LLC"**
   - John's preferences: Light Bubblegum theme, YYYY-MM-DD dates, only budget notifications
   - Household settings: USD currency, bi-weekly budgets

3. **"Investment Group"**
   - John's preferences: Dark Pink theme, DD/MM/YYYY dates, only milestone notifications
   - Household settings: EUR currency, monthly budgets

John switches between households and sees his customized experience for each!

---

## Implementation Checklist

### Database
- [ ] Create `user_household_preferences` table schema
- [ ] Create `household_settings` table schema
- [ ] Modify `user_settings` table schema
- [ ] Create migration to add tables
- [ ] Create migration to populate from existing data
- [ ] Create indexes
- [ ] Update Drizzle schema file

### API Endpoints (New)
- [ ] `GET /api/user/households/[householdId]/preferences`
- [ ] `PUT /api/user/households/[householdId]/preferences`
- [ ] `PATCH /api/user/households/[householdId]/preferences`
- [ ] `GET /api/households/[householdId]/settings`
- [ ] `PUT /api/households/[householdId]/settings`
- [ ] `PATCH /api/households/[householdId]/settings`

### API Endpoints (Update)
- [ ] Update `GET /api/user/settings` (remove moved fields)
- [ ] Update `PUT /api/user/settings` (remove moved fields)

### Frontend Components
- [ ] Create three-section settings layout
- [ ] Household settings components (5 tabs)
- [ ] User-per-household preferences components (4 tabs)
- [ ] User settings components (3 tabs)
- [ ] Update household switcher to load preferences
- [ ] Update theme system to use user-per-household prefs

### Theme System
- [ ] Load theme from user_household_preferences
- [ ] Apply theme on household switch
- [ ] Clear user-level theme from user_settings

### Notification System
- [ ] Move notification preferences to user_household_preferences
- [ ] Update notification preference API
- [ ] Update notification sending to use per-household prefs

### Testing
- [ ] Test user-per-household preferences save/load
- [ ] Test household settings shared across members
- [ ] Test user settings remain global
- [ ] Test theme switching per household
- [ ] Test notifications per household
- [ ] Test migration of existing data

---

## Timeline

**Phase 0.1: Database & Migration** - 1.5 days
- Create tables, write migrations, test data migration

**Phase 0.2: API Endpoints** - 1.5 days
- Create all new endpoints, update existing ones, add authorization

**Phase 0.3: UI Restructure** - 2 days
- New three-section layout, refactor all settings components

**Phase 0.4: Theme & Notifications** - 1 day
- Update theme system, move notification prefs

**Phase 0.5: Testing & Polish** - 1 day
- End-to-end testing, bug fixes

**Total Estimated Time:** 7 days (updated from 5 days due to three-tier complexity)

---

**Document Version:** 2.0 (Three-Tier)
**Created:** 2025-11-14
**Updated:** 2025-11-14
**Status:** READY FOR IMPLEMENTATION
**Priority:** CRITICAL - Foundation for household data isolation
