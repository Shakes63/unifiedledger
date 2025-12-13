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
            className={`border-warning text-warning bg-warning/10 ${className}`}
          >
            <Beaker className="w-3 h-3 mr-1" />
            EXPERIMENTAL
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="bg-card border-border">
          <p className="text-xs text-muted-foreground max-w-xs">
            This feature is experimental and may change or be removed in future updates.
            Enable &quot;Experimental Features&quot; in Settings → Advanced to access.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
