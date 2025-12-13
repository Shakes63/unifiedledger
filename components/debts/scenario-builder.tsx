'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus, Trash2 } from 'lucide-react';
import type { PayoffMethod, PaymentFrequency, LumpSumPayment } from '@/lib/debts/payoff-calculator';

export interface Scenario {
  id: string;
  name: string;
  extraMonthlyPayment: number;
  lumpSumPayments: LumpSumPayment[];
  method: PayoffMethod;
  paymentFrequency?: PaymentFrequency;
}

interface ScenarioBuilderProps {
  scenario: Scenario;
  onUpdate: (scenario: Scenario) => void;
  onDelete: () => void;
  isBaseline?: boolean;
}

export function ScenarioBuilder({
  scenario,
  onUpdate,
  onDelete,
  isBaseline = false,
}: ScenarioBuilderProps) {
  const [showLumpSumForm, setShowLumpSumForm] = useState(false);
  const [newLumpSum, setNewLumpSum] = useState({ month: 1, amount: 0 });

  const handleNameChange = (name: string) => {
    onUpdate({ ...scenario, name });
  };

  const handleExtraPaymentChange = (value: string) => {
    const amount = parseFloat(value) || 0;
    onUpdate({ ...scenario, extraMonthlyPayment: Math.max(0, amount) });
  };

  const handleMethodChange = (method: PayoffMethod) => {
    onUpdate({ ...scenario, method });
  };

  const handleFrequencyChange = (frequency: PaymentFrequency) => {
    onUpdate({ ...scenario, paymentFrequency: frequency });
  };

  const handleAddLumpSum = () => {
    if (newLumpSum.amount > 0 && newLumpSum.month > 0) {
      onUpdate({
        ...scenario,
        lumpSumPayments: [
          ...scenario.lumpSumPayments,
          { ...newLumpSum },
        ].sort((a, b) => a.month - b.month),
      });
      setNewLumpSum({ month: 1, amount: 0 });
      setShowLumpSumForm(false);
    }
  };

  const handleRemoveLumpSum = (index: number) => {
    onUpdate({
      ...scenario,
      lumpSumPayments: scenario.lumpSumPayments.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Input
          value={scenario.name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="text-lg font-semibold bg-elevated border-border text-foreground flex-1 mr-3"
          placeholder="Scenario name"
        />
        {!isBaseline && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-(--color-error) hover:text-(--color-error)/80 hover:bg-(--color-error)/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {isBaseline && (
        <div className="mb-4 p-2 bg-(--color-primary)/10 border border-(--color-primary)/30 rounded text-sm text-(--color-primary)">
          This is your baseline scenario for comparison
        </div>
      )}

      {/* Extra Monthly Payment */}
      <div className="mb-4">
        <Label htmlFor={`extra-${scenario.id}`} className="text-foreground mb-2 block">
          Extra {scenario.paymentFrequency === 'biweekly' ? 'Per Payment' : 'Monthly Payment'}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id={`extra-${scenario.id}`}
            type="number"
            min="0"
            step="10"
            value={scenario.extraMonthlyPayment}
            onChange={(e) => handleExtraPaymentChange(e.target.value)}
            className="pl-7 bg-elevated border-border text-foreground"
            placeholder="0.00"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {scenario.paymentFrequency === 'biweekly'
            ? `Per payment (${(scenario.extraMonthlyPayment * 26).toFixed(0)}/year)`
            : 'Amount above minimum payments to apply toward debts'}
        </p>
      </div>

      {/* Payment Frequency */}
      <div className="mb-4">
        <Label className="text-foreground mb-2 block">Payment Frequency</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleFrequencyChange('weekly')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.paymentFrequency === 'weekly'
                ? 'bg-(--color-success) text-white'
                : 'bg-elevated text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => handleFrequencyChange('biweekly')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.paymentFrequency === 'biweekly'
                ? 'bg-(--color-primary) text-white'
                : 'bg-elevated text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            Bi-Weekly
          </button>
          <button
            onClick={() => handleFrequencyChange('monthly')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              (scenario.paymentFrequency || 'monthly') === 'monthly'
                ? 'bg-accent text-accent-foreground'
                : 'bg-elevated text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => handleFrequencyChange('quarterly')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.paymentFrequency === 'quarterly'
                ? 'bg-(--color-warning) text-white'
                : 'bg-elevated text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            Quarterly
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {scenario.paymentFrequency === 'weekly' && '52 payments/year - Fastest payoff'}
          {scenario.paymentFrequency === 'biweekly' && '26 payments/year - 1 extra annually'}
          {(scenario.paymentFrequency === 'monthly' || !scenario.paymentFrequency) && '12 payments/year - Standard'}
          {scenario.paymentFrequency === 'quarterly' && '4 payments/year - Slower payoff'}
        </p>
      </div>

      {/* Payment Method */}
      <div className="mb-4">
        <Label className="text-foreground mb-2 block">Payment Method</Label>
        <div className="flex gap-2">
          <button
            onClick={() => handleMethodChange('snowball')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.method === 'snowball'
                ? 'bg-(--color-transfer) text-primary-foreground'
                : 'bg-elevated text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            Snowball
          </button>
          <button
            onClick={() => handleMethodChange('avalanche')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.method === 'avalanche'
                ? 'bg-(--color-transfer) text-primary-foreground'
                : 'bg-elevated text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            Avalanche
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {scenario.method === 'snowball'
            ? 'Pay smallest balance first (quick wins)'
            : 'Pay highest interest first (save most money)'}
        </p>
      </div>

      {/* Lump Sum Payments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-foreground">Lump Sum Payments</Label>
          {!showLumpSumForm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLumpSumForm(true)}
              className="text-(--color-primary) hover:text-(--color-primary)/80 h-auto py-1"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Existing lump sums */}
        {scenario.lumpSumPayments.length > 0 && (
          <div className="space-y-2 mb-3">
            {scenario.lumpSumPayments.map((lumpSum, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-elevated rounded-lg"
              >
                <div className="flex-1">
                  <span className="text-foreground font-medium">
                    ${lumpSum.amount.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground ml-2 text-sm">
                    in month {lumpSum.month}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveLumpSum(index)}
                  className="text-(--color-error) hover:text-(--color-error)/80 h-auto p-1"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add lump sum form */}
        {showLumpSumForm && (
          <div className="p-4 bg-elevated rounded-lg border border-border space-y-3">
            <div>
              <Label htmlFor={`lump-amount-${scenario.id}`} className="text-foreground mb-1 block text-sm">
                Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id={`lump-amount-${scenario.id}`}
                  type="number"
                  min="1"
                  step="100"
                  value={newLumpSum.amount || ''}
                  onChange={(e) =>
                    setNewLumpSum({ ...newLumpSum, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="pl-7 bg-card border-border text-foreground"
                  placeholder="5000"
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`lump-month-${scenario.id}`} className="text-foreground mb-1 block text-sm">
                Apply in Month
              </Label>
              <Input
                id={`lump-month-${scenario.id}`}
                type="number"
                min="1"
                step="1"
                value={newLumpSum.month}
                onChange={(e) =>
                  setNewLumpSum({ ...newLumpSum, month: parseInt(e.target.value) || 1 })
                }
                className="bg-card border-border text-foreground"
                placeholder="3"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Which month from now to apply this payment
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddLumpSum}
                className="flex-1 bg-(--color-primary) hover:opacity-90 text-white"
                disabled={newLumpSum.amount <= 0 || newLumpSum.month < 1}
              >
                Add
              </Button>
              <Button
                onClick={() => {
                  setShowLumpSumForm(false);
                  setNewLumpSum({ month: 1, amount: 0 });
                }}
                variant="outline"
                className="flex-1 border-border text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {scenario.lumpSumPayments.length === 0 && !showLumpSumForm && (
          <p className="text-sm text-muted-foreground italic">
            No lump sum payments added
          </p>
        )}
      </div>
    </div>
  );
}
