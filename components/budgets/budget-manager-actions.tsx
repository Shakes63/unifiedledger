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
    <div className="flex items-center justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
      <button
        onClick={onCancel}
        disabled={saving}
        className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-background)'; }}
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving || !canSave}
        className="px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
      >
        {saving ? 'Saving...' : 'Save Budget'}
      </button>
    </div>
  );
}

