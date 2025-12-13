'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { Loader2, Search, Link2Off } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Decimal from 'decimal.js';
import type { Transaction, Account } from '@/lib/types';

interface TransactionLinkSelectorProps {
  expectedAmount: number;
  dueDate: string;
  amountTolerance?: number;
  currentTransactionId?: string | null;
  onSelect: (transactionId: string | null, transaction: Transaction | null) => void;
  selectedId: string | null;
}

interface TransactionWithAccount extends Transaction {
  accountName?: string;
  matchScore?: number;
}

export function TransactionLinkSelector({
  expectedAmount,
  dueDate,
  amountTolerance = 5,
  currentTransactionId,
  onSelect,
  selectedId,
}: TransactionLinkSelectorProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [transactions, setTransactions] = useState<TransactionWithAccount[]>([]);
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const dueDateObj = useMemo(() => parseISO(dueDate), [dueDate]);
  const startDate = useMemo(() => subDays(dueDateObj, 7), [dueDateObj]);
  const endDate = useMemo(() => addDays(dueDateObj, 7), [dueDateObj]);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch accounts first
        const accountsResponse = await fetchWithHousehold('/api/accounts');
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          const accountsMap: Record<string, Account> = {};
          accountsData.forEach((acc: Account) => {
            accountsMap[acc.id] = acc;
          });
          setAccounts(accountsMap);
        }

        // Fetch expense transactions within date range
        const params = new URLSearchParams({
          type: 'expense',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          limit: '100',
        });

        const response = await fetchWithHousehold(`/api/transactions?${params}`);
        if (response.ok) {
          const data = await response.json();
          
          // Calculate match score for each transaction
          const expectedDecimal = new Decimal(expectedAmount);
          const _tolerance = expectedDecimal.times(amountTolerance).dividedBy(100);

          const scoredTransactions = data
            .filter((tx: Transaction) => {
              // Filter out transactions already linked to other bills
              if (tx.billId && tx.id !== currentTransactionId) return false;
              return true;
            })
            .map((tx: Transaction) => {
              const txAmount = new Decimal(tx.amount);
              const amountDiff = txAmount.minus(expectedDecimal).abs();
              
              // Calculate amount match score (0-100)
              let amountScore = 100;
              if (amountDiff.greaterThan(0)) {
                const percentDiff = amountDiff.dividedBy(expectedDecimal).times(100);
                amountScore = Math.max(0, 100 - percentDiff.toNumber() * 10);
              }

              // Calculate date match score (0-100)
              const txDate = parseISO(tx.date);
              const daysDiff = Math.abs((txDate.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
              const dateScore = Math.max(0, 100 - daysDiff * 14); // Lose 14 points per day

              // Combined match score
              const matchScore = Math.round(amountScore * 0.6 + dateScore * 0.4);

              return {
                ...tx,
                matchScore,
              } as TransactionWithAccount;
            })
            .filter((tx: TransactionWithAccount) => tx.matchScore && tx.matchScore > 40)
            .sort((a: TransactionWithAccount, b: TransactionWithAccount) => (b.matchScore || 0) - (a.matchScore || 0));

          setTransactions(scoredTransactions);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedHouseholdId, fetchWithHousehold, dueDateObj, startDate, endDate, expectedAmount, amountTolerance, currentTransactionId]);

  const filteredTransactions = transactions.filter((tx) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.description.toLowerCase().includes(query) ||
      accounts[tx.accountId]?.name.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
        <span className="ml-2 text-muted-foreground">Loading transactions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Showing expenses within 7 days of due date ({format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')})
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {/* Unlink Option */}
      {currentTransactionId && (
        <button
          type="button"
          onClick={() => onSelect(null, null)}
          className={cn(
            'w-full p-3 rounded-lg border text-left transition-colors',
            selectedId === null
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
              : 'border-border bg-card hover:bg-elevated'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              selectedId === null ? 'border-[var(--color-primary)]' : 'border-muted-foreground'
            )}>
              {selectedId === null && (
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Link2Off className="w-4 h-4" />
              <span>Unlink current transaction</span>
            </div>
          </div>
        </button>
      )}

      {/* Transaction List */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No matching transactions found.</p>
          <p className="text-sm mt-1">Try adjusting the search or check if the payment was recorded.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {filteredTransactions.map((tx) => (
            <button
              key={tx.id}
              type="button"
              onClick={() => onSelect(tx.id, tx)}
              className={cn(
                'w-full p-3 rounded-lg border text-left transition-colors',
                selectedId === tx.id
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-border bg-card hover:bg-elevated'
              )}
            >
              <div className="flex items-center gap-3">
                {/* Radio indicator */}
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                  selectedId === tx.id ? 'border-[var(--color-primary)]' : 'border-muted-foreground'
                )}>
                  {selectedId === tx.id && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
                  )}
                </div>

                {/* Transaction details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground truncate">
                      {tx.description}
                    </span>
                    <span className="font-mono text-foreground flex-shrink-0">
                      ${tx.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {format(parseISO(tx.date), 'MMM d, yyyy')}
                      {accounts[tx.accountId] && (
                        <span className="ml-2">• {accounts[tx.accountId].name}</span>
                      )}
                    </span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      tx.matchScore && tx.matchScore >= 90
                        ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                        : tx.matchScore && tx.matchScore >= 70
                        ? 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {tx.matchScore}% match
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

