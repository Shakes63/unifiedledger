'use client';

import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react';

interface Milestone {
  id: string;
  percentage: number;
  milestoneBalance: number;
  achievedAt?: string;
}

interface DebtTrackerProps {
  debt: {
    id: string;
    name: string;
    creditorName: string;
    originalAmount: number;
    remainingBalance: number;
    minimumPayment?: number;
    interestRate: number;
    type: string;
    color: string;
    status: string;
    targetPayoffDate?: string;
  };
  milestones?: Milestone[];
  payments?: any[];
  onEdit?: (debt: any) => void;
  onDelete?: (debtId: string) => void;
  onPayment?: (debtId: string, amount: number) => void;
}

export function DebtPayoffTracker({
  debt,
  milestones = [],
  payments = [],
  onEdit,
  onDelete,
  onPayment,
}: DebtTrackerProps) {
  const [showMilestones, setShowMilestones] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  const progressPercent = Math.min((debt.originalAmount - debt.remainingBalance) / debt.originalAmount * 100, 100);
  const paidOff = debt.originalAmount - debt.remainingBalance;
  const daysLeft = debt.targetPayoffDate
    ? Math.ceil(
        (new Date(debt.targetPayoffDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  const handlePayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const response = await fetch(`/api/debts/${debt.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paymentDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to record payment');

      onPayment?.(debt.id, amount);
      setPaymentAmount('');
      setShowPayment(false);
      toast.success(`Payment of $${amount.toFixed(2)} recorded!`);
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-4 hover:border-[#3a3a3a] transition-colors">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: debt.color }}
              />
              <h3 className="font-semibold text-white">{debt.name}</h3>
              {debt.status === 'paid_off' && (
                <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded">
                  Paid Off
                </span>
              )}
              {debt.status === 'paused' && (
                <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-1 rounded">
                  Paused
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{debt.creditorName}</p>
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(debt)}
                className="text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(debt.id)}
                className="text-gray-400 hover:text-red-400 hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">
              ${debt.remainingBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} remaining of $
              {debt.originalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
            <span className="text-white font-semibold">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2 bg-[#2a2a2a]" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="text-gray-500 text-xs">Paid Off</p>
            <p className="text-white font-semibold">
              ${paidOff.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>
          {debt.minimumPayment && (
            <div>
              <p className="text-gray-500 text-xs">Min Payment</p>
              <p className="text-white font-semibold">
                ${debt.minimumPayment.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
          )}
          {daysLeft !== null ? (
            <div>
              <p className="text-gray-500 text-xs">Days Left</p>
              <p className={`font-semibold ${daysLeft < 0 ? 'text-red-400' : 'text-white'}`}>
                {daysLeft < 0 ? `${Math.abs(daysLeft)} ago` : daysLeft}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-gray-500 text-xs">Type</p>
              <p className="text-white font-semibold capitalize">{debt.type.replace(/_/g, ' ')}</p>
            </div>
          )}
        </div>

        {/* Interest Rate */}
        {debt.interestRate > 0 && (
          <div className="bg-[#242424] border border-[#2a2a2a] rounded p-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Interest Rate</span>
              <span className="text-sm text-white font-semibold">{debt.interestRate.toFixed(2)}%</span>
            </div>
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="border-t border-[#2a2a2a] pt-3">
            <button
              onClick={() => setShowMilestones(!showMilestones)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              {showMilestones ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Milestones
            </button>
            {showMilestones && (
              <div className="mt-3 space-y-2">
                {milestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center gap-3 text-sm">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-400">{milestone.percentage}%</span>
                        <span className="text-gray-500">
                          ${milestone.milestoneBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <Progress
                        value={milestone.achievedAt ? 100 : 0}
                        className="h-1.5 bg-[#2a2a2a]"
                      />
                    </div>
                    {milestone.achievedAt && (
                      <span className="text-emerald-400 text-xs">✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Record Payment Button */}
        {debt.status !== 'paid_off' && (
          <div className="border-t border-[#2a2a2a] pt-3">
            {!showPayment ? (
              <Button
                onClick={() => setShowPayment(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Record Payment
              </Button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="flex-1 bg-[#242424] border border-[#2a2a2a] rounded px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600"
                  step="0.01"
                  min="0"
                />
                <Button
                  onClick={handlePayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Record
                </Button>
                <Button
                  onClick={() => setShowPayment(false)}
                  variant="outline"
                  className="border-[#2a2a2a] text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
