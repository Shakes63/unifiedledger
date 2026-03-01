'use client';

import { Edit2, Trash2 } from 'lucide-react';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';

interface CategoryData {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'savings';
  monthlyBudget: number;
  dueDate?: number | null;
  usageCount: number;
  isTaxDeductible?: boolean;
  parentId?: string | null;
}

interface CategoryRowProps {
  category: CategoryData;
  color: string;
  isChild?: boolean;
  isLast?: boolean;
  onEdit?: (category: CategoryData) => void;
  onDelete?: (categoryId: string) => void;
}

export function CategoryRow({ category, color, isChild = false, isLast = false, onEdit, onDelete }: CategoryRowProps) {
  return (
    <div
      className="group flex items-center gap-3 px-4 py-2.5 transition-colors"
      style={{
        paddingLeft: isChild ? '2.5rem' : '1rem',
        borderBottom: !isLast ? '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' : 'none',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 50%, transparent)')}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')}
    >
      {/* Child indent indicator */}
      {isChild && (
        <div
          className="absolute"
          style={{
            left: '1rem',
            width: '0.75rem',
            height: '1px',
            backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)',
          }}
        />
      )}

      {/* Type dot */}
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color, opacity: isChild ? 0.7 : 1 }}
      />

      {/* Name + badges */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span
          className="text-[13px] font-medium truncate"
          style={{ color: 'var(--color-foreground)' }}
        >
          {category.name}
        </span>
        {category.isTaxDeductible && (
          <span
            className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-px rounded shrink-0"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)',
              color: 'var(--color-primary)',
            }}
          >
            Tax
          </span>
        )}
        <EntityIdBadge id={category.id} label="Cat" />
      </div>

      {/* Due date */}
      {category.dueDate && (
        <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
          Day {category.dueDate}
        </span>
      )}

      {/* Monthly budget */}
      {category.monthlyBudget > 0 ? (
        <span
          className="text-[12px] font-mono tabular-nums shrink-0 w-20 text-right"
          style={{ color: 'var(--color-foreground)' }}
        >
          ${category.monthlyBudget.toFixed(0)}/mo
        </span>
      ) : (
        <span className="w-20 shrink-0" />
      )}

      {/* Usage count */}
      <span
        className="text-[11px] font-mono tabular-nums shrink-0 w-12 text-right"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {category.usageCount}×
      </span>

      {/* Actions — revealed on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {onEdit && (
          <button
            onClick={() => onEdit(category)}
            className="w-6 h-6 rounded flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-muted-foreground)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
            }}
          >
            <Edit2 className="w-3 h-3" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(category.id)}
            className="w-6 h-6 rounded flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-muted-foreground)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-error) 10%, transparent)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
            }}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// Keep legacy export for any remaining import
export { CategoryRow as CategoryCard };
