'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface UserAvatarProps {
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showRing?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-20 h-20 text-2xl',
  xl: 'w-30 h-30 text-4xl',
};

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Generate consistent color from userId
 */
function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
}

/**
 * UserAvatar - displays user avatar with initials fallback
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

  const initials = getInitials(userName);
  const bgColor = getAvatarColor(userId);
  const showImage = avatarUrl && !imageError;

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full overflow-hidden',
        'transition-all duration-200',
        sizeClasses[size],
        showRing && 'hover:ring-2 hover:ring-border',
        className
      )}
      aria-label={`${userName}'s avatar`}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={`${userName}'s avatar`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-bold text-white"
          style={{ backgroundColor: bgColor }}
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
