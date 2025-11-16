'use client';

import { useEffect } from 'react';
import { useNetworkStatus } from '@/contexts/network-status-context';
import { requestQueue } from '@/lib/utils/request-queue';
import { betterAuthClient } from '@/lib/better-auth-client';

/**
 * RequestQueueProvider Component
 * 
 * Automatically processes queued requests when connection is restored.
 * Integrates with NetworkStatusContext to detect when to process queue.
 */
export function RequestQueueProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, isOnline } = useNetworkStatus();
  const { data: session } = betterAuthClient.useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    // Only process queue when fully connected (online + server available)
    if (!isConnected || !isOnline) {
      return;
    }

    // Process queue when connection is restored
    const processQueue = async () => {
      try {
        const result = await requestQueue.processQueue(userId);
        if (result.processed > 0) {
          console.log(
            `Request queue processed: ${result.succeeded} succeeded, ${result.failed} failed`
          );
        }
      } catch (error) {
        console.error('Failed to process request queue:', error);
      }
    };

    // Small delay to ensure connection is stable
    const timeoutId = setTimeout(processQueue, 1000);

    return () => clearTimeout(timeoutId);
  }, [isConnected, isOnline, userId]);

  return <>{children}</>;
}

