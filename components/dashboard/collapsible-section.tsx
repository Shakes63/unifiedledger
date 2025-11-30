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
  // Initialize with default - hydration safe (no localStorage read during SSR)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [hasMounted, setHasMounted] = useState(false);

  // Load saved state from localStorage after mount (hydration-safe)
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      setIsExpanded(saved === 'true');
    }
    setHasMounted(true);
  }, [storageKey]);

  // Save state to localStorage when it changes (only after mount)
  useEffect(() => {
    if (hasMounted) {
      localStorage.setItem(storageKey, String(isExpanded));
    }
  }, [isExpanded, storageKey, hasMounted]);

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
