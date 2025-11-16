import { Skeleton } from '@/components/ui/skeleton';

interface ListSkeletonProps {
  /** Number of list items to display */
  count?: number;
  /** Show avatar skeleton */
  showAvatar?: boolean;
  /** Additional className for the container */
  className?: string;
}

/**
 * ListSkeleton Component
 * 
 * A skeleton loader for list views.
 * Displays multiple list items with optional avatars.
 * 
 * @example
 * ```tsx
 * <ListSkeleton count={5} showAvatar />
 * ```
 */
export function ListSkeleton({
  count = 5,
  showAvatar = true,
  className,
}: ListSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 py-3 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {showAvatar && (
            <Skeleton
              variant="circular"
              className="w-10 h-10"
            />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton className="w-3/4 h-4" />
            <Skeleton className="w-1/2 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

