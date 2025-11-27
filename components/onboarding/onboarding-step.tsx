'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface OnboardingStepProps {
  stepNumber: number;
  title: string;
  description: string;
  children: React.ReactNode;
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  canSkip?: boolean;
  isLoading?: boolean;
  isFirstStep?: boolean;
  isLastStep?: boolean;
  nextLabel?: string;
  previousLabel?: string;
  hideFooter?: boolean;
  skipLabel?: string;
  isOptional?: boolean;
}

export function OnboardingStep({
  stepNumber: _stepNumber,
  title,
  description,
  children,
  onNext,
  onPrevious,
  onSkip,
  canSkip = false,
  isLoading = false,
  isFirstStep = false,
  isLastStep = false,
  nextLabel,
  previousLabel,
  hideFooter = false,
  skipLabel = 'Set Up Later',
  isOptional = false,
}: OnboardingStepProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-foreground">{title}</h2>
              {isOptional && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                  Optional
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          {canSkip && onSkip && (
            <div className="flex flex-col items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                disabled={isLoading}
                className="text-muted-foreground hover:text-foreground"
              >
                <Clock className="w-4 h-4 mr-1" />
                {skipLabel}
              </Button>
              <p className="text-xs text-muted-foreground mt-1 text-right max-w-[180px]">
                Access from dashboard menu anytime
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-8 min-h-0">{children}</div>

      {/* Footer Actions */}
      {!hideFooter && (
        <div className="px-6 py-4 border-t border-border bg-elevated/50 flex items-center justify-between gap-4 flex-shrink-0">
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={isFirstStep || isLoading}
            className="border-border text-foreground hover:bg-elevated"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {previousLabel || 'Previous'}
          </Button>

          <div className="flex-1" />

          <Button
            onClick={onNext}
            disabled={isLoading}
            className="bg-[var(--color-primary)] text-background hover:opacity-90"
          >
            {nextLabel || (isLastStep ? 'Complete' : 'Next')}
            {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      )}
    </div>
  );
}

