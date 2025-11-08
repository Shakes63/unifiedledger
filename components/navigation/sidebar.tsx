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
  ChevronDown,
  FileText,
  Bell,
  ChevronLeft,
  Store,
} from 'lucide-react';
import Image from 'next/image';
import { HouseholdSelector } from '@/components/household/household-selector';
import { Button } from '@/components/ui/button';
import { UserButton } from '@clerk/nextjs';
import { useNavigation } from '@/context/navigation-context';

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
      { label: 'Notifications', href: '/dashboard/notifications', icon: <Bell className="w-4 h-4" /> },
      { label: 'Reports', href: '/dashboard/reports', icon: <FileText className="w-4 h-4" /> },
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

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useNavigation();
  const [expandedSections, setExpandedSections] = useState<string[]>(['Core']);

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

  return (
    <aside
      className={`hidden lg:flex flex-col bg-[#1a1a1a] border-r border-[#2a2a2a] h-screen overflow-y-auto overflow-x-hidden sticky top-0 transition-all duration-300 shrink-0 ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Logo Section */}
      <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
        {sidebarOpen && (
          <Link href="/dashboard" className="flex items-center gap-3 flex-1">
            <div className="relative w-8 h-8 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="UnifiedLedger"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Unified</h2>
              <p className="text-xs text-[#6b7280]">Finance</p>
            </div>
          </Link>
        )}
        {!sidebarOpen && (
          <Link href="/dashboard" className="flex items-center justify-center w-full">
            <div className="relative w-8 h-8">
              <Image
                src="/logo.png"
                alt="UnifiedLedger"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-[#9ca3af] hover:text-white flex-shrink-0 ml-2"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
        </Button>
      </div>

      {/* Household Selector */}
      {sidebarOpen && (
        <div className="px-4 py-4 border-b border-[#2a2a2a]">
          <HouseholdSelector />
        </div>
      )}

      {/* Navigation Sections */}
      <nav className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarOpen ? 'px-4 py-6 space-y-6' : 'px-2 py-4 space-y-2'}`}>
        {navSections.map((section) => {
          if (!sidebarOpen) {
            // Collapsed view - show only icons
            return (
              <div key={section.title} className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={`flex items-center justify-center p-3 rounded-lg transition-colors ${
                          active
                            ? 'bg-[#10b981]/20 text-[#10b981]'
                            : 'text-[#9ca3af] hover:text-white hover:bg-[#242424]'
                        }`}
                        title={item.label}
                      >
                        <span className={active ? 'text-[#10b981]' : 'text-[#6b7280]'}>
                          {item.icon}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          }

          // Expanded view
          return (
            <div key={section.title}>
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-[#9ca3af] uppercase tracking-wider hover:text-white transition-colors mb-3"
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
                      <Link key={item.href} href={item.href}>
                        <div
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            active
                              ? 'bg-[#10b981]/20 text-[#10b981]'
                              : 'text-[#9ca3af] hover:text-white hover:bg-[#242424]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={active ? 'text-[#10b981]' : 'text-[#6b7280]'}>
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
          );
        })}
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-[#2a2a2a] space-y-2">
        <div className="px-3 py-2 flex items-center justify-center">
          <UserButton />
        </div>
      </div>
    </aside>
  );
}
