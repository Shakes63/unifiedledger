'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { HouseholdProvider } from '@/contexts/household-context';
import { DeveloperModeProvider } from '@/contexts/developer-mode-context';
import { SessionActivityProvider } from '@/components/providers/session-activity-provider';
import { ExperimentalFeaturesProvider } from '@/contexts/experimental-features-context';
import { FeatureGate } from '@/components/experimental/feature-gate';
import { QuickTransactionModal } from '@/components/transactions/quick-transaction-modal';

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);

  // Global keyboard listener for Quick Entry (Q key)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only trigger if not in input/textarea/select
      const target = e.target as HTMLElement;
      const isInputField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      if (e.key === 'q' && !isInputField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setQuickEntryOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <SessionActivityProvider>
      <HouseholdProvider>
        <ExperimentalFeaturesProvider>
          <DeveloperModeProvider>
            <DashboardLayout>{children}</DashboardLayout>

            {/* Experimental: Quick Entry Mode (Q key shortcut) */}
            <FeatureGate featureId="quick-entry">
              <QuickTransactionModal
                open={quickEntryOpen}
                onOpenChange={setQuickEntryOpen}
              />
            </FeatureGate>
          </DeveloperModeProvider>
        </ExperimentalFeaturesProvider>
      </HouseholdProvider>
    </SessionActivityProvider>
  );
}
