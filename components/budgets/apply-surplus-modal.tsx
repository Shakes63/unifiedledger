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
  reason?: string;
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
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Apply Budget Surplus to Debt</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Use your available budget surplus to accelerate debt payoff
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : !suggestion?.hasSuggestion ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
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
                <label className="text-sm text-muted-foreground">Amount to Apply</label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {formatCurrency(amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">/ month</span>
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
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>$0</span>
                  <span className="text-accent">
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
                <div className="p-4 bg-elevated border border-border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-muted/20 rounded">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">Current Plan</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Debt-Free In</p>
                      <p className="text-lg font-bold text-foreground">
                        {suggestion.currentPlan.monthsToDebtFree} months
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(suggestion.currentPlan.debtFreeDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Interest</p>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {formatCurrency(suggestion.currentPlan.totalInterest)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* New Plan */}
                <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-accent/20 rounded">
                      <TrendingDown className="w-4 h-4 text-accent" />
                    </div>
                    <span className="text-xs text-accent">With Surplus</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Debt-Free In</p>
                      <p className="text-lg font-bold text-accent">
                        {suggestion.suggestedPlan.monthsToDebtFree} months
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(suggestion.suggestedPlan.debtFreeDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Interest</p>
                      <p className="text-sm font-semibold text-accent">
                        {formatCurrency(suggestion.suggestedPlan.totalInterest)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Savings Summary */}
            {amount > 0 && suggestion.impact && (
              <div className="p-4 bg-elevated border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-accent" />
                  <span className="text-sm font-semibold text-foreground">Impact</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Time Saved</p>
                    <p className="text-lg font-bold text-accent">
                      {suggestion.impact.monthsSaved} month{suggestion.impact.monthsSaved !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {suggestion.impact.percentageFaster}% faster
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Interest Saved</p>
                    <p className="text-lg font-bold text-accent">
                      {formatCurrency(suggestion.impact.interestSaved)}
                    </p>
                    <p className="text-xs text-muted-foreground">Less interest paid</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 border-border text-muted-foreground hover:bg-elevated"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={applying || amount <= 0}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-medium"
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
