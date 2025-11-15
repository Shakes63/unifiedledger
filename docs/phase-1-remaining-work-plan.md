# Phase 1 Remaining Work - Detailed Implementation Plan

**Created:** 2025-11-14
**Status:** Ready for Implementation
**Estimated Time:** 8-12 hours

---

## Overview

This plan covers the remaining work to complete Phase 1 (Core Financial Data Isolation). The infrastructure is 100% ready (schema, migration, auth helpers, fetch hook, and accounts API). Now we need to update the remaining API endpoints.

**Current Progress:** 2 of 12 transaction endpoints complete (17%)

---

## What's Already Done ✅

1. ✅ Database schema updated (6 tables + 15 indexes)
2. ✅ Migration file created: `drizzle/0042_add_household_id_to_core_tables.sql`
3. ✅ Backend auth helpers: `lib/api/household-auth.ts`
4. ✅ Frontend hook: `lib/hooks/use-household-fetch.ts`
5. ✅ Accounts API: 4 endpoints (GET, POST, PUT, DELETE)
6. ✅ Transactions API: 2 endpoints (`/api/transactions/route.ts`, `/api/transactions/[id]/route.ts`)

---

## Implementation Strategy

### Approach
- **Batch similar endpoints together** - Work on related endpoints in groups
- **Test incrementally** - Verify each batch works before moving to next
- **Follow consistent patterns** - Use the same household auth pattern everywhere
- **Document as we go** - Update progress file after each batch

### Theme Integration
All error responses and any UI-facing messages should use semantic variables where applicable:
- Keep error messages simple and informative
- No hardcoded colors in any new code
- If adding any debug/dev logging, use structured format

### Testing Strategy
After each batch:
1. Manually test the endpoint with household header
2. Verify 403 error when household ID missing
3. Verify 404 when accessing another household's data
4. Check that data is properly filtered by household

---

## Phase 1: Transaction Endpoints (10 remaining)

**Priority:** CRITICAL
**Estimated Time:** 4-5 hours
**Endpoints to Update:** 10 files

### Batch 1A: Transaction Search & History (2 endpoints)

#### 1.1 `/api/transactions/search/route.ts`
**File:** `app/api/transactions/search/route.ts`

**Current Functionality:**
- POST endpoint for advanced transaction search
- Supports filters: date range, amount range, type, category, merchant, account, tags
- Returns paginated results

**Changes Required:**
1. Import household auth helpers at top of file
2. Extract household ID from request + body
3. Validate user is household member
4. Add `eq(transactions.householdId, householdId)` to WHERE conditions array
5. When filtering by account/category/merchant, verify they belong to household first
6. Add 403 error handling for household auth failures

**Code Pattern:**
```typescript
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { and, eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();

    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    const conditions = [
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId), // ADD THIS
    ];

    // Add other search filters...
    if (body.accountId) {
      // Verify account belongs to household
      const account = await db.select().from(accounts)
        .where(and(
          eq(accounts.id, body.accountId),
          eq(accounts.householdId, householdId)
        )).limit(1);

      if (!account || account.length === 0) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      conditions.push(eq(transactions.accountId, body.accountId));
    }

    // Similar validation for categoryId, merchantId...

    const results = await db.select()
      .from(transactions)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    return Response.json({ data: results, total, limit, offset });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Search error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Testing:**
- Search with valid household ID → returns household's transactions
- Search with missing household ID → 403 error
- Search with account filter from different household → 404 error

---

#### 1.2 `/api/transactions/history/route.ts`
**File:** `app/api/transactions/history/route.ts`

**Current Functionality:**
- GET endpoint returning transaction history/activity log
- Shows recent transaction changes and updates

**Changes Required:**
1. Add household auth check
2. Filter history by `householdId`
3. Only show transaction history for transactions in current household

**Code Pattern:**
```typescript
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    const history = await db.select()
      .from(transactionHistory) // or wherever history is stored
      .where(and(
        eq(transactionHistory.userId, userId),
        eq(transactionHistory.householdId, householdId)
      ))
      .orderBy(desc(transactionHistory.timestamp))
      .limit(50);

    return Response.json(history);
  } catch (error) {
    // Standard error handling
  }
}
```

---

### Batch 1B: Transaction Templates (2 endpoints)

#### 1.3 `/api/transactions/templates/route.ts`
**File:** `app/api/transactions/templates/route.ts`

**Current Functionality:**
- GET: List all transaction templates
- POST: Create new transaction template

**Changes Required:**
1. GET: Filter templates by `householdId`
2. POST: Include `householdId` when creating template
3. Verify referenced account/category belong to household

**Code Pattern:**
```typescript
// GET
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    const templates = await db.select()
      .from(transactionTemplates)
      .where(and(
        eq(transactionTemplates.userId, userId),
        eq(transactionTemplates.householdId, householdId)
      ));

    return Response.json(templates);
  } catch (error) {
    // Error handling
  }
}

// POST
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // Verify account belongs to household
    if (body.accountId) {
      const account = await db.select().from(accounts)
        .where(and(
          eq(accounts.id, body.accountId),
          eq(accounts.householdId, householdId)
        )).limit(1);

      if (!account || account.length === 0) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }
    }

    const id = nanoid();
    await db.insert(transactionTemplates).values({
      id,
      userId,
      householdId: householdId!, // ADD THIS
      ...body
    });

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    // Error handling
  }
}
```

---

#### 1.4 `/api/transactions/templates/[id]/route.ts`
**File:** `app/api/transactions/templates/[id]/route.ts`

**Current Functionality:**
- GET: Get template by ID
- PUT: Update template
- DELETE: Delete template

**Changes Required:**
1. All methods: Verify template belongs to user AND household
2. PUT: If updating account/category, verify they belong to household

**Code Pattern:**
```typescript
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    const template = await db.select()
      .from(transactionTemplates)
      .where(and(
        eq(transactionTemplates.id, id),
        eq(transactionTemplates.userId, userId),
        eq(transactionTemplates.householdId, householdId)
      ))
      .limit(1);

    if (!template || template.length === 0) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    return Response.json(template[0]);
  } catch (error) {
    // Error handling
  }
}

// Similar pattern for PUT and DELETE
```

---

### Batch 1C: Transaction Splits & Tags (3 endpoints)

#### 1.5 `/api/transactions/[id]/splits/route.ts`
**File:** `app/api/transactions/[id]/splits/route.ts`

**Current Functionality:**
- GET: List splits for a transaction
- POST: Create new split for a transaction

**Changes Required:**
1. Verify parent transaction belongs to household
2. When creating splits, inherit `householdId` from parent transaction
3. All split queries filter by household

**Code Pattern:**
```typescript
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireAuth();
    const { id: transactionId } = await params;
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // Verify parent transaction exists and belongs to household
    const transaction = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      ))
      .limit(1);

    if (!transaction || transaction.length === 0) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Create split with parent's householdId
    const splitId = nanoid();
    await db.insert(transactionSplits).values({
      id: splitId,
      transactionId,
      userId,
      householdId: householdId!, // Inherit from parent
      ...body
    });

    return Response.json({ id: splitId }, { status: 201 });
  } catch (error) {
    // Error handling
  }
}
```

---

#### 1.6 `/api/transactions/[id]/splits/[splitId]/route.ts`
**File:** `app/api/transactions/[id]/splits/[splitId]/route.ts`

**Current Functionality:**
- GET: Get specific split
- PUT: Update split
- DELETE: Delete split

**Changes Required:**
1. Verify split belongs to household
2. Verify parent transaction belongs to household

**Code Pattern:**
```typescript
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; splitId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id: transactionId, splitId } = await params;
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // Verify split belongs to household
    const split = await db.select()
      .from(transactionSplits)
      .where(and(
        eq(transactionSplits.id, splitId),
        eq(transactionSplits.transactionId, transactionId),
        eq(transactionSplits.userId, userId),
        eq(transactionSplits.householdId, householdId)
      ))
      .limit(1);

    if (!split || split.length === 0) {
      return Response.json({ error: 'Split not found' }, { status: 404 });
    }

    await db.update(transactionSplits)
      .set(body)
      .where(eq(transactionSplits.id, splitId));

    return Response.json({ message: 'Split updated' });
  } catch (error) {
    // Error handling
  }
}
```

---

#### 1.7 `/api/transactions/[id]/tags/route.ts`
**File:** `app/api/transactions/[id]/tags/route.ts`

**Current Functionality:**
- GET: List tags for transaction
- POST: Add tag to transaction
- DELETE: Remove tag from transaction

**Changes Required:**
1. Verify transaction belongs to household
2. Only allow tagging with tags that exist in household

**Code Pattern:**
```typescript
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireAuth();
    const { id: transactionId } = await params;
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // Verify transaction belongs to household
    const transaction = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.id, transactionId),
        eq(transactions.householdId, householdId)
      ))
      .limit(1);

    if (!transaction || transaction.length === 0) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Verify tag exists in household (if tags table has householdId)
    // Then create transaction-tag association

    return Response.json({ message: 'Tag added' }, { status: 201 });
  } catch (error) {
    // Error handling
  }
}
```

---

### Batch 1D: Transaction Utilities (3 endpoints)

#### 1.8 `/api/transactions/check-duplicates/route.ts`
**File:** `app/api/transactions/check-duplicates/route.ts`

**Current Functionality:**
- POST: Check if transaction is a duplicate using Levenshtein distance
- Returns potential duplicate matches

**Changes Required:**
1. Only check for duplicates within same household
2. Levenshtein matching should be household-scoped

**Code Pattern:**
```typescript
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    const { description, amount, date, accountId } = body;

    // Find potential duplicates only in household
    const potentialDuplicates = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId),
        // Date range (±2 days)
        gte(transactions.date, new Date(date.getTime() - 2 * 24 * 60 * 60 * 1000)),
        lte(transactions.date, new Date(date.getTime() + 2 * 24 * 60 * 60 * 1000))
      ));

    // Apply Levenshtein matching...
    // Return matches

    return Response.json({ duplicates: matches });
  } catch (error) {
    // Error handling
  }
}
```

---

#### 1.9 `/api/transactions/repeat/route.ts`
**File:** `app/api/transactions/repeat/route.ts`

**Current Functionality:**
- POST: Create a new transaction based on a previous one (repeat transaction)

**Changes Required:**
1. Verify source transaction belongs to household
2. Create new transaction with same householdId
3. Verify account still belongs to household

**Code Pattern:**
```typescript
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    const { sourceTransactionId, newDate } = body;

    // Get source transaction (verify household)
    const sourceTransaction = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.id, sourceTransactionId),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      ))
      .limit(1);

    if (!sourceTransaction || sourceTransaction.length === 0) {
      return Response.json({ error: 'Source transaction not found' }, { status: 404 });
    }

    // Create new transaction with same householdId
    const newId = nanoid();
    await db.insert(transactions).values({
      ...sourceTransaction[0],
      id: newId,
      date: newDate,
      householdId: householdId!, // Same household
      // Reset some fields
      linkedBillId: null,
      linkedBillInstanceId: null,
    });

    return Response.json({ id: newId }, { status: 201 });
  } catch (error) {
    // Error handling
  }
}
```

---

#### 1.10 `/api/transactions/[id]/convert-to-transfer/route.ts`
**File:** `app/api/transactions/[id]/convert-to-transfer/route.ts`

**Current Functionality:**
- POST: Convert an expense/income transaction into a transfer
- Creates two linked transactions (transfer_out and transfer_in)

**Changes Required:**
1. Verify source transaction belongs to household
2. Verify destination account belongs to household
3. **CRITICAL:** Both transfer transactions must have same householdId
4. Cannot transfer between accounts in different households

**Code Pattern:**
```typescript
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireAuth();
    const { id: transactionId } = await params;
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    const { destinationAccountId } = body;

    // Verify source transaction belongs to household
    const transaction = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      ))
      .limit(1);

    if (!transaction || transaction.length === 0) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Verify destination account belongs to household
    const destAccount = await db.select()
      .from(accounts)
      .where(and(
        eq(accounts.id, destinationAccountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      ))
      .limit(1);

    if (!destAccount || destAccount.length === 0) {
      return Response.json({ error: 'Destination account not found or not in household' }, { status: 404 });
    }

    // Create transfer pair with same householdId
    const transferId = nanoid();
    const transferOutId = nanoid();
    const transferInId = nanoid();

    await db.insert(transactions).values([
      {
        id: transferOutId,
        userId,
        householdId: householdId!, // SAME HOUSEHOLD
        type: 'transfer_out',
        transferId,
        // ... other fields
      },
      {
        id: transferInId,
        userId,
        householdId: householdId!, // SAME HOUSEHOLD
        type: 'transfer_in',
        transferId,
        // ... other fields
      }
    ]);

    // Delete original transaction
    await db.delete(transactions).where(eq(transactions.id, transactionId));

    return Response.json({ transferOutId, transferInId }, { status: 201 });
  } catch (error) {
    // Error handling
  }
}
```

---

## Phase 2: Categories API (4 endpoints)

**Priority:** HIGH
**Estimated Time:** 1-2 hours
**Endpoints to Update:** 4 files

### 2.1 `/api/categories/route.ts`
**File:** `app/api/categories/route.ts`

**Changes Required:**
- GET: Filter by `householdId`
- POST: Include `householdId` when creating

**Code Pattern:**
```typescript
// GET
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    const categories = await db.select()
      .from(budgetCategories)
      .where(and(
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId)
      ))
      .orderBy(asc(budgetCategories.name));

    return Response.json(categories);
  } catch (error) {
    // Error handling
  }
}

// POST
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    const id = nanoid();
    await db.insert(budgetCategories).values({
      id,
      userId,
      householdId: householdId!,
      ...body
    });

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    // Error handling
  }
}
```

---

### 2.2 `/api/categories/[id]/route.ts`
**File:** `app/api/categories/[id]/route.ts`

**Changes Required:**
- GET/PUT/DELETE: Verify category belongs to household
- DELETE: Check if any transactions in household use this category before deleting

**Code Pattern:**
```typescript
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // Verify category belongs to household
    const category = await db.select()
      .from(budgetCategories)
      .where(and(
        eq(budgetCategories.id, id),
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId)
      ))
      .limit(1);

    if (!category || category.length === 0) {
      return Response.json({ error: 'Category not found' }, { status: 404 });
    }

    // Check if any transactions in household use this category
    const usageCount = await db.select({ count: count() })
      .from(transactions)
      .where(and(
        eq(transactions.categoryId, id),
        eq(transactions.householdId, householdId)
      ));

    if (usageCount[0].count > 0) {
      return Response.json({
        error: `Cannot delete category. It is used by ${usageCount[0].count} transactions.`
      }, { status: 400 });
    }

    await db.delete(budgetCategories).where(eq(budgetCategories.id, id));

    return Response.json({ message: 'Category deleted' });
  } catch (error) {
    // Error handling
  }
}
```

---

### 2.3 `/api/categories/[id]/budget/route.ts`
**File:** `app/api/categories/[id]/budget/route.ts`

**Changes Required:**
- PUT: Verify category belongs to household before updating budget
- Budget limits are per-household

---

### 2.4 `/api/categories/stats/route.ts`
**File:** `app/api/categories/stats/route.ts`

**Changes Required:**
- All spending stats filtered by household
- Join with transactions using household filter

---

## Phase 3: Merchants API (4 endpoints)

**Priority:** HIGH
**Estimated Time:** 1-2 hours
**Endpoints to Update:** 4 files

### 3.1 `/api/merchants/route.ts`
**File:** `app/api/merchants/route.ts`

**Changes Required:**
- GET: Filter by `householdId`
- POST: Include `householdId` when creating
- **IMPORTANT:** Merchant name uniqueness is per-household, not global

**Code Pattern:**
```typescript
// POST - with uniqueness check
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    const { name } = body;

    // Check if merchant name exists in household
    const existing = await db.select()
      .from(merchants)
      .where(and(
        eq(merchants.userId, userId),
        eq(merchants.householdId, householdId),
        eq(merchants.normalizedName, name.toLowerCase().trim())
      ))
      .limit(1);

    if (existing && existing.length > 0) {
      return Response.json({ error: 'Merchant already exists in household' }, { status: 400 });
    }

    const id = nanoid();
    await db.insert(merchants).values({
      id,
      userId,
      householdId: householdId!,
      name,
      normalizedName: name.toLowerCase().trim(),
      ...body
    });

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    // Error handling
  }
}
```

---

### 3.2 `/api/merchants/[id]/route.ts`
**File:** `app/api/merchants/[id]/route.ts`

**Changes Required:**
- GET/PUT/DELETE: Verify merchant belongs to household

---

### 3.3 `/api/merchants/search/route.ts`
**File:** `app/api/merchants/search/route.ts`

**Changes Required:**
- Search only in household's merchants
- Fuzzy matching (Levenshtein) scoped to household

---

### 3.4 `/api/merchants/stats/route.ts`
**File:** `app/api/merchants/stats/route.ts`

**Changes Required:**
- Transaction counts per merchant per household
- Spending totals per merchant per household

---

## Phase 4: Dashboard API (3 endpoints)

**Priority:** MEDIUM
**Estimated Time:** 1 hour
**Endpoints to Update:** 3 files

### 4.1 `/api/dashboard/stats/route.ts`
**File:** `app/api/dashboard/stats/route.ts`

**Changes Required:**
- All aggregations filtered by household
- Account balances sum (household total)
- Transaction counts (household)
- Budget adherence (household)
- Recent activity (household)

**Code Pattern:**
```typescript
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // Get household account balances
    const accountsData = await db.select({
      totalBalance: sum(accounts.currentBalance)
    })
    .from(accounts)
    .where(and(
      eq(accounts.userId, userId),
      eq(accounts.householdId, householdId)
    ));

    // Get household transaction stats
    const transactionStats = await db.select({
      totalIncome: sum(transactions.amount),
      totalExpense: sum(transactions.amount),
      count: count()
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId),
      gte(transactions.date, startOfMonth),
      lte(transactions.date, endOfMonth)
    ));

    // Budget adherence per household
    // ... similar pattern

    return Response.json({
      totalBalance: accountsData[0].totalBalance || 0,
      monthlyIncome: transactionStats[0].totalIncome || 0,
      monthlyExpense: transactionStats[0].totalExpense || 0,
      transactionCount: transactionStats[0].count || 0,
      // ... other stats
    });
  } catch (error) {
    // Error handling
  }
}
```

---

### 4.2 `/api/dashboard/recent-activity/route.ts`
**File:** `app/api/dashboard/recent-activity/route.ts`

**Changes Required:**
- Recent transactions filtered by household
- Recent bills filtered by household
- Recent goals filtered by household (if applicable)

---

### 4.3 `/api/analytics/route.ts`
**File:** `app/api/analytics/route.ts`

**Changes Required:**
- All analytics queries filtered by household
- Trends, patterns, insights all per-household
- Spending by category (household)
- Monthly comparisons (household)

---

## Implementation Checklist

### Transaction Endpoints (10)
- [ ] 1.1 `/api/transactions/search/route.ts`
- [ ] 1.2 `/api/transactions/history/route.ts`
- [ ] 1.3 `/api/transactions/templates/route.ts`
- [ ] 1.4 `/api/transactions/templates/[id]/route.ts`
- [ ] 1.5 `/api/transactions/[id]/splits/route.ts`
- [ ] 1.6 `/api/transactions/[id]/splits/[splitId]/route.ts`
- [ ] 1.7 `/api/transactions/[id]/tags/route.ts`
- [ ] 1.8 `/api/transactions/check-duplicates/route.ts`
- [ ] 1.9 `/api/transactions/repeat/route.ts`
- [ ] 1.10 `/api/transactions/[id]/convert-to-transfer/route.ts`

### Category Endpoints (4)
- [ ] 2.1 `/api/categories/route.ts`
- [ ] 2.2 `/api/categories/[id]/route.ts`
- [ ] 2.3 `/api/categories/[id]/budget/route.ts`
- [ ] 2.4 `/api/categories/stats/route.ts`

### Merchant Endpoints (4)
- [ ] 3.1 `/api/merchants/route.ts`
- [ ] 3.2 `/api/merchants/[id]/route.ts`
- [ ] 3.3 `/api/merchants/search/route.ts`
- [ ] 3.4 `/api/merchants/stats/route.ts`

### Dashboard Endpoints (3)
- [ ] 4.1 `/api/dashboard/stats/route.ts`
- [ ] 4.2 `/api/dashboard/recent-activity/route.ts`
- [ ] 4.3 `/api/analytics/route.ts`

**Total:** 21 endpoints remaining

---

## Testing Strategy

### After Each Batch
1. **Quick Smoke Test:**
   - Make GET request with household header → should work
   - Make GET request without household header → should return 403
   - Make request for another household's data → should return 404

2. **Manual Test Cases:**
   - Create test data in Household A
   - Switch to Household B
   - Verify Household A data not visible
   - Create data in Household B
   - Switch back to Household A
   - Verify correct data shown

### Integration Testing (After All Complete)
- Create automated test suite
- Test cross-household isolation
- Test transfer transactions stay in household
- Test rules/bill matching isolation

---

## Error Handling Standard

All endpoints should follow this error handling pattern:

```typescript
export async function HANDLER(request: Request) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // ... business logic

    return Response.json(data);
  } catch (error) {
    // Unauthorized (not logged in)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Forbidden (not household member or household ID missing)
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }

    // Server error
    console.error('API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## Progress Tracking

After completing each batch, update:
1. This file - Check off completed items
2. `docs/phase-1-progress.md` - Update progress percentage
3. `docs/features.md` - Update overall Phase 1 status

---

## Success Criteria

This phase is complete when:
- ✅ All 21 remaining endpoints filter by household
- ✅ All endpoints include proper error handling
- ✅ Manual testing confirms isolation
- ✅ No 500 errors when household ID missing (should be 403)
- ✅ Cannot access another household's data (404)

---

## Next Steps After Completing API Endpoints

1. **Frontend Components** - Update all components to use `useHouseholdFetch()` hook
2. **Business Logic** - Update rules engine, bill matching, usage analytics
3. **Apply Migration** - Back up database and apply schema changes
4. **Comprehensive Testing** - Run integration tests and manual test suite
5. **Documentation** - Update all docs to reflect Phase 1 completion

---

## Estimated Timeline

**Session 1 (4 hours):**
- Transaction endpoints batches 1A-1D (10 endpoints)
- Manual testing of transaction endpoints

**Session 2 (3 hours):**
- Category endpoints (4)
- Merchant endpoints (4)
- Dashboard endpoints (3)
- Manual testing of all endpoints

**Session 3 (2 hours):**
- Integration testing
- Bug fixes
- Update documentation

**Total: 8-12 hours over 2-3 sessions**

---

**Document Version:** 1.0
**Ready for Implementation:** YES
**Start with:** Batch 1A - Transaction Search & History
