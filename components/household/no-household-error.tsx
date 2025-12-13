'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface NoHouseholdErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Reusable error component for when no household is selected
 * Uses semantic theme variables for consistent styling
 */
export function NoHouseholdError({ 
  message = 'Please select a household to continue.',
  onRetry,
  className = ''
}: NoHouseholdErrorProps) {
  return (
    <div className={`flex items-center justify-center min-h-[400px] ${className}`}>
      <Card className="max-w-md">
        <CardContent className="p-6 text-center">
          <p className="text-foreground mb-4 font-medium">No household selected</p>
          <p className="text-muted-foreground text-sm mb-4">
            {message}
          </p>
          {onRetry && (
            <Button 
              onClick={onRetry}
              className="bg-primary hover:bg-primary/90"
            >
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

