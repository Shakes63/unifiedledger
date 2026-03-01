'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

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
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold } = useHouseholdFetch();
  const [amount, setAmount] = useState(suggestedAmount);
  const [suggestion, setSuggestion] = useState<SuggestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const fetchSuggestion = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchWithHousehold('/api/budgets/surplus-suggestion');

      if (!response.ok) {
        throw new Error('Failed to fetch suggestion');
      }

      const data = await response.json();
      setSuggestion(data);
    } catch (err) {
      console.error('Error fetching suggestion:', err);
      if (err instanceof Error && err.message === 'No household selected') {
        setLoading(false);
        return;
      }
    }
  }, [fetchWithHousehold]);

  useEffect(() => {
    if (isOpen && selectedHouseholdId) {
      fetchSuggestion();
    } else if (isOpen && !selectedHouseholdId) {
      setLoading(false);
    }
  }, [isOpen, selectedHouseholdId, fetchSuggestion]);

  const handleApply = async () => {
    try {
      setApplying(true);

      const response = await postWithHousehold('/api/budgets/apply-surplus', {
        amount,
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
      <DialogContent className="max-w-2xl" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--color-foreground)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)' }}>
              <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
            </div>
            Apply Budget Surplus to Debt
          </DialogTitle>
          <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
            Use your available budget surplus to accelerate debt payoff
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-muted-foreground)' }} />
          </div>
        ) : !suggestion?.hasSuggestion ? (
          <div className="py-8 text-center text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>
            {suggestion?.reason === 'no_debts' ? 'You have no active debts to pay off.' : 'No surplus available to apply.'}
          </div>
        ) : (
          <div className="space-y-4 mt-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Amount to Apply</label>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--color-foreground)' }}>{formatCurrency(amount)}</span>
                  <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>/ month</span>
                </div>
              </div>
              <Slider value={[amount]} onValueChange={v => setAmount(v[0])} max={availableAmount} min={0} step={10} className="w-full" />
              <div className="flex justify-between text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                <span>$0</span>
                <span style={{ color: 'var(--color-success)' }}>Suggested: {formatCurrency(suggestedAmount)}</span>
                <span>{formatCurrency(availableAmount)}</span>
              </div>
            </div>

            {amount > 0 && suggestion.impact && suggestion.currentPlan && suggestion.suggestedPlan && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-muted-foreground) 10%, transparent)' }}>
                      <Clock className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--color-muted-foreground)' }}>Current Plan</span>
                  </div>
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>Debt-Free In</p>
                    <p className="text-[16px] font-bold tabular-nums" style={{ color: 'var(--color-foreground)' }}>{suggestion.currentPlan.monthsToDebtFree} months</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>{formatDate(suggestion.currentPlan.debtFreeDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>Total Interest</p>
                    <p className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>{formatCurrency(suggestion.currentPlan.totalInterest)}</p>
                  </div>
                </div>
                <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 20%, transparent)' }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)' }}>
                      <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--color-success)' }}>With Surplus</span>
                  </div>
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>Debt-Free In</p>
                    <p className="text-[16px] font-bold tabular-nums" style={{ color: 'var(--color-success)' }}>{suggestion.suggestedPlan.monthsToDebtFree} months</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>{formatDate(suggestion.suggestedPlan.debtFreeDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>Total Interest</p>
                    <p className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--color-success)' }}>{formatCurrency(suggestion.suggestedPlan.totalInterest)}</p>
                  </div>
                </div>
              </div>
            )}

            {amount > 0 && suggestion.impact && (
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--color-foreground)' }}>Impact</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Time Saved</p>
                    <p className="text-[16px] font-bold tabular-nums" style={{ color: 'var(--color-success)' }}>{suggestion.impact.monthsSaved} month{suggestion.impact.monthsSaved !== 1 ? 's' : ''}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>{suggestion.impact.percentageFaster}% faster</p>
                  </div>
                  <div>
                    <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Interest Saved</p>
                    <p className="text-[16px] font-bold tabular-nums" style={{ color: 'var(--color-success)' }}>{formatCurrency(suggestion.impact.interestSaved)}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Less interest paid</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button onClick={onClose} variant="outline" className="flex-1 h-9 text-[13px]">Cancel</Button>
              <Button onClick={handleApply} disabled={applying || amount <= 0} className="flex-1 h-9 text-[13px]" style={{ backgroundColor: 'var(--color-success)', color: 'white' }}>
                {applying ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Applying…</> : `Apply ${formatCurrency(amount)}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
