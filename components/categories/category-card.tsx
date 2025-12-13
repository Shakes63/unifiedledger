'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';

interface CategoryData {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'savings';
  monthlyBudget: number;
  dueDate?: number | null;
  usageCount: number;
  isTaxDeductible?: boolean;
}

interface CategoryCardProps {
  category: CategoryData;
  onEdit?: (category: CategoryData) => void;
  onDelete?: (categoryId: string) => void;
}

const CATEGORY_TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
  savings: 'Savings',
};

const CATEGORY_TYPE_COLORS: Record<string, string> = {
  income: 'bg-income/10 text-income',
  expense: 'bg-expense/10 text-expense',
  savings: 'bg-primary/10 text-primary',
};

export function CategoryCard({ category, onEdit, onDelete }: CategoryCardProps) {
  return (
    <Card className="p-2 border border-border bg-card rounded-lg hover:border-border transition-all">
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3 className="text-foreground font-semibold text-sm truncate">{category.name}</h3>
            <EntityIdBadge id={category.id} label="Cat" />
          </div>
          <p className="text-muted-foreground text-xs mt-0">{CATEGORY_TYPE_LABELS[category.type]}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-elevated text-muted-foreground ml-1 flex-shrink-0"
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-elevated border-border">
            {onEdit && (
              <DropdownMenuItem
                onClick={() => onEdit(category)}
                className="text-foreground cursor-pointer hover:bg-elevated text-xs"
              >
                <Edit2 className="h-3 w-3 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(category.id)}
                className="text-error cursor-pointer hover:bg-error/10 text-xs"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Category Type Badge and Tax Deductible Badge */}
      <div className="mb-1 flex gap-1 flex-wrap">
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded inline-block ${CATEGORY_TYPE_COLORS[category.type]}`}>
          {CATEGORY_TYPE_LABELS[category.type]}
        </span>
        {category.isTaxDeductible && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded inline-block bg-primary/10 text-primary">
            Tax Deductible
          </span>
        )}
      </div>

      {/* Budget and Usage Info */}
      <div className="space-y-1 text-xs">
        {category.monthlyBudget > 0 && (
          <div className="pb-1 border-b border-border">
            <p className="text-muted-foreground text-xs mb-0">Monthly Budget</p>
            <p className="text-sm font-semibold text-foreground">${category.monthlyBudget.toFixed(2)}</p>
          </div>
        )}

        {category.dueDate && (
          <div>
            <p className="text-muted-foreground text-xs mb-0">Due Date</p>
            <p className="text-foreground font-medium text-xs">Day {category.dueDate}</p>
          </div>
        )}

        <div>
          <p className="text-muted-foreground text-xs">Used {category.usageCount}x</p>
        </div>
      </div>
    </Card>
  );
}
