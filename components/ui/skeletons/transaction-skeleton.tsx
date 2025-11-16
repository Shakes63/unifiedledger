import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TransactionSkeletonProps {
  /** Number of skeleton items to display */
  count?: number;
  /** Additional className for the container */
  className?: string;
}

/**
 * TransactionSkeleton Component
 * 
 * A skeleton loader that matches the transaction card layout.
 * Displays multiple skeleton transaction items.
 * 
 * @example
 * ```tsx
 * <TransactionSkeleton count={5} />
 * ```
 */
export function TransactionSkeleton({ count = 5, className }: TransactionSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <Card
          key={index}
          className="p-4 border rounded-lg"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-card)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            {/* Left side: Icon and text */}
            <div className="flex items-center gap-3 flex-1">
              {/* Icon skeleton */}
              <Skeleton
                variant="rounded"
                className="w-10 h-10"
                style={{ backgroundColor: 'var(--color-elevated)' }}
              />
              
              {/* Text content */}
              <div className="flex-1 space-y-2">
                {/* Description skeleton */}
                <Skeleton className="w-32 h-4" />
                {/* Date skeleton */}
                <Skeleton className="w-20 h-3" />
              </div>
            </div>
            
            {/* Right side: Amount and badge */}
            <div className="flex items-center gap-2">
              <div className="text-right space-y-2">
                {/* Amount skeleton */}
                <Skeleton className="w-16 h-4 ml-auto" />
                {/* Badge skeleton */}
                <Skeleton
                  variant="rounded"
                  className="w-16 h-5 rounded-full"
                />
              </div>
              {/* Action button skeleton */}
              <Skeleton
                variant="circular"
                className="w-8 h-8"
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

