'use client';

import { useState, useEffect, useRef } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useHousehold } from '@/contexts/household-context';
import { useOnboarding } from '@/contexts/onboarding-context';
import { Users } from 'lucide-react';
import { WhyThisMatters } from '../why-this-matters';

interface CreateHouseholdStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  canSkip: boolean;
}

export function CreateHouseholdStep({
  onNext,
  onPrevious,
  onSkip,
  canSkip,
}: CreateHouseholdStepProps) {
  const { isDemoMode, invitationHouseholdId } = useOnboarding();
  const { households } = useHousehold();
  const [householdName, setHouseholdName] = useState('My Household');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refreshHouseholds, setSelectedHouseholdId } = useHousehold();
  const hasAutoAdvancedRef = useRef(false);

  // Find household name
  const invitedHousehold = households.find(h => h.id === invitationHouseholdId);
  const householdNameDisplay = invitedHousehold?.name || 'the household';

  // Auto-advance if in demo mode (household already exists)
  useEffect(() => {
    if (isDemoMode) {
      const timer = setTimeout(() => {
        onNext();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isDemoMode, onNext]);

  // If a household already exists (e.g., refresh after creating one), skip creation.
  useEffect(() => {
    if (isDemoMode || hasAutoAdvancedRef.current || households.length === 0) {
      return;
    }

    hasAutoAdvancedRef.current = true;
    void (async () => {
      try {
        await setSelectedHouseholdId(households[0].id);
      } catch {
        // Selection failure should not block onboarding progression
      }
      onNext();
    })();
  }, [households, isDemoMode, onNext, setSelectedHouseholdId]);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    // Guard against duplicate first-household creation on refresh/retry.
    if (households.length > 0) {
      try {
        await setSelectedHouseholdId(households[0].id);
      } catch {
        // Ignore selection errors and still advance
      }
      onNext();
      return;
    }

    if (!householdName.trim()) {
      toast.error('Household name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: householdName.trim() }),
      });

      if (response.ok) {
        const newHousehold = await response.json();
        toast.success('Household created successfully');
        
        // Refresh households and select the new one
        await refreshHouseholds();
        if (newHousehold.id) {
          await setSelectedHouseholdId(newHousehold.id);
        }
        
        // Move to next step
        onNext();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create household');
      }
    } catch (error) {
      console.error('Error creating household:', error);
      toast.error('Failed to create household');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDemoMode) {
    return (
      <OnboardingStep
        stepNumber={2}
        title="Household Already Set Up"
        description={`You're joining ${householdNameDisplay}. Demo data will be created in this household.`}
        onNext={onNext}
        onPrevious={onPrevious}
        isFirstStep={false}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
            <Users className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
          </div>
          <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>
            Since you&apos;re joining an existing household, we&apos;ll skip household creation.
          </p>
        </div>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      stepNumber={2}
      title="Create Your First Household"
      description="Keep finances separate or share with family — role-based permissions control who can view, edit, and manage your data."
      onNext={handleSubmit}
      onPrevious={onPrevious}
      onSkip={canSkip ? onSkip : undefined}
      canSkip={canSkip}
      isLoading={isSubmitting}
      isFirstStep={false}
    >
      <div className="space-y-5">
        <div className="flex items-center justify-center py-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
            <Users className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
          </div>
        </div>
        <div>
          <Label htmlFor="household-name" className="text-[11px] font-medium uppercase tracking-wide block mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
            Household Name
          </Label>
          <Input
            id="household-name"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder="e.g., My Household, Family Budget…"
            className="h-9 text-[13px]"
            style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && !isSubmitting) handleSubmit(); }}
          />
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>
            You can change this name later in settings.
          </p>
        </div>
        <WhyThisMatters
          benefits={[
            'Share finances with family members and invite collaborators',
            'Keep personal and business finances completely separate',
            'Real-time activity feed shows what everyone is doing',
            'Role-based permissions control who can view and edit',
          ]}
        />
      </div>
    </OnboardingStep>
  );
}

