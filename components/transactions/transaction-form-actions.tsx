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
          className="flex-1 hover:opacity-90 font-medium h-12 md:h-10 text-base md:text-sm"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
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
            className="flex-1 font-medium h-12 md:h-10 text-base md:text-sm"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
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
        className="w-full h-12 md:h-10 text-base md:text-sm"
        style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', border: '1px solid var(--color-border)' }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 80%, transparent)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
      >
        Cancel
      </Button>
    </div>
  );
}

