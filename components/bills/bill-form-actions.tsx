'use client';

import { Button } from '@/components/ui/button';

interface BillFormActionsProps {
  hasExistingBill: boolean;
  isLoading: boolean;
  saveMode: 'save' | 'saveAndAdd' | null;
  onSave: () => void;
  onSaveAndAdd: () => void;
  onCancel: () => void;
}

export function BillFormActions({
  hasExistingBill,
  isLoading,
  saveMode,
  onSave,
  onSaveAndAdd,
  onCancel,
}: BillFormActionsProps) {
  return (
    <div className="space-y-2 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex gap-2">
        <Button
          type="submit"
          onClick={onSave}
          disabled={isLoading}
          className="flex-1 hover:opacity-90 font-medium"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
        >
          {hasExistingBill
            ? isLoading && saveMode === 'save'
              ? 'Updating...'
              : 'Update Bill'
            : isLoading && saveMode === 'save'
            ? 'Saving...'
            : 'Save Bill'}
        </Button>
        {!hasExistingBill && (
          <Button
            type="submit"
            onClick={onSaveAndAdd}
            disabled={isLoading}
            className="flex-1 hover:opacity-90 font-medium"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-foreground)' }}
          >
            {isLoading && saveMode === 'saveAndAdd' ? 'Saving...' : 'Save & Add Another'}
          </Button>
        )}
      </div>
      <Button
        type="button"
        onClick={onCancel}
        variant="outline"
        className="w-full border hover:bg-[var(--color-elevated)]"
            style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
      >
        Cancel
      </Button>
    </div>
  );
}

