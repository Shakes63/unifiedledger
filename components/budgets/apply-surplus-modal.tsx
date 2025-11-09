'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { TrendingDown, Clock, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SuggestionData {
  hasSuggestion: boolean;
  availableAmount: number;
  currentPlan?: {
    extraPayment: number;
    monthsToDebtFree: number;
    debtFreeDate: string;
    totalInterest: number;
  };
  suggestedPlan?: {
    extraPayment: number;
    monthsToDebtFree: number;
    debtFreeDate: string;
    totalInterest: number;
  };
  impact?: {
    monthsSaved: number;
    interestSaved: number;
    percentageFaster: number;
  };
  message?: string;
  method?: string;
  frequency?: string;
}

interface ApplySurplusModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableAmount: number;
  suggestedAmount: number;
  onSuccess: () => void;
}

export function ApplySurplusModal({
  isOpen,
  onClose,
  availableAmount,
  suggestedAmount,
  onSuccess,
}: ApplySurplusModalProps) {
  const [amount, setAmount] = useState(suggestedAmount);
  const [suggestion, setSuggestion] = useState<SuggestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSuggestion();
    }
  }, [isOpen]);

  const fetchSuggestion = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/budgets/surplus-suggestion');

      if (!response.ok) {
        throw new Error('Failed to fetch suggestion');
      }

      const data = await response.json();
      setSuggestion(data);
    } catch (err) {
      console.error('Error fetching suggestion:', err);
      toast.error('Failed to load debt impact preview');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    try {
      setApplying(true);

      const response = await fetch('/api/budgets/apply-surplus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply surplus');
      }

      const result = await response.json();

      toast.success(result.message || 'Surplus applied to debt payments!', {
        description: `New extra payment: $${result.newExtraPayment.toFixed(2)}/month`,
      });

      onSuccess();
    } catch (err) {
      console.error('Error applying surplus:', err);
      toast.error('Failed to apply surplus. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Apply Budget Surplus to Debt</DialogTitle>
          <DialogDescription className="text-gray-400">
            Use your available budget surplus to accelerate debt payoff
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : !suggestion?.hasSuggestion ? (
          <div className="py-8 text-center">
            <p className="text-gray-400">
              {suggestion?.reason === 'no_debts'
                ? 'You have no active debts to pay off.'
                : 'No surplus available to apply.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Amount Selector */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">Amount to Apply</label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">
                    {formatCurrency(amount)}
                  </span>
                  <span className="text-xs text-gray-500">/ month</span>
                </div>
              </div>

              {/* Slider */}
              <div className="space-y-2">
                <Slider
                  value={[amount]}
                  onValueChange={(values) => setAmount(values[0])}
                  max={availableAmount}
                  min={0}
                  step={10}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>$0</span>
                  <span className="text-emerald-400">
                    Suggested: {formatCurrency(suggestedAmount)}
                  </span>
                  <span>{formatCurrency(availableAmount)}</span>
                </div>
              </div>
            </div>

            {/* Impact Preview - Only show if amount > 0 */}
            {amount > 0 && suggestion.impact && suggestion.currentPlan && suggestion.suggestedPlan && (
              <div className="grid grid-cols-2 gap-4">
                {/* Current Plan */}
                <div className="p-4 bg-[#242424] border border-[#2a2a2a] rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-gray-500/20 rounded">
                      <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                    <span className="text-xs text-gray-400">Current Plan</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Debt-Free In</p>
                      <p className="text-lg font-bold text-white">
                        {suggestion.currentPlan.monthsToDebtFree} months
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(suggestion.currentPlan.debtFreeDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Interest</p>
                      <p className="text-sm font-semibold text-gray-400">
                        {formatCurrency(suggestion.currentPlan.totalInterest)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* New Plan */}
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-emerald-500/20 rounded">
                      <TrendingDown className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-xs text-emerald-400">With Surplus</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Debt-Free In</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {suggestion.suggestedPlan.monthsToDebtFree} months
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(suggestion.suggestedPlan.debtFreeDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Interest</p>
                      <p className="text-sm font-semibold text-emerald-400">
                        {formatCurrency(suggestion.suggestedPlan.totalInterest)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Savings Summary */}
            {amount > 0 && suggestion.impact && (
              <div className="p-4 bg-[#242424] border border-[#2a2a2a] rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">Impact</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Time Saved</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {suggestion.impact.monthsSaved} month{suggestion.impact.monthsSaved !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {suggestion.impact.percentageFaster}% faster
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Interest Saved</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {formatCurrency(suggestion.impact.interestSaved)}
                    </p>
                    <p className="text-xs text-gray-500">Less interest paid</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 border-[#2a2a2a] text-gray-400 hover:bg-[#242424]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={applying || amount <= 0}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
              >
                {applying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  `Apply ${formatCurrency(amount)}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
