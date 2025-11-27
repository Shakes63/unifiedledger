# Non-Monthly Bill Month Selection - Implementation Plan

## Feature Overview

Add the ability to select a specific starting month when creating non-monthly bills (quarterly, semi-annual, annual). Currently, these bills always start from the current month. With this feature, users can specify which month their bill cycle should begin.

**Example Use Case:**
- User creates an annual insurance bill that's due every March 15
- Without this feature: If created in November, it would schedule for November 15 (potentially past), February 15 (next quarter), etc.
- With this feature: User selects "March" and day "15", and the system schedules for March 15, 2025, March 15, 2026, etc.

## Current Behavior Analysis

### How Bill Instances Are Generated

1. **Bill Creation (`/api/bills/route.ts`):**
   - User submits bill with `frequency`, `dueDate` (day of month 1-31)
   - System calls `calculateNextDueDate()` with `currentDate = new Date()`
   - Instances generated starting from current month

2. **Instance Calculation (`lib/bills/bill-utils.ts`):**
   - For monthly+: Uses `currentDate.getMonth()` as base
   - Adds month increments (1 for monthly, 3 for quarterly, 6 for semi-annual, 12 for annual)
   - Problem: No way to specify a different starting month

### Database Schema

```typescript
// bills table (lib/db/schema.ts)
dueDate: integer('due_date').notNull(), // Day of month (1-31) for monthly+
frequency: text('frequency', { enum: [...] }),
specificDueDate: text('specific_due_date'), // Only for one-time bills
```

Currently, `specificDueDate` is only used for one-time bills. Non-monthly recurring bills only have `dueDate` (day of month).

---

## Implementation Tasks

### Phase 1: Database Schema Update

**Task 1.1: Add `startMonth` column to bills table**

File: `lib/db/schema.ts`

```typescript
// Add after specificDueDate:
startMonth: integer('start_month'), // 0-11 (Jan-Dec), only for quarterly/semi-annual/annual
```

**Task 1.2: Create database migration**

File: `drizzle/0043_add_bill_start_month.sql`

```sql
-- Add startMonth column for non-monthly bill scheduling
ALTER TABLE bills ADD COLUMN start_month INTEGER;
```

---

### Phase 2: Bill Utilities Update

**Task 2.1: Add month constants and helper function**

File: `lib/bills/bill-utils.ts`

```typescript
// Add month options constant
export const MONTH_OPTIONS = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' },
];

// Add helper to check if frequency needs month selection
export function isNonMonthlyPeriodic(frequency: string): boolean {
  return ['quarterly', 'semi-annual', 'annual'].includes(frequency);
}
```

**Task 2.2: Update `calculateNextDueDate` function**

Modify the function signature and logic to accept an optional `startMonth` parameter:

```typescript
export function calculateNextDueDate(
  frequency: string,
  dueDate: number,
  specificDueDate: string | null,
  currentDate: Date,
  instanceIndex: number,
  startMonth?: number // NEW: 0-11 for non-monthly bills
): string {
  // ... existing code for one-time, weekly, biweekly ...
  
  case 'quarterly':
  case 'semi-annual':
  case 'annual': {
    const monthIncrement = frequency === 'quarterly' ? 3
      : frequency === 'semi-annual' ? 6
      : 12;

    // Calculate base month considering startMonth
    let baseMonth: number;
    let baseYear = currentDate.getFullYear();
    
    if (startMonth !== undefined && startMonth !== null) {
      // User specified a start month
      baseMonth = startMonth;
      
      // If the start month has already passed this year, use next occurrence
      const currentMonth = currentDate.getMonth();
      const currentDay = currentDate.getDate();
      
      if (startMonth < currentMonth || 
          (startMonth === currentMonth && dueDate < currentDay)) {
        // Move to next occurrence cycle
        baseMonth = startMonth + monthIncrement;
        if (baseMonth >= 12) {
          baseYear += Math.floor(baseMonth / 12);
          baseMonth = baseMonth % 12;
        }
      }
    } else {
      // Legacy behavior: start from current month
      baseMonth = currentDate.getMonth();
    }

    const monthsToAdd = instanceIndex * monthIncrement;
    let month = (baseMonth + monthsToAdd) % 12;
    let year = baseYear + Math.floor((baseMonth + monthsToAdd) / 12);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const instanceDueDate = Math.min(dueDate, daysInMonth);

    return new Date(year, month, instanceDueDate).toISOString().split('T')[0];
  }
}
```

**Task 2.3: Add `formatStartMonthDisplay` helper**

```typescript
export function formatStartMonthDisplay(startMonth: number | null): string {
  if (startMonth === null || startMonth === undefined) {
    return '';
  }
  const monthOption = MONTH_OPTIONS.find(m => m.value === startMonth);
  return monthOption ? monthOption.label : '';
}
```

---

### Phase 3: API Updates

**Task 3.1: Update POST `/api/bills/route.ts`**

1. Accept `startMonth` in request body
2. Validate it's only provided for non-monthly bills
3. Pass to instance generation

```typescript
// In the request body destructuring:
const {
  // ... existing fields
  startMonth, // NEW: 0-11 for quarterly/semi-annual/annual
} = body;

// Add validation:
if (startMonth !== undefined && startMonth !== null) {
  if (!isNonMonthlyPeriodic(frequency)) {
    return Response.json(
      { error: 'startMonth is only valid for quarterly, semi-annual, or annual bills' },
      { status: 400 }
    );
  }
  if (startMonth < 0 || startMonth > 11) {
    return Response.json(
      { error: 'startMonth must be between 0 (January) and 11 (December)' },
      { status: 400 }
    );
  }
}

// Update billData:
const billData = {
  // ... existing fields
  startMonth: isNonMonthlyPeriodic(frequency) ? startMonth : null,
};

// Update instance generation loop:
const dueDateString = calculateNextDueDate(
  frequency,
  dueDate,
  specificDueDate || null,
  today,
  i,
  startMonth // Pass startMonth to calculation
);
```

**Task 3.2: Update PUT `/api/bills/[id]/route.ts`**

Apply same validation and update logic for bill edits.

---

### Phase 4: Frontend Form Update

**Task 4.1: Update BillForm component**

File: `components/bills/bill-form.tsx`

1. Add state for `startMonth`
2. Import new constants from bill-utils
3. Add month selector dropdown that appears for non-monthly periodic frequencies
4. Handle form data changes

```typescript
// State:
const [formData, setFormData] = useState({
  // ... existing
  startMonth: bill?.startMonth ?? new Date().getMonth(), // Default to current month
});

// Add month dropdown in the form (after dueDate input):
{isNonMonthlyPeriodic(formData.frequency) && (
  <div>
    <Label className="text-muted-foreground text-sm mb-2 block">Start Month*</Label>
    <Select
      value={formData.startMonth.toString()}
      onValueChange={(value) => handleSelectChange('startMonth', value)}
    >
      <SelectTrigger className="bg-elevated border-border text-foreground">
        <SelectValue placeholder="Select month" />
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {MONTH_OPTIONS.map((month) => (
          <SelectItem 
            key={month.value} 
            value={month.value.toString()} 
            className="text-foreground"
          >
            {month.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground mt-1">
      First bill due in this month
    </p>
  </div>
)}

// Update handleSubmit to include startMonth:
onSubmit({
  // ... existing
  startMonth: isNonMonthlyPeriodic(formData.frequency) 
    ? parseInt(formData.startMonth.toString()) 
    : null,
}, saveMode || 'save');
```

**Task 4.2: Style Considerations**

- Use semantic theme variables (`bg-elevated`, `border-border`, `text-foreground`, etc.)
- Match existing Select component styling
- Add helpful description text
- Position the dropdown logically (between frequency and due date, or alongside due date)

---

### Phase 5: Bill Display Updates

**Task 5.1: Update `formatDueDateDisplay` function**

File: `lib/bills/bill-utils.ts`

Modify to optionally include start month for non-monthly bills:

```typescript
export function formatDueDateDisplay(
  frequency: string,
  dueDate: number | null,
  specificDueDate: string | null,
  startMonth?: number | null
): string {
  // ... existing one-time and weekly logic ...
  
  // For non-monthly periodic bills, include the month
  if (isNonMonthlyPeriodic(frequency) && dueDate !== null) {
    const monthLabel = startMonth !== null && startMonth !== undefined
      ? MONTH_OPTIONS.find(m => m.value === startMonth)?.label || ''
      : '';
    
    if (monthLabel) {
      return `${monthLabel} ${dueDate}${getOrdinalSuffix(dueDate)}`;
    }
    return `Day ${dueDate} of month`;
  }
  
  // Monthly bills
  if (dueDate !== null) {
    return `Day ${dueDate} of month`;
  }
  return 'Not set';
}

// Helper for ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
```

**Task 5.2: Update BillDetails component**

File: `components/bills/bill-details.tsx`

Pass `startMonth` to the display function where due date is shown.

---

### Phase 6: Testing & Validation

**Task 6.1: Manual Testing Checklist**

- [ ] Create quarterly bill with custom start month
- [ ] Create semi-annual bill with custom start month  
- [ ] Create annual bill with custom start month
- [ ] Verify bill instances are generated for correct months
- [ ] Verify bill instances handle year rollover correctly
- [ ] Edit existing bill and change start month
- [ ] Verify monthly/weekly/biweekly bills don't show month selector
- [ ] Verify one-time bills still work correctly
- [ ] Check that form defaults to current month

**Task 6.2: Edge Cases to Test**

- Creating bill in December with January start month (year rollover)
- Creating annual bill for a month that just passed (should schedule next year)
- Day 31 in months with fewer days (should adjust to last day)

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `lib/db/schema.ts` | Modify | Add `startMonth` column |
| `drizzle/0043_add_bill_start_month.sql` | Create | Migration file |
| `lib/bills/bill-utils.ts` | Modify | Add constants, update `calculateNextDueDate`, add helpers |
| `app/api/bills/route.ts` | Modify | Accept and validate `startMonth` in POST |
| `app/api/bills/[id]/route.ts` | Modify | Accept and validate `startMonth` in PUT |
| `components/bills/bill-form.tsx` | Modify | Add month selector dropdown |
| `components/bills/bill-details.tsx` | Modify | Display start month in due date |

---

## Design Notes

### UI/UX Decisions

1. **Month selector placement**: Display in a new row below frequency/due date for clarity
2. **Default value**: Current month (intuitive for most users)
3. **Conditional visibility**: Only show for quarterly/semi-annual/annual frequencies
4. **Helper text**: Include "First bill due in this month" to clarify purpose
5. **Form layout**: Keep 2-column grid pattern for consistency

### Theme Integration

All UI elements will use existing semantic theme variables:
- Background: `bg-elevated`, `bg-card`
- Text: `text-foreground`, `text-muted-foreground`
- Borders: `border-border`
- Interactive states: Match existing Select component patterns

---

## Estimated Implementation Time

- Phase 1 (Database): 10 minutes
- Phase 2 (Utilities): 30 minutes
- Phase 3 (API): 20 minutes
- Phase 4 (Form): 30 minutes
- Phase 5 (Display): 15 minutes
- Phase 6 (Testing): 20 minutes

**Total: ~2 hours**

---

## Rollout Considerations

1. **Backward Compatibility**: Existing bills without `startMonth` will continue to work (uses current month logic as fallback)
2. **No data migration needed**: New column is nullable, existing bills unaffected
3. **API backwards compatible**: `startMonth` is optional parameter

