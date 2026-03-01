'use client';

import { Badge } from '@/components/ui/badge';
import { Beaker } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ExperimentalBadgeProps {
  /**
   * Optional additional CSS classes to apply to the badge
   */
  className?: string;
}

/**
 * ExperimentalBadge Component
 *
 * Visual indicator for experimental features throughout the app.
 * Shows a badge with a beaker icon and "EXPERIMENTAL" text in warning colors.
 * Includes a tooltip explaining that the feature is experimental.
 *
 * @example
 * ```tsx
 * <ExperimentalBadge />
 * ```
 *
 * @example
 * ```tsx
 * <ExperimentalBadge className="ml-2" />
 * ```
 */
export function ExperimentalBadge({ className = '' }: ExperimentalBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)', backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)' }}
            className={`border ${className}`}
          >
            <Beaker className="w-3 h-3 mr-1" />
            EXPERIMENTAL
          </Badge>
        </TooltipTrigger>
        <TooltipContent style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }} className="border">
          <p className="text-xs max-w-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            This feature is experimental and may change or be removed in future updates.
            Enable &quot;Experimental Features&quot; in Settings → Advanced to access.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
