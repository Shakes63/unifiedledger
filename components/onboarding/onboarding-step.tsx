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
      <div className="px-6 pt-6 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-foreground)' }}>{title}</h2>
              {isOptional && (
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)', border: '1px solid color-mix(in oklch, var(--color-primary) 25%, transparent)' }}>
                  Optional
                </span>
              )}
            </div>
            <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>{description}</p>
          </div>
          {canSkip && onSkip && (
            <div className="flex flex-col items-end shrink-0">
              <Button variant="ghost" size="sm" onClick={onSkip} disabled={isLoading}
                className="text-[12px] h-7 px-2.5" style={{ color: 'var(--color-muted-foreground)' }}>
                <Clock className="w-3.5 h-3.5 mr-1" />{skipLabel}
              </Button>
              <p className="text-[10px] mt-1 text-right max-w-[160px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>
                Access from dashboard anytime
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 pb-8 min-h-0">{children}</div>

      {/* Footer Actions */}
      {!hideFooter && (
        <div className="px-6 py-4 flex items-center justify-between gap-4 shrink-0" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 50%, transparent)' }}>
          <Button variant="outline" onClick={onPrevious} disabled={isFirstStep || isLoading} className="h-9 text-[13px]">
            <ChevronLeft className="w-4 h-4 mr-1" />{previousLabel || 'Previous'}
          </Button>
          <div className="flex-1" />
          <Button onClick={onNext} disabled={isLoading} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            {nextLabel || (isLastStep ? 'Complete' : 'Next')}
            {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      )}
    </div>
  );
}

