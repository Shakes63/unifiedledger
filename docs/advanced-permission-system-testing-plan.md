# Advanced Permission System - Testing & Documentation Plan

## Overview

**Feature:** Advanced Permission System - Testing & Documentation Phase  
**Status:** Planning → Implementation  
**Priority:** High (Quality Assurance)  
**Estimated Time:** 1-2 days  
**Related Plan:** `docs/advanced-permission-system-plan.md` (Core implementation complete)

## Objective

Complete the remaining work for the Advanced Permission System:
1. **Unit Tests** - Comprehensive test coverage for permission resolution logic
2. **Integration Tests** - API endpoint testing with authorization and validation
3. **Documentation Polish** - JSDoc comments and code documentation improvements

## Current Status

### ✅ Completed (Core Implementation)
- Database schema with `customPermissions` field
- Permission resolution logic (`lib/household/permissions.ts`)
- Backend API endpoints (GET, PUT, DELETE)
- Frontend Permission Manager component
- Integration with Household Tab
- Permission enforcement via updated `hasPermission()`

### ⏳ Remaining Work
- Unit tests for permission resolution logic
- Integration tests for API endpoints
- JSDoc comments and documentation polish

## Testing Strategy

### Test Structure

Following existing test patterns from `__tests__/api/household-settings.test.ts`:
- Use Vitest for test framework
- Mock `@/lib/auth-helpers`, `@/lib/db`, and `@/lib/household/permissions` as needed
- Use descriptive test names with clear scenarios
- Group related tests with `describe` blocks
- Test both success and failure cases

### Test Coverage Goals

**Unit Tests (`lib/household/permissions.test.ts`):**
- ✅ Permission resolution with custom overrides
- ✅ Deny precedence logic
- ✅ Owner protection
- ✅ Last admin protection
- ✅ Edge cases (null custom permissions, invalid JSON, etc.)

**Integration Tests (`app/api/households/[householdId]/members/[memberId]/permissions/route.test.ts`):**
- ✅ GET endpoint - Success cases
- ✅ GET endpoint - Authorization failures
- ✅ PUT endpoint - Success cases
- ✅ PUT endpoint - Validation failures
- ✅ PUT endpoint - Authorization failures
- ✅ DELETE endpoint - Success cases
- ✅ DELETE endpoint - Authorization failures

## Implementation Steps

### Step 1: Unit Tests for Permission Resolution Logic

**File:** `__tests__/lib/household/permissions.test.ts`

**Test Cases:**

1. **`getUserHouseholdRole()`**
   - Returns correct role for existing member
   - Returns null for non-member
   - Handles multiple households correctly

2. **`getCustomPermissions()`**
   - Returns parsed custom permissions when set
   - Returns null when no custom permissions
   - Returns null for invalid JSON
   - Returns null for non-member

3. **`hasPermission()`**
   - Returns true for role-based permission (no custom override)
   - Returns false for denied role-based permission (no custom override)
   - Custom permission override (true) takes precedence
   - Custom permission override (false) takes precedence (deny)
   - Owners always have all permissions
   - Returns false for non-member

4. **`getEffectivePermissions()`**
   - Returns correct structure with all fields
   - Role permissions match role defaults
   - Custom permissions override role defaults
   - Deny takes precedence over allow
   - Returns null for non-member
   - Owners have all permissions (no custom overrides)

5. **`getUserPermissions()`**
   - Returns effective permissions
   - Matches `getEffectivePermissions().effectivePermissions`
   - Returns null for non-member

6. **`isMemberOfHousehold()`**
   - Returns true for member
   - Returns false for non-member

7. **`validatePermissionChange()`**
   - Validates owner protection (cannot modify)
   - Validates last admin protection (cannot remove manage_permissions)
   - Validates permission name validity
   - Returns success for valid changes
   - Handles non-existent member
   - Handles multiple admins correctly (allows removal if other admin exists)

**Test Data Setup:**
- Mock database queries using Vitest mocks
- Create test users with different roles
- Create test households with various member configurations
- Test custom permissions JSON strings

**Files Created:**
- `__tests__/lib/household/permissions.test.ts`

**Dependencies:**
- `vitest` (already installed)
- Mock `@/lib/db` and database queries
- Mock `householdMembers` table structure

---

### Step 2: Integration Tests for API Endpoints

**File:** `__tests__/api/household-member-permissions.test.ts`

**Test Cases:**

1. **GET `/api/households/[householdId]/members/[memberId]/permissions`**
   - ✅ Success: Returns permissions for member (any household member can view)
   - ✅ Success: Returns correct structure (role, rolePermissions, customPermissions, effectivePermissions)
   - ✅ 401 Unauthorized: Missing authentication
   - ✅ 403 Forbidden: Not a member of household
   - ✅ 404 Not Found: Member not found
   - ✅ 400 Bad Request: Member belongs to different household

2. **PUT `/api/households/[householdId]/members/[memberId]/permissions`**
   - ✅ Success: Updates custom permissions
   - ✅ Success: Returns updated effective permissions
   - ✅ Success: Empty object resets to null (role defaults)
   - ✅ 401 Unauthorized: Missing authentication
   - ✅ 403 Forbidden: Requester lacks `manage_permissions`
   - ✅ 403 Forbidden: Not a member of household
   - ✅ 404 Not Found: Member not found
   - ✅ 400 Bad Request: Invalid permissions object
   - ✅ 400 Bad Request: Cannot modify owner permissions
   - ✅ 400 Bad Request: Cannot remove manage_permissions from last admin
   - ✅ 400 Bad Request: Invalid permission name
   - ✅ 400 Bad Request: Member belongs to different household

3. **DELETE `/api/households/[householdId]/members/[memberId]/permissions`**
   - ✅ Success: Resets custom permissions to null
   - ✅ Success: Returns updated effective permissions (role defaults)
   - ✅ 401 Unauthorized: Missing authentication
   - ✅ 403 Forbidden: Requester lacks `manage_permissions`
   - ✅ 404 Not Found: Member not found
   - ✅ 400 Bad Request: Cannot reset owner permissions
   - ✅ 400 Bad Request: Member belongs to different household

**Test Scenarios:**

**Scenario 1: Admin managing member permissions**
- Admin user has `manage_permissions`
- Member has role-based permissions
- Admin adds custom override (e.g., `create_accounts: false`)
- Verify effective permissions reflect override

**Scenario 2: Last admin protection**
- Household has one admin (no owners)
- Attempt to remove `manage_permissions` from admin
- Should fail with validation error

**Scenario 3: Multiple admins**
- Household has two admins
- Remove `manage_permissions` from one admin
- Should succeed (other admin still has it)

**Scenario 4: Owner protection**
- Attempt to modify owner permissions
- Should fail with validation error

**Test Data Setup:**
- Mock `requireAuth()` to return test user IDs
- Mock `hasPermission()` for authorization checks
- Mock `isMemberOfHousehold()` for membership checks
- Mock database queries for member records
- Create test households with various member configurations

**Files Created:**
- `__tests__/api/household-member-permissions.test.ts`

**Dependencies:**
- `vitest` (already installed)
- Mock `@/lib/auth-helpers` (`requireAuth`)
- Mock `@/lib/household/permissions` (`hasPermission`, `isMemberOfHousehold`, `getEffectivePermissions`, `validatePermissionChange`)
- Mock `@/lib/db` and database operations

---

### Step 3: Documentation Polish & JSDoc Comments

**Files to Update:**

1. **`lib/household/permissions.ts`**
   - Add comprehensive JSDoc comments to all exported functions
   - Document permission resolution rules
   - Document security considerations
   - Add examples where helpful
   - Document parameter types and return types
   - Document error cases

2. **`app/api/households/[householdId]/members/[memberId]/permissions/route.ts`**
   - Add JSDoc comments to all endpoint handlers
   - Document request/response formats
   - Document error codes and meanings
   - Document authorization requirements
   - Document validation rules

3. **`components/settings/permission-manager.tsx`**
   - Add JSDoc comments to component props
   - Document component behavior
   - Document state management
   - Document user interactions

**JSDoc Standards:**

```typescript
/**
 * Brief description of function/component.
 * 
 * Detailed description explaining behavior, edge cases, and important notes.
 * 
 * @param paramName - Description of parameter
 * @param paramName2 - Description of second parameter
 * @returns Description of return value
 * @throws ErrorType - When this error is thrown
 * 
 * @example
 * ```typescript
 * const result = await functionName(param1, param2);
 * ```
 * 
 * @remarks
 * Important notes about security, performance, or behavior.
 */
```

**Documentation Topics:**

1. **Permission Resolution Rules:**
   - Custom permissions override role defaults
   - Deny takes precedence over allow
   - Owners always have all permissions
   - Last admin protection

2. **Security Considerations:**
   - Authorization checks required
   - Owner protection prevents lockout
   - Last admin protection prevents losing all admin access
   - Input validation prevents invalid permissions

3. **API Endpoint Documentation:**
   - Request/response formats
   - Authorization requirements
   - Error codes and meanings
   - Validation rules

**Files Modified:**
- `lib/household/permissions.ts`
- `app/api/households/[householdId]/members/[memberId]/permissions/route.ts`
- `components/settings/permission-manager.tsx`

---

## Testing Checklist

### Unit Tests Checklist

- [ ] `getUserHouseholdRole()` - All scenarios
- [ ] `getCustomPermissions()` - All scenarios
- [ ] `hasPermission()` - All scenarios (role-based, custom override, deny precedence, owner)
- [ ] `getEffectivePermissions()` - All scenarios
- [ ] `getUserPermissions()` - All scenarios
- [ ] `isMemberOfHousehold()` - All scenarios
- [ ] `validatePermissionChange()` - All validation scenarios

### Integration Tests Checklist

- [ ] GET endpoint - Success cases
- [ ] GET endpoint - Error cases (401, 403, 404, 400)
- [ ] PUT endpoint - Success cases
- [ ] PUT endpoint - Validation failures
- [ ] PUT endpoint - Authorization failures
- [ ] DELETE endpoint - Success cases
- [ ] DELETE endpoint - Authorization failures
- [ ] Edge cases (last admin, owner protection, etc.)

### Documentation Checklist

- [ ] JSDoc comments added to all exported functions
- [ ] Permission resolution rules documented
- [ ] Security considerations documented
- [ ] API endpoint documentation complete
- [ ] Component documentation complete
- [ ] Examples added where helpful
- [ ] Error cases documented

---

## Success Criteria

### Functional Requirements

- ✅ All unit tests pass (100% coverage of permission logic)
- ✅ All integration tests pass (100% coverage of API endpoints)
- ✅ Tests cover success and failure cases
- ✅ Tests cover edge cases (last admin, owner protection, etc.)
- ✅ Documentation is comprehensive and clear

### Non-Functional Requirements

- ✅ Tests follow existing patterns and conventions
- ✅ Tests are maintainable and readable
- ✅ Documentation uses consistent JSDoc format
- ✅ Documentation explains security considerations
- ✅ Code is well-documented for future maintainers

---

## Integration Points

### Test Setup

**Mock Structure:**
- Mock `@/lib/auth-helpers` for authentication
- Mock `@/lib/db` for database queries
- Mock `@/lib/household/permissions` for permission checks (integration tests)
- Use Vitest mocks with proper type safety

### Test Data

**Test Users:**
- `TEST_USER_ID_OWNER` - Owner role
- `TEST_USER_ID_ADMIN` - Admin role
- `TEST_USER_ID_MEMBER` - Member role
- `TEST_USER_ID_VIEWER` - Viewer role
- `TEST_USER_ID_NON_MEMBER` - Not a member

**Test Households:**
- `TEST_HOUSEHOLD_ID` - Standard household
- `TEST_HOUSEHOLD_ID_SINGLE_ADMIN` - Household with one admin (for last admin tests)
- `TEST_HOUSEHOLD_ID_MULTIPLE_ADMINS` - Household with multiple admins

**Test Members:**
- Various member configurations with different roles
- Custom permissions JSON strings for testing

---

## Dependencies

### No New Dependencies Required

- Uses existing Vitest test framework
- Uses existing mock patterns
- Uses existing test utilities

---

## Rollback Plan

If issues arise:

1. **Tests:** Can be disabled individually if needed
2. **Documentation:** JSDoc comments don't affect functionality
3. **No breaking changes:** All changes are additive

**Safe Rollback Steps:**
1. Comment out failing tests temporarily
2. Fix issues and re-enable tests
3. No database or API changes needed

---

## Notes

- All tests must follow existing patterns from `__tests__/api/household-settings.test.ts`
- All tests must use semantic naming conventions
- All tests must include clear descriptions
- All documentation must use consistent JSDoc format
- All security considerations must be documented
- Consider adding performance tests if needed (future enhancement)

