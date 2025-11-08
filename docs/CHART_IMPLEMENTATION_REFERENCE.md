# Chart & Dashboard Implementation Reference

## File Locations: Current Components

### Existing Dashboard Components
```
/components/dashboard/
├── spending-summary.tsx       (8,616 bytes) - Weekly/monthly spending overview
├── recent-transactions.tsx    (6,045 bytes) - Last 5 transactions list
├── bills-widget.tsx          (6,284 bytes) - This month's bills
└── savings-goals-widget.tsx  (3,380 bytes) - Top 3 savings goals

/app/dashboard/
├── page.tsx                  (3,300 bytes) - Main dashboard page
├── transactions/page.tsx     - Full transaction management
├── accounts/page.tsx         - Account management
├── categories/page.tsx       - Budget categories management
├── bills/page.tsx           - Bill dashboard
├── goals/page.tsx           - Savings goals dashboard
├── debts/page.tsx           - Debt management dashboard
├── calendar/page.tsx        - Calendar view
└── notifications/page.tsx   - Notification center
```

### Key API Endpoints
```
/app/api/
├── spending-summary/route.ts        (172 lines) - Weekly/monthly spending data
├── transactions/route.ts            - Transaction CRUD
├── transactions/search/route.ts     - Advanced search with filtering
├── budgets/check/route.ts          - Budget status checking
└── [other financial endpoints]
```

### Supporting Components & Utilities
```
/components/
├── ui/
│   ├── card.tsx             - Card wrapper component
│   ├── button.tsx           - Button component
│   ├── progress.tsx         - Progress bar
│   ├── badge.tsx            - Badge/tag component
│   └── [17 total components]
├── forms/
│   └── [transaction, bill, goal forms]
└── navigation/
    ├── sidebar.tsx          - Collapsible sidebar navigation
    └── mobile-nav.tsx       - Mobile hamburger menu

/lib/
├── db/
│   ├── schema.ts            - Complete database schema
│   └── index.ts             - Database client
└── utils.ts                 - Utility functions
```

## Architecture Reference

### Data Flow for Chart Implementation

```
User Action
    ↓
API Endpoint (e.g., /api/reports/income-vs-expenses)
    ↓
Database Query (Drizzle ORM)
    ↓
Data Transformation & Formatting
    ↓
JSON Response
    ↓
React Component (e.g., SpendingTrendChart)
    ↓
Recharts Library (LineChart, BarChart, etc.)
    ↓
Rendered Chart in Browser
```

### Design System Constants
**Dark Theme Colors** (from `/app/globals.css`):
```
Background:     #0a0a0a (near-black for OLED)
Surface:        #1a1a1a (card/panel backgrounds)
Elevated:       #242424 (hover states)
Border:         #2a2a2a (subtle dividers)
Text Primary:   #ffffff (headings)
Text Secondary: #9ca3af (labels)
Text Tertiary:  #6b7280 (metadata)

Semantic Colors:
Income:    #10b981 (emerald-400)
Expense:   #f87171 (red-400)
Transfer:  #60a5fa (blue-400)
Warning:   #fbbf24 (amber-400)
```

### Typography
- **Font**: Inter (modern, clean sans-serif)
- **Mono Font**: JetBrains Mono
- **Headings**: Bold (700 weight), white
- **Body Text**: Regular (400), gray-400
- **Small Text**: Regular (400), gray-500

### Spacing & Radius
- **Border Radius**: 12px (xl), 8px (lg), 6px (md)
- **Spacing**: 6px units (p-3=12px, p-4=16px, p-6=24px)
- **Gap**: 6px/24px between cards

## Database Schema for Analytics

### Core Tables (Currently Used)
```typescript
// From /lib/db/schema.ts

// Transactions - Main financial data
transactions {
  id: string (primary key)
  userId: string (foreign key)
  amount: decimal
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out'
  description: string
  date: string (YYYY-MM-DD)
  categoryId?: string
  accountId: string
  notes?: string
  // ... 15+ more fields
  Indexes: idx_transactions_category, idx_transactions_type, idx_transactions_amount,
           idx_transactions_user_date, idx_transactions_user_category
}

// Budget Categories - Category definitions
budgetCategories {
  id: string (primary key)
  userId: string
  name: string
  monthlyBudget: number
  type: 'Income' | 'Variable Expense' | 'Monthly Bill' | 'Savings' | 'Debt' | 'Non-Monthly Bill'
  dueDate?: number (day of month)
  // ... more fields
}

// Usage Analytics - Usage tracking for optimization
usageAnalytics {
  id: string
  userId: string
  entityType: 'account' | 'category' | 'merchant'
  entityId: string
  usageCount: number
  lastUsedAt: timestamp
  // Indexes: idx_usage_analytics_unique, idx_usage_analytics_user
}

// Household Activity Log - Audit trail
householdActivityLog {
  id: string
  householdId: string
  userId: string
  type: string (20+ activity types)
  description: string
  metadata: JSON
  timestamp: ISO string
  // Indexes: idx_activity_user, idx_activity_household, idx_activity_type, idx_activity_date
}

// Bills, Savings Goals, Debts - Specialized tracking
bills { /* bill definitions and instances */ }
savingsGoals { /* goal tracking with milestones */ }
debts { /* debt tracking with payments */ }
```

### Tables Needed for Reports (Not Yet Created)
```typescript
// Snapshots for historical comparison
monthlyBudgetSnapshots {
  id: string
  userId: string
  month: YYYY-MM-DD (first of month)
  categoryId: string
  plannedAmount: decimal
  actualAmount: decimal
  createdAt: timestamp
}

// Pattern detection
recurringPatterns {
  id: string
  userId: string
  pattern: string (description of pattern)
  category: string
  averageAmount: decimal
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
  confidence: number (0-100)
  lastDetected: timestamp
}

// Saved reports
reportPresets {
  id: string
  userId: string
  name: string
  reportType: string
  filters: JSON (date range, categories, accounts, etc.)
  createdAt: timestamp
  usageCount: number
  lastUsedAt: timestamp
}

// Report scheduling
reportSchedules {
  id: string
  userId: string
  reportType: string
  recipients: string[] (email addresses)
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  dayOfWeek?: number (0-6)
  dayOfMonth?: number (1-31)
  timezone: string
  enabled: boolean
  createdAt: timestamp
}
```

## Implementation Checklist: Phase 1 (Core Charts)

### Components to Create
```
/components/charts/
├── [ ] chart-container.tsx          - Wrapper component for all charts
│       Props: title, subtitle, children, height, className
│       Features: dark theme, responsive sizing, legend integration
│
├── [ ] line-chart.tsx               - Recharts LineChart wrapper
│       Props: data, dataKey, xAxisKey, yAxisKey, lines[], height
│       Features: dark theme styling, multiple lines, smooth animation
│
├── [ ] bar-chart.tsx                - Recharts BarChart wrapper
│       Props: data, dataKey, xAxisKey, bars[], height
│       Features: dark theme, stacked bar support, responsive
│
├── [ ] pie-chart.tsx                - Recharts PieChart wrapper
│       Props: data, dataKey, nameKey, colors, height, showLegend
│       Features: dark theme, custom colors, donut chart option
│
├── [ ] area-chart.tsx               - Recharts AreaChart wrapper
│       Props: data, areas[], xAxisKey, height
│       Features: dark theme, smooth curves, stacked areas
│
├── [ ] composed-chart.tsx           - Multiple chart types combined
│       Props: data, lines[], bars[], areas[], height
│       Features: combine multiple metrics, dark theme
│
├── [ ] progress-chart.tsx           - Custom progress visualization
│       Props: current, target, label, color
│       Features: circular/linear progress, milestone markers
│
└── [ ] chart-legend.tsx             - Reusable legend component
        Props: items[], colors[], onClick handler
        Features: color dots, clickable items, custom styling
```

### API Endpoints to Create
```
/app/api/reports/
├── [ ] income-vs-expenses/route.ts
│       GET: Monthly income/expense data for last 12 months
│       Response: Array<{ month, income, expenses, net }>
│
├── [ ] category-breakdown/route.ts
│       GET: Enhanced category spending with trends
│       Params: startDate, endDate, categoryId
│       Response: Array<{ category, amount, percentage, trend, budget }>
│
├── [ ] cash-flow/route.ts
│       GET: Cash inflow/outflow analysis
│       Response: Array<{ date, inflow, outflow, net }>
│
├── [ ] net-worth/route.ts
│       GET: Total assets, liabilities, net worth
│       Response: { assets, liabilities, netWorth, trend }>
│
├── [ ] budget-vs-actual/route.ts
│       GET: Budgeted vs actual spending by category
│       Response: Array<{ category, budget, actual, variance }>
│
└── [ ] merchant-analysis/route.ts
        GET: Spending patterns by merchant
        Response: Array<{ merchant, amount, frequency, trend }>
```

### Pages to Create
```
/app/dashboard/
├── [ ] reports/
│       └── page.tsx
│           Features:
│           - Report card grid (6 reports)
│           - Quick stats cards
│           - Date range picker
│           - Export button
│           Layout: Hero section + report cards grid
│
└── [ ] analytics/
        └── page.tsx
            Features:
            - Full-width charts
            - Advanced filtering sidebar
            - Custom date range selector
            - Multiple view options (monthly, quarterly, yearly)
            Layout: Sidebar + main content area
```

## Code Example Templates

### Chart Component Template
```typescript
'use client';

import { useEffect, useState } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';

interface LineChartProps {
  data: Array<{
    name: string;
    [key: string]: string | number;
  }>;
  dataKey: string;
  height?: number;
  title?: string;
  subtitle?: string;
}

export function LineChartComponent({
  data,
  dataKey,
  height = 300,
  title,
  subtitle,
}: LineChartProps) {
  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-6 rounded-xl">
      {title && <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>}
      {subtitle && <p className="text-sm text-gray-400 mb-4">{subtitle}</p>}
      
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart
          data={data}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#2a2a2a"
            vertical={false}
          />
          <XAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#242424',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
            }}
            cursor={{ stroke: '#3a3a3a' }}
          />
          <Legend
            wrapperStyle={{
              paddingTop: '20px',
              color: '#9ca3af',
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </Card>
  );
}
```

### API Endpoint Template
```typescript
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, budgetCategories } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate') || /* default */;
    const endDate = url.searchParams.get('endDate') || /* default */;

    // Query transactions
    const txns = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );

    // Transform data for charts
    const data = /* transformation logic */;

    return Response.json(data);
  } catch (error) {
    console.error('Report error:', error);
    return Response.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
```

## Integration Points

### Existing APIs to Leverage
```
GET /api/spending-summary         - Spending overview (already exists)
GET /api/transactions             - Transaction history
GET /api/transactions/search      - Advanced search with filters
GET /api/budgets/check            - Budget status
GET /api/bills/instances          - Bill instances
GET /api/savings-goals            - Goals with milestones
GET /api/debts/stats              - Debt statistics
```

### Color Mapping for Charts
```typescript
const chartColors = {
  income: '#10b981',      // emerald-400
  expense: '#f87171',     // red-400
  transfer: '#60a5fa',    // blue-400
  warning: '#fbbf24',     // amber-400
  primary: '#3b82f6',     // blue-500
  secondary: '#8b5cf6',   // violet-500
  success: '#10b981',     // emerald-400
  danger: '#ef4444',      // red-500
};
```

### Responsive Breakpoints (Tailwind)
```
sm: 640px   - Mobile
md: 768px   - Tablet
lg: 1024px  - Desktop
xl: 1280px  - Large desktop
```

## Testing Considerations

### API Testing
- Test with different date ranges
- Test with no data scenarios
- Test with large datasets (1000+ transactions)
- Verify currency formatting
- Check user isolation (auth verification)

### Component Testing
- Responsive design at all breakpoints
- Dark theme contrast ratios
- Chart animations smoothness
- Loading states
- Error states

### Performance Targets
- Chart render < 100ms (for < 10K data points)
- API response < 500ms
- Bundle size impact < 50KB (gzip)

## Resources & References

### Recharts Documentation
- https://recharts.org/ - Official docs
- Component: LineChart, BarChart, PieChart, AreaChart, ComposedChart

### Project Standards
- Dark theme: See `/app/globals.css`
- Component patterns: See `/components/ui/` (17 existing components)
- API patterns: See `/app/api/spending-summary/route.ts`
- Database patterns: See `/lib/db/schema.ts`

### Related Files
- Type definitions: `/lib/db/schema.ts`
- UI utilities: `/lib/utils.ts`
- Date utilities: `date-fns` (already imported in existing components)
- Number formatting: `decimal.js` for financial calculations

## Next Steps

1. **Create chart components** (week 1-2)
   - LineChart, BarChart, PieChart, AreaChart
   - ChartContainer wrapper with dark theme
   - Responsive sizing and legend management

2. **Build reports API endpoints** (week 2-3)
   - Income vs Expenses
   - Category breakdown
   - Cash flow analysis
   - Other specialized reports

3. **Create reports dashboard** (week 3-4)
   - Main reports hub page
   - Report card grid layout
   - Date range picker
   - Quick filters

4. **Add advanced features** (week 4+)
   - Export functionality
   - Report presets
   - Advanced filtering
   - Email scheduling

---

**Last Updated:** November 8, 2024
**Status:** Ready for implementation
**Priority:** HIGH - Core feature for financial analysis
