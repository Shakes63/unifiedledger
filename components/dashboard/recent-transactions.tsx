'use client';

import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Copy, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { parseISO, format, isToday, isYesterday } from 'date-fns';

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
  transferGroupId?: string | null;
  pairedTransactionId?: string | null;
  transferSourceAccountId?: string | null;
  transferDestinationAccountId?: string | null;
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

function formatDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEE, MMM d');
}

function groupByDate(txs: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const key = tx.date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  return Array.from(map.entries());
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
    if (!initialized) return;
    if (householdError) { setDataLoading(false); return; }
    if (!selectedHouseholdId) { setDataLoading(false); return; }

    const fetchData = async () => {
      try {
        setDataLoading(true);
        setDataError(null);

        const [txRes, merRes, accRes, catRes] = await Promise.all([
          fetchWithHousehold('/api/transactions?limit=50'),
          fetchWithHousehold('/api/merchants?limit=1000'),
          fetchWithHousehold('/api/accounts'),
          fetchWithHousehold('/api/categories'),
        ]);

        if (txRes.ok) {
          const d = await txRes.json();
          setTransactions(Array.isArray(d) ? d : (d.data || []));
        }
        if (merRes.ok) {
          const d = await merRes.json();
          setMerchants(Array.isArray(d) ? d : (d.data || []));
        }
        if (accRes.ok) setAccounts(await accRes.json());
        if (catRes.ok) setCategories(await catRes.json());
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to load transactions');
        setDataError(err);
        toast.error('Failed to load transactions', { description: 'Please try again or check your connection' });
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [selectedAccountId, selectedHouseholdId, initialized, householdError, fetchWithHousehold]);

  const handleRepeatTransaction = async (transaction: Transaction) => {
    try {
      setRepeatingTxId(transaction.id);
      const today = new Date().toLocaleDateString('en-CA');
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
        const refreshRes = await fetchWithHousehold('/api/transactions?limit=50');
        if (refreshRes.ok) {
          const d = await refreshRes.json();
          setTransactions(Array.isArray(d) ? d : (d.data || []));
        }
        toast.success(`Transaction repeated: ${transaction.description}`);
      } else {
        const err = await response.json();
        toast.error(err.error || 'Failed to repeat transaction');
      }
    } catch {
      toast.error('Failed to repeat transaction');
    } finally {
      setRepeatingTxId(null);
    }
  };

  const getMerchantName = (merchantId?: string) =>
    merchants.find((m) => m.id === merchantId)?.name || null;

  const getAccountName = (accountId?: string) =>
    accounts.find((a) => a.id === accountId)?.name || 'Unknown';

  const getCategoryName = (categoryId?: string) =>
    categories.find((c) => c.id === categoryId)?.name || null;

  const getTransactionDisplay = (transaction: Transaction): { label: string; sub: string } => {
    const getEndpoints = (tx: Transaction) => {
      const src = tx.transferSourceAccountId || (tx.type === 'transfer_out' ? tx.accountId : undefined);
      let dst = tx.transferDestinationAccountId || (tx.type === 'transfer_in' ? tx.accountId : undefined);
      if (!dst && tx.type === 'transfer_out' && tx.transferId) dst = tx.transferId;
      if (!src && tx.type === 'transfer_in') {
        const paired = transactions.find((c) =>
          (tx.pairedTransactionId && c.id === tx.pairedTransactionId)
          || (tx.transferGroupId && c.transferGroupId === tx.transferGroupId && c.id !== tx.id)
          || (tx.transferId && c.id === tx.transferId)
        );
        return { src: paired?.transferSourceAccountId || paired?.accountId, dst: dst || tx.accountId };
      }
      return { src, dst };
    };

    if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
      const { src, dst } = getEndpoints(transaction);
      return { label: `${getAccountName(src)} → ${getAccountName(dst)}`, sub: transaction.description };
    }

    const merchant = getMerchantName(transaction.merchantId);
    return { label: merchant || transaction.description, sub: merchant ? transaction.description : '' };
  };

  const getTypeAccent = (type: string) => {
    switch (type) {
      case 'income': return 'var(--color-income)';
      case 'expense': return 'var(--color-expense)';
      case 'transfer_in':
      case 'transfer_out':
      case 'transfer': return 'var(--color-transfer)';
      default: return 'var(--color-muted-foreground)';
    }
  };

  const getAmountDisplay = (transaction: Transaction) => {
    const isTransfer = ['transfer', 'transfer_in', 'transfer_out'].includes(transaction.type);
    const sign = isTransfer ? '' : transaction.type === 'income' ? '+' : '−';
    const amount = `$${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${sign}${amount}`;
  };

  const getTypeIcon = (type: string) => {
    const size = 'w-3.5 h-3.5';
    if (type === 'income') return <ArrowDownLeft className={size} />;
    if (type === 'expense') return <ArrowUpRight className={size} />;
    return <ArrowRightLeft className={size} />;
  };

  const filteredTransactions = selectedAccountId === 'all'
    ? transactions
    : transactions.filter(tx => {
        if (tx.type !== 'transfer_out' && tx.type !== 'transfer_in') return tx.accountId === selectedAccountId;
        const src = tx.transferSourceAccountId || (tx.type === 'transfer_out' ? tx.accountId : undefined);
        const dst = tx.transferDestinationAccountId || (tx.type === 'transfer_in' ? tx.accountId : undefined);
        return src === selectedAccountId || dst === selectedAccountId || tx.accountId === selectedAccountId;
      });

  // ── Loading states ──────────────────────────────────────────────────────────

  if (!initialized && householdLoading) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading…</p>
      </div>
    );
  }

  if (householdError) {
    return (
      <div className="py-10 flex flex-col items-center gap-3">
        <div className="p-2.5 rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 15%, transparent)' }}>
          <AlertCircle className="w-5 h-5" style={{ color: 'var(--color-destructive)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>Failed to load households</p>
        <Button onClick={retryHousehold} variant="outline" size="sm" style={{ borderColor: 'var(--color-border)' }}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  if (!selectedHouseholdId) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No household selected</p>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-3 animate-pulse"
            style={{
              borderBottom: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
              animationDelay: `${i * 60}ms`,
            }}
          >
            <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: 'var(--color-elevated)' }} />
            <div className="flex-1 min-w-0">
              <div className="h-3.5 rounded w-2/5 mb-1.5" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="h-2.5 rounded w-1/4" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
            <div className="h-3.5 rounded w-16 shrink-0" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
        ))}
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="py-10 flex flex-col items-center gap-3">
        <div className="p-2.5 rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 15%, transparent)' }}>
          <AlertCircle className="w-5 h-5" style={{ color: 'var(--color-destructive)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>Failed to load transactions</p>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm" style={{ borderColor: 'var(--color-border)' }}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try Again
        </Button>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm mb-3" style={{ color: 'var(--color-muted-foreground)' }}>No transactions yet.</p>
        <Link href="/dashboard/transactions/new">
          <Button size="sm" style={{ backgroundColor: 'var(--color-income)', color: 'var(--color-background)' }}>
            Add Your First Transaction
          </Button>
        </Link>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  const groups = groupByDate(filteredTransactions);

  return (
    <div>
      {/* Account filter */}
      {accounts.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-[10px] uppercase tracking-[0.08em] font-medium shrink-0"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Account
          </span>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger
              className="h-7 text-xs border rounded-md px-2"
              style={{
                backgroundColor: 'var(--color-elevated)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-foreground)',
                width: 'auto',
                minWidth: '140px',
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: acc.color || 'var(--color-primary)' }} />
                    <span>{acc.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredTransactions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No transactions for this account.</p>
        </div>
      ) : (
        <>
          <div className="max-h-[560px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}>
            {groups.map(([dateKey, dayTxs], groupIdx) => (
              <div key={dateKey}>
                {/* Date group header */}
                <div
                  className="flex items-center gap-2 py-2 sticky top-0 z-10"
                  style={{ backgroundColor: 'var(--color-background)' }}
                >
                  <span
                    className="text-[10px] uppercase tracking-widest font-semibold shrink-0"
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    {formatDateLabel(dateKey)}
                  </span>
                  <div
                    className="flex-1 h-px"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }}
                  />
                </div>

                {/* Transactions in this group */}
                {dayTxs.map((tx, txIdx) => {
                  const display = getTransactionDisplay(tx);
                  const accountName = getAccountName(tx.accountId);
                  const categoryName = getCategoryName(tx.categoryId);
                  const accent = getTypeAccent(tx.type);
                  const amountDisplay = getAmountDisplay(tx);
                  const isLast = txIdx === dayTxs.length - 1;
                  const globalIdx = groupIdx * 10 + txIdx;

                  return (
                    <Link key={tx.id} href={`/dashboard/transactions/${tx.id}`}>
                      <div
                        className="group flex items-stretch gap-0 transition-colors duration-150 cursor-pointer"
                        style={{
                          borderBottom: isLast ? 'none' : '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
                          animationName: 'dashboard-fade-in',
                          animationDuration: '0.4s',
                          animationFillMode: 'both',
                          animationDelay: `${globalIdx * 30}ms`,
                        }}
                      >
                        {/* Left type accent strip */}
                        <div
                          className="w-[3px] shrink-0 rounded-full my-2 mr-3 transition-opacity duration-150 opacity-60 group-hover:opacity-100"
                          style={{ backgroundColor: accent }}
                        />

                        {/* Main content */}
                        <div className="flex items-center justify-between gap-2 flex-1 min-w-0 py-2.5">
                          {/* Left: type icon + text */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className="shrink-0 opacity-60 group-hover:opacity-90 transition-opacity"
                              style={{ color: accent }}
                            >
                              {getTypeIcon(tx.type)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className="text-[13px] font-medium leading-tight truncate"
                                style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}
                              >
                                {display.label}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {display.sub && (
                                  <span className="text-[11px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                                    {display.sub}
                                  </span>
                                )}
                                {categoryName && (
                                  <span
                                    className="text-[10px] uppercase tracking-[0.06em] font-medium px-1.5 py-px rounded-sm shrink-0"
                                    style={{
                                      backgroundColor: `color-mix(in oklch, ${accent} 12%, transparent)`,
                                      color: accent,
                                    }}
                                  >
                                    {categoryName}
                                  </span>
                                )}
                                {tx.isSplit && (
                                  <span
                                    className="text-[10px] uppercase tracking-[0.06em] font-medium px-1.5 py-px rounded-sm shrink-0"
                                    style={{
                                      backgroundColor: 'color-mix(in oklch, var(--color-muted-foreground) 12%, transparent)',
                                      color: 'var(--color-muted-foreground)',
                                    }}
                                  >
                                    Split
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: amount + account + repeat */}
                          <div className="flex items-center gap-1 shrink-0">
                            <div className="text-right">
                              <p
                                className="text-[13px] font-semibold leading-tight"
                                style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}
                              >
                                {amountDisplay}
                              </p>
                              <p
                                className="text-[10px] truncate max-w-[80px]"
                                style={{ color: 'var(--color-muted-foreground)' }}
                              >
                                {accountName}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleRepeatTransaction(tx);
                              }}
                              disabled={repeatingTxId === tx.id}
                              title="Repeat transaction today"
                              className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-60 hover:opacity-100! transition-opacity duration-150 disabled:cursor-not-allowed"
                              style={{ color: 'var(--color-muted-foreground)' }}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          {/* View all link */}
          <div
            className="flex items-center justify-center pt-3 mt-1"
            style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}
          >
            <Link
              href="/dashboard/transactions"
              className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              View all transactions
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
