'use client';

import { Clock } from 'lucide-react';
import { useDeveloperMode } from '@/contexts/developer-mode-context';

interface ApiTimingBadgeProps {
  startTime: number;
  endTime: number;
  endpoint: string;
  className?: string;
}

export function ApiTimingBadge({ startTime, endTime, endpoint, className = '' }: ApiTimingBadgeProps) {
  const { isDeveloperMode } = useDeveloperMode();

  // Don't render anything if developer mode is off
  if (!isDeveloperMode) return null;

  const duration = endTime - startTime;

  // Color code based on performance
  const getColorStyle = () => {
    if (duration < 100) return { color: 'var(--color-success)', backgroundColor: 'color-mix(in oklch, var(--color-success) 10%, transparent)' };
    if (duration < 500) return { color: 'var(--color-warning)', backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)' };
    return { color: 'var(--color-destructive)', backgroundColor: 'color-mix(in oklch, var(--color-destructive) 10%, transparent)' };
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${className}`}
      style={{ borderColor: 'var(--color-border)', ...getColorStyle() }}
      title={`API: ${endpoint}\nDuration: ${duration}ms`}
      aria-label={`API timing: ${duration}ms for ${endpoint}`}
    >
      <Clock className="h-3 w-3" />
      <span className="text-xs font-mono font-medium">
        {duration}ms
      </span>
    </div>
  );
}
