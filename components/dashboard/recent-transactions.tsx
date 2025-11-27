'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Copy, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  accountId: string;
  categoryId?: string;
  merchantId?: string;
  transferId?: string;
  notes?: string;
  isSplit?: boolean;
}

interface Merchant {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  color: string;
}

interface Category {
  id: string;
  name: string;
}

export function RecentTransactions() {
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const { initialized, loading: householdLoading, error: householdError, retry: retryHousehold } = useHousehold();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<Error | null>(null);
  const [repeatingTxId, setRepeatingTxId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  useEffect(() => {
    // Don't fetch if household context isn't initialized yet
    if (!initialized) {
      return;
    }

    // Don't fetch if there's a household error
    if (householdError) {
      setDataLoading(false);
      return;
    }

    // Don't fetch if no household is selected
    if (!selectedHouseholdId) {
      setDataLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setDataLoading(true);
        setDataError(null);

        // Fetch transactions (50 for scrollable list)
        const txResponse = await fetchWithHousehold('/api/transactions?limit=50');
        if (txResponse.ok) {
          const data = await txResponse.json();
          setTransactions(data);
        }

        // Fetch merchants
        const merResponse = await fetchWithHousehold('/api/merchants?limit=1000');
        if (merResponse.ok) {
          const merData = await merResponse.json();
          setMerchants(merData);
        }

        // Fetch accounts
        const accResponse = await fetchWithHousehold('/api/accounts');
        if (accResponse.ok) {
          const accData = await accResponse.json();
          setAccounts(accData);
        }

        // Fetch categories
        const catResponse = await fetchWithHousehold('/api/categories');
        if (catResponse.ok) {
          const catData = await catResponse.json();
          setCategories(catData);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        const err = error instanceof Error ? error : new Error('Failed to load transactions');
        setDataError(err);

        // Show toast notification for errors
        toast.error('Failed to load transactions', {
          description: 'Please try again or check your connection',
        });
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
    // Note: fetchWithHousehold is memoized in useHouseholdFetch hook, so we don't need it in dependencies
    // It will automatically use the latest selectedHouseholdId through closure
  }, [selectedAccountId, selectedHouseholdId, initialized, householdError]);

  const handleRepeatTransaction = async (transaction: Transaction) => {
    try {
      setRepeatingTxId(transaction.id);

      const today = new Date().toISOString().split('T')[0];

      const response = await postWithHousehold('/api/transactions', {
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        merchantId: transaction.merchantId,
        date: today,
        amount: transaction.amount,
        description: transaction.description,
        notes: transaction.notes,
        type: transaction.type,
      });

      if (response.ok) {
        const result = await response.json();
        // Construct the full transaction object from the response and original data
        const _newTransaction: Transaction = {
          id: result.id,
          description: transaction.description,
          amount: typeof transaction.amount === 'number' ? transaction.amount : parseFloat(transaction.amount as any) || 0,
          type: transaction.type,
          date: today,
          accountId: transaction.accountId,
          categoryId: result.appliedCategoryId || transaction.categoryId,
          merchantId: transaction.merchantId,
          transferId: transaction.transferId,
          notes: transaction.notes,
          isSplit: false, // New transactions aren't split by default
        };
        // Refetch the transactions to get the accurate list instead of manually manipulating state
        const refreshResponse = await fetchWithHousehold('/api/transactions?limit=5');
        if (refreshResponse.ok) {
          const refreshedData = await refreshResponse.json();
          setTransactions(refreshedData);
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

  const getMerchantName = (merchantId?: string): string | null => {
    if (!merchantId) return null;
    const merchant = merchants.find((m) => m.id === merchantId);
    return merchant?.name || null;
  };

  const getAccountName = (accountId?: string): string => {
    if (!accountId) return 'Unknown';
    const account = accounts.find((a) => a.id === accountId);
    return account?.name || 'Unknown';
  };

  const getCategoryName = (categoryId?: string): string | null => {
    if (!categoryId) return null;
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || null;
  };

  const getTransactionDisplay = (transaction: Transaction): { merchant: string | null; description: string } => {
    if (transaction.type === 'transfer_out') {
      // transfer_out: accountId is source, transferId is destination account
      return {
        merchant: `${getAccountName(transaction.accountId)} → ${getAccountName(transaction.transferId)}`,
        description: transaction.description,
      };
    }
    if (transaction.type === 'transfer_in') {
      // transfer_in: accountId is destination, transferId is the paired transfer_out transaction ID
      // For converted transactions, source account ID is stored in merchantId
      if (transaction.merchantId) {
        return {
          merchant: `${getAccountName(transaction.merchantId)} → ${getAccountName(transaction.accountId)}`,
          description: transaction.description,
        };
      }
      // Try to find the paired transfer_out transaction to get source account
      const pairedTx = transactions.find(t => t.id === transaction.transferId);
      if (pairedTx) {
        return {
          merchant: `${getAccountName(pairedTx.accountId)} → ${getAccountName(transaction.accountId)}`,
          description: transaction.description,
        };
      }
      // Fallback if paired transaction not found
      return {
        merchant: `Transfer → ${getAccountName(transaction.accountId)}`,
        description: transaction.description,
      };
    }
    const merchant = getMerchantName(transaction.merchantId);
    return {
      merchant,
      description: transaction.description,
    };
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <ArrowDownLeft className="w-4 h-4" style={{ color: 'var(--color-income)' }} />;
      case 'expense':
        return <ArrowUpRight className="w-4 h-4" style={{ color: 'var(--color-expense)' }} />;
      case 'transfer':
      case 'transfer_in':
      case 'transfer_out':
        return <ArrowRightLeft className="w-4 h-4" style={{ color: 'var(--color-transfer)' }} />;
      default:
        return null;
    }
  };

  const _getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return { backgroundColor: 'color-mix(in oklch, var(--color-income) 20%, transparent)', color: 'var(--color-income)' };
      case 'expense':
        return { backgroundColor: 'color-mix(in oklch, var(--color-expense) 20%, transparent)', color: 'var(--color-expense)' };
      case 'transfer_in':
      case 'transfer_out':
        return { backgroundColor: 'color-mix(in oklch, var(--color-transfer) 20%, transparent)', color: 'var(--color-transfer)' };
      default:
        return { backgroundColor: 'color-mix(in oklch, var(--color-muted-foreground) 20%, transparent)', color: 'var(--color-muted-foreground)' };
    }
  };

  // Filter transactions by selected account
  const filteredTransactions = selectedAccountId === 'all'
    ? transactions
    : transactions.filter(tx => {
        // For regular transactions (income/expense)
        if (tx.type !== 'transfer_out' && tx.type !== 'transfer_in') {
          return tx.accountId === selectedAccountId;
        }
        // For transfer_out: accountId is source, transferId is destination account
        if (tx.type === 'transfer_out') {
          return tx.accountId === selectedAccountId || tx.transferId === selectedAccountId;
        }
        // For transfer_in: accountId is destination, merchantId stores source account (for converted transfers)
        if (tx.type === 'transfer_in') {
          return tx.accountId === selectedAccountId || tx.merchantId === selectedAccountId;
        }
        return false;
      });

  // 1. Household context is still initializing
  if (!initialized && householdLoading) {
    return (
      <Card className="p-6 border text-center py-12 rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <p className="text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  // 2. Household failed to load
  if (householdError) {
    return (
      <Card className="p-6 border text-center py-12 rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-error) 20%, transparent)' }}>
            <AlertCircle className="w-6 h-6" style={{ color: 'var(--color-error)' }} />
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Failed to load households</p>
            <p className="text-sm text-muted-foreground">Unable to connect to the server</p>
          </div>
          <Button
            onClick={retryHousehold}
            variant="outline"
            size="sm"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  // 3. No household selected or available
  if (!selectedHouseholdId) {
    return (
      <Card className="p-6 border text-center py-12 rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <p className="text-muted-foreground mb-4">No household selected</p>
        <p className="text-sm text-muted-foreground">Create or join a household to get started</p>
      </Card>
    );
  }

  // 4. Data is loading
  if (dataLoading) {
    return (
      <Card className="p-6 border text-center py-12 rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <p className="text-muted-foreground">Loading transactions...</p>
      </Card>
    );
  }

  // 5. Data failed to load
  if (dataError) {
    return (
      <Card className="p-6 border text-center py-12 rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-error) 20%, transparent)' }}>
            <AlertCircle className="w-6 h-6" style={{ color: 'var(--color-error)' }} />
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Failed to load transactions</p>
            <p className="text-sm text-muted-foreground">{dataError.message}</p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  // 6. No transactions yet
  if (transactions.length === 0) {
    return (
      <Card className="p-6 border text-center py-12 rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <p className="text-muted-foreground mb-4">No transactions yet.</p>
        <Link href="/dashboard/transactions/new">
          <Button className="font-medium" style={{ backgroundColor: 'var(--color-income)', color: 'var(--color-background)' }}>Add Your First Transaction</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div>
      {/* Account Filter */}
      {accounts.length > 1 && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger
              className="w-[220px]"
              style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map(account => (
                <SelectItem key={account.id} value={account.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: account.color || '#3b82f6' }}
                    />
                    <span>{account.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Scrollable Transaction List */}
      {filteredTransactions.length > 0 ? (
        <>
          <div className="space-y-2 max-h-[600px] overflow-y-auto scroll-smooth custom-scrollbar">
            {filteredTransactions.map((transaction) => {
        const display = getTransactionDisplay(transaction);
        const accountName = getAccountName(transaction.accountId);
        const categoryName = getCategoryName(transaction.categoryId);

        return (
          <Link key={transaction.id} href={`/dashboard/transactions/${transaction.id}`}>
            <Card className="p-2 border rounded-lg cursor-pointer transition-colors hover:bg-elevated" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="p-1.5 rounded flex-shrink-0" style={{ backgroundColor: 'var(--color-elevated)' }}>
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Merchant name on top (bold) */}
                    {display.merchant && (
                      <p className="font-semibold text-foreground text-sm truncate">
                        {display.merchant}
                      </p>
                    )}
                    {/* Description below merchant (or standalone if no merchant) */}
                    <p className={`text-xs truncate ${display.merchant ? 'text-muted-foreground' : 'font-medium text-foreground text-sm'}`}>
                      {display.description}
                    </p>
                    {/* Date, category, and split indicator */}
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                      {categoryName && ` • ${categoryName}`}
                      {transaction.isSplit && ' • Split'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="text-right">
                    {/* Amount */}
                    <p
                      className="font-semibold text-sm"
                      style={{
                        color: transaction.type === 'income'
                          ? 'var(--color-income)'
                          : transaction.type === 'transfer_out' || transaction.type === 'transfer_in' || transaction.type === 'transfer'
                          ? 'var(--color-transfer)'
                          : 'var(--color-expense)'
                      }}
                    >
                      {transaction.type === 'transfer' || transaction.type === 'transfer_in' || transaction.type === 'transfer_out'
                        ? ''
                        : transaction.type === 'income' ? '+' : '-'}$
                      {transaction.amount.toFixed(2)}
                    </p>
                    {/* Account name below amount */}
                    <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                      {accountName}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      handleRepeatTransaction(transaction);
                    }}
                    disabled={repeatingTxId === transaction.id}
                    className="h-7 w-7 flex-shrink-0"
                    style={{ color: 'var(--color-muted-foreground)' }}
                    title="Repeat this transaction with today's date"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          </Link>
        );
            })}
          </div>

          {/* View All Button - Outside scroll container */}
          <Link href="/dashboard/transactions">
            <Button variant="outline" className="w-full rounded-lg mt-4" style={{ borderColor: 'var(--color-border)' }}>
              View All Transactions
            </Button>
          </Link>
        </>
      ) : (
        <Card className="p-6 border text-center py-8 rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
          <p className="text-muted-foreground">No transactions found for this account.</p>
        </Card>
      )}
    </div>
  );
}
