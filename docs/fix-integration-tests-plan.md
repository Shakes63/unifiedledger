# Implementation Plan: Fix Integration Tests After Household Data Isolation

## Overview

After the Household Data Isolation (Phases 0-4) was implemented, 75 tests across 9 test files were failing. The primary cause is that test utilities and integration tests hadn't been updated to include the required `householdId` field that's now mandatory in the database schema for accounts, transactions, categories, merchants, and other tables.

## Current State (After Partial Fix - 2025-11-28)

| Metric | Before | After |
|--------|--------|-------|
| Failing Tests | 75 | 50 |
| Passing Tests | 515 | 540 |
| Total Tests | 590 | 590 |
| Failing Test Files | 9 | 5 |
| Passing Test Files | 7 | 11 |

## Progress Made

### Completed (Phase 1 - Integration Tests)
1. ✅ **Test Utilities Updated** (`__tests__/integration/test-utils.ts`)
   - Added `householdId` parameter to all factory functions
   - Added `createTestHousehold()` and `createTestHouseholdMember()` factories
   - Added `setupTestUserWithHousehold()` helper
   - Added `cleanupTestHousehold()` helper

2. ✅ **post-creation-actions.test.ts** (7 tests)
   - All tests pass with household support
   - Fixed test expectations for transfer matching scoring algorithm

3. ✅ **rules-flow.test.ts** (10 tests)
   - All tests pass with household support

4. ✅ **rule-execution-logging.test.ts** (3 tests)
   - All tests pass with household support

5. ✅ **bulk-apply-rules.test.ts** (5 tests)
   - All tests pass with household support
   - Updated error handling test expectations

### Remaining (Phase 2 - Unit Test Mocks)
These are unit tests that mock the database. The mocks need to be updated to include `householdId` and the function signatures have changed:

### Failing Test Files

1. `__tests__/integration/post-creation-actions.test.ts` - 7 tests (NOT NULL constraint on household_id)
2. `__tests__/integration/rules-flow.test.ts` - 10 tests (NOT NULL constraint on household_id)
3. `__tests__/integration/rule-execution-logging.test.ts` - 3 tests (NOT NULL constraint on household_id)
4. `__tests__/lib/rules/actions-executor.test.ts` - ~7 tests (set_sales_tax action issues)
5. `__tests__/lib/migrate-to-household-preferences.test.ts` - ~10 tests (migration helper tests)
6. `__tests__/lib/rules/rule-matcher.test.ts` - ~10 tests (rule matcher edge cases)
7. And 3 more test files with various failures

## Root Causes

### 1. Missing `householdId` in Test Utilities
The test factories in `__tests__/integration/test-utils.ts` don't include `householdId`:
- `createTestTransaction()` - missing `householdId`
- `createTestAccount()` - missing `householdId`
- `createTestCategory()` - missing `householdId`
- `createTestMerchant()` - missing `householdId`
- `createTestRule()` - missing `householdId`

### 2. No Test Household Setup
Integration tests don't create test households before creating other data. The database schema now requires:
- `households` table record
- `householdMembers` table record linking user to household

### 3. Unit Test Mocks Out of Date
Some unit tests mock the database but the mocks don't reflect the new schema requirements.

## Implementation Steps

### Step 1: Update Test Utilities (test-utils.ts)

**File:** `__tests__/integration/test-utils.ts`

#### 1.1 Add Household Factory Functions

```typescript
export interface TestHousehold {
  id?: string;
  name: string;
  ownerId: string;
  createdAt?: string;
}

export interface TestHouseholdMember {
  id?: string;
  householdId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt?: string;
}

export function createTestHousehold(
  ownerId: string,
  overrides?: Partial<TestHousehold>
): TestHousehold {
  return {
    id: nanoid(),
    name: "Test Household",
    ownerId,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestHouseholdMember(
  householdId: string,
  userId: string,
  overrides?: Partial<TestHouseholdMember>
): TestHouseholdMember {
  return {
    id: nanoid(),
    householdId,
    userId,
    role: 'owner',
    joinedAt: new Date().toISOString(),
    ...overrides,
  };
}
```

#### 1.2 Update Existing Factory Functions

Add `householdId` parameter to all existing factories:

```typescript
export function createTestTransaction(
  userId: string,
  householdId: string,  // NEW required parameter
  accountId: string,
  overrides?: Partial<TestTransaction>
): TestTransaction {
  return {
    id: nanoid(),
    userId,
    householdId,  // NEW
    accountId,
    // ... rest of fields
  };
}

export function createTestAccount(
  userId: string,
  householdId: string,  // NEW required parameter
  overrides?: Partial<TestAccount>
): TestAccount {
  return {
    id: nanoid(),
    userId,
    householdId,  // NEW
    // ... rest of fields
  };
}

// Same pattern for createTestCategory, createTestMerchant, createTestRule
```

#### 1.3 Add Test Setup Helper

```typescript
/**
 * Setup test user with household - call at start of each test suite
 */
export async function setupTestUserWithHousehold(
  db: typeof import('@/lib/db').db
): Promise<{ userId: string; householdId: string }> {
  const userId = generateTestUserId();
  
  // Create household
  const householdData = createTestHousehold(userId);
  const [household] = await db.insert(households).values(householdData).returning();
  
  // Create household member
  const memberData = createTestHouseholdMember(household.id, userId);
  await db.insert(householdMembers).values(memberData);
  
  return { userId, householdId: household.id };
}

/**
 * Cleanup test household and all related data
 */
export async function cleanupTestHousehold(
  db: typeof import('@/lib/db').db,
  userId: string,
  householdId: string
): Promise<void> {
  // Delete in correct order for foreign keys
  await db.delete(transactionSplits).where(eq(transactionSplits.userId, userId));
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
  await db.delete(budgetCategories).where(eq(budgetCategories.userId, userId));
  await db.delete(merchants).where(eq(merchants.userId, userId));
  await db.delete(categorizationRules).where(eq(categorizationRules.userId, userId));
  await db.delete(householdMembers).where(eq(householdMembers.householdId, householdId));
  await db.delete(households).where(eq(households.id, householdId));
}
```

### Step 2: Update Integration Tests

#### 2.1 Update post-creation-actions.test.ts

```typescript
describe("Integration: Post-Creation Action Handlers", () => {
  let testUserId: string;
  let testHouseholdId: string;
  let testAccount1Id: string;
  // ...

  beforeEach(async () => {
    // Setup user with household FIRST
    const setup = await setupTestUserWithHousehold(db);
    testUserId = setup.userId;
    testHouseholdId = setup.householdId;

    // Create accounts WITH householdId
    const account1Data = createTestAccount(testUserId, testHouseholdId, {
      name: "Checking",
      currentBalance: 1000.00,
    });
    // ...
  });

  afterEach(async () => {
    await cleanupTestHousehold(db, testUserId, testHouseholdId);
  });
});
```

#### 2.2 Update rules-flow.test.ts

Same pattern - add household setup in beforeEach and cleanup in afterEach.

#### 2.3 Update rule-execution-logging.test.ts

Same pattern - add household setup in beforeEach and cleanup in afterEach.

### Step 3: Update Unit Test Mocks

For unit tests that mock the database, update the mock data to include `householdId`:

```typescript
// Example in actions-executor.test.ts
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([
      {
        id: 'cat-1',
        userId: 'user-123',
        householdId: 'household-123',  // Add this
        name: 'Test Category',
        // ...
      }
    ]),
  }
}));
```

### Step 4: Fix Migration Helper Tests

The `migrate-to-household-preferences.test.ts` tests need updated mocks to reflect the new table structures.

### Step 5: Fix Rule Matcher Tests

Update mocks and test data to include `householdId` where required.

## File Changes Summary

| File | Changes Required |
|------|-----------------|
| `__tests__/integration/test-utils.ts` | Add household factories, update all factories with householdId, add setup/cleanup helpers |
| `__tests__/integration/post-creation-actions.test.ts` | Add household setup/cleanup, update factory calls |
| `__tests__/integration/rules-flow.test.ts` | Add household setup/cleanup, update factory calls |
| `__tests__/integration/rule-execution-logging.test.ts` | Add household setup/cleanup, update factory calls |
| `__tests__/lib/rules/actions-executor.test.ts` | Update mocks with householdId |
| `__tests__/lib/rules/rule-matcher.test.ts` | Update mocks with householdId |
| `__tests__/lib/migrate-to-household-preferences.test.ts` | Update mocks with new table structures |

## Estimated Effort

- **Step 1 (Test Utilities):** 30 minutes
- **Step 2 (Integration Tests):** 1-2 hours
- **Step 3 (Unit Test Mocks):** 1 hour
- **Step 4 (Migration Helper Tests):** 30 minutes
- **Step 5 (Rule Matcher Tests):** 30 minutes

**Total Estimated Time:** 3-4 hours

## Testing Strategy

1. Fix test utilities first
2. Run tests incrementally after each file update
3. Verify all 590 tests pass before completion
4. Update bugs.md to reflect completion

## Success Criteria

- [ ] All 590 tests pass (0 failures)
- [ ] Test utilities support householdId parameter
- [ ] Integration tests properly create/cleanup test households
- [ ] Unit test mocks reflect current schema requirements
- [ ] bugs.md updated to mark task complete

## Notes

- The original bugs.md description "Fix 2 date handling edge cases in transfer matching tests" understates the issue
- The actual problem is 75 failing tests due to missing household support in test infrastructure
- This is a technical debt item from the Household Data Isolation implementation (Phases 0-4)

