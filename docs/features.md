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
- **Fully Implemented:** Name, email, display name, bio, and avatar upload all work
- **Not Implemented:**
  - Email verification flow

### Data Management Tab
- **Fully Implemented:** Reset App Data function with password confirmation and rate limiting
- **Not Implemented:**
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

1. ✅ **Authentication Migration** - Complete Clerk to Better Auth migration with email/password authentication
2. ✅ **Goals Dashboard Widget** - Overall progress display across all active savings goals
3. ✅ **Income Frequency Tracking** - Category-level frequency tracking for accurate budget projections
4. ✅ **Transaction Save Performance** - 65-75% faster transaction creation through optimization
5. ✅ **Unified Settings Page** - Comprehensive 9-tab settings interface
6. ✅ **Notifications Tab** - Granular per-notification-type channel selection (push/email)
7. ✅ **Avatar Upload** - Profile picture upload with display throughout app and initials fallback
8. ✅ **Household Management System** - Multi-household support with role-based permissions
9. ✅ **Household Tab-Based UI** - Tab-based household settings interface with member badges
10. ✅ **Reset App Data** - Settings reset with password confirmation and rate limiting
11. ✅ **Household Tab Switching** - Fixed household context not changing when switching tabs in settings
