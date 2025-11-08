'use client';

import { DollarSign, TrendingUp, TrendingDown, ArrowRightLeft, AlertCircle } from 'lucide-react';

interface TransactionIndicatorsProps {
  incomeCount?: number;
  expenseCount?: number;
  transferCount?: number;
  billDueCount?: number;
  billOverdueCount?: number;
  totalSpent?: number;
  compact?: boolean;
}

export function TransactionIndicators({
  incomeCount = 0,
  expenseCount = 0,
  transferCount = 0,
  billDueCount = 0,
  billOverdueCount = 0,
  totalSpent,
  compact = false,
}: TransactionIndicatorsProps) {
  if (compact) {
    // Compact view for calendar day cells
    const totalTransactions =
      incomeCount + expenseCount + transferCount;
    const totalBills = billDueCount + billOverdueCount;

    if (totalTransactions === 0 && totalBills === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {incomeCount > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-400/20 text-emerald-400 text-xs">
            <TrendingUp className="w-3 h-3" />
            <span>{incomeCount}</span>
          </div>
        )}
        {expenseCount > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-400/20 text-red-400 text-xs">
            <TrendingDown className="w-3 h-3" />
            <span>{expenseCount}</span>
          </div>
        )}
        {transferCount > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-400/20 text-blue-400 text-xs">
            <ArrowRightLeft className="w-3 h-3" />
            <span>{transferCount}</span>
          </div>
        )}
        {billOverdueCount > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600/20 text-red-500 text-xs font-semibold">
            <AlertCircle className="w-3 h-3" />
            <span>{billOverdueCount}</span>
          </div>
        )}
        {billDueCount > 0 && billOverdueCount === 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-400/20 text-amber-400 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>{billDueCount}</span>
          </div>
        )}
      </div>
    );
  }

  // Full view for day detail modal
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Transactions */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#6b7280] text-sm">Transactions</span>
          <DollarSign className="w-4 h-4 text-[#9ca3af]" />
        </div>
        <div className="space-y-1">
          {incomeCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Income
              </span>
              <span className="font-medium text-white">{incomeCount}</span>
            </div>
          )}
          {expenseCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-red-400 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                Expenses
              </span>
              <span className="font-medium text-white">{expenseCount}</span>
            </div>
          )}
          {transferCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-400 flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3" />
                Transfers
              </span>
              <span className="font-medium text-white">{transferCount}</span>
            </div>
          )}
          {totalSpent !== undefined && totalSpent > 0 && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-[#2a2a2a]">
              <span className="text-[#9ca3af]">Total Spent</span>
              <span className="font-medium text-red-400">
                ${Math.abs(totalSpent).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bills */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#6b7280] text-sm">Bills</span>
          <AlertCircle className="w-4 h-4 text-[#9ca3af]" />
        </div>
        <div className="space-y-1">
          {billOverdueCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-red-500 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3 h-3" />
                Overdue
              </span>
              <span className="font-medium text-red-500">
                {billOverdueCount}
              </span>
            </div>
          )}
          {billDueCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Due Soon
              </span>
              <span className="font-medium text-amber-400">
                {billDueCount}
              </span>
            </div>
          )}
          {billOverdueCount === 0 && billDueCount === 0 && (
            <p className="text-[#6b7280] text-sm">No bills on this day</p>
          )}
        </div>
      </div>
    </div>
  );
}
