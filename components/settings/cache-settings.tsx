'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { toast } from 'sonner';
import { Loader2, Trash2, RefreshCw, AlertCircle } from 'lucide-react';

/**
 * Cache Settings Component
 * Allows users to manage their service worker and cache settings
 */
export function CacheSettings() {
  const {
    isSupported,
    isRegistered,
    cacheSize,
    storageQuota,
    isStorageLow,
    isLoading,
    error,
    clearAllCaches,
    cleanup,
  } = useServiceWorker();

  const [isClearing, setIsClearing] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Calculate percentage
  const percentage = storageQuota > 0 ? (cacheSize / storageQuota) * 100 : 0;

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      const success = await clearAllCaches();
      if (success) {
        toast.success('Cache cleared successfully');
      } else {
        toast.error('Failed to clear cache');
      }
    } catch (_err) {
      toast.error('Error clearing cache');
    } finally {
      setIsClearing(false);
    }
  };

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const success = await cleanup();
      if (success) {
        toast.success('Cache cleaned up successfully');
      } else {
        toast.error('Failed to cleanup cache');
      }
    } catch (_err) {
      toast.error('Error cleaning up cache');
    } finally {
      setIsCleaningUp(false);
    }
  };

  if (!isSupported) {
    return (
      <Card className="border-red-900/20 bg-red-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            Service Worker Not Supported
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">
            Your browser does not support service workers. Offline functionality and advanced caching are not available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cache Management</CardTitle>
          <CardDescription>
            Manage your app's cache storage and offline capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Service Worker Status */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Service Worker Status</h3>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${isRegistered ? 'bg-emerald-500' : 'bg-gray-600'}`} />
              <span className="text-sm text-gray-400">
                {isLoading ? 'Checking...' : isRegistered ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isRegistered
                ? 'Your app is ready for offline use'
                : 'Service worker is not active. Some features may be unavailable.'}
            </p>
          </div>

          {/* Cache Storage */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Cache Storage</h3>

            {/* Storage Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Used Space</span>
                <span className="text-white font-mono">{formatBytes(cacheSize)}</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>{Math.round(percentage)}% used</span>
                <span className="font-mono">{formatBytes(storageQuota)} total</span>
              </div>
            </div>

            {/* Storage Warning */}
            {isStorageLow && (
              <div className="mt-3 p-2 bg-amber-950/20 border border-amber-900/30 rounded text-xs text-amber-300">
                Storage is running low. Consider clearing cache to free up space.
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-950/20 border border-red-900/30 rounded text-sm text-red-300">
              {error.message}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleCleanup}
              disabled={isCleaningUp || !isRegistered}
              variant="outline"
              className="w-full justify-center"
            >
              {isCleaningUp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <RefreshCw className="h-4 w-4 mr-2" />
              Clean Up Cache
            </Button>

            <Button
              onClick={handleClearCache}
              disabled={isClearing || !isRegistered}
              variant="destructive"
              className="w-full justify-center"
            >
              {isClearing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Cache
            </Button>
          </div>

          {/* Information */}
          <div className="p-3 bg-blue-950/20 border border-blue-900/30 rounded text-xs space-y-1 text-blue-300">
            <p className="font-semibold">About Cache:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Cache stores static assets for faster loading</li>
              <li>API responses are cached with stale-while-revalidate strategy</li>
              <li>Cleanup removes old entries beyond the 100 per cache limit</li>
              <li>Clear All Cache removes everything and saves space</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
