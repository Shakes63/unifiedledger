'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Edit, ArrowLeft, ArrowRightLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SplitsList } from './splits-list';
import { ConvertToTransferModal } from './convert-to-transfer-modal';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  merchantId: string | null;
  billId: string | null;
  debtId: string | null;
  transferId: string | null;
  date: string;
  amount: number;
  description: string;
  notes: string | null;
  type: 'income' | 'expense' | 'transfer' | 'transfer_in' | 'transfer_out';
  isPending: boolean;
  isSplit: boolean;
  isRecurring: boolean;
  recurringRule: string | null;
  receiptUrl: string | null;
  splitParentId: string | null;
  importHistoryId: string | null;
  importRowNumber: number | null;
  syncStatus: string;
  createdAt: string;
  updatedAt: string;
  // Enriched data
  account: Account | null;
  category: Category | null;
  merchant: Merchant | null;
  bill: Bill | null;
  debt: Debt | null;
  tags: Tag[];
  customFields: CustomFieldValue[];
}

interface Account {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Merchant {
  id: string;
  name: string;
}

interface Bill {
  id: string;
  name: string;
}

interface Debt {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface CustomFieldValue {
  field: {
    id: string;
    name: string;
    type: string;
  };
  value: {
    id: string;
    value: string;
  };
}

interface TransactionDetailsProps {
  transactionId: string;
  onDelete?: () => void;
}

const typeConfig = {
  income: { label: 'Income', color: 'text-[#10b981]', bgColor: 'bg-[#10b981]/10' },
  expense: { label: 'Expense', color: 'text-[#f87171]', bgColor: 'bg-[#f87171]/10' },
  transfer: { label: 'Transfer', color: 'text-[#60a5fa]', bgColor: 'bg-[#60a5fa]/10' },
  transfer_in: { label: 'Transfer In', color: 'text-[#60a5fa]', bgColor: 'bg-[#60a5fa]/10' },
  transfer_out: { label: 'Transfer Out', color: 'text-[#60a5fa]', bgColor: 'bg-[#60a5fa]/10' },
};

export function TransactionDetails({ transactionId, onDelete }: TransactionDetailsProps) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch transaction with enriched data
        const txResponse = await fetch(`/api/transactions/${transactionId}`, { credentials: 'include' });
        if (!txResponse.ok) {
          throw new Error('Failed to fetch transaction');
        }
        const txData = await txResponse.json();
        setTransaction(txData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [transactionId]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/transactions/${transactionId}`, { credentials: 'include', method: 'DELETE', });

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

  const handleConvertSuccess = () => {
    // Reload transaction data after conversion
    setLoading(true);
    fetch(`/api/transactions/${transactionId}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setTransaction(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to reload transaction:', err);
        setLoading(false);
      });
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

  const typeInfo = typeConfig[transaction.type as keyof typeof typeConfig] || typeConfig.expense;
  const _isExpense = transaction.type === 'expense';
  const sign = transaction.type === 'income' || transaction.type === 'transfer_in' || transaction.type === 'transfer' ? '+' : '-';
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
          {/* Only show convert button for income/expense (not transfers) */}
          {transaction.type !== 'transfer_out' && transaction.type !== 'transfer_in' && transaction.type !== 'transfer' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConvertModal(true)}
              className="gap-2"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Convert to Transfer
            </Button>
          )}
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
              <h1 className="text-2xl font-bold text-white">
                {transaction.merchant?.name || transaction.description}
              </h1>
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

          {/* Core Details */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-[#6b7280] uppercase tracking-wide">Account</p>
              <p className="text-[#ffffff] font-medium mt-1">
                {transaction.account?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-[#6b7280] uppercase tracking-wide">Status</p>
              <p className="text-[#ffffff] font-medium mt-1">
                {transaction.isPending ? 'Pending' : 'Completed'}
              </p>
            </div>
          </div>

          {/* Description & Category */}
          <div className="pt-4 border-t border-[#2a2a2a]">
            <div className="grid grid-cols-2 gap-6">
              {transaction.merchant && (
                <div>
                  <p className="text-sm text-[#6b7280] uppercase tracking-wide">Description</p>
                  <p className="text-[#ffffff] font-medium mt-1">
                    {transaction.description}
                  </p>
                </div>
              )}
              {transaction.category && (
                <div>
                  <p className="text-sm text-[#6b7280] uppercase tracking-wide">Category</p>
                  <p className="text-[#ffffff] font-medium mt-1">
                    {transaction.category.name}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bill & Debt Linkage */}
          {(transaction.bill || transaction.debt) && (
            <div className="pt-4 border-t border-[#2a2a2a]">
              <div className="grid grid-cols-2 gap-6">
                {transaction.bill && (
                  <div>
                    <p className="text-sm text-[#6b7280] uppercase tracking-wide">Linked Bill</p>
                    <Link href={`/dashboard/bills`} className="text-[#60a5fa] hover:text-[#93c5fd] font-medium mt-1 block">
                      {transaction.bill.name}
                    </Link>
                  </div>
                )}
                {transaction.debt && (
                  <div>
                    <p className="text-sm text-[#6b7280] uppercase tracking-wide">Linked Debt</p>
                    <Link href={`/dashboard/debts`} className="text-[#60a5fa] hover:text-[#93c5fd] font-medium mt-1 block">
                      {transaction.debt.name}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transfer Information */}
          {(transaction.type === 'transfer_out' || transaction.type === 'transfer_in') && (
            <div className="pt-4 border-t border-[#2a2a2a]">
              <p className="text-sm text-[#6b7280] uppercase tracking-wide mb-2">Transfer Details</p>
              <div className="text-[#ffffff] font-medium">
                {transaction.type === 'transfer_out' && 'Transfer from this account'}
                {transaction.type === 'transfer_in' && 'Transfer to this account'}
              </div>
            </div>
          )}

          {/* Tags */}
          {transaction.tags && transaction.tags.length > 0 && (
            <div className="pt-4 border-t border-[#2a2a2a]">
              <p className="text-sm text-[#6b7280] uppercase tracking-wide mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {transaction.tags.map(tag => (
                  <span
                    key={tag.id}
                    className="px-3 py-1 rounded-lg text-sm font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {transaction.customFields && transaction.customFields.length > 0 && (
            <div className="pt-4 border-t border-[#2a2a2a]">
              <p className="text-sm text-[#6b7280] uppercase tracking-wide mb-3">Custom Fields</p>
              <div className="space-y-3">
                {transaction.customFields.map(cf => (
                  <div key={cf.value.id}>
                    <p className="text-sm text-[#9ca3af]">{cf.field.name}</p>
                    <p className="text-[#ffffff] font-medium mt-1">{cf.value.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipt */}
          {transaction.receiptUrl && (
            <div className="pt-4 border-t border-[#2a2a2a]">
              <p className="text-sm text-[#6b7280] uppercase tracking-wide mb-2">Receipt</p>
              <a
                href={transaction.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#60a5fa] hover:text-[#93c5fd] font-medium"
              >
                View Receipt →
              </a>
            </div>
          )}

          {/* Recurring Info */}
          {transaction.isRecurring && transaction.recurringRule && (
            <div className="pt-4 border-t border-[#2a2a2a]">
              <p className="text-sm text-[#6b7280] uppercase tracking-wide">Recurring Transaction</p>
              <p className="text-[#ffffff] font-medium mt-1">{transaction.recurringRule}</p>
            </div>
          )}

          {/* Import Info */}
          {transaction.importHistoryId && (
            <div className="pt-4 border-t border-[#2a2a2a]">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-[#6b7280] uppercase tracking-wide">Import Source</p>
                  <p className="text-[#ffffff] font-medium mt-1">CSV Import</p>
                </div>
                {transaction.importRowNumber && (
                  <div>
                    <p className="text-sm text-[#6b7280] uppercase tracking-wide">Row Number</p>
                    <p className="text-[#ffffff] font-medium mt-1">{transaction.importRowNumber}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sync Status (if offline/pending) */}
          {transaction.syncStatus && transaction.syncStatus !== 'synced' && (
            <div className="pt-4 border-t border-[#2a2a2a]">
              <p className="text-sm text-[#6b7280] uppercase tracking-wide">Sync Status</p>
              <p className="text-[#f59e0b] font-medium mt-1 capitalize">{transaction.syncStatus}</p>
            </div>
          )}

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

      {/* Convert to Transfer Modal */}
      <ConvertToTransferModal
        open={showConvertModal}
        onOpenChange={setShowConvertModal}
        transaction={transaction as any}
        onSuccess={handleConvertSuccess}
      />
    </div>
  );
}
