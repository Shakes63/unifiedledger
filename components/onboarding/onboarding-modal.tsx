'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { OnboardingProgress } from './onboarding-progress';
import { useOnboarding } from '@/contexts/onboarding-context';
import { WelcomeStep } from './steps/welcome-step';
import { CreateHouseholdStep } from './steps/create-household-step';
import { CreateAccountStep } from './steps/create-account-step';
import { CreateBillStep } from './steps/create-bill-step';
import { CreateGoalStep } from './steps/create-goal-step';
import { CreateDebtStep } from './steps/create-debt-step';
import { CreateTransactionStep } from './steps/create-transaction-step';
import { CompleteStep } from './steps/complete-step';

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingModal({ open, onOpenChange }: OnboardingModalProps) {
  const {
    currentStep,
    totalSteps,
    completedSteps,
    skippedSteps,
    nextStep,
    previousStep,
    skipStep,
    completeOnboarding,
    isLoading,
  } = useOnboarding();

  const handleComplete = async () => {
    try {
      await completeOnboarding();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  };

  const handleSkip = () => {
    skipStep(currentStep);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <WelcomeStep onNext={nextStep} />;
      case 2:
        return (
          <CreateHouseholdStep
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={handleSkip}
            canSkip={false}
          />
        );
      case 3:
        return (
          <CreateAccountStep
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={handleSkip}
            canSkip={true}
          />
        );
      case 4:
        return (
          <CreateBillStep
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={handleSkip}
            canSkip={true}
          />
        );
      case 5:
        return (
          <CreateGoalStep
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={handleSkip}
            canSkip={true}
          />
        );
      case 6:
        return (
          <CreateDebtStep
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={handleSkip}
            canSkip={true}
          />
        );
      case 7:
        return (
          <CreateTransactionStep
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={handleSkip}
            canSkip={true}
          />
        );
      case 8:
        return (
          <CompleteStep
            onComplete={handleComplete}
            onPrevious={previousStep}
            isLoading={isLoading}
          />
        );
      default:
        return null;
    }
  };

  // Don't show close button except on welcome step
  const showCloseButton = currentStep === 1;

  return (
    <Dialog open={open} onOpenChange={showCloseButton ? onOpenChange : undefined}>
      <DialogContent
        className="max-w-[95vw] sm:max-w-3xl max-h-[95vh] p-0 flex flex-col bg-background border-border"
        showCloseButton={showCloseButton}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Onboarding</DialogTitle>
          <DialogDescription>Complete the onboarding flow to get started</DialogDescription>
        </DialogHeader>
        {/* Progress Indicator */}
        {currentStep > 1 && (
          <div className="border-b border-border">
            <OnboardingProgress
              currentStep={currentStep}
              totalSteps={totalSteps}
              completedSteps={completedSteps}
              skippedSteps={skippedSteps}
            />
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-hidden">{renderStep()}</div>
      </DialogContent>
    </Dialog>
  );
}

