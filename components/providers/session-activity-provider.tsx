'use client';

/**
 * Session Activity Provider
 *
 * Tracks user activity (mouse, keyboard, scroll, click) and pings
 * the server periodically to update session activity timestamp.
 * This prevents automatic logout due to inactivity.
 *
 * Features:
 * - Debounced activity tracking (max 1 ping per minute)
 * - Multiple event listeners for comprehensive activity detection
 * - Automatic cleanup on unmount
 * - Error handling and retry logic
 */

import { useEffect, useRef, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface SessionActivityProviderProps {
  children: ReactNode;
}

const PING_INTERVAL = 60 * 1000; // 1 minute between pings
const ACTIVITY_DEBOUNCE = 30 * 1000; // 30 seconds debounce for activity events

export function SessionActivityProvider({ children }: SessionActivityProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const lastPingRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(0);
  const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Don't run on auth pages
  const isAuthPage = pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up');

  useEffect(() => {
    if (isAuthPage) {
      return;
    }

    /**
     * Pings the server to update session activity
     */
    async function pingServer() {
      const now = Date.now();

      // Check if we're within the ping interval
      if (now - lastPingRef.current < PING_INTERVAL) {
        return;
      }

      // Don't ping if page is hidden (tab not visible)
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      // Don't ping if browser is offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch('/api/session/ping', {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));

          // Session expired or timed out
          if (response.status === 401) {
            const reason = data.reason;

            // Only show toast and redirect if we have a clear reason
            // Otherwise, silently fail (might be a temporary issue)
            if (reason) {
              if (reason === 'inactive') {
                toast.error('Your session has expired due to inactivity');
              } else {
                toast.error('Your session has expired');
              }

              // Redirect to sign-in
              router.push(`/sign-in?reason=${reason}&callbackUrl=${pathname}`);
            } else {
              // Log but don't logout for generic 401s (might be parsing issue)
              if (process.env.NODE_ENV === 'development') {
                console.warn('Session ping returned 401 without reason:', data);
              }
            }
            return;
          }

          // Other error - log but don't logout
          if (process.env.NODE_ENV === 'development') {
            console.error('Session ping failed:', data);
          }
          return;
        }

        // Update last ping time
        lastPingRef.current = now;
      } catch (error) {
        // Network error - silently ignore (user might be temporarily offline)
        // Only log in development mode
        if (process.env.NODE_ENV === 'development') {
          // Check if it's an abort error (timeout)
          if (error instanceof Error && error.name === 'AbortError') {
            console.warn('Session ping timed out');
          } else {
            console.warn('Session ping error:', error);
          }
        }
      }
    }

    /**
     * Handles user activity events
     */
    function handleActivity() {
      const now = Date.now();

      // Debounce activity events
      if (now - lastActivityRef.current < ACTIVITY_DEBOUNCE) {
        return;
      }

      lastActivityRef.current = now;

      // Schedule ping if not already scheduled
      if (!pingTimeoutRef.current) {
        // Ping immediately if it's been more than the interval
        if (now - lastPingRef.current >= PING_INTERVAL) {
          pingServer();
        } else {
          // Schedule ping for later
          const timeUntilNextPing = PING_INTERVAL - (now - lastPingRef.current);
          pingTimeoutRef.current = setTimeout(() => {
            pingServer();
            pingTimeoutRef.current = null;
          }, timeUntilNextPing);
        }
      }
    }

    /**
     * Handles tab visibility changes
     * When tab becomes visible after being hidden, immediately check session status
     * This catches cases where session timed out while tab was in background
     */
    function handleVisibilityChange() {
      if (typeof document !== 'undefined' && !document.hidden) {
        // Tab became visible - immediately ping to check session status
        // Reset last ping time to force an immediate ping
        const now = Date.now();
        const timeSinceLastPing = now - lastPingRef.current;
        
        // Only ping if it's been more than 30 seconds since last ping
        // This prevents excessive pings when rapidly switching tabs
        if (timeSinceLastPing > 30 * 1000) {
          lastPingRef.current = 0; // Reset to force immediate ping
          pingServer();
        }
      }
    }

    // Register activity event listeners
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Register visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial ping on mount
    pingServer();

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });

      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
        pingTimeoutRef.current = null;
      }
    };
  }, [isAuthPage, pathname, router]);

  return <>{children}</>;
}
