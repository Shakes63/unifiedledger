'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getInitials, getAvatarColor } from '@/lib/avatar-client-utils';
import { cn } from '@/lib/utils';

export interface UserAvatarProps {
  /** User ID for deterministic color generation */
  userId: string;
  /** User's display name for initials fallback */
  userName: string;
  /** Optional avatar image URL */
  avatarUrl?: string | null;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
  /** Show ring border on hover */
  showRing?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-20 h-20 text-2xl',
  xl: 'w-30 h-30 text-4xl',
};

const sizePixels = {
  sm: 32,
  md: 40,
  lg: 80,
  xl: 120,
};

/**
 * UserAvatar component - displays user avatar with initials fallback
 *
 * Features:
 * - Shows avatar image if available
 * - Falls back to initials with deterministic color
 * - Multiple size variants
 * - Loading and error states
 * - Hover ring effect
 * - Fully themed with CSS variables
 */
export function UserAvatar({
  userId,
  userName,
  avatarUrl,
  size = 'md',
  className,
  showRing = true,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const initials = getInitials(userName);
  const backgroundColor = getAvatarColor(userId);
  const showImage = avatarUrl && !imageError;

  const containerClasses = cn(
    'relative inline-flex items-center justify-center rounded-full overflow-hidden',
    'transition-all duration-200',
    sizeClasses[size],
    showRing && 'hover:ring-2 hover:ring-border',
    className
  );

  return (
    <div
      className={containerClasses}
      aria-label={`${userName}'s avatar`}
    >
      {showImage ? (
        <>
          <Image
            src={avatarUrl}
            alt={`${userName}'s avatar`}
            width={sizePixels[size]}
            height={sizePixels[size]}
            className={cn(
              'object-cover w-full h-full',
              imageLoading && 'opacity-0'
            )}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
            priority={size === 'xl'} // Prioritize large avatars (settings page)
            unoptimized // Avatar URLs have cache-busting query params that Next.js optimizer doesn't handle
          />
          {imageLoading && (
            <div className="absolute inset-0 bg-muted animate-pulse" />
          )}
        </>
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-bold text-white"
          style={{ backgroundColor }}
          aria-label={`${userName}'s initials: ${initials}`}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

/**
 * UserAvatarSkeleton - Loading skeleton for avatar
 */
export function UserAvatarSkeleton({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-full bg-muted animate-pulse',
        sizeClasses[size],
        className
      )}
      aria-label="Loading avatar"
    />
  );
}
