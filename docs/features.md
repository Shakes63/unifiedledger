# Features to Implement

**Add new feature requests below this line:**





---

## Incomplete Features

### Settings Page - Advanced Features
**Status:** Not yet implemented
**Missing:**
- ❌ Two-factor authentication (2FA)
- ❌ OAuth provider management
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
2. ✅ **Household Data Isolation Phase 0** - Three-tier settings architecture with per-household themes and notifications
3. ✅ **Household Data Isolation Phase 1** - Complete household isolation for transactions, accounts, categories, and merchants with database migration applied
4. ✅ **Household Data Isolation Phase 2** - Complete Bills & Budgets API isolation: 23 API endpoints, 13 frontend components, database migration with 0 NULL values
5. ✅ **Household Data Isolation Phase 3** - Complete Goals & Debts household isolation with database migration, API endpoints, frontend components, testing, and documentation
6. ✅ **Household Data Isolation Phase 4** - Complete Business Logic household isolation: categorization rules and rule execution logs isolated by household
7. ✅ **Better Auth Authentication Bug Fixes** - Fixed 185 fetch calls missing credentials and session handling
8. ✅ **Better Auth Cookie Integration** - Session cookie handling with proper authentication
9. ✅ **Experimental Features System** - Feature gating with Quick Entry Mode, Enhanced Search, and Advanced Charts
10. ✅ **Import Preferences** - Default CSV import template selection with auto-load
11. ✅ **GeoIP Location Lookup** - Session location display with country flags
12. ✅ **Email Verification Flow** - Email verification system with email change flow
13. ✅ **Session Timeout Enforcement** - Automatic logout after configurable inactivity period
14. ✅ **Household Favorite Feature** - Star/favorite households to pin to top of sidebar
15. ✅ **Household Settings Decoupling** - Sidebar dropdown and settings tabs operate independently
16. ✅ **Household Sort by Join Date** - Households ordered chronologically by when user joined
17. ✅ **Household Tab Switching Fix** - Fixed household context not updating when switching tabs
18. ✅ **Reset App Data** - Settings reset with password confirmation and rate limiting
19. ✅ **Household Tab-Based UI** - Tab-based household settings interface with member badges
20. ✅ **Household Management System** - Multi-household support with role-based permissions
21. ✅ **Avatar Upload** - Profile picture upload with display throughout app
22. ✅ **Notifications Tab** - Granular per-notification-type channel selection (push/email)
23. ✅ **Unified Settings Page** - Comprehensive settings interface with 3-tier structure
24. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through optimization
25. ✅ **Income Frequency Tracking** - Category-level frequency tracking for budget projections
26. ✅ **Goals Dashboard Widget** - Overall progress display across all active savings goals
27. ✅ **Developer Mode** - Debug utility with entity ID badges, DEV indicator, and developer tools panel
28. ✅ **Bill Frequency Expansion** - Support for one-time, weekly, and biweekly bill frequencies
29. ✅ **Authentication Migration** - Complete Clerk to Better Auth migration with email/password
30. ✅ **Auto-Backup Settings** - Automatic backup system with scheduler, settings UI, manual backups, backup history, and cron endpoint
31. ✅ **Backup Household Isolation** - Complete household isolation for backups with per-household settings, history, and file storage
