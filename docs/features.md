# Features to implement

<!-- Add new feature requests below this line -->

---

## 🔄 In Progress: Unified Settings Page

**Status:** Planned - Ready to Implement
**Priority:** High
**Plan Document:** `docs/SETTINGS-PAGE-IMPLEMENTATION-PLAN.md`

### Overview
Create comprehensive Settings page at `/dashboard/settings` with tabbed interface consolidating all user, app, and system settings. Moves existing Notifications, Theme, and Household pages into Settings and removes them from sidebar.

### Features (3 Phases)

**Phase 1 (Essential):**
- Profile management (name, email, password)
- App preferences (currency, date format, fiscal year, defaults)
- Financial settings (budget method, display options, auto-categorization)
- Move Notifications settings into tab
- Move Theme selection into tab
- Update navigation (cleaner sidebar)

**Phase 2 (Important):**
- Session management (view/revoke active sessions)
- Privacy & Security (data export, account deletion)
- Household settings tab

**Phase 3 (Nice to Have):**
- Data management (import preferences, retention policies)
- Advanced settings (developer mode, experimental features)

### Database Changes
- New `userSettings` table for preferences
- New `userSessions` table for session management

### Navigation Updates
- Remove from sidebar: Notifications, Theme
- Keep in sidebar: Settings (now goes to unified page)
- UserMenu Settings link goes to `/dashboard/settings?tab=profile`

---

## Completed Features

1. ✅ **Authentication Migration (Clerk → Better Auth)** - Complete switchover to Better Auth (100% complete - all 8 phases done)
   - Custom UserMenu component with theme integration
   - Custom sign-in and sign-up pages
   - All 106 API routes updated
   - All client components updated
   - Clerk package removed
   - See `docs/BETTER-AUTH-MIGRATION-COMPLETE.md` for details
2. ✅ **Goals Dashboard Widget** - Shows overall progress across all active savings goals in dashboard stats
3. ✅ **Income Frequency Tracking** - Category-level frequency tracking (weekly/biweekly/monthly/variable) for accurate budget projections
4. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through query optimization and batch updates
