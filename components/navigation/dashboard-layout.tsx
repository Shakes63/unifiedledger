'use client';

import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { useNavigation } from '@/context/navigation-context';

interface DashboardLayoutProps {
  children: React.ReactNode;
  showTopNav?: boolean;
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const { sidebarOpen } = useNavigation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Sidebar - Desktop only */}
      <Sidebar />

      {/* Mobile Navigation */}
      <MobileNav />

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-0' : 'lg:ml-0'
        }`}
      >
        {children}
      </main>
    </div>
  );
}

export function DashboardLayout({ children, showTopNav = true }: DashboardLayoutProps) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}
