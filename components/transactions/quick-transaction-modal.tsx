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
import { Zap, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { ExperimentalBadge } from '@/components/experimental/experimental-badge';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { CategorySelector } from '@/components/transactions/category-selector';
import { MerchantSelector } from '@/components/transactions/merchant-selector';
import {
  loadQuickEntryDefaults,
  saveQuickEntryDefaults,
} from '@/lib/utils/quick-entry-defaults';

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
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts and load smart defaults
  const fetchAccounts = async () => {
    if (!selectedHouseholdId || !householdId) {
      setAccountsError('No household selected');
      setAccountsLoading(false);
      return;
    }

    setAccountsLoading(true);
    setAccountsError(null);

    try {
      const response = await fetchWithHousehold('/api/accounts');
      
      if (!response.ok) {
        // Handle specific error status codes
        let errorMessage = 'Failed to load accounts';
        if (response.status === 400) {
          errorMessage = 'Invalid household selection. Please try again.';
        } else if (response.status === 401) {
          errorMessage = 'Session expired. Please sign in again.';
        } else if (response.status === 403) {
          errorMessage = "You don't have access to this household's accounts.";
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again.';
        }
        
        setAccountsError(errorMessage);
        setAccountsLoading(false);
        console.error('Failed to fetch accounts:', response.status, errorMessage);
        return;
      }

      const data = await response.json();
      setAccounts(data);
      setAccountsError(null);
      
      // Load smart defaults for current transaction type
      const defaults = loadQuickEntryDefaults(selectedHouseholdId, type);
      
      // Apply account default (validate it exists in accounts list)
      if (defaults.accountId && data.some((acc: any) => acc.id === defaults.accountId)) {
        setAccountId(defaults.accountId);
      } else if (data.length > 0) {
        setAccountId(data[0].id);
      }
      
      // Apply category default (if provided)
      if (defaults.categoryId !== undefined) {
        setCategoryId(defaults.categoryId);
      }
      
      // Apply merchant default (if provided)
      if (defaults.merchantId !== undefined) {
        setMerchantId(defaults.merchantId);
      }
      
      // Apply toAccountId default for transfers (validate it exists)
      if (defaults.toAccountId && data.some((acc: any) => acc.id === defaults.toAccountId)) {
        setToAccountId(defaults.toAccountId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch accounts';
      setAccountsError(errorMessage);
      console.error('Failed to fetch accounts:', error);
    } finally {
      setAccountsLoading(false);
    }
  };

  // Fetch accounts when modal opens and household is ready
  useEffect(() => {
    // Only fetch when modal is open AND household is initialized AND not loading AND household ID exists
    if (!open || !initialized || householdLoading || !selectedHouseholdId || !householdId) {
      // Reset accounts when modal closes or household not ready
      if (!open) {
        setAccounts([]);
        setAccountsError(null);
        setAccountsLoading(false);
      }
      return;
    }

    fetchAccounts();
    // Note: fetchAccounts is defined above and uses selectedHouseholdId and householdId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialized, householdLoading, selectedHouseholdId, householdId]);

  // Load defaults when transaction type changes
  useEffect(() => {
    if (!selectedHouseholdId || !open) return;
    
    const defaults = loadQuickEntryDefaults(selectedHouseholdId, type);
    
    // Apply account default (validate it exists)
    if (defaults.accountId && accounts.some((acc: any) => acc.id === defaults.accountId)) {
      setAccountId(defaults.accountId);
    }
    
    // Apply category default
    if (defaults.categoryId !== undefined) {
      setCategoryId(defaults.categoryId);
    }
    
    // Apply merchant default
    if (defaults.merchantId !== undefined) {
      setMerchantId(defaults.merchantId);
    }
    
    // Apply toAccountId default for transfers
    if (defaults.toAccountId && accounts.some((acc: any) => acc.id === defaults.toAccountId)) {
      setToAccountId(defaults.toAccountId);
    }
  }, [type, selectedHouseholdId, open, accounts]);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Reset date to today when opening
      // Account fetching is handled by useEffect hook
      setDate(new Date().toISOString().split('T')[0]);
    } else {
      // Reset form
      setAmount('');
      setDescription('');
      setType('expense');
      setCategoryId(null);
      setMerchantId(null);
      setToAccountId('');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setShowNotes(false);
      setError(null);
      setAccountsError(null);
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

      // Validate transfer fields
      const isTransfer = type === 'transfer_out' || type === 'transfer_in';
      if (isTransfer && !toAccountId) {
        setError('Please select a destination account for the transfer');
        setLoading(false);
        return;
      }

      if (isTransfer && accountId === toAccountId) {
        setError('Cannot transfer to the same account');
        setLoading(false);
        return;
      }

      // Determine API transaction type (API uses 'transfer' not 'transfer_out'/'transfer_in')
      const apiType = type === 'transfer_out' || type === 'transfer_in' ? 'transfer' : type;

      const transactionData: any = {
        accountId,
        amount: parseFloat(amount),
        description,
        type: apiType,
        date,
      };

      // Add transfer destination account
      if (apiType === 'transfer' && toAccountId) {
        transactionData.toAccountId = toAccountId;
      }

      // Add optional fields if provided (not for transfers)
      if (apiType !== 'transfer') {
        if (categoryId) {
          transactionData.categoryId = categoryId;
        }
        if (merchantId) {
          transactionData.merchantId = merchantId;
        }
      }
      if (notes.trim()) {
        transactionData.notes = notes.trim();
      }

      const response = await postWithHousehold('/api/transactions', transactionData);

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

      // Save smart defaults for next time
      if (selectedHouseholdId) {
        const defaults: any = {
          accountId,
          categoryId,
          merchantId,
          transactionType: type,
        };
        
        // Include toAccountId for transfers
        if (apiType === 'transfer' && toAccountId) {
          defaults.toAccountId = toAccountId;
        }
        
        saveQuickEntryDefaults(selectedHouseholdId, type, defaults);
      }

      // Success - show toast and close
      toast.success('Transaction created successfully!');
      setAmount('');
      setDescription('');
      setType('expense');
      setCategoryId(null);
      setMerchantId(null);
      setToAccountId('');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setShowNotes(false);
      setTimeout(() => {
        onOpenChange(false);
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Only handle shortcuts if not typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInputField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      
      // Ctrl+Enter / Cmd+Enter: Submit form
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        formRef.current?.requestSubmit();
        return;
      }
      
      // Don't handle other shortcuts if typing in a field
      if (isInputField || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      
      // N: Toggle notes
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowNotes(!showNotes);
        return;
      }
      
      // 1-4: Quick select transaction type
      if (e.key === '1') {
        e.preventDefault();
        setType('expense');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        setType('income');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        setType('transfer_out');
        return;
      }
      if (e.key === '4') {
        e.preventDefault();
        setType('transfer_in');
        return;
      }
      
      // T: Set date to today
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setDate(new Date().toISOString().split('T')[0]);
        return;
      }
      
      // Y: Set date to yesterday
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        setDate(yesterday.toISOString().split('T')[0]);
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, showNotes]);

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
            Rapid transaction entry. Tab to navigate, Ctrl+Enter to save, ESC to close. Press 1-4 for transaction type, T/Y for date, N for notes.
          </DialogDescription>
          <p className="text-xs text-muted-foreground mt-2">
            Fields marked with <span className="text-[var(--color-error)]">*</span> are required
          </p>
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
            <label className="text-sm font-medium text-foreground">
              Type <span className="text-[var(--color-error)]">*</span>
            </label>
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
            <label className="text-sm font-medium text-foreground">
              {type === 'transfer_out' || type === 'transfer_in' ? 'From Account' : 'Account'}
              <span className="text-[var(--color-error)]">*</span>
            </label>
            {accountsError && (
              <div className="p-2 bg-[var(--color-error)]/20 border border-[var(--color-error)]/40 rounded-lg text-[var(--color-error)] text-xs mb-2">
                {accountsError}
              </div>
            )}
            <Select 
              value={accountId} 
              onValueChange={setAccountId}
              disabled={accountsLoading || !initialized || householdLoading || !selectedHouseholdId || !householdId}
            >
              <SelectTrigger>
                <SelectValue 
                  placeholder={
                    accountsLoading 
                      ? 'Loading accounts...' 
                      : accounts.length === 0 && !accountsLoading && !accountsError
                      ? 'No accounts found'
                      : 'Select account'
                  } 
                />
              </SelectTrigger>
              <SelectContent>
                {accountsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)] mr-2" />
                    <span className="text-muted-foreground text-sm">Loading accounts...</span>
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="py-4 px-2 text-center">
                    <p className="text-muted-foreground text-sm">No accounts found. Please create an account first.</p>
                  </div>
                ) : (
                  accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* To Account (for transfers) */}
          {(type === 'transfer_out' || type === 'transfer_in') && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                To Account <span className="text-[var(--color-error)]">*</span>
              </label>
              <Select 
                value={toAccountId} 
                onValueChange={setToAccountId}
                disabled={accountsLoading || !initialized || householdLoading || !selectedHouseholdId || !householdId || accounts.length === 0}
              >
                <SelectTrigger>
                  <SelectValue 
                    placeholder={
                      accountsLoading 
                        ? 'Loading accounts...' 
                        : accounts.length === 0 && !accountsLoading && !accountsError
                        ? 'No accounts found'
                        : 'Select destination account'
                    } 
                  />
                </SelectTrigger>
                <SelectContent>
                  {accountsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)] mr-2" />
                      <span className="text-muted-foreground text-sm">Loading accounts...</span>
                    </div>
                  ) : accounts.filter((account) => account.id !== accountId).length === 0 ? (
                    <div className="py-4 px-2 text-center">
                      <p className="text-muted-foreground text-sm">No other accounts available for transfer.</p>
                    </div>
                  ) : (
                    accounts
                      .filter((account) => account.id !== accountId)
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Amount <span className="text-[var(--color-error)]">*</span>
            </label>
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
            <label className="text-sm font-medium text-foreground">
              Description <span className="text-[var(--color-error)]">*</span>
            </label>
            <Input
              placeholder="e.g., Coffee, Gas, Salary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Category */}
          {type !== 'transfer_in' && type !== 'transfer_out' && (
            <CategorySelector
              selectedCategory={categoryId}
              onCategoryChange={setCategoryId}
              transactionType={type}
            />
          )}

          {/* Merchant */}
          {type !== 'transfer_in' && type !== 'transfer_out' && (
            <MerchantSelector
              selectedMerchant={merchantId}
              onMerchantChange={setMerchantId}
            />
          )}

          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-elevated border-border text-foreground"
            />
          </div>

          {/* Notes (Collapsible) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-[var(--color-primary)] transition-colors"
            >
              Notes (Optional)
              {showNotes ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {showNotes && (
              <textarea
                placeholder="Add any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-elevated border-border text-foreground rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            )}
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
