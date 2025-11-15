# Features to Implement

**Add new feature requests below this line:**




---

## In Progress Features

### Household Data Isolation Phase 1 (CRITICAL - TOP PRIORITY)
**Status:** 72% Complete - API ✅ Complete, Frontend Pending (2025-11-14)
**Progress:** Infrastructure 100%, API endpoints 100% (18/18) ✅, frontend components 0%, business logic 0%, testing 0%
**Plan:** `docs/frontend-components-implementation-plan.md` (31 components to update)
**Summary:** `docs/phase-1-api-completion-summary.md`

**Completed:**
- ✅ Database schema updates (6 tables with household_id + 15 indexes)
- ✅ Migration file created (not yet applied: `drizzle/0042_add_household_id_to_core_tables.sql`)
- ✅ Backend auth helpers (`lib/api/household-auth.ts`)
- ✅ Frontend fetch hook (`lib/hooks/use-household-fetch.ts`)
- ✅ **ALL Core Financial Data API endpoints (18 files)**
- ✅ Accounts API (2 files)
- ✅ Transactions API (12 files)
- ✅ Categories API (2 files - name uniqueness per-household, delete protection)
- ✅ Merchants API (2 files - name uniqueness per-household, delete protection, normalized names)

**Remaining:**
- ⏳ ~31 frontend components (update to use useHouseholdFetch hook) - **See plan file above**
- ⏳ Business logic (rules engine, bill matching, usage analytics)
- ⏳ Integration tests
- ⏳ Manual testing
- ⏳ Apply migration (backup database first)

**Notes:**
- API is 100% ready for household isolation
- Migration file created but not applied (allows for review)
- Frontend components plan created with detailed implementation guide
- Other API endpoints (bills, budgets, debts, goals) will be Phase 2-4

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
