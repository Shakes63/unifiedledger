# Features to implement

<!-- Add new feature requests below this line -->

---

## Completed Features

1. ✅ **Authentication Migration (Clerk → Better Auth)** - Complete switchover to Better Auth (100% complete - all 8 phases done)
2. ✅ **Goals Dashboard Widget** - Shows overall progress across all active savings goals in dashboard stats
3. ✅ **Income Frequency Tracking** - Category-level frequency tracking (weekly/biweekly/monthly/variable) for accurate budget projections
4. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through query optimization and batch updates
5. ⚠️ **Unified Settings Page** - Comprehensive settings page at `/dashboard/settings` with tabbed interface (Phase 1 complete, Phases 2-3 pending)
   - ✅ **Phase 1 (Complete):** Profile management, App preferences (currency, date, fiscal year), Financial settings (budget method, display options), Theme selection moved from `/dashboard/theme`, Navigation updated (Notifications & Theme removed from sidebar)
   - ⏳ **Phase 2 (Pending):** Session management, Privacy & Security (data export, account deletion), Household settings tab
   - ⏳ **Phase 3 (Pending):** Data management (import preferences, retention policies), Advanced settings (developer mode, experimental features)
   - **Plan Document:** `docs/SETTINGS-PAGE-IMPLEMENTATION-PLAN.md` (contains implementation details for remaining phases)
