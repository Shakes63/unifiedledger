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

## Incomplete Features

### Household Favorite Feature (IN PROGRESS - HAS BUG)
**Status:** Database and API complete, but UI has critical bug causing households to disappear from sidebar/settings

**What Works:**
- ✅ Database migration (`is_favorite` field added to `household_members` table)
- ✅ API endpoint `/api/households/[householdId]/favorite` for toggling favorite status
- ✅ Star icon UI in settings page tabs (desktop & mobile)
- ✅ Favorite sorting logic (favorites should appear first in sidebar)

**What's Broken:**
- ❌ Households disappeared from sidebar dropdown after implementation
- ❌ Households disappeared from settings page
- ❌ Likely issue: Frontend components not handling new `isFavorite` field properly, but it broke when renaming the dynamic route from Id to householdId

**Files Modified:**
- `lib/db/schema.ts` - Added `isFavorite` field
- `drizzle/0031_add_is_favorite_to_household_members.sql` - Migration
- `app/api/households/route.ts` - Returns `isFavorite` in response
- `app/api/households/[householdId]/favorite/route.ts` - Toggle endpoint
- `contexts/household-context.tsx` - Updated interface to include `isFavorite`
- `components/household/household-selector.tsx` - Sort by favorite + join date
- `components/settings/household-tab.tsx` - Star icon and toggle function

**Next Steps to Fix:**
1. Check if household context is properly fetching data with new field
2. Verify frontend components handle `isFavorite: boolean` (not null/undefined)
3. Check browser console for JavaScript errors
4. May need to handle migration for existing data (default to false)

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
12. ✅ **Household Settings Decoupling** - Sidebar dropdown and settings tabs operate independently
13. ✅ **Household Sort by Join Date** - Households ordered chronologically by when user joined them
