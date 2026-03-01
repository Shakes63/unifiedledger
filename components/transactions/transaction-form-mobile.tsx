'use client';

import { useState } from 'react';
import { TransactionForm } from './transaction-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

type TransactionType = 'income' | 'expense' | 'transfer_in' | 'transfer_out';

interface TransactionFormMobileProps {
  defaultType?: TransactionType;
  transactionId?: string;
  onEditSuccess?: () => void;
  showHeader?: boolean;
}

/**
 * Mobile-optimized transaction form wrapper
 * Optimizes the transaction form for one-handed use with:
 * - Larger touch targets (44-48px minimum for thumbs)
 * - Fixed bottom action buttons
 * - Better scrolling UX
 * - Simplified layout on mobile screens
 * - Reduced form height with sticky header/footer
 */
export function TransactionFormMobile({
  defaultType = 'expense',
  transactionId,
  onEditSuccess,
  showHeader = true,
}: TransactionFormMobileProps) {
  const router = useRouter();
  const [_isFormCollapsed, _setIsFormCollapsed] = useState(false);

  return (
    <div className="flex flex-col" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Mobile Header - Sticky */}
      {showHeader && (
        <div className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'var(--color-background)', borderBottom: '1px solid var(--color-border)' }}>
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg transition-colors hover:bg-(--color-elevated)"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: 'var(--color-muted-foreground)' }} />
          </button>
          <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--color-foreground)' }}>
            {transactionId ? 'Edit Transaction' : 'New Transaction'}
          </h1>
        </div>
      )}

      {/* Form Content - Natural height with bottom padding for mobile fixed footer */}
      <div className="pb-20 md:pb-8">
        <div className="px-4 py-6 max-w-2xl mx-auto">
          <TransactionForm
            defaultType={defaultType === 'transfer_in' || defaultType === 'transfer_out' ? undefined : defaultType}
            transactionId={transactionId}
            onEditSuccess={onEditSuccess}
          />
        </div>
      </div>

      {/* Mobile Footer - Fixed with larger buttons */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 flex gap-3 md:hidden z-40" style={{ backgroundColor: 'var(--color-background)', borderTop: '1px solid var(--color-border)' }}>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="h-12 px-6 text-base font-medium flex-1 hover:bg-(--color-elevated)"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
        >
          Cancel
        </Button>
        {/* Submit button handled within TransactionForm component */}
        {/* The form submit button needs to be repositioned or duplicated */}
      </div>
    </div>
  );
}
