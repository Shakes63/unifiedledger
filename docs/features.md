# Features to Implement

**Add new feature requests below this line:**




---

## In Progress Features

### Household Data Isolation Phase 1 (CRITICAL - TOP PRIORITY)
**Status:** 13% Complete - In Progress (2025-11-14)
**Progress:** Schema updates, migration, auth helpers, frontend hook complete. API endpoints 13% (2/15), components 0%, testing 0%
**Plans:** `docs/phase-1-completion-plan.md`, `docs/phase-1-detailed-plan.md`, `docs/phase-1-progress.md`

**Completed:**
- ✅ Database schema updates (6 tables with household_id + 15 indexes)
- ✅ Migration file created (not yet applied)
- ✅ Backend auth helpers (`lib/api/household-auth.ts`)
- ✅ Frontend fetch hook (`lib/hooks/use-household-fetch.ts`)
- ✅ Accounts API endpoints updated (4 endpoints: GET, POST, PUT, DELETE)
- ✅ Transactions main endpoints updated (2 endpoints: `/api/transactions/route.ts` GET/POST, `/api/transactions/[id]/route.ts` GET/PUT/DELETE)

**Remaining:**
- ⏳ 13 more API endpoints (5 transaction endpoints, 4 categories, 4 merchants, 3 dashboard)
- ⏳ 20 frontend components
- ⏳ Business logic (rules engine, bill matching, usage analytics)
- ⏳ Integration tests
- ⏳ Manual testing
- ⏳ Apply migration
- ⏳ Documentation

**Current Work:** Transactions API isolation 40% complete (2/7 endpoints done). Categories, merchants, and dashboard endpoints pending.

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

1. ✅ **Household Data Isolation Phase 0** - Three-tier settings architecture with per-household themes and notifications (60 automated tests)
2. ✅ **Better Auth Authentication Bug Fixes** - Fixed 185 fetch calls missing credentials and session handling
3. ✅ **Better Auth Cookie Integration** - Session cookie handling with proper authentication
4. ✅ **Experimental Features System** - Feature gating with Quick Entry Mode, Enhanced Search, and Advanced Charts
5. ✅ **Import Preferences** - Default CSV import template selection with auto-load
6. ✅ **GeoIP Location Lookup** - Session location display with country flags
7. ✅ **Email Verification Flow** - Email verification system with email change flow
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
