'use client';

import { Loader2 } from 'lucide-react';

interface HouseholdLoadingStateProps {
  message?: string;
  className?: string;
}

/**
 * Reusable loading state component for household context initialization
 * Uses semantic theme variables for consistent styling
 */
export function HouseholdLoadingState({ 
  message = 'Loading household data...',
  className = ''
}: HouseholdLoadingStateProps) {
  return (
    <div className={`flex items-center justify-center min-h-[400px] ${className}`}>
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
        <p style={{ color: 'var(--color-muted-foreground)' }}>{message}</p>
      </div>
    </div>
  );
}

