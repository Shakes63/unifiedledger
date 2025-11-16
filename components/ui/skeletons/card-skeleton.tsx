import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface CardSkeletonProps {
  /** Number of content lines to display */
  lines?: number;
  /** Show header skeleton */
  showHeader?: boolean;
  /** Additional className for the container */
  className?: string;
}

/**
 * CardSkeleton Component
 * 
 * A skeleton loader for card-based widgets and components.
 * Displays a header (optional) and configurable content lines.
 * 
 * @example
 * ```tsx
 * <CardSkeleton lines={3} showHeader />
 * ```
 */
export function CardSkeleton({
  lines = 3,
  showHeader = true,
  className,
}: CardSkeletonProps) {
  return (
    <Card
      className={className}
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-card)',
      }}
    >
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="w-32 h-5" />
            <Skeleton className="w-20 h-4" />
          </div>
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            className="w-full h-4"
            style={{
              width: index === lines - 1 ? '75%' : '100%',
            }}
          />
        ))}
      </CardContent>
    </Card>
  );
}

