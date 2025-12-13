'use client';

import * as React from 'react';
import { AlertCircle, WifiOff, SearchX, Lock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDeveloperMode } from '@/contexts/developer-mode-context';

export type ErrorType = 'network' | 'server' | 'not-found' | 'unauthorized' | 'unknown';

interface ErrorStateProps {
  /** The error object or error message string */
  error: Error | string;
  /** Callback function when retry button is clicked */
  onRetry?: () => void;
  /** Custom title for the error */
  title?: string;
  /** Custom description for the error */
  description?: string;
  /** Show technical details (collapsible) */
  showDetails?: boolean;
  /** Display variant */
  variant?: 'default' | 'inline' | 'fullscreen';
  /** Custom icon (overrides default based on error type) */
  icon?: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Get error type from error object or message
 */
function getErrorType(error: Error | string): ErrorType {
  if (typeof error === 'string') {
    const lower = error.toLowerCase();
    if (lower.includes('network') || lower.includes('fetch') || lower.includes('offline')) {
      return 'network';
    }
    if (lower.includes('404') || lower.includes('not found')) {
      return 'not-found';
    }
    if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('authentication')) {
      return 'unauthorized';
    }
    if (lower.includes('500') || lower.includes('server')) {
      return 'server';
    }
    return 'unknown';
  }

  // Check error message
  const message = error.message?.toLowerCase() || '';
  if (message.includes('network') || message.includes('fetch') || message.includes('offline')) {
    return 'network';
  }
  if (message.includes('404') || message.includes('not found')) {
    return 'not-found';
  }
  if (message.includes('401') || message.includes('unauthorized') || message.includes('authentication')) {
    return 'unauthorized';
  }
  if (message.includes('500') || message.includes('server')) {
    return 'server';
  }

  // Check error name
  if (error.name === 'NetworkError' || error.name === 'TypeError') {
    return 'network';
  }

  return 'unknown';
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: Error | string, errorType: ErrorType): string {
  if (typeof error === 'string') {
    return error;
  }

  switch (errorType) {
    case 'network':
      return 'Connection problem. Please check your internet connection and try again.';
    case 'server':
      return 'Server error. Something went wrong on our end. We\'re working on it.';
    case 'not-found':
      return 'Not found. The requested resource could not be found.';
    case 'unauthorized':
      return 'Authentication required. Please sign in to continue.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Get default icon for error type
 */
function getErrorIcon(errorType: ErrorType): React.ReactNode {
  switch (errorType) {
    case 'network':
      return <WifiOff className="w-5 h-5" />;
    case 'server':
      return <AlertTriangle className="w-5 h-5" />;
    case 'not-found':
      return <SearchX className="w-5 h-5" />;
    case 'unauthorized':
      return <Lock className="w-5 h-5" />;
    default:
      return <AlertCircle className="w-5 h-5" />;
  }
}

/**
 * ErrorState Component
 * 
 * A reusable error display component with user-friendly messages,
 * retry functionality, and optional technical details.
 * 
 * @example
 * ```tsx
 * <ErrorState 
 *   error={error} 
 *   onRetry={() => refetch()} 
 *   title="Failed to load transactions"
 * />
 * ```
 */
export function ErrorState({
  error,
  onRetry,
  title,
  description,
  showDetails = false,
  variant = 'default',
  icon,
  className,
}: ErrorStateProps) {
  const { isDeveloperMode } = useDeveloperMode();
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  
  const errorType = getErrorType(error);
  const errorMessage = getUserFriendlyMessage(error, errorType);
  const errorIcon = icon || getErrorIcon(errorType);
  
  const errorString = typeof error === 'string' ? error : error.message || 'Unknown error';
  const errorStack = typeof error === 'object' && 'stack' in error ? error.stack : undefined;
  const errorName = typeof error === 'object' && 'name' in error ? error.name : undefined;

  const variantClasses = {
    default: 'p-4',
    inline: 'p-3',
    fullscreen: 'p-8 min-h-[400px] flex items-center justify-center',
  };

  const containerClasses = cn(
    'rounded-lg border',
    variantClasses[variant],
    className
  );

  const content = (
    <div className="flex flex-col gap-3">
      {/* Icon and Title */}
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 mt-0.5"
          style={{ color: 'var(--color-error)' }}
        >
          {errorIcon}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h3
              className="font-semibold text-sm mb-1"
              style={{ color: 'var(--color-error)' }}
            >
              {title}
            </h3>
          )}
          <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
            {description || errorMessage}
          </p>
        </div>
      </div>

      {/* Retry Button */}
      {onRetry && (
        <div className="flex items-center gap-2">
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="gap-2"
            style={{
              borderColor: 'var(--color-border)',
            }}
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Technical Details (Dev Mode Only) */}
      {(showDetails || isDeveloperMode) && (errorStack || errorName) && (
        <div className="mt-2">
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {detailsOpen ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            <span>Technical Details</span>
          </button>
          {detailsOpen && (
            <div
              className="mt-2 p-3 rounded-md text-xs font-mono overflow-auto max-h-48"
              style={{
                backgroundColor: 'var(--color-elevated)',
                color: 'var(--color-muted-foreground)',
              }}
            >
              {errorName && (
                <div className="mb-1">
                  <span className="font-semibold">Error:</span> {errorName}
                </div>
              )}
              <div className="mb-1">
                <span className="font-semibold">Message:</span> {errorString}
              </div>
              {errorStack && (
                <div className="mt-2">
                  <span className="font-semibold">Stack:</span>
                  <pre className="mt-1 whitespace-pre-wrap">{errorStack}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (variant === 'fullscreen') {
    return (
      <Card
        className={containerClasses}
        style={{
          borderColor: 'var(--color-error)/30',
          backgroundColor: 'var(--color-error)/10',
        }}
      >
        {content}
      </Card>
    );
  }

  return (
    <div
      className={containerClasses}
      style={{
        borderColor: 'var(--color-error)/30',
        backgroundColor: 'var(--color-error)/10',
      }}
      role="alert"
      aria-live="assertive"
    >
      {content}
    </div>
  );
}

