import * as React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.ComponentProps<'div'> {
  /** Variant style for the skeleton */
  variant?: 'default' | 'circular' | 'rounded';
  /** Width of the skeleton (can be Tailwind class or CSS value) */
  width?: string | number;
  /** Height of the skeleton (can be Tailwind class or CSS value) */
  height?: string | number;
}

/**
 * Skeleton Component
 * 
 * A reusable loading skeleton component with shimmer animation.
 * Uses semantic color variables for theme integration.
 * 
 * @example
 * ```tsx
 * <Skeleton className="w-32 h-4" />
 * <Skeleton variant="circular" className="w-10 h-10" />
 * <Skeleton variant="rounded" width="100%" height={200} />
 * ```
 */
function Skeleton({
  className,
  variant = 'default',
  width,
  height,
  ...props
}: SkeletonProps) {
  const variantClasses = {
    default: 'rounded-md',
    circular: 'rounded-full',
    rounded: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
  };

  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-pulse bg-[var(--color-elevated)]',
        variantClasses[variant],
        className
      )}
      style={style}
      aria-label="Loading"
      role="status"
      aria-live="polite"
      {...props}
    />
  );
}

export { Skeleton };

