# Features to Implement

**Add new feature requests below this line:**




---

## In Progress Features

### Household Data Isolation (CRITICAL - TOP PRIORITY)
**Status:** 80% Complete - Phase 0 (Settings Architecture) nearly complete
**Progress:** 4 of 5 phases complete
**Plan:** `docs/phase-0-implementation-progress.md`, `docs/household-data-isolation-plan.md`

**Completed:**
- ✅ Phase 0.1: Database & Migration
- ✅ Phase 0.2: API Endpoints
- ✅ Phase 0.3: UI Restructure
- ✅ Phase 0.4: Theme & Notifications (completed 2025-11-14)

**Remaining Work:**
- ⏳ Phase 0.5: Testing & Polish (1 day) - Automated tests and final polish
- ⏳ Phases 1-4: Data Isolation (5-9 days) - Add `household_id` to 20+ tables, update 90+ API endpoints

**Current Issue:** All financial data (transactions, accounts, budgets, bills, goals, debts) is still shared across households. Settings architecture ready, but data filtering by household not yet implemented.

---

## Incomplete Features

### Settings Page - Incomplete Features
**Status:** Partially implemented - some features not yet functional

**Data Management Tab:**
- ❌ Auto-backup settings (not in UI)

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

---

## Completed Features

1. ✅ **Phase 0.4: Theme & Notifications** - Per-household theme and notification preferences with automatic switching
2. ✅ **Better Auth Authentication Bug Fixes** - Fixed 185 fetch calls missing credentials and session handling
3. ✅ **Better Auth Cookie Integration** - Fixed session cookie handling with proper authentication
4. ✅ **Experimental Features System** - Feature gating system with Quick Entry Mode, Enhanced Search, and Advanced Charts
5. ✅ **Import Preferences** - Default CSV import template selection with auto-load
6. ✅ **GeoIP Location Lookup** - Session location display with country flags
7. ✅ **Email Verification Flow** - Complete email verification system with email change flow
8. ✅ **Session Timeout Enforcement** - Automatic logout after configurable inactivity period
9. ✅ **Household Favorite Feature** - Star/favorite households to pin to top of sidebar
10. ✅ **Household Settings Decoupling** - Sidebar dropdown and settings tabs operate independently
11. ✅ **Household Sort by Join Date** - Households ordered chronologically by when user joined
12. ✅ **Household Tab Switching Fix** - Fixed household context not updating when switching tabs
13. ✅ **Reset App Data** - Settings reset with password confirmation and rate limiting
14. ✅ **Household Tab-Based UI** - Tab-based household settings interface with member badges
15. ✅ **Household Management System** - Multi-household support with role-based permissions
16. ✅ **Avatar Upload** - Profile picture upload with display throughout app
17. ✅ **Notifications Tab** - Granular per-notification-type channel selection (push/email)
18. ✅ **Unified Settings Page** - Comprehensive settings interface with 3-tier structure
19. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through optimization
20. ✅ **Income Frequency Tracking** - Category-level frequency tracking for budget projections
21. ✅ **Goals Dashboard Widget** - Overall progress display across all active savings goals
22. ✅ **Developer Mode** - Debug utility with entity ID badges, DEV indicator, and developer tools panel
23. ✅ **Bill Frequency Expansion** - Support for one-time, weekly, and biweekly bill frequencies
24. ✅ **Authentication Migration** - Complete Clerk to Better Auth migration with email/password
