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
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
  const [open, setOpen] = useState(false);
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

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
        <div
          className="relative flex items-center justify-between pl-4 pr-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200"
          style={{
            backgroundColor: active ? 'color-mix(in oklch, var(--color-accent) 8%, transparent)' : undefined,
            color: active ? 'var(--color-accent)' : 'var(--color-muted-foreground)',
          }}
          onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-foreground) 4%, transparent)'; e.currentTarget.style.color = 'var(--color-foreground)'; } }}
          onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--color-muted-foreground)'; } }}
        >
          {active && (
            <span className="absolute left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full" style={{ backgroundColor: 'var(--color-accent)' }} />
          )}
          <span className="flex items-center gap-3">
            <span className="transition-colors duration-200" style={{ color: active ? 'var(--color-accent)' : undefined }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </span>
          {item.badge && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full font-medium" style={{ backgroundColor: 'color-mix(in oklch, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
              {item.badge}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="lg:hidden w-full max-w-full overflow-x-hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        {/* Header — always visible */}
        <header className="sticky top-0 z-50 w-full" style={{ backgroundColor: 'var(--color-background)', borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}>
          <div className="px-4 h-14 flex items-center justify-between w-full max-w-full">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="relative w-7 h-7">
                <Image src="/logo.png" alt="UnifiedLedger" fill className="object-contain" priority />
              </div>
              <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--color-foreground)' }}>Unified</span>
            </Link>

            <div className="flex items-center gap-2">
              <TestModeBadge />
              <UserMenu />
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" style={{ color: 'var(--color-muted-foreground)' }}>
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
            </div>
          </div>
        </header>

        {/* Drawer */}
        <SheetContent
          side="left"
          className="w-[280px] p-0 flex flex-col *:data-[slot=sheet-close]:top-3.5 *:data-[slot=sheet-close]:right-3"
          style={{ backgroundColor: 'var(--color-background)', borderColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>

          {/* Drawer logo */}
          <div className="px-4 h-14 flex items-center" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
            <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3">
              <div className="relative w-7 h-7 shrink-0">
                <Image src="/logo.png" alt="UnifiedLedger" fill className="object-contain" />
              </div>
              <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--color-foreground)' }}>Unified Ledger</span>
            </Link>
          </div>

          {/* Household selector */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
            <HouseholdSelector />
          </div>

          {/* Nav sections */}
          <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4">
            <div className="min-h-full flex flex-col">
              <div className="space-y-5">
                <div className="space-y-0.5">{renderItem(dashboardNavItem)}</div>

                {filteredNavSections.map((section) => {
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
                        <span className="flex-1 h-px bg-border/30 group-hover:bg-border/50 transition-colors duration-200" />
                        <ChevronDown
                          className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isExpanded && (
                        <div className="space-y-0.5">
                          {section.items.map((item) => renderItem(item))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto pt-4" style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 30%, transparent)' }}>
                <div className="space-y-0.5">{renderItem(helpNavItem)}</div>
              </div>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
