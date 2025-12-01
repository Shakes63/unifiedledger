# Inline Transaction Editing - Extended Fields

## Overview

Extend the existing inline transaction editing system (category and merchant dropdowns) to include:
- **Date** - Editable date picker
- **Account** - Dropdown selector
- **Amount** - Numeric input
- **Description** - Text input

All fields will be editable directly on the transaction card without navigating to the detail page.

## Current State

The `InlineTransactionDropdown` component currently handles:
- Category selection (with "create new" option)
- Merchant selection (with "create new" option)
- Missing field warning (yellow border)
- Loading states
- Optimistic updates

## Implementation Plan

### Task 1: Create Reusable Inline Edit Components

Create new inline edit components following the same patterns as `InlineTransactionDropdown`:

#### 1.1 `InlineDateEdit` Component
- **File**: `components/transactions/inline-date-edit.tsx`
- **Behavior**: Click to toggle date input, saves on change/blur
- **Props**: `value`, `transactionId`, `onUpdate`, `disabled`, `className`
- **UI**: Compact date input (h-6, text-xs) matching existing dropdown style
- **Features**:
  - Click date text to reveal input
  - Auto-save on change
  - Escape to cancel
  - Loading spinner during save

#### 1.2 `InlineAccountSelect` Component
- **File**: `components/transactions/inline-account-select.tsx`
- **Behavior**: Dropdown to select account
- **Props**: `value`, `transactionId`, `accounts`, `onUpdate`, `disabled`, `className`
- **UI**: Matches existing dropdown style (h-6, text-xs, min-w, max-w)
- **Features**:
  - Shows current account name
  - List of all user accounts
  - No "create new" option (accounts are managed elsewhere)

#### 1.3 `InlineAmountEdit` Component
- **File**: `components/transactions/inline-amount-edit.tsx`
- **Behavior**: Click to edit amount
- **Props**: `value`, `transactionId`, `type` (for color), `onUpdate`, `disabled`, `className`
- **UI**: Compact numeric input with currency formatting
- **Features**:
  - Click amount to reveal input
  - Input type="number" with step="0.01"
  - Shows sign (+/-) based on transaction type
  - Auto-format with 2 decimal places
  - Saves on blur or Enter

#### 1.4 `InlineDescriptionEdit` Component
- **File**: `components/transactions/inline-description-edit.tsx`
- **Behavior**: Click to edit description
- **Props**: `value`, `transactionId`, `onUpdate`, `disabled`, `className`
- **UI**: Compact text input, truncated display when not editing
- **Features**:
  - Click text to reveal input
  - Auto-expand on focus
  - Saves on blur or Enter
  - Escape to cancel

### Task 2: Update Transactions Page

Modify `/app/dashboard/transactions/page.tsx`:

#### 2.1 Add Update Handler
Extend `handleUpdateTransaction` to support all new field types:
```typescript
const handleUpdateTransaction = async (
  transactionId: string, 
  field: 'categoryId' | 'merchantId' | 'accountId' | 'date' | 'amount' | 'description', 
  value: string | number
) => Promise<void>
```

#### 2.2 Update Transaction Card Layout

Current layout:
```
Row 1: [Merchant dropdown] [Entity badges]
Row 2: [Description text]
Row 3: [Date text] • [Category dropdown] • [Split indicator]
Right: [Amount] [Account name] [Repeat button]
```

New layout (preserving structure, making fields editable):
```
Row 1: [Merchant dropdown] [Entity badges]
Row 2: [Description EDITABLE]
Row 3: [Date EDITABLE] • [Category dropdown] • [Split indicator]
Right: [Amount EDITABLE] [Account EDITABLE] [Repeat button]
```

#### 2.3 Transfer Transaction Handling
For transfer transactions (`transfer_out`, `transfer_in`):
- **Date**: Editable (updates both sides of transfer)
- **Amount**: Editable (updates both sides of transfer)
- **Account**: NOT editable inline (requires special handling, keep navigation to detail page)
- **Description**: Editable (updates both sides of transfer)
- **Category/Merchant**: NOT shown (transfers don't have these)

### Task 3: Update Transaction API (if needed)

Review `/api/transactions/[id]/route.ts`:
- The PUT handler already supports updating: `accountId`, `categoryId`, `merchantId`, `date`, `amount`, `description`
- No API changes needed

### Task 4: Testing & Polish

#### 4.1 Manual Testing Checklist
- [ ] Edit date inline and verify save
- [ ] Edit account inline and verify save (including balance updates)
- [ ] Edit amount inline and verify save (including balance updates)
- [ ] Edit description inline and verify save
- [ ] Verify keyboard navigation (Enter to save, Escape to cancel)
- [ ] Verify loading states display correctly
- [ ] Test with search filters active
- [ ] Test mobile responsiveness
- [ ] Test theme compatibility (all 7 themes)

#### 4.2 Edge Cases
- Empty values (required fields should have validation)
- Very long descriptions (truncation)
- Invalid date formats
- Negative amounts
- Account balance edge cases
- Transfer transaction handling

## Component Specifications

### Shared Styling Constants
```typescript
// Consistent with existing InlineTransactionDropdown
const INLINE_EDIT_CLASSES = {
  wrapper: "inline-flex items-center",
  input: "h-6 text-xs px-2 py-0.5 bg-elevated border border-border rounded focus:ring-1 focus:ring-offset-0",
  loading: "opacity-60",
};
```

### Shared Behavior Patterns
1. **Click to Edit**: Display value as text/badge, click reveals input
2. **Auto-Save**: Save on blur or Enter key
3. **Cancel**: Escape key cancels edit, reverts to original value
4. **Loading State**: Show spinner during save, disable input
5. **Error Handling**: Toast notification on error, revert to original value

## File Changes Summary

### New Files
1. `components/transactions/inline-date-edit.tsx`
2. `components/transactions/inline-account-select.tsx`
3. `components/transactions/inline-amount-edit.tsx`
4. `components/transactions/inline-description-edit.tsx`

### Modified Files
1. `app/dashboard/transactions/page.tsx` - Integrate new inline edit components

## Implementation Order

1. **Task 1.4**: InlineDescriptionEdit (simplest, pure text)
2. **Task 1.1**: InlineDateEdit (date input)
3. **Task 1.3**: InlineAmountEdit (numeric input)
4. **Task 1.2**: InlineAccountSelect (dropdown)
5. **Task 2**: Update transactions page
6. **Task 4**: Testing & polish

## Theme Considerations

All components must use semantic CSS variables:
- `bg-elevated` for input backgrounds
- `border-border` for borders
- `text-foreground` for text
- `text-muted-foreground` for placeholders
- `var(--color-income)` / `var(--color-expense)` for amount colors
- `var(--color-primary)` for focus states

## Accessibility

- All inputs have proper labels (via aria-label)
- Keyboard navigation fully supported
- Focus management on edit mode toggle
- Screen reader friendly status announcements


