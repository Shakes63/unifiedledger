'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Copy } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { parseISO, format } from 'date-fns';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  accountId: string;
  categoryId?: string;
  notes?: string;
}

interface RecentTransactionsProps {
  limit?: number;
  showViewAll?: boolean;
}

export function RecentTransactions({ limit = 5, showViewAll = true }: RecentTransactionsProps) {
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [repeatingTxId, setRepeatingTxId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const response = await fetchWithHousehold(`/api/transactions?limit=${limit}`);
        if (response.ok) {
          const data = await response.json();
          setTransactions(data.slice(0, limit)); // API already returns newest first
        }
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [limit, selectedHouseholdId, fetchWithHousehold]);

  const handleRepeatTransaction = async (transaction: Transaction) => {
    try {
      setRepeatingTxId(transaction.id);

      // Use toLocaleDateString with 'en-CA' locale to get YYYY-MM-DD format in local timezone
      // This avoids the UTC timezone issue where toISOString() could return yesterday's date
      const today = new Date().toLocaleDateString('en-CA');

      const response = await postWithHousehold('/api/transactions', {
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        date: today,
        amount: transaction.amount,
        description: transaction.description,
        notes: transaction.notes,
        type: transaction.type,
      });

      if (response.ok) {
        await response.json(); // Consume the response but don't use it for state
        // Refetch transactions to get accurate data with full fields
        const refreshResponse = await fetchWithHousehold(`/api/transactions?limit=${limit}`);
        if (refreshResponse.ok) {
          const refreshedData = await refreshResponse.json();
          setTransactions(refreshedData.slice(0, limit));
        }
        toast.success(`Transaction repeated: ${transaction.description}`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to repeat transaction');
      }
    } catch (error) {
      console.error('Error repeating transaction:', error);
      toast.error('Failed to repeat transaction');
    } finally {
      setRepeatingTxId(null);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />;
      case 'expense':
        return <ArrowUpRight className="w-4 h-4 text-red-400" />;
      case 'transfer_in':
      case 'transfer_out':
        return <ArrowRightLeft className="w-4 h-4 text-blue-400" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'expense':
        return 'bg-red-500/20 text-red-400';
      case 'transfer_in':
      case 'transfer_out':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
        <p className="text-gray-400 text-center">Loading transactions...</p>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
        <p className="text-gray-400 text-center mb-4">No transactions yet.</p>
        <Link href="/dashboard/transactions/new">
          <Button className="w-full bg-[var(--color-primary)] text-white hover:opacity-90 font-medium">
            Add Transaction
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <Card
          key={transaction.id}
          className="p-4 border border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#242424] transition-colors rounded-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2.5 bg-[#242424] rounded-lg">
                {getTransactionIcon(transaction.type)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-white truncate">
                  {transaction.description}
                </p>
                <p className="text-xs text-gray-500">
                  {format(parseISO(transaction.date), 'EEE, MMM d')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p
                  className="font-semibold text-sm"
                  style={{
                    color: transaction.type === 'income'
                      ? 'var(--color-income)'
                      : transaction.type === 'transfer' || transaction.type === 'transfer_in' || transaction.type === 'transfer_out'
                      ? 'var(--color-transfer)'
                      : 'var(--color-expense)'
                  }}
                >
                  {transaction.type === 'income' ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                </p>
                <Badge className={`${getTypeColor(transaction.type)} text-xs`} variant="secondary">
                  {transaction.type.replace('_', ' ')}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRepeatTransaction(transaction)}
                disabled={repeatingTxId === transaction.id}
                className="text-gray-400 hover:text-white hover:bg-[#242424]"
                title="Repeat this transaction with today's date"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
      {showViewAll && (
        <Link href="/dashboard/transactions">
          <Button variant="outline" className="w-full rounded-lg border-[#2a2a2a]">
            View All Transactions
          </Button>
        </Link>
      )}
    </div>
  );
}
