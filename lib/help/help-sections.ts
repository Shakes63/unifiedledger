/**
 * Help section IDs and utilities for deep linking to help content
 */

export const HELP_SECTIONS = {
  // Getting Started
  GETTING_STARTED: 'getting-started',
  ACCOUNTS: 'accounts',
  CATEGORIES: 'categories',
  MERCHANTS: 'merchants',

  // Core Features
  TRANSACTIONS: 'transactions',
  BUDGETS: 'budgets',
  BILLS: 'bills',
  TRANSFERS: 'transfers',

  // Advanced
  RULES: 'rules',
  GOALS: 'goals',
  DEBTS: 'debts',
  REPORTS: 'reports',

  // Settings & Configuration
  HOUSEHOLDS: 'households',
  NOTIFICATIONS: 'notifications',
  IMPORT_EXPORT: 'import-export',
  OFFLINE_MODE: 'offline-mode',
  TAX: 'tax',
  SALES_TAX: 'sales-tax',
} as const;

export type HelpSection = (typeof HELP_SECTIONS)[keyof typeof HELP_SECTIONS];

/**
 * Get the URL to a specific help section
 */
export function getHelpUrl(section: HelpSection | string): string {
  return `/dashboard/help#${section}`;
}

/**
 * Help section metadata for navigation and display
 */
export interface HelpSectionMeta {
  id: HelpSection;
  title: string;
  description: string;
  icon?: string;
}

export const HELP_SECTION_META: Record<HelpSection, HelpSectionMeta> = {
  [HELP_SECTIONS.GETTING_STARTED]: {
    id: HELP_SECTIONS.GETTING_STARTED,
    title: 'Getting Started',
    description: 'Learn how to set up and start using Unified Ledger',
  },
  [HELP_SECTIONS.ACCOUNTS]: {
    id: HELP_SECTIONS.ACCOUNTS,
    title: 'Accounts',
    description: 'Create and manage your bank accounts, credit cards, and cash',
  },
  [HELP_SECTIONS.CATEGORIES]: {
    id: HELP_SECTIONS.CATEGORIES,
    title: 'Categories',
    description: 'Organize your transactions with income and expense categories',
  },
  [HELP_SECTIONS.MERCHANTS]: {
    id: HELP_SECTIONS.MERCHANTS,
    title: 'Merchants',
    description: 'Track where you spend money and auto-categorize transactions',
  },
  [HELP_SECTIONS.TRANSACTIONS]: {
    id: HELP_SECTIONS.TRANSACTIONS,
    title: 'Transactions',
    description: 'Record income, expenses, and transfers between accounts',
  },
  [HELP_SECTIONS.BUDGETS]: {
    id: HELP_SECTIONS.BUDGETS,
    title: 'Budgets',
    description: 'Set spending limits and track your budget progress',
  },
  [HELP_SECTIONS.BILLS]: {
    id: HELP_SECTIONS.BILLS,
    title: 'Bills',
    description: 'Track recurring bills and never miss a payment',
  },
  [HELP_SECTIONS.TRANSFERS]: {
    id: HELP_SECTIONS.TRANSFERS,
    title: 'Transfers',
    description: 'Move money between your accounts',
  },
  [HELP_SECTIONS.RULES]: {
    id: HELP_SECTIONS.RULES,
    title: 'Rules',
    description: 'Automatically categorize transactions with custom rules',
  },
  [HELP_SECTIONS.GOALS]: {
    id: HELP_SECTIONS.GOALS,
    title: 'Savings Goals',
    description: 'Set and track progress toward your savings goals',
  },
  [HELP_SECTIONS.DEBTS]: {
    id: HELP_SECTIONS.DEBTS,
    title: 'Debts',
    description: 'Track debt payoff and see your progress',
  },
  [HELP_SECTIONS.REPORTS]: {
    id: HELP_SECTIONS.REPORTS,
    title: 'Reports',
    description: 'Analyze your spending with charts and reports',
  },
  [HELP_SECTIONS.HOUSEHOLDS]: {
    id: HELP_SECTIONS.HOUSEHOLDS,
    title: 'Households',
    description: 'Collaborate on finances with family members',
  },
  [HELP_SECTIONS.NOTIFICATIONS]: {
    id: HELP_SECTIONS.NOTIFICATIONS,
    title: 'Notifications',
    description: 'Stay informed about bills, budgets, and more',
  },
  [HELP_SECTIONS.IMPORT_EXPORT]: {
    id: HELP_SECTIONS.IMPORT_EXPORT,
    title: 'Import & Export',
    description: 'Import transactions from CSV and export your data',
  },
  [HELP_SECTIONS.OFFLINE_MODE]: {
    id: HELP_SECTIONS.OFFLINE_MODE,
    title: 'Offline Mode',
    description: 'Use the app without an internet connection',
  },
  [HELP_SECTIONS.TAX]: {
    id: HELP_SECTIONS.TAX,
    title: 'Tax Tracking',
    description: 'Track tax-deductible expenses for tax time',
  },
  [HELP_SECTIONS.SALES_TAX]: {
    id: HELP_SECTIONS.SALES_TAX,
    title: 'Sales Tax',
    description: 'Track and report sales tax for business accounts',
  },
};






