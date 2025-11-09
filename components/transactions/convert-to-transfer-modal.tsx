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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [matchingTransactions, setMatchingTransactions] = useState<Transaction[]>([]);
  const [selectedMatchingTxId, setSelectedMatchingTxId] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<'create' | 'match'>('create');
  const [loading, setLoading] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Fetch accounts
  useEffect(() => {
    if (open && transaction) {
      const fetchAccounts = async () => {
        try {
          const response = await fetch('/api/accounts');
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
  }, [open, transaction]);

  // Fetch matching transactions when target account changes
  useEffect(() => {
    if (!targetAccountId || !transaction) {
      setMatchingTransactions([]);
      return;
    }

    const fetchMatchingTransactions = async () => {
      try {
        setLoadingMatches(true);

        // Fetch transactions from target account
        const response = await fetch(`/api/transactions?accountId=${targetAccountId}&limit=100`);
        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const transactions = await response.json();

        // Filter for potential matches:
        // - Opposite type (expense matches income, income matches expense)
        // - Similar amount (within 1% tolerance)
        // - Similar date (within 7 days)
        // - Not already a transfer
        const txDate = new Date(transaction.date);
        const txAmount = new Decimal(transaction.amount);
        const oppositeType = transaction.type === 'expense' ? 'income' : 'expense';

        const matches = transactions.filter((tx: Transaction) => {
          if (tx.type !== oppositeType) return false;

          const matchDate = new Date(tx.date);
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
  }, [targetAccountId, transaction]);

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

      const response = await fetch(`/api/transactions/${transaction.id}/convert-to-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

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

  const sourceAccount = accounts.find((acc) => acc.id === transaction?.accountId);
  const targetAccount = accounts.find((acc) => acc.id === targetAccountId);
  const selectedMatch = matchingTransactions.find((tx) => tx.id === selectedMatchingTxId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1a] border border-[#2a2a2a] text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ArrowRightLeft className="w-5 h-5 text-blue-500" />
            Convert to Transfer
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Convert this transaction into a transfer between accounts
          </DialogDescription>
        </DialogHeader>

        {transaction && (
          <div className="space-y-6">
            {/* Current Transaction Info */}
            <div className="p-4 bg-[#242424] rounded-lg border border-[#2a2a2a]">
              <p className="text-xs text-gray-500 mb-2">Current Transaction</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Description:</span>
                  <span className="text-sm text-white font-medium">{transaction.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Amount:</span>
                  <span className={`text-sm font-mono font-semibold ${
                    transaction.type === 'expense' ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {transaction.type === 'expense' ? '-' : '+'}${transaction.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Date:</span>
                  <span className="text-sm text-white">
                    {new Date(transaction.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Target Account Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Target Account</label>
              <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                <SelectTrigger className="bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2 w-full">
                        <DollarSign className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 truncate">{account.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          ${account.currentBalance?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Match Mode Selection */}
            {targetAccountId && (
              <div className="space-y-4">
                <RadioGroup value={matchMode} onValueChange={(value) => setMatchMode(value as 'create' | 'match')}>
                  <div className="flex items-center space-x-2 p-3 bg-[#242424] rounded-lg border border-[#2a2a2a]">
                    <RadioGroupItem value="create" id="create" />
                    <Label htmlFor="create" className="flex-1 cursor-pointer">
                      <div>
                        <p className="text-sm font-medium text-white">Create new transaction</p>
                        <p className="text-xs text-gray-500">
                          Create a matching transaction in the target account
                        </p>
                      </div>
                    </Label>
                  </div>

                  {matchingTransactions.length > 0 && (
                    <div className="flex items-center space-x-2 p-3 bg-[#242424] rounded-lg border border-[#2a2a2a]">
                      <RadioGroupItem value="match" id="match" />
                      <Label htmlFor="match" className="flex-1 cursor-pointer">
                        <div>
                          <p className="text-sm font-medium text-white">
                            Match with existing transaction
                          </p>
                          <p className="text-xs text-gray-500">
                            {matchingTransactions.length} potential {matchingTransactions.length === 1 ? 'match' : 'matches'} found
                          </p>
                        </div>
                      </Label>
                    </div>
                  )}
                </RadioGroup>

                {/* Matching Transactions List */}
                {matchMode === 'match' && matchingTransactions.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Select matching transaction</label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {matchingTransactions.map((tx) => (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => setSelectedMatchingTxId(tx.id)}
                          className={`w-full p-3 rounded-lg border transition-all ${
                            selectedMatchingTxId === tx.id
                              ? 'bg-blue-500/20 border-blue-500'
                              : 'bg-[#242424] border-[#2a2a2a] hover:border-[#3a3a3a]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 text-left space-y-1">
                              <p className="text-sm font-medium text-white">{tx.description}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span>{new Date(tx.date).toLocaleDateString()}</span>
                                <span className={`font-mono font-semibold ${
                                  tx.type === 'expense' ? 'text-red-400' : 'text-emerald-400'
                                }`}>
                                  {tx.type === 'expense' ? '-' : '+'}${tx.amount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            {selectedMatchingTxId === tx.id && (
                              <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading state for matches */}
                {loadingMatches && (
                  <div className="p-4 bg-[#242424] rounded-lg border border-[#2a2a2a] text-center">
                    <p className="text-sm text-gray-400">Looking for matching transactions...</p>
                  </div>
                )}

                {/* Warning if no matches found */}
                {!loadingMatches && matchMode === 'match' && matchingTransactions.length === 0 && (
                  <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-500">No matching transactions found</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Looking for opposite type transactions with similar amounts and dates
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="bg-transparent border-[#2a2a2a] text-white hover:bg-[#242424]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={loading || !targetAccountId}
            className="bg-[var(--color-primary)] hover:opacity-90 text-white"
          >
            {loading ? 'Converting...' : 'Convert to Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
