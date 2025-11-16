# Features to Implement

**Add new feature requests below this line:**




---

## Incomplete Features

### Household Data Isolation Phase 3-4
**Status:** Phase 3 IN PROGRESS (Steps 1-3 complete, Step 4 partially complete, Steps 5-6 remaining)
**Plan:** `docs/phase-3-goals-debts-isolation-plan.md` (overview) and `docs/phase-3-step-4-frontend-implementation-plan.md` (detailed Step 4 plan)

**Phase 1 (Core Data): ✅ COMPLETE**
**Phase 2 (Bills & Budgets): ✅ COMPLETE**
**Phase 3 (Goals & Debts): IN PROGRESS**
- ✅ Step 1: Database schema updated (6 tables: savings_goals, savings_milestones, debts, debt_payments, debt_payoff_milestones, debt_settings)
- ✅ Step 2: Savings Goals API endpoints updated (3 endpoints)
- ✅ Step 3: Debts API endpoints updated (13 endpoints) - All endpoints now filter by household with proper validation
- 🔄 Step 4: Frontend components updates - IN PROGRESS (10/20 components complete, ~50%)
  - ✅ Goals Page (5 fetch calls)
  - ✅ Savings Goals Widget (1 fetch call + styling)
  - ✅ Goal Tracker Component (1 fetch call)
  - ✅ Debts Page (6 fetch calls)
  - ✅ Reports Page (2 fetch calls)
  - ✅ Debt Payoff Strategy Component (3 fetch calls)
  - ✅ Debt Payoff Tracker Component (1 fetch call)
  - ✅ Payment Streak Widget (1 fetch call)
  - ✅ Payment Adherence Card (1 fetch call)
  - ✅ Minimum Payment Warning (1 fetch call)
  - ⏳ Remaining: 10 components (~12 fetch calls) - See `docs/phase-3-step-4-frontend-implementation-plan.md` for details
- ⏳ Step 5: Testing & validation - PENDING
- ⏳ Step 6: Documentation & cleanup - PENDING

**Remaining:**
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

1. ✅ **Enhanced Error Handling & Network Infrastructure** - Complete error handling system with reusable UI components, offline request queue, network status banner, and automatic retry
2. ✅ **Household Data Isolation Phase 1** - Complete household isolation for transactions, accounts, categories, and merchants with database migration applied
3. ✅ **Household Data Isolation Phase 0** - Three-tier settings architecture with per-household themes and notifications
4. ✅ **Household Data Isolation Phase 2** - Complete Bills & Budgets API isolation: 23 API endpoints, 13 frontend components, database migration with 0 NULL values
5. ✅ **Better Auth Authentication Bug Fixes** - Fixed 185 fetch calls missing credentials and session handling
6. ✅ **Better Auth Cookie Integration** - Session cookie handling with proper authentication
7. ✅ **Experimental Features System** - Feature gating with Quick Entry Mode, Enhanced Search, and Advanced Charts
8. ✅ **Import Preferences** - Default CSV import template selection with auto-load
9. ✅ **GeoIP Location Lookup** - Session location display with country flags
10. ✅ **Email Verification Flow** - Email verification system with email change flow
11. ✅ **Session Timeout Enforcement** - Automatic logout after configurable inactivity period
12. ✅ **Household Favorite Feature** - Star/favorite households to pin to top of sidebar
13. ✅ **Household Settings Decoupling** - Sidebar dropdown and settings tabs operate independently
14. ✅ **Household Sort by Join Date** - Households ordered chronologically by when user joined
15. ✅ **Household Tab Switching Fix** - Fixed household context not updating when switching tabs
16. ✅ **Reset App Data** - Settings reset with password confirmation and rate limiting
17. ✅ **Household Tab-Based UI** - Tab-based household settings interface with member badges
18. ✅ **Household Management System** - Multi-household support with role-based permissions
19. ✅ **Avatar Upload** - Profile picture upload with display throughout app
20. ✅ **Notifications Tab** - Granular per-notification-type channel selection (push/email)
21. ✅ **Unified Settings Page** - Comprehensive settings interface with 3-tier structure
22. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through optimization
23. ✅ **Income Frequency Tracking** - Category-level frequency tracking for budget projections
24. ✅ **Goals Dashboard Widget** - Overall progress display across all active savings goals
25. ✅ **Developer Mode** - Debug utility with entity ID badges, DEV indicator, and developer tools panel
26. ✅ **Bill Frequency Expansion** - Support for one-time, weekly, and biweekly bill frequencies
27. ✅ **Authentication Migration** - Complete Clerk to Better Auth migration with email/password
28. ✅ **Household Data Isolation Phase 3 Steps 1-3** - Database schema and API endpoints updated for Goals & Debts household isolation
