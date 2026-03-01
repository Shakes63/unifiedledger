'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Wallet,
  Tags,
  Store,
  Receipt,
  Calculator,
  FileText,
  ArrowLeftRight,
  Workflow,
  Target,
  CreditCard,
  BarChart2,
  Users,
  Bell,
  Upload,
  WifiOff,
  FileSpreadsheet,
  DollarSign,
  Lightbulb,
  ExternalLink,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { HELP_SECTIONS, HelpSection } from '@/lib/help/help-sections';

interface HelpSectionData {
  id: HelpSection;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  quickLinks?: { label: string; href: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Group definitions
// ─────────────────────────────────────────────────────────────────────────────
const GROUPS = [
  {
    label: 'Foundation',
    color: 'var(--color-primary)',
    ids: [
      HELP_SECTIONS.GETTING_STARTED,
      HELP_SECTIONS.ACCOUNTS,
      HELP_SECTIONS.CATEGORIES,
      HELP_SECTIONS.MERCHANTS,
    ],
  },
  {
    label: 'Core Features',
    color: 'var(--color-income)',
    ids: [
      HELP_SECTIONS.TRANSACTIONS,
      HELP_SECTIONS.BUDGETS,
      HELP_SECTIONS.BILLS,
      HELP_SECTIONS.TRANSFERS,
    ],
  },
  {
    label: 'Advanced',
    color: 'var(--color-warning)',
    ids: [
      HELP_SECTIONS.RULES,
      HELP_SECTIONS.GOALS,
      HELP_SECTIONS.DEBTS,
      HELP_SECTIONS.REPORTS,
    ],
  },
  {
    label: 'System',
    color: 'var(--color-muted-foreground)',
    ids: [
      HELP_SECTIONS.HOUSEHOLDS,
      HELP_SECTIONS.NOTIFICATIONS,
      HELP_SECTIONS.IMPORT_EXPORT,
      HELP_SECTIONS.OFFLINE_MODE,
      HELP_SECTIONS.TAX,
      HELP_SECTIONS.SALES_TAX,
    ],
  },
] as const;

// Map section id → group color
function getGroupColor(id: string): string {
  for (const g of GROUPS) {
    if ((g.ids as readonly string[]).includes(id)) return g.color;
  }
  return 'var(--color-primary)';
}

// ─────────────────────────────────────────────────────────────────────────────
// Section data (content unchanged, presentation redesigned)
// ─────────────────────────────────────────────────────────────────────────────
const helpSections: HelpSectionData[] = [
  {
    id: HELP_SECTIONS.GETTING_STARTED,
    title: 'Getting Started',
    icon: <Lightbulb className="w-4 h-4" />,
    quickLinks: [
      { label: 'Accounts', href: '/dashboard/accounts' },
      { label: 'Categories', href: '/dashboard/categories' },
      { label: 'Settings', href: '/dashboard/settings' },
    ],
    content: (
      <div className="space-y-5">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Welcome to Unified Ledger! Here&apos;s how to get started with tracking your finances:
        </p>
        <div className="space-y-4">
          {[
            { n: 1, title: 'Create your accounts', desc: 'Add your bank accounts, credit cards, and cash accounts to track balances.' },
            { n: 2, title: 'Set up categories', desc: 'Create income and expense categories to organize transactions. Set budget amounts for expense categories.' },
            { n: 3, title: 'Add your first transaction', desc: 'Record an income or expense to start building your financial history.' },
            { n: 4, title: 'Set up budgets', desc: 'Use budget templates or create custom budgets to track spending limits.' },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex gap-3">
              <span
                className="flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-[11px] font-bold mt-0.5"
                style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}
              >
                {n}
              </span>
              <div>
                <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--color-foreground)' }}>{title}</p>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.ACCOUNTS,
    title: 'Accounts',
    icon: <Wallet className="w-4 h-4" />,
    quickLinks: [{ label: 'Manage Accounts', href: '/dashboard/accounts' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Accounts represent your financial accounts — bank accounts, credit cards, and cash.
        </p>
        <HelpSubsection title="Account Types">
          {[
            { k: 'Checking', v: 'Your primary bank account for daily transactions' },
            { k: 'Savings', v: 'Savings accounts for emergency funds or goals' },
            { k: 'Credit Card', v: 'Track credit card spending and balances' },
            { k: 'Cash', v: 'Track physical cash spending' },
            { k: 'Investment', v: 'Track investment account balances' },
          ].map(({ k, v }) => <HelpListItem key={k} label={k}>{v}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Tips">
          {[
            'Set your starting balance when creating an account',
            'Mark accounts as "default" for quick transaction entry',
            'Credit cards can track credit limits and utilization',
            'Archive accounts you no longer use instead of deleting them',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.CATEGORIES,
    title: 'Categories',
    icon: <Tags className="w-4 h-4" />,
    quickLinks: [{ label: 'Manage Categories', href: '/dashboard/categories' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Categories help you organize and track where your money comes from and where it goes.
        </p>
        <HelpSubsection title="Category Types">
          <HelpListItem label="Income" labelColor="var(--color-income)">Money coming in (salary, freelance, investments)</HelpListItem>
          <HelpListItem label="Expense" labelColor="var(--color-expense)">Money going out (rent, groceries, entertainment)</HelpListItem>
          <HelpListItem label="Savings" labelColor="var(--color-primary)">Money set aside for future use</HelpListItem>
        </HelpSubsection>
        <HelpCallout variant="warning" title="Setting Up Categories for Budgets">
          <p className="text-[12px] mb-2" style={{ color: 'var(--color-muted-foreground)' }}>
            To use budget templates, you need <strong>expense categories with budget amounts set</strong>:
          </p>
          <ol className="list-decimal ml-4 space-y-0.5 text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
            <li>Set the category type to &quot;Expense&quot;</li>
            <li>Enter a &quot;Monthly Budget&quot; amount (e.g., $500 for Groceries)</li>
            <li>Optionally set an income frequency for income categories</li>
          </ol>
        </HelpCallout>
        <HelpSubsection title="Tips">
          {[
            'Start with broad categories, then add specific ones as needed',
            'Categories are shared within your household',
            'Set income frequency (weekly, biweekly, monthly) for income tracking',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.MERCHANTS,
    title: 'Merchants',
    icon: <Store className="w-4 h-4" />,
    quickLinks: [{ label: 'Manage Merchants', href: '/dashboard/merchants' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Merchants represent the places where you spend money. They help with auto-categorization and spending analysis.
        </p>
        <HelpSubsection title="How Merchants Work">
          {[
            'Merchants are auto-created when you add transactions',
            'You can assign a default category to a merchant',
            'New transactions with that merchant will auto-categorize',
            'View spending history per merchant in reports',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Tips">
          {[
            'Clean up merchant names for better organization',
            'Merge duplicate merchants from CSV imports',
            'Set default categories to save time on future transactions',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.TRANSACTIONS,
    title: 'Transactions',
    icon: <Receipt className="w-4 h-4" />,
    quickLinks: [
      { label: 'View Transactions', href: '/dashboard/transactions' },
      { label: 'Add Transaction', href: '/dashboard/transactions/new' },
    ],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Transactions are the core of your financial tracking. Every income, expense, and transfer is a transaction.
        </p>
        <HelpSubsection title="Transaction Types">
          <HelpListItem label="Income" labelColor="var(--color-income)">Money received (salary, refunds, gifts)</HelpListItem>
          <HelpListItem label="Expense" labelColor="var(--color-expense)">Money spent (purchases, bills, subscriptions)</HelpListItem>
          <HelpListItem label="Transfer" labelColor="var(--color-primary)">Money moved between your accounts</HelpListItem>
        </HelpSubsection>
        <HelpSubsection title="Features">
          {[
            { k: 'Split transactions', v: 'Divide one purchase across multiple categories' },
            { k: 'Templates', v: 'Save frequently used transactions for quick entry' },
            { k: 'Duplicate detection', v: 'Warns you about similar recent transactions' },
            { k: 'Tags', v: 'Add custom tags for flexible organization' },
            { k: 'Notes', v: 'Add details or receipts to any transaction' },
          ].map(({ k, v }) => <HelpListItem key={k} label={k}>{v}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Tips">
          {[
            'Use the search bar to find transactions by description, merchant, or category',
            'Filter by date range, account, or category',
            'Click a transaction to view or edit details',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.BUDGETS,
    title: 'Budgets',
    icon: <Calculator className="w-4 h-4" />,
    quickLinks: [
      { label: 'Budget Planner', href: '/dashboard/budgets' },
      { label: 'Budget Insights', href: '/dashboard/budget-summary' },
    ],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Budgets help you plan and track spending limits for each category.
        </p>
        <HelpSubsection title="Budget Templates">
          {[
            { k: '50/30/20', v: '50% needs, 30% wants, 20% savings' },
            { k: 'Zero-Based', v: 'Assign every dollar to a category' },
            { k: 'Envelope', v: 'Fixed amounts for each spending category' },
          ].map(({ k, v }) => <HelpListItem key={k} label={k}>{v}</HelpListItem>)}
        </HelpSubsection>
        <HelpCallout variant="warning" title="No Budget Suggestions?">
          <ol className="list-decimal ml-4 space-y-0.5 text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
            <li>Create expense categories in <Link href="/dashboard/categories" className="underline" style={{ color: 'var(--color-primary)' }}>Categories</Link></li>
            <li>Set monthly budget amounts for those categories</li>
            <li>The template will distribute your income across these categories</li>
          </ol>
        </HelpCallout>
        <HelpSubsection title="Features">
          {[
            { k: 'Rollover', v: 'Unused budget can roll to next month' },
            { k: 'Analytics', v: 'See spending trends and patterns' },
            { k: 'Warnings', v: 'Get notified when approaching limits' },
            { k: 'Variable bills', v: 'Track bills that change each month' },
          ].map(({ k, v }) => <HelpListItem key={k} label={k}>{v}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.BILLS,
    title: 'Bills',
    icon: <FileText className="w-4 h-4" />,
    quickLinks: [
      { label: 'View Bills', href: '/dashboard/bills' },
      { label: 'Annual Planning', href: '/dashboard/bills/annual-planning' },
    ],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Track recurring bills and never miss a payment with automatic reminders.
        </p>
        <HelpSubsection title="Bill Frequencies">
          {['One-time', 'Weekly / Biweekly', 'Monthly', 'Quarterly', 'Semi-annual', 'Annual'].map(t => (
            <HelpListItem key={t}>{t}</HelpListItem>
          ))}
        </HelpSubsection>
        <HelpSubsection title="Auto-Detection">
          {[
            'Matches by description, amount (within 5%), and date pattern',
            'High-confidence matches are auto-linked',
            'Lower confidence matches are suggested for review',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Tips">
          {[
            'Set up autopay tracking for bills paid automatically',
            'Use Annual Planning view to see your full year of bills',
            'Variable bills track changing amounts (like utilities)',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.TRANSFERS,
    title: 'Transfers',
    icon: <ArrowLeftRight className="w-4 h-4" />,
    quickLinks: [{ label: 'View Transfers', href: '/dashboard/transfers' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Transfers move money between your own accounts without affecting your net worth.
        </p>
        <HelpSubsection title="How Transfers Work">
          {[
            'Select a source account (money leaves)',
            'Select a destination account (money arrives)',
            'The app creates linked transactions in both accounts',
            'Your total balance stays the same',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Common Uses">
          {[
            'Moving money to savings',
            'Paying credit card bills from checking',
            'Transferring between bank accounts',
            'Moving cash to/from physical wallet',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.RULES,
    title: 'Rules',
    icon: <Workflow className="w-4 h-4" />,
    quickLinks: [{ label: 'Manage Rules', href: '/dashboard/rules' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Rules automatically categorize and process your transactions based on conditions you define.
        </p>
        <HelpSubsection title="Rule Conditions">
          {[
            { k: 'Description', v: 'contains, starts with, equals, regex' },
            { k: 'Amount', v: 'equals, greater than, less than, between' },
            { k: 'Account', v: 'matches specific account' },
            { k: 'Date', v: 'day of month, weekday, month' },
          ].map(({ k, v }) => <HelpListItem key={k} label={k}>{v}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Rule Actions">
          {[
            { k: 'Set category', v: 'Assign a category' },
            { k: 'Set merchant', v: 'Assign a merchant' },
            { k: 'Modify description', v: 'Clean up or standardize text' },
            { k: 'Set tax status', v: 'Mark as tax deductible' },
            { k: 'Convert to transfer', v: 'Auto-detect transfers' },
            { k: 'Create splits', v: 'Auto-split transactions' },
          ].map(({ k, v }) => <HelpListItem key={k} label={k}>{v}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Tips">
          {[
            'Rules are processed in priority order (lower number = higher priority)',
            'Only the first matching rule applies',
            'Test rules before applying to all transactions',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.GOALS,
    title: 'Savings Goals',
    icon: <Target className="w-4 h-4" />,
    quickLinks: [{ label: 'View Goals', href: '/dashboard/goals' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Set savings goals and track your progress toward them.
        </p>
        <HelpSubsection title="Creating a Goal">
          {[
            'Give your goal a name (e.g., "Vacation Fund")',
            'Set your target amount',
            'Optionally set a target date',
            'Add milestones for motivation',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Tracking Progress">
          {[
            'Add contributions as you save',
            'See recommended monthly savings to hit your target',
            'Celebrate milestones as you reach them',
            'View progress chart over time',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.DEBTS,
    title: 'Debts',
    icon: <CreditCard className="w-4 h-4" />,
    quickLinks: [{ label: 'View Debts', href: '/dashboard/debts' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Track your debts and see projected payoff dates.
        </p>
        <HelpSubsection title="Debt Types">
          {['Credit cards', 'Student loans', 'Auto loans', 'Mortgages', 'Personal loans'].map(t => (
            <HelpListItem key={t}>{t}</HelpListItem>
          ))}
        </HelpSubsection>
        <HelpSubsection title="Features">
          {[
            { k: 'Payoff projections', v: 'See when you\'ll be debt-free' },
            { k: 'What-if calculator', v: 'Model extra payments' },
            { k: 'Interest tracking', v: 'See total interest paid' },
            { k: 'Milestones', v: 'Celebrate as you pay down debt' },
          ].map(({ k, v }) => <HelpListItem key={k} label={k}>{v}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.REPORTS,
    title: 'Reports',
    icon: <BarChart2 className="w-4 h-4" />,
    quickLinks: [{ label: 'View Reports', href: '/dashboard/reports' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Analyze your spending with various reports and visualizations.
        </p>
        <HelpSubsection title="Report Types">
          {[
            { k: 'Spending by Category', v: 'See where your money goes' },
            { k: 'Income vs Expenses', v: 'Track cash flow over time' },
            { k: 'Spending Trends', v: 'Month-over-month comparisons' },
            { k: 'Merchant Analysis', v: 'Top merchants by spending' },
            { k: 'Net Worth', v: 'Assets minus liabilities' },
          ].map(({ k, v }) => <HelpListItem key={k} label={k}>{v}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Chart Types">
          {['Pie, bar, and line charts', 'Area charts for trends', 'Heatmaps (experimental)', 'Treemaps (experimental)'].map(t => (
            <HelpListItem key={t}>{t}</HelpListItem>
          ))}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.HOUSEHOLDS,
    title: 'Households',
    icon: <Users className="w-4 h-4" />,
    quickLinks: [{ label: 'Household Settings', href: '/dashboard/settings' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Households let you collaborate on finances with family members or roommates.
        </p>
        <HelpSubsection title="How Households Work">
          {[
            'Each household has its own accounts, transactions, and budgets',
            'Members can be owners, admins, or viewers',
            'Switch between households using the dropdown in the sidebar',
            'Data is completely isolated between households',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Member Roles">
          {[
            { k: 'Owner', v: 'Full access, can delete household' },
            { k: 'Admin', v: 'Can manage members and settings' },
            { k: 'Member', v: 'Can add and edit transactions' },
            { k: 'Viewer', v: 'Read-only access' },
          ].map(({ k, v }) => <HelpListItem key={k} label={k}>{v}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.NOTIFICATIONS,
    title: 'Notifications',
    icon: <Bell className="w-4 h-4" />,
    quickLinks: [{ label: 'Notification Settings', href: '/dashboard/settings' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Stay informed about your finances with customizable notifications.
        </p>
        <HelpSubsection title="Notification Types">
          {[
            { k: 'Bill Reminders', v: 'Upcoming bill due dates' },
            { k: 'Budget Warnings', v: 'Approaching budget limits' },
            { k: 'Budget Exceeded', v: 'Over-budget alerts' },
            { k: 'Low Balance', v: 'Account balance below threshold' },
            { k: 'Savings Milestones', v: 'Goal progress celebrations' },
            { k: 'Weekly/Monthly Summaries', v: 'Financial reports' },
          ].map(({ k, v }) => <HelpListItem key={k} label={k}>{v}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Delivery Channels">
          {[
            { k: 'In-app', v: 'Bell icon in navigation' },
            { k: 'Email', v: 'Delivered to your email address' },
            { k: 'Push', v: 'Browser notifications (if enabled)' },
          ].map(({ k, v }) => <HelpListItem key={k} label={k}>{v}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.IMPORT_EXPORT,
    title: 'Import & Export',
    icon: <Upload className="w-4 h-4" />,
    quickLinks: [
      { label: 'Import Transactions', href: '/dashboard/transactions' },
      { label: 'Data Settings', href: '/dashboard/settings' },
    ],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Import transactions from your bank and export your data for backup or analysis.
        </p>
        <HelpSubsection title="CSV Import">
          {[
            'Download CSV from your bank\'s website',
            'Map columns to transaction fields',
            'Save templates for repeat imports',
            'Duplicate detection prevents double-entry',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
        <HelpCallout variant="info" title="Import Tips">
          {['Review the preview before importing', 'Set up rules to auto-categorize imported transactions', 'Use merchant mapping to clean up names'].map(t => (
            <HelpListItem key={t}>{t}</HelpListItem>
          ))}
        </HelpCallout>
        <HelpSubsection title="Data Export">
          {[
            'Export to JSON for complete backup',
            'Export to CSV for spreadsheet analysis',
            'Available in Settings → Data Management',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.OFFLINE_MODE,
    title: 'Offline Mode',
    icon: <WifiOff className="w-4 h-4" />,
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          The app works even without an internet connection.
        </p>
        <HelpSubsection title="How It Works">
          {[
            'Transactions are saved locally when offline',
            'A queue icon shows pending sync items',
            'Data automatically syncs when back online',
            'Recent data is cached for offline viewing',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Limitations">
          {[
            'Some features require an internet connection',
            'Reports may show stale data until synced',
            'Conflicts are resolved server-side',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.TAX,
    title: 'Tax Tracking',
    icon: <FileSpreadsheet className="w-4 h-4" />,
    quickLinks: [{ label: 'Tax Dashboard', href: '/dashboard/tax' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Track tax-deductible expenses throughout the year for easier tax filing.
        </p>
        <HelpSubsection title="Getting Started">
          {[
            'Enable tax tracking on accounts used for deductible expenses',
            'Map categories to tax categories (Schedule C, etc.)',
            'Mark individual transactions as tax-deductible',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Features">
          {[
            'Tax category summaries by year',
            'Export data for tax software',
            'Rules to auto-classify tax transactions',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.SALES_TAX,
    title: 'Sales Tax',
    icon: <DollarSign className="w-4 h-4" />,
    quickLinks: [{ label: 'Sales Tax', href: '/dashboard/sales-tax' }],
    content: (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          Track and report sales tax collected for business accounts.
        </p>
        <HelpSubsection title="Getting Started">
          {[
            'Enable sales tax tracking on business accounts',
            'Set your state for correct tax rates',
            'Track sales tax on income transactions',
          ].map(t => <HelpListItem key={t}>{t}</HelpListItem>)}
        </HelpSubsection>
        <HelpSubsection title="Quarterly Reporting">
          {['View quarterly tax totals', 'Export for state filing', 'Track filing status'].map(t => (
            <HelpListItem key={t}>{t}</HelpListItem>
          ))}
        </HelpSubsection>
      </div>
    ),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────
function HelpSubsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function HelpListItem({
  label,
  labelColor,
  children,
}: {
  label?: string;
  labelColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <div
        className="w-1 h-1 rounded-full shrink-0 mt-2"
        style={{ backgroundColor: 'var(--color-muted-foreground)', opacity: 0.5 }}
      />
      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
        {label && (
          <strong style={{ color: labelColor || 'var(--color-foreground)', fontWeight: 600 }}>
            {label}
            {' — '}
          </strong>
        )}
        {children}
      </p>
    </div>
  );
}

function HelpCallout({
  variant,
  title,
  children,
}: {
  variant: 'warning' | 'info';
  title: string;
  children: React.ReactNode;
}) {
  const color = variant === 'warning' ? 'var(--color-warning)' : 'var(--color-primary)';
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 8%, transparent)`,
        border: `1px solid color-mix(in oklch, ${color} 25%, var(--color-border))`,
      }}
    >
      <p className="text-[11px] font-semibold mb-2" style={{ color }}>
        {title}
      </p>
      <div>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function HelpPage() {
  const searchParams = useSearchParams();
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [HELP_SECTIONS.GETTING_STARTED];
    const hash = window.location.hash.replace('#', '');
    if (!hash) return [HELP_SECTIONS.GETTING_STARTED];
    return Array.from(new Set([HELP_SECTIONS.GETTING_STARTED, hash]));
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string>(HELP_SECTIONS.GETTING_STARTED);
  const mainRef = useRef<HTMLDivElement>(null);

  // Handle anchor links on page load
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [searchParams]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId) ? prev.filter(id => id !== sectionId) : [...prev, sectionId],
    );
    setActiveSection(sectionId);
    // Scroll to section
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const expandAndScrollTo = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId) ? prev : [...prev, sectionId],
    );
    setActiveSection(sectionId);
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const filteredSections = helpSections.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  const totalSections = helpSections.length;
  const sectionIndex = (id: string) => helpSections.findIndex(s => s.id === id) + 1;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <Link href="/dashboard">
              <button className="h-8 w-8 rounded-full flex items-center justify-center transition-colors" style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>

            <h1 className="text-lg font-semibold tracking-tight shrink-0" style={{ color: 'var(--color-foreground)' }}>
              Help
            </h1>

            <div className="flex-1 relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--color-muted-foreground)' }} />
              <input
                type="text"
                placeholder="Search topics…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg text-[12px] outline-none transition-colors"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-elevated)',
                  color: 'var(--color-foreground)',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <span className="text-[11px] shrink-0 hidden sm:block" style={{ color: 'var(--color-muted-foreground)' }}>
              {totalSections} topics
            </span>
          </div>
        </div>
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 35%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-6 items-start">

          {/* ── Left sidebar (sticky navigation) ─────────────────────────── */}
          <aside className="hidden lg:block w-48 shrink-0 sticky top-[57px] max-h-[calc(100vh-80px)] overflow-y-auto">
            <nav className="space-y-5 pr-2">
              {GROUPS.map(group => {
                const sections = helpSections.filter(s =>
                  (group.ids as readonly string[]).includes(s.id) &&
                  (!searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.includes(searchQuery.toLowerCase()))
                );
                if (sections.length === 0) return null;
                return (
                  <div key={group.label}>
                    <p
                      className="text-[9px] font-bold uppercase tracking-widest mb-2 px-2"
                      style={{ color: group.color, opacity: 0.8 }}
                    >
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {sections.map(s => (
                        <button
                          key={s.id}
                          onClick={() => expandAndScrollTo(s.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors text-[12px]"
                          style={{
                            backgroundColor: activeSection === s.id
                              ? `color-mix(in oklch, ${group.color} 10%, transparent)`
                              : 'transparent',
                            color: activeSection === s.id ? group.color : 'var(--color-muted-foreground)',
                            fontWeight: activeSection === s.id ? 600 : 400,
                          }}
                          onMouseEnter={e => {
                            if (activeSection !== s.id)
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 80%, transparent)';
                          }}
                          onMouseLeave={e => {
                            if (activeSection !== s.id)
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                          }}
                        >
                          <span style={{ color: activeSection === s.id ? group.color : 'var(--color-muted-foreground)', opacity: activeSection === s.id ? 1 : 0.6 }}>
                            {s.icon}
                          </span>
                          <span className="truncate">{s.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>
          </aside>

          {/* ── Main content ──────────────────────────────────────────────── */}
          <main ref={mainRef} className="flex-1 min-w-0 space-y-3">
            {filteredSections.length === 0 && (
              <div className="py-16 text-center rounded-xl" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
                <Search className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-muted-foreground)', opacity: 0.5 }} />
                <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No results for &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>Try a different search term.</p>
              </div>
            )}

            {filteredSections.map(section => {
              const isExpanded = expandedSections.includes(section.id);
              const color = getGroupColor(section.id);
              const idx = sectionIndex(section.id);

              return (
                <div
                  key={section.id}
                  id={section.id}
                  className="rounded-xl overflow-hidden scroll-mt-16 transition-shadow duration-200"
                  style={{
                    border: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${isExpanded ? color : 'var(--color-border)'}`,
                    backgroundColor: 'var(--color-background)',
                    boxShadow: isExpanded ? `0 4px 20px color-mix(in oklch, ${color} 10%, transparent)` : 'none',
                  }}
                >
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 50%, transparent)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                  >
                    {/* Section number */}
                    <span
                      className="text-[11px] font-mono font-semibold w-6 text-right shrink-0 select-none"
                      style={{ color: 'var(--color-muted-foreground)', opacity: 0.35 }}
                    >
                      {String(idx).padStart(2, '0')}
                    </span>

                    {/* Icon */}
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`, color }}
                    >
                      {section.icon}
                    </span>

                    {/* Title */}
                    <span className="flex-1 text-[13px] font-semibold" style={{ color: 'var(--color-foreground)' }}>
                      {section.title}
                    </span>

                    {/* Quick link count badge */}
                    {section.quickLinks && section.quickLinks.length > 0 && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                        style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)' }}
                      >
                        {section.quickLinks.length} link{section.quickLinks.length !== 1 ? 's' : ''}
                      </span>
                    )}

                    {/* Chevron */}
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
                      : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}>
                      <div className="px-12 py-4">
                        {section.content}
                      </div>

                      {/* Quick links footer */}
                      {section.quickLinks && section.quickLinks.length > 0 && (
                        <div
                          className="px-4 py-3 flex items-center gap-2 flex-wrap"
                          style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 40%, transparent)' }}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-widest mr-1 shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
                            Go to
                          </span>
                          {section.quickLinks.map(link => (
                            <Link key={link.href} href={link.href}>
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                                style={{
                                  border: '1px solid var(--color-border)',
                                  backgroundColor: 'var(--color-background)',
                                  color: color,
                                }}
                              >
                                {link.label}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Footer */}
            <div className="pt-6 pb-2 text-center">
              <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
                Can&apos;t find what you&apos;re looking for?{' '}
                <Link href="/dashboard/settings" className="underline" style={{ color: 'var(--color-primary)' }}>
                  Contact support
                </Link>
                {' '}or check{' '}
                <Link href="/dashboard/settings" className="underline" style={{ color: 'var(--color-primary)' }}>
                  Settings
                </Link>
                .
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
