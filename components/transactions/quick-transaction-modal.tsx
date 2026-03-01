'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
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
import { useHouseholdAccounts } from '@/components/transactions/hooks/use-household-accounts';
import { useUnpaidBills, type UnpaidBillWithInstance } from '@/components/transactions/hooks/use-unpaid-bills';
import {
  loadQuickEntryDefaults,
  saveQuickEntryDefaults,
} from '@/lib/utils/quick-entry-defaults';
import { getRelativeLocalDateString, getTodayLocalDateString } from '@/lib/utils/local-date';
import type { Account } from '@/lib/types';

interface QuickTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TransactionType = 'income' | 'expense' | 'transfer_in' | 'transfer_out' | 'bill';

// Transaction data for API submission
interface QuickTransactionData {
  accountId: string;
  amount: number;
  description: string;
  type: string;
  date: string;
  toAccountId?: string;
  billInstanceId?: string;
  categoryId?: string;
  merchantId?: string;
  notes?: string;
  isSalesTaxable?: boolean;
}

// Quick entry defaults
interface QuickEntryDefaults {
  accountId: string;
  categoryId: string | null;
  merchantId: string | null;
  transactionType: TransactionType;
  toAccountId?: string;
}

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
  const [date, setDate] = useState(getTodayLocalDateString());
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBillInstanceId, setSelectedBillInstanceId] = useState<string>('');
  const [salesTaxEnabled, setSalesTaxEnabled] = useState(false);
  const [merchantIsSalesTaxExempt, setMerchantIsSalesTaxExempt] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const canLoadHouseholdData = Boolean(selectedHouseholdId && householdId);
  const {
    accounts,
    loading: accountsLoading,
    error: accountsError,
    clearError: clearAccountsError,
  } = useHouseholdAccounts({
    enabled: open && initialized && !householdLoading && canLoadHouseholdData,
    fetchWithHousehold,
    emptySelectionMessage: 'No household selected',
  });
  const {
    unpaidBills,
    loading: billsLoading,
    refresh: refreshUnpaidBills,
    clear: clearUnpaidBills,
  } = useUnpaidBills({
    enabled: open && type === 'bill' && canLoadHouseholdData,
    fetchWithHousehold,
  });

  // Compute whether selected account is a business account for category filtering
  const selectedAccountIsBusinessAccount = useMemo(() => {
    const account = accounts.find(a => a.id === accountId);
    return account?.isBusinessAccount || false;
  }, [accounts, accountId]);

  // Handle account change - auto-enable/disable sales tax for income based on account's sales tax setting
  const handleAccountChange = (newAccountId: string) => {
    setAccountId(newAccountId);
    if (type === 'income') {
      const selectedAccount = accounts.find(a => a.id === newAccountId);
      setSalesTaxEnabled(selectedAccount?.enableSalesTax || false);
    }
  };

  // Handle type change - auto-enable sales tax for income with sales-tax-enabled accounts
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'income') {
      const selectedAccount = accounts.find(a => a.id === accountId);
      if (selectedAccount?.enableSalesTax) {
        setSalesTaxEnabled(true);
      }
    }
  };

  useEffect(() => {
    if (!open || !selectedHouseholdId || accounts.length === 0) {
      return;
    }

    if (type === 'bill' && selectedBillInstanceId && selectedBillInstanceId !== 'none') {
      return;
    }

    const defaults = loadQuickEntryDefaults(selectedHouseholdId, type);

    let nextAccountId = accountId;
    if (defaults.accountId && accounts.some((acc: Account) => acc.id === defaults.accountId)) {
      nextAccountId = defaults.accountId;
      setAccountId(defaults.accountId);
    } else if (!accountId && accounts.length > 0) {
      nextAccountId = accounts[0].id;
      setAccountId(accounts[0].id);
    }

    if (type === 'income' && nextAccountId) {
      const selectedAccount = accounts.find((acc: Account) => acc.id === nextAccountId);
      setSalesTaxEnabled(Boolean(selectedAccount?.enableSalesTax));
    }

    if (defaults.categoryId !== undefined) {
      setCategoryId(defaults.categoryId);
    }

    if (defaults.merchantId !== undefined) {
      setMerchantId(defaults.merchantId);
    }

    if (defaults.toAccountId && accounts.some((acc: Account) => acc.id === defaults.toAccountId)) {
      setToAccountId(defaults.toAccountId);
    }
  }, [open, selectedHouseholdId, type, accounts, accountId, selectedBillInstanceId]);

  // Handle bill selection
  const handleBillSelect = (billInstanceId: string) => {
    setSelectedBillInstanceId(billInstanceId);
    
    if (billInstanceId === 'none') {
      // Reset form when "none" is selected
      setAmount('');
      setDescription('');
      setCategoryId(null);
      setMerchantId(null);
      setNotes('');
      return;
    }

    // Find the selected bill instance
    const billInstance = unpaidBills.find((b: UnpaidBillWithInstance) => b.instance.id === billInstanceId);
    if (billInstance) {
      // Pre-populate form with bill data
      setAmount(billInstance.instance.expectedAmount?.toString() || '');
      setDescription(billInstance.bill.name || '');
      setCategoryId(billInstance.bill.categoryId || null);
      setMerchantId(billInstance.bill.merchantId || null);
      setNotes(`Payment for ${billInstance.bill.name} (Due: ${format(parseISO(billInstance.instance.dueDate), 'MMM d, yyyy')})`);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Reset date to today when opening
      // Account fetching is handled by useEffect hook
      setDate(getTodayLocalDateString());
    } else {
      // Reset form
      setAmount('');
      setDescription('');
      setType('expense');
      setCategoryId(null);
      setMerchantId(null);
      setToAccountId('');
      setDate(getTodayLocalDateString());
      setNotes('');
      setShowNotes(false);
      setError(null);
      setFieldErrors({});
      setSelectedBillInstanceId('');
      clearUnpaidBills();
      clearAccountsError();
      setSalesTaxEnabled(false);
      setMerchantIsSalesTaxExempt(false);
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

      // Field-level validation
      const newFieldErrors: Record<string, string> = {};

      if (!accountId) {
        newFieldErrors.accountId = 'Account is required';
      }

      if (!amount) {
        newFieldErrors.amount = 'Amount is required';
      }

      if (!description) {
        newFieldErrors.description = 'Description is required';
      }

      // Validate transfer fields
      const isTransfer = type === 'transfer_out' || type === 'transfer_in';
      if (isTransfer && !toAccountId) {
        newFieldErrors.toAccountId = 'Destination account is required for transfers';
      }

      if (isTransfer && accountId === toAccountId) {
        newFieldErrors.toAccountId = 'Cannot transfer to the same account';
      }

      if (Object.keys(newFieldErrors).length > 0) {
        setFieldErrors(newFieldErrors);
        setError(Object.values(newFieldErrors)[0]);
        setLoading(false);
        return;
      }

      setFieldErrors({});

      // Determine API transaction type (API uses 'transfer' not 'transfer_out'/'transfer_in')
      // Bill payments are submitted as 'expense' (API auto-matches to bill)
      const apiType = type === 'transfer_out' || type === 'transfer_in' ? 'transfer' : type === 'bill' ? 'expense' : type;

      const transactionData: QuickTransactionData = {
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

      // Add bill instance ID for direct bill payment matching
      if (type === 'bill' && selectedBillInstanceId && selectedBillInstanceId !== 'none') {
        transactionData.billInstanceId = selectedBillInstanceId;
      }

      // Add optional fields if provided (not for transfers)
      // Bills can have category and merchant (they're submitted as expenses)
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
      
      // Add sales tax status for income transactions
      if (apiType === 'income') {
        transactionData.isSalesTaxable = salesTaxEnabled;
      }

      const response = await postWithHousehold(
        '/api/transactions',
        transactionData as unknown as Record<string, unknown>
      );

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
        const defaults: QuickEntryDefaults = {
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
      
      // Refresh bills if transaction type was 'bill' or 'expense' (could affect bills)
      if (type === 'bill' || type === 'expense') {
        // Refresh unpaid bills in this component if type is 'bill'
        if (type === 'bill') {
          await refreshUnpaidBills();
        }
        
        // Emit event for other components (bills page, widgets) to refresh
        window.dispatchEvent(new CustomEvent('bills-refresh', {
          detail: { transactionType: type }
        }));
      }
      
      setAmount('');
      setDescription('');
      setType('expense');
      setCategoryId(null);
      setMerchantId(null);
      setToAccountId('');
      setDate(getTodayLocalDateString());
      setNotes('');
      setShowNotes(false);
      setSelectedBillInstanceId('');
      clearUnpaidBills();
      setSalesTaxEnabled(false);
      setMerchantIsSalesTaxExempt(false);
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
      
      // 1-5: Quick select transaction type
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
      if (e.key === '5') {
        e.preventDefault();
        setType('bill');
        return;
      }
      
      // T: Set date to today
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setDate(getTodayLocalDateString());
        return;
      }
      
      // Y: Set date to yesterday
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        setDate(getRelativeLocalDateString(-1));
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, showNotes]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
              <DialogTitle style={{ color: 'var(--color-foreground)' }}>Quick Entry</DialogTitle>
            </div>
            <ExperimentalBadge />
          </div>
          <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
            Rapid transaction entry. Tab to navigate, Ctrl+Enter to save, ESC to close. Press 1-5 for transaction type, T/Y for date, N for notes.
          </DialogDescription>
          <p className="text-xs mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
            Fields marked with <span style={{ color: 'var(--color-destructive)' }}>*</span> are required
          </p>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {(!initialized || householdLoading) && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading household data...</p>
              </div>
            </div>
          )}
          
          {initialized && !householdLoading && (!selectedHouseholdId || !householdId) && (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 20%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 40%, transparent)', color: 'var(--color-warning)' }}>
              Please select a household to create transactions.
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 20%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 40%, transparent)', color: 'var(--color-destructive)' }}>
              {error}
            </div>
          )}

          {/* Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
              Type <span style={{ color: 'var(--color-destructive)' }}>*</span>
            </label>
            <Select value={type} onValueChange={(value) => handleTypeChange(value as TransactionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="transfer_out">Transfer Out</SelectItem>
                <SelectItem value="transfer_in">Transfer In</SelectItem>
                <SelectItem value="bill">Bill Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bill Selector (for bill payments) */}
          {type === 'bill' && (
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                Select Bill to Pay <span style={{ color: 'var(--color-destructive)' }}>*</span>
              </label>
              <Select value={selectedBillInstanceId || 'none'} onValueChange={handleBillSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a bill to pay" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                  <SelectItem value="none">Select a bill</SelectItem>
                  {billsLoading ? (
                    <SelectItem value="loading" disabled>Loading bills...</SelectItem>
                  ) : unpaidBills.length === 0 ? (
                    <SelectItem value="empty" disabled>No unpaid bills</SelectItem>
                  ) : (
                    unpaidBills.map((item: UnpaidBillWithInstance) => (
                      <SelectItem key={item.instance.id} value={item.instance.id}>
                        <div style={{ color: item.instance.status === 'overdue' ? 'var(--color-destructive)' : 'var(--color-foreground)' }}>
                          {item.instance.status === 'overdue' && (
                            <span className="font-semibold">OVERDUE - </span>
                          )}
                          {item.bill.name} - ${item.instance.expectedAmount?.toFixed(2)} (Due: {format(parseISO(item.instance.dueDate), 'MMM d, yyyy')})
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                Selecting a bill will pre-fill the form. You can still edit any field before submitting.
              </p>
            </div>
          )}

          {/* Account */}
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              style={{ color: fieldErrors.accountId ? 'var(--color-destructive)' : 'var(--color-foreground)' }}
            >
              {type === 'transfer_out' || type === 'transfer_in' ? 'From Account' : 'Account'}
              <span style={{ color: 'var(--color-destructive)' }}>*</span>
            </label>
            {accountsError && (
              <div
                className="p-2 rounded-lg text-xs mb-2"
                style={{
                  backgroundColor: 'color-mix(in oklch, var(--color-destructive) 20%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--color-destructive) 40%, transparent)',
                  color: 'var(--color-destructive)',
                }}
              >
                {accountsError}
              </div>
            )}
            <Select 
              value={accountId} 
              onValueChange={(value) => {
                handleAccountChange(value);
                if (fieldErrors.accountId) setFieldErrors(prev => ({ ...prev, accountId: '' }));
              }}
              disabled={accountsLoading || !initialized || householdLoading || !selectedHouseholdId || !householdId}
            >
              <SelectTrigger style={fieldErrors.accountId ? { borderColor: 'var(--color-destructive)' } : undefined}>
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
                    <Loader2 className="w-4 h-4 animate-spin mr-2" style={{ color: 'var(--color-primary)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading accounts...</span>
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="py-4 px-2 text-center">
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No accounts found. Please create an account first.</p>
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
            {fieldErrors.accountId && (
              <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{fieldErrors.accountId}</p>
            )}
          </div>

          {/* To Account (for transfers) */}
          {(type === 'transfer_out' || type === 'transfer_in') && (
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                style={{ color: fieldErrors.toAccountId ? 'var(--color-destructive)' : 'var(--color-foreground)' }}
              >
                To Account <span style={{ color: 'var(--color-destructive)' }}>*</span>
              </label>
              <Select 
                value={toAccountId} 
                onValueChange={(value) => {
                  setToAccountId(value);
                  if (fieldErrors.toAccountId) setFieldErrors(prev => ({ ...prev, toAccountId: '' }));
                }}
                disabled={accountsLoading || !initialized || householdLoading || !selectedHouseholdId || !householdId || accounts.length === 0}
              >
                <SelectTrigger style={fieldErrors.toAccountId ? { borderColor: 'var(--color-destructive)' } : undefined}>
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
                      <Loader2 className="w-4 h-4 animate-spin mr-2" style={{ color: 'var(--color-primary)' }} />
                      <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading accounts...</span>
                    </div>
                  ) : accounts.filter((account) => account.id !== accountId).length === 0 ? (
                    <div className="py-4 px-2 text-center">
                      <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No other accounts available for transfer.</p>
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
              {fieldErrors.toAccountId && (
                <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{fieldErrors.toAccountId}</p>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: fieldErrors.amount ? 'var(--color-destructive)' : 'var(--color-foreground)' }}>
              Amount <span style={{ color: 'var(--color-destructive)' }}>*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5" style={{ color: 'var(--color-muted-foreground)' }}>$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (fieldErrors.amount) setFieldErrors(prev => ({ ...prev, amount: '' }));
                }}
                className="pl-7 placeholder:italic"
                style={{
                  ...(fieldErrors.amount && { borderColor: 'var(--color-destructive)' }),
                }}
                autoFocus
              />
            </div>
            {fieldErrors.amount && (
              <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{fieldErrors.amount}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: fieldErrors.description ? 'var(--color-destructive)' : 'var(--color-foreground)' }}>
              Description <span style={{ color: 'var(--color-destructive)' }}>*</span>
            </label>
            <Input
              placeholder="e.g., Coffee, Gas, Salary"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (fieldErrors.description) setFieldErrors(prev => ({ ...prev, description: '' }));
              }}
              className="placeholder:italic"
              style={{
                ...(fieldErrors.description && { borderColor: 'var(--color-destructive)' }),
              }}
            />
            {fieldErrors.description && (
              <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{fieldErrors.description}</p>
            )}
          </div>

          {/* Category */}
          {type !== 'transfer_in' && type !== 'transfer_out' && (
            <CategorySelector
              selectedCategory={categoryId}
              onCategoryChange={setCategoryId}
              transactionType={type === 'bill' ? 'expense' : type}
              isBusinessAccount={selectedAccountIsBusinessAccount}
            />
          )}

          {/* Merchant */}
          {type !== 'transfer_in' && type !== 'transfer_out' && (
            <MerchantSelector
              selectedMerchant={merchantId}
              onMerchantChange={setMerchantId}
              onMerchantExemptChange={setMerchantIsSalesTaxExempt}
            />
          )}

          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
            />
          </div>

          {/* Notes (Collapsible) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-90"
              style={{ color: 'var(--color-foreground)' }}
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
                className="w-full rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-(--color-primary)"
                style={{
                  backgroundColor: 'var(--color-elevated)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-foreground)',
                }}
              />
            )}
          </div>

          {/* Sales Tax (Only for income transactions) */}
          {type === 'income' && (
            <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
              {merchantIsSalesTaxExempt ? (
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: 'color-mix(in oklch, var(--color-success) 10%, transparent)',
                      color: 'var(--color-success)',
                      border: '1px solid color-mix(in oklch, var(--color-success) 30%, transparent)',
                    }}
                  >
                    Tax Exempt Merchant
                  </span>
                  <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                    Excluded from sales tax
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="quickSalesTax"
                      checked={salesTaxEnabled}
                      onChange={(e) => setSalesTaxEnabled(e.target.checked)}
                      className="h-4 w-4 rounded focus:ring-2 focus:ring-offset-0"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-input)',
                        accentColor: 'var(--color-primary)',
                      }}
                    />
                    <label
                      htmlFor="quickSalesTax"
                      className="text-sm cursor-pointer"
                      style={{ color: 'var(--color-muted-foreground)' }}
                    >
                      Subject to sales tax
                    </label>
                  </div>
                  {!salesTaxEnabled && (
                    <p className="text-xs ml-6" style={{ color: 'var(--color-muted-foreground)' }}>
                      This income will be excluded from sales tax calculations (tax exempt)
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={loading || !initialized || householdLoading || !selectedHouseholdId || !householdId}
              className="flex-1"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loading ? 'Creating...' : 'Add Transaction'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
