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
    <div className="space-y-2 pt-4 border-t border-border">
      <div className="flex gap-2">
        <Button
          type="submit"
          onClick={onSave}
          disabled={isLoading}
          className="flex-1 text-white hover:opacity-90 font-medium bg-primary"
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
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
          >
            {isLoading && saveMode === 'saveAndAdd' ? 'Saving...' : 'Save & Add Another'}
          </Button>
        )}
      </div>
      <Button
        type="button"
        onClick={onCancel}
        variant="outline"
        className="w-full bg-elevated border-border text-foreground hover:bg-elevated"
      >
        Cancel
      </Button>
    </div>
  );
}

