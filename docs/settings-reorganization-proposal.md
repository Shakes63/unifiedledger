# Settings Reorganization Proposal

## Current Structure Analysis

### Current Issues Identified:
1. **Household section mixes administration with configuration** - Members management (administrative) is grouped with Preferences/Financial (configuration)
2. **Data Management placement is confusing** - Backup settings, import templates, and cache clearing seem user-specific but are in household settings
3. **Unclear distinction** - The difference between "My Settings" (personal per-household) and "Household Settings" (shared) could be clearer
4. **Members management is buried** - A major feature (household management) is just one tab among many settings

## Proposed New Structure

### Top-Level Organization: 2 Main Sections

```
┌─────────────────────────────────────────────────────────────┐
│  Settings                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Account]  [Households]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Section 1: Account Settings (User-Level, Global)
**Purpose:** Personal account settings that apply globally across all households

**Tabs:**
1. **Profile** (existing)
   - Name, email, password
   - Avatar
   - Email verification

2. **Preferences** (consolidated from "My Settings > Preferences")
   - Currency, date format, number format
   - Default account
   - First day of week
   - *Note: These become global user preferences*

3. **Privacy & Security** (existing)
   - Sessions management
   - Data export
   - Account deletion
   - Two-factor authentication

4. **Data Management** (moved from Household Settings)
   - Data retention policies
   - Backup settings & history
   - Import templates & default template
   - Cache management
   - Reset app data
   - *Rationale: These are user-level operations, not household-specific*

5. **Advanced** (existing)
   - Developer mode
   - Animations toggle
   - Experimental features
   - App info
   - Database statistics

6. **Admin** (conditional, existing)
   - System administration

---

### Section 2: Households (New Dedicated Section)
**Purpose:** Manage households and their shared settings

**Structure:** Two-tier navigation
- **Top Level:** Household selector (tabs for each household + "Create New")
- **Second Level:** Tabs for each selected household

**For Each Household:**

#### Tab 1: Members & Access
**Purpose:** All household administration and member management
- Members list with roles
- Invite members
- Manage permissions
- Leave household
- Rename household (owner only)
- Delete household (owner only)
- Pending invitations

#### Tab 2: Household Preferences
**Purpose:** Shared configuration settings
- Fiscal year start month
- *Future: Household name, description, timezone*

#### Tab 3: Financial Settings
**Purpose:** Shared financial configuration
- Default budget method
- Budget period
- Auto-categorization toggle
- *Future: Default categories, shared merchants*

#### Tab 4: Personal Preferences (per household)
**Purpose:** Your personal settings for THIS household
- Theme (moved from "My Settings")
- Notifications (moved from "My Settings")
- Financial display options (moved from "My Settings > Financial")
  - Show cents
  - Negative number format
  - Default transaction type

---

## Visual Comparison

### Current Structure:
```
Settings
├── User Settings
│   ├── Profile
│   ├── Privacy & Security
│   └── Advanced
├── My Settings (per household)
│   ├── Preferences
│   ├── Financial
│   ├── Theme
│   └── Notifications
└── Household Settings (shared)
    ├── Preferences
    ├── Financial
    ├── Data Management  ← Confusing placement
    └── Members          ← Buried administrative feature
```

### Proposed Structure:
```
Settings
├── Account (global user settings)
│   ├── Profile
│   ├── Preferences      ← Global preferences
│   ├── Privacy & Security
│   ├── Data Management  ← Moved here (user-level)
│   ├── Advanced
│   └── Admin (conditional)
│
└── Households (household management)
    └── [Household Selector Tabs]
        └── For each household:
            ├── Members & Access      ← Prominent admin section
            ├── Household Preferences ← Shared config
            ├── Financial Settings    ← Shared financial config
            └── Personal Preferences  ← Your per-household settings
```

---

## Key Improvements

### 1. Clearer Separation of Concerns
- **Account:** Everything about YOU (global)
- **Households:** Everything about HOUSEHOLDS (shared + your personal per-household)

### 2. Better Discoverability
- Household management is now a top-level section, not buried in settings
- Members & Access is the first tab when viewing a household (most important)

### 3. Logical Grouping
- Data Management belongs with user account operations
- Personal preferences (theme, notifications) are clearly per-household
- Shared settings are grouped together

### 4. Improved Navigation
- Two-tier structure: Select household → Configure household
- Clear visual hierarchy

---

## Migration Considerations

### Data Model Changes:
- **Preferences Tab:** Move from `user_household_preferences` to `user_settings` (make global)
  - Currency, date format, number format, default account, first day of week
- **Data Management:** Already in `user_settings`, just move UI location

### Component Changes:
1. Split `household-tab.tsx` into:
   - `household-members-tab.tsx` (Members & Access)
   - Keep `household-preferences-tab.tsx` (Household Preferences)
   - Keep `household-financial-tab.tsx` (Financial Settings)
   - Create `household-personal-tab.tsx` (Personal Preferences - combines Theme + Notifications + Financial display)

2. Create new `account-preferences-tab.tsx` (move from `preferences-tab.tsx`)

3. Move `data-tab.tsx` to Account section

### URL Structure:
- Current: `/dashboard/settings?section=user&tab=profile`
- Proposed: `/dashboard/settings?section=account&tab=profile`
- Proposed: `/dashboard/settings?section=households&household=<id>&tab=members`

---

## Alternative: Simpler Two-Section Approach

If the two-tier household navigation is too complex, we could simplify:

```
Settings
├── Account
│   ├── Profile
│   ├── Preferences (global)
│   ├── Privacy & Security
│   ├── Data Management
│   ├── Advanced
│   └── Admin
│
└── Households
    ├── [Household Selector]
    │
    └── Selected Household:
        ├── Members & Access
        ├── Settings (combines Preferences + Financial)
        └── My Preferences (Theme + Notifications + Display)
```

This reduces tabs but may make some settings harder to find.

---

## Recommendation

**Go with the full proposal** - The two-tier household navigation provides:
- Better organization
- Clearer mental model
- Easier to extend in the future
- Members management gets the prominence it deserves

The complexity is justified by the improved user experience and discoverability.

