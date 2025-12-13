'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * TestModeBadge Component
 *
 * Displays a compact badge in the sidebar when test mode is enabled.
 * Shows a warning icon and "TEST" text with a tooltip explaining the mode.
 */
export function TestModeBadge() {
  const [isTestMode, setIsTestMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTestMode = async () => {
      try {
        const response = await fetch('/api/test-mode/init', {
          method: 'GET',
        });
        if (response.ok) {
          const data = await response.json();
          setIsTestMode(data.testMode === true);
        }
      } catch {
        setIsTestMode(false);
      } finally {
        setLoading(false);
      }
    };

    checkTestMode();
  }, []);

  if (loading || !isTestMode) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="bg-warning/20 text-warning border-warning/30 text-[10px] px-1.5 py-0.5 flex items-center gap-1 cursor-help"
          >
            <AlertTriangle className="w-3 h-3" />
            TEST
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">
            <strong>Test Mode Active</strong>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Authentication is disabled. Set TEST_MODE=false to disable.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact version for collapsed sidebar
 */
export function TestModeBadgeCompact() {
  const [isTestMode, setIsTestMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTestMode = async () => {
      try {
        const response = await fetch('/api/test-mode/init', {
          method: 'GET',
        });
        if (response.ok) {
          const data = await response.json();
          setIsTestMode(data.testMode === true);
        }
      } catch {
        setIsTestMode(false);
      } finally {
        setLoading(false);
      }
    };

    checkTestMode();
  }, []);

  if (loading || !isTestMode) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="bg-warning/20 text-warning border-warning/30 text-[8px] px-1 py-0 flex items-center justify-center cursor-help"
          >
            <AlertTriangle className="w-2.5 h-2.5" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-sm">
            <strong>Test Mode Active</strong>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Authentication is disabled.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
















