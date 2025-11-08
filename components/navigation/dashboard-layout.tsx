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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row overflow-x-hidden w-full max-w-full">
      {/* Sidebar - Desktop only */}
      <Sidebar />

      {/* Mobile Navigation + Content wrapper */}
      <div className="flex-1 flex flex-col w-full max-w-full min-w-0 overflow-x-hidden">
        {/* Mobile Navigation - Mobile only */}
        <MobileNav />

        {/* Main Content */}
        <main className="flex-1 w-full max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardLayout({ children, showTopNav = true }: DashboardLayoutProps) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}
