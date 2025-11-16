# Admin Backend Section Implementation Plan

## Overview

This document outlines the implementation plan for an admin backend section that is only available to the application owner. The first user to sign up will automatically become the owner and gain access to an admin section for managing OAuth settings and other system configurations.

**Status:** Planning Complete, Implementation Starting  
**Target Completion:** 1-2 days  
**Priority:** High (Self-Hosting Feature)

---

## 1. Feature Requirements

### 1.1 User Stories

1. **As a first-time installer**, I want to see a sign-up form on first startup so I can create the owner account.
2. **As the first user**, I want to automatically become the application owner when I sign up.
3. **As the application owner**, I want to access an admin section in settings to manage OAuth providers.
4. **As the application owner**, I want to configure Google and GitHub OAuth credentials through the UI.
5. **As a non-owner user**, I should not see or access the admin section.
6. **As the application**, I should redirect to sign-up if no users exist, otherwise show the normal landing page.

### 1.2 Core Features

- **First User Detection:** Automatically detect and mark the first user as owner
- **Admin Section:** New admin tab in settings (only visible to owner)
- **OAuth Settings UI:** Configure OAuth providers (Google, GitHub) through admin interface
- **Environment Variable Management:** Store OAuth credentials securely (encrypted or in database)
- **Access Control:** Protect admin routes and features from non-owners

---

## 2. Technical Architecture

### 2.1 Database Schema Updates

**Add `isApplicationOwner` field to `user` table (auth-schema.ts):**
- Type: `integer` (boolean)
- Default: `false`
- Not null: `true`
- Index: Add index for quick owner lookup

**Migration:** `drizzle/0050_add_application_owner.sql`

### 2.2 Owner Detection Logic

**On Sign-Up:**
1. Check if any users exist in the database
2. If no users exist → Mark new user as `isApplicationOwner = true`
3. If users exist → Normal sign-up flow

**Helper Function:** `lib/auth/owner-helpers.ts`
- `isFirstUser()` - Check if database is empty
- `isApplicationOwner(userId)` - Check if user is owner
- `requireOwner()` - Middleware/helper to protect admin routes

### 2.3 Admin Section Structure

**New Settings Tab:** `components/settings/admin-tab.tsx`
- Only visible if user is owner
- Sections:
  - **OAuth Configuration** - Configure Google/GitHub OAuth
  - **System Settings** - Future: Other system-wide settings
  - **Application Info** - Version, database stats, etc.

**Settings Page Integration:**
- Add "Admin" tab to settings page (conditional rendering)
- Only show if user is owner

### 2.4 OAuth Settings Management

**Storage Options:**
1. **Database Table** (Recommended): Create `oauth_settings` table
   - Encrypted storage for client IDs/secrets
   - Per-provider configuration
   - Easy to update via UI

2. **Environment Variables** (Alternative): Update `.env` file
   - Requires file system access
   - More complex to implement
   - Less secure for self-hosting

**Decision:** Use database table with encryption for OAuth credentials.

**New Table:** `oauthSettings` in `lib/db/schema.ts`
```typescript
{
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().unique(), // 'google', 'github'
  clientId: text('client_id').notNull(),
  clientSecret: text('client_secret').notNull(), // Encrypted
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
}
```

### 2.5 API Endpoints

**Admin Endpoints (`app/api/admin/`):**

1. **GET `/api/admin/oauth-settings`**
   - Get OAuth provider configurations
   - Owner only

2. **POST `/api/admin/oauth-settings`**
   - Update OAuth provider configuration
   - Owner only
   - Encrypt client secret before storing

3. **GET `/api/admin/system-info`**
   - Get system information (version, stats)
   - Owner only

4. **GET `/api/admin/check-owner`**
   - Check if current user is owner
   - Used by frontend to conditionally show admin tab

### 2.6 First Startup Detection

**Home Page (`app/page.tsx`):**
- Check if any users exist
- If no users → Redirect to `/sign-up` with `?firstSetup=true`
- If users exist → Show normal landing page

**Sign-Up Page (`app/sign-up/[[...index]]/page.tsx`):**
- Check for `firstSetup` query parameter
- If `firstSetup=true` → Show special message about becoming owner
- After sign-up → Mark user as owner if no users existed before

---

## 3. Implementation Steps

### Step 1: Database Schema Updates

**Objective:** Add `isApplicationOwner` field and OAuth settings table

**Tasks:**
1. Update `auth-schema.ts`:
   - Add `isApplicationOwner` boolean field to `user` table
   - Add index for owner lookup

2. Create `oauthSettings` table in `lib/db/schema.ts`:
   - Provider ID, client ID, encrypted client secret
   - Enabled flag, timestamps

3. Create migration files:
   - `drizzle/0050_add_application_owner.sql`
   - `drizzle/0051_add_oauth_settings_table.sql`

4. Run migrations

**Deliverable:** Database schema updated with owner field and OAuth settings table

**Estimated Time:** 30 minutes

---

### Step 2: Owner Detection & Helper Functions

**Objective:** Create utilities for owner detection and access control

**Tasks:**
1. Create `lib/auth/owner-helpers.ts`:
   - `isFirstUser()` - Check if database has any users
   - `isApplicationOwner(userId)` - Check if user is owner
   - `requireOwner()` - Middleware to protect admin routes

2. Update sign-up flow:
   - Check `isFirstUser()` before creating account
   - If first user → Set `isApplicationOwner = true`
   - Create API endpoint or hook for sign-up to mark owner

**Deliverable:** Owner detection logic and helper functions

**Estimated Time:** 1 hour

---

### Step 3: First Startup Detection

**Objective:** Redirect to sign-up if no users exist

**Tasks:**
1. Update `app/page.tsx`:
   - Check if any users exist in database
   - If no users → Redirect to `/sign-up?firstSetup=true`
   - If users exist → Show normal landing page

2. Update `app/sign-up/[[...index]]/page.tsx`:
   - Check for `firstSetup` query parameter
   - Show special message: "You're creating the first account. You'll be the application owner."
   - After successful sign-up → Mark as owner

**Deliverable:** First startup detection and redirect logic

**Estimated Time:** 1 hour

---

### Step 4: OAuth Settings Encryption

**Objective:** Encrypt OAuth client secrets before storing

**Tasks:**
1. Create `lib/encryption/oauth-encryption.ts`:
   - Encryption/decryption functions for OAuth secrets
   - Use `crypto` module with AES-256-GCM
   - Store encryption key in environment variable or generate on first startup

2. Create encryption key management:
   - Generate key on first startup
   - Store in environment variable or secure file
   - Fallback to app secret if no key exists

**Deliverable:** OAuth secret encryption utilities

**Estimated Time:** 1-2 hours

---

### Step 5: Admin API Endpoints

**Objective:** Create admin API endpoints for OAuth settings

**Tasks:**
1. Create `app/api/admin/oauth-settings/route.ts`:
   - GET: Return OAuth settings (decrypted secrets)
   - POST: Update OAuth settings (encrypt secrets before storing)
   - Owner-only access via `requireOwner()` helper

2. Create `app/api/admin/system-info/route.ts`:
   - GET: Return system information
   - Owner-only access

3. Create `app/api/admin/check-owner/route.ts`:
   - GET: Check if current user is owner
   - Return `{ isOwner: boolean }`

**Deliverable:** Admin API endpoints with owner protection

**Estimated Time:** 2 hours

---

### Step 6: Admin Tab Component

**Objective:** Create admin settings tab UI

**Tasks:**
1. Create `components/settings/admin-tab.tsx`:
   - OAuth Configuration section:
     - Google OAuth settings form
     - GitHub OAuth settings form
     - Enable/disable toggles
     - Test connection buttons
   - System Info section:
     - Application version
     - Database statistics
     - User count
   - Use semantic theme variables

2. OAuth Settings Form:
   - Client ID input
   - Client Secret input (password type)
   - Save button
   - Validation and error handling

**Deliverable:** Admin tab component with OAuth settings UI

**Estimated Time:** 3-4 hours

---

### Step 7: Integrate Admin Tab into Settings

**Objective:** Add admin tab to settings page (owner-only)

**Tasks:**
1. Update `app/dashboard/settings/page.tsx`:
   - Fetch owner status on mount
   - Conditionally render Admin tab if user is owner
   - Add Admin tab to tab list

2. Update settings navigation:
   - Show Admin tab only to owners
   - Use badge or indicator for admin tab

**Deliverable:** Admin tab integrated into settings page

**Estimated Time:** 1 hour

---

### Step 8: Update Better Auth OAuth Configuration

**Objective:** Load OAuth settings from database instead of environment variables

**Tasks:**
1. Update `lib/better-auth.ts`:
   - Load OAuth settings from database on initialization
   - Decrypt client secrets
   - Configure providers dynamically from database
   - Fallback to environment variables if database settings don't exist

2. Create helper function:
   - `loadOAuthSettingsFromDatabase()` - Load and decrypt settings
   - Call on Better Auth initialization

**Deliverable:** Dynamic OAuth configuration from database

**Estimated Time:** 2-3 hours

---

### Step 9: Access Control & Security

**Objective:** Ensure admin features are properly protected

**Tasks:**
1. Add `requireOwner()` middleware to all admin API endpoints
2. Add client-side checks:
   - Hide admin tab if user is not owner
   - Show error message if non-owner tries to access admin routes
3. Add server-side validation:
   - Verify owner status on every admin API call
   - Return 403 Forbidden if not owner

**Deliverable:** Complete access control for admin features

**Estimated Time:** 1 hour

---

### Step 10: Testing & Polish

**Objective:** Test admin functionality and polish UI

**Tasks:**
1. **Manual Testing:**
   - First sign-up → Verify owner status
   - Second sign-up → Verify not owner
   - Admin tab visibility → Only shows for owner
   - OAuth settings → Save and load correctly
   - OAuth configuration → Works with Better Auth

2. **UI Polish:**
   - Ensure consistent styling with theme variables
   - Add loading states
   - Add success/error messages
   - Add confirmation dialogs for sensitive actions

3. **Error Handling:**
   - Handle encryption errors gracefully
   - Handle database errors
   - Handle invalid OAuth credentials

**Deliverable:** Fully tested and polished admin section

**Estimated Time:** 2-3 hours

---

## 4. Integration Points

### 4.1 Settings Page Structure

**Settings Page Updates:**
- Add conditional "Admin" tab (only for owners)
- Tab order: User Settings → My Settings → Household Settings → **Admin** (if owner)

### 4.2 Authentication Flow Updates

**Sign-Up Flow:**
- Check for first user on sign-up
- Mark first user as owner automatically
- Show special message on first sign-up

**Home Page:**
- Check for users on load
- Redirect to sign-up if no users exist

### 4.3 Better Auth Integration

**OAuth Configuration:**
- Load OAuth settings from database
- Decrypt secrets before use
- Fallback to environment variables
- Update configuration when settings change

---

## 5. UI/UX Design

### 5.1 Admin Tab Layout

```
┌─────────────────────────────────────────────┐
│ Admin Settings                               │
├─────────────────────────────────────────────┤
│ OAuth Configuration                          │
│ ┌─────────────────────────────────────────┐ │
│ │ Google OAuth                            │ │
│ │ [✓] Enabled                             │ │
│ │ Client ID: [________________]          │ │
│ │ Client Secret: [________________]      │ │
│ │ [Test Connection] [Save]                │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ GitHub OAuth                             │ │
│ │ [✓] Enabled                              │ │
│ │ Client ID: [________________]           │ │
│ │ Client Secret: [________________]       │ │
│ │ [Test Connection] [Save]                 │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ System Information                           │
│ Version: 0.1.0                              │
│ Total Users: 5                              │
│ Database Size: 2.5 MB                       │
└─────────────────────────────────────────────┘
```

**Theme Variables:**
- Cards: `bg-card`, `bg-elevated`, `border-border`
- Text: `text-foreground`, `text-muted-foreground`
- Buttons: `bg-[var(--color-primary)]`
- Success: `bg-[var(--color-success)]`
- Error: `bg-[var(--color-error)]`

### 5.2 First Sign-Up Message

**Sign-Up Page (when `firstSetup=true`):**
```
┌─────────────────────────────────────────────┐
│ Create Owner Account                         │
│ ─────────────────────────────────────────── │
│ You're creating the first account.          │
│ You'll be the application owner with        │
│ access to admin settings.                    │
│                                              │
│ [Sign-up form...]                           │
└─────────────────────────────────────────────┘
```

---

## 6. Security Considerations

### 6.1 OAuth Secret Encryption

- **Encryption Algorithm:** AES-256-GCM
- **Key Management:** Store encryption key securely
- **Key Rotation:** Support for key rotation (future enhancement)
- **Decryption:** Only decrypt when needed (not stored in memory)

### 6.2 Access Control

- **Owner Verification:** Check owner status on every admin API call
- **Client-Side Hiding:** Hide admin UI from non-owners (UX only, not security)
- **Server-Side Validation:** Always validate owner status server-side
- **Rate Limiting:** Add rate limiting to admin endpoints

### 6.3 First User Protection

- **Atomic Operation:** Mark owner atomically during sign-up
- **Race Condition:** Handle concurrent first sign-ups (only one becomes owner)
- **Verification:** Verify owner status after sign-up

---

## 7. Dependencies & Environment

### 7.1 New Dependencies

**Encryption:**
- Use Node.js built-in `crypto` module (no new dependency)

**Optional:**
- Consider `node-forge` or `crypto-js` if more features needed

### 7.2 Environment Variables

```env
# OAuth Encryption Key (optional - will generate if not set)
OAUTH_ENCRYPTION_KEY=your-encryption-key-here

# Fallback: Use BETTER_AUTH_SECRET if OAUTH_ENCRYPTION_KEY not set
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

- Owner detection logic
- Encryption/decryption functions
- OAuth settings CRUD operations

### 8.2 Integration Tests

- First sign-up flow
- Admin API endpoints
- OAuth configuration updates
- Access control verification

### 8.3 E2E Tests

- Complete first sign-up → owner status
- Admin tab visibility
- OAuth settings save/load
- Non-owner access attempts

---

## 9. Success Criteria

### 9.1 Functional Requirements

- ✅ First user automatically becomes owner
- ✅ Admin tab only visible to owner
- ✅ OAuth settings can be configured through UI
- ✅ OAuth secrets are encrypted in database
- ✅ Better Auth uses database OAuth settings
- ✅ Non-owners cannot access admin features

### 9.2 Non-Functional Requirements

- ✅ UI uses semantic theme variables
- ✅ Responsive design
- ✅ Proper error handling
- ✅ Security best practices followed
- ✅ Performance: OAuth settings loaded efficiently

---

## 10. Rollback Plan

If issues arise:

1. **Database Schema:** Migration can be reverted (non-breaking)
2. **Owner Field:** Can be manually set via SQL if needed
3. **OAuth Settings:** Fallback to environment variables if database fails
4. **Admin Tab:** Can be hidden via feature flag if needed

---

## 11. Future Enhancements

### 11.1 Additional Admin Features

- Email service configuration (Resend/SMTP)
- System-wide settings
- User management (view all users)
- Database backup/restore
- System logs viewer

### 11.2 Security Enhancements

- Encryption key rotation
- Audit logging for admin actions
- Two-factor authentication for admin access
- IP whitelist for admin access

---

## 12. Implementation Timeline

**Total Estimated Time:** 1-2 days (12-16 hours)

**Day 1:**
- Step 1: Database schema updates (30 min)
- Step 2: Owner detection & helpers (1 hour)
- Step 3: First startup detection (1 hour)
- Step 4: OAuth encryption (1-2 hours)
- Step 5: Admin API endpoints (2 hours)

**Day 2:**
- Step 6: Admin tab component (3-4 hours)
- Step 7: Integrate admin tab (1 hour)
- Step 8: Update Better Auth config (2-3 hours)
- Step 9: Access control (1 hour)
- Step 10: Testing & polish (2-3 hours)

---

## 13. Notes

- All UI components must use semantic theme variables
- All API endpoints must include proper error handling
- All features must be mobile-responsive
- Owner status is permanent (cannot be transferred in v1)
- OAuth settings take precedence over environment variables
- Encryption key should be backed up securely

---

## 14. Getting Started

**First Task:** Step 1 - Database Schema Updates

1. Add `isApplicationOwner` field to `user` table
2. Create `oauthSettings` table
3. Create migration files
4. Run migrations

**Next:** Proceed to Step 2 after schema updates are complete.

