# Features to implement

<!-- Add new feature requests below this line -->




---

## In Progress Features

### Household Data Isolation (CRITICAL - TOP PRIORITY)
**Status:** 71% Complete - Phase 0 (Settings Architecture) partially implemented
**Progress:** 3 of 5 phases complete

**Completed:**
- ✅ Phase 0.1: Database & Migration - Created 2 new tables (`user_household_preferences`, `household_settings`) with migrations
- ✅ Phase 0.2: API Endpoints - 6 new endpoints for user-per-household preferences and household settings
- ✅ Phase 0.3: UI Restructure - Redesigned settings page with 2-tier structure (User Settings / Household Settings)

**Remaining Work:**
- ⏳ Phase 0.4: Theme & Notifications (1 day) - Update theme system and notification preferences to use new tables
- ⏳ Phase 0.5: Testing & Polish (1 day) - Comprehensive testing and bug fixes
- ⏳ Phases 1-4: Data Isolation (5-9 days) - Add `household_id` to 20+ tables, update 90+ API endpoints, update 50+ components

**Implementation Plans:**
- Phase 0 progress: `docs/phase-0-implementation-progress.md` (detailed status)
- Phase 0 architecture: `docs/settings-three-tier-architecture.md`
- Phases 1-4 plan: `docs/household-data-isolation-plan.md`

**Current Issue:**
All financial data (transactions, accounts, budgets, bills, goals, debts) is still shared across households. Settings architecture is ready, but data filtering by household is not yet implemented.

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
- ❌ Developer mode doesn't show IDs/debug info anywhere
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
5. ✅ **Unified Settings Page** - Comprehensive settings interface with 2-tier structure (User/Household)
6. ✅ **Notifications Tab** - Granular per-notification-type channel selection (push/email)
7. ✅ **Avatar Upload** - Profile picture upload with display throughout app and initials fallback
8. ✅ **Household Management System** - Multi-household support with role-based permissions
9. ✅ **Household Tab-Based UI** - Tab-based household settings interface with member badges
10. ✅ **Reset App Data** - Settings reset with password confirmation and rate limiting
11. ✅ **Household Tab Switching** - Fixed household context not updating when switching tabs
12. ✅ **Household Settings Decoupling** - Sidebar dropdown and settings tabs operate independently
13. ✅ **Household Sort by Join Date** - Households ordered chronologically by when user joined
14. ✅ **Household Favorite Feature** - Star/favorite households to pin them to top of sidebar
