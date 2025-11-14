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
  const { sidebarOpen } = useNavigation();

  return (
    <div className="h-screen bg-background flex flex-col lg:flex-row overflow-hidden w-full max-w-full">
      {/* Sidebar - Desktop only */}
      <Sidebar />

      {/* Mobile Navigation + Content wrapper */}
      <div className="flex-1 flex flex-col w-full max-w-full min-w-0 overflow-hidden">
        {/* Mobile Navigation - Mobile only */}
        <MobileNav />

        {/* Main Content */}
        <main className="flex-1 w-full max-w-full overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Developer Tools Panel */}
      <DeveloperToolsPanel />
    </div>
  );
}

export function DashboardLayout({ children, showTopNav = true }: DashboardLayoutProps) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}
