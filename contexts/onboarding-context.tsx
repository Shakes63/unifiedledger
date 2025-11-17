'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { enhancedFetch } from '@/lib/utils/enhanced-fetch';

interface OnboardingContextType {
  isOnboardingActive: boolean;
  currentStep: number;
  totalSteps: number;
  completedSteps: Set<number>;
  skippedSteps: Set<number>;
  isLoading: boolean;
  error: Error | null;
  nextStep: () => void;
  previousStep: () => void;
  skipStep: (step: number) => void;
  goToStep: (step: number) => void;
  completeOnboarding: () => Promise<void>;
  checkOnboardingStatus: () => Promise<void>;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const TOTAL_STEPS = 8; // Welcome, Household, Account, Bill, Goal, Debt, Transaction, Complete

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Check onboarding status on mount
  const checkOnboardingStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await enhancedFetch('/api/user/onboarding/status', {
        credentials: 'include',
        retries: 2,
        timeout: 5000,
      });

      if (response.ok) {
        const data = await response.json();
        // If onboarding is not completed, activate it
        setIsOnboardingActive(!data.onboardingCompleted);
      } else {
        // If error, assume onboarding not completed (safer default)
        setIsOnboardingActive(true);
      }
    } catch (err) {
      console.error('Failed to check onboarding status:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // On error, assume onboarding not completed (safer default)
      setIsOnboardingActive(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark onboarding as complete
  const completeOnboarding = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await enhancedFetch('/api/user/onboarding/complete', {
        method: 'POST',
        credentials: 'include',
        retries: 2,
        timeout: 5000,
      });

      if (response.ok) {
        setIsOnboardingActive(false);
        setCurrentStep(TOTAL_STEPS);
        setCompletedSteps(new Set([...Array(TOTAL_STEPS).keys()].map(i => i + 1)));
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to complete onboarding');
      }
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Navigation functions
  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.min(prev + 1, TOTAL_STEPS);
      setCompletedSteps((completed) => new Set([...completed, prev]));
      return next;
    });
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const skipStep = useCallback((step: number) => {
    setSkippedSteps((skipped) => new Set([...skipped, step]));
    // If skipping current step, advance to next
    if (step === currentStep) {
      nextStep();
    }
  }, [currentStep, nextStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step);
    }
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setSkippedSteps(new Set());
    setError(null);
  }, []);

  // Check onboarding status on mount
  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingActive,
        currentStep,
        totalSteps: TOTAL_STEPS,
        completedSteps,
        skippedSteps,
        isLoading,
        error,
        nextStep,
        previousStep,
        skipStep,
        goToStep,
        completeOnboarding,
        checkOnboardingStatus,
        reset,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

