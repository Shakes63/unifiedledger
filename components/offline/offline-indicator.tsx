'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * Offline Indicator Badge
 * Shows connection status in navbar
 */
export function OfflineIndicator() {
  const { status, isOnline } = useOnlineStatus();

  if (status === 'checking') {
    return null; // Don't show while checking
  }

  if (isOnline) {
    return null; // Only show when offline
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] border border-[#3b3b3b] rounded-lg text-sm">
      <WifiOff className="w-4 h-4 text-[#fbbf24]" />
      <span className="text-[#fbbf24]">Offline</span>
    </div>
  );
}

/**
 * Compact Online Status Indicator
 * Minimal icon-only version
 */
export function OnlineStatusIcon() {
  const { status, isOnline } = useOnlineStatus();

  if (status === 'checking') {
    return null;
  }

  return isOnline ? (
    <Wifi className="w-4 h-4 text-[#10b981]" title="Online" />
  ) : (
    <WifiOff className="w-4 h-4 text-[#fbbf24]" title="Offline" />
  );
}
