'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RetryButtonProps {
  /** Callback function when button is clicked */
  onRetry: () => void;
  /** Show loading state */
  isLoading?: boolean;
  /** Display variant */
  variant?: 'default' | 'icon-only';
  /** Additional className */
  className?: string;
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Disabled state */
  disabled?: boolean;
}

/**
 * RetryButton Component
 * 
 * A reusable retry button with loading state and spinner.
 * 
 * @example
 * ```tsx
 * <RetryButton 
 *   onRetry={() => refetch()} 
 *   isLoading={isLoading}
 * />
 * ```
 */
export function RetryButton({
  onRetry,
  isLoading = false,
  variant = 'default',
  className,
  size = 'sm',
  disabled = false,
}: RetryButtonProps) {
  const handleClick = () => {
    if (!isLoading && !disabled) {
      onRetry();
    }
  };

  if (variant === 'icon-only') {
    return (
      <Button
        onClick={handleClick}
        disabled={isLoading || disabled}
        variant="ghost"
        size="icon"
        className={cn('gap-2', className)}
        aria-label="Retry"
      >
        <RefreshCw
          className={cn(
            'w-4 h-4',
            isLoading && 'animate-spin'
          )}
        />
      </Button>
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading || disabled}
      variant="outline"
      size={size}
      className={cn('gap-2', className)}
      style={{
        borderColor: 'var(--color-border)',
      }}
    >
      <RefreshCw
        className={cn(
          'w-4 h-4',
          isLoading && 'animate-spin'
        )}
      />
      <span>{isLoading ? 'Retrying...' : 'Try Again'}</span>
    </Button>
  );
}

