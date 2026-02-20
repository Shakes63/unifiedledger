import { describe, expect, it, vi, type Mock } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { OnboardingModal } from '@/components/onboarding/onboarding-modal';
import { useOnboarding } from '@/contexts/onboarding-context';
import { useHousehold } from '@/contexts/household-context';

vi.mock('@/contexts/onboarding-context', () => ({
  useOnboarding: vi.fn(),
}));

vi.mock('@/contexts/household-context', () => ({
  useHousehold: vi.fn(),
}));

function failIfRendered(stepName: string) {
  return () => {
    throw new Error(`${stepName} should not render for invited onboarding`);
  };
}

vi.mock('@/components/onboarding/steps/create-household-step', () => ({
  CreateHouseholdStep: failIfRendered('CreateHouseholdStep'),
}));
vi.mock('@/components/onboarding/steps/create-account-step', () => ({
  CreateAccountStep: failIfRendered('CreateAccountStep'),
}));
vi.mock('@/components/onboarding/steps/create-category-step', () => ({
  CreateCategoryStep: failIfRendered('CreateCategoryStep'),
}));
vi.mock('@/components/onboarding/steps/create-transaction-step', () => ({
  CreateTransactionStep: failIfRendered('CreateTransactionStep'),
}));
vi.mock('@/components/onboarding/steps/create-bill-step', () => ({
  CreateBillStep: failIfRendered('CreateBillStep'),
}));
vi.mock('@/components/onboarding/steps/create-goal-step', () => ({
  CreateGoalStep: failIfRendered('CreateGoalStep'),
}));
vi.mock('@/components/onboarding/steps/create-debt-step', () => ({
  CreateDebtStep: failIfRendered('CreateDebtStep'),
}));
vi.mock('@/components/onboarding/steps/create-demo-data-step', () => ({
  CreateDemoDataStep: failIfRendered('CreateDemoDataStep'),
}));
vi.mock('@/components/onboarding/steps/demo-data-choice-step', () => ({
  DemoDataChoiceStep: failIfRendered('DemoDataChoiceStep'),
}));

describe('Invited onboarding flow safety', () => {
  it('renders invited welcome path without household/account/category persistence steps', () => {
    (useHousehold as Mock).mockReturnValue({
      households: [{ id: 'hh-1', name: 'Invited Household' }],
    });

    (useOnboarding as Mock).mockReturnValue({
      currentStep: 1,
      totalSteps: 2,
      completedSteps: new Set<number>(),
      skippedSteps: new Set<number>(),
      nextStep: vi.fn(),
      previousStep: vi.fn(),
      skipStep: vi.fn(),
      completeOnboarding: vi.fn().mockResolvedValue(undefined),
      isLoading: false,
      isDemoMode: false,
      isInvitedUser: true,
      setInvitationContext: vi.fn(),
      demoDataCleared: false,
      setDemoDataCleared: vi.fn(),
      clearInvitationContext: vi.fn(),
      invitationHouseholdId: 'hh-1',
    });

    render(<OnboardingModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/you'?re joining/i)).toBeInTheDocument();
    expect(screen.getByText(/view shared accounts and transactions/i)).toBeInTheDocument();
  });

  it('completes invited flow without invoking setup-step persistence calls', async () => {
    const completeOnboarding = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    (useHousehold as Mock).mockReturnValue({
      households: [{ id: 'hh-1', name: 'Invited Household' }],
    });

    (useOnboarding as Mock).mockReturnValue({
      currentStep: 2,
      totalSteps: 2,
      completedSteps: new Set<number>([1]),
      skippedSteps: new Set<number>(),
      nextStep: vi.fn(),
      previousStep: vi.fn(),
      skipStep: vi.fn(),
      completeOnboarding,
      isLoading: false,
      isDemoMode: false,
      isInvitedUser: true,
      setInvitationContext: vi.fn(),
      demoDataCleared: false,
      setDemoDataCleared: vi.fn(),
      clearInvitationContext: vi.fn(),
      invitationHouseholdId: 'hh-1',
    });

    render(<OnboardingModal open={true} onOpenChange={onOpenChange} />);

    const completeButtons = screen.getAllByRole('button', { name: /go to dashboard/i });
    expect(completeButtons.length).toBeGreaterThan(0);
    fireEvent.click(completeButtons[0]);

    await waitFor(() => {
      expect(completeOnboarding).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
