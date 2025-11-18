# Invited User Onboarding - Remaining Steps Implementation Plan

## Overview
This plan details the implementation of Steps 4-10 for the Invited User Onboarding feature. Steps 1-3 are already complete (invitation context, demo data generator, API endpoint). This plan focuses on integrating invitation detection, demo mode flow, and UI updates throughout the onboarding process.

**Status:** Planning Complete - Ready for Implementation  
**Estimated Time:** 4-6 hours  
**Last Updated:** 2025-01-16

---

## Current State

### ✅ Completed (Steps 1-3)
- **Step 1:** Invitation context added to onboarding context (`contexts/onboarding-context.tsx`)
  - State variables: `isInvitedUser`, `invitationHouseholdId`, `isDemoMode`, `invitationToken`
  - Methods: `setInvitationContext()`, `clearInvitationContext()`
  - localStorage persistence for invitation token and household ID

- **Step 2:** Demo data generation utility (`lib/onboarding/demo-data-generator.ts`)
  - Generates: 3 accounts, 5 categories, 6 merchants, 3 bills, 2 goals, 1 debt, 14 transactions
  - All data prefixed with "Demo" for identification
  - Uses Decimal.js for monetary calculations
  - Properly associates data with household and user

- **Step 3:** Demo data API endpoint (`app/api/onboarding/generate-demo-data/route.ts`)
  - POST endpoint with household validation
  - Returns counts of created items
  - Proper error handling

### ❌ Pending (Steps 4-10)
- **Step 4:** Sign-up page invitation detection
- **Step 5:** Invitation page new user handling
- **Step 6:** Welcome step invitation-specific UI
- **Step 7:** Onboarding steps demo mode handling
- **Step 8:** Demo data creation step component
- **Step 9:** Complete step invitation-specific UI
- **Step 10:** Onboarding modal invitation context initialization

---

## Implementation Steps

### Step 4: Update Sign-Up Page for Invitation Detection
**File:** `app/sign-up/[[...index]]/page.tsx`

**Purpose:** Detect invitation token from URL or localStorage and automatically accept invitation after sign-up, then redirect to onboarding with invitation context.

**Changes:**

1. **Add invitation token detection:**
   - Use `useSearchParams()` to check for `invitation_token` query parameter
   - Check localStorage for `unified-ledger:invitation-token` and `unified-ledger:invitation-household-id`
   - Store token in state if found

2. **Update handleSubmit function:**
   - After successful sign-up and sign-in
   - If invitation token exists:
     - Call `/api/invitations/accept` with token
     - Store invitation context in localStorage (already done by API, but ensure it's there)
     - Redirect to `/dashboard?onboarding=true&invited=true`
   - If no invitation token: Continue with normal redirect to `/dashboard`

3. **Error handling:**
   - If invitation acceptance fails, log error but don't block sign-up
   - User can still proceed with normal onboarding

**Implementation Details:**
```typescript
// Add to component
const searchParams = useSearchParams();
const invitationToken = searchParams.get('invitation_token') || 
  (typeof window !== 'undefined' ? localStorage.getItem('unified-ledger:invitation-token') : null);

// In handleSubmit, after sign-in success:
if (invitationToken) {
  try {
    const acceptResponse = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token: invitationToken }),
    });
    
    if (acceptResponse.ok) {
      const data = await acceptResponse.json();
      // Store household ID in localStorage for onboarding context
      localStorage.setItem('unified-ledger:invitation-household-id', data.householdId);
      // Redirect with invitation flag
      window.location.href = '/dashboard?onboarding=true&invited=true';
      return;
    }
  } catch (error) {
    console.error('Failed to accept invitation:', error);
    // Continue with normal flow
  }
}

// Normal redirect
window.location.href = '/dashboard';
```

**Styling:** No UI changes needed, this is backend logic only.

---

### Step 5: Update Invitation Acceptance Page
**File:** `app/invite/[token]/page.tsx`

**Purpose:** Detect if user is new (hasn't completed onboarding) and handle differently - store invitation context and redirect to onboarding for new users, or switch household for existing users.

**Changes:**

1. **Add onboarding status check:**
   - After fetching invitation, check if user has completed onboarding
   - Call `/api/user/onboarding/status` to check completion status
   - Store result in state

2. **Update handleAccept function:**
   - After accepting invitation successfully:
     - If user hasn't completed onboarding (new user):
       - Store invitation token and household ID in localStorage
       - Redirect to `/dashboard?onboarding=true&invited=true`
     - If user has completed onboarding (existing user):
       - Redirect to `/dashboard` (household will be switched automatically by household context)

3. **Update "Sign in and Accept" button behavior:**
   - When user is not signed in and clicks "Sign in and Accept":
     - Store invitation token in localStorage before redirecting
     - Redirect to `/sign-in?redirect_url=/invite/[token]&invitation_token=[token]`
     - After sign-in, invitation page will detect token and proceed

**Implementation Details:**
```typescript
// Add state
const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

// Check onboarding status after fetching invitation
useEffect(() => {
  if (invitation && isSignedIn) {
    fetch('/api/user/onboarding/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setOnboardingCompleted(data.onboardingCompleted ?? false))
      .catch(() => setOnboardingCompleted(false));
  }
}, [invitation, isSignedIn]);

// Update handleAccept
const handleAccept = async () => {
  if (!isSignedIn) {
    // Store token before redirecting
    localStorage.setItem('unified-ledger:invitation-token', token);
    router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}&invitation_token=${token}`);
    return;
  }

  setAccepting(true);
  setError(null);

  try {
    const response = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to accept invitation');
    }

    const data = await response.json();
    
    // Check if user is new (hasn't completed onboarding)
    if (onboardingCompleted === false) {
      // Store invitation context for onboarding
      localStorage.setItem('unified-ledger:invitation-token', token);
      localStorage.setItem('unified-ledger:invitation-household-id', data.householdId);
      router.push('/dashboard?onboarding=true&invited=true');
    } else {
      // Existing user - just redirect to dashboard
      router.push('/dashboard');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'An error occurred');
    setAccepting(false);
  }
};
```

**Styling:** No UI changes needed, this is logic-only.

---

### Step 6: Update Welcome Step for Invited Users
**File:** `components/onboarding/steps/welcome-step.tsx`

**Purpose:** Show invitation-specific welcome message with household name and explain demo data creation.

**Changes:**

1. **Import onboarding context:**
   - Import `useOnboarding` hook
   - Get `isInvitedUser`, `invitationHouseholdId` from context

2. **Fetch household name:**
   - If `isInvitedUser` is true, fetch household name from API
   - Use `/api/households/[householdId]` endpoint or household context

3. **Conditional rendering:**
   - If invited user:
     - Show: "Welcome to [Household Name]!"
     - Show demo mode banner: "Demo Mode - We'll create practice data so you can explore without affecting real finances"
     - Update description to mention demo data
   - If not invited: Keep existing welcome message

**Implementation Details:**
```typescript
import { useOnboarding } from '@/contexts/onboarding-context';
import { useHousehold } from '@/contexts/household-context';

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const { isInvitedUser, invitationHouseholdId } = useOnboarding();
  const { households } = useHousehold();
  
  // Find household name
  const invitedHousehold = households.find(h => h.id === invitationHouseholdId);
  const householdName = invitedHousehold?.name || 'the household';

  return (
    <OnboardingStep
      stepNumber={1}
      title={isInvitedUser ? `Welcome to ${householdName}!` : "Welcome to Unified Ledger!"}
      description={
        isInvitedUser
          ? "We'll create some demo data so you can practice and explore the app without affecting real household finances."
          : "Let's get you started with a quick tour of the app's core features."
      }
      onNext={onNext}
      onPrevious={() => {}}
      isFirstStep={true}
      nextLabel="Get Started"
    >
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
        {/* Demo Mode Banner */}
        {isInvitedUser && (
          <div className="w-full max-w-md bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg p-4">
            <p className="text-sm text-foreground font-medium">
              🎯 Demo Mode
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              All data created during onboarding will be marked as "Demo" and won't affect real household finances.
            </p>
          </div>
        )}

        {/* Rest of existing content */}
        {/* ... */}
      </div>
    </OnboardingStep>
  );
}
```

**Styling:**
- Use `bg-[var(--color-warning)]/10` for demo mode banner background
- Use `border-[var(--color-warning)]/30` for border
- Use `text-foreground` and `text-muted-foreground` for text colors
- Maintain existing spacing and layout

---

### Step 7: Create Demo Data Creation Step
**File:** `components/onboarding/steps/create-demo-data-step.tsx` (new file)

**Purpose:** Single step that creates all demo data at once for invited users. This step will be inserted between welcome and account steps when in demo mode.

**Implementation:**

1. **Create component structure:**
   - Use `OnboardingStep` wrapper
   - Show loading state during creation
   - Display progress messages
   - Show success summary with counts
   - Auto-advance after completion

2. **Demo data creation logic:**
   - Call `/api/onboarding/generate-demo-data` endpoint
   - Pass `invitationHouseholdId` from context
   - Handle errors gracefully
   - Show progress: "Creating accounts...", "Creating transactions...", etc.

3. **Success display:**
   - Show counts of created items
   - Display success message
   - Auto-advance to next step after 2 seconds

**Implementation Details:**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { OnboardingStep } from '../onboarding-step';
import { useOnboarding } from '@/contexts/onboarding-context';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateDemoDataStepProps {
  onNext: () => void;
  onPrevious: () => void;
}

export function CreateDemoDataStep({ onNext, onPrevious }: CreateDemoDataStepProps) {
  const { invitationHouseholdId } = useOnboarding();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('Initializing...');
  const [result, setResult] = useState<{
    accountsCreated: number;
    categoriesCreated: number;
    billsCreated: number;
    goalsCreated: number;
    debtsCreated: number;
    transactionsCreated: number;
    merchantsCreated: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createDemoData = async () => {
      if (!invitationHouseholdId) {
        setError('Household ID not found');
        setLoading(false);
        return;
      }

      try {
        setProgress('Creating accounts...');
        const response = await fetch('/api/onboarding/generate-demo-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ householdId: invitationHouseholdId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create demo data');
        }

        const data = await response.json();
        setResult(data);
        setProgress('Complete!');
        toast.success('Demo data created successfully');
        
        // Auto-advance after 2 seconds
        setTimeout(() => {
          onNext();
        }, 2000);
      } catch (err) {
        console.error('Failed to create demo data:', err);
        setError(err instanceof Error ? err.message : 'Failed to create demo data');
        toast.error('Failed to create demo data. You can continue anyway.');
        // Still allow user to continue
        setTimeout(() => {
          onNext();
        }, 3000);
      } finally {
        setLoading(false);
      }
    };

    createDemoData();
  }, [invitationHouseholdId, onNext]);

  return (
    <OnboardingStep
      stepNumber={2}
      title="Creating Demo Data"
      description="We're setting up some practice data so you can explore the app."
      onNext={onNext}
      onPrevious={onPrevious}
      isFirstStep={false}
      isLoading={loading}
      nextLabel="Continue"
    >
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
        {loading && (
          <>
            <Loader2 className="w-12 h-12 text-[var(--color-primary)] animate-spin" />
            <p className="text-foreground font-medium">{progress}</p>
          </>
        )}

        {result && !loading && (
          <>
            <div className="w-16 h-16 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
            </div>
            <div className="space-y-4 max-w-md">
              <h3 className="text-lg font-semibold text-foreground">
                Demo Data Created!
              </h3>
              <div className="bg-elevated border border-border rounded-lg p-4 space-y-2 text-left">
                <p className="text-sm font-medium text-foreground mb-3">Created:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {result.accountsCreated} accounts</li>
                  <li>• {result.categoriesCreated} categories</li>
                  <li>• {result.merchantsCreated} merchants</li>
                  <li>• {result.billsCreated} bills</li>
                  <li>• {result.goalsCreated} goals</li>
                  <li>• {result.debtsCreated} debt</li>
                  <li>• {result.transactionsCreated} transactions</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                All demo data is clearly marked and won't affect real household finances.
              </p>
            </div>
          </>
        )}

        {error && !loading && (
          <div className="w-full max-w-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg p-4">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              You can continue with onboarding anyway.
            </p>
          </div>
        )}
      </div>
    </OnboardingStep>
  );
}
```

**Styling:**
- Use semantic theme variables throughout
- Loading spinner: `text-[var(--color-primary)]`
- Success icon: `bg-[var(--color-success)]/20`, `text-[var(--color-success)]`
- Error banner: `bg-[var(--color-error)]/10`, `border-[var(--color-error)]/30`
- Cards: `bg-elevated`, `border-border`
- Text: `text-foreground`, `text-muted-foreground`

---

### Step 8: Update Onboarding Steps for Demo Mode
**Files:**
- `components/onboarding/steps/create-household-step.tsx`
- `components/onboarding/steps/create-account-step.tsx`
- `components/onboarding/steps/create-bill-step.tsx`
- `components/onboarding/steps/create-goal-step.tsx`
- `components/onboarding/steps/create-debt-step.tsx`
- `components/onboarding/steps/create-transaction-step.tsx`

**Purpose:** Skip steps in demo mode since demo data is already created. Show informative message instead.

**Changes for CreateHouseholdStep:**

1. **Check demo mode:**
   - Import `useOnboarding` hook
   - Get `isDemoMode` from context

2. **Skip step if in demo mode:**
   - If `isDemoMode` is true, show message: "Household already exists - you're joining [Household Name]"
   - Auto-advance after 1 second
   - Don't show form

**Implementation Pattern:**
```typescript
import { useOnboarding } from '@/contexts/onboarding-context';
import { useHousehold } from '@/contexts/household-context';

export function CreateHouseholdStep({ onNext, onPrevious, onSkip, canSkip }: CreateHouseholdStepProps) {
  const { isDemoMode, invitationHouseholdId } = useOnboarding();
  const { households } = useHousehold();
  
  const invitedHousehold = households.find(h => h.id === invitationHouseholdId);
  const householdName = invitedHousehold?.name || 'the household';

  useEffect(() => {
    if (isDemoMode) {
      // Auto-advance after showing message
      const timer = setTimeout(() => {
        onNext();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isDemoMode, onNext]);

  if (isDemoMode) {
    return (
      <OnboardingStep
        stepNumber={2}
        title="Household Already Set Up"
        description={`You're joining ${householdName}. Demo data will be created in this household.`}
        onNext={onNext}
        onPrevious={onPrevious}
        isFirstStep={false}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
            <Users className="w-8 h-8 text-[var(--color-primary)]" />
          </div>
          <p className="text-muted-foreground">
            Since you're joining an existing household, we'll skip household creation.
          </p>
        </div>
      </OnboardingStep>
    );
  }

  // Existing form code...
}
```

**Changes for Other Steps (Account, Bill, Goal, Debt, Transaction):**

1. **Check demo mode:**
   - Import `useOnboarding` hook
   - Get `isDemoMode` from context

2. **Skip step if in demo mode:**
   - Show message: "Demo [item type] already created"
   - Auto-advance after 1 second
   - Don't show form

**Implementation Pattern (same for all):**
```typescript
const { isDemoMode } = useOnboarding();

useEffect(() => {
  if (isDemoMode) {
    const timer = setTimeout(() => {
      onNext();
    }, 1500);
    return () => clearTimeout(timer);
  }
}, [isDemoMode, onNext]);

if (isDemoMode) {
  return (
    <OnboardingStep
      stepNumber={X}
      title="Demo [Item Type] Created"
      description="Demo [item type] has been created automatically. You can explore them in the app."
      onNext={onNext}
      onPrevious={onPrevious}
      isFirstStep={false}
    >
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
        </div>
        <p className="text-muted-foreground">
          Demo {itemType} have been created automatically. You can explore them after onboarding.
        </p>
      </div>
    </OnboardingStep>
  );
}

// Existing form code...
```

**Styling:**
- Use semantic theme variables
- Success icon: `bg-[var(--color-success)]/20`, `text-[var(--color-success)]`
- Primary icon: `bg-[var(--color-primary)]/20`, `text-[var(--color-primary)]`
- Text: `text-foreground`, `text-muted-foreground`

---

### Step 9: Update Complete Step for Invited Users
**File:** `components/onboarding/steps/complete-step.tsx`

**Purpose:** Show invitation-specific completion message with demo data summary and helpful tips.

**Changes:**

1. **Import onboarding context:**
   - Import `useOnboarding` hook
   - Get `isInvitedUser`, `invitationHouseholdId` from context
   - Get demo data counts if available (could be passed as prop or stored in context)

2. **Conditional rendering:**
   - If invited user:
     - Show: "Demo Data Created! You can now explore the app with sample data."
     - Show summary of created demo data
     - Add note: "All demo data is clearly marked and won't affect real household finances"
     - Update quick links to be more relevant for exploring demo data
   - If not invited: Keep existing completion message

**Implementation Details:**
```typescript
import { useOnboarding } from '@/contexts/onboarding-context';

export function CompleteStep({ onComplete, onPrevious, isLoading }: CompleteStepProps) {
  const { isInvitedUser, clearInvitationContext } = useOnboarding();

  const handleComplete = async () => {
    // Clear invitation context after completion
    if (isInvitedUser) {
      clearInvitationContext();
    }
    await onComplete();
  };

  return (
    <OnboardingStep
      stepNumber={8}
      title={isInvitedUser ? "Demo Data Created!" : "You're All Set!"}
      description={
        isInvitedUser
          ? "You can now explore the app with sample data. All demo data is clearly marked and won't affect real household finances."
          : "Congratulations! You've completed the onboarding. Here's what you can do next."
      }
      onNext={handleComplete}
      onPrevious={onPrevious}
      isLastStep={true}
      isLoading={isLoading}
      nextLabel="Start Exploring"
    >
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-[var(--color-success)]" />
        </div>

        {isInvitedUser ? (
          <>
            <div className="space-y-4 max-w-md">
              <h3 className="text-xl font-semibold text-foreground">
                Welcome to Unified Ledger!
              </h3>
              <p className="text-muted-foreground">
                Demo data has been created so you can practice and explore the app. All demo items are clearly marked with "Demo" prefix.
              </p>
            </div>

            <div className="bg-elevated border border-border rounded-lg p-4 w-full max-w-md text-left">
              <p className="text-sm font-medium text-foreground mb-2">💡 Tips for Exploring:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Try creating a transaction to see how it works</li>
                <li>Explore the dashboard to see your demo accounts and balances</li>
                <li>Check out bills, goals, and debts in their respective sections</li>
                <li>Demo data won't affect real household finances</li>
              </ul>
            </div>
          </>
        ) : (
          // Existing non-invited user content
          // ...
        )}

        {/* Quick Links */}
        {/* ... existing quick links ... */}
      </div>
    </OnboardingStep>
  );
}
```

**Styling:**
- Use semantic theme variables throughout
- Success icon: `bg-[var(--color-success)]/20`, `text-[var(--color-success)]`
- Cards: `bg-elevated`, `border-border`
- Text: `text-foreground`, `text-muted-foreground`

---

### Step 10: Update Onboarding Modal for Invitation Context
**File:** `components/onboarding/onboarding-modal.tsx`

**Purpose:** Initialize invitation context from URL parameters or localStorage, insert demo data step when in demo mode, and adjust step flow.

**Changes:**

1. **Add URL parameter detection:**
   - Use `useSearchParams()` to check for `invited=true` parameter
   - Check localStorage for invitation token and household ID
   - Initialize invitation context if found

2. **Insert demo data step:**
   - When `isDemoMode` is true, insert `CreateDemoDataStep` as step 2
   - Adjust step numbering accordingly
   - Skip household creation step in demo mode

3. **Update step rendering logic:**
   - Conditionally render demo data step
   - Skip household step if in demo mode
   - Adjust step numbers dynamically

**Implementation Details:**
```typescript
import { useSearchParams } from 'next/navigation';
import { useOnboarding } from '@/contexts/onboarding-context';
import { CreateDemoDataStep } from './steps/create-demo-data-step';
import { useEffect } from 'react';

export function OnboardingModal({ open, onOpenChange }: OnboardingModalProps) {
  const searchParams = useSearchParams();
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
    isDemoMode,
    isInvitedUser,
    setInvitationContext,
  } = useOnboarding();

  // Initialize invitation context from URL or localStorage
  useEffect(() => {
    if (open && !isInvitedUser) {
      const invitedParam = searchParams?.get('invited') === 'true';
      const token = typeof window !== 'undefined' 
        ? localStorage.getItem('unified-ledger:invitation-token') 
        : null;
      const householdId = typeof window !== 'undefined'
        ? localStorage.getItem('unified-ledger:invitation-household-id')
        : null;

      if (invitedParam && token && householdId) {
        setInvitationContext(householdId, token);
      }
    }
  }, [open, searchParams, isInvitedUser, setInvitationContext]);

  // Calculate effective step number (accounting for demo mode)
  const getEffectiveStep = () => {
    if (!isDemoMode) return currentStep;
    
    // In demo mode:
    // Step 1: Welcome
    // Step 2: Demo Data Creation (inserted)
    // Step 3: Skip Household (auto-advance)
    // Step 4: Skip Account (auto-advance)
    // Step 5: Skip Bill (auto-advance)
    // Step 6: Skip Goal (auto-advance)
    // Step 7: Skip Debt (auto-advance)
    // Step 8: Skip Transaction (auto-advance)
    // Step 9: Complete
    
    // Map currentStep to effective step
    if (currentStep === 1) return 1; // Welcome
    if (currentStep === 2) return 2; // Demo Data Creation
    if (currentStep >= 3 && currentStep <= 7) {
      // These steps are auto-advanced, so we show demo data step or skip
      return 2; // Stay on demo data step until it completes
    }
    return currentStep; // Complete step
  };

  const renderStep = () => {
    const effectiveStep = getEffectiveStep();
    
    switch (effectiveStep) {
      case 1:
        return <WelcomeStep onNext={nextStep} />;
      case 2:
        if (isDemoMode) {
          return <CreateDemoDataStep onNext={nextStep} onPrevious={previousStep} />;
        }
        return (
          <CreateHouseholdStep
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={handleSkip}
            canSkip={false}
          />
        );
      case 3:
        if (isDemoMode) {
          // Auto-advance through skipped steps
          return <CreateAccountStep onNext={nextStep} onPrevious={previousStep} onSkip={handleSkip} canSkip={true} />;
        }
        return (
          <CreateAccountStep
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={handleSkip}
            canSkip={true}
          />
        );
      // ... rest of steps
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

  // ... rest of component
}
```

**Alternative Simpler Approach:**

Instead of complex step mapping, we can:
1. Insert demo data step conditionally in the step array
2. Let each step handle its own demo mode logic (auto-advance)
3. Keep step numbering simple

**Simpler Implementation:**
```typescript
const renderStep = () => {
  // Step 1: Always Welcome
  if (currentStep === 1) {
    return <WelcomeStep onNext={nextStep} />;
  }

  // Step 2: Demo Data Creation (if demo mode) or Household Creation
  if (currentStep === 2) {
    if (isDemoMode) {
      return <CreateDemoDataStep onNext={nextStep} onPrevious={previousStep} />;
    }
    return (
      <CreateHouseholdStep
        onNext={nextStep}
        onPrevious={previousStep}
        onSkip={handleSkip}
        canSkip={false}
      />
    );
  }

  // Steps 3-7: Regular steps (they handle demo mode internally)
  if (currentStep === 3) {
    return <CreateAccountStep onNext={nextStep} onPrevious={previousStep} onSkip={handleSkip} canSkip={true} />;
  }
  // ... etc

  // Step 8: Complete
  if (currentStep === 8) {
    return (
      <CompleteStep
        onComplete={handleComplete}
        onPrevious={previousStep}
        isLoading={isLoading}
      />
    );
  }

  return null;
};
```

**Styling:** No UI changes needed, this is logic-only.

---

## Integration Points

### URL Parameters
- `/dashboard?onboarding=true&invited=true` - Triggers onboarding with invitation context
- `/sign-up?invitation_token=[token]` - Sign-up with invitation token
- `/invite/[token]` - Invitation acceptance page

### localStorage Keys
- `unified-ledger:invitation-token` - Stores invitation token
- `unified-ledger:invitation-household-id` - Stores household ID

### API Endpoints
- `POST /api/invitations/accept` - Accept invitation
- `GET /api/invitations/[token]` - Get invitation details
- `GET /api/user/onboarding/status` - Check onboarding completion
- `POST /api/onboarding/generate-demo-data` - Generate demo data

### Context Providers
- `OnboardingProvider` - Manages invitation context
- `HouseholdProvider` - Provides household data

---

## Testing Checklist

### Functionality
- [ ] Invitation token detected in sign-up URL
- [ ] Invitation token stored in localStorage
- [ ] Invitation accepted automatically after sign-up
- [ ] Onboarding context initialized with invitation data
- [ ] Demo mode activated for invited users
- [ ] Demo data step appears in demo mode
- [ ] Household step skipped in demo mode
- [ ] Other steps auto-advance in demo mode
- [ ] Welcome step shows household name for invited users
- [ ] Demo data created successfully
- [ ] Complete step shows demo data summary
- [ ] Invitation context cleared after onboarding
- [ ] Existing users skip onboarding when accepting invitation

### Edge Cases
- [ ] Invalid invitation token handled gracefully
- [ ] Expired invitation token handled gracefully
- [ ] Already accepted invitation handled gracefully
- [ ] Demo data generation fails gracefully
- [ ] Network errors during demo data creation handled
- [ ] User cancels onboarding mid-way
- [ ] Multiple invitation tokens in localStorage handled
- [ ] Missing household ID handled gracefully

### UI/UX
- [ ] Demo mode banner displays correctly
- [ ] Loading states show during demo data creation
- [ ] Error messages are user-friendly
- [ ] All text uses semantic theme variables
- [ ] Mobile responsive design works
- [ ] Keyboard navigation works
- [ ] Screen reader announcements work
- [ ] Step transitions are smooth

---

## Security Considerations

1. **Invitation Token Validation**
   - Tokens validated server-side before acceptance
   - Expired tokens rejected
   - Already accepted tokens rejected

2. **Household Membership**
   - User must be member of household before creating demo data
   - `requireHouseholdAuth()` used for validation

3. **Demo Data Isolation**
   - Demo data only created in invited household
   - Household ID verified before creation

4. **User Authentication**
   - All API calls require authentication
   - User ownership verified

---

## Styling Guidelines

### Always Use Semantic Theme Variables
- **Backgrounds:** `bg-background`, `bg-card`, `bg-elevated`
- **Text:** `text-foreground`, `text-muted-foreground`
- **Borders:** `border-border`
- **Primary:** `bg-[var(--color-primary)]`, `text-[var(--color-primary)]`
- **Success:** `bg-[var(--color-success)]`, `text-[var(--color-success)]`
- **Warning:** `bg-[var(--color-warning)]`, `text-[var(--color-warning)]`
- **Error:** `bg-[var(--color-error)]`, `text-[var(--color-error)]`

### Component Patterns
- Use shadcn/ui components (Card, Button, Dialog, etc.)
- Consistent spacing and typography
- Mobile-first responsive design
- Loading states and error handling

### Demo Mode Indicators
- Use warning color (`var(--color-warning)`) for demo mode banners
- Clearly label all demo data
- Use consistent messaging throughout

---

## Implementation Order

1. **Step 4:** Update Sign-Up Page (30 min)
   - Detect invitation token
   - Accept invitation after sign-up
   - Redirect with invitation flag

2. **Step 5:** Update Invitation Page (30 min)
   - Check onboarding status
   - Handle new vs existing users
   - Store invitation context

3. **Step 6:** Update Welcome Step (30 min)
   - Show invitation-specific welcome
   - Fetch household name
   - Add demo mode banner

4. **Step 7:** Create Demo Data Step (1 hour)
   - Create component
   - Implement data creation logic
   - Add progress and success states

5. **Step 8:** Update Onboarding Steps (1 hour)
   - Add demo mode checks to all steps
   - Implement auto-advance logic
   - Add skip messages

6. **Step 9:** Update Complete Step (30 min)
   - Show invitation-specific completion
   - Add demo data summary
   - Clear invitation context

7. **Step 10:** Update Onboarding Modal (30 min)
   - Initialize invitation context
   - Insert demo data step
   - Adjust step flow

**Total Estimated Time:** 4-6 hours

---

## Notes

- All API calls must include `credentials: 'include'` for cookie-based authentication
- All monetary values must use Decimal.js (already handled in demo data generator)
- All dates should be formatted consistently (use date-fns)
- All error messages should be user-friendly and actionable
- Demo data should be clearly identifiable (use "Demo" prefix - already implemented)
- Invitation context should be cleared after onboarding completion
- Consider adding `isDemo` flag to schema in future (for easier cleanup)

---

## Future Enhancements

1. **Demo Data Cleanup**
   - Add "Clear Demo Data" button in settings
   - Bulk delete all demo data
   - Add confirmation dialog

2. **Demo Data Filtering**
   - Filter demo data from reports
   - Hide demo data in main views (optional)
   - Add toggle to show/hide demo data

3. **Demo Data Customization**
   - Allow users to customize demo data amounts
   - Let users choose which demo data to create
   - Add more demo data options

4. **Demo Data Expiration**
   - Auto-delete demo data after 30 days
   - Prompt users to convert demo data to real data
   - Add demo data expiration notice

5. **Demo Data Conversion**
   - Allow users to convert demo data to real data
   - Remove "Demo" prefix from names
   - Update data flags

