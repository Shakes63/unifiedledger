'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategorySelector } from './category-selector';
import {
  validateSplits,
  calculateSplitMetrics,
  getRemainingForNewSplit,
  type SplitEntry,
  type SplitValidationResult,
} from '@/lib/transactions/split-calculator';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

export interface Split extends SplitEntry {
  id: string;
  categoryId: string;
  description?: string;
}

interface SplitBuilderProps {
  transactionAmount: number;
  splits: Split[];
  onSplitsChange: (splits: Split[]) => void;
  transactionType?: 'income' | 'expense';
  mainCategory?: string;
  transactionDescription?: string;
}

export function SplitBuilder({
  transactionAmount,
  splits,
  onSplitsChange,
  transactionType = 'expense',
  mainCategory = '',
  transactionDescription = '',
}: SplitBuilderProps) {
  const [validation, setValidation] = useState<SplitValidationResult | null>(null);
  const [splitType, setSplitType] = useState<'amount' | 'percentage'>('amount');

  // Validate whenever splits change
  const validateCurrentSplits = (updatedSplits: Split[]) => {
    if (updatedSplits.length === 0) {
      setValidation(null);
      return;
    }

    const result = validateSplits(updatedSplits, transactionAmount);
    setValidation(result);
  };

  const handleAddSplit = () => {
    // Calculate the remaining amount for the new split
    const remaining = getRemainingForNewSplit(splits, transactionAmount, splitType === 'percentage');

    const newSplit: Split = {
      id: `split-${Date.now()}`,
      categoryId: mainCategory,  // Prepopulate with main transaction category
      isPercentage: splitType === 'percentage',
      amount: splitType === 'amount' ? remaining : 0,
      percentage: splitType === 'percentage' ? remaining : 0,
      description: transactionDescription,  // Prepopulate with main transaction description
    };

    const updatedSplits = [...splits, newSplit];
    onSplitsChange(updatedSplits);
    validateCurrentSplits(updatedSplits);
  };

  const handleRemoveSplit = (id: string) => {
    const updatedSplits = splits.filter((s) => s.id !== id);
    onSplitsChange(updatedSplits);
    validateCurrentSplits(updatedSplits);
  };

  const handleUpdateSplitAmount = (id: string, newAmount: string) => {
    const value = parseFloat(newAmount);
    if (isNaN(value)) return;

    // Update the split that changed
    const updatedSplits = splits.map((s) =>
      s.id === id
        ? {
            ...s,
            amount: splitType === 'amount' ? value : 0,
            percentage: splitType === 'percentage' ? value : 0,
            isPercentage: splitType === 'percentage',
          }
        : s
    );

    // Auto-calculate the last split to equal the remainder
    // Only if we have 2 or more splits and we're using fixed amounts
    if (updatedSplits.length >= 2 && splitType === 'amount') {
      const lastIndex = updatedSplits.length - 1;
      const isEditingLastSplit = updatedSplits[lastIndex].id === id;

      if (!isEditingLastSplit) {
        // Sum all splits EXCEPT the last one
        const sumExceptLast = updatedSplits
          .slice(0, lastIndex)
          .reduce((sum, split) => sum + (split.amount || 0), 0);

        // Set last split to remainder
        const remainder = Math.max(0, transactionAmount - sumExceptLast);
        updatedSplits[lastIndex] = {
          ...updatedSplits[lastIndex],
          amount: remainder,
        };
      } else {
        // User is editing the last split, so update the second-to-last split
        if (updatedSplits.length > 2) {
          const secondToLastIndex = lastIndex - 1;
          // Sum all splits EXCEPT the second-to-last one
          const sumExceptSecondToLast = updatedSplits
            .filter((_, i) => i !== secondToLastIndex)
            .reduce((sum, split) => sum + (split.amount || 0), 0);

          const remainder = Math.max(0, transactionAmount - sumExceptSecondToLast);
          updatedSplits[secondToLastIndex] = {
            ...updatedSplits[secondToLastIndex],
            amount: remainder,
          };
        }
      }
    }

    onSplitsChange(updatedSplits);
    validateCurrentSplits(updatedSplits);
  };

  const handleUpdateSplitDescription = (id: string, newDescription: string) => {
    const updatedSplits = splits.map((s) =>
      s.id === id ? { ...s, description: newDescription } : s
    );

    onSplitsChange(updatedSplits);
  };

  const handleUpdateSplitCategory = (id: string, newCategoryId: string) => {
    const updatedSplits = splits.map((s) =>
      s.id === id ? { ...s, categoryId: newCategoryId } : s
    );

    onSplitsChange(updatedSplits);
  };

  const handleSwitchSplitType = (newType: 'amount' | 'percentage') => {
    setSplitType(newType);
  };

  const hasValidationError = validation && !validation.valid;

  return (
    <div className="space-y-4">
      {/* Split Type Toggle */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Split Type</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={splitType === 'amount' ? 'default' : 'outline'}
            className={`flex-1 ${
              splitType === 'amount'
                ? 'bg-[var(--color-primary)] text-background hover:opacity-90'
                : 'bg-elevated text-foreground border-border hover:bg-[var(--color-border)]/20'
            }`}
            onClick={() => handleSwitchSplitType('amount')}
          >
            Fixed Amount
          </Button>
          <Button
            type="button"
            variant={splitType === 'percentage' ? 'default' : 'outline'}
            className={`flex-1 ${
              splitType === 'percentage'
                ? 'bg-[var(--color-primary)] text-background hover:opacity-90'
                : 'bg-elevated text-foreground border-border hover:bg-[var(--color-border)]/20'
            }`}
            onClick={() => handleSwitchSplitType('percentage')}
          >
            Percentage
          </Button>
        </div>
      </div>

      {/* Splits List */}
      {splits.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">
            Splits ({splits.length})
          </Label>

          <div className="space-y-2">
            {splits.map((split) => {
              const metrics = calculateSplitMetrics(split, transactionAmount);
              return (
                <Card
                  key={split.id}
                  className="border-border bg-elevated p-3 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        {split.isPercentage ? `${split.percentage}%` : `$${split.amount?.toFixed(2)}`}
                        {' • '}
                        ${metrics.amount.toFixed(2)} ({metrics.percentage.toFixed(2)}%)
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveSplit(split.id)}
                      className="h-8 w-8 p-0 hover:bg-[var(--color-border)]/20"
                    >
                      <Trash2 className="w-4 h-4 text-[var(--color-error)]" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <CategorySelector
                      selectedCategory={split.categoryId}
                      onCategoryChange={(catId) => handleUpdateSplitCategory(split.id, catId || '')}
                      transactionType={transactionType}
                    />
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={split.isPercentage ? split.percentage || '' : split.amount || ''}
                        onChange={(e) => handleUpdateSplitAmount(split.id, e.target.value)}
                        className="bg-background border-border text-foreground text-sm"
                      />
                      <div className="text-sm font-medium text-muted-foreground pt-2">
                        {split.isPercentage ? '%' : '$'}
                      </div>
                    </div>
                    <Input
                      type="text"
                      placeholder="Description for this split"
                      value={split.description || ''}
                      onChange={(e) => handleUpdateSplitDescription(split.id, e.target.value)}
                      className="bg-background border-border text-foreground text-sm"
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Split Button */}
      <Button
        type="button"
        onClick={handleAddSplit}
        className="w-full bg-[var(--color-primary)] text-background hover:opacity-90 font-medium"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Split
      </Button>

      {/* Validation Messages */}
      {validation && (
        <div className={`p-3 rounded-lg border ${
          validation.valid
            ? 'bg-[var(--color-success)]/20 border-[var(--color-success)]/40 text-[var(--color-success)]'
            : 'bg-[var(--color-error)]/20 border-[var(--color-error)]/40 text-[var(--color-error)]'
        }`}>
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              {validation.valid ? (
                <p>
                  ✓ Splits {validation.totalPercentage !== undefined ? 'sum to 100%' : `sum to $${validation.totalAmount?.toFixed(2)}`}
                </p>
              ) : (
                <ul className="space-y-1">
                  {validation.errors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {splits.length > 0 && (
        <Card className="border-border bg-background p-3">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Number of splits:</span>
              <span className="text-foreground font-medium">{splits.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total amount:</span>
              <span className="text-foreground font-medium">${transactionAmount.toFixed(2)}</span>
            </div>
            {!hasValidationError && (
              <Badge variant="outline" className="mt-2 w-full justify-center border-[var(--color-success)]/40 text-[var(--color-success)]">
                ✓ Ready to save
              </Badge>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
