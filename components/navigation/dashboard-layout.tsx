'use client';

import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { DeveloperToolsPanel } from '@/components/dev/developer-tools-panel';
import { useNavigation } from '@/context/navigation-context';

interface DashboardLayoutProps {
  children: React.ReactNode;
  showTopNav?: boolean;
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const { sidebarOpen: _sidebarOpen } = useNavigation();

  return (
    <div className="h-screen bg-background flex flex-col lg:flex-row w-full max-w-full overflow-hidden">
      {/* Sidebar - Desktop only */}
      <Sidebar />

      {/* Mobile Navigation + Content wrapper */}
      <div className="flex-1 flex flex-col w-full max-w-full min-w-0 h-full">
        {/* Mobile Navigation - Mobile only */}
        <MobileNav />

        {/* Main Content - h-0 with flex-1 forces proper height calculation for overflow */}
        <main 
          className="flex-1 h-0 w-full max-w-full overflow-y-auto overflow-x-hidden"
          tabIndex={0}
        >
          {children}
        </main>
      </div>

      {/* Developer Tools Panel */}
      <DeveloperToolsPanel />
    </div>
  );
}

export function DashboardLayout({ children, showTopNav: _showTopNav = true }: DashboardLayoutProps) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}
