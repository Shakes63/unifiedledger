'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: Set<number>;
  skippedSteps: Set<number>;
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
  completedSteps,
  skippedSteps,
}: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-between w-full px-4 py-6">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNumber = i + 1;
        const isCompleted = completedSteps.has(stepNumber);
        const isSkipped = skippedSteps.has(stepNumber);
        const isCurrent = stepNumber === currentStep;
        const isPast = stepNumber < currentStep;

        return (
          <div key={stepNumber} className="flex items-center flex-1">
            {/* Step Circle */}
            <div className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors',
                  isCompleted &&
                    'bg-success border-success text-background',
                  isSkipped &&
                    'bg-warning/20 border-warning text-warning',
                  isCurrent &&
                    !isCompleted &&
                    !isSkipped &&
                    'bg-primary border-primary text-background',
                  !isCompleted &&
                    !isSkipped &&
                    !isCurrent &&
                    'bg-elevated border-border text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-semibold">{stepNumber}</span>
                )}
              </div>
              {/* Step Label (hidden on mobile, shown on larger screens) */}
              <span
                className={cn(
                  'mt-2 text-xs text-center hidden sm:block',
                  isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                Step {stepNumber}
              </span>
            </div>

            {/* Connector Line */}
            {stepNumber < totalSteps && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2 transition-colors',
                  isPast || isCompleted
                    ? 'bg-success'
                    : 'bg-border'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

