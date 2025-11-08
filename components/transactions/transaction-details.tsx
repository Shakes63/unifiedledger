'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Edit, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SplitsList } from './splits-list';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  date: string;
  amount: number;
  description: string;
  notes: string | null;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  isPending: boolean;
  isSplit: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TransactionDetailsProps {
  transactionId: string;
  onDelete?: () => void;
}

const typeConfig = {
  income: { label: 'Income', color: 'text-[#10b981]', bgColor: 'bg-[#10b981]/10' },
  expense: { label: 'Expense', color: 'text-[#f87171]', bgColor: 'bg-[#f87171]/10' },
  transfer_in: { label: 'Transfer In', color: 'text-[#60a5fa]', bgColor: 'bg-[#60a5fa]/10' },
  transfer_out: { label: 'Transfer Out', color: 'text-[#60a5fa]', bgColor: 'bg-[#60a5fa]/10' },
};

export function TransactionDetails({ transactionId, onDelete }: TransactionDetailsProps) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/transactions/${transactionId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch transaction');
        }
        const data = await response.json();
        setTransaction(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [transactionId]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete transaction');
      }

      toast.success('Transaction deleted successfully');
      onDelete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete transaction: ${message}`);
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-[#9ca3af]">Loading transaction details...</div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <Card className="border-[#f87171]/20 bg-[#f87171]/10 p-6">
        <p className="text-[#f87171]">
          {error || 'Transaction not found'}
        </p>
      </Card>
    );
  }

  const typeInfo = typeConfig[transaction.type];
  const isExpense = transaction.type === 'expense';
  const sign = transaction.type === 'income' || transaction.type === 'transfer_in' ? '+' : '-';
  const amountColor = transaction.type === 'income' ? 'text-[#10b981]' :
                     transaction.type === 'expense' ? 'text-[#f87171]' :
                     'text-[#60a5fa]';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/transactions">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Transactions
          </Button>
        </Link>
        <div className="flex gap-2">
          <Link href={`/dashboard/transactions/${transactionId}/edit`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      <Card className="border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#2a2a2a] pb-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white">{transaction.description}</h1>
              <p className="text-[#9ca3af]">
                {format(new Date(transaction.date), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${amountColor}`}>
                {sign}${Math.abs(transaction.amount).toFixed(2)}
              </div>
              <div className={`inline-block mt-2 px-3 py-1 rounded-lg text-sm font-medium ${typeInfo.bgColor} ${typeInfo.color}`}>
                {typeInfo.label}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-[#6b7280] uppercase tracking-wide">Status</p>
              <p className="text-[#ffffff] font-medium mt-1">
                {transaction.isPending ? 'Pending' : 'Completed'}
              </p>
            </div>
            <div>
              <p className="text-sm text-[#6b7280] uppercase tracking-wide">Date</p>
              <p className="text-[#ffffff] font-medium mt-1">
                {format(new Date(transaction.date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Notes */}
          {transaction.notes && (
            <div className="pt-4 border-t border-[#2a2a2a]">
              <p className="text-sm text-[#6b7280] uppercase tracking-wide">Notes</p>
              <p className="text-[#ffffff] mt-2">{transaction.notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-4 border-t border-[#2a2a2a]">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[#6b7280]">Created</p>
                <p className="text-[#9ca3af] mt-1">
                  {format(new Date(transaction.createdAt), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <div>
                <p className="text-[#6b7280]">Last Updated</p>
                <p className="text-[#9ca3af] mt-1">
                  {format(new Date(transaction.updatedAt), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Splits */}
      {transaction.isSplit && (
        <SplitsList transactionId={transactionId} />
      )}
    </div>
  );
}
