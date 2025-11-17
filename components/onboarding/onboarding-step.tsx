'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export function OnboardingStep({
  stepNumber,
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
}: OnboardingStepProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          {canSkip && onSkip && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

      {/* Footer Actions */}
      {!hideFooter && (
        <div className="px-6 py-4 border-t border-border bg-elevated/50 flex items-center justify-between gap-4">
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

