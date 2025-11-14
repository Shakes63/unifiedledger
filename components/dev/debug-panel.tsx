'use client';

import { useState } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useDeveloperMode } from '@/contexts/developer-mode-context';

interface DebugPanelProps {
  title: string;
  data: Record<string, any>;
  className?: string;
  defaultOpen?: boolean;
}

export function DebugPanel({ title, data, className = '', defaultOpen = false }: DebugPanelProps) {
  const { isDeveloperMode } = useDeveloperMode();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  // Don't render anything if developer mode is off
  if (!isDeveloperMode) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      toast.success('Debug data copied to clipboard');

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Pretty print JSON with syntax highlighting
  const prettyJson = JSON.stringify(data, null, 2);

  return (
    <div className={`border border-border rounded-lg bg-card overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-elevated border-b border-border">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-[var(--color-primary)] transition-colors"
          aria-expanded={isOpen}
          aria-label={`Toggle ${title} debug panel`}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
          <span>{title}</span>
        </button>

        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md hover:bg-card transition-colors"
          title="Copy JSON to clipboard"
          aria-label="Copy JSON to clipboard"
        >
          {copied ? (
            <Check className="h-4 w-4 text-[var(--color-success)]" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Content */}
      {isOpen && (
        <div className="p-4">
          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all overflow-x-auto">
            {prettyJson}
          </pre>
        </div>
      )}
    </div>
  );
}
