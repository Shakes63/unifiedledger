'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Wallet,
  CreditCard,
  BarChart2,
  Calendar,
  Receipt,
  Target,
  Workflow,
  Menu,
  X,
  ChevronDown,
  FileText,
  Store,
  Calculator,
  Settings,
  LayoutDashboard,
  LayoutGrid,
  Tags,
  HelpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  Bell,
} from 'lucide-react';
import Image from 'next/image';
import { HouseholdSelector } from '@/components/household/household-selector';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/auth/user-menu';
import { TestModeBadge } from '@/components/dev/test-mode-badge';
import { useBusinessFeatures } from '@/contexts/business-features-context';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Money',
    items: [
      { label: 'Transactions', href: '/dashboard/transactions', icon: <Receipt className="w-4 h-4" /> },
      { label: 'Transfers', href: '/dashboard/transfers', icon: <ArrowLeftRight className="w-4 h-4" /> },
      { label: 'Accounts', href: '/dashboard/accounts', icon: <Wallet className="w-4 h-4" /> },
      { label: 'Calendar', href: '/dashboard/calendar', icon: <Calendar className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Planning',
    items: [
      { label: 'Budget Planner', href: '/dashboard/budgets', icon: <Calculator className="w-4 h-4" /> },
      { label: 'Budget Insights', href: '/dashboard/budget-summary', icon: <LayoutGrid className="w-4 h-4" /> },
      { label: 'Bills', href: '/dashboard/bills', icon: <FileText className="w-4 h-4" /> },
      { label: 'Income', href: '/dashboard/income', icon: <ArrowDownCircle className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Goals',
    items: [
      { label: 'Savings Goals', href: '/dashboard/goals', icon: <Target className="w-4 h-4" /> },
      { label: 'Debt Payoff', href: '/dashboard/debts', icon: <CreditCard className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Reports', href: '/dashboard/reports', icon: <BarChart2 className="w-4 h-4" /> },
      { label: 'Tax', href: '/dashboard/tax', icon: <FileText className="w-4 h-4" /> },
      { label: 'Sales Tax', href: '/dashboard/sales-tax', icon: <Receipt className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Setup',
    items: [
      { label: 'Categories', href: '/dashboard/categories', icon: <Tags className="w-4 h-4" /> },
      { label: 'Merchants', href: '/dashboard/merchants', icon: <Store className="w-4 h-4" /> },
      { label: 'Rules & Automation', href: '/dashboard/rules', icon: <Workflow className="w-4 h-4" /> },
      { label: 'Notifications', href: '/dashboard/notifications', icon: <Bell className="w-4 h-4" /> },
      { label: 'Settings', href: '/dashboard/settings', icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

const dashboardNavItem: NavItem = {
  label: 'Dashboard',
  href: '/dashboard',
  icon: <LayoutDashboard className="w-4 h-4" />,
};

const helpNavItem: NavItem = {
  label: 'Help Center',
  href: '/dashboard/help',
  icon: <HelpCircle className="w-4 h-4" />,
};

export function MobileNav() {
  const pathname = usePathname();
  const { hasSalesTaxAccounts, hasTaxDeductionAccounts } = useBusinessFeatures();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['Money', 'Planning']);

  // Filter out business-only features based on account settings
  // Tax: requires at least one account with tax deduction tracking
  // Sales Tax: requires at least one account with sales tax tracking
  const filteredNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.href === '/dashboard/tax') {
          return hasTaxDeductionAccounts;
        }
        if (item.href === '/dashboard/sales-tax') {
          return hasSalesTaxAccounts;
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title)
        ? prev.filter((s) => s !== title)
        : [...prev, title]
    );
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      // Exact match for dashboard
      return pathname === '/dashboard';
    }
    // For other paths, match exact or as a prefix
    return pathname === href || pathname.startsWith(href + '/');
  };

  const renderMobileItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeMobileMenu}
      >
        <div
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
            active
              ? 'bg-accent/20 text-accent'
              : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={
                active
                  ? 'text-accent'
                  : 'text-muted-foreground'
              }
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </div>
          {item.badge && (
            <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full">
              {item.badge}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="lg:hidden w-full max-w-full overflow-x-hidden">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border w-full">
        <div className="px-4 py-3 flex items-center justify-between w-full max-w-full">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="relative w-6 h-6">
              <Image
                src="/logo.png"
                alt="UnifiedLedger"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="font-bold text-foreground text-sm">Unified</span>
          </Link>

          <div className="flex items-center gap-2">
            <TestModeBadge />
            <UserMenu />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-muted-foreground"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[57px] z-40 bg-background w-full max-w-full overflow-x-hidden">
          <div className="flex flex-col h-full overflow-y-auto w-full max-w-full">
            {/* Household Selector */}
            <div className="px-4 py-4 border-b border-border">
              <HouseholdSelector />
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4">
              <div className="min-h-full flex flex-col">
                <div className="space-y-6">
                  <div className="space-y-1">{renderMobileItem(dashboardNavItem)}</div>

                  {filteredNavSections.map((section) => (
                    <div key={section.title}>
                      <button
                        onClick={() => toggleSection(section.title)}
                        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors mb-2"
                      >
                        <span>{section.title}</span>
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${
                            expandedSections.includes(section.title) ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {expandedSections.includes(section.title) && (
                        <div className="space-y-1">
                          {section.items.map((item) => renderMobileItem(item))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-6 border-t border-border">
                  <div className="space-y-1">{renderMobileItem(helpNavItem)}</div>
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
