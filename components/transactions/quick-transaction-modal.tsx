'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Zap, Loader2 } from 'lucide-react';
import { ExperimentalBadge } from '@/components/experimental/experimental-badge';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface QuickTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TransactionType = 'income' | 'expense' | 'transfer_in' | 'transfer_out';

export function QuickTransactionModal({
  open,
  onOpenChange,
}: QuickTransactionModalProps) {
  const { initialized, loading: householdLoading, selectedHouseholdId: householdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts on mount
  const fetchAccounts = async () => {
    if (!selectedHouseholdId) return;

    try {
      const response = await fetchWithHousehold('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
        if (data.length > 0 && !accountId) {
          setAccountId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      fetchAccounts();
    } else {
      // Reset form
      setAmount('');
      setDescription('');
      setType('expense');
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Guard: Check if household context is ready
      if (!initialized || householdLoading) {
        setError('Please wait while household data loads...');
        setLoading(false);
        return;
      }

      if (!selectedHouseholdId || !householdId) {
        setError('Please select a household to continue.');
        setLoading(false);
        return;
      }

      if (!amount || !description || !accountId) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      const response = await postWithHousehold('/api/transactions', {
        accountId,
        amount: parseFloat(amount),
        description,
        type,
        date: new Date().toISOString().split('T')[0],
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to create transaction';
        
        // Distinguish between auth errors (401) and household auth errors (403)
        if (response.status === 401) {
          // Authentication failure - session expired
          toast.error('Your session has expired. Please sign in again.');
          setLoading(false);
          onOpenChange(false);
          return;
        }
        
        if (response.status === 403) {
          // Household authorization failure - show error but don't sign out
          toast.error(errorMessage);
          throw new Error(errorMessage);
        }
        
        // Other errors
        throw new Error(errorMessage);
      }

      // Success - show toast and close
      toast.success('Transaction created successfully!');
      setAmount('');
      setDescription('');
      setType('expense');
      setTimeout(() => {
        onOpenChange(false);
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle keyboard shortcuts (Ctrl+Enter to submit, ESC handled by dialog)
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-elevated border-border">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--color-warning)]" />
              <DialogTitle className="text-foreground">Quick Entry</DialogTitle>
            </div>
            <ExperimentalBadge />
          </div>
          <DialogDescription className="text-muted-foreground">
            Rapid transaction entry. Tab to navigate, Ctrl+Enter to save, ESC to close.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {(!initialized || householdLoading) && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-primary)]" />
                <p className="text-muted-foreground text-sm">Loading household data...</p>
              </div>
            </div>
          )}
          
          {initialized && !householdLoading && (!selectedHouseholdId || !householdId) && (
            <div className="p-3 bg-[var(--color-warning)]/20 border border-[var(--color-warning)]/40 rounded-lg text-[var(--color-warning)] text-sm">
              Please select a household to create transactions.
            </div>
          )}

          {error && (
            <div className="p-3 bg-[var(--color-error)]/20 border border-[var(--color-error)]/40 rounded-lg text-[var(--color-error)] text-sm">
              {error}
            </div>
          )}

          {/* Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Type</label>
            <Select value={type} onValueChange={(value) => setType(value as TransactionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="transfer_out">Transfer Out</SelectItem>
                <SelectItem value="transfer_in">Transfer In</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Account */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Account</label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
                autoFocus
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Description *</label>
            <Input
              placeholder="e.g., Coffee, Gas, Salary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={loading || !initialized || householdLoading || !selectedHouseholdId || !householdId}
              className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
            >
              {loading ? 'Creating...' : 'Add Transaction'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
