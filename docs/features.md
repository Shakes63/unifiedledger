# Features to Implement

**Add new feature requests below this line:**




---

## In Progress Features

### Experimental Features System
**Status:** 30% Complete - Phase 1 (Infrastructure) complete
**Progress:** 3 of 10 tasks complete

**Completed:**
- ✅ Experimental Features Context provider
- ✅ Feature flag helper with feature definitions (3 features: Quick Entry, Enhanced Search, Advanced Charts)
- ✅ FeatureGate component

**Remaining Work:**
- ⏳ Create ExperimentalBadge component
- ⏳ Update Advanced tab with feature list
- ⏳ Implement Quick Entry Mode feature
- ⏳ Implement Enhanced Search feature
- ⏳ Implement Advanced Charts feature
- ⏳ Testing
- ⏳ Documentation

**Implementation Plan:** `docs/experimental-features-implementation-plan.md`

---

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

## Incomplete Features

### Settings Page - Incomplete Features
**Status:** Partially implemented - some features not yet functional

**Profile Tab:**
- ✅ All features complete

**Privacy & Security Tab:**
- ✅ All features complete

**Data Management Tab:**
- ❌ Auto-backup settings (not in UI)

**Advanced Tab:**
- ⏳ Experimental features flag (IN PROGRESS - see above)

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

1. ✅ **Bill Frequency Expansion** - Added support for one-time, weekly, and biweekly bill frequencies (in addition to existing monthly, quarterly, semi-annual, and annual options)
2. ✅ **Developer Mode** - Debug utility with entity ID badges, DEV indicator, and developer tools panel with export/cache clearing
3. ✅ **Authentication Migration** - Complete Clerk to Better Auth migration with email/password
4. ✅ **Goals Dashboard Widget** - Overall progress display across all active savings goals
5. ✅ **Income Frequency Tracking** - Category-level frequency tracking for budget projections
6. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through optimization
7. ✅ **Unified Settings Page** - Comprehensive settings interface with 3-tier structure (User/My Settings/Household)
8. ✅ **Notifications Tab** - Granular per-notification-type channel selection (push/email)
9. ✅ **Avatar Upload** - Profile picture upload with display throughout app and initials fallback
10. ✅ **Household Management System** - Multi-household support with role-based permissions
11. ✅ **Household Tab-Based UI** - Tab-based household settings interface with member badges
12. ✅ **Reset App Data** - Settings reset with password confirmation and rate limiting
13. ✅ **Household Tab Switching** - Fixed household context not updating when switching tabs
14. ✅ **Household Settings Decoupling** - Sidebar dropdown and settings tabs operate independently
15. ✅ **Household Sort by Join Date** - Households ordered chronologically by when user joined
16. ✅ **Household Favorite Feature** - Star/favorite households to pin them to top of sidebar
17. ✅ **Session Timeout Enforcement** - Automatic logout after configurable inactivity period with Remember Me option
18. ✅ **Email Verification Flow** - Complete email verification system with verification on signup and email change flow
19. ✅ **GeoIP Location Lookup** - Session location display with country flags using ip-api.com geolocation
20. ✅ **Import Preferences** - Default CSV import template selection in Data Management settings with auto-load on import
