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
  const getColorClass = () => {
    if (duration < 100) return 'text-(--color-success) bg-(--color-success)/10';
    if (duration < 500) return 'text-(--color-warning) bg-(--color-warning)/10';
    return 'text-(--color-error) bg-(--color-error)/10';
  };

  const colorClass = getColorClass();

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border ${colorClass} ${className}`}
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
