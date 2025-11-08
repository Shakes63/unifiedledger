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
}

export function SplitBuilder({
  transactionAmount,
  splits,
  onSplitsChange,
  transactionType = 'expense',
}: SplitBuilderProps) {
  const [validation, setValidation] = useState<SplitValidationResult | null>(null);
  const [splitType, setSplitType] = useState<'amount' | 'percentage'>('amount');
  const [newSplitCategory, setNewSplitCategory] = useState<string>('');
  const [newSplitAmount, setNewSplitAmount] = useState<string>('');

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
    if (!newSplitCategory || !newSplitAmount) {
      return;
    }

    const splitValue = parseFloat(newSplitAmount);
    if (isNaN(splitValue) || splitValue <= 0) {
      return;
    }

    const newSplit: Split = {
      id: `split-${Date.now()}`,
      categoryId: newSplitCategory,
      isPercentage: splitType === 'percentage',
      amount: splitType === 'amount' ? splitValue : 0,
      percentage: splitType === 'percentage' ? splitValue : 0,
      description: '',
    };

    const updatedSplits = [...splits, newSplit];
    onSplitsChange(updatedSplits);
    validateCurrentSplits(updatedSplits);

    // Reset form
    setNewSplitCategory('');
    setNewSplitAmount('');
  };

  const handleRemoveSplit = (id: string) => {
    const updatedSplits = splits.filter((s) => s.id !== id);
    onSplitsChange(updatedSplits);
    validateCurrentSplits(updatedSplits);
  };

  const handleUpdateSplitAmount = (id: string, newAmount: string) => {
    const value = parseFloat(newAmount);
    if (isNaN(value)) return;

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

    onSplitsChange(updatedSplits);
    validateCurrentSplits(updatedSplits);
  };

  const handleSwitchSplitType = (newType: 'amount' | 'percentage') => {
    setSplitType(newType);
    // Reset input
    setNewSplitAmount('');
  };

  const remaining = getRemainingForNewSplit(splits, transactionAmount, splitType === 'percentage');
  const hasValidationError = validation && !validation.valid;

  return (
    <div className="space-y-4">
      {/* Split Type Toggle */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-white">Split Type</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={splitType === 'amount' ? 'default' : 'outline'}
            className={`flex-1 ${
              splitType === 'amount'
                ? 'bg-white text-black hover:bg-gray-100'
                : 'bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a]'
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
                ? 'bg-white text-black hover:bg-gray-100'
                : 'bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a]'
            }`}
            onClick={() => handleSwitchSplitType('percentage')}
          >
            Percentage
          </Button>
        </div>
      </div>

      {/* Add Split Form */}
      <Card className="border-[#2a2a2a] bg-[#242424] p-4 space-y-3">
        <Label className="text-sm font-medium text-white">Add New Split</Label>

        <CategorySelector
          selectedCategory={newSplitCategory}
          onCategoryChange={(catId) => setNewSplitCategory(catId || '')}
          transactionType={transactionType}
        />

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <Input
              type="number"
              step={splitType === 'percentage' ? '0.01' : '0.01'}
              min="0"
              placeholder={
                splitType === 'percentage'
                  ? `0 - ${remaining.toFixed(2)}%`
                  : `0 - $${remaining.toFixed(2)}`
              }
              value={newSplitAmount}
              onChange={(e) => setNewSplitAmount(e.target.value)}
              className="bg-[#1a1a1a] border-[#3a3a3a] text-white"
            />
          </div>
          <div className="text-sm font-medium text-muted-foreground pt-2">
            {splitType === 'percentage' ? '%' : '$'}
          </div>
        </div>

        <Button
          type="button"
          onClick={handleAddSplit}
          disabled={!newSplitCategory || !newSplitAmount}
          className="w-full bg-white text-black hover:bg-gray-100 font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Split
        </Button>
      </Card>

      {/* Splits List */}
      {splits.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-white">
            Splits ({splits.length})
          </Label>

          <div className="space-y-2">
            {splits.map((split) => {
              const metrics = calculateSplitMetrics(split, transactionAmount);
              return (
                <Card
                  key={split.id}
                  className="border-[#2a2a2a] bg-[#242424] p-3 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">
                        {split.categoryId || 'No category selected'}
                      </p>
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
                      className="h-8 w-8 p-0 hover:bg-[#3a3a3a]"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={split.isPercentage ? split.percentage || '' : split.amount || ''}
                      onChange={(e) => handleUpdateSplitAmount(split.id, e.target.value)}
                      className="bg-[#1a1a1a] border-[#3a3a3a] text-white text-sm"
                    />
                    <div className="text-sm font-medium text-muted-foreground pt-2">
                      {split.isPercentage ? '%' : '$'}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Validation Messages */}
      {validation && (
        <div className={`p-3 rounded-lg border ${
          validation.valid
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            : 'bg-red-500/20 border-red-500/40 text-red-400'
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
        <Card className="border-[#2a2a2a] bg-[#1a1a1a] p-3">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Number of splits:</span>
              <span className="text-white font-medium">{splits.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total amount:</span>
              <span className="text-white font-medium">${transactionAmount.toFixed(2)}</span>
            </div>
            {!hasValidationError && (
              <Badge variant="outline" className="mt-2 w-full justify-center border-emerald-500/40 text-emerald-400">
                ✓ Ready to save
              </Badge>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
