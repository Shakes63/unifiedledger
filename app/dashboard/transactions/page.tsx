'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Copy, Split, Upload, Plus, Pencil, ShieldOff, Target } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AdvancedSearch } from '@/components/transactions/advanced-search';
import { CSVImportModal } from '@/components/csv-import/csv-import-modal';
import { TransactionTemplatesManager } from '@/components/transactions/transaction-templates-manager';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { InlineTransactionDropdown } from '@/components/transactions/inline-transaction-dropdown';
import { InlineDescriptionEdit } from '@/components/transactions/inline-description-edit';
import { InlineDateEdit } from '@/components/transactions/inline-date-edit';
import { InlineAmountEdit } from '@/components/transactions/inline-amount-edit';
import { InlineAccountSelect } from '@/components/transactions/inline-account-select';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { HouseholdLoadingState } from '@/components/household/household-loading-state';
import { NoHouseholdError } from '@/components/household/no-household-error';

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
  isSalesTaxable?: boolean;
  // Phase 18: Savings goal info
  savingsGoalId?: string | null;
  savingsGoalName?: string | null;
  savingsGoalColor?: string | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Account {
  id: string;
  name: string;
  enableSalesTax?: boolean;
}

interface Merchant {
  id: string;
  name: string;
  categoryId?: string;
}

type TransactionSearchFilters = {
  query?: string;
  categoryIds?: string[];
  accountIds?: string[];
  tagIds?: string[];
  customFieldIds?: string[];
  types?: string[];
  amountMin?: number;
  amountMax?: number;
  dateStart?: string;
  dateEnd?: string;
  isPending?: boolean;
  isSplit?: boolean;
  hasNotes?: boolean;
  hasSavingsGoal?: boolean;
  sortBy?: 'date' | 'amount' | 'description';
  sortOrder?: 'asc' | 'desc';
};

function TransactionsContent() {
  const searchParams = useSearchParams();
  const accountIdFromUrl = searchParams.get('accountId');
  const { initialized, loading: householdLoading, selectedHouseholdId: householdId } = useHousehold();
  const {
    fetchWithHousehold,
    postWithHousehold,
    putWithHousehold,
    selectedHouseholdId
  } = useHouseholdFetch();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [repeatingTxId, setRepeatingTxId] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [paginationOffset, setPaginationOffset] = useState(0);
  const [pageSize, _setPageSize] = useState(50);
  const [hasMore, setHasMore] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<TransactionSearchFilters | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [defaultImportTemplateId, setDefaultImportTemplateId] = useState<string | undefined>(undefined);
  const [updatingTxId, setUpdatingTxId] = useState<string | null>(null);
  const [combinedTransferView, setCombinedTransferView] = useState<boolean>(true); // Default to combined view

  const performSearch = useCallback(async (filters: TransactionSearchFilters, offset: number = 0) => {
    try {
      setSearchLoading(true);

      const params = new URLSearchParams();
      if (filters.query) params.append('query', filters.query);
      if (filters.categoryIds && filters.categoryIds.length > 0) {
        params.append('categoryIds', filters.categoryIds.join(','));
      }
      if (filters.accountIds && filters.accountIds.length > 0) {
        params.append('accountIds', filters.accountIds.join(','));
      }
      if (filters.types && filters.types.length > 0) {
        params.append('types', filters.types.join(','));
      }
      if (filters.amountMin !== undefined) params.append('amountMin', filters.amountMin.toString());
      if (filters.amountMax !== undefined) params.append('amountMax', filters.amountMax.toString());
      if (filters.dateStart) params.append('dateStart', filters.dateStart);
      if (filters.dateEnd) params.append('dateEnd', filters.dateEnd);
      if (filters.isPending) params.append('isPending', 'true');
      if (filters.isSplit) params.append('isSplit', 'true');
      if (filters.hasNotes) params.append('hasNotes', 'true');
      if (filters.hasSavingsGoal) params.append('hasSavingsGoal', 'true'); // Phase 18
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      params.append('limit', pageSize.toString());
      params.append('offset', offset.toString());

      const response = await fetchWithHousehold(`/api/transactions/search?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
        setTotalResults(data.pagination.total);
        setHasMore(data.pagination.hasMore);
        setPaginationOffset(offset);

        if (offset === 0) {
          toast.success(`Found ${data.pagination.total} transaction(s)`);
        }
      } else {
        toast.error('Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search transactions');
    } finally {
      setSearchLoading(false);
    }
  }, [fetchWithHousehold, pageSize]);

  // Auto-filter by account if accountId is in URL
  useEffect(() => {
    if (accountIdFromUrl && accounts.length > 0) {
      const filters: TransactionSearchFilters = {
        accountIds: [accountIdFromUrl],
      };
      setCurrentFilters(filters);
      void performSearch(filters, 0);
    }
  }, [accountIdFromUrl, accounts, performSearch]);

  // Fetch initial data
  useEffect(() => {
    // Don't fetch if household context isn't initialized yet
    if (!initialized || householdLoading) {
      return;
    }

    // Don't fetch if no household is selected
    if (!selectedHouseholdId || !householdId) {
      setLoading(false);
      return;
    }

    const fetchInitialData = async () => {

      try {
        setLoading(true);

        // Fetch transactions
        const txResponse = await fetchWithHousehold('/api/transactions?limit=100');
        if (txResponse.ok) {
          const txData = await txResponse.json();
          setTransactions(txData); // API already returns newest first
          setTotalResults(txData.length);
        }

        // Fetch categories
        const catResponse = await fetchWithHousehold('/api/categories');
        if (catResponse.ok) {
          const catData = await catResponse.json();
          setCategories(catData);
        }

        // Fetch accounts
        const accResponse = await fetchWithHousehold('/api/accounts');
        if (accResponse.ok) {
          const accData = await accResponse.json();
          setAccounts(accData);
        }

        // Fetch merchants
        const merResponse = await fetchWithHousehold('/api/merchants?limit=1000');
        if (merResponse.ok) {
          const merData = await merResponse.json();
          setMerchants(merData);
        }

        // Fetch user settings for default import template
        const settingsResponse = await fetch('/api/user/settings', { credentials: 'include' });
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          setDefaultImportTemplateId(settingsData.defaultImportTemplateId || undefined);
        }

        // Fetch household preferences for transfer view setting
        if (selectedHouseholdId) {
          const prefsResponse = await fetchWithHousehold(`/api/user/households/${selectedHouseholdId}/preferences`);
          if (prefsResponse.ok) {
            const prefsData = await prefsResponse.json();
            setCombinedTransferView(prefsData.combinedTransferView !== false); // Default to true if not set
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [initialized, householdLoading, selectedHouseholdId, householdId, fetchWithHousehold]);

  // Refresh transfer view preference when household changes
  useEffect(() => {
    if (!selectedHouseholdId) return;
    
    const fetchPreference = async () => {
      try {
        const prefsResponse = await fetchWithHousehold(`/api/user/households/${selectedHouseholdId}/preferences`);
        if (prefsResponse.ok) {
          const prefsData = await prefsResponse.json();
          setCombinedTransferView(prefsData.combinedTransferView !== false); // Default to true if not set
        }
      } catch (error) {
        console.error('Failed to fetch transfer view preference:', error);
      }
    };
    
    fetchPreference();
  }, [selectedHouseholdId, fetchWithHousehold]);

  const handleAdvancedSearch = async (filters: TransactionSearchFilters) => {
    setCurrentFilters(filters);
    setPaginationOffset(0);
    await performSearch(filters, 0);
  };

  const handleClearFilters = async () => {
    setCurrentFilters(null);
    setPaginationOffset(0);
    setHasMore(false);
    
    // Refetch all transactions
    try {
      setSearchLoading(true);
      const txResponse = await fetchWithHousehold('/api/transactions?limit=100');
      if (txResponse.ok) {
        const txData = await txResponse.json();
        setTransactions(txData);
        setTotalResults(txData.length);
      }
    } catch (error) {
      console.error('Failed to refresh transactions:', error);
      toast.error('Failed to refresh transactions');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleNextPage = async () => {
    if (currentFilters) {
      await performSearch(currentFilters, paginationOffset + pageSize);
    }
  };

  const handlePreviousPage = async () => {
    if (currentFilters && paginationOffset >= pageSize) {
      await performSearch(currentFilters, paginationOffset - pageSize);
    }
  };

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
        await response.json(); // Get the response but don't use it
        // Refetch transactions to get accurate data
        if (currentFilters) {
          // If we're in search mode, re-run the search
          await performSearch(currentFilters, paginationOffset);
        } else {
          // Otherwise, refetch all transactions
          const txResponse = await fetchWithHousehold('/api/transactions?limit=100');
          if (txResponse.ok) {
            const txData = await txResponse.json();
            setTransactions(txData); // API already returns newest first
            setTotalResults(txData.length);
          }
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

  const isAccountSalesTaxEnabled = (accountId?: string): boolean => {
    if (!accountId) return false;
    const account = accounts.find((a) => a.id === accountId);
    return account?.enableSalesTax ?? false;
  };

  const getTransferDisplayProps = (transaction: Transaction): {
    color: string;
    sign: string;
    effectiveType: 'income' | 'expense' | 'transfer';
  } => {
    // Get filtered account IDs (can be from URL or advanced search filters)
    const filteredAccountIds = accountIdFromUrl 
      ? [accountIdFromUrl]
      : currentFilters?.accountIds || [];
    
    const txType = String(transaction.type).trim();
    
    // If no filter, check combinedTransferView preference
    if (filteredAccountIds.length === 0) {
      // If combined view is enabled, show as transfer (blue, no sign)
      // Note: In combined view, only transfer_out should be shown (filtered by getFilteredTransactions)
      if (combinedTransferView) {
        return {
          color: 'var(--color-transfer)',
          sign: '',
          effectiveType: 'transfer',
        };
      }
      
      // If separate view is enabled, show colors based on transaction type
      // transfer_out = money leaving account (red, expense)
      // transfer_in = money entering account (green, income)
      if (txType === 'transfer_out') {
        return {
          color: 'var(--color-expense)',
          sign: '-',
          effectiveType: 'expense',
        };
      }
      
      if (txType === 'transfer_in') {
        return {
          color: 'var(--color-income)',
          sign: '+',
          effectiveType: 'income',
        };
      }
      
      // Fallback for any other transfer type
      return {
        color: 'var(--color-transfer)',
        sign: '',
        effectiveType: 'transfer',
      };
    }
    
    // Ensure we're comparing strings
    const filteredIds = filteredAccountIds.map((id: string) => String(id));
    const txAccountId = String(transaction.accountId);
    
    // Helper to check if account ID is in filter
    const isAccountInFilter = (accountId: string | undefined) => {
      if (!accountId) return false;
      return filteredIds.includes(String(accountId));
    };
    
    // Handle transfer_out: accountId is source, transferId is destination account ID
    if (txType === 'transfer_out') {
      const sourceAccountId = txAccountId;
      const destinationAccountId = transaction.transferId ? String(transaction.transferId) : null;
      
      const sourceInFilter = isAccountInFilter(sourceAccountId);
      const destinationInFilter = destinationAccountId ? isAccountInFilter(destinationAccountId) : false;
      
      // If both accounts are in filter, check combinedTransferView preference
      if (sourceInFilter && destinationInFilter) {
        // If combined view is enabled, show as transfer (blue, no sign)
        if (combinedTransferView) {
          return {
            color: 'var(--color-transfer)',
            sign: '',
            effectiveType: 'transfer',
          };
        }
        // If separate view is enabled, show as expense (red, negative) for transfer_out
        return {
          color: 'var(--color-expense)',
          sign: '-',
          effectiveType: 'expense',
        };
      }
      
      // If only source account is in filter, money is leaving (red, negative)
      if (sourceInFilter) {
        return {
          color: 'var(--color-expense)',
          sign: '-',
          effectiveType: 'expense',
        };
      }
      
      // If only destination account is in filter, money is arriving (green, positive)
      if (destinationInFilter) {
        return {
          color: 'var(--color-income)',
          sign: '+',
          effectiveType: 'income',
        };
      }
      
      // If neither account is in filter, return fallback
      return {
        color: 'var(--color-transfer)',
        sign: '',
        effectiveType: 'transfer',
      };
    }
    
    // Handle transfer_in: accountId is destination, merchantId or paired tx accountId is source
    if (txType === 'transfer_in') {
      const destinationAccountId = txAccountId;
      
      // Find source account ID (check merchantId first for converted transactions, then paired tx)
      let sourceAccountId: string | null = null;
      if (transaction.merchantId) {
        // For converted transactions, merchantId stores source account ID
        sourceAccountId = String(transaction.merchantId);
      } else if (transaction.transferId) {
        // For regular transfers, find paired transfer_out transaction
        const pairedTx = transactions.find(t => t.id === transaction.transferId);
        if (pairedTx) {
          sourceAccountId = String(pairedTx.accountId);
        }
      }
      
      const sourceInFilter = sourceAccountId ? isAccountInFilter(sourceAccountId) : false;
      const destinationInFilter = isAccountInFilter(destinationAccountId);
      
      // If both accounts are in filter, check combinedTransferView preference
      if (sourceInFilter && destinationInFilter) {
        // If combined view is enabled, show as transfer (blue, no sign)
        if (combinedTransferView) {
          return {
            color: 'var(--color-transfer)',
            sign: '',
            effectiveType: 'transfer',
          };
        }
        // If separate view is enabled, show as income (green, positive) for transfer_in
        return {
          color: 'var(--color-income)',
          sign: '+',
          effectiveType: 'income',
        };
      }
      
      // If only destination account is in filter, money is arriving (green, positive)
      if (destinationInFilter) {
        return {
          color: 'var(--color-income)',
          sign: '+',
          effectiveType: 'income',
        };
      }
      
      // If only source account is in filter, money is leaving (red, negative)
      if (sourceInFilter) {
        return {
          color: 'var(--color-expense)',
          sign: '-',
          effectiveType: 'expense',
        };
      }
      
      // If neither account is in filter, return fallback
      return {
        color: 'var(--color-transfer)',
        sign: '',
        effectiveType: 'transfer',
      };
    }
    
    // Fallback: show as transfer (shouldn't happen if filter is correct)
    return {
      color: 'var(--color-transfer)',
      sign: '',
      effectiveType: 'transfer',
    };
  };

  const getFilteredCategories = (transactionType: string) => {
    if (transactionType === 'income') {
      return categories.filter(c => c.type === 'income');
    } else if (transactionType === 'expense') {
      return categories.filter(c => c.type !== 'income');
    }
    return categories;
  };

  const getFilteredMerchants = (transactionType: string) => {
    if (transactionType === 'income') {
      // Show merchants linked to income categories, or merchants with no category
      return merchants.filter(m => {
        if (!m.categoryId) return true; // Show uncategorized merchants
        const category = categories.find(c => c.id === m.categoryId);
        return category?.type === 'income';
      });
    } else if (transactionType === 'expense') {
      // Show merchants linked to expense categories, or merchants with no category
      return merchants.filter(m => {
        if (!m.categoryId) return true; // Show uncategorized merchants
        const category = categories.find(c => c.id === m.categoryId);
        return category?.type !== 'income';
      });
    }
    return merchants;
  };

  const handleUpdateTransaction = async (
    transactionId: string, 
    field: 'categoryId' | 'merchantId' | 'accountId' | 'date' | 'amount' | 'description', 
    value: string | number
  ) => {
    // Store previous state for rollback on error
    const previousTransactions = [...transactions];
    
    try {
      setUpdatingTxId(transactionId);

      // Optimistic update: Update local state immediately
      setTransactions(prev => prev.map(tx => 
        tx.id === transactionId ? { ...tx, [field]: value } : tx
      ));

      const response = await putWithHousehold(`/api/transactions/${transactionId}`, { [field]: value });

      if (response.ok) {
        toast.success(`Transaction updated`);
        // No need to refresh - optimistic update already applied
      } else {
        // Revert on error
        setTransactions(previousTransactions);
        toast.error('Failed to update transaction');
      }
    } catch (error) {
      // Revert on error
      setTransactions(previousTransactions);
      console.error('Error updating transaction:', error);
      toast.error('Failed to update transaction');
    } finally {
      setUpdatingTxId(null);
    }
  };

  // Handler for inline dropdown create action
  const handleInlineCreate = async (transactionId: string, type: 'category' | 'merchant', name: string) => {
    try {
      setUpdatingTxId(transactionId);
      const transaction = transactions.find(t => t.id === transactionId);

      if (type === 'category') {
        const categoryType = transaction?.type === 'income' ? 'income' : 'variable_expense';
        const response = await postWithHousehold('/api/categories', {
          name: name.trim(),
          type: categoryType,
        });

        if (response.ok) {
          const newCategory = await response.json();
          
          // Optimistic update: Add new category to local state immediately
          setCategories(prev => [...prev, { 
            id: newCategory.id, 
            name: newCategory.name, 
            type: newCategory.type 
          }]);
          
          // Optimistic update: Update transaction with new category
          setTransactions(prev => prev.map(tx => 
            tx.id === transactionId ? { ...tx, categoryId: newCategory.id } : tx
          ));
          
          // Update transaction in backend (no need to await since we already updated locally)
          putWithHousehold(`/api/transactions/${transactionId}`, { categoryId: newCategory.id })
            .catch(err => console.error('Failed to update transaction category:', err));
          
          toast.success(`Category "${name}" created`);
        } else {
          toast.error('Failed to create category');
        }
      } else {
        const merchantCategoryId = transaction?.categoryId || null;
        const response = await postWithHousehold('/api/merchants', {
          name: name.trim(),
          categoryId: merchantCategoryId,
        });

        if (response.ok) {
          const newMerchant = await response.json();
          
          // Optimistic update: Add new merchant to local state immediately
          setMerchants(prev => [...prev, { 
            id: newMerchant.id, 
            name: newMerchant.name, 
            categoryId: newMerchant.categoryId 
          }]);
          
          // Optimistic update: Update transaction with new merchant
          setTransactions(prev => prev.map(tx => 
            tx.id === transactionId ? { ...tx, merchantId: newMerchant.id } : tx
          ));
          
          // Update transaction in backend (no need to await since we already updated locally)
          putWithHousehold(`/api/transactions/${transactionId}`, { merchantId: newMerchant.id })
            .catch(err => console.error('Failed to update transaction merchant:', err));
          
          toast.success(`Merchant "${name}" created`);
        } else {
          toast.error('Failed to create merchant');
        }
      }
    } catch (error) {
      console.error(`Error creating ${type}:`, error);
      toast.error(`Failed to create ${type}`);
    } finally {
      setUpdatingTxId(null);
    }
  };

  // Filter out duplicate transfer transactions - combine transfer_out and transfer_in into single transaction
  // Only deduplicates when combinedTransferView preference is true OR when account filter is applied
  const getFilteredTransactions = (txs: Transaction[]): Transaction[] => {
    // Get filtered account IDs
    const filteredAccountIds = accountIdFromUrl 
      ? [accountIdFromUrl]
      : currentFilters?.accountIds || [];
    
    const filteredIds = filteredAccountIds.length > 0 ? filteredAccountIds.map((id: string) => String(id)) : [];
    const seenTransferPairs = new Set<string>();
    const filtered: Transaction[] = [];
    
    // Helper function to check if both accounts of a transfer are in the filter
    const areBothAccountsInFilter = (sourceId: string, destId: string): boolean => {
      if (filteredIds.length === 0) return false;
      return filteredIds.includes(sourceId) && filteredIds.includes(destId);
    };
    
    // Determine if we should deduplicate transfers:
    // - If only one account is in filter: always show both sides (don't deduplicate)
    // - If both accounts are in filter OR no filter: respect combinedTransferView preference
    //   - If combinedTransferView is true: deduplicate (show as combined)
    //   - If combinedTransferView is false: don't deduplicate (show both sides)
    // Note: We'll check this per-transfer since different transfers may have different account combinations
    
    // Process all transactions
    for (const tx of txs) {
      const txType = String(tx.type).trim();
      
      // Non-transfer transactions: always include
      if (txType !== 'transfer_out' && txType !== 'transfer_in') {
        filtered.push(tx);
        continue;
      }
      
      // For transfer_out: accountId is source, transferId is destination account ID
      if (txType === 'transfer_out') {
        const sourceId = String(tx.accountId);
        const destId = tx.transferId ? String(tx.transferId) : null;
        
        if (!destId) {
          // No destination account ID, include as-is
          filtered.push(tx);
          continue;
        }
        
        // Create a unique key for this transfer pair (sorted for consistency)
        const pairKey = [sourceId, destId].sort().join('|');
        
        // Check if both accounts are in filter
        const bothAccountsInFilter = areBothAccountsInFilter(sourceId, destId);
        
        // Determine if we should deduplicate this specific transfer:
        // - If only one account is in filter: always show both sides (don't deduplicate)
        // - If both accounts are in filter OR no filter: respect combinedTransferView preference
        const shouldDeduplicateThisTransfer = bothAccountsInFilter || filteredIds.length === 0
          ? combinedTransferView // Respect preference when both accounts in filter or no filter
          : false; // Always show both sides when only one account is in filter
        
        if (shouldDeduplicateThisTransfer) {
          // Show as combined transfer - only add transfer_out, skip transfer_in
          if (!seenTransferPairs.has(pairKey)) {
            seenTransferPairs.add(pairKey);
            filtered.push(tx);
          }
          // Skip - we'll skip the corresponding transfer_in in its check
        } else {
          // Separate view: include transaction (will show both transfer_out and transfer_in)
          filtered.push(tx);
        }
        continue;
      }
      
      // transfer_in: accountId is destination, need to find source
      if (txType === 'transfer_in') {
        const destId = String(tx.accountId);
        let sourceId: string | null = null;
        
        // Find source account ID
        if (tx.merchantId) {
          // For converted transactions, merchantId stores source account ID
          sourceId = String(tx.merchantId);
        } else if (tx.transferId) {
          // For regular transfers, transferId points to paired transfer_out transaction
          const pairedTx = txs.find(t => t.id === tx.transferId);
          if (pairedTx) {
            sourceId = String(pairedTx.accountId);
          }
        }
        
        if (!sourceId) {
          // Can't find source account, include as-is
          filtered.push(tx);
          continue;
        }
        
        // Create a unique key for this transfer pair
        const pairKey = [sourceId, destId].sort().join('|');
        
        // Check if both accounts are in filter
        const bothAccountsInFilter = areBothAccountsInFilter(sourceId, destId);
        
        // Determine if we should deduplicate this specific transfer:
        // - If only one account is in filter: always show both sides (don't deduplicate)
        // - If both accounts are in filter OR no filter: respect combinedTransferView preference
        const shouldDeduplicateThisTransfer = bothAccountsInFilter || filteredIds.length === 0
          ? combinedTransferView // Respect preference when both accounts in filter or no filter
          : false; // Always show both sides when only one account is in filter
        
        if (shouldDeduplicateThisTransfer) {
          // Skip transfer_in if we've already added the transfer_out for this pair
          if (seenTransferPairs.has(pairKey)) {
            continue; // Skip this transfer_in - we already have the transfer_out
          }
          
          // If we haven't seen the pair yet, add transfer_in and mark pair as seen
          // (This handles edge case where transfer_out might not be in the list)
          seenTransferPairs.add(pairKey);
          filtered.push(tx);
        } else {
          // Separate view: include transaction (will show both transfer_out and transfer_in)
          filtered.push(tx);
        }
      }
    }
    
    return filtered;
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

  // Show loading state while household context initializes
  if (!initialized || householdLoading) {
    return <HouseholdLoadingState />;
  }

  // Show error state if no household is selected
  if (!selectedHouseholdId || !householdId) {
    return <NoHouseholdError />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b backdrop-blur-sm sticky top-0 z-50" style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 50%, transparent)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6">
              <Image
                src="/logo.png"
                alt="UnifiedLedger Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {accountIdFromUrl && accounts.length > 0
                  ? `${accounts.find((a) => a.id === accountIdFromUrl)?.name || 'Account'} Transactions`
                  : 'Transactions'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {totalResults} transaction{totalResults !== 1 ? 's' : ''}
                {accountIdFromUrl && ' for this account'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Search & Filter</h2>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/transactions/new">
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:opacity-90 font-medium"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Transaction
              </Button>
            </Link>
            <TransactionTemplatesManager
              onTemplateSelected={(template) => {
                // Navigate to new transaction page with template data
                const params = new URLSearchParams({
                  templateId: template.id,
                  accountId: template.accountId,
                  amount: template.amount.toString(),
                  type: template.type,
                  description: template.name,
                  ...(template.categoryId && { categoryId: template.categoryId }),
                  ...(template.notes && { notes: template.notes }),
                });
                window.location.href = `/dashboard/transactions/new?${params.toString()}`;
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </Button>
          </div>
        </div>

        {/* Advanced Search */}
        <div className="mb-8">
          <AdvancedSearch
            categories={categories}
            accounts={accounts}
            onSearch={handleAdvancedSearch}
            onClear={handleClearFilters}
            isLoading={searchLoading}
            initialFilters={currentFilters ?? undefined}
          />
        </div>

        {/* Transactions List */}
        {loading ? (
          <Card className="p-6 border text-center py-12 rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
            <p className="text-muted-foreground">Loading transactions...</p>
          </Card>
        ) : transactions.length === 0 ? (
          <Card className="p-6 border text-center py-12 rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
            <p className="text-muted-foreground mb-4">
              {transactions.length === 0
                ? 'No transactions yet.'
                : 'No transactions match your filters.'}
            </p>
            <Link href="/dashboard/transactions/new">
              <Button className="font-medium bg-primary text-primary-foreground hover:opacity-90">Add Transaction</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {getFilteredTransactions(transactions).map((transaction) => {
              const display = getTransactionDisplay(transaction);
              const accountName = getAccountName(transaction.accountId);
              const isTransfer = transaction.type === 'transfer_out' || transaction.type === 'transfer_in';
              const hasMissingInfo = !isTransfer && (!transaction.categoryId || !transaction.merchantId);

              return (
                <Card
                  key={transaction.id}
                  className="p-2 border transition-colors rounded-lg"
                  style={{
                    borderColor: hasMissingInfo ? 'color-mix(in oklch, var(--color-warning) 50%, transparent)' : 'var(--color-border)',
                    backgroundColor: 'var(--color-card)'
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="p-1.5 rounded shrink-0" style={{ backgroundColor: 'var(--color-elevated)' }}>
                        {getTransactionIcon(transaction.type)}
                      </div>
                      {/* Date column - relative positioning for absolute date picker overlay */}
                      <div className="relative shrink-0 w-16">
                        <InlineDateEdit
                          value={transaction.date}
                          transactionId={transaction.id}
                          onUpdate={handleUpdateTransaction}
                          disabled={updatingTxId === transaction.id}
                        />
                      </div>
                      {/* Merchant & Description column */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isTransfer ? (
                            // Transfer: show "Account A → Account B" as text
                            <p className="font-semibold text-foreground text-sm truncate">
                              {display.merchant}
                            </p>
                          ) : (
                            // Non-transfer: show merchant dropdown
                            <InlineTransactionDropdown
                              type="merchant"
                              value={transaction.merchantId || null}
                              transactionId={transaction.id}
                              transactionType={transaction.type as 'income' | 'expense' | 'transfer_out' | 'transfer_in'}
                              options={getFilteredMerchants(transaction.type)}
                              onUpdate={handleUpdateTransaction}
                              onCreate={handleInlineCreate}
                              disabled={updatingTxId === transaction.id}
                            />
                          )}
                          <EntityIdBadge id={transaction.id} label="TX" />
                        </div>
                        <InlineDescriptionEdit
                          value={transaction.description}
                          transactionId={transaction.id}
                          onUpdate={handleUpdateTransaction}
                          disabled={updatingTxId === transaction.id}
                        />
                        {/* Developer Mode: Show related entity IDs */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {!isTransfer && transaction.merchantId && (
                            <EntityIdBadge id={transaction.merchantId} label="Mer" />
                          )}
                          <EntityIdBadge id={transaction.accountId} label="Acc" />
                          {transaction.isSplit && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Split className="w-3 h-3" /> Split
                            </span>
                          )}
                          {/* Tax Exempt badge for income transactions on sales-tax-enabled accounts */}
                          {transaction.type === 'income' && 
                           !transaction.isSalesTaxable && 
                           isAccountSalesTaxEnabled(transaction.accountId) && (
                            <Badge 
                              variant="outline" 
                              className="text-xs border-warning/50 text-warning bg-warning/10 flex items-center gap-0.5 px-1.5 py-0"
                              title="This income is excluded from sales tax calculations"
                            >
                              <ShieldOff className="w-3 h-3" />
                              Tax Exempt
                            </Badge>
                          )}
                          {/* Phase 18: Savings Goal badge */}
                          {transaction.savingsGoalId && transaction.savingsGoalName && (
                            <Badge 
                              variant="outline" 
                              className="text-xs flex items-center gap-1 px-1.5 py-0"
                              style={{
                                borderColor: `color-mix(in oklch, ${transaction.savingsGoalColor || 'var(--color-primary)'} 50%, transparent)`,
                                color: transaction.savingsGoalColor || 'var(--color-primary)',
                                backgroundColor: `color-mix(in oklch, ${transaction.savingsGoalColor || 'var(--color-primary)'} 15%, transparent)`,
                              }}
                              title={`Contributing to: ${transaction.savingsGoalName}`}
                            >
                              <Target className="w-3 h-3" />
                              {transaction.savingsGoalName}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Category column */}
                      {!isTransfer && (
                        <div className="shrink-0">
                          <InlineTransactionDropdown
                            type="category"
                            value={transaction.categoryId || null}
                            transactionId={transaction.id}
                            transactionType={transaction.type as 'income' | 'expense' | 'transfer_out' | 'transfer_in'}
                            options={getFilteredCategories(transaction.type)}
                            onUpdate={handleUpdateTransaction}
                            onCreate={handleInlineCreate}
                            disabled={updatingTxId === transaction.id}
                          />
                          {transaction.categoryId && (
                            <EntityIdBadge id={transaction.categoryId} label="Cat" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="text-right">
                        {/* Amount (editable) */}
                        {(() => {
                          const isTransferTx = transaction.type === 'transfer_out' || transaction.type === 'transfer_in';
                          const displayProps = isTransferTx 
                            ? getTransferDisplayProps(transaction)
                            : {
                                color: transaction.type === 'income'
                                  ? 'var(--color-income)'
                                  : 'var(--color-expense)',
                                sign: transaction.type === 'income' ? '+' : '-',
                                effectiveType: transaction.type as 'income' | 'expense',
                              };
                          
                          return (
                            <InlineAmountEdit
                              value={transaction.amount}
                              transactionId={transaction.id}
                              type={transaction.type as 'income' | 'expense' | 'transfer_out' | 'transfer_in'}
                              sign={displayProps.sign}
                              color={displayProps.color}
                              onUpdate={handleUpdateTransaction}
                              disabled={updatingTxId === transaction.id}
                            />
                          );
                        })()}
                        {/* Account (editable for non-transfers) */}
                        {isTransfer ? (
                          <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                            {accountName}
                          </p>
                        ) : (
                          <InlineAccountSelect
                            value={transaction.accountId}
                            transactionId={transaction.id}
                            accounts={accounts}
                            onUpdate={handleUpdateTransaction}
                            disabled={updatingTxId === transaction.id}
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <Link href={`/dashboard/transactions/${transaction.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            style={{ color: 'var(--color-muted-foreground)' }}
                            title="Edit transaction"
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRepeatTransaction(transaction)}
                          disabled={repeatingTxId === transaction.id}
                          className="h-7 w-7 shrink-0"
                          style={{ color: 'var(--color-muted-foreground)' }}
                          title="Repeat this transaction with today's date"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {currentFilters && transactions.length > 0 && (
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {paginationOffset + 1}-{Math.min(paginationOffset + pageSize, totalResults)} of {totalResults}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handlePreviousPage}
                disabled={paginationOffset === 0 || searchLoading}
                className="text-foreground disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-elevated)' }}
              >
                Previous
              </Button>
              <Button
                onClick={handleNextPage}
                disabled={!hasMore || searchLoading}
                className="text-foreground disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-elevated)' }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* CSV Import Modal */}
      <CSVImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={async () => {
          // Refresh transactions after successful import
          try {
            const txResponse = await fetchWithHousehold('/api/transactions?limit=100');
            if (txResponse.ok) {
              const txData = await txResponse.json();
              setTransactions(txData); // API already returns newest first
              setTotalResults(txData.length);
              toast.success('Transactions refreshed');
            }
          } catch (error) {
            console.error('Failed to refresh transactions:', error);
          }
        }}
        accounts={accounts}
        defaultTemplateId={defaultImportTemplateId}
      />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading transactions...</p>
      </div>
    }>
      <TransactionsContent />
    </Suspense>
  );
}
