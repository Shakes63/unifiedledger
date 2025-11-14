# Features to implement

<!-- Add new feature requests below this line -->




---

## Incomplete Features

### Household Data Isolation (CRITICAL - TOP PRIORITY)
**Status:** Not yet implemented - planning complete, ready for implementation

**Problem:**
All financial data (transactions, accounts, budgets, bills, goals, debts) is currently shared across all households. When users switch households, they see the same data because filtering is only by `user_id`, not by `household_id`.

**Impact:**
- Multi-household feature is non-functional for data separation
- Users in multiple households see mixed/duplicate data
- Security risk: Household data is not properly isolated

**Part 1: Settings Reorganization** (FOUNDATIONAL)
Settings need THREE-TIER architecture:
- **User-Only Settings:** Follow user across ALL households (profile, security, accessibility)
- **User-Per-Household Settings:** User sets different value per household (theme, date format, notifications, default account)
- **Household-Only Settings:** Shared by ALL members (currency, fiscal year, budget method, rules)

**Part 2: Data Isolation** (CORE FUNCTIONALITY)
Add `household_id` column to 20+ tables, update 90+ API endpoints, update 50+ components.

**Implementation Plans:**
- Phase 0 (Settings): `settings-three-tier-architecture.md` - 7 days
- Phases 1-4 (Data): `household-data-isolation-plan.md` - 5-9 days

**Total Estimated Effort:** 12-16 days
**Complexity:** HIGH
**Risk:** HIGH (data migration, security-critical)

---

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
5. ✅ **Unified Settings Page** - Comprehensive 9-tab settings interface
6. ✅ **Notifications Tab** - Granular per-notification-type channel selection (push/email)
7. ✅ **Avatar Upload** - Profile picture upload with display throughout app and initials fallback
8. ✅ **Household Management System** - Multi-household support with role-based permissions
9. ✅ **Household Tab-Based UI** - Tab-based household settings interface with member badges
10. ✅ **Reset App Data** - Settings reset with password confirmation and rate limiting
11. ✅ **Household Tab Switching** - Fixed household context not updating when switching tabs
12. ✅ **Household Settings Decoupling** - Sidebar dropdown and settings tabs operate independently
13. ✅ **Household Sort by Join Date** - Households ordered chronologically by when user joined
14. ✅ **Household Favorite Feature** - Star/favorite households to pin them to top of sidebar
