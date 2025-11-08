'use client';

import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TransactionIndicators } from './transaction-indicators';
import { TrendingDown, TrendingUp, ArrowRightLeft, Plus } from 'lucide-react';
import Link from 'next/link';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  category?: string;
}

interface Bill {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
}

interface CalendarDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  transactions?: Transaction[];
  bills?: Bill[];
  transactionCounts?: {
    incomeCount: number;
    expenseCount: number;
    transferCount: number;
    totalSpent: number;
    billDueCount: number;
    billOverdueCount: number;
  };
}

export function CalendarDayModal({
  open,
  onOpenChange,
  date,
  transactions = [],
  bills = [],
  transactionCounts,
}: CalendarDayModalProps) {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'expense':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      case 'transfer_in':
      case 'transfer_out':
        return <ArrowRightLeft className="w-4 h-4 text-blue-400" />;
      default:
        return null;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'text-emerald-400';
      case 'expense':
        return 'text-red-400';
      case 'transfer_in':
      case 'transfer_out':
        return 'text-blue-400';
      default:
        return 'text-white';
    }
  };

  const getBillStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-400/10 text-emerald-400';
      case 'overdue':
        return 'bg-red-600/10 text-red-500';
      case 'pending':
        return 'bg-amber-400/10 text-amber-400';
      default:
        return 'bg-gray-400/10 text-gray-400';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {format(date, 'EEEE, MMMM d, yyyy')}
          </DialogTitle>
          <DialogDescription className="text-[#9ca3af]">
            View and manage transactions and bills for this day
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Indicators */}
          {transactionCounts && (
            <TransactionIndicators
              incomeCount={transactionCounts.incomeCount}
              expenseCount={transactionCounts.expenseCount}
              transferCount={transactionCounts.transferCount}
              billDueCount={transactionCounts.billDueCount}
              billOverdueCount={transactionCounts.billOverdueCount}
              totalSpent={transactionCounts.totalSpent}
              compact={false}
            />
          )}

          {/* Transactions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">
                Transactions ({transactions.length})
              </h3>
              <Link href="/dashboard/transactions/new">
                <Button
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </Link>
            </div>

            {transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-3 bg-[#242424] rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a] transition"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getTransactionIcon(txn.type)}
                      <div>
                        <p className="font-medium text-white">
                          {txn.description}
                        </p>
                        {txn.category && (
                          <p className="text-[#6b7280] text-sm">
                            {txn.category}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className={`font-semibold ${getTransactionColor(txn.type)}`}>
                      {txn.type === 'expense' || txn.type === 'transfer_out'
                        ? '-'
                        : '+'}
                      ${Math.abs(txn.amount).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#6b7280] text-sm">
                No transactions on this day
              </p>
            )}
          </div>

          {/* Bills */}
          {bills.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">
                Bills ({bills.length})
              </h3>
              <div className="space-y-2">
                {bills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-3 bg-[#242424] rounded-lg border border-[#2a2a2a]"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-white">
                        {bill.description}
                      </p>
                      <p className="text-[#6b7280] text-sm">
                        Due: {format(new Date(bill.dueDate), 'MMM d')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-red-400">
                        ${bill.amount.toFixed(2)}
                      </p>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${getBillStatusColor(
                          bill.status
                        )}`}
                      >
                        {bill.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {transactions.length === 0 && bills.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[#6b7280] mb-4">
                No transactions or bills on this day
              </p>
              <Link href="/dashboard/transactions/new">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transaction
                </Button>
              </Link>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
