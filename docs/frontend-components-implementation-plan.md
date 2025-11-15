# Frontend Components - Household Isolation Implementation Plan

**Created:** 2025-11-14
**Task:** Update frontend components to use `useHouseholdFetch()` hook
**Priority:** CRITICAL (Part of Phase 1)
**Estimated Time:** 4-6 hours

---

## Overview

Update all frontend components that interact with core financial data APIs to use the `useHouseholdFetch()` hook. This ensures proper household context is included in all API requests.

### Hook Usage Pattern

**Import:**
```typescript
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
```

**Usage:**
```typescript
const {
  fetchWithHousehold,    // GET requests
  postWithHousehold,     // POST requests
  putWithHousehold,      // PUT requests
  deleteWithHousehold,   // DELETE requests
  selectedHouseholdId    // Current household ID
} = useHouseholdFetch();
```

**Replace:**
```typescript
// OLD
const response = await fetch('/api/transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(data)
});

// NEW
const response = await postWithHousehold('/api/transactions', data);
```

---

## Components to Update

### Priority 1: Main Pages (5 files) - CRITICAL

#### 1.1 Transactions Page
**File:** `app/dashboard/transactions/page.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Replace all fetch calls with household-aware methods
- Update GET requests for transactions list
- Update DELETE requests for bulk operations

#### 1.2 Accounts Page
**File:** `app/dashboard/accounts/page.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Replace fetch calls for accounts list
- Update account CRUD operations

#### 1.3 Merchants Page
**File:** `app/dashboard/merchants/page.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Replace fetch calls for merchants list
- Update merchant CRUD operations

#### 1.4 Transaction History Page
**File:** `app/dashboard/transaction-history/page.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Replace fetch for transaction history

#### 1.5 Transaction Detail Pages
**Files:**
- `app/dashboard/transactions/[id]/page.tsx`
- `app/dashboard/transactions/[id]/edit/page.tsx`
- `app/dashboard/transactions/new/page.tsx`

---

### Priority 2: Form Components (4 files) - HIGH

#### 2.1 Transaction Form
**File:** `components/transactions/transaction-form.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Update POST/PUT for creating/updating transactions
- Update GET requests for loading transaction data
- Update duplicate checking

#### 2.2 Transaction Form Mobile
**File:** `components/transactions/transaction-form-mobile.tsx`
**Changes:**
- Same as transaction-form.tsx

#### 2.3 Account Form
**File:** `components/accounts/account-form.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Update POST/PUT for accounts

#### 2.4 Category Form
**File:** `components/categories/category-form.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Update POST/PUT for categories
- Check name uniqueness per-household

---

### Priority 3: Selector Components (4 files) - HIGH

#### 3.1 Category Selector
**File:** `components/transactions/category-selector.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Load categories for household
- Create new categories in household context

#### 3.2 Merchant Selector/Autocomplete
**Files:**
- `components/transactions/merchant-selector.tsx`
- `components/transactions/merchant-autocomplete.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Load merchants for household
- Create new merchants in household context

#### 3.3 Account Selector
**File:** `components/transactions/account-selector.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Load accounts for household

---

### Priority 4: Modal Components (5 files) - MEDIUM

#### 4.1 Quick Transaction Modal
**File:** `components/transactions/quick-transaction-modal.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Update transaction creation

#### 4.2 Transaction Templates Manager
**File:** `components/transactions/transaction-templates-manager.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Load templates for household
- Create/update/delete templates

#### 4.3 Convert to Transfer Modal
**File:** `components/transactions/convert-to-transfer-modal.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Update conversion endpoint

#### 4.4 Transfer Suggestions Modal
**File:** `components/transactions/transfer-suggestions-modal.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Load accounts for suggestions

#### 4.5 Duplicate Warning
**File:** `components/transactions/duplicate-warning.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Check duplicates in household

---

### Priority 5: List/Display Components (5 files) - MEDIUM

#### 5.1 Recent Transactions
**Files:**
- `components/transactions/recent-transactions.tsx`
- `components/dashboard/recent-transactions.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Load recent transactions for household

#### 5.2 Transaction History
**File:** `components/transactions/transaction-history.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Load history for household

#### 5.3 Splits List
**File:** `components/transactions/splits-list.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Load splits for transaction

#### 5.4 Transaction Details
**File:** `components/transactions/transaction-details.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Load transaction details

---

### Priority 6: Utility Components (6 files) - LOW

#### 6.1 Advanced Search
**File:** `components/transactions/advanced-search.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Search within household
- Save/load searches for household

#### 6.2 Saved Searches
**File:** `components/transactions/saved-searches.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Load saved searches for household

#### 6.3 Budget Warning
**File:** `components/transactions/budget-warning.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Check budgets in household

#### 6.4 Split Builder
**File:** `components/transactions/split-builder.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Create splits in household context

#### 6.5 Transaction Templates
**File:** `components/transactions/transaction-templates.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook
- Load templates for household

#### 6.6 Account/Category Cards
**Files:**
- `components/accounts/account-card.tsx`
- `components/categories/category-card.tsx`
**Changes:**
- Add `useHouseholdFetch()` hook for any data operations

---

## Implementation Checklist

### Phase 1: Critical Pages (5 files)
- [ ] `app/dashboard/transactions/page.tsx`
- [ ] `app/dashboard/accounts/page.tsx`
- [ ] `app/dashboard/merchants/page.tsx`
- [ ] `app/dashboard/transaction-history/page.tsx`
- [ ] `app/dashboard/transactions/[id]/page.tsx`

### Phase 2: Forms (4 files)
- [ ] `components/transactions/transaction-form.tsx`
- [ ] `components/transactions/transaction-form-mobile.tsx`
- [ ] `components/accounts/account-form.tsx`
- [ ] `components/categories/category-form.tsx`

### Phase 3: Selectors (4 files)
- [ ] `components/transactions/category-selector.tsx`
- [ ] `components/transactions/merchant-selector.tsx`
- [ ] `components/transactions/merchant-autocomplete.tsx`
- [ ] `components/transactions/account-selector.tsx`

### Phase 4: Modals (5 files)
- [ ] `components/transactions/quick-transaction-modal.tsx`
- [ ] `components/transactions/transaction-templates-manager.tsx`
- [ ] `components/transactions/convert-to-transfer-modal.tsx`
- [ ] `components/transactions/transfer-suggestions-modal.tsx`
- [ ] `components/transactions/duplicate-warning.tsx`

### Phase 5: Lists (5 files)
- [ ] `components/transactions/recent-transactions.tsx`
- [ ] `components/dashboard/recent-transactions.tsx`
- [ ] `components/transactions/transaction-history.tsx`
- [ ] `components/transactions/splits-list.tsx`
- [ ] `components/transactions/transaction-details.tsx`

### Phase 6: Utilities (8 files)
- [ ] `components/transactions/advanced-search.tsx`
- [ ] `components/transactions/saved-searches.tsx`
- [ ] `components/transactions/budget-warning.tsx`
- [ ] `components/transactions/split-builder.tsx`
- [ ] `components/transactions/transaction-templates.tsx`
- [ ] `components/accounts/account-card.tsx`
- [ ] `components/categories/category-card.tsx`
- [ ] `components/calendar/transaction-indicators.tsx`

**Total: ~31 files**

---

## Common Patterns

### Pattern 1: Simple GET Request
```typescript
// OLD
const response = await fetch('/api/transactions', { credentials: 'include' });

// NEW
const { fetchWithHousehold } = useHouseholdFetch();
const response = await fetchWithHousehold('/api/transactions');
```

### Pattern 2: POST/Create
```typescript
// OLD
const response = await fetch('/api/transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(data)
});

// NEW
const { postWithHousehold } = useHouseholdFetch();
const response = await postWithHousehold('/api/transactions', data);
```

### Pattern 3: PUT/Update
```typescript
// OLD
const response = await fetch(`/api/transactions/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(data)
});

// NEW
const { putWithHousehold } = useHouseholdFetch();
const response = await putWithHousehold(`/api/transactions/${id}`, data);
```

### Pattern 4: DELETE
```typescript
// OLD
const response = await fetch(`/api/transactions/${id}`, {
  method: 'DELETE',
  credentials: 'include'
});

// NEW
const { deleteWithHousehold } = useHouseholdFetch();
const response = await deleteWithHousehold(`/api/transactions/${id}`);
```

---

## Testing Strategy

### Per Component
1. Load component → verify data loads for household
2. Switch household → verify data updates
3. Create/update/delete → verify operations work
4. Check console for errors

### Integration Testing
1. Create transaction in Household A
2. Switch to Household B
3. Verify transaction from A not visible
4. Create transaction in Household B
5. Switch back to Household A
6. Verify correct isolation

---

## Error Handling

All components should handle these errors:

```typescript
try {
  const response = await postWithHousehold('/api/transactions', data);
  if (!response.ok) {
    if (response.status === 403) {
      // Household auth error - redirect to select household?
      console.error('No household access');
    } else if (response.status === 404) {
      // Not found
      toast.error('Item not found');
    }
  }
} catch (error) {
  if (error.message === 'No household selected') {
    // Handle no household
    toast.error('Please select a household');
  }
}
```

---

## Success Criteria

- ✅ All components use `useHouseholdFetch()` hook
- ✅ No hardcoded fetch calls to core APIs
- ✅ Data loads for selected household only
- ✅ Switching households updates data
- ✅ No 403 errors in normal operation
- ✅ Create/update/delete operations work correctly

---

## Estimated Timeline

**Session 1 (2-3 hours):** Critical pages + forms (9 files)
**Session 2 (1-2 hours):** Selectors + modals (9 files)
**Session 3 (1-2 hours):** Lists + utilities (13 files)
**Total: 4-7 hours** for all 31 files

---

**Document Version:** 1.0
**Ready for Implementation:** YES
**Start with:** `app/dashboard/transactions/page.tsx`
