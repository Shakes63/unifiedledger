# Features to Implement

**Add new feature requests below this line:**





---

## In Progress Features

### Household Data Isolation (CRITICAL - TOP PRIORITY)
**Status:** Phase 0 Complete (100%) - Ready for Phase 1
**Progress:** Phase 0: 5/5 complete | Phases 1-4: Not started
**Plan:** `docs/phase-0-implementation-progress.md`, `docs/household-data-isolation-plan.md`

**Phase 0 Completed (2025-11-14):**
- ✅ Phase 0.1: Database & Migration
- ✅ Phase 0.2: API Endpoints
- ✅ Phase 0.3: UI Restructure
- ✅ Phase 0.4: Theme & Notifications
- ✅ Phase 0.5: Testing & Polish (60 automated tests, 100% passing)

**Next Phase: Phase 1 (Core Data Isolation)**
- **Status:** Not started
- **Estimated:** 2-3 days
- **Scope:** Add `household_id` to transactions, accounts, categories, merchants
- **Tasks:** Database schema updates (4 tables), API endpoint updates (~25 endpoints), Frontend component updates (~15 components), Data migration

**Remaining Phases 2-4:** Bills, budgets, goals, tags, advanced features (3-6 days)

**Current Issue:** All financial data (transactions, accounts, budgets, bills, goals, debts) is still shared across households. Settings architecture complete and tested. Data filtering by household not yet implemented.

---

## Incomplete Features

### Settings Page - Incomplete Features
**Status:** Partially implemented
**Plan:** None

**Missing:**
- ❌ Auto-backup settings (not in UI)
- ❌ Two-factor authentication (2FA)
- ❌ OAuth provider management
- ❌ Scheduled data backups
- ❌ Advanced permission system (beyond basic roles)

---

### Self-Hosting Configuration (Future Feature)
**Status:** Not yet implemented
**Plan:** None

**Goal:** Make app completely self-hostable without .env file editing

**Concept:** Admin/System settings tab for configuring external services through UI

---

## Completed Features

1. ✅ **Phase 0.5: Testing & Polish** - Comprehensive automated testing (60 tests, 100% passing) for household settings architecture
2. ✅ **Phase 0.4: Theme & Notifications** - Per-household theme and notification preferences with automatic switching
3. ✅ **Better Auth Authentication Bug Fixes** - Fixed 185 fetch calls missing credentials and session handling
4. ✅ **Better Auth Cookie Integration** - Fixed session cookie handling with proper authentication
5. ✅ **Experimental Features System** - Feature gating with Quick Entry Mode, Enhanced Search, and Advanced Charts
6. ✅ **Import Preferences** - Default CSV import template selection with auto-load
7. ✅ **GeoIP Location Lookup** - Session location display with country flags
8. ✅ **Email Verification Flow** - Complete email verification system with email change flow
9. ✅ **Session Timeout Enforcement** - Automatic logout after configurable inactivity period
10. ✅ **Household Favorite Feature** - Star/favorite households to pin to top of sidebar
11. ✅ **Household Settings Decoupling** - Sidebar dropdown and settings tabs operate independently
12. ✅ **Household Sort by Join Date** - Households ordered chronologically by when user joined
13. ✅ **Household Tab Switching Fix** - Fixed household context not updating when switching tabs
14. ✅ **Reset App Data** - Settings reset with password confirmation and rate limiting
15. ✅ **Household Tab-Based UI** - Tab-based household settings interface with member badges
16. ✅ **Household Management System** - Multi-household support with role-based permissions
17. ✅ **Avatar Upload** - Profile picture upload with display throughout app
18. ✅ **Notifications Tab** - Granular per-notification-type channel selection (push/email)
19. ✅ **Unified Settings Page** - Comprehensive settings interface with 3-tier structure
20. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through optimization
21. ✅ **Income Frequency Tracking** - Category-level frequency tracking for budget projections
22. ✅ **Goals Dashboard Widget** - Overall progress display across all active savings goals
23. ✅ **Developer Mode** - Debug utility with entity ID badges, DEV indicator, and developer tools panel
24. ✅ **Bill Frequency Expansion** - Support for one-time, weekly, and biweekly bill frequencies
25. ✅ **Authentication Migration** - Complete Clerk to Better Auth migration with email/password
