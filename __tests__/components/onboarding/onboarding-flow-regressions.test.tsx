import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

import { OnboardingModal } from '@/components/onboarding/onboarding-modal';
import { CreateHouseholdStep } from '@/components/onboarding/steps/create-household-step';
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

function baseOnboarding(overrides: Record<string, unknown> = {}) {
  return {
    currentStep: 1,
    totalSteps: 9,
    completedSteps: new Set<number>(),
    skippedSteps: new Set<number>(),
    nextStep: vi.fn(),
    previousStep: vi.fn(),
    skipStep: vi.fn(),
    completeOnboarding: vi.fn(),
    isLoading: false,
    isDemoMode: false,
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

describe('onboarding flow regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('invitation context validated against real membership (audit F2)', () => {
    it('clears a stale invitation when the user is NOT a member of that household', async () => {
      const clearInvitationContext = vi.fn();
      (useOnboarding as Mock).mockReturnValue(
        baseOnboarding({
          isInvitedUser: true,
          totalSteps: 2,
          invitationHouseholdId: 'household-they-never-joined',
          clearInvitationContext,
        })
      );
      (useHousehold as Mock).mockReturnValue({
        households: [], // acceptance failed — no memberships
        initialized: true,
      });

      render(<OnboardingModal open onOpenChange={() => {}} />);

      await waitFor(() => {
        expect(clearInvitationContext).toHaveBeenCalled();
      });
    });

    it('keeps the invitation context for a REAL member', async () => {
      const clearInvitationContext = vi.fn();
      (useOnboarding as Mock).mockReturnValue(
        baseOnboarding({
          isInvitedUser: true,
          totalSteps: 2,
          invitationHouseholdId: 'hh-1',
          clearInvitationContext,
        })
      );
      (useHousehold as Mock).mockReturnValue({
        households: [{ id: 'hh-1', name: 'Real Household' }],
        initialized: true,
      });

      render(<OnboardingModal open onOpenChange={() => {}} />);

      // Give effects a tick; the context must survive.
      await new Promise((r) => setTimeout(r, 50));
      expect(clearInvitationContext).not.toHaveBeenCalled();
    });

    it('does not judge membership before the household list has initialized', async () => {
      const clearInvitationContext = vi.fn();
      (useOnboarding as Mock).mockReturnValue(
        baseOnboarding({
          isInvitedUser: true,
          totalSteps: 2,
          invitationHouseholdId: 'hh-1',
          clearInvitationContext,
        })
      );
      (useHousehold as Mock).mockReturnValue({
        households: [], // not loaded yet
        initialized: false,
      });

      render(<OnboardingModal open onOpenChange={() => {}} />);

      await new Promise((r) => setTimeout(r, 50));
      expect(clearInvitationContext).not.toHaveBeenCalled();
    });
  });

  describe('household creation advances exactly one step (audit F10)', () => {
    it('does not double-advance when refreshHouseholds repopulates mid-submit', async () => {
      const onNext = vi.fn();
      const setSelectedHouseholdId = vi.fn().mockResolvedValue(undefined);

      // Simulate the real household context: refreshHouseholds() causes the
      // households array to repopulate WHILE handleSubmit is still running —
      // the exact race that used to fire the auto-advance effect on top of
      // handleSubmit's own onNext, skipping the Create Account step.
      let setHouseholdsState: (h: Array<{ id: string; name: string }>) => void = () => {};
      (useHousehold as Mock).mockImplementation(() => {
        const [households, setHouseholds] = useState<Array<{ id: string; name: string }>>([]);
        setHouseholdsState = setHouseholds;
        return {
          households,
          refreshHouseholds: vi.fn().mockImplementation(async () => {
            setHouseholds([{ id: 'new-hh', name: 'My Household' }]);
          }),
          setSelectedHouseholdId,
        };
      });

      (useOnboarding as Mock).mockReturnValue(baseOnboarding());

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'new-hh', name: 'My Household' }),
      }) as unknown as typeof fetch;

      render(
        <CreateHouseholdStep
          onNext={onNext}
          onPrevious={() => {}}
          canSkip={false}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      await act(async () => {
        fireEvent.click(nextButton);
        // Let the async submit (fetch -> refresh -> select -> onNext) settle.
        await new Promise((r) => setTimeout(r, 100));
      });

      expect(onNext).toHaveBeenCalledTimes(1);

      // And the auto-advance effect stays quiet afterwards too.
      await act(async () => {
        setHouseholdsState([{ id: 'new-hh', name: 'My Household' }]);
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('still auto-advances on refresh when a household already exists (no submit in flight)', async () => {
      const onNext = vi.fn();
      const setSelectedHouseholdId = vi.fn().mockResolvedValue(undefined);
      (useHousehold as Mock).mockReturnValue({
        households: [{ id: 'existing-hh', name: 'Existing' }],
        refreshHouseholds: vi.fn(),
        setSelectedHouseholdId,
      });
      (useOnboarding as Mock).mockReturnValue(baseOnboarding());

      render(
        <CreateHouseholdStep
          onNext={onNext}
          onPrevious={() => {}}
          canSkip={false}
        />
      );

      await waitFor(() => {
        expect(onNext).toHaveBeenCalledTimes(1);
      });
      expect(setSelectedHouseholdId).toHaveBeenCalledWith('existing-hh');
    });
  });
});
