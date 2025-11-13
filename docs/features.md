# Features to implement

<!-- Add new feature requests below this line -->

---

## 🔄 In Progress: Authentication Migration (Clerk → Better Auth)

**Status:** 85% Complete - Phases 1-3 Done | Remaining: Navigation, Auth Pages, Layout, Testing, Cleanup
**Priority:** High
**Plan Document:** `docs/CLERK-TO-BETTER-AUTH-COMPLETE-SWITCHOVER-PLAN.md`

### Completed ✅
- Phase 1: Core Infrastructure (middleware + auth helpers)
- Phase 2: All 106 API routes migrated
- Phase 3: All 6 client components migrated

### Remaining ⏳
- Phase 4: Navigation components (2 files) - Replace UserButton with custom menu
- Phase 5: Auth pages (2 files) - Custom sign-in/sign-up forms
- Phase 6: Layout - Remove ClerkProvider
- Phase 7: Testing & validation
- Phase 8: Cleanup & remove Clerk dependencies

**Note:** Backend fully migrated. Frontend still has Clerk UI components in navigation and auth pages.

---

## Completed Features

1. ✅ **Goals Dashboard Widget** - Shows overall progress across all active savings goals in dashboard stats
2. ✅ **Income Frequency Tracking** - Category-level frequency tracking (weekly/biweekly/monthly/variable) for accurate budget projections
3. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through query optimization and batch updates
