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
  ChevronDown,
  FileText,
  ChevronLeft,
  Store,
  Settings,
  Calculator,
  Code,
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
import { Badge } from '@/components/ui/badge';
import { UserMenu } from '@/components/auth/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { TestModeBadge, TestModeBadgeCompact } from '@/components/dev/test-mode-badge';
import { useNavigation } from '@/context/navigation-context';
import { useDeveloperMode } from '@/contexts/developer-mode-context';
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

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useNavigation();
  const { isDeveloperMode } = useDeveloperMode();
  const { hasSalesTaxAccounts, hasTaxDeductionAccounts } = useBusinessFeatures();
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

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      // Exact match for dashboard
      return pathname === '/dashboard';
    }
    // For other paths, match exact or as a prefix
    return pathname === href || pathname.startsWith(href + '/');
  };

  const renderExpandedItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link key={item.href} href={item.href}>
        <div
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
            active
              ? 'bg-accent/20 text-accent'
              : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={active ? 'text-accent' : 'text-muted-foreground'}>{item.icon}</span>
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

  const renderCollapsedItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link key={item.href} href={item.href}>
        <div
          className={`flex items-center justify-center p-3 rounded-lg transition-colors ${
            active
              ? 'bg-accent/20 text-accent'
              : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
          }`}
          title={item.label}
        >
          <span className={active ? 'text-accent' : 'text-muted-foreground'}>{item.icon}</span>
        </div>
      </Link>
    );
  };

  return (
    <aside
      className={`hidden lg:flex flex-col bg-card border-r border-border h-screen sticky top-0 transition-all duration-300 shrink-0 ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Logo Section */}
      <div
        className={`p-4 border-b border-border flex min-w-0 ${
          sidebarOpen ? 'items-center justify-between gap-2' : 'flex-col items-center gap-2'
        }`}
        data-testid="sidebar-header"
      >
        {sidebarOpen && (
          <Link href="/dashboard" className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative w-8 h-8 shrink-0">
              <Image
                src="/logo.png"
                alt="UnifiedLedger"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="min-w-0 flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Unified Ledger</h2>
              {isDeveloperMode && (
                <Badge
                  variant="outline"
                  className="bg-warning/10 text-warning border-warning/20 text-[10px] px-1.5 py-0.5 flex items-center gap-1"
                >
                  <Code className="w-3 h-3" />
                  DEV
                </Badge>
              )}
            </div>
          </Link>
        )}
        {!sidebarOpen && (
          <Link href="/dashboard" className="flex flex-col items-center justify-center flex-1 min-w-0 gap-1">
            <div className="relative w-8 h-8">
              <Image
                src="/logo.png"
                alt="UnifiedLedger"
                fill
                className="object-contain"
                priority
              />
            </div>
            {isDeveloperMode && (
              <Badge
                variant="outline"
                className="bg-warning/10 text-warning border-warning/20 text-[8px] px-1 py-0 flex items-center gap-0.5"
              >
                <Code className="w-2.5 h-2.5" />
              </Badge>
            )}
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-muted-foreground hover:text-foreground shrink-0"
          data-testid="sidebar-collapse-toggle"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
        </Button>
      </div>

      {/* Household Selector */}
      {sidebarOpen && (
        <div className="px-4 py-4 border-b border-border min-w-0">
          <HouseholdSelector />
        </div>
      )}

      {/* Navigation Sections */}
      <nav className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarOpen ? 'px-4 py-6' : 'px-2 py-4'}`}>
        <div className="min-h-full flex flex-col">
          <div className={sidebarOpen ? 'space-y-6' : 'space-y-2'}>
            {sidebarOpen ? (
              <div className="space-y-1">{renderExpandedItem(dashboardNavItem)}</div>
            ) : (
              <div className="space-y-1">{renderCollapsedItem(dashboardNavItem)}</div>
            )}

            {filteredNavSections.map((section) => {
              if (!sidebarOpen) {
                // Collapsed view - show only icons
                return (
                  <div key={section.title} className="space-y-1">
                    {section.items.map((item) => renderCollapsedItem(item))}
                  </div>
                );
              }

              // Expanded view
              return (
                <div key={section.title}>
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors mb-3"
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
                      {section.items.map((item) => renderExpandedItem(item))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={`${sidebarOpen ? 'mt-6 pt-6 border-t border-border' : 'mt-2 pt-2 border-t border-border/60'} mt-auto`}>
            <div className="space-y-1">
              {sidebarOpen ? renderExpandedItem(helpNavItem) : renderCollapsedItem(helpNavItem)}
            </div>
          </div>
        </div>
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-border">
        <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center flex-col gap-2'}`}>
          {sidebarOpen ? <TestModeBadge /> : <TestModeBadgeCompact />}
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}
