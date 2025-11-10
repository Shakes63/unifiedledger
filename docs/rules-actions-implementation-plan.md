# Rules Actions Implementation Plan
## Feature: Allow Rules to Modify Transactions (Not Just Categorize)

### Overview
Currently, categorization rules can only set a transaction's category. This plan extends the rules system to support multiple actions that can modify transaction fields beyond just the category.

### Phased Approach
We'll implement features 1-7 from features.md in phases:

**Phase 1 (This Document):** Description & Merchant Modification
1. Allow changing description
2. Allow changing merchant

**Phase 2 (Future):** Advanced Actions
3. Make the transfer conversion more robust, with transaction matching and suggestions
4. Allow converting to transfer with a rule
5. Allow splitting transactions with a rule
6. Allow changing the bank account with a rule
7. Allow setting tax deduction with a rule

---

## Phase 1: Description & Merchant Modification

### Architecture Overview

**Current State:**
- Rules have: `id`, `userId`, `name`, `categoryId`, `conditions`, `priority`, `isActive`
- Rule matcher returns: `{ ruleId, categoryId, priority }`
- Only action: Set category

**Target State:**
- Rules have: `id`, `userId`, `name`, `actions` (JSON), `conditions`, `priority`, `isActive`
- Rule matcher returns: `{ ruleId, actions, priority }`
- Multiple actions supported: Set category, modify description, set merchant

### Database Schema Changes

#### 1. Modify `categorizationRules` Table
**File:** `lib/db/schema.ts`

**Changes:**
- Add `actions` TEXT field (JSON array of action objects)
- Keep `categoryId` field for backward compatibility (migrate existing rules)
- Mark `categoryId` as nullable for future-only rules

**Actions JSON Structure:**
```typescript
interface RuleAction {
  type: 'set_category' | 'set_description' | 'append_description' | 'prepend_description' | 'set_merchant' | 'set_tax_deduction' | 'set_account' | 'convert_to_transfer' | 'create_split';
  value?: string; // For set_category, set_merchant, set_description
  pattern?: string; // For append/prepend operations (supports variables)
  config?: Record<string, any>; // For complex actions (splits, transfers)
}

// Example actions array:
[
  { type: 'set_category', value: 'category-id-123' },
  { type: 'prepend_description', pattern: '[Work] ' },
  { type: 'set_merchant', value: 'merchant-id-456' }
]
```

**Pattern Variables (for description modifications):**
- `{original}` - Original description
- `{merchant}` - Merchant name (if set)
- `{category}` - Category name (if set)
- `{amount}` - Transaction amount
- `{date}` - Transaction date

Example patterns:
- `[Auto] {original}` → `[Auto] Starbucks Coffee`
- `{merchant} - {category}` → `Starbucks - Coffee Shops`
- `Work Expense: {original}` → `Work Expense: Office Supplies`

#### 2. Migration Strategy
**File:** `drizzle/migrations/[timestamp]_add_rule_actions.sql`

**Migration Steps:**
1. Add `actions` column as TEXT
2. For existing rules with `categoryId`, create actions array:
   ```sql
   UPDATE categorization_rules
   SET actions = json_array(json_object('type', 'set_category', 'value', categoryId))
   WHERE categoryId IS NOT NULL;
   ```
3. Make `categoryId` nullable (but keep for now)

---

### Backend Changes

#### 3. Update Type Definitions
**File:** `lib/rules/types.ts` (NEW FILE)

```typescript
export type RuleActionType =
  | 'set_category'
  | 'set_description'
  | 'append_description'
  | 'prepend_description'
  | 'set_merchant'
  | 'set_tax_deduction'
  | 'set_account'
  | 'convert_to_transfer'
  | 'create_split';

export interface RuleAction {
  type: RuleActionType;
  value?: string;
  pattern?: string;
  config?: Record<string, any>;
}

export interface AppliedAction {
  type: RuleActionType;
  originalValue?: string | null;
  newValue: string | null;
  field: 'categoryId' | 'description' | 'merchantId' | 'accountId' | 'isTaxDeductible';
}

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  actions: RuleAction[];
  priority: number;
}
```

#### 4. Update Rule Matcher
**File:** `lib/rules/rule-matcher.ts`

**Changes:**
- Update `RuleMatch` interface to include `actions` instead of just `categoryId`
- Parse `actions` from database
- Return actions array in match result
- Add helper function to parse action patterns

```typescript
// Add function to parse description patterns
export function parseDescriptionPattern(
  pattern: string,
  transaction: TransactionData,
  merchant?: { name: string },
  category?: { name: string }
): string {
  let result = pattern;
  result = result.replace('{original}', transaction.description);
  result = result.replace('{merchant}', merchant?.name || '');
  result = result.replace('{category}', category?.name || '');
  result = result.replace('{amount}', transaction.amount.toString());
  result = result.replace('{date}', transaction.date);
  return result;
}
```

#### 5. Create Actions Executor
**File:** `lib/rules/actions-executor.ts` (NEW FILE)

This module will apply rule actions to transaction data.

```typescript
export interface TransactionMutations {
  categoryId?: string | null;
  description?: string;
  merchantId?: string | null;
  accountId?: string | null;
  isTaxDeductible?: boolean;
  // Future: split, transfer fields
}

export async function executeRuleActions(
  userId: string,
  actions: RuleAction[],
  transaction: TransactionData,
  currentTransaction: {
    categoryId?: string | null;
    description: string;
    merchantId?: string | null;
  }
): Promise<{
  mutations: TransactionMutations;
  appliedActions: AppliedAction[];
  errors?: string[];
}> {
  // Implementation details:
  // 1. Process each action in order
  // 2. For set_category: validate category exists
  // 3. For set_merchant: validate/create merchant
  // 4. For description actions: apply patterns
  // 5. Track all changes for audit log
  // 6. Return mutations to apply to transaction
}
```

#### 6. Update Transaction Creation API
**File:** `app/api/transactions/route.ts`

**Changes:**
- When rule match found, call `executeRuleActions()`
- Apply mutations to transaction before insertion
- Update rule execution log to include applied actions
- Handle errors gracefully (log but don't fail transaction)

```typescript
// After finding matching rule
if (ruleMatch.matched && ruleMatch.rule) {
  const executionResult = await executeRuleActions(
    userId,
    ruleMatch.rule.actions,
    transactionData,
    {
      categoryId: appliedCategoryId,
      description: description,
      merchantId: merchantId || null,
    }
  );

  // Apply mutations
  if (executionResult.mutations.categoryId !== undefined) {
    appliedCategoryId = executionResult.mutations.categoryId;
  }
  if (executionResult.mutations.description) {
    description = executionResult.mutations.description;
  }
  if (executionResult.mutations.merchantId !== undefined) {
    merchantId = executionResult.mutations.merchantId;
  }

  appliedRuleId = ruleMatch.rule.ruleId;

  // Log applied actions for audit trail
  // ... (update rule execution log)
}
```

#### 7. Update Rule Execution Log
**File:** `lib/db/schema.ts`

**Changes to `ruleExecutionLog` table:**
- Add `appliedActions` TEXT field (JSON array of AppliedAction objects)
- This allows auditing what changes were made by rules

```typescript
// Update schema
appliedActions: text('applied_actions'), // JSON array of changes
```

#### 8. Update Bulk Apply Rules API
**File:** `app/api/rules/apply-bulk/route.ts`

**Changes:**
- Update to use new actions-based system
- Apply all actions (not just category)
- Return detailed results showing all applied actions

---

### Frontend Changes

#### 9. Update Rule Builder Component
**File:** `components/rules/rule-builder.tsx`

**New Section: "Actions"**
- Move "Apply Category" to actions list
- Add "Modify Description" action with pattern builder
- Add "Set Merchant" action with merchant selector
- Each action has:
  - Action type dropdown
  - Configuration UI (specific to action type)
  - Remove button
  - Reorder handles (drag-and-drop later)

**UI Structure:**
```tsx
<div className="space-y-4">
  <h3>Actions to Apply</h3>

  {/* Existing actions */}
  {actions.map((action, index) => (
    <div key={index} className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-4">
        {/* Action type selector */}
        <Select value={action.type} onValueChange={(type) => updateActionType(index, type)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="set_category">Set Category</SelectItem>
            <SelectItem value="set_description">Set Description</SelectItem>
            <SelectItem value="prepend_description">Prepend to Description</SelectItem>
            <SelectItem value="append_description">Append to Description</SelectItem>
            <SelectItem value="set_merchant">Set Merchant</SelectItem>
          </SelectContent>
        </Select>

        {/* Action-specific configuration */}
        {action.type === 'set_category' && (
          <CategorySelector
            value={action.value}
            onChange={(val) => updateActionValue(index, val)}
          />
        )}

        {action.type.includes('description') && (
          <div className="flex-1">
            <Input
              placeholder="Enter pattern (use {original}, {merchant}, etc.)"
              value={action.pattern || ''}
              onChange={(e) => updateActionPattern(index, e.target.value)}
              className="bg-input border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Variables: {'{original}'}, {'{merchant}'}, {'{category}'}, {'{amount}'}, {'{date}'}
            </p>
          </div>
        )}

        {action.type === 'set_merchant' && (
          <MerchantSelector
            value={action.value}
            onChange={(val) => updateActionValue(index, val)}
          />
        )}

        {/* Remove button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => removeAction(index)}
          className="hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  ))}

  {/* Add action button */}
  <Button
    type="button"
    variant="outline"
    onClick={addAction}
    className="w-full border-dashed"
  >
    <Plus className="h-4 w-4 mr-2" />
    Add Action
  </Button>
</div>
```

#### 10. Update Rules List Component
**File:** `components/rules/rules-manager.tsx`

**Changes:**
- Display action count badge (e.g., "3 actions")
- Show preview of actions in rule card
- Update the "Category" badge to show first action or "Multiple actions"

```tsx
<div className="flex items-center gap-2">
  {rule.actions && rule.actions.length > 0 ? (
    <>
      <Badge variant="outline" className="bg-accent/10 text-accent-foreground">
        {rule.actions.length} action{rule.actions.length > 1 ? 's' : ''}
      </Badge>

      {/* Show first action preview */}
      {rule.actions[0].type === 'set_category' && (
        <Badge variant="secondary">Category: {getCategoryName(rule.actions[0].value)}</Badge>
      )}
      {rule.actions[0].type === 'set_merchant' && (
        <Badge variant="secondary">Merchant: {getMerchantName(rule.actions[0].value)}</Badge>
      )}
      {rule.actions[0].type.includes('description') && (
        <Badge variant="secondary">Description: {rule.actions[0].pattern}</Badge>
      )}
    </>
  ) : (
    <Badge variant="outline">No actions</Badge>
  )}
</div>
```

#### 11. Update Rule Details Modal
**File:** `components/rules/rule-details-modal.tsx` (NEW FILE)

Create a detailed view modal that shows:
- All conditions (existing)
- All actions with formatted preview
- Test section showing before/after preview
- Execution history with applied actions

---

### API Endpoints Updates

#### 12. Update Rules CRUD API
**File:** `app/api/rules/route.ts`

**Changes:**
- Accept `actions` array in POST/PUT requests
- Validate actions structure
- For backward compatibility, if `categoryId` provided but no `actions`, create actions array
- Store actions as JSON string

**Validation:**
```typescript
function validateActions(actions: RuleAction[]): string[] {
  const errors: string[] = [];

  for (const action of actions) {
    if (!action.type) {
      errors.push('Action type is required');
    }

    if (action.type === 'set_category' && !action.value) {
      errors.push('Category ID required for set_category action');
    }

    if (action.type === 'set_merchant' && !action.value) {
      errors.push('Merchant ID required for set_merchant action');
    }

    if (action.type.includes('description') && !action.pattern) {
      errors.push('Pattern required for description actions');
    }
  }

  return errors;
}
```

#### 13. Update Test Rules API
**File:** `app/api/rules/test/route.ts`

**Changes:**
- Test all actions (not just category match)
- Return before/after preview for each action
- Show what would change in transaction

**Response Format:**
```typescript
{
  matched: boolean,
  matchedTransactions: [
    {
      transactionId: string,
      original: {
        description: string,
        categoryId: string | null,
        merchantId: string | null,
      },
      modified: {
        description: string,
        categoryId: string | null,
        merchantId: string | null,
      },
      appliedActions: AppliedAction[]
    }
  ]
}
```

---

### Testing Strategy

#### 14. Unit Tests
**File:** `lib/rules/__tests__/actions-executor.test.ts` (NEW FILE)

Test cases:
- ✅ Set category action
- ✅ Set description action (replace entire description)
- ✅ Prepend description action
- ✅ Append description action
- ✅ Pattern variable replacement
- ✅ Set merchant action
- ✅ Multiple actions in sequence
- ✅ Invalid action handling
- ✅ Missing required fields
- ✅ Circular reference prevention (future: when actions can reference each other)

#### 15. Integration Tests
**File:** `app/api/transactions/__tests__/rules-actions.test.ts` (NEW FILE)

Test cases:
- ✅ Transaction creation with description-modifying rule
- ✅ Transaction creation with merchant-setting rule
- ✅ Transaction creation with multiple actions
- ✅ Verify audit log contains applied actions
- ✅ Bulk apply rules with actions
- ✅ Rule execution with errors doesn't break transaction creation

---

### Documentation

#### 16. User Documentation
**File:** `docs/rules-actions-user-guide.md` (NEW FILE)

Content:
- Overview of rule actions
- How to configure description modifications
- Pattern variable reference
- Use cases and examples
- Troubleshooting

#### 17. Developer Documentation
**File:** `docs/rules-actions-architecture.md` (NEW FILE)

Content:
- Architecture overview
- Data flow diagrams
- How to add new action types
- API reference
- Database schema

---

### Implementation Order

#### Phase 1A: Backend Foundation (Days 1-2)
1. ✅ **Task 1:** Update database schema (add `actions` column)
2. ✅ **Task 2:** Create migration script
3. ✅ **Task 3:** Run migration (migrate existing rules)
4. ✅ **Task 4:** Create `lib/rules/types.ts` with type definitions
5. ✅ **Task 5:** Update `rule-matcher.ts` to return actions
6. ✅ **Task 6:** Create `actions-executor.ts` with execution logic
7. ✅ **Task 7:** Add `parseDescriptionPattern()` helper function
8. ✅ **Task 8:** Update `ruleExecutionLog` schema to store applied actions

#### Phase 1B: API Integration (Days 3-4)
9. ✅ **Task 9:** Update transaction creation API to use actions executor
10. ✅ **Task 10:** Update bulk apply rules API
11. ✅ **Task 11:** Update rules CRUD API (validation, storage)
12. ✅ **Task 12:** Update test rules API to show before/after preview
13. ✅ **Task 13:** Write unit tests for actions executor
14. ✅ **Task 14:** Write integration tests for rules with actions

#### Phase 1C: Frontend UI (Days 5-6)
15. ✅ **Task 15:** Update rule builder component (actions section)
16. ✅ **Task 16:** Create pattern builder UI for description actions
17. ✅ **Task 17:** Add merchant selector for set_merchant action
18. ✅ **Task 18:** Update rules list to show action count/preview
19. ✅ **Task 19:** Create rule details modal with full action list
20. ✅ **Task 20:** Update rule cards with action badges

#### Phase 1D: Testing & Polish (Day 7)
21. ✅ **Task 21:** Manual end-to-end testing
22. ✅ **Task 22:** Fix any bugs discovered
23. ✅ **Task 23:** Add toast notifications for action application
24. ✅ **Task 24:** Write user documentation
25. ✅ **Task 25:** Performance testing (bulk apply with actions)

---

### Theme Integration Checklist

All new UI components must use semantic color tokens:

- ✅ Backgrounds: `bg-background`, `bg-card`, `bg-elevated`
- ✅ Text: `text-foreground`, `text-muted-foreground`
- ✅ Borders: `border-border`
- ✅ Inputs: `bg-input`
- ✅ Buttons: `bg-[var(--color-primary)]`, `hover:opacity-90`
- ✅ Badges: Use existing badge variants with theme colors
- ✅ Success/Warning/Error states: Use `--color-success`, `--color-warning`, `--color-error`
- ✅ Icons: Use Lucide icons (NOT emojis)

---

### Error Handling

1. **Action Execution Errors:**
   - Log error but don't fail transaction creation
   - Create notification for user
   - Add to rule execution log with error details

2. **Invalid Pattern Variables:**
   - Show validation error in UI
   - Highlight problematic variables
   - Provide helpful error message

3. **Missing References:**
   - If merchant/category doesn't exist, skip that action
   - Log warning
   - Continue with other actions

4. **Backward Compatibility:**
   - Old rules with only `categoryId` continue to work
   - Migration creates proper `actions` array
   - API accepts both old and new formats

---

### Performance Considerations

1. **Actions Execution:**
   - Execute actions synchronously (they're fast)
   - Cache merchant/category lookups within single transaction
   - Don't fetch unnecessary data

2. **Bulk Apply:**
   - Process in batches of 100 transactions
   - Use transactions (database) for atomicity
   - Show progress indicator

3. **Database:**
   - Index on `actions` column not needed (JSON field, rarely queried)
   - Keep existing indexes on `priority`, `userId`, `isActive`

---

### Future Enhancements (Phase 2)

After Phase 1 is complete and stable, we can add:

1. **Convert to Transfer Action:**
   - Match transactions by amount and date
   - Suggest transfer pairs
   - Create linked transfer_out/transfer_in transactions

2. **Split Transaction Action:**
   - Define split rules (percentage or fixed amounts)
   - Auto-create transaction splits
   - Apply different categories to splits

3. **Change Account Action:**
   - Move transaction to different account
   - Update account balances
   - Log account change in activity feed

4. **Set Tax Deduction Action:**
   - Mark transaction as tax deductible
   - Set tax category
   - Apply to specific form types

5. **Conditional Actions:**
   - If/then action logic
   - Action chaining
   - Dynamic action parameters based on transaction data

---

## Success Criteria

Phase 1 is considered complete when:

- ✅ Users can create rules with description modification actions
- ✅ Users can create rules with merchant-setting actions
- ✅ Pattern variables work correctly in description actions
- ✅ Multiple actions can be configured per rule
- ✅ Actions are applied during transaction creation
- ✅ Bulk apply rules works with new actions
- ✅ Rule execution log shows applied actions
- ✅ UI clearly shows what actions each rule will perform
- ✅ All tests pass (unit + integration)
- ✅ No performance degradation
- ✅ Documentation is complete
- ✅ Existing rules continue to work (backward compatibility)

---

## Next Steps

After completing this plan:
1. Review and approve the plan
2. Create GitHub issues for each task
3. Begin implementation starting with Task 1
4. Daily check-ins to track progress
5. Weekly review of completed features

Let's build an awesome rules system! 🚀
