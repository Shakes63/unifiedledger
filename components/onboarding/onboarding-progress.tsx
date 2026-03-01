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
    <div className="flex items-center w-full px-4 py-4">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNumber = i + 1;
        const isCompleted = completedSteps.has(stepNumber);
        const isSkipped = skippedSteps.has(stepNumber);
        const isCurrent = stepNumber === currentStep;
        const isPast = stepNumber < currentStep;

        const circleBg = isCompleted ? 'var(--color-success)' : isSkipped ? 'color-mix(in oklch, var(--color-warning) 15%, transparent)' : isCurrent ? 'var(--color-primary)' : 'var(--color-elevated)';
        const circleBorder = isCompleted ? 'var(--color-success)' : isSkipped ? 'var(--color-warning)' : isCurrent ? 'var(--color-primary)' : 'var(--color-border)';
        const circleColor = (isCompleted || isCurrent) ? 'var(--color-primary-foreground)' : isSkipped ? 'var(--color-warning)' : 'var(--color-muted-foreground)';

        return (
          <div key={stepNumber} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={cn('flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all')}
                style={{ backgroundColor: circleBg, borderColor: circleBorder, color: circleColor }}>
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : <span className="text-[11px] font-bold">{stepNumber}</span>}
              </div>
              <span className={cn('mt-1.5 text-[10px] text-center hidden sm:block')}
                style={{ color: isCurrent ? 'var(--color-foreground)' : 'var(--color-muted-foreground)', fontWeight: isCurrent ? 600 : 400 }}>
                Step {stepNumber}
              </span>
            </div>
            {stepNumber < totalSteps && (
              <div className="h-px flex-1 mx-1.5 transition-colors"
                style={{ backgroundColor: isPast || isCompleted ? 'var(--color-success)' : 'var(--color-border)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

