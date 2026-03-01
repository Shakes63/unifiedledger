'use client';

import { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhyThisMattersProps {
  title?: string;
  benefits: string[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

export function WhyThisMatters({
  title = 'Why This Matters',
  benefits,
  collapsible = false,
  defaultCollapsed = false,
  className,
}: WhyThisMattersProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  if (benefits.length === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-xl overflow-hidden', className)}
      style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 6%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
      <button
        type="button"
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
        disabled={!collapsible}
        className={cn('w-full flex items-center justify-between px-4 py-3', collapsible && 'cursor-pointer transition-opacity hover:opacity-80', !collapsible && 'cursor-default')}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)' }}>
            <Lightbulb className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
          </div>
          <span className="text-[12px] font-semibold" style={{ color: 'var(--color-primary)' }}>{title}</span>
        </div>
        {collapsible && (
          isCollapsed ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> : <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
        )}
      </button>
      {!isCollapsed && (
        <div className="px-4 pb-3 pt-0 space-y-2">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-2.5">
              <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)' }}>
                <Check className="w-2.5 h-2.5" style={{ color: 'var(--color-success)' }} />
              </div>
              <span className="text-[12px]" style={{ color: 'var(--color-primary)', opacity: 0.85 }}>{benefit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

