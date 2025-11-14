'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useDeveloperMode } from '@/contexts/developer-mode-context';

interface EntityIdBadgeProps {
  id: string;
  label?: string;
  className?: string;
}

export function EntityIdBadge({ id, label = 'ID', className = '' }: EntityIdBadgeProps) {
  const { isDeveloperMode } = useDeveloperMode();
  const [copied, setCopied] = useState(false);

  // Don't render anything if developer mode is off
  if (!isDeveloperMode) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Truncate long IDs for display
  const truncatedId = id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-elevated border border-border hover:bg-elevated/80 transition-colors group ${className}`}
      title={`${label}: ${id}\nClick to copy`}
      aria-label={`Copy ${label}: ${id}`}
    >
      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className="text-xs font-mono text-foreground">
        {truncatedId}
      </span>
      {copied ? (
        <Check className="h-3 w-3 text-[var(--color-success)]" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}
