'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Repeat2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

interface Transaction {
  id: string;
  accountId: string;
  categoryId?: string;
  date: string;
  amount: number;
  description: string;
  notes?: string;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  isPending: boolean;
  createdAt: string;
}

interface TransactionHistoryProps {
  accountId?: string;
  onRepeat?: (transaction: Transaction) => void;
  onCreateTemplate?: (transaction: Transaction) => void;
}

export function TransactionHistory({
  accountId,
  onRepeat,
  onCreateTemplate,
}: TransactionHistoryProps) {
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repeatingId, setRepeatingId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedHouseholdId) {
      fetchHistory();
    }
  }, [accountId, selectedHouseholdId]);

  const fetchHistory = async () => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const url = new URL('/api/transactions/history', window.location.origin);
      url.searchParams.set('limit', '20');
      url.searchParams.set('offset', '0');
      if (accountId) {
        url.searchParams.set('accountId', accountId);
      }

      const response = await fetchWithHousehold(url.toString().replace(window.location.origin, ''));
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  const handleRepeat = async (transaction: Transaction) => {
    if (onRepeat) {
      onRepeat(transaction);
      return;
    }

    setRepeatingId(transaction.id);
    try {
      const response = await postWithHousehold('/api/transactions/repeat', {
        templateId: transaction.id,
        date: new Date().toISOString().split('T')[0],
      });

      if (!response.ok) throw new Error('Failed to repeat transaction');
      // Refresh history
      fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to repeat transaction');
    } finally {
      setRepeatingId(null);
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'transfer_in':
        return 'Transfer In';
      case 'transfer_out':
        return 'Transfer Out';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No transaction history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <Card
          key={transaction.id}
          className="p-4 border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#242424] transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <p className="font-medium text-white truncate">
                  {transaction.description}
                </p>
                <Badge className={getTypeColor(transaction.type)}>
                  {getTypeLabel(transaction.type)}
                </Badge>
                {transaction.isPending && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                    Pending
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{format(new Date(transaction.date), 'MMM d, yyyy')}</span>
                {transaction.notes && (
                  <span className="italic truncate">{transaction.notes}</span>
                )}
              </div>
            </div>

            <div className="flex items-end flex-col gap-2">
              <p className={`text-lg font-semibold ${
                transaction.type === 'income' || transaction.type === 'transfer_in'
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }`}>
                {transaction.type === 'income' || transaction.type === 'transfer_in' ? '+' : '-'}
                ${transaction.amount.toFixed(2)}
              </p>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 hover:bg-[#2a2a2a]"
                  onClick={() => handleRepeat(transaction)}
                  disabled={repeatingId === transaction.id}
                  title="Repeat this transaction"
                >
                  {repeatingId === transaction.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Repeat2 className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 hover:bg-[#2a2a2a]"
                  onClick={() =>
                    onCreateTemplate && onCreateTemplate(transaction)
                  }
                  disabled={!onCreateTemplate}
                  title="Save as template"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
