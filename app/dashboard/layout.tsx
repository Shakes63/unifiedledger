'use client';

import { useState, useEffect, Suspense } from 'react';
import { DashboardLayout } from '@/components/navigation/dashboard-layout';
import { HouseholdProvider } from '@/contexts/household-context';
import { DeveloperModeProvider } from '@/contexts/developer-mode-context';
import { SessionActivityProvider } from '@/components/providers/session-activity-provider';
import { ExperimentalFeaturesProvider } from '@/contexts/experimental-features-context';
import { OnboardingProvider, useOnboarding } from '@/contexts/onboarding-context';
import { FeatureGate } from '@/components/experimental/feature-gate';
import { QuickTransactionModal } from '@/components/transactions/quick-transaction-modal';
import { OnboardingModal } from '@/components/onboarding/onboarding-modal';
import { useHousehold } from '@/contexts/household-context';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const { isOnboardingActive } = useOnboarding();
  const { initialized } = useHousehold();
  // For manual override when user completes onboarding
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // Derive showOnboarding from state - show if:
  // 1. Onboarding is active (not completed)
  // 2. Household context is initialized
  // 3. User hasn't manually dismissed it
  // Note: We don't check householdList.length because user may have created
  // a household during onboarding and refreshed - we still need to show onboarding
  const showOnboarding = isOnboardingActive && initialized && !onboardingDismissed;

  const handleOnboardingOpenChange = (open: boolean) => {
    if (!open) {
      setOnboardingDismissed(true);
    }
  };

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
    <>
      <DashboardLayout>{children}</DashboardLayout>

      {/* Onboarding Modal - wrapped in Suspense since it uses useSearchParams */}
      <Suspense fallback={null}>
        <OnboardingModal
          open={showOnboarding}
          onOpenChange={handleOnboardingOpenChange}
        />
      </Suspense>

      {/* Experimental: Quick Entry Mode (Q key shortcut) */}
      <FeatureGate featureId="quick-entry">
        <QuickTransactionModal
          open={quickEntryOpen}
          onOpenChange={setQuickEntryOpen}
        />
      </FeatureGate>
    </>
  );
}

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionActivityProvider>
      <HouseholdProvider>
        <OnboardingProvider>
          <ExperimentalFeaturesProvider>
            <DeveloperModeProvider>
              <DashboardContent>{children}</DashboardContent>
            </DeveloperModeProvider>
          </ExperimentalFeaturesProvider>
        </OnboardingProvider>
      </HouseholdProvider>
    </SessionActivityProvider>
  );
}
