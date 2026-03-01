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
import { UserMenu } from '@/components/auth/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { TestModeBadge, TestModeBadgeCompact } from '@/components/dev/test-mode-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

  const filteredNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.href === '/dashboard/tax') return hasTaxDeductionAccounts;
        if (item.href === '/dashboard/sales-tax') return hasSalesTaxAccounts;
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
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const renderExpandedItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link key={item.href} href={item.href}>
        <div
          className="relative flex items-center justify-between pl-4 pr-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200"
          style={{
            backgroundColor: active ? 'color-mix(in oklch, var(--color-primary) 8%, transparent)' : undefined,
            color: active ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
          }}
          onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--color-foreground)'; e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-foreground) 4%, transparent)'; } }}
          onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--color-muted-foreground)'; e.currentTarget.style.backgroundColor = ''; } }}
        >
          {active && (
            <span className="absolute left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full" style={{ backgroundColor: 'var(--color-primary)' }} />
          )}
          <span className="flex items-center gap-3">
            <span className="transition-colors duration-200" style={{ color: active ? 'var(--color-primary)' : undefined }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </span>
          {item.badge && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full font-medium" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
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
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>
          <Link href={item.href}>
            <div
              className="relative flex items-center justify-center p-2.5 rounded-lg transition-all duration-200"
              style={{
                backgroundColor: active ? 'color-mix(in oklch, var(--color-primary) 8%, transparent)' : undefined,
                color: active ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--color-foreground)'; e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-foreground) 4%, transparent)'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--color-muted-foreground)'; e.currentTarget.style.backgroundColor = ''; } }}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 rounded-r-full" style={{ backgroundColor: 'var(--color-primary)' }} />
              )}
              {item.icon}
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          <span className="text-xs">{item.label}</span>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      className={`hidden lg:flex flex-col h-screen sticky top-0 transition-all duration-300 ease-out shrink-0 ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}
      style={{ backgroundColor: 'var(--color-background)', borderRight: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
    >
      {/* Logo */}
      <div
        className={`h-14 flex items-center ${
          sidebarOpen ? 'px-4 justify-between gap-2' : 'px-2 justify-center gap-2 flex-col'
        }`}
        style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}
        data-testid="sidebar-header"
      >
        {sidebarOpen ? (
          <Link href="/dashboard" className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative w-8 h-8 shrink-0">
              <Image src="/logo.png" alt="UnifiedLedger" fill className="object-contain" priority />
            </div>
            <div className="min-w-0 flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--color-foreground)' }}>Unified Ledger</h2>
              {isDeveloperMode && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border"
                  style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)', color: 'var(--color-warning)', borderColor: 'color-mix(in oklch, var(--color-warning) 20%, transparent)' }}
                >
                  <Code className="w-3 h-3" />
                  DEV
                </span>
              )}
            </div>
          </Link>
        ) : (
          <Link href="/dashboard" className="flex flex-col items-center justify-center flex-1 min-w-0 gap-1">
            <div className="relative w-8 h-8">
              <Image src="/logo.png" alt="UnifiedLedger" fill className="object-contain" priority />
            </div>
            {isDeveloperMode && (
              <span
                className="inline-flex items-center gap-0.5 text-[8px] px-1 py-0 rounded-md border"
                style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)', color: 'var(--color-warning)', borderColor: 'color-mix(in oklch, var(--color-warning) 20%, transparent)' }}
              >
                <Code className="w-2.5 h-2.5" />
              </span>
            )}
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="shrink-0 h-8 w-8"
          style={{ color: 'color-mix(in oklch, var(--color-muted-foreground) 60%, transparent)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-foreground)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'color-mix(in oklch, var(--color-muted-foreground) 60%, transparent)'; }}
          data-testid="sidebar-collapse-toggle"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`} />
        </Button>
      </div>

      {/* Household Selector */}
      {sidebarOpen && (
        <div className="px-4 py-3 min-w-0" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
          <HouseholdSelector />
        </div>
      )}

      {/* Navigation */}
      <TooltipProvider delayDuration={0}>
        <nav className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 ${sidebarOpen ? 'px-3 py-5' : 'px-2 py-3'}`}>
          <div className="min-h-full flex flex-col">
            <div className={sidebarOpen ? 'space-y-5' : 'space-y-1'}>
              {/* Dashboard link */}
              <div className="space-y-0.5">
                {sidebarOpen ? renderExpandedItem(dashboardNavItem) : renderCollapsedItem(dashboardNavItem)}
              </div>

              {/* Sections */}
              {filteredNavSections.map((section) => {
                if (!sidebarOpen) {
                  return (
                    <div key={section.title} className="space-y-0.5 pt-1">
                      {section.items.map((item) => renderCollapsedItem(item))}
                    </div>
                  );
                }

                const isExpanded = expandedSections.includes(section.title);
                return (
                  <div key={section.title}>
                    <button
                      onClick={() => toggleSection(section.title)}
                      className="group flex items-center gap-2.5 w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors duration-200 mb-1.5"
                      style={{ color: 'color-mix(in oklch, var(--color-muted-foreground) 50%, transparent)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'color-mix(in oklch, var(--color-muted-foreground) 80%, transparent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'color-mix(in oklch, var(--color-muted-foreground) 50%, transparent)'; }}
                    >
                      <span className="shrink-0">{section.title}</span>
                      <span className="flex-1 h-px transition-colors duration-200" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 30%, transparent)' }} />
                      <ChevronDown
                        className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="space-y-0.5">
                        {section.items.map((item) => renderExpandedItem(item))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Help — pinned to bottom */}
            <div className={`mt-auto ${sidebarOpen ? 'pt-4' : 'pt-2'}`} style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 30%, transparent)' }}>
              <div className="space-y-0.5">
                {sidebarOpen ? renderExpandedItem(helpNavItem) : renderCollapsedItem(helpNavItem)}
              </div>
            </div>
          </div>
        </nav>
      </TooltipProvider>

      {/* Footer */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
        <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center flex-col gap-2'}`}>
          {sidebarOpen ? <TestModeBadge /> : <TestModeBadgeCompact />}
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}
