# Reports Advanced Filtering & Custom Date Range Implementation Plan

**Status:** Planning Complete - Ready for Implementation  
**Created:** 2025-01-27  
**Priority:** High  
**Estimated Effort:** 3-4 days

---

## Overview

Enhance the Reports Dashboard (`/dashboard/reports`) with advanced filtering capabilities and a custom date range picker. Currently, the reports page only supports preset periods (month/year/12months). This feature will add:

1. **Custom Date Range Picker** - Allow users to select any date range instead of just preset periods
2. **Advanced Filtering** - Filter reports by account, category, and merchant
3. **Filter Persistence** - Save filter preferences to localStorage per household
4. **UI Enhancements** - Improved filter controls with collapsible sections and clear visual indicators

---

## Goals

- Enable users to generate reports for any custom date range
- Allow filtering reports by specific accounts, categories, or merchants
- Maintain backward compatibility with existing preset period functionality
- Provide intuitive UI that integrates seamlessly with existing design system
- Use semantic theme variables throughout for full theme support

---

## Architecture Integration

### Existing Components to Leverage

1. **Date Input Pattern** - Use native HTML `<input type="date">` (consistent with `AdvancedSearch` component)
2. **Select Components** - Use existing `Select` from `@/components/ui/select` for account/category/merchant dropdowns
3. **Card Components** - Use `Card`, `CardHeader`, `CardContent` for filter sections
4. **Button Components** - Use `Button` for filter actions and clear buttons
5. **Theme Variables** - Use semantic CSS variables (`--color-*`) for all colors

### API Integration

- All existing report API endpoints support `period` parameter
- Need to extend endpoints to support:
  - `startDate` and `endDate` parameters (ISO date strings)
  - `accountId`, `categoryId`, `merchantId` filter parameters
- Maintain backward compatibility - if `period` is provided, use it; otherwise use date range

### Data Flow

```
User selects filters → Update state → Fetch reports with filters → Transform data → Display charts
```

---

## Implementation Steps

### Phase 1: Backend API Updates (Day 1)

#### 1.1 Update Report API Endpoints

**Files to Update:**
- `app/api/reports/income-vs-expenses/route.ts`
- `app/api/reports/category-breakdown/route.ts`
- `app/api/reports/cash-flow/route.ts`
- `app/api/reports/net-worth/route.ts`
- `app/api/reports/budget-vs-actual/route.ts`
- `app/api/reports/merchant-analysis/route.ts`

**Changes:**
1. Add support for `startDate` and `endDate` query parameters (ISO date strings)
2. Add support for `accountId`, `categoryId`, `merchantId` filter parameters
3. Maintain backward compatibility with `period` parameter
4. If `period` is provided, calculate date range from it
5. If `startDate`/`endDate` are provided, use them instead
6. Apply filters to database queries:
   - Filter transactions by `accountId` if provided
   - Filter transactions by `categoryId` if provided
   - Filter transactions by `merchantId` if provided
7. Ensure all filters respect household isolation (already implemented)

**Query Pattern:**
```typescript
// Calculate date range
let startDate: Date;
let endDate: Date;

if (period) {
  // Use existing period logic
  const now = new Date();
  if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (period === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31);
  } else if (period === '12months') {
    endDate = new Date();
    startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
  }
} else if (startDateParam && endDateParam) {
  startDate = new Date(startDateParam);
  endDate = new Date(endDateParam);
} else {
  // Default to last 12 months
  endDate = new Date();
  startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
}

// Build query with filters
const query = db
  .select()
  .from(transactions)
  .where(
    and(
      eq(transactions.householdId, householdId),
      gte(transactions.date, startDate.toISOString()),
      lte(transactions.date, endDate.toISOString()),
      accountId ? eq(transactions.accountId, accountId) : undefined,
      categoryId ? eq(transactions.categoryId, categoryId) : undefined,
      merchantId ? eq(transactions.merchantId, merchantId) : undefined
    )
  );
```

#### 1.2 Add Filter Validation

- Validate date ranges (startDate < endDate)
- Validate date range is not too large (max 5 years recommended)
- Validate accountId/categoryId/merchantId belong to user's household
- Return appropriate error messages for invalid filters

#### 1.3 Testing

- Test all 6 endpoints with custom date ranges
- Test all 6 endpoints with account/category/merchant filters
- Test backward compatibility with period parameter
- Test error handling for invalid filters
- Test household isolation (filters should only show data from selected household)

---

### Phase 2: Frontend Filter Components (Day 2)

#### 2.1 Create DateRangePicker Component

**File:** `components/reports/date-range-picker.tsx`

**Features:**
- Two date inputs (start date, end date)
- Preset buttons (This Month, This Year, Last 12 Months, Last 30 Days, Last 90 Days, Custom)
- When preset is selected, auto-fill date inputs
- When dates are manually changed, switch to "Custom" preset
- Visual indicator showing selected date range
- Validation (start < end, max range)
- Use semantic theme variables for styling

**Props:**
```typescript
interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onDateChange: (startDate: string | null, endDate: string | null) => void;
  presets?: Array<{ label: string; startDate: Date; endDate: Date }>;
}
```

**UI Design:**
- Collapsible section with header "Date Range"
- Preset buttons in a horizontal row (mobile: wrap)
- Date inputs side-by-side (mobile: stacked)
- Selected preset highlighted with primary color
- Clear button to reset dates

#### 2.2 Create ReportFilters Component

**File:** `components/reports/report-filters.tsx`

**Features:**
- Collapsible filter panel
- Account selector (multi-select or single select)
- Category selector (multi-select or single select)
- Merchant selector (multi-select or single select)
- Clear all filters button
- Filter count badge showing active filters
- Use semantic theme variables throughout

**Props:**
```typescript
interface ReportFiltersProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: string }>;
  merchants: Array<{ id: string; name: string }>;
  selectedAccountIds: string[];
  selectedCategoryIds: string[];
  selectedMerchantIds: string[];
  onAccountChange: (accountIds: string[]) => void;
  onCategoryChange: (categoryIds: string[]) => void;
  onMerchantChange: (merchantIds: string[]) => void;
  onClearFilters: () => void;
}
```

**UI Design:**
- Collapsible card with chevron icon
- Filter count badge in header
- Each filter section (Account, Category, Merchant) in its own section
- Multi-select dropdowns using existing Select component
- Clear button at bottom
- Mobile-responsive layout

#### 2.3 Create FilterState Hook

**File:** `lib/hooks/use-report-filters.ts`

**Features:**
- Manage filter state (date range, accounts, categories, merchants)
- Persist filters to localStorage per household
- Load filters from localStorage on mount
- Provide helper functions to check if filters are active
- Provide helper function to clear all filters

**Hook API:**
```typescript
interface UseReportFiltersReturn {
  // Date range
  startDate: string | null;
  endDate: string | null;
  period: Period | null;
  setDateRange: (start: string | null, end: string | null) => void;
  setPeriod: (period: Period | null) => void;
  
  // Filters
  selectedAccountIds: string[];
  selectedCategoryIds: string[];
  selectedMerchantIds: string[];
  setAccountIds: (ids: string[]) => void;
  setCategoryIds: (ids: string[]) => void;
  setMerchantIds: (ids: string[]) => void;
  
  // Helpers
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  getFilterParams: () => URLSearchParams;
}
```

---

### Phase 3: Reports Page Integration (Day 3)

#### 3.1 Update Reports Page

**File:** `app/dashboard/reports/page.tsx`

**Changes:**
1. Add filter state management using `useReportFilters` hook
2. Fetch accounts, categories, and merchants on mount
3. Add `DateRangePicker` component above period selector
4. Add `ReportFilters` component in collapsible section
5. Update `fetchReports` function to use filter parameters
6. Update API calls to include filter query parameters
7. Show filter indicators when filters are active
8. Add "Clear Filters" button when filters are active

**UI Layout:**
```
[Header: Financial Reports]
[Date Range Picker] [Period Selector] [Export Button]
[Report Filters (Collapsible)]
[Summary Cards]
[Charts Grid]
```

#### 3.2 Update API Calls

**Current:**
```typescript
fetch(`/api/reports/income-vs-expenses?period=${period}`, { credentials: 'include' })
```

**Updated:**
```typescript
const params = new URLSearchParams();
if (period && !startDate && !endDate) {
  params.append('period', period);
} else if (startDate && endDate) {
  params.append('startDate', startDate);
  params.append('endDate', endDate);
}
if (selectedAccountIds.length > 0) {
  params.append('accountIds', selectedAccountIds.join(','));
}
if (selectedCategoryIds.length > 0) {
  params.append('categoryIds', selectedCategoryIds.join(','));
}
if (selectedMerchantIds.length > 0) {
  params.append('merchantIds', selectedMerchantIds.join(','));
}

fetch(`/api/reports/income-vs-expenses?${params.toString()}`, { credentials: 'include' })
```

#### 3.3 Add Loading States

- Show loading spinner when filters change
- Disable filter controls while loading
- Show error message if filter fetch fails

#### 3.4 Add Filter Indicators

- Badge showing number of active filters
- Visual highlight on filtered data
- Tooltip showing active filters on hover

---

### Phase 4: Styling & Polish (Day 4)

#### 4.1 Theme Integration

- Use semantic CSS variables for all colors:
  - `bg-background`, `bg-card`, `bg-elevated` for backgrounds
  - `text-foreground`, `text-muted-foreground` for text
  - `border-border` for borders
  - `bg-[var(--color-primary)]` for active states
  - `bg-[var(--color-success)]` for positive indicators
  - `bg-[var(--color-error)]` for errors

#### 4.2 Responsive Design

- Mobile: Stack date inputs vertically
- Mobile: Full-width filter sections
- Tablet: Side-by-side date inputs
- Desktop: Horizontal filter layout

#### 4.3 Accessibility

- Add proper ARIA labels to all inputs
- Keyboard navigation support
- Screen reader announcements for filter changes
- Focus management when filters are applied/cleared

#### 4.4 Error Handling

- Show error messages for invalid date ranges
- Show error messages for filter validation failures
- Graceful fallback if filter data fails to load

---

## Database Considerations

### No Schema Changes Required

- All filtering uses existing transaction fields (`accountId`, `categoryId`, `merchantId`, `date`)
- All filters respect existing household isolation
- No new indexes needed (existing indexes cover these queries)

### Query Performance

- Existing indexes should handle filtered queries efficiently:
  - `idx_transactions_user_date` - Date range queries
  - `idx_transactions_category` - Category filtering
  - `idx_transactions_user_category` - User + category queries
- Consider adding composite index if performance issues arise:
  - `idx_transactions_household_date_account` for account-filtered date queries

---

## Testing Plan

### Unit Tests

1. **DateRangePicker Component**
   - Test preset selection updates dates
   - Test manual date input switches to custom
   - Test date validation (start < end)
   - Test clear functionality

2. **ReportFilters Component**
   - Test multi-select functionality
   - Test filter count badge
   - Test clear all filters
   - Test filter persistence

3. **useReportFilters Hook**
   - Test localStorage persistence
   - Test filter state management
   - Test clear all filters
   - Test filter parameter generation

### Integration Tests

1. **API Endpoints**
   - Test custom date range queries
   - Test account filtering
   - Test category filtering
   - Test merchant filtering
   - Test combined filters
   - Test backward compatibility with period parameter
   - Test household isolation

2. **Reports Page**
   - Test filter application updates reports
   - Test filter persistence across page reloads
   - Test filter clearing resets reports
   - Test error handling

### Manual Testing Checklist

- [ ] Date range picker works with all presets
- [ ] Custom date range selection works
- [ ] Account filter applies correctly to all reports
- [ ] Category filter applies correctly to all reports
- [ ] Merchant filter applies correctly to all reports
- [ ] Multiple filters can be combined
- [ ] Filters persist across page reloads
- [ ] Clear filters button works
- [ ] Filter indicators show correct counts
- [ ] Mobile responsive layout works
- [ ] Theme variables work correctly
- [ ] Error messages display correctly
- [ ] Loading states work correctly

---

## File Structure

```
components/
├── reports/
│   ├── date-range-picker.tsx          (NEW)
│   ├── report-filters.tsx             (NEW)
│   └── export-button.tsx               (EXISTING)

lib/
├── hooks/
│   └── use-report-filters.ts          (NEW)

app/
├── api/
│   └── reports/
│       ├── income-vs-expenses/route.ts    (UPDATE)
│       ├── category-breakdown/route.ts    (UPDATE)
│       ├── cash-flow/route.ts            (UPDATE)
│       ├── net-worth/route.ts            (UPDATE)
│       ├── budget-vs-actual/route.ts     (UPDATE)
│       └── merchant-analysis/route.ts    (UPDATE)

app/
└── dashboard/
    └── reports/
        └── page.tsx                      (UPDATE)
```

---

## Success Criteria

### Functional Requirements

- ✅ Users can select custom date ranges
- ✅ Users can filter reports by account
- ✅ Users can filter reports by category
- ✅ Users can filter reports by merchant
- ✅ Multiple filters can be combined
- ✅ Filters persist across page reloads
- ✅ Backward compatibility with preset periods maintained
- ✅ All 6 report types support filtering

### Performance Requirements

- ✅ Report loading time < 2 seconds with filters
- ✅ Filter application is responsive (< 100ms UI update)
- ✅ No performance degradation with multiple filters

### UX Requirements

- ✅ Intuitive filter UI that matches existing design system
- ✅ Clear visual indicators for active filters
- ✅ Mobile-responsive layout
- ✅ Accessible (keyboard navigation, screen readers)
- ✅ Error messages are clear and helpful

### Technical Requirements

- ✅ All components use semantic theme variables
- ✅ Household isolation maintained
- ✅ Type-safe implementation (TypeScript)
- ✅ Proper error handling
- ✅ No breaking changes to existing API

---

## Future Enhancements (Out of Scope)

1. **Saved Report Presets** - Save filter combinations as named presets
2. **Email Report Scheduling** - Schedule filtered reports to be emailed
3. **PDF Export with Filters** - Export filtered reports as PDF
4. **Filter Templates** - Pre-defined filter combinations
5. **Advanced Date Options** - Fiscal year, quarter, custom ranges with presets

---

## Notes

- This implementation maintains full backward compatibility
- All filtering respects household isolation (already implemented)
- No database migrations required
- Uses existing UI components and patterns
- Follows existing code style and conventions

