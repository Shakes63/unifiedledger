'use client';

import { useState, useEffect } from 'react';
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
  const { households: householdList, initialized } = useHousehold();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding if:
  // 1. Onboarding is active (not completed)
  // 2. User has no households (new user)
  // 3. Household context is initialized
  useEffect(() => {
    if (isOnboardingActive && initialized && householdList.length === 0) {
      setShowOnboarding(true);
    } else if (!isOnboardingActive) {
      setShowOnboarding(false);
    }
  }, [isOnboardingActive, initialized, householdList.length]);

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

      {/* Onboarding Modal */}
      <OnboardingModal
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
      />

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
