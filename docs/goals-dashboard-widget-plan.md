# Goals Dashboard Widget Implementation Plan

## Objective
Add a compact goals summary widget to the main dashboard that displays active savings goals overview and provides quick navigation to the full goals page.

## Current State Analysis
- **Dashboard Location**: `app/dashboard/page.tsx`
- **Existing Structure**:
  1. CompactStatsBar (4-5 stat cards in one row)
  2. Add Transaction Button
  3. EnhancedBillsWidget
  4. RecentTransactions
  5. Collapsible Budget Details
  6. Collapsible Debt & Credit

- **Goals API**: `app/api/savings-goals/route.ts`
  - GET endpoint returns array of goals with: id, name, description, targetAmount, currentAmount, targetDate, category, color, status, priority
  - Supports `?status=active` filter for active goals only

- **Goals Page**: `app/dashboard/goals/page.tsx`
  - Full featured page with goal management
  - Summary stats: Total Target, Total Saved, Progress %, Active Goals count

## Design Requirements

### Widget Features
1. **Summary Statistics**:
   - Total Saved amount across all active goals
   - Total Target amount across all active goals
   - Overall progress percentage
   - Count of active goals

2. **Visual Elements**:
   - Compact card layout (single card, not multiple)
   - Progress bar showing overall savings progress
   - Icon (Target from lucide-react)
   - Color-coded based on progress (similar to budget system)

3. **Interaction**:
   - Click entire card to navigate to `/dashboard/goals`
   - Hover state with subtle transition
   - Responsive layout (mobile-first)

4. **Conditional Rendering**:
   - Only display widget if user has active goals
   - Show loading state during initial fetch
   - Handle error state gracefully (no toast, just hide widget)

5. **Theme Integration**:
   - Use CSS variables exclusively (no hardcoded colors)
   - Background: `bg-card`
   - Border: `border-border`
   - Text: `text-foreground`, `text-muted-foreground`
   - Accent: `text-[var(--color-income)]` for positive progress
   - Icon: `text-muted-foreground` with `hover:text-foreground`

### Placement on Dashboard
Insert widget between **CompactStatsBar** and **Add Transaction Button** sections:
- Makes goals visible without scrolling
- Doesn't push transaction entry too far down
- Logical flow: Stats → Goals → Actions → Details

## Implementation Tasks

### Task 1: Create GoalsSummaryWidget Component
**File**: `components/dashboard/goals-summary-widget.tsx` (NEW)
**Estimated Lines**: ~200 lines

**Component Structure**:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, ChevronRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  status: string;
}

export function GoalsSummaryWidget() {
  // State management
  // API data fetching
  // Calculations
  // Conditional rendering logic
  // Return JSX
}
```

**Key Features**:
- Fetch active goals from `/api/savings-goals?status=active`
- Calculate totals (targetAmount, currentAmount)
- Calculate overall progress percentage
- Count active goals
- Clickable card with router.push navigation
- Loading skeleton during fetch
- Auto-hide if no active goals (return null)
- Error handling (console.error, return null)

**Color Logic**:
- Progress < 30%: `text-[var(--color-error)]` (red/pink)
- Progress 30-70%: `text-[var(--color-warning)]` (amber)
- Progress > 70%: `text-[var(--color-income)]` (green/turquoise)

**Layout**:
```
+------------------------------------------+
| 🎯 Savings Goals           [→]          |
|------------------------------------------|
| $X,XXX / $X,XXX saved      XX% Complete |
| [=========>---------]  Progress Bar     |
| X Active Goals                           |
+------------------------------------------+
```

### Task 2: Integrate Widget into Dashboard
**File**: `app/dashboard/page.tsx`
**Estimated Lines**: ~10 lines modified

**Changes**:
1. Import GoalsSummaryWidget component
2. Add new section between CompactStatsBar and Add Transaction Button:
```tsx
{/* Goals Summary - Conditionally displayed */}
<section className="mb-6">
  <GoalsSummaryWidget />
</section>
```

**Before**:
```tsx
<CompactStatsBar />
<Add Transaction Button>
<EnhancedBillsWidget />
```

**After**:
```tsx
<CompactStatsBar />
<GoalsSummaryWidget />  // NEW
<Add Transaction Button>
<EnhancedBillsWidget />
```

### Task 3: Update Documentation
**Files**:
- `docs/features.md` - Mark task 1 as complete
- `.claude/CLAUDE.md` - Add completion summary

**Changes**:
- Update features.md to show completed status
- Add session summary with component details
- Document widget features and integration

### Task 4: Build Verification
**Commands**:
```bash
pnpm build
```

**Verification Checklist**:
- ✅ Zero TypeScript errors
- ✅ All pages compile successfully
- ✅ Production build successful
- ✅ Widget displays correctly with active goals
- ✅ Widget hidden when no active goals
- ✅ Responsive layout works on mobile
- ✅ Theme variables applied correctly
- ✅ Navigation to goals page works
- ✅ Loading state displays properly

## Technical Specifications

### API Call
```typescript
const response = await fetch('/api/savings-goals?status=active');
const goals = await response.json();
```

### Calculations
```typescript
const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
const progressPercent = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
const activeCount = goals.length;
```

### CSS Classes (Theme Variables)
- Card: `bg-card border border-border rounded-xl p-4 hover:border-[var(--color-primary)]/50 cursor-pointer transition-all`
- Header: `text-lg font-semibold text-foreground`
- Stats: `text-muted-foreground text-sm`
- Amounts: `font-mono text-foreground font-semibold`
- Progress: Uses shadcn/ui Progress component with `bg-elevated` track
- Icon: `text-muted-foreground w-5 h-5`

## Testing Considerations

### Test Scenarios
1. **With Active Goals**: Widget displays with correct calculations
2. **No Active Goals**: Widget hidden (returns null)
3. **Loading State**: Skeleton/loading indicator shown
4. **Error State**: Widget hidden, error logged to console
5. **Click Navigation**: Router navigates to `/dashboard/goals`
6. **Responsive**: Looks good on mobile (320px), tablet (768px), desktop (1024px+)
7. **Theme Compatibility**: Works with all 7 themes (Dark Green, Dark Pink, Dark Blue, Dark Turquoise, Light Turquoise, Light Bubblegum, Light Blue)

### Edge Cases
- User with 0 active goals but completed goals → Hidden
- User with paused goals only → Hidden (filtered by status=active)
- Very large numbers (e.g., $999,999.99) → Format with commas
- API error → Gracefully hide widget
- Slow network → Show loading state

## Success Criteria
1. ✅ Widget displays when user has active goals
2. ✅ Widget hidden when no active goals exist
3. ✅ All calculations accurate (totals, percentages)
4. ✅ Navigation works correctly
5. ✅ Responsive on all screen sizes
6. ✅ Theme variables used throughout
7. ✅ No TypeScript errors
8. ✅ Production build successful
9. ✅ Loading state displays during fetch
10. ✅ Error handling prevents crashes

## Estimated Completion Time
- Task 1: 30-45 minutes (component creation)
- Task 2: 5-10 minutes (dashboard integration)
- Task 3: 5-10 minutes (documentation)
- Task 4: 10-15 minutes (build verification + testing)
- **Total**: ~1 hour

## Files to Create/Modify
1. **CREATE**: `components/dashboard/goals-summary-widget.tsx` (~200 lines)
2. **MODIFY**: `app/dashboard/page.tsx` (~10 lines)
3. **MODIFY**: `docs/features.md` (~5 lines)
4. **MODIFY**: `.claude/CLAUDE.md` (~50 lines)

**Total Estimated Lines**: ~265 lines (200 new, 65 modified)

## Architecture Integration
- **Follows Existing Patterns**: Similar to BudgetSummaryWidget, CreditUtilizationWidget, DebtCountdownCard
- **Component-Level Data Fetching**: Independent API calls, no prop drilling
- **Conditional Rendering**: Only shows when relevant (has active goals)
- **Theme System**: 100% CSS variables, works with all themes
- **Responsive Design**: Mobile-first with grid/flexbox
- **Navigation**: Uses Next.js router for client-side navigation
- **Loading States**: Skeleton or loading indicator during fetch
- **Error Handling**: Graceful failures with console logging

## Notes
- Widget intentionally compact (single card, not grid of cards)
- Progress bar is overall progress across ALL active goals
- Individual goal details accessible via navigation to full goals page
- No inline editing (keeps dashboard clean, use goals page for CRUD)
- Auto-refresh not needed (page loads fresh data on navigation)
- Could add refresh on transaction create (future enhancement)
