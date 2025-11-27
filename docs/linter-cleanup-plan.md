# Linter Cleanup Plan

**Date:** 2025-11-27  
**Status:** In Progress  
**Original Issues:** 886 (420 errors, 466 warnings)
**Current Issues:** 730 (419 errors, 311 warnings)
**Fixed:** 156 (1 error, 155 warnings)

## Overview

This plan addresses the ESLint errors and warnings across the codebase:
- **420 errors:** `@typescript-eslint/no-explicit-any` - Replace `any` with proper types
- **466 warnings:** `@typescript-eslint/no-unused-vars` - Remove or prefix unused variables

## Distribution by Directory

| Directory | Files with Issues |
|-----------|------------------|
| components/ | 118 |
| app/ (API + pages) | 114 |
| lib/ | 35 |
| __tests__/ | 10 |
| scripts/ | 9 |
| contexts/ | 3 |
| hooks/ | 2 |

## Strategy

### Phase 1: Warnings (Low Risk, Quick Wins)
Fix `@typescript-eslint/no-unused-vars` warnings first:
1. Remove unused imports
2. Prefix intentionally unused parameters with `_`
3. Remove unused variable declarations

**Priority Order:**
1. lib/ - Core utilities (35 files)
2. app/api/ - API routes
3. components/ - UI components
4. __tests__/ - Test files
5. scripts/ - Build scripts

### Phase 2: Errors (Higher Risk, Type Improvements)
Fix `@typescript-eslint/no-explicit-any` errors:
1. Create proper interfaces for API response/request types
2. Replace `any` with `unknown` where type is truly unknown
3. Use specific types where possible
4. Add type parameters to generic functions

**Common Patterns to Fix:**
- `catch (error: any)` → `catch (error: unknown)`
- `Record<string, any>` → `Record<string, unknown>` or specific interface
- Function parameters with `any` → proper types
- API response handlers with `any` → typed responses

---

## Implementation Order

### Batch 1: lib/ Directory (Highest Impact)
Core utilities affect the entire application.

Files to fix:
- lib/db/schema.ts
- lib/rules/*.ts
- lib/bills/*.ts
- lib/budgets/*.ts
- lib/notifications/*.ts
- lib/email/*.ts

### Batch 2: app/api/ Routes
API routes need proper request/response typing.

Priority files:
- High-traffic endpoints (transactions, accounts, categories)
- Auth-related endpoints
- Bill and budget endpoints

### Batch 3: components/
UI components with proper prop typing.

### Batch 4: __tests__/ and scripts/
Lower priority, can use more lenient typing.

---

## Progress Tracking

### Phase 1: Warnings (311 remaining, 155 fixed)
- [x] lib/ directory (36 warnings fixed)
- [x] app/api/ routes (114 warnings fixed - COMPLETE)
- [ ] components/ (210 warnings)
- [ ] __tests__/
- [ ] scripts/
- [ ] contexts/
- [ ] hooks/

### Phase 2: Errors (419 remaining, 1 fixed)
- [ ] lib/ directory (38 errors remaining)
- [ ] app/api/ routes (83 errors remaining)
- [ ] components/
- [ ] __tests__/
- [ ] scripts/

---

## Common Type Replacements

### Error Handling
```typescript
// Before
catch (error: any) {
  console.error(error.message);
}

// After
catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(message);
}
```

### API Route Request Bodies
```typescript
// Before
const body = await request.json() as any;

// After
interface CreateTransactionBody {
  amount: number;
  description: string;
  // ... specific fields
}
const body = await request.json() as CreateTransactionBody;
```

### Database Query Results
```typescript
// Before
const result: any = await db.select()...

// After
type TransactionRow = typeof transactions.$inferSelect;
const result: TransactionRow[] = await db.select()...
```

### Event Handlers
```typescript
// Before
onChange={(e: any) => setValue(e.target.value)}

// After
onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
```

---

## Success Criteria

- [ ] Zero ESLint errors
- [ ] Zero ESLint warnings (or acceptable number with justification)
- [ ] All tests still passing
- [ ] Build succeeds
- [ ] No runtime type errors introduced

