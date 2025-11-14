'use client';

import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { HouseholdProvider } from '@/contexts/household-context';
import { DeveloperModeProvider } from '@/contexts/developer-mode-context';
import { SessionActivityProvider } from '@/components/providers/session-activity-provider';

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionActivityProvider>
      <HouseholdProvider>
        <DeveloperModeProvider>
          <DashboardLayout>{children}</DashboardLayout>
        </DeveloperModeProvider>
      </HouseholdProvider>
    </SessionActivityProvider>
  );
}
