# Advanced Security Features Implementation Plan

## Overview

This document outlines the implementation plan for three advanced security features:
1. **Two-Factor Authentication (2FA)** - TOTP-based authentication ✅ **COMPLETE**
2. **OAuth Provider Management** - Social login integration (Google, GitHub, etc.) ✅ **COMPLETE** (See Completed Features in features.md)
3. **Advanced Permission System** - Granular permission management beyond basic roles ⏳ **PENDING**

**Status:** Phases 1-2 Complete, Phase 3 Pending  
**Target Completion:** 1-2 days remaining  
**Priority:** High (Security Enhancement)

---

## 1. Two-Factor Authentication (2FA)

### 1.1 Feature Overview

**Objective:** Implement TOTP (Time-based One-Time Password) two-factor authentication using authenticator apps (Google Authenticator, Authy, etc.)

**User Flow:**
1. User enables 2FA in Privacy & Security settings
2. System generates QR code with secret key
3. User scans QR code with authenticator app
4. User enters verification code to confirm setup
5. On subsequent logins, user enters password + 6-digit code from app

**Benefits:**
- Enhanced account security
- Protection against password breaches
- Industry-standard security practice

### 1.2 Technical Architecture

**Backend Components:**
- Database schema updates (`auth-schema.ts`):
  - Add `twoFactorEnabled` boolean to `user` table
  - Add `twoFactorSecret` encrypted text field to `user` table
  - Add `twoFactorBackupCodes` JSON array to `user` table (8-10 codes)
  - Add `twoFactorVerifiedAt` timestamp to track when 2FA was verified
  
- Better Auth Integration:
  - Check Better Auth plugin support for 2FA/TOTP
  - If plugin exists: Use Better Auth's built-in 2FA plugin
  - If not: Implement custom TOTP using `otpauth` or `speakeasy` library
  
- API Endpoints (`app/api/user/two-factor/`):
  - `POST /api/user/two-factor/enable` - Generate secret and QR code
  - `POST /api/user/two-factor/verify` - Verify setup code
  - `POST /api/user/two-factor/disable` - Disable 2FA (requires password)
  - `GET /api/user/two-factor/backup-codes` - Generate new backup codes
  - `POST /api/user/two-factor/verify-login` - Verify code during login

**Frontend Components:**
- `components/settings/two-factor-section.tsx` - Main 2FA management UI
- QR code display component (using `qrcode.react` or similar)
- Backup codes display/download component
- Integration into `components/settings/privacy-tab.tsx`

**Dependencies:**
- `speakeasy` or `otpauth` for TOTP generation/verification
- `qrcode` or `qrcode.react` for QR code generation
- `qrcode-generator` for server-side QR code generation

### 1.3 Database Migration

**Migration File:** `drizzle/0043_add_two_factor_auth.sql`

```sql
-- Add 2FA fields to user table
ALTER TABLE user ADD COLUMN two_factor_enabled INTEGER DEFAULT 0;
ALTER TABLE user ADD COLUMN two_factor_secret TEXT;
ALTER TABLE user ADD COLUMN two_factor_backup_codes TEXT; -- JSON array
ALTER TABLE user ADD COLUMN two_factor_verified_at INTEGER;
```

### 1.4 Implementation Steps

**Step 1.1: Install Dependencies**
- Install TOTP library (`speakeasy` or `otpauth`)
- Install QR code library (`qrcode` or `qrcode.react`)

**Step 1.2: Database Schema & Migration**
- Update `auth-schema.ts` with 2FA fields
- Create migration file
- Run migration

**Step 1.3: Backend API Endpoints**
- Create `/api/user/two-factor/enable` endpoint
  - Generate secret key
  - Create QR code data URL
  - Return QR code and secret (for manual entry)
- Create `/api/user/two-factor/verify` endpoint
  - Verify TOTP code matches secret
  - Generate backup codes
  - Enable 2FA on user account
- Create `/api/user/two-factor/disable` endpoint
  - Require password verification
  - Clear secret and backup codes
  - Disable 2FA
- Create `/api/user/two-factor/backup-codes` endpoint
  - Generate new backup codes (invalidates old ones)
- Create `/api/user/two-factor/verify-login` endpoint
  - Verify TOTP code during login flow
  - Check backup codes as fallback

**Step 1.4: Frontend UI Components**
- Create `TwoFactorSection` component
  - Enable/disable toggle
  - QR code display modal
  - Backup codes display/download
  - Status indicator
- Integrate into `PrivacyTab`
- Add 2FA verification step to sign-in flow

**Step 1.5: Login Flow Integration**
- Update `app/sign-in/[[...index]]/page.tsx`
  - After password verification, check if 2FA enabled
  - Show 2FA code input if enabled
  - Verify code before completing login

**Step 1.6: Middleware Updates**
- Ensure 2FA verification is checked for protected routes
- Handle 2FA-required redirects

**Step 1.7: Testing**
- Unit tests for TOTP generation/verification
- Integration tests for enable/disable flow
- E2E tests for login with 2FA

### 1.5 UI/UX Design

**Privacy & Security Tab Integration:**
- Add new section "Two-Factor Authentication" below "Session Security"
- Status card showing:
  - Current status (Enabled/Disabled)
  - Last verified date
  - Backup codes count
- Enable button → Opens modal with QR code
- Disable button → Requires password confirmation
- Backup codes section → View/download codes

**Theme Variables:**
- Use `bg-card`, `bg-elevated`, `border-border` for containers
- Use `text-foreground`, `text-muted-foreground` for text
- Use `bg-[var(--color-success)]` for enabled status
- Use `bg-[var(--color-warning)]` for setup incomplete
- Use `bg-[var(--color-error)]` for error states

---

## 2. OAuth Provider Management

### 2.1 Feature Overview

**Objective:** Allow users to link/unlink OAuth providers (Google, GitHub, etc.) for social login

**Supported Providers (Initial):**
- Google
- GitHub
- Microsoft (future)
- Apple (future)

**User Flow:**
1. User navigates to Privacy & Security → OAuth Providers
2. User clicks "Link Google" → Redirects to OAuth consent
3. User authorizes → Redirects back → Provider linked
4. User can set primary login method
5. User can unlink providers (must keep at least one)

**Benefits:**
- Convenient social login
- Reduced password fatigue
- Industry-standard authentication

### 2.2 Technical Architecture

**Backend Components:**
- Better Auth OAuth Plugin:
  - Check Better Auth's OAuth plugin support
  - Configure providers in `lib/better-auth.ts`
  - Set up OAuth callbacks
  
- Database:
  - Better Auth's `account` table already exists in `auth-schema.ts`
  - Tracks linked OAuth providers per user
  
- API Endpoints (`app/api/user/oauth/`):
  - `GET /api/user/oauth/providers` - List linked providers
  - `POST /api/user/oauth/link/[provider]` - Initiate OAuth link
  - `DELETE /api/user/oauth/unlink/[provider]` - Unlink provider
  - `POST /api/user/oauth/set-primary` - Set primary login method

**Frontend Components:**
- `components/settings/oauth-providers-section.tsx` - Provider management UI
- Integration into `components/settings/privacy-tab.tsx`
- OAuth callback handler page

**Environment Variables:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL` (for OAuth redirects)

### 2.3 Implementation Steps

**Step 2.1: Better Auth OAuth Configuration**
- Research Better Auth OAuth plugin documentation
- Install/configure OAuth plugin in `lib/better-auth.ts`
- Set up Google OAuth credentials
- Set up GitHub OAuth credentials

**Step 2.2: Database Schema**
- Verify `account` table structure supports OAuth
- Add `isPrimary` boolean field if needed for primary login method

**Step 2.3: Backend API Endpoints**
- Create `/api/user/oauth/providers` endpoint
  - Query Better Auth account table
  - Return list of linked providers with metadata
- Create `/api/user/oauth/link/[provider]` endpoint
  - Redirect to Better Auth OAuth flow
- Create `/api/user/oauth/unlink/[provider]` endpoint
  - Verify user has at least one login method remaining
  - Unlink provider from account
- Create `/api/user/oauth/set-primary` endpoint
  - Set primary login method preference

**Step 2.4: Frontend UI Components**
- Create `OAuthProvidersSection` component
  - List available providers (Google, GitHub)
  - Show linked providers with status
  - Link/unlink buttons
  - Primary method selector
- Integrate into `PrivacyTab`
- Create OAuth callback page (`app/auth/oauth/callback/page.tsx`)

**Step 2.5: Sign-In Page Updates**
- Add "Sign in with Google" button
- Add "Sign in with GitHub" button
- Handle OAuth sign-in flow

**Step 2.6: Testing**
- Test OAuth link flow
- Test OAuth unlink flow
- Test OAuth sign-in flow
- Test primary method switching

### 2.4 UI/UX Design

**Privacy & Security Tab Integration:**
- Add new section "OAuth Providers" below "Two-Factor Authentication"
- Provider cards showing:
  - Provider name and icon
  - Status (Linked/Not Linked)
  - Primary method indicator
  - Link/Unlink button
- Warning when unlinking last provider
- Info about setting primary method

**Theme Variables:**
- Use provider brand colors for buttons (Google blue, GitHub black)
- Use `bg-card`, `bg-elevated` for cards
- Use `border-border` for borders
- Use `text-foreground`, `text-muted-foreground` for text

---

## 3. Advanced Permission System ✅ **IMPLEMENTED**

**Status:** Core implementation complete (see `docs/advanced-permission-system-plan.md` for detailed implementation)

**Implementation Summary:**
- ✅ Database schema with `customPermissions` JSON field
- ✅ Permission resolution logic with custom overrides (deny takes precedence)
- ✅ Backend API endpoints (GET, PUT, DELETE)
- ✅ Frontend Permission Manager component with grouped permissions
- ✅ Integration with Household Tab
- ✅ Permission enforcement via updated `hasPermission()` function

**Remaining:**
- ⏳ Unit tests and integration tests
- ⏳ Documentation polish

**Note:** See `docs/advanced-permission-system-plan.md` for the complete implementation plan and details.

### 3.2 Technical Architecture

**Backend Components:**
- Database schema updates (`lib/db/schema.ts`):
  - Add `customPermissions` JSON field to `householdMembers` table
  - Stores permission overrides: `{ "create_transactions": true, "edit_all_transactions": false }`
  
- Permission resolution logic (`lib/household/permissions.ts`):
  - Update `hasPermission()` to check custom permissions first
  - Fall back to role-based permissions if no override
  - Deny takes precedence over allow
  
- API Endpoints (`app/api/households/[householdId]/members/[memberId]/permissions/`):
  - `GET /api/households/[householdId]/members/[memberId]/permissions` - Get member permissions
  - `PUT /api/households/[householdId]/members/[memberId]/permissions` - Update permissions
  - `DELETE /api/households/[householdId]/members/[memberId]/permissions` - Reset to role defaults

**Frontend Components:**
- `components/settings/permission-manager.tsx` - Permission management UI
- Integration into `components/settings/household-tab.tsx`
- Permission matrix view (member × permission)

**Permission Categories:**
- **Membership:** invite_members, remove_members, manage_permissions
- **Accounts:** create_accounts, edit_accounts, delete_accounts
- **Transactions:** create_transactions, edit_all_transactions
- **Data:** view_all_data
- **Budget:** manage_budget
- **Household:** delete_household, leave_household

### 3.3 Database Migration

**Migration File:** `drizzle/0044_add_custom_permissions.sql`

```sql
-- Add custom permissions field to household_members table
ALTER TABLE household_members ADD COLUMN custom_permissions TEXT; -- JSON object
```

### 3.4 Implementation Steps

**Step 3.1: Database Schema & Migration**
- Update `householdMembers` schema in `lib/db/schema.ts`
- Add `customPermissions` JSON field
- Create migration file
- Run migration

**Step 3.2: Permission Resolution Logic**
- Update `lib/household/permissions.ts`:
  - Modify `hasPermission()` to check custom permissions
  - Add `getEffectivePermissions()` function
  - Add permission validation helpers
  - Handle permission conflicts (deny > allow)

**Step 3.3: Backend API Endpoints**
- Create `/api/households/[householdId]/members/[memberId]/permissions` GET endpoint
  - Return role-based + custom permissions
  - Include effective permissions (final result)
- Create `/api/households/[householdId]/members/[memberId]/permissions` PUT endpoint
  - Validate requester has `manage_permissions`
  - Validate target member isn't owner (owners can't have permissions changed)
  - Validate permission changes (e.g., can't remove last admin)
  - Update custom permissions
- Create `/api/households/[householdId]/members/[memberId]/permissions` DELETE endpoint
  - Reset custom permissions to null (use role defaults)

**Step 3.4: Frontend UI Components**
- Create `PermissionManager` component
  - Permission matrix (permission × enabled/disabled)
  - Role-based defaults shown
  - Custom overrides highlighted
  - Save/Reset buttons
- Create `PermissionCard` component for individual permission
  - Permission name and description
  - Current value (from role or custom)
  - Override toggle
- Integrate into `HouseholdTab` member management section

**Step 3.5: Permission Validation**
- Add client-side validation
- Prevent invalid permission combinations
- Show warnings for security implications

**Step 3.6: Testing**
- Unit tests for permission resolution logic
- Integration tests for API endpoints
- E2E tests for permission management UI

### 3.5 UI/UX Design

**Household Settings → Members Tab Integration:**
- Add "Manage Permissions" button to each member card
- Opens modal/drawer with permission matrix
- Group permissions by category
- Show role-based defaults with indicator
- Highlight custom overrides
- Warning messages for security-sensitive changes

**Permission Matrix Layout:**
```
Permission                    Role Default    Custom Override
─────────────────────────────────────────────────────────────
Invite Members                ✓ (Admin)      [Toggle]
Remove Members                ✓ (Admin)      [Toggle]
Manage Permissions            ✓ (Admin)      [Toggle]
Create Accounts               ✗ (Member)     [Toggle]
...
```

**Theme Variables:**
- Use `bg-card`, `bg-elevated` for containers
- Use `border-border` for matrix borders
- Use `text-foreground`, `text-muted-foreground` for text
- Use `bg-[var(--color-success)]` for enabled permissions
- Use `bg-[var(--color-error)]` for disabled permissions
- Use `bg-[var(--color-warning)]` for custom overrides

---

## 4. Integration Points

### 4.1 Settings Page Structure

**Privacy & Security Tab Updates:**
- Add "Two-Factor Authentication" section
- Add "OAuth Providers" section
- Maintain existing sections (Sessions, Data Export, Danger Zone)

**Household Settings → Members Tab Updates:**
- Add "Manage Permissions" button to member cards
- Add permission management modal/drawer

### 4.2 Authentication Flow Updates

**Sign-In Page:**
- Add OAuth provider buttons
- Add 2FA code input step (conditional)
- Handle OAuth callbacks

**Middleware:**
- Verify 2FA status for protected routes
- Handle OAuth authentication
- Check permissions for household-scoped routes

### 4.3 API Security

**All Endpoints:**
- Require authentication
- Verify user owns data/household
- Rate limiting for sensitive operations (2FA, OAuth)

**2FA Endpoints:**
- Require password for disable
- Rate limit verification attempts (prevent brute force)

**OAuth Endpoints:**
- Verify user owns account
- Prevent unlinking last login method

**Permission Endpoints:**
- Verify requester has `manage_permissions`
- Prevent modifying owner permissions
- Validate permission changes

---

## 5. Dependencies & Libraries

### 5.1 New Dependencies

**2FA:**
- `speakeasy` (v2.32.0) - TOTP generation/verification
- `qrcode` (v1.5.3) - QR code generation (server-side)
- `qrcode.react` (v3.1.0) - QR code display (client-side)

**OAuth:**
- Better Auth OAuth plugin (if available)
- Or manual OAuth implementation with `oauth4webapi` or similar

**Permissions:**
- No new dependencies (uses existing Drizzle ORM)

### 5.2 Environment Variables

```env
# 2FA (no env vars needed - uses app secret)

# OAuth - Google
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# OAuth - GitHub
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# OAuth - Redirect URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or production URL
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

**2FA:**
- TOTP code generation
- TOTP code verification
- Backup code generation/validation
- QR code generation

**OAuth:**
- Provider linking/unlinking
- Primary method switching
- OAuth callback handling

**Permissions:**
- Permission resolution logic
- Custom permission overrides
- Permission conflict resolution

### 6.2 Integration Tests

**2FA:**
- Enable/disable flow
- Login with 2FA
- Backup code usage

**OAuth:**
- OAuth link flow
- OAuth sign-in flow
- Provider management

**Permissions:**
- Permission API endpoints
- Permission UI interactions
- Permission enforcement

### 6.3 E2E Tests

- Complete 2FA setup and login flow
- Complete OAuth link and sign-in flow
- Complete permission management flow

---

## 7. Security Considerations

### 7.1 2FA Security

- **Secret Storage:** Encrypt 2FA secrets at rest
- **Backup Codes:** Hash backup codes (don't store plaintext)
- **Rate Limiting:** Limit verification attempts (5 attempts per 15 minutes)
- **Session Management:** Require 2FA verification for sensitive operations

### 7.2 OAuth Security

- **State Parameter:** Use state parameter to prevent CSRF
- **PKCE:** Use PKCE for public clients (if applicable)
- **Token Storage:** Store tokens securely (encrypted)
- **Provider Validation:** Validate provider responses

### 7.3 Permission Security

- **Permission Inheritance:** Deny takes precedence over allow
- **Owner Protection:** Owners can't have permissions modified
- **Last Admin Protection:** Prevent removing last admin
- **Audit Logging:** Log permission changes for audit trail

---

## 8. Implementation Timeline

### Phase 1: Two-Factor Authentication ✅ **COMPLETE** (2025-01-XX)
- ✅ Database schema & migration
- ✅ Backend API endpoints
- ✅ Frontend UI components
- ✅ Login flow integration
- ✅ Testing
- ✅ Documentation (`docs/2fa-testing-guide.md`)

### Phase 2: OAuth Provider Management (Day 2-3)
- ✅ Better Auth OAuth configuration
- ✅ Backend API endpoints
- ✅ Frontend UI components
- ✅ Sign-in page updates
- ✅ Testing

### Phase 3: Advanced Permission System (Day 3-4)
- ✅ Database schema & migration
- ✅ Permission resolution logic
- ✅ Backend API endpoints
- ✅ Frontend UI components
- ✅ Testing

### Phase 4: Integration & Polish (Day 4)
- ✅ Integration testing
- ✅ UI/UX polish
- ✅ Documentation
- ✅ Security audit

---

## 9. Success Criteria

### 2FA
- ✅ Users can enable/disable 2FA
- ✅ QR codes generate correctly
- ✅ TOTP codes verify correctly
- ✅ Backup codes work as fallback
- ✅ Login flow requires 2FA when enabled

### OAuth
- ✅ Users can link Google/GitHub accounts
- ✅ Users can unlink providers (with safeguards)
- ✅ Users can sign in with OAuth
- ✅ Primary login method can be set

### Permissions
- ✅ Custom permissions override role defaults
- ✅ Permission changes are enforced immediately
- ✅ Owners can't have permissions modified
- ✅ Last admin protection works

---

## 10. Future Enhancements

### 2FA
- SMS-based 2FA (Twilio integration)
- Hardware security keys (WebAuthn/FIDO2)
- Recovery email for 2FA reset

### OAuth
- Additional providers (Microsoft, Apple, Discord)
- OAuth account merging
- OAuth account unlinking with data migration

### Permissions
- Permission templates (presets)
- Permission groups
- Time-based permissions (temporary access)
- Permission audit log UI

---

## 11. Documentation Updates

### User Documentation
- 2FA setup guide
- OAuth provider linking guide
- Permission management guide

### Developer Documentation
- API endpoint documentation
- Permission system architecture
- OAuth integration guide

---

## 12. Rollback Plan

If issues arise:
1. **2FA:** Disable feature flag, keep database schema (non-breaking)
2. **OAuth:** Remove OAuth buttons, keep database schema (non-breaking)
3. **Permissions:** Revert to role-based only, ignore custom permissions field

---

## Notes

- All UI components must use semantic theme variables
- All API endpoints must include proper error handling
- All features must be mobile-responsive
- All features must include loading states and error messages
- All features must follow existing code patterns and conventions

