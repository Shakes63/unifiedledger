'use client';

/**
 * Network Status Context
 *
 * Provides real-time network connectivity status and server availability
 * to all components in the application.
 *
 * Features:
 * - Browser online/offline detection (navigator.onLine)
 * - Periodic server health checks
 * - Automatic toast notifications on status changes
 * - Connection quality monitoring
 * - Configurable health check interval
 *
 * Usage:
 * ```typescript
 * import { useNetworkStatus } from '@/contexts/network-status-context';
 *
 * function MyComponent() {
 *   const { isOnline, isServerAvailable, connectionQuality } = useNetworkStatus();
 *
 *   if (!isOnline) {
 *     return <div>You are offline</div>;
 *   }
 *
 *   if (!isServerAvailable) {
 *     return <div>Server is unavailable</div>;
 *   }
 *
 *   return <div>All systems operational</div>;
 * }
 * ```
 */

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { toast } from 'sonner';

/**
 * Connection quality levels
 */
export enum ConnectionQuality {
  /** Excellent connection (<100ms response time) */
  EXCELLENT = 'excellent',
  /** Good connection (100-300ms response time) */
  GOOD = 'good',
  /** Fair connection (300-1000ms response time) */
  FAIR = 'fair',
  /** Poor connection (>1000ms response time) */
  POOR = 'poor',
  /** Unknown (not yet measured) */
  UNKNOWN = 'unknown',
}

/**
 * Network status context type
 */
interface NetworkStatusContextType {
  /** Browser online status (navigator.onLine) */
  isOnline: boolean;
  /** Server availability status (from health check) */
  isServerAvailable: boolean;
  /** Overall connection status (both online and server available) */
  isConnected: boolean;
  /** Connection quality based on response time */
  connectionQuality: ConnectionQuality;
  /** Last successful health check timestamp */
  lastHealthCheckTime: number | null;
  /** Manually trigger health check */
  checkServerHealth: () => Promise<void>;
  /** Current response time in ms */
  responseTime: number | null;
}

const NetworkStatusContext = createContext<NetworkStatusContextType | undefined>(undefined);

/**
 * Network Status Provider Props
 */
interface NetworkStatusProviderProps {
  children: ReactNode;
  /** Health check interval in ms (default: 30000 - 30 seconds) */
  healthCheckInterval?: number;
  /** Enable toast notifications on status changes (default: true) */
  showNotifications?: boolean;
  /** Health check endpoint (default: /api/health) */
  healthCheckEndpoint?: string;
}

/**
 * Determine connection quality from response time
 */
function getConnectionQuality(responseTime: number): ConnectionQuality {
  if (responseTime < 100) return ConnectionQuality.EXCELLENT;
  if (responseTime < 300) return ConnectionQuality.GOOD;
  if (responseTime < 1000) return ConnectionQuality.FAIR;
  return ConnectionQuality.POOR;
}

/**
 * Network Status Provider
 * Wraps the application to provide network status to all components
 */
export function NetworkStatusProvider({
  children,
  healthCheckInterval = 30000, // 30 seconds
  showNotifications = true,
  healthCheckEndpoint = '/api/health',
}: NetworkStatusProviderProps) {
  // Browser online/offline status
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Server availability status
  const [isServerAvailable, setIsServerAvailable] = useState<boolean>(true);

  // Connection quality
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    ConnectionQuality.UNKNOWN
  );

  // Last health check time
  const [lastHealthCheckTime, setLastHealthCheckTime] = useState<number | null>(null);

  // Current response time
  const [responseTime, setResponseTime] = useState<number | null>(null);

  // Refs for cleanup and tracking
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousOnlineStatusRef = useRef<boolean>(isOnline);
  const previousServerStatusRef = useRef<boolean>(isServerAvailable);
  const isCheckingRef = useRef<boolean>(false);

  /**
   * Perform server health check
   */
  const checkServerHealth = async (): Promise<void> => {
    // Prevent concurrent health checks
    if (isCheckingRef.current) {
      return;
    }

    // Don't check if browser is offline
    if (!isOnline) {
      setIsServerAvailable(false);
      setConnectionQuality(ConnectionQuality.UNKNOWN);
      return;
    }

    isCheckingRef.current = true;

    try {
      const startTime = performance.now();

      // Perform health check with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(healthCheckEndpoint, {
        method: 'GET',
        signal: controller.signal,
        credentials: 'include',
        cache: 'no-store', // Don't cache health checks
      });

      clearTimeout(timeoutId);

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      // Update response time and quality
      setResponseTime(duration);
      setConnectionQuality(getConnectionQuality(duration));

      // Check if server responded successfully
      const serverAvailable = response.ok || response.status === 404; // 404 is ok if endpoint doesn't exist yet

      setIsServerAvailable(serverAvailable);
      setLastHealthCheckTime(Date.now());

      // Show notification if server status changed
      if (showNotifications && previousServerStatusRef.current !== serverAvailable) {
        if (serverAvailable) {
          toast.success('Server connection restored', {
            duration: 3000,
          });
        } else {
          toast.error('Server is unavailable', {
            description: 'Some features may not work correctly',
            duration: 5000,
          });
        }
        previousServerStatusRef.current = serverAvailable;
      }
    } catch (error) {
      // Health check failed (timeout, network error, etc.)
      setIsServerAvailable(false);
      setConnectionQuality(ConnectionQuality.UNKNOWN);
      setResponseTime(null);

      // Show notification if server became unavailable
      if (showNotifications && previousServerStatusRef.current !== false) {
        toast.error('Server is unavailable', {
          description: 'Some features may not work correctly',
          duration: 5000,
        });
        previousServerStatusRef.current = false;
      }
    } finally {
      isCheckingRef.current = false;
    }
  };

  /**
   * Handle browser online event
   */
  const handleOnline = () => {
    setIsOnline(true);

    // Show notification
    if (showNotifications && !previousOnlineStatusRef.current) {
      toast.success('Back online', {
        description: 'Your internet connection has been restored',
        duration: 3000,
      });
      previousOnlineStatusRef.current = true;
    }

    // Immediately check server health when coming back online
    checkServerHealth();
  };

  /**
   * Handle browser offline event
   */
  const handleOffline = () => {
    setIsOnline(false);
    setIsServerAvailable(false);
    setConnectionQuality(ConnectionQuality.UNKNOWN);

    // Show notification
    if (showNotifications && previousOnlineStatusRef.current) {
      toast.error('You are offline', {
        description: 'Some features may not be available',
        duration: 5000,
      });
      previousOnlineStatusRef.current = false;
    }
  };

  // Set up online/offline event listeners
  useEffect(() => {
    // Initial status
    previousOnlineStatusRef.current = isOnline;
    previousServerStatusRef.current = isServerAvailable;

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Set up periodic health checks
  useEffect(() => {
    // Perform initial health check
    checkServerHealth();

    // Set up periodic checks
    if (healthCheckInterval > 0) {
      healthCheckIntervalRef.current = setInterval(() => {
        checkServerHealth();
      }, healthCheckInterval);
    }

    // Cleanup
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, [healthCheckInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check health when online status changes
  useEffect(() => {
    if (isOnline) {
      checkServerHealth();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Overall connection status (both online and server available)
  const isConnected = isOnline && isServerAvailable;

  return (
    <NetworkStatusContext.Provider
      value={{
        isOnline,
        isServerAvailable,
        isConnected,
        connectionQuality,
        lastHealthCheckTime,
        checkServerHealth,
        responseTime,
      }}
    >
      {children}
    </NetworkStatusContext.Provider>
  );
}

/**
 * Hook to access network status
 * @throws Error if used outside NetworkStatusProvider
 */
export function useNetworkStatus(): NetworkStatusContextType {
  const context = useContext(NetworkStatusContext);

  if (context === undefined) {
    throw new Error('useNetworkStatus must be used within NetworkStatusProvider');
  }

  return context;
}

/**
 * Helper hook to check if app is fully connected
 * Returns true only if both browser is online AND server is available
 */
export function useIsConnected(): boolean {
  const { isConnected } = useNetworkStatus();
  return isConnected;
}

/**
 * Helper hook to get connection quality as string
 * Useful for displaying to users
 */
export function useConnectionQualityLabel(): string {
  const { connectionQuality } = useNetworkStatus();

  switch (connectionQuality) {
    case ConnectionQuality.EXCELLENT:
      return 'Excellent';
    case ConnectionQuality.GOOD:
      return 'Good';
    case ConnectionQuality.FAIR:
      return 'Fair';
    case ConnectionQuality.POOR:
      return 'Poor';
    case ConnectionQuality.UNKNOWN:
      return 'Unknown';
    default:
      return 'Unknown';
  }
}
