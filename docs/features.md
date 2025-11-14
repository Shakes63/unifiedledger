# Features to implement

<!-- Add new feature requests below this line -->

---

## Self-Hosting Configuration (Future Feature)

**Goal:** Make the app completely self-hostable without requiring .env file editing

**Concept:** Add an "Admin" or "System" settings tab where users can configure external services through the UI:

### Email/SMTP Configuration
- **Option 1 - Self-Hosted SMTP:**
  - SMTP Server (e.g., smtp.gmail.com, mail.yourdomain.com)
  - SMTP Port (25, 465, 587)
  - Username/Password (encrypted in database)
  - Enable TLS/SSL toggle
  - Test email button

- **Option 2 - Email Service API:**
  - Provider selector (Resend, SendGrid, Mailgun, Brevo, etc.)
  - API Key (encrypted in database)
  - From email/name
  - Test email button

### Benefits
- ✅ No .env file editing required
- ✅ True self-hosting capability
- ✅ Users can bring their own email server
- ✅ Configuration changes without server restart
- ✅ Credentials stored encrypted in database
- ✅ Multi-tenant support (different configs per household)

### Implementation Notes
- Store encrypted in new `systemSettings` or `serviceConfigurations` table
- Use environment variables as fallback for initial setup
- Validate and test configurations before saving
- Runtime configuration loading (not build-time)
- Admin-only access to system settings

### Future External Service Configurations
- OAuth providers (Google, GitHub, etc.)
- Backup services (S3, Backblaze, local storage)
- File storage (for avatars/attachments)
- Notification services (push notifications, webhooks)
- Currency exchange rate APIs

**Status:** Not yet implemented - currently requires .env configuration

---

## Settings Page - Incomplete Features

The following settings exist in the UI but are not fully functional:

### Profile Tab
- **Partially Implemented:** Name and email updates work, avatar upload complete
- **Not Implemented:**
  - Display Name field (shows in UI but may not save properly)
  - Bio field (shows in UI but may not save properly)
  - Email verification flow

### Data Management Tab
- **Not Implemented:**
  - Reset App Data function (shows error "This feature requires backend implementation")
  - Import preferences/default template selector (not in UI)
  - Auto-backup settings (not in UI)

### Privacy & Security Tab
- **Not Implemented:**
  - Session timeout setting (mentioned in plan but not in UI)
  - GeoIP location lookup for sessions (shows null)

### Advanced Tab
- **Partially Implemented:** All toggles save to database
- **Not Implemented:**
  - Toggles don't actually affect app behavior yet (except animations)
  - Developer mode doesn't show IDs/debug info anywhere
  - Experimental features flag doesn't unlock anything

### General Missing Features
- Email verification for new accounts
- Two-factor authentication (2FA)
- OAuth provider management
- Scheduled data backups
- Session timeout enforcement
- Advanced permission system (beyond basic roles)

---

## Completed Features

1. ✅ **Authentication Migration** - Complete switchover from Clerk to Better Auth with email/password authentication
2. ✅ **Goals Dashboard Widget** - Shows overall progress across all active savings goals in dashboard stats
3. ✅ **Income Frequency Tracking** - Category-level frequency tracking for accurate budget projections
4. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through query optimization
5. ✅ **Unified Settings Page** - Comprehensive 9-tab settings page covering profile, preferences, financial, notifications, theme, household, privacy, data, and advanced settings
6. ✅ **Notifications Tab** - Per-notification-type delivery channel selection (push/email) with auto-save, validation, and granular control over 9 notification types
7. ✅ **Avatar Upload** - Complete profile picture upload system with display throughout app (navigation, activity feed, household members) and initials fallback
8. ✅ **Household Management System** - Multi-household support with create/rename/delete/leave, member management, role-based permissions, auto-sync between sidebar and settings, and React Context for state management
9. ✅ **Household Tab-Based UI** - Tab-based interface where each household has its own sub-tab with member count badges, desktop horizontal tabs, mobile dropdown selector, inline "Create New" tab, and quick action buttons for each household
