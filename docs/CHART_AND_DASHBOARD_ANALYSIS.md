# Unified Ledger: Chart & Dashboard Components Analysis

## Executive Summary

The Unified Ledger application has **recharts v3.3.0** installed and available, but it is **NOT currently being used** in any components. The codebase has a robust foundation with basic dashboard widgets and data structures in place, but lacks advanced chart visualizations needed for a comprehensive Reports Dashboard.

---

## Currently Existing Dashboard Components

### 1. **Dashboard Widgets** (4 components)
Located in `/components/dashboard/`:

#### a) `spending-summary.tsx` (8,616 bytes)
- **Purpose:** Weekly/monthly spending overview
- **Data Displayed:**
  - Income, Expenses, Net totals
  - Category breakdown with progress bars
  - Top 5 merchants
- **Features:**
  - Period navigation (weekly/monthly toggle)
  - Previous/Next date buttons
  - Progress bars for category spending
  - Currently uses **NO charts** - just text and progress bars

#### b) `recent-transactions.tsx` (6,045 bytes)
- **Purpose:** Show last 5 transactions with repeat functionality
- **Features:**
  - Transaction list with icons and amounts
  - "Repeat transaction" button for quick re-entry
  - Type badges (income, expense, transfer)
  - No visualization/charts

#### c) `bills-widget.tsx` (6,284 bytes)
- **Purpose:** Current month bills overview
- **Data Displayed:**
  - Total bills amount
  - Paid vs pending counts
  - Bill list with status indicators
  - No charts

#### d) `savings-goals-widget.tsx` (3,380 bytes)
- **Purpose:** Top 3 active savings goals with progress
- **Features:**
  - Progress bars for each goal
  - Milestones tracking
  - Edit/delete functionality
  - No charts

### 2. **Main Dashboard Page**
Located at `/app/dashboard/page.tsx`:
- Quick overview cards (Total Balance, Monthly Spending, Budget Status)
- "Add Transaction" call-to-action
- Bills widget integration
- Recent transactions list

### 3. **Other Dashboard Pages**
- `/dashboard/accounts` - Account management
- `/dashboard/transactions` - Full transaction list with advanced search
- `/dashboard/bills` - Bill management
- `/dashboard/goals` - Savings goals management
- `/dashboard/debts` - Debt tracking
- `/dashboard/calendar` - Calendar view of transactions/bills
- `/dashboard/categories` - Budget categories management
- `/dashboard/notifications` - Notification center

---

## Charting Library Status

### **Recharts v3.3.0** is available but UNUSED
```json
{
  "recharts": "^3.3.0"
}
```

**Available chart types (not currently used):**
- LineChart
- BarChart
- PieChart
- AreaChart
- ComposedChart
- ScatterChart
- RadarChart
- TreemapChart
- And 15+ more component types

---

## Data Structure & API Endpoints

### Available Spending Data API
**Endpoint:** `GET /api/spending-summary`
- **Parameters:**
  - `period`: 'weekly' | 'monthly'
  - `date`: YYYY-MM-DD format

- **Response includes:**
  ```typescript
  {
    period: string;
    totalIncome: number;
    totalExpense: number;
    totalTransfer: number;
    netAmount: number;
    byCategory: Array<{
      categoryId: string;
      categoryName: string;
      amount: number;
      percentage: number;
      transactionCount: number;
    }>;
    topMerchants: Array<{
      merchant: string;
      amount: number;
      transactionCount: number;
    }>;
  }
  ```

### Other Available Data Sources
1. **Transactions** - Full transaction history with filtering
2. **Budget Categories** - Monthly budgets per category
3. **Bills** - Bill tracking with due dates and status
4. **Savings Goals** - Goals with milestones
5. **Debts** - Debt tracking with payment history
6. **UsageAnalytics** - Usage tracking for accounts, categories, merchants

---

## What's MISSING for a Reports Dashboard

### 1. **Chart Components** (0/7 implemented)
The following visualization types should be created:

- [ ] **LineChart Component** - Spending trends over time
- [ ] **BarChart Component** - Category spending comparison
- [ ] **PieChart Component** - Category distribution
- [ ] **AreaChart Component** - Income vs Expenses trend
- [ ] **ComposedChart Component** - Multiple metrics comparison
- [ ] **Custom Progress Charts** - Goal/debt progress visualization
- [ ] **HeatmapChart** - Spending patterns by day/week

### 2. **Reports Data APIs** (0/6 implemented)
Missing API endpoints for advanced reporting:

- [ ] `GET /api/reports/income-vs-expenses` - Trend data
- [ ] `GET /api/reports/category-breakdown` - Enhanced category analytics
- [ ] `GET /api/reports/cash-flow` - Cash flow statements
- [ ] `GET /api/reports/net-worth` - Asset tracking
- [ ] `GET /api/reports/budget-vs-actual` - Budget performance
- [ ] `GET /api/reports/merchant-analysis` - Merchant spending patterns

### 3. **Reports Dashboard Pages** (0/2 implemented)
- [ ] `/dashboard/reports` - Main reports hub
- [ ] `/dashboard/analytics` - Detailed analytics page

### 4. **Report Configuration Features** (0/5 implemented)
- [ ] Custom date range selection
- [ ] Report filtering by account/category/merchant
- [ ] Report export (PDF, CSV, JSON)
- [ ] Saved report presets
- [ ] Email report scheduling

### 5. **Specialized Reports** (0/5 implemented)
- [ ] Tax Summary Report
- [ ] Budget Performance Report
- [ ] Quarterly/Annual Summary
- [ ] Spending Trends Report
- [ ] Net Worth Report

---

## Database Schema Status

### Existing Tables for Analytics
- ✅ `transactions` - Full transaction history
- ✅ `budgetCategories` - Category definitions with monthly budgets
- ✅ `usageAnalytics` - Usage tracking (prepared for analytics)
- ✅ `householdActivityLog` - Activity audit trail

### Tables Needed for Enhanced Analytics
- ❌ `monthlyBudgetSnapshots` - Historical budget data
- ❌ `recurringPatterns` - Identified spending patterns
- ❌ `reportPresets` - Saved custom reports
- ❌ `reportSchedules` - Email report scheduling

---

## Visual Style & Design System

The application uses:
- **Dark theme first** (background: #0a0a0a, surface: #1a1a1a)
- **Color scheme:**
  - Income: Emerald (#10b981)
  - Expense: Red (#f87171)
  - Transfer: Blue (#60a5fa)
  - Warning: Amber (#fbbf24)
- **Typography:** Inter font family
- **Component library:** shadcn/ui (17 components installed)
- **Responsive design:** Mobile-first with Tailwind CSS

---

## Integration Points Already in Place

### ✅ What's Ready
1. **Data APIs** - `/api/spending-summary` exists and working
2. **Database schema** - All transaction, category, and budget data available
3. **UI Components** - Card, Button, Progress, Badge, Select components available
4. **Date handling** - date-fns library ready for complex date operations
5. **Number formatting** - Decimal.js available for precise calculations
6. **Type safety** - Full TypeScript support throughout

### ✅ Existing Transaction Data Flow
1. Transactions created → Stored in `transactions` table
2. Categories linked → `budgetCategories` table
3. Usage tracked → `usageAnalytics` table
4. Activity logged → `householdActivityLog` table

---

## Recommended Implementation Path

### Phase 1: Core Chart Components (3-4 weeks)
1. Create reusable chart wrapper components with dark theme
2. Implement LineChart, BarChart, PieChart, AreaChart
3. Add chart containers with headers and legends
4. Create responsive chart sizing system

### Phase 2: Reports Dashboard (2-3 weeks)
1. Build `/dashboard/reports` main page
2. Create report card grid layout
3. Implement date range picker
4. Build report preview modals

### Phase 3: Advanced Analytics (3-4 weeks)
1. Create `/dashboard/analytics` page
2. Implement category breakdown analytics
3. Add cash flow analysis
4. Build spending trend analyzer

### Phase 4: Report Features (2-3 weeks)
1. Saved report presets
2. Export functionality (PDF, CSV)
3. Report filtering
4. Email scheduling infrastructure

### Phase 5: Specialized Reports (2-3 weeks)
1. Tax summary report
2. Budget performance report
3. Quarterly/annual summaries
4. Net worth tracking

---

## Code Examples: What Needs to Be Built

### Example: LineChart Component (Not yet implemented)
```typescript
// This needs to be created: components/charts/line-chart.tsx
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function SpendingTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
        <XAxis stroke="#6b7280" />
        <YAxis stroke="#6b7280" />
        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }} />
        <Line type="monotone" dataKey="amount" stroke="#10b981" />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
```

### Example: Reports API Endpoint (Not yet implemented)
```typescript
// This needs to be created: app/api/reports/income-vs-expenses/route.ts
export async function GET(request: Request) {
  // Fetch last 12 months of transactions
  // Calculate monthly income and expenses
  // Return formatted data for charts
  // Response: Array<{ month, income, expenses, net }>
}
```

---

## Summary Table: Current vs Needed Components

| Feature | Status | Location | Priority |
|---------|--------|----------|----------|
| Dashboard Overview | ✅ Complete | `/dashboard/page.tsx` | N/A |
| Spending Summary Widget | ✅ Complete | `/components/dashboard/spending-summary.tsx` | N/A |
| Recent Transactions | ✅ Complete | `/components/dashboard/recent-transactions.tsx` | N/A |
| Bills Widget | ✅ Complete | `/components/dashboard/bills-widget.tsx` | N/A |
| Line Charts | ❌ Missing | Needs creation | HIGH |
| Bar Charts | ❌ Missing | Needs creation | HIGH |
| Pie Charts | ❌ Missing | Needs creation | HIGH |
| Area Charts | ❌ Missing | Needs creation | MEDIUM |
| Reports Hub | ❌ Missing | `/dashboard/reports` | HIGH |
| Analytics Page | ❌ Missing | `/dashboard/analytics` | MEDIUM |
| Report APIs | ❌ Missing | `/api/reports/*` | HIGH |
| Tax Report | ❌ Missing | Feature | LOW |
| Budget Report | ❌ Missing | Feature | MEDIUM |
| Export Features | ❌ Missing | Feature | MEDIUM |
| Report Scheduling | ❌ Missing | Feature | LOW |

---

## File Structure for New Components

```
components/
├── charts/
│   ├── line-chart.tsx          (NEW)
│   ├── bar-chart.tsx           (NEW)
│   ├── pie-chart.tsx           (NEW)
│   ├── area-chart.tsx          (NEW)
│   ├── composed-chart.tsx       (NEW)
│   └── chart-container.tsx      (NEW - wrapper)
├── reports/
│   ├── report-header.tsx        (NEW)
│   ├── report-filters.tsx       (NEW)
│   ├── date-range-picker.tsx    (NEW)
│   └── report-card.tsx          (NEW)
└── dashboard/
    ├── [existing files]
    └── analytics-summary.tsx    (NEW)

app/
├── api/
│   └── reports/
│       ├── income-vs-expenses/route.ts    (NEW)
│       ├── category-breakdown/route.ts    (NEW)
│       ├── cash-flow/route.ts             (NEW)
│       └── [more report endpoints]        (NEW)
└── dashboard/
    ├── [existing pages]
    ├── reports/
    │   └── page.tsx             (NEW)
    └── analytics/
        └── page.tsx             (NEW)
```

---

## Conclusion

The Unified Ledger project has:
- ✅ **recharts library installed** but completely unused
- ✅ **Strong data foundation** with transaction, category, and analytics tables
- ✅ **Working spending summary API** with comprehensive data
- ✅ **Professional UI design system** ready for charts
- ❌ **NO chart components** implemented
- ❌ **NO reports dashboard** pages
- ❌ **NO advanced analytics** features

**To build a complete Reports Dashboard, approximately 15-25 new components and 6-10 new API endpoints need to be created.** The recharts library is ready to use; the foundation data is in place. The main work involves creating chart components, reports pages, and analytics APIs.

