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
    <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Input
          value={scenario.name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="text-lg font-semibold bg-[#242424] border-[#2a2a2a] text-white flex-1 mr-3"
          placeholder="Scenario name"
        />
        {!isBaseline && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {isBaseline && (
        <div className="mb-4 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-blue-400">
          This is your baseline scenario for comparison
        </div>
      )}

      {/* Extra Monthly Payment */}
      <div className="mb-4">
        <Label htmlFor={`extra-${scenario.id}`} className="text-[#e5e5e5] mb-2 block">
          Extra {scenario.paymentFrequency === 'biweekly' ? 'Per Payment' : 'Monthly Payment'}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#808080]">$</span>
          <Input
            id={`extra-${scenario.id}`}
            type="number"
            min="0"
            step="10"
            value={scenario.extraMonthlyPayment}
            onChange={(e) => handleExtraPaymentChange(e.target.value)}
            className="pl-7 bg-[#242424] border-[#2a2a2a] text-white"
            placeholder="0.00"
          />
        </div>
        <p className="text-xs text-[#808080] mt-1">
          {scenario.paymentFrequency === 'biweekly'
            ? `Per payment (${(scenario.extraMonthlyPayment * 26).toFixed(0)}/year)`
            : 'Amount above minimum payments to apply toward debts'}
        </p>
      </div>

      {/* Payment Frequency */}
      <div className="mb-4">
        <Label className="text-[#e5e5e5] mb-2 block">Payment Frequency</Label>
        <div className="flex gap-2">
          <button
            onClick={() => handleFrequencyChange('monthly')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              (scenario.paymentFrequency || 'monthly') === 'monthly'
                ? 'bg-[#60a5fa] text-white'
                : 'bg-[#242424] text-[#808080] hover:text-white border border-[#2a2a2a]'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => handleFrequencyChange('biweekly')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.paymentFrequency === 'biweekly'
                ? 'bg-[#10b981] text-white'
                : 'bg-[#242424] text-[#808080] hover:text-white border border-[#2a2a2a]'
            }`}
          >
            Bi-Weekly
          </button>
        </div>
        <p className="text-xs text-[#808080] mt-1">
          {scenario.paymentFrequency === 'biweekly'
            ? '26 payments/year (1 extra annually)'
            : '12 payments per year'}
        </p>
      </div>

      {/* Payment Method */}
      <div className="mb-4">
        <Label className="text-[#e5e5e5] mb-2 block">Payment Method</Label>
        <div className="flex gap-2">
          <button
            onClick={() => handleMethodChange('snowball')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.method === 'snowball'
                ? 'bg-[#60a5fa] text-white'
                : 'bg-[#242424] text-[#808080] hover:text-white border border-[#2a2a2a]'
            }`}
          >
            Snowball
          </button>
          <button
            onClick={() => handleMethodChange('avalanche')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario.method === 'avalanche'
                ? 'bg-[#60a5fa] text-white'
                : 'bg-[#242424] text-[#808080] hover:text-white border border-[#2a2a2a]'
            }`}
          >
            Avalanche
          </button>
        </div>
        <p className="text-xs text-[#808080] mt-1">
          {scenario.method === 'snowball'
            ? 'Pay smallest balance first (quick wins)'
            : 'Pay highest interest first (save most money)'}
        </p>
      </div>

      {/* Lump Sum Payments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-[#e5e5e5]">Lump Sum Payments</Label>
          {!showLumpSumForm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLumpSumForm(true)}
              className="text-blue-400 hover:text-blue-300 h-auto py-1"
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
                className="flex items-center justify-between p-3 bg-[#242424] rounded-lg"
              >
                <div className="flex-1">
                  <span className="text-white font-medium">
                    ${lumpSum.amount.toLocaleString()}
                  </span>
                  <span className="text-[#808080] ml-2 text-sm">
                    in month {lumpSum.month}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveLumpSum(index)}
                  className="text-red-400 hover:text-red-300 h-auto p-1"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add lump sum form */}
        {showLumpSumForm && (
          <div className="p-4 bg-[#242424] rounded-lg border border-[#2a2a2a] space-y-3">
            <div>
              <Label htmlFor={`lump-amount-${scenario.id}`} className="text-[#e5e5e5] mb-1 block text-sm">
                Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#808080]">$</span>
                <Input
                  id={`lump-amount-${scenario.id}`}
                  type="number"
                  min="1"
                  step="100"
                  value={newLumpSum.amount || ''}
                  onChange={(e) =>
                    setNewLumpSum({ ...newLumpSum, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="pl-7 bg-[#1a1a1a] border-[#2a2a2a] text-white"
                  placeholder="5000"
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`lump-month-${scenario.id}`} className="text-[#e5e5e5] mb-1 block text-sm">
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
                className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
                placeholder="3"
              />
              <p className="text-xs text-[#808080] mt-1">
                Which month from now to apply this payment
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddLumpSum}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
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
                className="flex-1 border-[#2a2a2a] text-gray-400 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {scenario.lumpSumPayments.length === 0 && !showLumpSumForm && (
          <p className="text-sm text-[#808080] italic">
            No lump sum payments added
          </p>
        )}
      </div>
    </div>
  );
}
