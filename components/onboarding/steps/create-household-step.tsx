'use client';

import { useState, useEffect } from 'react';
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

  const handleSubmit = async () => {
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

  // Show skip message if in demo mode
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
          <div className="w-16 h-16 rounded-full bg-(--color-primary)/20 flex items-center justify-center">
            <Users className="w-8 h-8 text-(--color-primary)" />
          </div>
          <p className="text-muted-foreground">
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
      description="Keep finances separate or share with family - role-based permissions control who can view, edit, and manage your data."
      onNext={handleSubmit}
      onPrevious={onPrevious}
      onSkip={canSkip ? onSkip : undefined}
      canSkip={canSkip}
      isLoading={isSubmitting}
      isFirstStep={false}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-center py-4">
          <div className="w-16 h-16 rounded-full bg-(--color-primary)/20 flex items-center justify-center">
            <Users className="w-8 h-8 text-(--color-primary)" />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="household-name" className="text-foreground mb-2 block">
              Household Name
            </Label>
            <Input
              id="household-name"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="e.g., My Household, Family Budget, etc."
              className="bg-elevated border-border text-foreground"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitting) {
                  handleSubmit();
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
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
      </div>
    </OnboardingStep>
  );
}

