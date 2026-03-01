'use client';

import { useState } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useDeveloperMode } from '@/contexts/developer-mode-context';

interface DebugPanelProps {
  title: string;
  data: Record<string, unknown>;
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
    <div className={`rounded-lg overflow-hidden ${className}`}
    style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
        <div className="flex items-center justify-between p-3 border-b" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: 'var(--color-foreground)' }}
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
          className="p-1.5 rounded-md transition-colors"
          title="Copy JSON to clipboard"
          aria-label="Copy JSON to clipboard"
        >
          {copied ? (
            <Check className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
          ) : (
            <Copy className="h-4 w-4" style={{ color: 'var(--color-muted-foreground)' }} />
          )}
        </button>
      </div>

      {/* Content */}
      {isOpen && (
        <div className="p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-x-auto" style={{ color: 'var(--color-foreground)' }}>
            {prettyJson}
          </pre>
        </div>
      )}
    </div>
  );
}
