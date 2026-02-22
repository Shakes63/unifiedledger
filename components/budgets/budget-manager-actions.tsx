'use client';

interface BudgetManagerActionsProps {
  saving: boolean;
  canSave: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export function BudgetManagerActions({
  saving,
  canSave,
  onCancel,
  onSave,
}: BudgetManagerActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
      <button
        onClick={onCancel}
        disabled={saving}
        className="px-4 py-2 bg-card border border-border text-foreground rounded-lg hover:bg-elevated transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving || !canSave}
        className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Budget'}
      </button>
    </div>
  );
}

