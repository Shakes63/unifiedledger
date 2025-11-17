'use client';

import { useState } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useHousehold } from '@/contexts/household-context';
import { Users } from 'lucide-react';

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
  const [householdName, setHouseholdName] = useState('My Household');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refreshHouseholds, setSelectedHouseholdId } = useHousehold();

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

  return (
    <OnboardingStep
      stepNumber={2}
      title="Create Your First Household"
      description="A household helps you organize your finances. You can create multiple households for different purposes (personal, business, etc.)."
      onNext={handleSubmit}
      onPrevious={onPrevious}
      onSkip={canSkip ? onSkip : undefined}
      canSkip={canSkip}
      isLoading={isSubmitting}
      isFirstStep={false}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-center py-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
            <Users className="w-8 h-8 text-[var(--color-primary)]" />
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

          <div className="bg-elevated border border-border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">What is a household?</p>
            <p className="text-sm text-muted-foreground">
              A household is a collection of accounts, transactions, bills, and budgets. You can
              invite family members or collaborators to share a household, or keep it private for
              personal use.
            </p>
          </div>
        </div>
      </div>
    </OnboardingStep>
  );
}

