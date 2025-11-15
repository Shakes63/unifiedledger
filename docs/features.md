# Features to Implement

**Add new feature requests below this line:**




---

## Incomplete Features

### Household Data Isolation Phase 2-4
**Status:** Not started (Phases 2-4 pending)
**Plan:** `docs/household-data-isolation-plan.md`

**Phase 1 (Core Data): ✅ COMPLETE**
**Remaining:**
- ⏳ Phase 2: Bills & Budgets API isolation
- ⏳ Phase 3: Goals & Debts API isolation
- ⏳ Phase 4: Business logic (rules engine, bill matching, usage analytics)

---

### Settings Page - Advanced Features
**Status:** Partially implemented - Core features complete
**Plan:** None - future enhancements

**Missing:**
- ❌ Auto-backup settings (not in UI)
- ❌ Two-factor authentication (2FA)
- ❌ OAuth provider management
- ❌ Scheduled data backups
- ❌ Advanced permission system (beyond basic roles)

---

### Self-Hosting Configuration
**Status:** Not yet implemented - future feature
**Plan:** None

**Goal:** Make app completely self-hostable without .env file editing

**Concept:** Admin/System settings tab for configuring external services through UI

---

## Completed Features

1. ✅ **Household Data Isolation Phase 1** - Complete household isolation for transactions, accounts, categories, and merchants with database migration applied
2. ✅ **Household Data Isolation Phase 0** - Three-tier settings architecture with per-household themes and notifications
3. ✅ **Better Auth Authentication Bug Fixes** - Fixed 185 fetch calls missing credentials and session handling
4. ✅ **Better Auth Cookie Integration** - Session cookie handling with proper authentication
5. ✅ **Experimental Features System** - Feature gating with Quick Entry Mode, Enhanced Search, and Advanced Charts
6. ✅ **Import Preferences** - Default CSV import template selection with auto-load
7. ✅ **GeoIP Location Lookup** - Session location display with country flags
8. ✅ **Email Verification Flow** - Email verification system with email change flow
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
