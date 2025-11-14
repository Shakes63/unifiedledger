'use client';

import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { HouseholdProvider } from '@/contexts/household-context';

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HouseholdProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </HouseholdProvider>
  );
}
