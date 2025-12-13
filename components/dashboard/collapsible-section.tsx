'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  storageKey: string;
}

export function CollapsibleSection({
  title,
  children,
  defaultExpanded = false,
  storageKey,
}: CollapsibleSectionProps) {
  // Initialize from localStorage when available (hydration-safe)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultExpanded;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved !== null) return saved === 'true';
    } catch {
      // Ignore localStorage access errors
    }
    return defaultExpanded;
  });

  // Save state to localStorage when it changes
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(isExpanded));
    } catch {
      // Ignore localStorage access errors
    }
  }, [isExpanded, storageKey]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between p-4 rounded-xl border transition-all hover:bg-elevated"
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'var(--color-border)',
        }}
      >
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <div
          className="transition-transform duration-300"
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </div>
      </button>

      {/* Content */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: isExpanded ? '2000px' : '0',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div className="pt-4">
          {children}
        </div>
      </div>
    </div>
  );
}
