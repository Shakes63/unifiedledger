'use client';

import * as React from 'react';
import { X, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNetworkStatus } from '@/contexts/network-status-context';
import { requestQueue } from '@/lib/utils/request-queue';
import { betterAuthClient } from '@/lib/better-auth-client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  /** Additional className */
  className?: string;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
}

const DISMISS_STORAGE_KEY = 'offline-banner-dismissed';
const DISMISS_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * OfflineBanner Component
 * 
 * A prominent banner that displays network status at the top of the viewport.
 * Shows offline status, server availability, and pending request queue.
 * 
 * @example
 * ```tsx
 * <OfflineBanner onRetry={() => refetch()} queueCount={5} />
 * ```
 */
export function OfflineBanner({
  className,
  onRetry,
}: OfflineBannerProps) {
  // Track if component has mounted on client (prevents hydration mismatch)
  const [mounted, setMounted] = React.useState(false);
  const { isOnline, isServerAvailable, isConnected, checkServerHealth } = useNetworkStatus();
  const { data: session } = betterAuthClient.useSession();
  const userId = session?.user?.id;
  const [dismissed, setDismissed] = React.useState(false);
  const [dismissTime, setDismissTime] = React.useState<number | null>(null);
  const [queueCount, setQueueCount] = React.useState(0);
  const [isSyncing, setIsSyncing] = React.useState(false);

  // Set mounted to true after component mounts on client
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Update queue count periodically (only after mount)
  React.useEffect(() => {
    if (!mounted || !userId) return;

    const updateQueueCount = async () => {
      try {
        const count = await requestQueue.getPendingCount(userId);
        setQueueCount(count);
      } catch (error) {
        console.error('Failed to get queue count:', error);
      }
    };

    // Initial count
    updateQueueCount();

    // Update every 5 seconds
    const interval = setInterval(updateQueueCount, 5000);

    return () => clearInterval(interval);
  }, [mounted, userId]);

  // Check if banner was dismissed (only after mount, when localStorage is available)
  React.useEffect(() => {
    if (!mounted) return;

    const dismissedData = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (dismissedData) {
      const dismissedAt = parseInt(dismissedData, 10);
      const now = Date.now();
      const timeSinceDismiss = now - dismissedAt;

      if (timeSinceDismiss < DISMISS_DURATION) {
        setDismissed(true);
        setDismissTime(dismissedAt);
      } else {
        // Dismissal expired, clear it
        localStorage.removeItem(DISMISS_STORAGE_KEY);
      }
    }
  }, [mounted]);

  // Auto-show banner when going offline (even if dismissed)
  React.useEffect(() => {
    if (!isOnline || !isServerAvailable) {
      setDismissed(false);
    }
  }, [isOnline, isServerAvailable]);

  // Add padding to body when banner is visible (only after mount)
  React.useEffect(() => {
    if (!mounted) return;

    const shouldShow = !(isConnected && queueCount === 0 && !isSyncing) && 
                      !(dismissed && isOnline && isServerAvailable);
    
    if (shouldShow && typeof document !== 'undefined') {
      document.body.style.paddingTop = '49px'; // Banner height (py-3 = 12px top + 12px bottom + ~25px content)
    } else if (typeof document !== 'undefined') {
      document.body.style.paddingTop = '';
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.paddingTop = '';
      }
    };
  }, [mounted, isConnected, queueCount, isSyncing, dismissed, isOnline, isServerAvailable]);

  // Don't render anything during SSR or initial client render (prevents hydration mismatch)
  // IMPORTANT: This must come AFTER all hooks to follow Rules of Hooks
  if (!mounted) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
  };

  const handleRetry = async () => {
    if (onRetry) {
      onRetry();
      return;
    }

    // Default: process request queue
    if (queueCount > 0 && isConnected) {
      setIsSyncing(true);
      try {
        await requestQueue.processQueue(userId);
        // Update count after processing
        const newCount = await requestQueue.getPendingCount(userId);
        setQueueCount(newCount);
      } catch (error) {
        console.error('Failed to process queue:', error);
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Trigger server health check
      await checkServerHealth();
    }
  };

  // Don't show if connected and no pending requests
  if (isConnected && queueCount === 0 && !isSyncing) {
    return null;
  }

  // Don't show if dismissed (unless offline)
  if (dismissed && isOnline && isServerAvailable) {
    return null;
  }

  // Determine banner state and content
  let bannerState: 'offline' | 'server-unavailable' | 'syncing' | 'pending';
  let icon: React.ReactNode;
  let message: string;
  let showRetry = false;

  if (isSyncing) {
    bannerState = 'syncing';
    icon = <RefreshCw className="w-4 h-4 animate-spin" />;
    message = 'Syncing pending changes...';
    showRetry = false;
  } else if (!isOnline) {
    bannerState = 'offline';
    icon = <WifiOff className="w-4 h-4" />;
    message = queueCount > 0
      ? `${queueCount} request${queueCount !== 1 ? 's' : ''} queued. They'll sync when connection is restored.`
      : "You're offline. Changes will sync when connection is restored.";
    showRetry = false;
  } else if (!isServerAvailable) {
    bannerState = 'server-unavailable';
    icon = <AlertCircle className="w-4 h-4" />;
    message = 'Server is unavailable. Some features may not work correctly.';
    showRetry = true;
  } else if (queueCount > 0) {
    bannerState = 'pending';
    icon = <RefreshCw className="w-4 h-4" />;
    message = `${queueCount} request${queueCount !== 1 ? 's' : ''} queued. They'll sync automatically.`;
    showRetry = true;
  } else {
    // Shouldn't reach here, but handle gracefully
    return null;
  }

  const bannerColor = bannerState === 'syncing' || bannerState === 'pending'
    ? 'var(--color-primary)'
    : 'var(--color-warning)';

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 px-4 py-3 border-b',
        'flex items-center justify-between gap-3',
        'transition-all duration-200',
        className
      )}
      style={{
        backgroundColor: bannerColor,
        borderColor: 'var(--color-border)',
        color: 'var(--color-background)',
      }}
      role="alert"
      aria-live="polite"
    >
      {/* Left side: Icon and message */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <p className="text-sm font-medium truncate">
          {message}
        </p>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {showRetry && (
          <Button
            onClick={handleRetry}
            disabled={isSyncing}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-medium hover:bg-black/20"
            style={{
              color: 'var(--color-background)',
            }}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Syncing...
              </>
            ) : (
              'Retry Now'
            )}
          </Button>
        )}
        
        {/* Dismiss button */}
        {bannerState !== 'syncing' && (
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-black/20 transition-colors"
            aria-label="Dismiss banner"
            style={{
              color: 'var(--color-background)',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

