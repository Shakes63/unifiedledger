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
    <div className="mb-6">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all hover:bg-[var(--color-elevated)] group"
        style={{
          backgroundColor: 'var(--color-background)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div
          className="w-1 h-5 rounded-full transition-colors duration-300"
          style={{
            backgroundColor: isExpanded ? 'var(--color-primary)' : 'var(--color-border)',
          }}
        />
        <h2 className="text-base font-semibold flex-1 text-left" style={{ color: 'var(--color-foreground)' }}>
          {title}
        </h2>
        <ChevronDown
          className="w-4 h-4 transition-transform duration-300"
          style={{ color: 'var(--color-muted-foreground)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: isExpanded ? '2000px' : '0',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}
