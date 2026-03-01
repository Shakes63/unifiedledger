'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CategorySelector } from './category-selector';
import {
  validateSplits,
  calculateSplitMetrics,
  getRemainingForNewSplit,
  type SplitEntry,
  type SplitValidationResult,
} from '@/lib/transactions/split-calculator';
import { Plus, Trash2, AlertCircle, Scale, Loader2 } from 'lucide-react';

export interface Split extends SplitEntry {
  id: string;
  categoryId: string;
  description?: string;
  isAutoBalanced?: boolean;
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
  const [categoriesLoading, setCategoriesLoading] = useState(true);

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

    // Update the split that changed and clear auto-balanced flag on manual edit
    const updatedSplits = splits.map((s) =>
      s.id === id
        ? {
            ...s,
            amount: splitType === 'amount' ? value : 0,
            percentage: splitType === 'percentage' ? value : 0,
            isPercentage: splitType === 'percentage',
            isAutoBalanced: false, // Clear flag on manual edit
          }
        : s
    );

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

  // Balance splits by adjusting the last split to equal the remainder
  const handleBalanceSplits = () => {
    if (splits.length < 2) return;

    const isPercentageMode = splitType === 'percentage';
    const target = isPercentageMode ? 100 : transactionAmount;

    // Sum all splits EXCEPT the last one
    const sumExceptLast = splits
      .slice(0, -1)
      .reduce((sum, s) => sum + (isPercentageMode ? s.percentage || 0 : s.amount || 0), 0);

    // Calculate remainder for the last split
    const remainder = Math.max(0, target - sumExceptLast);

    // Update splits - clear auto-balanced from all except last, set on last
    const updatedSplits = splits.map((s, index) => {
      if (index === splits.length - 1) {
        return {
          ...s,
          ...(isPercentageMode
            ? { percentage: parseFloat(remainder.toFixed(2)) }
            : { amount: parseFloat(remainder.toFixed(2)) }),
          isAutoBalanced: true,
        };
      }
      return { ...s, isAutoBalanced: false };
    });

    onSplitsChange(updatedSplits);
    validateCurrentSplits(updatedSplits);
  };

  const hasValidationError = validation && !validation.valid;

  return (
    <div className="space-y-4">
      {/* Split Type Toggle */}
      <div className="space-y-2">
        <Label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>Split Type</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={splitType === 'amount' ? 'default' : 'outline'}
            className={`flex-1 ${splitType === 'amount' ? 'hover:opacity-90' : ''}`}
            style={
              splitType === 'amount'
                ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }
                : { backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', borderColor: 'var(--color-border)', borderWidth: 1, borderStyle: 'solid' }
            }
            onClick={() => handleSwitchSplitType('amount')}
          >
            Fixed Amount
          </Button>
          <Button
            type="button"
            variant={splitType === 'percentage' ? 'default' : 'outline'}
            className={`flex-1 ${splitType === 'percentage' ? 'hover:opacity-90' : ''}`}
            style={
              splitType === 'percentage'
                ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }
                : { backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', borderColor: 'var(--color-border)', borderWidth: 1, borderStyle: 'solid' }
            }
            onClick={() => handleSwitchSplitType('percentage')}
          >
            Percentage
          </Button>
        </div>
      </div>

      {/* Splits List */}
      {splits.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
            Splits ({splits.length})
          </Label>

          <div className="space-y-2">
            {splits.map((split) => {
              const metrics = calculateSplitMetrics(split, transactionAmount);
              return (
                <Card
                  key={split.id}
                  className="p-3 space-y-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-elevated)' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                          {split.isPercentage ? `${split.percentage}%` : `$${split.amount?.toFixed(2)}`}
                          {' • '}
                          ${metrics.amount.toFixed(2)} ({metrics.percentage.toFixed(2)}%)
                        </p>
                        {split.isAutoBalanced && (
                          <Badge 
                            variant="outline" 
                            className="text-[10px] px-1.5 py-0 h-4" style={{ borderColor: 'color-mix(in oklch, var(--color-primary) 40%, transparent)', color: 'var(--color-primary)' }}
                          >
                            Balanced
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveSplit(split.id)}
                      className="h-8 w-8 p-0 hover:opacity-80"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: 'var(--color-destructive)' }} />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <CategorySelector
                      selectedCategory={split.categoryId}
                      onCategoryChange={(catId) => handleUpdateSplitCategory(split.id, catId || '')}
                      transactionType={transactionType}
                      onLoadingChange={setCategoriesLoading}
                    />
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={split.isPercentage ? split.percentage || '' : split.amount || ''}
                        onChange={(e) => handleUpdateSplitAmount(split.id, e.target.value)}
                        className="text-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                      />
                      <div className="text-sm font-medium pt-2" style={{ color: 'var(--color-muted-foreground)' }}>
                        {split.isPercentage ? '%' : '$'}
                      </div>
                    </div>
                    <Input
                      type="text"
                      placeholder="Description for this split"
                      value={split.description || ''}
                      onChange={(e) => handleUpdateSplitDescription(split.id, e.target.value)}
                      className="text-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
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
        disabled={categoriesLoading}
        className="w-full hover:opacity-90 font-medium disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
      >
        {categoriesLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading categories...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 mr-2" />
            Add Split
          </>
        )}
      </Button>

      {/* Validation Messages */}
      {validation && (
        <div
          className="p-3 rounded-lg border"
          style={
            validation.valid
              ? { backgroundColor: 'color-mix(in oklch, var(--color-success) 20%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 40%, transparent)', color: 'var(--color-success)' }
              : { backgroundColor: 'color-mix(in oklch, var(--color-destructive) 20%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 40%, transparent)', color: 'var(--color-destructive)' }
          }
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
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
        <Card className="p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-muted-foreground)' }}>Number of splits:</span>
              <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>{splits.length}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-muted-foreground)' }}>Total amount:</span>
              <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>${transactionAmount.toFixed(2)}</span>
            </div>
            {hasValidationError && splits.length >= 2 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBalanceSplits}
                className="w-full mt-2 hover:opacity-90"
            style={{ borderColor: 'color-mix(in oklch, var(--color-primary) 40%, transparent)', color: 'var(--color-primary)' }}
              >
                <Scale className="w-4 h-4 mr-2" />
                Balance Splits
              </Button>
            )}
            {!hasValidationError && (
              <Badge variant="outline" className="mt-2 w-full justify-center" style={{ borderColor: 'color-mix(in oklch, var(--color-success) 40%, transparent)', color: 'var(--color-success)' }}>
                ✓ Ready to save
              </Badge>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
