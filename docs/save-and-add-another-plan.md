# Save & Add Another Feature - Implementation Plan

## Overview
Add "Save & Add Another" functionality to Transaction, Account, Bill, and Debt forms to allow rapid bulk data entry without navigating away from the form after each save.

**Status:** Not Started
**Priority:** Medium
**Estimated Time:** 4-6 hours
**Date:** 2025-11-10

## Objective
Enhance user productivity by adding a secondary save button that saves the current item and immediately resets the form for another entry, keeping the user in the data entry flow.

## User Stories
1. As a user entering multiple transactions, I want to save and immediately add another without navigating back to the form
2. As a user setting up multiple accounts, I want to quickly create them in succession
3. As a user adding multiple bills, I want to streamline the entry process
4. As a user tracking multiple debts, I want to enter them efficiently

## Design Principles
- **Preserve Context:** Keep sensible defaults (e.g., same account for transactions)
- **Clear Feedback:** Show success toast for each saved item
- **Visual Distinction:** Make it clear which button does what
- **Consistent UX:** Apply the same pattern across all four forms
- **Theme Integration:** Use CSS variables throughout

## Technical Requirements

### 1. UI/UX Requirements
- Two save buttons side by side
- Primary button: "Save" (pink, existing behavior - saves and navigates away)
- Secondary button: "Save & Add Another" (accent color, new behavior - saves and resets)
- Success toast shows the name/description of what was saved
- Form resets to initial state (with intelligent defaults preserved)
- Focus returns to first input field for quick data entry
- Both buttons show loading state during save operation

### 2. Forms to Update
1. **Transaction Form** (`components/transactions/transaction-form.tsx`)
2. **Account Form** (`components/accounts/account-form.tsx`)
3. **Bill Form** (`components/bills/bill-form.tsx`)
4. **Debt Form** (`components/debts/debt-form.tsx`)

### 3. Intelligent Defaults to Preserve
**Transaction Form:**
- Account selection (likely adding multiple transactions to same account)
- Transaction type (likely adding multiple of same type)
- Date (defaults to today anyway)

**Account Form:**
- Account type (if adding multiple of same type)
- Everything else resets

**Bill Form:**
- Payment frequency (if adding multiple bills with same frequency)
- Everything else resets

**Debt Form:**
- Debt type (if adding multiple of same type)
- Payment frequency (if adding multiple with same frequency)
- Everything else resets

## Implementation Plan

### Phase 1: Transaction Form Enhancement (1.5 hours)

#### Task 1.1: Update TransactionForm Component
**File:** `components/transactions/transaction-form.tsx`
**Changes:**
1. Add state variable to track which button was clicked: `const [saveMode, setSaveMode] = useState<'save' | 'saveAndAdd' | null>(null)`
2. Update button section to include two buttons:
   ```tsx
   <div className="flex gap-2">
     <Button
       type="submit"
       onClick={() => setSaveMode('save')}
       disabled={isSubmitting}
       className="flex-1 bg-[var(--color-primary)] text-white hover:opacity-90"
     >
       {isSubmitting && saveMode === 'save' ? 'Saving...' : 'Save'}
     </Button>
     <Button
       type="submit"
       onClick={() => setSaveMode('saveAndAdd')}
       disabled={isSubmitting}
       className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
     >
       {isSubmitting && saveMode === 'saveAndAdd' ? 'Saving...' : 'Save & Add Another'}
     </Button>
   </div>
   ```
3. Update form submission handler to check `saveMode`
4. If `saveMode === 'saveAndAdd'`:
   - Save the transaction
   - Show success toast with transaction description
   - Store account and type in temp variables
   - Reset form to initial state
   - Restore account and type selections
   - Focus on first input field (description)
   - Reset `saveMode` to null
5. If `saveMode === 'save'`:
   - Save the transaction (existing behavior)
   - Navigate away (existing behavior)

#### Task 1.2: Test Transaction Form
- Test creating multiple transactions in succession
- Verify account and type are preserved
- Verify other fields reset correctly
- Verify focus returns to description field
- Test with both income and expense transactions
- Test with splits enabled
- Verify toast messages show correct descriptions

### Phase 2: Account Form Enhancement (1 hour)

#### Task 2.1: Update AccountForm Component
**File:** `components/accounts/account-form.tsx`
**Changes:**
1. Add `saveMode` state variable
2. Add "Save & Add Another" button (accent color)
3. Update form submission to handle both save modes
4. If `saveMode === 'saveAndAdd'`:
   - Save the account
   - Show success toast with account name
   - Store account type in temp variable
   - Reset form
   - Restore account type
   - Focus on account name field
   - Reset `saveMode`

#### Task 2.2: Test Account Form
- Test creating multiple accounts
- Verify account type is preserved
- Verify icon and color reset to defaults
- Verify initial balance resets to 0
- Verify focus on name field

### Phase 3: Bill Form Enhancement (1 hour)

#### Task 3.1: Update BillForm Component
**File:** `components/bills/bill-form.tsx`
**Changes:**
1. Add `saveMode` state variable
2. Add "Save & Add Another" button (accent color)
3. Update form submission to handle both save modes
4. If `saveMode === 'saveAndAdd'`:
   - Save the bill
   - Show success toast with bill name
   - Store payment frequency in temp variable
   - Reset form
   - Restore payment frequency
   - Focus on bill name field
   - Reset `saveMode`

#### Task 3.2: Test Bill Form
- Test creating multiple bills
- Verify frequency is preserved
- Verify amount and due date reset
- Verify category selection resets
- Verify focus on name field

### Phase 4: Debt Form Enhancement (1 hour)

#### Task 4.1: Update DebtForm Component
**File:** `components/debts/debt-form.tsx`
**Changes:**
1. Add `saveMode` state variable
2. Add "Save & Add Another" button (accent color)
3. Update form submission to handle both save modes
4. If `saveMode === 'saveAndAdd'`:
   - Save the debt
   - Show success toast with debt name
   - Store debt type and payment frequency in temp variables
   - Reset form
   - Restore debt type and payment frequency
   - Focus on debt name field
   - Reset `saveMode`

#### Task 4.2: Test Debt Form
- Test creating multiple debts
- Verify debt type and frequency are preserved
- Verify amounts, dates, and rates reset
- Verify category selection resets
- Verify focus on name field

### Phase 5: Documentation & Polish (0.5 hours)

#### Task 5.1: Update Documentation
**Files to update:**
- `.claude/CLAUDE.md` - Add feature completion summary
- `docs/features.md` - Mark feature as complete

#### Task 5.2: Visual & UX Polish
- Verify button sizing is consistent across all forms
- Verify loading states work correctly
- Verify toast messages are clear and helpful
- Verify keyboard navigation works (Tab, Enter)
- Verify all colors use theme CSS variables
- Test in both Dark Mode and Dark Pink Theme

#### Task 5.3: Production Build Verification
```bash
pnpm build
```
- Verify zero TypeScript errors
- Verify all pages compile successfully

## Technical Details

### Button Styling Pattern
Use consistent styling across all forms:

```tsx
// Primary Save Button (existing)
<Button
  type="submit"
  onClick={() => setSaveMode('save')}
  disabled={isSubmitting}
  className="flex-1 bg-[var(--color-primary)] text-white hover:opacity-90"
>
  {isSubmitting && saveMode === 'save' ? 'Saving...' : 'Save'}
</Button>

// Secondary Save & Add Another Button (new)
<Button
  type="submit"
  onClick={() => setSaveMode('saveAndAdd')}
  disabled={isSubmitting}
  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
>
  {isSubmitting && saveMode === 'saveAndAdd' ? 'Saving...' : 'Save & Add Another'}
</Button>
```

### Toast Message Pattern
```tsx
toast.success(`Transaction "${description}" saved successfully!`);
toast.success(`Account "${accountName}" created successfully!`);
toast.success(`Bill "${billName}" created successfully!`);
toast.success(`Debt "${debtName}" created successfully!`);
```

### Form Reset Pattern
```tsx
// Store values to preserve
const preservedAccount = accountId;
const preservedType = type;

// Reset all fields
setDescription('');
setAmount('');
setMerchant('');
setCategory('');
// ... reset other fields

// Restore preserved values
setAccountId(preservedAccount);
setType(preservedType);

// Focus first input
document.getElementById('description-input')?.focus();
```

### Focus Management
Each form should focus on its primary identifier field after reset:
- **Transaction:** Description field
- **Account:** Account name field
- **Bill:** Bill name field
- **Debt:** Debt name field

## Color Scheme (Theme Integration)

### Button Colors
- **Primary Save:** `bg-[var(--color-primary)]` (pink) with `text-white`
- **Save & Add Another:** `bg-accent` with `text-accent-foreground`
- **Hover states:** `hover:opacity-90` for primary, `hover:bg-accent/90` for secondary
- **Disabled state:** Inherits from Button component

### Success Toast
Uses default success styling from sonner (green checkmark)

## Edge Cases & Error Handling

### Validation Errors
- If validation fails, show error toast
- Keep form data intact
- Don't reset form on validation error
- Reset `saveMode` so buttons return to normal state

### API Errors
- If save fails, show error toast
- Keep form data intact
- Don't reset form on API error
- Reset `saveMode` so buttons return to normal state

### Concurrent Saves
- Disable both buttons during save operation
- Show loading state on the clicked button
- Prevent form submission if already submitting

### Empty Required Fields
- Standard validation applies to both buttons
- Form won't submit if required fields are empty

## Testing Checklist

### Transaction Form
- [ ] Save button works (existing behavior)
- [ ] Save & Add Another saves transaction
- [ ] Account is preserved after reset
- [ ] Type is preserved after reset
- [ ] Description resets
- [ ] Amount resets
- [ ] Category resets
- [ ] Merchant resets
- [ ] Notes reset
- [ ] Focus returns to description field
- [ ] Success toast shows correct description
- [ ] Works with income transactions
- [ ] Works with expense transactions
- [ ] Works with split transactions
- [ ] Loading states work correctly
- [ ] Error handling works

### Account Form
- [ ] Save button works (existing behavior)
- [ ] Save & Add Another saves account
- [ ] Account type is preserved
- [ ] Name resets
- [ ] Initial balance resets to 0
- [ ] Icon resets to default
- [ ] Color resets to default
- [ ] Focus returns to name field
- [ ] Success toast shows correct account name
- [ ] Loading states work correctly
- [ ] Error handling works

### Bill Form
- [ ] Save button works (existing behavior)
- [ ] Save & Add Another saves bill
- [ ] Frequency is preserved
- [ ] Name resets
- [ ] Amount resets
- [ ] Due date resets
- [ ] Category resets
- [ ] Focus returns to name field
- [ ] Success toast shows correct bill name
- [ ] Loading states work correctly
- [ ] Error handling works

### Debt Form
- [ ] Save button works (existing behavior)
- [ ] Save & Add Another saves debt
- [ ] Debt type is preserved
- [ ] Payment frequency is preserved
- [ ] Name resets
- [ ] Balance resets
- [ ] Interest rate resets
- [ ] Minimum payment resets
- [ ] Category resets
- [ ] Focus returns to name field
- [ ] Success toast shows correct debt name
- [ ] Loading states work correctly
- [ ] Error handling works

### Cross-Cutting Concerns
- [ ] Both themes work (Dark Mode + Dark Pink Theme)
- [ ] All colors use CSS variables
- [ ] Buttons are same size and aligned
- [ ] Loading states are consistent
- [ ] Toast messages are helpful
- [ ] Keyboard navigation works
- [ ] Mobile responsive
- [ ] Production build successful

## Success Criteria
1. ✅ All four forms have "Save & Add Another" button
2. ✅ Button styling is consistent and uses theme variables
3. ✅ Forms reset properly after using "Save & Add Another"
4. ✅ Intelligent defaults are preserved (account, type, frequency)
5. ✅ Success toasts show helpful messages
6. ✅ Focus returns to appropriate field after reset
7. ✅ Error handling prevents form reset on failures
8. ✅ Loading states work for both buttons
9. ✅ Zero TypeScript errors
10. ✅ Production build successful
11. ✅ Works in both themes
12. ✅ All tests in checklist pass

## Files to Create/Modify

### Files to Modify (4 files)
1. `components/transactions/transaction-form.tsx` (~50 lines modified)
2. `components/accounts/account-form.tsx` (~50 lines modified)
3. `components/bills/bill-form.tsx` (~50 lines modified)
4. `components/debts/debt-form.tsx` (~50 lines modified)

### Documentation Files (2 files)
1. `.claude/CLAUDE.md` - Add completion summary
2. `docs/features.md` - Mark feature complete

**Total Estimated Changes:** ~200-250 lines across 6 files

## Implementation Order
1. **Start with Transaction Form** (most commonly used, highest impact)
2. **Then Account Form** (similar pattern, builds confidence)
3. **Then Bill Form** (applies learned pattern)
4. **Then Debt Form** (applies learned pattern)
5. **Documentation & Polish** (final verification)

## Risk Assessment
**Risk Level:** Low
- Additive feature (no breaking changes)
- Isolated to form components
- Follows existing patterns
- Easy to test and verify

## Dependencies
- None (uses existing APIs and components)
- All required libraries already installed (sonner for toasts)

## Future Enhancements (Optional)
- Add keyboard shortcut (Ctrl/Cmd + Enter for Save & Add Another)
- Add user preference to set default save mode
- Add count indicator showing how many items added in current session
- Add "Batch Entry Mode" that defaults to Save & Add Another

## Notes
- This feature is commonly requested for bulk data entry scenarios
- Preserving context (account, type, frequency) is key to good UX
- Focus management is critical for keyboard-heavy users
- Clear toast messages help users feel confident data was saved
- Consistent button styling across all forms creates predictable UX
