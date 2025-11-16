# Advanced Permission System Implementation Plan

## Overview

**Feature:** Advanced Permission System - Granular permission management beyond basic roles  
**Status:** Planning → Implementation  
**Priority:** High (Security Enhancement)  
**Estimated Time:** 1-2 days  
**Related Plan:** `docs/advanced-security-features-plan.md` (Phase 3)

## Objective

Extend the existing role-based permission system with granular, customizable permissions per household member. Allow admins/owners to override role-based defaults with custom permissions for individual members, enabling fine-grained access control.

## Current System Analysis

### Existing Components

1. **Database Schema** (`lib/db/schema.ts`):
   - `householdMembers` table with `role` field (owner/admin/member/viewer)
   - No custom permissions field currently

2. **Permission Logic** (`lib/household/permissions.ts`):
   - `PERMISSIONS` constant mapping roles to permission booleans
   - `hasPermission()` function checks role-based permissions only
   - `getUserPermissions()` returns role-based permissions only
   - 13 permissions defined across 4 roles

3. **API Endpoints**:
   - `/api/households/[householdId]/members/[memberId]` - Role management (PUT)
   - `/api/households/[householdId]/permissions` - Get user permissions (GET)

4. **Frontend Components**:
   - `components/settings/household-tab.tsx` - Member management UI
   - Member cards with role badges
   - Role change dropdown

### Permission Categories

**13 Permissions Organized by Category:**

1. **Membership (3):**
   - `invite_members` - Invite new members
   - `remove_members` - Remove existing members
   - `manage_permissions` - Manage custom permissions

2. **Accounts (3):**
   - `create_accounts` - Create new accounts
   - `edit_accounts` - Edit existing accounts
   - `delete_accounts` - Delete accounts

3. **Transactions (2):**
   - `create_transactions` - Create transactions
   - `edit_all_transactions` - Edit any transaction (not just own)

4. **Data (1):**
   - `view_all_data` - View all household data

5. **Budget (1):**
   - `manage_budget` - Manage budget categories and periods

6. **Household (2):**
   - `delete_household` - Delete the household
   - `leave_household` - Leave the household

## Technical Architecture

### Database Schema Changes

**File:** `lib/db/schema.ts`  
**Table:** `householdMembers`  
**Change:** Add `customPermissions` JSON field

```typescript
customPermissions: text('custom_permissions'), // JSON object: { "permission_name": true/false }
```

**Migration File:** `drizzle/0044_add_custom_permissions.sql`

```sql
-- Add custom permissions field to household_members table
ALTER TABLE household_members ADD COLUMN custom_permissions TEXT; -- JSON object
```

### Permission Resolution Logic

**File:** `lib/household/permissions.ts`

**New Functions:**
1. `getEffectivePermissions()` - Returns final permissions (role + custom overrides)
2. `hasCustomPermission()` - Check if custom permission override exists
3. `validatePermissionChange()` - Validate permission changes (security checks)

**Updated Functions:**
1. `hasPermission()` - Check custom permissions first, fall back to role
2. `getUserPermissions()` - Return effective permissions (role + custom)

**Resolution Rules:**
- Custom permissions override role defaults
- Deny takes precedence over allow (if custom permission is false, deny even if role allows)
- Owners cannot have permissions modified (always have all permissions)
- Last admin protection (cannot remove `manage_permissions` from last admin)

### API Endpoints

**Base Path:** `/api/households/[householdId]/members/[memberId]/permissions`

1. **GET** - Get member permissions
   - Returns: `{ rolePermissions, customPermissions, effectivePermissions }`
   - Auth: Must be member of household
   - Response:
     ```typescript
     {
       role: 'admin',
       rolePermissions: { invite_members: true, ... },
       customPermissions: { create_accounts: false } | null,
       effectivePermissions: { invite_members: true, create_accounts: false, ... }
     }
     ```

2. **PUT** - Update custom permissions
   - Body: `{ permissions: { "permission_name": true/false } }`
   - Auth: Requester must have `manage_permissions`
   - Validation:
     - Cannot modify owner permissions
     - Cannot remove `manage_permissions` from last admin
     - Must provide valid permission names
   - Response: Updated permissions object

3. **DELETE** - Reset to role defaults
   - Auth: Requester must have `manage_permissions`
   - Validation: Cannot reset owner permissions
   - Response: Success confirmation

### Frontend Components

**New Components:**

1. **`components/settings/permission-manager.tsx`**
   - Permission matrix/dialog component
   - Shows role defaults vs custom overrides
   - Toggle switches for each permission
   - Grouped by category
   - Save/Reset buttons
   - Warning messages for security-sensitive changes

2. **`components/settings/permission-card.tsx`** (optional)
   - Individual permission card component
   - Shows permission name, description, current value
   - Override toggle

**Updated Components:**

1. **`components/settings/household-tab.tsx`**
   - Add "Manage Permissions" button to member cards
   - Open permission manager dialog
   - Show permission override indicators on member cards

### UI/UX Design

**Permission Manager Dialog:**

```
┌─────────────────────────────────────────────────────────┐
│ Manage Permissions: John Doe (Admin)                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Membership                                               │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Invite Members          ✓ (Admin)    [Override]    │ │
│ │ Remove Members          ✓ (Admin)    [Override]    │ │
│ │ Manage Permissions      ✓ (Admin)    [Override]    │ │
│ └────────────────────────────────────────────────────┘ │
│                                                          │
│ Accounts                                                 │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Create Accounts         ✓ (Admin)    [Override]    │ │
│ │ Edit Accounts           ✓ (Admin)    [Override]    │ │
│ │ Delete Accounts         ✗ (Admin)    [Override]    │ │
│ └────────────────────────────────────────────────────┘ │
│                                                          │
│ [Reset to Role Defaults]  [Cancel]  [Save Changes]     │
└─────────────────────────────────────────────────────────┘
```

**Member Card Updates:**
- Add "Manage Permissions" button (only visible if user has `manage_permissions`)
- Show indicator badge if member has custom permissions
- Tooltip showing custom permission count

**Theme Variables:**
- `bg-card`, `bg-elevated` - Container backgrounds
- `border-border` - Borders and dividers
- `text-foreground`, `text-muted-foreground` - Text colors
- `bg-[var(--color-success)]` - Enabled permissions (green)
- `bg-[var(--color-error)]` - Disabled permissions (red)
- `bg-[var(--color-warning)]` - Custom overrides (amber)
- `bg-[var(--color-primary)]` - Action buttons

## Implementation Steps

### Step 1: Database Schema & Migration

**Tasks:**
1. Update `lib/db/schema.ts`:
   - Add `customPermissions` field to `householdMembers` table
   - Type: `text('custom_permissions')` (nullable)
   - Add JSDoc comment explaining JSON structure

2. Generate migration:
   ```bash
   pnpm drizzle-kit generate
   ```

3. Review migration file (`drizzle/0044_add_custom_permissions.sql`):
   - Verify SQL syntax
   - Ensure field is nullable (existing rows)

4. Apply migration:
   ```bash
   pnpm drizzle-kit migrate
   ```

5. Verify migration:
   - Check database schema
   - Verify existing rows have NULL for `custom_permissions`

**Files Modified:**
- `lib/db/schema.ts`

**Files Created:**
- `drizzle/0044_add_custom_permissions.sql`

**Testing:**
- Migration runs without errors
- Existing data preserved
- New field is nullable

---

### Step 2: Permission Resolution Logic

**Tasks:**
1. Update `lib/household/permissions.ts`:

   a. Add type for custom permissions:
   ```typescript
   export type CustomPermissions = Partial<Record<HouseholdPermission, boolean>>;
   ```

   b. Add helper function to get custom permissions from database:
   ```typescript
   async function getCustomPermissions(
     householdId: string,
     userId: string
   ): Promise<CustomPermissions | null>
   ```

   c. Update `hasPermission()` function:
   - Check custom permissions first
   - Fall back to role permissions
   - Deny takes precedence (if custom is false, deny)

   d. Add `getEffectivePermissions()` function:
   - Get role permissions
   - Get custom permissions
   - Merge with custom taking precedence
   - Return final effective permissions

   e. Add `validatePermissionChange()` function:
   - Check if target is owner (cannot modify)
   - Check if removing `manage_permissions` from last admin
   - Validate permission names
   - Return validation result

2. Update `getUserPermissions()` function:
   - Return effective permissions instead of just role permissions

**Files Modified:**
- `lib/household/permissions.ts`

**Testing:**
- Unit tests for permission resolution
- Test custom override logic
- Test deny precedence
- Test owner protection

---

### Step 3: Backend API Endpoints

**Tasks:**
1. Create `app/api/households/[householdId]/members/[memberId]/permissions/route.ts`:

   a. **GET endpoint:**
   - Verify user is member of household
   - Get member record
   - Get role permissions
   - Parse custom permissions JSON
   - Calculate effective permissions
   - Return combined response

   b. **PUT endpoint:**
   - Verify requester has `manage_permissions`
   - Get target member record
   - Validate target is not owner
   - Validate permission changes (last admin check)
   - Validate permission names
   - Update `customPermissions` field
   - Return updated permissions

   c. **DELETE endpoint:**
   - Verify requester has `manage_permissions`
   - Get target member record
   - Validate target is not owner
   - Set `customPermissions` to NULL
   - Return success

2. Add error handling:
   - 401 Unauthorized
   - 403 Forbidden (no permission)
   - 404 Not Found (member not found)
   - 400 Bad Request (validation errors)
   - 500 Internal Server Error

3. Add request validation:
   - Validate JSON structure
   - Validate permission names
   - Validate boolean values

**Files Created:**
- `app/api/households/[householdId]/members/[memberId]/permissions/route.ts`

**Testing:**
- Integration tests for all endpoints
- Test authorization checks
- Test validation logic
- Test owner protection
- Test last admin protection

---

### Step 4: Frontend Permission Manager Component

**Tasks:**
1. Create `components/settings/permission-manager.tsx`:

   a. Component structure:
   - Dialog wrapper (using shadcn Dialog)
   - Header with member name and role
   - Permission groups (Membership, Accounts, etc.)
   - Permission rows with toggle switches
   - Footer with action buttons

   b. State management:
   - `rolePermissions` - From role
   - `customPermissions` - Custom overrides
   - `effectivePermissions` - Calculated final permissions
   - `pendingChanges` - Unsaved changes
   - `loading` - Loading state
   - `saving` - Saving state

   c. Permission display:
   - Group permissions by category
   - Show role default with indicator
   - Show custom override toggle
   - Highlight custom overrides
   - Show effective permission (final result)

   d. Actions:
   - Toggle custom override
   - Reset to role defaults
   - Save changes
   - Cancel (discard changes)

   e. Validation & warnings:
   - Show warning if removing `manage_permissions` from last admin
   - Show info if target is owner (cannot modify)
   - Validate at least one admin has `manage_permissions`

2. Use theme variables throughout:
   - Container backgrounds
   - Text colors
   - Border colors
   - Status indicators (success/error/warning)
   - Button styles

**Files Created:**
- `components/settings/permission-manager.tsx`

**Dependencies:**
- shadcn Dialog component
- shadcn Switch component (for toggles)
- shadcn Button component
- Lucide icons (Shield, Lock, etc.)

**Testing:**
- Component renders correctly
- Toggles work as expected
- Save/reset functions work
- Validation messages display
- Theme variables applied correctly

---

### Step 5: Integration with Household Tab

**Tasks:**
1. Update `components/settings/household-tab.tsx`:

   a. Add state:
   - `permissionManagerOpen` - Dialog open state
   - `selectedMemberForPermissions` - Member being managed

   b. Add "Manage Permissions" button to member cards:
   - Only show if current user has `manage_permissions`
   - Only show for non-owner members
   - Open permission manager dialog

   c. Add permission override indicator:
   - Badge/icon showing if member has custom permissions
   - Tooltip showing custom permission count

   d. Integrate PermissionManager component:
   - Pass member data
   - Handle save callback
   - Refresh member list after save

2. Fetch permission data:
   - Optionally fetch permissions when opening dialog
   - Cache permission data

**Files Modified:**
- `components/settings/household-tab.tsx`

**Testing:**
- Button appears/disappears correctly
- Dialog opens with correct member data
- Changes save and reflect in UI
- Member list refreshes after save

---

### Step 6: Permission Enforcement Updates

**Tasks:**
1. Review existing API endpoints that check permissions:
   - Ensure they use updated `hasPermission()` function
   - Verify custom permissions are respected

2. Update any hardcoded role checks:
   - Replace with permission checks where appropriate
   - Use `hasPermission()` instead of role comparison

3. Add permission checks to new endpoints if needed:
   - Ensure all household-scoped endpoints check permissions

**Files to Review:**
- `app/api/households/[householdId]/members/[memberId]/route.ts`
- `app/api/households/[householdId]/invitations/route.ts`
- Other household API endpoints

**Testing:**
- Permission checks work with custom permissions
- Role-based permissions still work
- Custom overrides are enforced

---

### Step 7: Testing & Validation

**Tasks:**
1. Unit Tests (`lib/household/permissions.test.ts`):
   - Test `getEffectivePermissions()` with various scenarios
   - Test `hasPermission()` with custom overrides
   - Test deny precedence logic
   - Test owner protection
   - Test last admin protection

2. Integration Tests (`app/api/households/[householdId]/members/[memberId]/permissions/route.test.ts`):
   - Test GET endpoint
   - Test PUT endpoint (success cases)
   - Test PUT endpoint (validation failures)
   - Test DELETE endpoint
   - Test authorization checks

3. E2E Tests (optional):
   - Complete permission management flow
   - Test permission enforcement in UI

**Files Created:**
- `lib/household/permissions.test.ts`
- `app/api/households/[householdId]/members/[memberId]/permissions/route.test.ts`

**Testing Checklist:**
- ✅ Custom permissions override role defaults
- ✅ Deny takes precedence over allow
- ✅ Owners cannot have permissions modified
- ✅ Last admin protection works
- ✅ Permission changes are enforced immediately
- ✅ UI displays permissions correctly
- ✅ Save/reset functions work
- ✅ Validation messages display
- ✅ Theme variables applied correctly

---

### Step 8: Documentation & Polish

**Tasks:**
1. Update API documentation:
   - Document new endpoints
   - Document permission resolution logic
   - Document validation rules

2. Add JSDoc comments:
   - Document all new functions
   - Document permission resolution rules
   - Document security considerations

3. UI/UX polish:
   - Ensure consistent spacing
   - Ensure responsive design
   - Ensure accessibility (keyboard navigation, ARIA labels)
   - Ensure loading states
   - Ensure error handling

4. Update user documentation (if applicable):
   - How to manage permissions
   - Permission descriptions
   - Security best practices

**Files Modified:**
- Add JSDoc comments to new functions
- Update README or docs if applicable

---

## Security Considerations

### Permission Resolution Rules

1. **Deny Precedence:** If a custom permission is set to `false`, it denies access even if the role allows it. This ensures security-first approach.

2. **Owner Protection:** Owners always have all permissions and cannot have custom permissions set. This prevents accidental lockout.

3. **Last Admin Protection:** Cannot remove `manage_permissions` from the last admin in a household. This prevents losing all administrative access.

4. **Permission Inheritance:** Custom permissions only override specific permissions. If a permission is not in custom permissions, role default applies.

### Validation Rules

1. **Requester Authorization:** Only users with `manage_permissions` can modify permissions.

2. **Target Validation:** Cannot modify permissions for:
   - Owners (always have all permissions)
   - Non-existent members

3. **Permission Name Validation:** Only valid permission names from `HouseholdPermission` type are accepted.

4. **Last Admin Check:** Before removing `manage_permissions`, verify at least one other admin exists.

### Audit Considerations

- Consider logging permission changes for audit trail
- Track who changed permissions and when
- Store change history (future enhancement)

---

## Integration Points

### Settings Page Structure

**Household Settings → Members Tab:**
- Add "Manage Permissions" button to member cards
- Add permission override indicator badge
- Integrate PermissionManager dialog

### API Security

**All Permission Endpoints:**
- Require authentication
- Verify user is member of household
- Verify requester has `manage_permissions`
- Validate all inputs
- Handle errors gracefully

### Frontend Security

**Permission Manager:**
- Only show for authorized users
- Validate changes before saving
- Show warnings for security-sensitive changes
- Prevent invalid permission combinations

---

## Dependencies

### No New Dependencies Required

- Uses existing Drizzle ORM
- Uses existing shadcn/ui components
- Uses existing theme system
- Uses existing API patterns

### Optional Enhancements (Future)

- Permission templates/presets
- Permission groups
- Time-based permissions
- Permission audit log UI

---

## Success Criteria

### Functional Requirements

- ✅ Custom permissions override role defaults
- ✅ Deny takes precedence over allow
- ✅ Owners cannot have permissions modified
- ✅ Last admin protection works
- ✅ Permission changes are enforced immediately
- ✅ UI displays permissions correctly
- ✅ Save/reset functions work
- ✅ Validation messages display

### Non-Functional Requirements

- ✅ Theme variables used throughout
- ✅ Responsive design
- ✅ Accessibility (keyboard navigation, ARIA labels)
- ✅ Loading states
- ✅ Error handling
- ✅ Type safety (TypeScript)
- ✅ Code follows existing patterns

---

## Rollback Plan

If issues arise:

1. **Database:** Migration is additive (nullable field), can be ignored if needed
2. **API:** Endpoints are new, can be disabled without breaking existing functionality
3. **Frontend:** Component is isolated, can be hidden with feature flag
4. **Logic:** Permission resolution falls back to role-based if custom permissions are null

**Safe Rollback Steps:**
1. Hide "Manage Permissions" button in UI
2. Set all `customPermissions` to NULL in database
3. Permission system reverts to role-based only

---

## Notes

- All UI components must use semantic theme variables
- All API endpoints must include proper error handling
- All features must be mobile-responsive
- All features must include loading states and error messages
- All features must follow existing code patterns and conventions
- Permission changes should be immediate (no page refresh needed)
- Consider adding permission change notifications (future enhancement)

