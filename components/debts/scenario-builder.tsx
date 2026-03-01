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
    <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Input
          value={scenario.name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="text-lg font-semibold flex-1 mr-3"
          style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
          placeholder="Scenario name"
        />
        {!isBaseline && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            style={{ color: 'var(--color-destructive)' }}
            className="hover:opacity-80 hover:bg-[color-mix(in_oklch,var(--color-destructive)_10%,transparent)]"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {isBaseline && (
        <div
          className="mb-4 p-2 rounded text-sm"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)',
            border: '1px solid color-mix(in oklch, var(--color-primary) 25%, transparent)',
            color: 'var(--color-primary)',
          }}
        >
          This is your baseline scenario for comparison
        </div>
      )}

      {/* Extra Monthly Payment */}
      <div className="mb-4">
        <Label htmlFor={`extra-${scenario.id}`} className="mb-2 block" style={{ color: 'var(--color-foreground)' }}>
          Extra {scenario.paymentFrequency === 'biweekly' ? 'Per Payment' : 'Monthly Payment'}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-muted-foreground)' }}>$</span>
          <Input
            id={`extra-${scenario.id}`}
            type="number"
            min="0"
            step="10"
            value={scenario.extraMonthlyPayment}
            onChange={(e) => handleExtraPaymentChange(e.target.value)}
            className="pl-7"
            style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
            placeholder="0.00"
          />
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
          {scenario.paymentFrequency === 'biweekly'
            ? `Per payment (${(scenario.extraMonthlyPayment * 26).toFixed(0)}/year)`
            : 'Amount above minimum payments to apply toward debts'}
        </p>
      </div>

      {/* Payment Frequency */}
      <div className="mb-4">
        <Label className="mb-2 block" style={{ color: 'var(--color-foreground)' }}>Payment Frequency</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleFrequencyChange('weekly')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.paymentFrequency === 'weekly' ? 'text-white' : '[&:hover]:[color:var(--color-foreground)]'
            }`}
            style={{
              backgroundColor: scenario.paymentFrequency === 'weekly' ? 'var(--color-success)' : 'var(--color-elevated)',
              color: scenario.paymentFrequency === 'weekly' ? undefined : 'var(--color-muted-foreground)',
              border: scenario.paymentFrequency === 'weekly' ? undefined : '1px solid var(--color-border)',
            }}
          >
            Weekly
          </button>
          <button
            onClick={() => handleFrequencyChange('biweekly')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.paymentFrequency === 'biweekly' ? 'text-white' : '[&:hover]:[color:var(--color-foreground)]'
            }`}
            style={{
              backgroundColor: scenario.paymentFrequency === 'biweekly' ? 'var(--color-primary)' : 'var(--color-elevated)',
              color: scenario.paymentFrequency === 'biweekly' ? undefined : 'var(--color-muted-foreground)',
              border: scenario.paymentFrequency === 'biweekly' ? undefined : '1px solid var(--color-border)',
            }}
          >
            Bi-Weekly
          </button>
          <button
            onClick={() => handleFrequencyChange('monthly')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              (scenario.paymentFrequency || 'monthly') === 'monthly' ? '' : '[&:hover]:[color:var(--color-foreground)]'
            }`}
            style={{
              backgroundColor: (scenario.paymentFrequency || 'monthly') === 'monthly' ? 'var(--color-accent)' : 'var(--color-elevated)',
              color: (scenario.paymentFrequency || 'monthly') === 'monthly' ? 'var(--color-accent-foreground)' : 'var(--color-muted-foreground)',
              border: (scenario.paymentFrequency || 'monthly') === 'monthly' ? undefined : '1px solid var(--color-border)',
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => handleFrequencyChange('quarterly')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.paymentFrequency === 'quarterly' ? 'text-white' : '[&:hover]:[color:var(--color-foreground)]'
            }`}
            style={{
              backgroundColor: scenario.paymentFrequency === 'quarterly' ? 'var(--color-warning)' : 'var(--color-elevated)',
              color: scenario.paymentFrequency === 'quarterly' ? undefined : 'var(--color-muted-foreground)',
              border: scenario.paymentFrequency === 'quarterly' ? undefined : '1px solid var(--color-border)',
            }}
          >
            Quarterly
          </button>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
          {scenario.paymentFrequency === 'weekly' && '52 payments/year - Fastest payoff'}
          {scenario.paymentFrequency === 'biweekly' && '26 payments/year - 1 extra annually'}
          {(scenario.paymentFrequency === 'monthly' || !scenario.paymentFrequency) && '12 payments/year - Standard'}
          {scenario.paymentFrequency === 'quarterly' && '4 payments/year - Slower payoff'}
        </p>
      </div>

      {/* Payment Method */}
      <div className="mb-4">
        <Label className="mb-2 block" style={{ color: 'var(--color-foreground)' }}>Payment Method</Label>
        <div className="flex gap-2">
          <button
            onClick={() => handleMethodChange('snowball')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.method === 'snowball' ? '' : '[&:hover]:[color:var(--color-foreground)]'
            }`}
            style={{
              backgroundColor: scenario.method === 'snowball' ? 'var(--color-transfer)' : 'var(--color-elevated)',
              color: scenario.method === 'snowball' ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
              border: scenario.method === 'snowball' ? undefined : '1px solid var(--color-border)',
            }}
          >
            Snowball
          </button>
          <button
            onClick={() => handleMethodChange('avalanche')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.method === 'avalanche' ? '' : '[&:hover]:[color:var(--color-foreground)]'
            }`}
            style={{
              backgroundColor: scenario.method === 'avalanche' ? 'var(--color-transfer)' : 'var(--color-elevated)',
              color: scenario.method === 'avalanche' ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
              border: scenario.method === 'avalanche' ? undefined : '1px solid var(--color-border)',
            }}
          >
            Avalanche
          </button>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
          {scenario.method === 'snowball'
            ? 'Pay smallest balance first (quick wins)'
            : 'Pay highest interest first (save most money)'}
        </p>
      </div>

      {/* Lump Sum Payments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label style={{ color: 'var(--color-foreground)' }}>Lump Sum Payments</Label>
          {!showLumpSumForm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLumpSumForm(true)}
              style={{ color: 'var(--color-primary)' }}
              className="hover:opacity-80 h-auto py-1"
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
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: 'var(--color-elevated)' }}
              >
                <div className="flex-1">
                  <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>
                    ${lumpSum.amount.toLocaleString()}
                  </span>
                  <span className="ml-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                    in month {lumpSum.month}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveLumpSum(index)}
                  style={{ color: 'var(--color-destructive)' }}
                  className="hover:opacity-80 h-auto p-1"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add lump sum form */}
        {showLumpSumForm && (
          <div
            className="p-4 rounded-lg space-y-3"
            style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
          >
            <div>
              <Label htmlFor={`lump-amount-${scenario.id}`} className="mb-1 block text-sm" style={{ color: 'var(--color-foreground)' }}>
                Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-muted-foreground)' }}>$</span>
                <Input
                  id={`lump-amount-${scenario.id}`}
                  type="number"
                  min="1"
                  step="100"
                  value={newLumpSum.amount || ''}
                  onChange={(e) =>
                    setNewLumpSum({ ...newLumpSum, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="pl-7"
                  style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                  placeholder="5000"
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`lump-month-${scenario.id}`} className="mb-1 block text-sm" style={{ color: 'var(--color-foreground)' }}>
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
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                placeholder="3"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                Which month from now to apply this payment
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddLumpSum}
                className="flex-1 hover:opacity-90 text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
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
                className="flex-1 [&:hover]:[color:var(--color-foreground)]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {scenario.lumpSumPayments.length === 0 && !showLumpSumForm && (
          <p className="text-sm italic" style={{ color: 'var(--color-muted-foreground)' }}>
            No lump sum payments added
          </p>
        )}
      </div>
    </div>
  );
}
