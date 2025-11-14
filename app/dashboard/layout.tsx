'use client';

import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { HouseholdProvider } from '@/contexts/household-context';
import { DeveloperModeProvider } from '@/contexts/developer-mode-context';

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HouseholdProvider>
      <DeveloperModeProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </DeveloperModeProvider>
    </HouseholdProvider>
  );
}
