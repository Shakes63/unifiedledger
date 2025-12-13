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
    <div
      className={cn(
        'bg-(--color-primary)/10 border border-(--color-primary)/30 rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
        disabled={!collapsible}
        className={cn(
          'w-full flex items-center justify-between p-4',
          collapsible && 'cursor-pointer hover:bg-(--color-primary)/5 transition-colors',
          !collapsible && 'cursor-default'
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-(--color-primary)/20 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-4 h-4 text-(--color-primary)" />
          </div>
          <span className="font-medium text-foreground">{title}</span>
        </div>
        {collapsible && (
          <div className="text-muted-foreground">
            {isCollapsed ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronUp className="w-5 h-5" />
            )}
          </div>
        )}
      </button>

      {/* Benefits List */}
      {!isCollapsed && (
        <div className="px-4 pb-4 pt-0 space-y-2">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-(--color-success)/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-(--color-success)" />
              </div>
              <span className="text-sm text-muted-foreground">{benefit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

