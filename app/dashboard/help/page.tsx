'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
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

const helpSections: HelpSectionData[] = [
  {
    id: HELP_SECTIONS.GETTING_STARTED,
    title: 'Getting Started',
    icon: <Lightbulb className="w-5 h-5" />,
    quickLinks: [
      { label: 'Create Account', href: '/dashboard/accounts' },
      { label: 'Add Categories', href: '/dashboard/categories' },
      { label: 'Settings', href: '/dashboard/settings' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Welcome to Unified Ledger! Here&apos;s how to get started with tracking your finances:
        </p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-sm font-medium shrink-0">1</span>
            <div>
              <p className="font-medium text-foreground">Create your accounts</p>
              <p className="text-sm text-muted-foreground">Add your bank accounts, credit cards, and cash accounts to track balances.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-sm font-medium shrink-0">2</span>
            <div>
              <p className="font-medium text-foreground">Set up categories</p>
              <p className="text-sm text-muted-foreground">Create income and expense categories to organize your transactions. Set budget amounts for expense categories.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-sm font-medium shrink-0">3</span>
            <div>
              <p className="font-medium text-foreground">Add your first transaction</p>
              <p className="text-sm text-muted-foreground">Record an income or expense to start building your financial history.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-sm font-medium shrink-0">4</span>
            <div>
              <p className="font-medium text-foreground">Set up budgets</p>
              <p className="text-sm text-muted-foreground">Use budget templates or create custom budgets to track spending limits.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.ACCOUNTS,
    title: 'Accounts',
    icon: <Wallet className="w-5 h-5" />,
    quickLinks: [
      { label: 'Manage Accounts', href: '/dashboard/accounts' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Accounts represent your financial accounts like bank accounts, credit cards, and cash.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Account Types</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground">Checking</strong> - Your primary bank account for daily transactions</li>
            <li><strong className="text-foreground">Savings</strong> - Savings accounts for emergency funds or goals</li>
            <li><strong className="text-foreground">Credit Card</strong> - Track credit card spending and balances</li>
            <li><strong className="text-foreground">Cash</strong> - Track physical cash spending</li>
            <li><strong className="text-foreground">Investment</strong> - Track investment account balances</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Tips</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Set your starting balance when creating an account</li>
            <li>Mark accounts as &quot;default&quot; for quick transaction entry</li>
            <li>Credit cards can track credit limits and utilization</li>
            <li>Archive accounts you no longer use instead of deleting them</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.CATEGORIES,
    title: 'Categories',
    icon: <Tags className="w-5 h-5" />,
    quickLinks: [
      { label: 'Manage Categories', href: '/dashboard/categories' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Categories help you organize and track where your money comes from and where it goes.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Category Types</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground text-income">Income</strong> - Money coming in (salary, freelance, investments)</li>
            <li><strong className="text-foreground text-expense">Expense</strong> - Money going out (rent, groceries, entertainment)</li>
            <li><strong className="text-foreground text-transfer">Savings</strong> - Money set aside for future use</li>
          </ul>
        </div>
        <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
          <h4 className="font-medium text-warning mb-2">Setting Up Categories for Budgets</h4>
          <p className="text-sm text-muted-foreground">
            To use budget templates, you need <strong>expense categories with budget amounts set</strong>. 
            When creating or editing a category:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground mt-2 ml-2">
            <li>Set the category type to &quot;Expense&quot;</li>
            <li>Enter a &quot;Monthly Budget&quot; amount (e.g., $500 for Groceries)</li>
            <li>Optionally set an income frequency for income categories</li>
          </ol>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Tips</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Start with broad categories, then add specific ones as needed</li>
            <li>Categories are shared within your household</li>
            <li>You can set income frequency (weekly, biweekly, monthly) for income tracking</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.MERCHANTS,
    title: 'Merchants',
    icon: <Store className="w-5 h-5" />,
    quickLinks: [
      { label: 'Manage Merchants', href: '/dashboard/merchants' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Merchants represent the places where you spend money. They help with auto-categorization and spending analysis.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">How Merchants Work</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Merchants are auto-created when you add transactions</li>
            <li>You can assign a default category to a merchant</li>
            <li>New transactions with that merchant will auto-categorize</li>
            <li>View spending history per merchant in reports</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Tips</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Clean up merchant names for better organization</li>
            <li>Merge duplicate merchants from CSV imports</li>
            <li>Set default categories to save time on future transactions</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.TRANSACTIONS,
    title: 'Transactions',
    icon: <Receipt className="w-5 h-5" />,
    quickLinks: [
      { label: 'View Transactions', href: '/dashboard/transactions' },
      { label: 'Add Transaction', href: '/dashboard/transactions/new' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Transactions are the core of your financial tracking. Every income, expense, and transfer is recorded as a transaction.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Transaction Types</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground text-income">Income</strong> - Money received (salary, refunds, gifts)</li>
            <li><strong className="text-foreground text-expense">Expense</strong> - Money spent (purchases, bills, subscriptions)</li>
            <li><strong className="text-foreground text-transfer">Transfer</strong> - Money moved between your accounts</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Features</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong>Split transactions</strong> - Divide one purchase across multiple categories</li>
            <li><strong>Templates</strong> - Save frequently used transactions for quick entry</li>
            <li><strong>Duplicate detection</strong> - Warns you about similar recent transactions</li>
            <li><strong>Tags</strong> - Add custom tags for flexible organization</li>
            <li><strong>Notes</strong> - Add details or receipts to any transaction</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Tips</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Use the search bar to find transactions by description, merchant, or category</li>
            <li>Filter by date range, account, or category</li>
            <li>Click a transaction to view or edit details</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.BUDGETS,
    title: 'Budgets',
    icon: <Calculator className="w-5 h-5" />,
    quickLinks: [
      { label: 'View Budgets', href: '/dashboard/budgets' },
      { label: 'Budget Summary', href: '/dashboard/budget-summary' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Budgets help you plan and track spending limits for each category.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Budget Templates</h4>
          <p className="text-sm text-muted-foreground">
            Use templates to quickly set up budgets based on your income:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground">50/30/20</strong> - 50% needs, 30% wants, 20% savings</li>
            <li><strong className="text-foreground">Zero-Based</strong> - Assign every dollar to a category</li>
            <li><strong className="text-foreground">Envelope</strong> - Fixed amounts for each spending category</li>
          </ul>
        </div>
        <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
          <h4 className="font-medium text-warning mb-2">No Budget Suggestions?</h4>
          <p className="text-sm text-muted-foreground">
            If budget templates aren&apos;t generating suggestions, make sure you have:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground mt-2 ml-2">
            <li>Created expense categories in <Link href="/dashboard/categories" className="text-accent hover:underline">Categories</Link></li>
            <li>Set monthly budget amounts for those categories</li>
            <li>The template will distribute your income across these categories</li>
          </ol>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Features</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong>Rollover</strong> - Unused budget can roll to next month</li>
            <li><strong>Analytics</strong> - See spending trends and patterns</li>
            <li><strong>Warnings</strong> - Get notified when approaching limits</li>
            <li><strong>Variable bills</strong> - Track bills that change each month</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.BILLS,
    title: 'Bills',
    icon: <FileText className="w-5 h-5" />,
    quickLinks: [
      { label: 'View Bills', href: '/dashboard/bills' },
      { label: 'Annual Planning', href: '/dashboard/bills/annual-planning' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Track recurring bills and never miss a payment with automatic reminders.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Bill Frequencies</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground">One-time</strong> - Single payment on a specific date</li>
            <li><strong className="text-foreground">Weekly/Biweekly</strong> - Repeats on the same day of week</li>
            <li><strong className="text-foreground">Monthly</strong> - Due on the same day each month</li>
            <li><strong className="text-foreground">Quarterly</strong> - Every 3 months</li>
            <li><strong className="text-foreground">Semi-annual</strong> - Every 6 months</li>
            <li><strong className="text-foreground">Annual</strong> - Once per year</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Auto-Detection</h4>
          <p className="text-sm text-muted-foreground">
            When you record an expense, the app automatically checks if it matches a bill:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Matches by description, amount (within 5%), and date pattern</li>
            <li>High-confidence matches are auto-linked</li>
            <li>Lower confidence matches are suggested for review</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Tips</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Set up autopay tracking for bills paid automatically</li>
            <li>Use Annual Planning view to see your full year of bills</li>
            <li>Variable bills track changing amounts (like utilities)</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.TRANSFERS,
    title: 'Transfers',
    icon: <ArrowLeftRight className="w-5 h-5" />,
    quickLinks: [
      { label: 'View Transfers', href: '/dashboard/transfers' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Transfers move money between your own accounts without affecting your net worth.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">How Transfers Work</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Select a source account (money leaves)</li>
            <li>Select a destination account (money arrives)</li>
            <li>The app creates linked transactions in both accounts</li>
            <li>Your total balance stays the same</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Common Uses</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Moving money to savings</li>
            <li>Paying credit card bills from checking</li>
            <li>Transferring between bank accounts</li>
            <li>Moving cash to/from physical wallet</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.RULES,
    title: 'Rules',
    icon: <Workflow className="w-5 h-5" />,
    quickLinks: [
      { label: 'Manage Rules', href: '/dashboard/rules' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Rules automatically categorize and process your transactions based on conditions you define.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Rule Conditions</h4>
          <p className="text-sm text-muted-foreground">Match transactions by:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground">Description</strong> - contains, starts with, equals, regex</li>
            <li><strong className="text-foreground">Amount</strong> - equals, greater than, less than, between</li>
            <li><strong className="text-foreground">Account</strong> - matches specific account</li>
            <li><strong className="text-foreground">Date</strong> - day of month, weekday, month</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Rule Actions</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground">Set category</strong> - Assign a category</li>
            <li><strong className="text-foreground">Set merchant</strong> - Assign a merchant</li>
            <li><strong className="text-foreground">Modify description</strong> - Clean up or standardize text</li>
            <li><strong className="text-foreground">Set tax status</strong> - Mark as tax deductible</li>
            <li><strong className="text-foreground">Convert to transfer</strong> - Auto-detect transfers</li>
            <li><strong className="text-foreground">Create splits</strong> - Auto-split transactions</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Tips</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Rules are processed in priority order (lower number = higher priority)</li>
            <li>Only the first matching rule applies</li>
            <li>Test rules before applying to all transactions</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.GOALS,
    title: 'Savings Goals',
    icon: <Target className="w-5 h-5" />,
    quickLinks: [
      { label: 'View Goals', href: '/dashboard/goals' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Set savings goals and track your progress toward them.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Creating a Goal</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Give your goal a name (e.g., &quot;Vacation Fund&quot;)</li>
            <li>Set your target amount</li>
            <li>Optionally set a target date</li>
            <li>Add milestones for motivation</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Tracking Progress</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Add contributions as you save</li>
            <li>See recommended monthly savings to hit your target</li>
            <li>Celebrate milestones as you reach them</li>
            <li>View progress chart over time</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.DEBTS,
    title: 'Debts',
    icon: <CreditCard className="w-5 h-5" />,
    quickLinks: [
      { label: 'View Debts', href: '/dashboard/debts' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Track your debts and see projected payoff dates.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Debt Types</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Credit cards</li>
            <li>Student loans</li>
            <li>Auto loans</li>
            <li>Mortgages</li>
            <li>Personal loans</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Features</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground">Payoff projections</strong> - See when you&apos;ll be debt-free</li>
            <li><strong className="text-foreground">What-if calculator</strong> - Model extra payments</li>
            <li><strong className="text-foreground">Interest tracking</strong> - See total interest paid</li>
            <li><strong className="text-foreground">Milestones</strong> - Celebrate as you pay down debt</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.REPORTS,
    title: 'Reports',
    icon: <BarChart2 className="w-5 h-5" />,
    quickLinks: [
      { label: 'View Reports', href: '/dashboard/reports' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Analyze your spending with various reports and visualizations.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Report Types</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground">Spending by Category</strong> - See where your money goes</li>
            <li><strong className="text-foreground">Income vs Expenses</strong> - Track cash flow over time</li>
            <li><strong className="text-foreground">Spending Trends</strong> - Month-over-month comparisons</li>
            <li><strong className="text-foreground">Merchant Analysis</strong> - Top merchants by spending</li>
            <li><strong className="text-foreground">Account Balances</strong> - Track balance changes</li>
            <li><strong className="text-foreground">Net Worth</strong> - Assets minus liabilities</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Chart Types</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Pie charts, bar charts, line charts</li>
            <li>Area charts for trends</li>
            <li>Heatmaps (experimental)</li>
            <li>Treemaps (experimental)</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.HOUSEHOLDS,
    title: 'Households',
    icon: <Users className="w-5 h-5" />,
    quickLinks: [
      { label: 'Household Settings', href: '/dashboard/settings' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Households let you collaborate on finances with family members or roommates.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">How Households Work</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Each household has its own accounts, transactions, and budgets</li>
            <li>Members can be owners, admins, or viewers</li>
            <li>Switch between households using the dropdown in the sidebar</li>
            <li>Data is completely isolated between households</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Member Roles</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground">Owner</strong> - Full access, can delete household</li>
            <li><strong className="text-foreground">Admin</strong> - Can manage members and settings</li>
            <li><strong className="text-foreground">Member</strong> - Can add and edit transactions</li>
            <li><strong className="text-foreground">Viewer</strong> - Read-only access</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.NOTIFICATIONS,
    title: 'Notifications',
    icon: <Bell className="w-5 h-5" />,
    quickLinks: [
      { label: 'Notification Settings', href: '/dashboard/settings' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Stay informed about your finances with customizable notifications.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Notification Types</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground">Bill Reminders</strong> - Upcoming bill due dates</li>
            <li><strong className="text-foreground">Budget Warnings</strong> - Approaching budget limits</li>
            <li><strong className="text-foreground">Budget Exceeded</strong> - Over-budget alerts</li>
            <li><strong className="text-foreground">Low Balance</strong> - Account balance below threshold</li>
            <li><strong className="text-foreground">Savings Milestones</strong> - Goal progress celebrations</li>
            <li><strong className="text-foreground">Weekly/Monthly Summaries</strong> - Financial reports</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Delivery Channels</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li><strong className="text-foreground">In-app</strong> - Bell icon in navigation</li>
            <li><strong className="text-foreground">Email</strong> - Delivered to your email address</li>
            <li><strong className="text-foreground">Push</strong> - Browser notifications (if enabled)</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.IMPORT_EXPORT,
    title: 'Import & Export',
    icon: <Upload className="w-5 h-5" />,
    quickLinks: [
      { label: 'Import Transactions', href: '/dashboard/transactions' },
      { label: 'Data Settings', href: '/dashboard/settings' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Import transactions from your bank and export your data for backup or analysis.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">CSV Import</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Download CSV from your bank&apos;s website</li>
            <li>Map columns to transaction fields</li>
            <li>Save templates for repeat imports</li>
            <li>Duplicate detection prevents double-entry</li>
          </ul>
        </div>
        <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
          <h4 className="font-medium text-info mb-2">Import Tips</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Review the preview before importing</li>
            <li>Set up rules to auto-categorize imported transactions</li>
            <li>Use merchant mapping to clean up names</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Data Export</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Export to JSON for complete backup</li>
            <li>Export to CSV for spreadsheet analysis</li>
            <li>Available in Settings &gt; Data Management</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.OFFLINE_MODE,
    title: 'Offline Mode',
    icon: <WifiOff className="w-5 h-5" />,
    content: (
      <div className="space-y-4">
        <p>
          The app works even without an internet connection.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">How It Works</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Transactions are saved locally when offline</li>
            <li>A queue icon shows pending sync items</li>
            <li>Data automatically syncs when back online</li>
            <li>Recent data is cached for offline viewing</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Limitations</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Some features require an internet connection</li>
            <li>Reports may show stale data until synced</li>
            <li>Conflicts are resolved server-side</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.TAX,
    title: 'Tax Tracking',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    quickLinks: [
      { label: 'Tax Dashboard', href: '/dashboard/tax' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Track tax-deductible expenses throughout the year for easier tax filing.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Getting Started</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Enable tax tracking on accounts used for deductible expenses</li>
            <li>Map categories to tax categories (Schedule C, etc.)</li>
            <li>Mark individual transactions as tax-deductible</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Features</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Tax category summaries by year</li>
            <li>Export data for tax software</li>
            <li>Rules to auto-classify tax transactions</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: HELP_SECTIONS.SALES_TAX,
    title: 'Sales Tax',
    icon: <DollarSign className="w-5 h-5" />,
    quickLinks: [
      { label: 'Sales Tax', href: '/dashboard/sales-tax' },
    ],
    content: (
      <div className="space-y-4">
        <p>
          Track and report sales tax collected for business accounts.
        </p>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Getting Started</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>Enable sales tax tracking on business accounts</li>
            <li>Set your state for correct tax rates</li>
            <li>Track sales tax on income transactions</li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Quarterly Reporting</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>View quarterly tax totals</li>
            <li>Export for state filing</li>
            <li>Track filing status</li>
          </ul>
        </div>
      </div>
    ),
  },
];

export default function HelpPage() {
  const searchParams = useSearchParams();
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [HELP_SECTIONS.GETTING_STARTED];
    const hash = window.location.hash.replace('#', '');
    if (!hash) return [HELP_SECTIONS.GETTING_STARTED];
    return Array.from(new Set([HELP_SECTIONS.GETTING_STARTED, hash]));
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Handle anchor links on page load
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      // Scroll to section after a short delay for rendering
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [searchParams]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // Filter sections based on search
  const filteredSections = helpSections.filter((section) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(query) ||
      section.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Help & Documentation</h1>
        <p className="text-muted-foreground">
          Learn how to use Unified Ledger to manage your finances effectively.
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Quick Links */}
      <Card className="p-4 mb-6 bg-card border-border">
        <h2 className="font-medium text-foreground mb-3">Quick Links</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/transactions/new">
            <Button variant="outline" size="sm" className="gap-2">
              <Receipt className="w-4 h-4" />
              Add Transaction
            </Button>
          </Link>
          <Link href="/dashboard/accounts">
            <Button variant="outline" size="sm" className="gap-2">
              <Wallet className="w-4 h-4" />
              Manage Accounts
            </Button>
          </Link>
          <Link href="/dashboard/categories">
            <Button variant="outline" size="sm" className="gap-2">
              <Tags className="w-4 h-4" />
              Manage Categories
            </Button>
          </Link>
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Settings
            </Button>
          </Link>
        </div>
      </Card>

      {/* Help Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => {
          const isExpanded = expandedSections.includes(section.id);
          return (
            <Card
              key={section.id}
              id={section.id}
              className="bg-card border-border overflow-hidden scroll-mt-6"
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-elevated/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-accent">{section.icon}</span>
                  <span className="font-medium text-foreground">{section.title}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border pt-4">
                  <div className="text-muted-foreground">{section.content}</div>
                  {section.quickLinks && section.quickLinks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex flex-wrap gap-2">
                        {section.quickLinks.map((link) => (
                          <Link key={link.href} href={link.href}>
                            <Button variant="outline" size="sm" className="gap-1">
                              {link.label}
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Can&apos;t find what you&apos;re looking for?{' '}
          <Link href="/dashboard/settings" className="text-accent hover:underline">
            Contact support
          </Link>{' '}
          or check the{' '}
          <Link href="/dashboard/settings" className="text-accent hover:underline">
            Settings
          </Link>{' '}
          page for more options.
        </p>
      </div>
    </div>
  );
}




