# Features to implement

<!-- Add new feature requests below this line -->




---

## In Progress Features

### Household Data Isolation (CRITICAL - TOP PRIORITY)
**Status:** 85% Complete - Phase 0 (Settings Architecture) nearly complete
**Progress:** 4.5 of 5 phases complete

**Completed:**
- ✅ Phase 0.1: Database & Migration - Created 2 new tables (`user_household_preferences`, `household_settings`) with migrations
- ✅ Phase 0.2: API Endpoints - 6 new endpoints for user-per-household preferences and household settings
- ✅ Phase 0.3: UI Restructure - Redesigned settings page with 3-tier structure (User Settings / My Settings / Household Settings)
- ✅ Phase 0.4: Theme & Notifications (85% complete) - Core implementation complete, testing pending
  - ✅ Household Context Provider updated with preference loading and theme switching
  - ✅ Theme Provider simplified to use household context
  - ✅ Theme Tab migrated to per-household API
  - ✅ Notifications Tab completely migrated to per-household API
  - ✅ Household switcher updated with async handling and loading states
  - ✅ Migration helper utility created for automatic data migration (`lib/migrations/migrate-to-household-preferences.ts`)
  - ⏳ Manual testing pending
  - See: `docs/phase-0.4-implementation-plan.md`, `docs/phase-0.4-remaining-tasks-plan.md`

**Remaining Work:**
- ⏳ Phase 0.4: Manual testing and validation (~2-3 hours)
- ⏳ Phase 0.5: Testing & Polish (1 day) - Comprehensive testing and bug fixes
- ⏳ Phases 1-4: Data Isolation (5-9 days) - Add `household_id` to 20+ tables, update 90+ API endpoints, update 50+ components

**Implementation Plans:**
- Phase 0 progress: `docs/phase-0-implementation-progress.md` (detailed status)
- Phase 0 architecture: `docs/settings-three-tier-architecture.md`
- Phase 0.4 plan: `docs/phase-0.4-implementation-plan.md` (theme & notifications integration)
- Phases 1-4 plan: `docs/household-data-isolation-plan.md`

**Current Issue:**
All financial data (transactions, accounts, budgets, bills, goals, debts) is still shared across households. Settings architecture is ready and theme system works per-household, but data filtering by household is not yet implemented.

---

### Developer Mode Feature
**Status:** 50% Complete - Foundation built, integration pending
**Progress:** 2 of 4 tasks complete

**Completed:**
- ✅ Developer Mode Context Provider (`contexts/developer-mode-context.tsx`) - Global state management, database sync
- ✅ Reusable Components (`components/dev/`) - EntityIdBadge, DebugPanel, ApiTimingBadge
- ✅ Settings Integration - Functional toggle in Advanced tab
- ✅ Dashboard Layout - DeveloperModeProvider integrated

**Remaining Work:**
- ⏳ Integrate EntityIdBadge into pages (Transactions, Accounts, Bills, Categories, Merchants, Goals, Debts) (~1.5 hours)
- ⏳ Add navigation indicators (DEV badge in sidebar) (~15 mins)
- ⏳ Create developer tools panel (fixed bottom-right corner with debug info) (~30 mins)
- ⏳ Testing and polish (~30 mins)

**Implementation Plan:**
- See: `docs/developer-mode-implementation-plan.md` (detailed step-by-step plan)

**What Works Now:**
- Toggle developer mode from Settings > Advanced
- State persists across page reloads
- Components ready to use (EntityIdBadge, DebugPanel, ApiTimingBadge)
- All components conditionally render (no overhead when disabled)

**What's Missing:**
- ID badges not yet visible on any pages (components exist but not integrated)
- No visual indicator in navigation that developer mode is enabled
- No developer tools panel yet

---

## Incomplete Features

### Settings Page - Incomplete Features
**Status:** Partially implemented - some features not yet functional

**Profile Tab:**
- ❌ Email verification flow

**Data Management Tab:**
- ❌ Import preferences/default template selector (not in UI)
- ❌ Auto-backup settings (not in UI)

**Privacy & Security Tab:**
- ❌ Session timeout enforcement (setting exists but not enforced)
- ❌ GeoIP location lookup for sessions (shows null)

**Advanced Tab:**
- ⏳ Developer mode toggle works, but IDs/debug info not yet integrated into pages (50% complete - see "Developer Mode Feature" above)
- ❌ Experimental features flag doesn't unlock anything

**General Missing:**
- ❌ Two-factor authentication (2FA)
- ❌ OAuth provider management
- ❌ Scheduled data backups
- ❌ Advanced permission system (beyond basic roles)

---

### Self-Hosting Configuration (Future Feature)
**Status:** Not yet implemented

**Goal:** Make app completely self-hostable without .env file editing

**Concept:** Admin/System settings tab for configuring external services through UI:
- Email/SMTP configuration (self-hosted or API-based)
- OAuth providers
- Backup services
- File storage
- Notification services
- Currency exchange rate APIs

**Benefits:**
- No .env editing required
- True self-hosting capability
- Configuration changes without restart
- Credentials encrypted in database
- Multi-tenant support

**Implementation Notes:**
- Store encrypted in `systemSettings` or `serviceConfigurations` table
- Use environment variables as fallback
- Validate and test before saving
- Runtime configuration loading
- Admin-only access

---

## Completed Features

1. ✅ **Authentication Migration** - Complete Clerk to Better Auth migration with email/password
2. ✅ **Goals Dashboard Widget** - Overall progress display across all active savings goals
3. ✅ **Income Frequency Tracking** - Category-level frequency tracking for budget projections
4. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through optimization
5. ✅ **Unified Settings Page** - Comprehensive settings interface with 3-tier structure (User/My Settings/Household)
6. ✅ **Notifications Tab** - Granular per-notification-type channel selection (push/email)
7. ✅ **Avatar Upload** - Profile picture upload with display throughout app and initials fallback
8. ✅ **Household Management System** - Multi-household support with role-based permissions
9. ✅ **Household Tab-Based UI** - Tab-based household settings interface with member badges
10. ✅ **Reset App Data** - Settings reset with password confirmation and rate limiting
11. ✅ **Household Tab Switching** - Fixed household context not updating when switching tabs
12. ✅ **Household Settings Decoupling** - Sidebar dropdown and settings tabs operate independently
13. ✅ **Household Sort by Join Date** - Households ordered chronologically by when user joined
14. ✅ **Household Favorite Feature** - Star/favorite households to pin them to top of sidebar
