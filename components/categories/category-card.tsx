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

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    type: 'income' | 'variable_expense' | 'monthly_bill' | 'savings' | 'debt' | 'non_monthly_bill';
    monthlyBudget: number;
    dueDate?: number | null;
    usageCount: number;
    isTaxDeductible?: boolean;
  };
  onEdit?: (category: any) => void;
  onDelete?: (categoryId: string) => void;
}

const CATEGORY_TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  variable_expense: 'Variable Expense',
  monthly_bill: 'Monthly Bill',
  savings: 'Savings',
  debt: 'Debt',
  non_monthly_bill: 'Non-Monthly Bill',
};

const CATEGORY_TYPE_COLORS: Record<string, string> = {
  income: 'bg-emerald-500/10 text-emerald-400',
  variable_expense: 'bg-red-500/10 text-red-400',
  monthly_bill: 'bg-amber-500/10 text-amber-400',
  savings: 'bg-blue-500/10 text-blue-400',
  debt: 'bg-orange-500/10 text-orange-400',
  non_monthly_bill: 'bg-purple-500/10 text-purple-400',
};

export function CategoryCard({ category, onEdit, onDelete }: CategoryCardProps) {
  return (
    <Card className="p-2 border border-[#2a2a2a] bg-[#1a1a1a] rounded-lg hover:border-[#3a3a3a] transition-all">
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm truncate">{category.name}</h3>
          <p className="text-gray-500 text-xs mt-0">{CATEGORY_TYPE_LABELS[category.type]}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-[#242424] text-gray-400 ml-1 flex-shrink-0"
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#242424] border-[#2a2a2a]">
            {onEdit && (
              <DropdownMenuItem
                onClick={() => onEdit(category)}
                className="text-gray-300 cursor-pointer hover:bg-[#2a2a2a] text-xs"
              >
                <Edit2 className="h-3 w-3 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(category.id)}
                className="text-red-400 cursor-pointer hover:bg-red-500/10 text-xs"
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
          <span className="text-xs font-medium px-1.5 py-0.5 rounded inline-block bg-purple-500/10 text-purple-400">
            Tax Deductible
          </span>
        )}
      </div>

      {/* Budget and Usage Info */}
      <div className="space-y-1 text-xs">
        {category.monthlyBudget > 0 && (
          <div className="pb-1 border-b border-[#2a2a2a]">
            <p className="text-gray-500 text-xs mb-0">Monthly Budget</p>
            <p className="text-sm font-semibold text-white">${category.monthlyBudget.toFixed(2)}</p>
          </div>
        )}

        {category.dueDate && (
          <div>
            <p className="text-gray-500 text-xs mb-0">Due Date</p>
            <p className="text-white font-medium text-xs">Day {category.dueDate}</p>
          </div>
        )}

        <div>
          <p className="text-gray-500 text-xs">Used {category.usageCount}x</p>
        </div>
      </div>
    </Card>
  );
}
