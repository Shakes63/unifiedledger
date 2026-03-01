'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowRightLeft, DollarSign, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { parseISO, format } from 'date-fns';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

interface Transaction {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  description: string;
  type: string;
  notes?: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

interface ConvertToTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onSuccess?: () => void;
}

export function ConvertToTransferModal({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: ConvertToTransferModalProps) {
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [matchingTransactions, setMatchingTransactions] = useState<Transaction[]>([]);
  const [selectedMatchingTxId, setSelectedMatchingTxId] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<'create' | 'match'>('create');
  const [loading, setLoading] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Fetch accounts
  useEffect(() => {
    if (open && transaction && selectedHouseholdId) {
      const fetchAccounts = async () => {
        try {
          const response = await fetchWithHousehold('/api/accounts');
          if (response.ok) {
            const data = await response.json();
            // Filter out the current transaction's account
            const otherAccounts = data.filter((acc: Account) => acc.id !== transaction.accountId);
            setAccounts(otherAccounts);
          }
        } catch (error) {
          console.error('Failed to fetch accounts:', error);
          toast.error('Failed to load accounts');
        }
      };

      fetchAccounts();
    }
  }, [open, transaction, fetchWithHousehold, selectedHouseholdId]);

  // Fetch matching transactions when target account changes
  useEffect(() => {
    if (!targetAccountId || !transaction) {
      setMatchingTransactions([]);
      return;
    }

    const fetchMatchingTransactions = async () => {
      try {
        setLoadingMatches(true);

        // Fetch transactions from target account (includes household header)
        const response = await fetchWithHousehold(`/api/transactions?accountId=${targetAccountId}&limit=100`);
        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const transactions = await response.json();

        // Filter for potential matches:
        // - Opposite type (expense matches income, income matches expense)
        // - Similar amount (within 1% tolerance)
        // - Similar date (within 7 days)
        // - Not already a transfer
        const txDate = parseISO(transaction.date);
        const txAmount = new Decimal(transaction.amount);
        const oppositeType = transaction.type === 'expense' ? 'income' : 'expense';

        const matches = transactions.filter((tx: Transaction) => {
          if (tx.type !== oppositeType) return false;

          const matchDate = parseISO(tx.date);
          const daysDiff = Math.abs((txDate.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff > 7) return false;

          const matchAmount = new Decimal(tx.amount);
          const amountDiff = matchAmount.minus(txAmount).abs();
          const tolerance = txAmount.times(0.01); // 1% tolerance

          return amountDiff.lessThanOrEqualTo(tolerance);
        });

        setMatchingTransactions(matches);

        // Auto-select first match if available
        if (matches.length > 0) {
          setMatchMode('match');
          setSelectedMatchingTxId(matches[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch matching transactions:', error);
        toast.error('Failed to load matching transactions');
      } finally {
        setLoadingMatches(false);
      }
    };

    fetchMatchingTransactions();
  }, [targetAccountId, transaction, fetchWithHousehold]);

  const handleConvert = async () => {
    if (!transaction || !targetAccountId) {
      toast.error('Please select a target account');
      return;
    }

    try {
      setLoading(true);

      const body: { targetAccountId: string; matchingTransactionId?: string } = {
        targetAccountId,
      };

      if (matchMode === 'match' && selectedMatchingTxId) {
        body.matchingTransactionId = selectedMatchingTxId;
      }

      const response = await postWithHousehold(
        `/api/transactions/${transaction.id}/convert-to-transfer`,
        body
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to convert transaction');
      }

      const result = await response.json();

      toast.success(
        result.matched
          ? 'Transactions matched and converted to transfer'
          : 'Transaction converted to transfer'
      );

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to convert transaction:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to convert transaction');
    } finally {
      setLoading(false);
    }
  };

  const _sourceAccount = accounts.find((acc) => acc.id === transaction?.accountId);
  const _targetAccount = accounts.find((acc) => acc.id === targetAccountId);
  const _selectedMatch = matchingTransactions.find((tx) => tx.id === selectedMatchingTxId);

  const fs = { backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' };
  const lbl = 'text-[11px] font-medium uppercase tracking-wide block mb-1.5';
  const lblS = { color: 'var(--color-muted-foreground)' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--color-foreground)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)' }}>
              <ArrowRightLeft className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
            </div>
            Convert to Transfer
          </DialogTitle>
          <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
            Convert this transaction into a transfer between accounts
          </DialogDescription>
        </DialogHeader>

        {transaction && (
          <div className="space-y-4 mt-1">
            {/* Current Transaction Info */}
            <div className="rounded-xl px-3 py-3 space-y-2" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={lblS}>Current Transaction</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Description', value: transaction.description },
                  { label: 'Amount', value: `${transaction.type === 'expense' ? '-' : '+'}$${transaction.amount.toFixed(2)}`, color: transaction.type === 'expense' ? 'var(--color-destructive)' : 'var(--color-income)' },
                  { label: 'Date', value: format(parseISO(transaction.date), 'MMM d, yyyy') },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[12px]" style={lblS}>{label}</span>
                    <span className="text-[13px] font-medium tabular-nums" style={{ color: color || 'var(--color-foreground)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Account Selection */}
            <div>
              <label className={lbl} style={lblS}>Target Account</label>
              <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                <SelectTrigger className="h-9 text-[13px]" style={fs}><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2 w-full">
                        <DollarSign className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1 truncate">{account.name}</span>
                        <span className="text-[11px] tabular-nums" style={lblS}>${account.currentBalance?.toFixed(2) || '0.00'}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Match Mode Selection */}
            {targetAccountId && (
              <div className="space-y-3">
                <RadioGroup value={matchMode} onValueChange={v => setMatchMode(v as 'create' | 'match')}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: `2px solid ${matchMode === 'create' ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                    <RadioGroupItem value="create" id="create" />
                    <Label htmlFor="create" className="flex-1 cursor-pointer">
                      <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Create new transaction</p>
                      <p className="text-[11px]" style={lblS}>Create a matching transaction in the target account</p>
                    </Label>
                  </div>
                  {matchingTransactions.length > 0 && (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: `2px solid ${matchMode === 'match' ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                      <RadioGroupItem value="match" id="match" />
                      <Label htmlFor="match" className="flex-1 cursor-pointer">
                        <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Match with existing transaction</p>
                        <p className="text-[11px]" style={lblS}>{matchingTransactions.length} potential {matchingTransactions.length === 1 ? 'match' : 'matches'} found</p>
                      </Label>
                    </div>
                  )}
                </RadioGroup>

                {matchMode === 'match' && matchingTransactions.length > 0 && (
                  <div>
                    <label className={lbl} style={lblS}>Select matching transaction</label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {matchingTransactions.map(tx => (
                        <button key={tx.id} type="button" onClick={() => setSelectedMatchingTxId(tx.id)}
                          className="w-full px-3 py-2.5 rounded-lg text-left transition-all"
                          style={{ backgroundColor: selectedMatchingTxId === tx.id ? 'color-mix(in oklch, var(--color-primary) 10%, transparent)' : 'var(--color-elevated)', border: `1.5px solid ${selectedMatchingTxId === tx.id ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-0.5">
                              <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{tx.description}</p>
                              <div className="flex items-center gap-2 text-[11px]">
                                <span style={lblS}>{new Date(tx.date).toLocaleDateString()}</span>
                                <span className="font-mono font-semibold tabular-nums" style={{ color: tx.type === 'expense' ? 'var(--color-destructive)' : 'var(--color-income)' }}>
                                  {tx.type === 'expense' ? '-' : '+'}${tx.amount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            {selectedMatchingTxId === tx.id && <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {loadingMatches && (
                  <div className="px-3 py-3 rounded-lg text-center" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                    <p className="text-[12px]" style={lblS}>Looking for matching transactions…</p>
                  </div>
                )}

                {!loadingMatches && matchMode === 'match' && matchingTransactions.length === 0 && (
                  <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 20%, transparent)' }}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--color-warning)' }}>No matching transactions found</p>
                      <p className="text-[11px] mt-0.5" style={lblS}>Looking for opposite type transactions with similar amounts and dates</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="h-9 text-[13px]">Cancel</Button>
          <Button onClick={handleConvert} disabled={loading || !targetAccountId} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            {loading ? 'Converting…' : 'Convert to Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
