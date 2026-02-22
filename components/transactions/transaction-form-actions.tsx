'use client';

import { Button } from '@/components/ui/button';

interface TransactionFormActionsProps {
  isEditMode: boolean;
  loading: boolean;
  saveMode: 'save' | 'saveAndAdd' | null;
  onSave: () => void;
  onSaveAndAdd: () => void;
  onCancel: () => void;
}

export function TransactionFormActions({
  isEditMode,
  loading,
  saveMode,
  onSave,
  onSaveAndAdd,
  onCancel,
}: TransactionFormActionsProps) {
  return (
    <div className="space-y-2 pt-4 md:pb-0 pb-4">
      <div className="flex gap-2 flex-col md:flex-row">
        <Button
          type="submit"
          onClick={onSave}
          disabled={loading}
          className="flex-1 bg-primary text-white hover:opacity-90 font-medium h-12 md:h-10 text-base md:text-sm"
        >
          {isEditMode
            ? loading && saveMode === 'save'
              ? 'Updating...'
              : 'Update Transaction'
            : loading && saveMode === 'save'
            ? 'Saving...'
            : 'Save'}
        </Button>
        {!isEditMode && (
          <Button
            type="submit"
            onClick={onSaveAndAdd}
            disabled={loading}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 font-medium h-12 md:h-10 text-base md:text-sm"
          >
            {loading && saveMode === 'saveAndAdd' ? 'Saving...' : 'Save & Add Another'}
          </Button>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={loading}
        className="w-full bg-elevated text-foreground border-border hover:bg-elevated/80 h-12 md:h-10 text-base md:text-sm"
      >
        Cancel
      </Button>
    </div>
  );
}

