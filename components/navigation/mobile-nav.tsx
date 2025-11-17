'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Wallet,
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  Receipt,
  Target,
  AlertCircle,
  Menu,
  X,
  ChevronDown,
  FileText,
  Bell,
  Store,
  Calculator,
  Settings,
} from 'lucide-react';
import Image from 'next/image';
import { HouseholdSelector } from '@/components/household/household-selector';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/auth/user-menu';

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
    title: 'Core',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: <Wallet className="w-4 h-4" /> },
      { label: 'Transactions', href: '/dashboard/transactions', icon: <Receipt className="w-4 h-4" /> },
      { label: 'Accounts', href: '/dashboard/accounts', icon: <Wallet className="w-4 h-4" /> },
      { label: 'Calendar', href: '/dashboard/calendar', icon: <Calendar className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Financial',
    items: [
      { label: 'Bills', href: '/dashboard/bills', icon: <DollarSign className="w-4 h-4" /> },
      { label: 'Budgets', href: '/dashboard/budgets', icon: <Calculator className="w-4 h-4" /> },
      { label: 'Goals', href: '/dashboard/goals', icon: <Target className="w-4 h-4" /> },
      { label: 'Debts', href: '/dashboard/debts', icon: <TrendingUp className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Categories', href: '/dashboard/categories', icon: <PieChart className="w-4 h-4" /> },
      { label: 'Merchants', href: '/dashboard/merchants', icon: <Store className="w-4 h-4" /> },
      { label: 'Rules', href: '/dashboard/rules', icon: <AlertCircle className="w-4 h-4" /> },
      { label: 'Reports', href: '/dashboard/reports', icon: <FileText className="w-4 h-4" /> },
      { label: 'Settings', href: '/dashboard/settings', icon: <Settings className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Tax',
    items: [
      { label: 'Tax Dashboard', href: '/dashboard/tax', icon: <FileText className="w-4 h-4" /> },
      { label: 'Sales Tax', href: '/dashboard/sales-tax', icon: <DollarSign className="w-4 h-4" /> },
    ],
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['Core']);

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

  return (
    <div className="lg:hidden w-full max-w-full overflow-x-hidden">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-[#1a1a1a] border-b border-[#2a2a2a] w-full">
        <div className="px-4 py-3 flex items-center justify-between w-full max-w-full">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="relative w-6 h-6">
              <Image
                src="/logo.png"
                alt="UnifiedLedger"
                fill
                className="object-contain"
              />
            </div>
            <span className="font-bold text-white text-sm">Unified</span>
          </Link>

          <div className="flex items-center gap-3">
            <UserMenu />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-[#9ca3af]"
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
        <div className="fixed inset-0 top-[57px] z-40 bg-[#0a0a0a] w-full max-w-full overflow-x-hidden">
          <div className="flex flex-col h-full overflow-y-auto w-full max-w-full">
            {/* Household Selector */}
            <div className="px-4 py-4 border-b border-[#2a2a2a]">
              <HouseholdSelector />
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-6">
              {navSections.map((section) => (
                <div key={section.title}>
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-[#9ca3af] uppercase tracking-wider hover:text-white transition-colors mb-2"
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
                      {section.items.map((item) => {
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
                                  ? 'bg-[#10b981]/20 text-[#10b981]'
                                  : 'text-[#9ca3af] hover:text-white hover:bg-[#242424]'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={
                                    active
                                      ? 'text-[#10b981]'
                                      : 'text-[#6b7280]'
                                  }
                                >
                                  {item.icon}
                                </span>
                                <span>{item.label}</span>
                              </div>
                              {item.badge && (
                                <span className="px-2 py-0.5 bg-[#10b981]/20 text-[#10b981] text-xs rounded-full">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
