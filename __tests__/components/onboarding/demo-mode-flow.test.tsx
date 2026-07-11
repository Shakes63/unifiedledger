import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { OnboardingModal } from '@/components/onboarding/onboarding-modal';
import { WelcomeStep } from '@/components/onboarding/steps/welcome-step';
import { useOnboarding } from '@/contexts/onboarding-context';
import { useHousehold } from '@/contexts/household-context';

vi.mock('@/contexts/onboarding-context', () => ({
  useOnboarding: vi.fn(),
}));

vi.mock('@/contexts/household-context', () => ({
  useHousehold: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

// The demo steps hit APIs on mount — stub them for modal-routing assertions.
vi.mock('@/components/onboarding/steps/create-demo-data-step', () => ({
  CreateDemoDataStep: () => <div>DEMO-DATA-STEP</div>,
}));
vi.mock('@/components/onboarding/steps/demo-data-choice-step', () => ({
  DemoDataChoiceStep: () => <div>DEMO-CHOICE-STEP</div>,
}));
vi.mock('@/components/onboarding/steps/create-household-step', () => ({
  CreateHouseholdStep: () => <div>HOUSEHOLD-STEP</div>,
}));

function baseOnboarding(overrides: Record<string, unknown> = {}) {
  return {
    currentStep: 1,
    totalSteps: 10,
    completedSteps: new Set<number>(),
    skippedSteps: new Set<number>(),
    nextStep: vi.fn(),
    previousStep: vi.fn(),
    skipStep: vi.fn(),
    completeOnboarding: vi.fn(),
    isLoading: false,
    isDemoMode: true,
    isInvitedUser: false,
    invitationHouseholdId: null,
    setInvitationContext: vi.fn(),
    setDemoMode: vi.fn(),
    clearInvitationContext: vi.fn(),
    demoDataCleared: false,
    setDemoDataCleared: vi.fn(),
    ...overrides,
  };
}

describe('demo mode wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useHousehold as Mock).mockReturnValue({
      households: [],
      initialized: true,
    });
  });

  describe('welcome step activation', () => {
    it('"Explore with Demo Data" enables demo mode and advances', () => {
      const setDemoMode = vi.fn();
      const onNext = vi.fn();
      (useOnboarding as Mock).mockReturnValue(
        baseOnboarding({ isDemoMode: false, setDemoMode })
      );

      render(<WelcomeStep onNext={onNext} />);
      fireEvent.click(screen.getByRole('button', { name: /explore with demo data/i }));

      expect(setDemoMode).toHaveBeenCalledWith(true);
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('"Get Started" keeps demo mode off and advances', () => {
      const setDemoMode = vi.fn();
      const onNext = vi.fn();
      (useOnboarding as Mock).mockReturnValue(
        baseOnboarding({ isDemoMode: false, setDemoMode })
      );

      render(<WelcomeStep onNext={onNext} />);
      // Both an in-body and footer button carry this label; click the visible one.
      fireEvent.click(screen.getAllByRole('button', { name: /get started/i })[0]);

      expect(setDemoMode).toHaveBeenCalledWith(false);
      expect(onNext).toHaveBeenCalled();
    });

    it('invited users never see the demo option', () => {
      (useOnboarding as Mock).mockReturnValue(
        baseOnboarding({ isDemoMode: false, isInvitedUser: true, invitationHouseholdId: 'hh-1' })
      );
      (useHousehold as Mock).mockReturnValue({
        households: [{ id: 'hh-1', name: 'Invited Household' }],
        initialized: true,
      });

      render(<WelcomeStep onNext={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /explore with demo data/i })).toBeNull();
    });
  });

  describe('modal step routing in demo mode', () => {
    it('step 2 is the demo-data step, not household creation', () => {
      (useOnboarding as Mock).mockReturnValue(baseOnboarding({ currentStep: 2 }));
      render(<OnboardingModal open onOpenChange={() => {}} />);
      expect(screen.getByText('DEMO-DATA-STEP')).toBeTruthy();
      expect(screen.queryByText('HOUSEHOLD-STEP')).toBeNull();
    });

    it('step 9 is the keep-or-clear choice', () => {
      (useOnboarding as Mock).mockReturnValue(baseOnboarding({ currentStep: 9 }));
      render(<OnboardingModal open onOpenChange={() => {}} />);
      expect(screen.getByText('DEMO-CHOICE-STEP')).toBeTruthy();
    });

    it('step 10 completes', () => {
      (useOnboarding as Mock).mockReturnValue(baseOnboarding({ currentStep: 10 }));
      render(<OnboardingModal open onOpenChange={() => {}} />);
      // Body + footer both carry the CTA; either proves the Complete step rendered.
      expect(screen.getAllByText(/start using unified ledger/i).length).toBeGreaterThan(0);
    });
  });
});
