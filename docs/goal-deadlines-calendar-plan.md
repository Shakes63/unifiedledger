# Goal Deadlines on Calendar - Implementation Plan

## Overview
Display savings goal target dates on the calendar view, allowing users to see upcoming goal deadlines alongside their transactions and bills.

## Feature Requirements
1. Show goal deadlines on the calendar month view
2. Show goal deadlines on the calendar week view
3. Display goal details in the day modal when clicking a date
4. Use consistent styling with existing calendar elements (bills, transactions)
5. Use goal colors to distinguish between different goals

## Architecture Analysis

### Current Calendar Structure
- **Month View API** (`/api/calendar/month`): Returns `daySummaries` with transaction counts and bill info
- **Day View API** (`/api/calendar/day`): Returns detailed transactions and bills for a specific day
- **Components**: 
  - `CalendarMonth` - Grid layout for month
  - `CalendarWeek` - 7-day horizontal layout
  - `CalendarDay` - Individual day cell with indicators
  - `CalendarDayModal` - Detailed view when clicking a day
  - `TransactionIndicators` - Reusable indicator badges

### Goal Data Structure (from schema)
```typescript
savingsGoals {
  id: string
  userId: string
  householdId: string
  name: string
  description: string | null
  targetAmount: number
  currentAmount: number | null
  targetDate: string | null  // ISO date string (optional)
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  color: string  // Hex color for display
  icon: string   // Icon name
  priority: number
}
```

## Implementation Plan

### Phase 1: API Updates

#### Task 1.1: Update `/api/calendar/month/route.ts`
- Import `savingsGoals` from schema
- Query goals with `targetDate` within the month range
- Add goals to `daySummaries` for each relevant date
- Goal summary structure:
  ```typescript
  goals?: Array<{
    id: string;
    name: string;
    color: string;
    targetAmount: number;
    currentAmount: number;
    progress: number;  // percentage 0-100
    status: string;
  }>;
  goalCount: number;
  ```

#### Task 1.2: Update `/api/calendar/day/route.ts`
- Query goals with `targetDate` matching the specific date
- Return full goal details in response
- Include goal milestones if relevant

### Phase 2: Type Updates

#### Task 2.1: Update `DayTransactionSummary` Interface
Add to all components that use this interface:
- `app/dashboard/calendar/page.tsx`
- `components/calendar/calendar-month.tsx`
- `components/calendar/calendar-day.tsx`
- `components/calendar/calendar-week.tsx`
- `components/calendar/calendar-day-modal.tsx`

New fields:
```typescript
interface DayTransactionSummary {
  // existing fields...
  goalCount: number;
  goals?: Array<{
    id: string;
    name: string;
    color: string;
    targetAmount: number;
    currentAmount: number;
    progress: number;
    status: string;
  }>;
}
```

### Phase 3: Component Updates

#### Task 3.1: Update `TransactionIndicators` Component
- Add optional `goalCount` prop
- Display goal indicator with Target icon
- Use `var(--color-primary)` or goal-specific colors

#### Task 3.2: Update `CalendarDay` Component
- Check for `summary.goals` in `hasActivity` calculation
- Render goal badges similar to bill badges
- Style with goal color from data
- Show goal name and progress percentage

#### Task 3.3: Update `CalendarWeek` Component
- Add goals section similar to bills section
- Display goal name, progress, and deadline indicator
- Use goal colors for visual distinction

#### Task 3.4: Update `CalendarDayModal` Component
- Add new Goal interface
- Add goals prop to component
- Create goals section similar to bills section
- Show goal details: name, target amount, current amount, progress bar
- Link to goals page for navigation

### Phase 4: Calendar Page Updates

#### Task 4.1: Update `app/dashboard/calendar/page.tsx`
- Add Goal interface at top
- Add `selectedDayGoals` state
- Fetch goals from day API response
- Pass goals to `CalendarDayModal`

## UI/UX Design

### Goal Badge (Calendar Cell)
```
┌─────────────────────────────┐
│ [Target Icon] Goal Name     │
│ ▓▓▓▓▓▓▓▓░░ 75%             │
└─────────────────────────────┘
```
- Background: Goal color at 20% opacity
- Text: Goal color
- Progress bar: Goal color
- Icon: Target or Flag icon from lucide-react

### Goal Section in Day Modal
```
┌────────────────────────────────────────┐
│ Goals (1)                              │
├────────────────────────────────────────┤
│ ┌──────────────────────────────────┐   │
│ │ [🎯] Emergency Fund              │   │
│ │ Target: $10,000 | Saved: $7,500  │   │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░ 75%        │   │
│ │ Status: Active                   │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

### Color Scheme
- Goal indicators use the goal's custom color (from `goal.color`)
- Default fallback: `var(--color-primary)`
- Progress bar: Goal color with opacity variation

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `app/api/calendar/month/route.ts` | Modify | Add goals query and include in daySummaries |
| `app/api/calendar/day/route.ts` | Modify | Add goals query and include in response |
| `app/dashboard/calendar/page.tsx` | Modify | Add Goal interface, state, and pass to modal |
| `components/calendar/calendar-day.tsx` | Modify | Add goal badge rendering |
| `components/calendar/calendar-week.tsx` | Modify | Add goal section rendering |
| `components/calendar/calendar-month.tsx` | Modify | Update interface only |
| `components/calendar/calendar-day-modal.tsx` | Modify | Add goals section and props |
| `components/calendar/transaction-indicators.tsx` | Modify | Add goal count indicator |

## Testing Checklist
- [ ] Goals with target dates appear on correct calendar dates
- [ ] Goals without target dates don't appear on calendar
- [ ] Goal badges display correct name and color
- [ ] Progress percentages calculate correctly
- [ ] Day modal shows goal details when clicking a date with goals
- [ ] Empty state works correctly (no goals on date)
- [ ] Both month and week views display goals correctly
- [ ] Styling is consistent with existing bills and transactions
- [ ] All theme variables work correctly

## Estimated Implementation Time
- Phase 1 (API Updates): 30 minutes
- Phase 2 (Type Updates): 15 minutes
- Phase 3 (Component Updates): 45 minutes
- Phase 4 (Calendar Page): 15 minutes
- Testing & Polish: 30 minutes

**Total: ~2.5 hours**

## Dependencies
- No new npm packages required
- Uses existing lucide-react icons (Target, Flag)
- Uses existing theme CSS variables
- Uses existing Decimal.js for progress calculations

