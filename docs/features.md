# Features to Implement

**Add new feature requests below this line:**




---

## In Progress Features

### Household Data Isolation (CRITICAL - TOP PRIORITY)
**Status:** 85% Complete - Phase 0 (Settings Architecture) nearly complete
**Progress:** 4.5 of 5 phases complete
**Plan:** `docs/phase-0-implementation-progress.md`, `docs/household-data-isolation-plan.md`

**Completed:**
- ✅ Phase 0.1-0.3: Database, API Endpoints, UI Restructure complete
- ✅ Phase 0.4: Theme & Notifications (85% complete) - Core implementation complete, testing pending
  - See: `docs/phase-0.4-implementation-plan.md`, `docs/phase-0.4-remaining-tasks-plan.md`

**Remaining Work:**
- ⏳ Phase 0.4: Manual testing and validation (~2-3 hours)
- ⏳ Phase 0.5: Testing & Polish (1 day)
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

1. ✅ **Better Auth Authentication Bug Fixes** - Fixed 185 fetch calls missing credentials, session ping cookie parsing, Web Vitals auth, and sign-in error display
2. ✅ **Better Auth Cookie Integration** - Fixed session cookie handling with `credentials: "include"` and correct cookie parsing in middleware
3. ✅ **Experimental Features System** - Complete system for gating features behind experimental flag with Quick Entry Mode, Enhanced Search, and Advanced Charts
4. ✅ **Import Preferences** - Default CSV import template selection in Data Management settings with auto-load on import
5. ✅ **GeoIP Location Lookup** - Session location display with country flags using ip-api.com geolocation
6. ✅ **Email Verification Flow** - Complete email verification system with verification on signup and email change flow
7. ✅ **Session Timeout Enforcement** - Automatic logout after configurable inactivity period with Remember Me option
8. ✅ **Household Favorite Feature** - Star/favorite households to pin them to top of sidebar
9. ✅ **Household Settings Decoupling** - Sidebar dropdown and settings tabs operate independently
10. ✅ **Household Sort by Join Date** - Households ordered chronologically by when user joined
11. ✅ **Household Tab Switching Fix** - Fixed household context not updating when switching tabs
12. ✅ **Reset App Data** - Settings reset with password confirmation and rate limiting
13. ✅ **Household Tab-Based UI** - Tab-based household settings interface with member badges
14. ✅ **Household Management System** - Multi-household support with role-based permissions
15. ✅ **Avatar Upload** - Profile picture upload with display throughout app and initials fallback
16. ✅ **Notifications Tab** - Granular per-notification-type channel selection (push/email)
17. ✅ **Unified Settings Page** - Comprehensive settings interface with 3-tier structure (User/My Settings/Household)
18. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through optimization
19. ✅ **Income Frequency Tracking** - Category-level frequency tracking for budget projections
20. ✅ **Goals Dashboard Widget** - Overall progress display across all active savings goals
21. ✅ **Developer Mode** - Debug utility with entity ID badges, DEV indicator, and developer tools panel
22. ✅ **Bill Frequency Expansion** - Support for one-time, weekly, and biweekly bill frequencies
23. ✅ **Authentication Migration** - Complete Clerk to Better Auth migration with email/password
