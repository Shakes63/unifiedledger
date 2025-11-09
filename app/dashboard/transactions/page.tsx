'use client';

import { useState, useEffect, Suspense } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Copy, Split, Upload, Plus } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AdvancedSearch } from '@/components/transactions/advanced-search';
import { CSVImportModal } from '@/components/csv-import/csv-import-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Account {
  id: string;
  name: string;
}

interface Merchant {
  id: string;
  name: string;
  categoryId?: string;
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const accountIdFromUrl = searchParams.get('accountId');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [repeatingTxId, setRepeatingTxId] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [paginationOffset, setPaginationOffset] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [hasMore, setHasMore] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<any>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [updatingTxId, setUpdatingTxId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingMerchant, setCreatingMerchant] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newMerchantName, setNewMerchantName] = useState('');
  const [pendingTxId, setPendingTxId] = useState<string | null>(null);

  // Auto-filter by account if accountId is in URL
  useEffect(() => {
    if (accountIdFromUrl && accounts.length > 0) {
      const filters = {
        accountIds: [accountIdFromUrl],
      };
      setCurrentFilters(filters);
      performSearch(filters, 0);
    }
  }, [accountIdFromUrl, accounts]);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);

        // Fetch transactions
        const txResponse = await fetch('/api/transactions?limit=100');
        if (txResponse.ok) {
          const txData = await txResponse.json();
          setTransactions(txData); // API already returns newest first
          setTotalResults(txData.length);
        }

        // Fetch categories
        const catResponse = await fetch('/api/categories');
        if (catResponse.ok) {
          const catData = await catResponse.json();
          setCategories(catData);
        }

        // Fetch accounts
        const accResponse = await fetch('/api/accounts');
        if (accResponse.ok) {
          const accData = await accResponse.json();
          setAccounts(accData);
        }

        // Fetch merchants
        const merResponse = await fetch('/api/merchants?limit=1000');
        if (merResponse.ok) {
          const merData = await merResponse.json();
          setMerchants(merData);
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const performSearch = async (filters: any, offset: number = 0) => {
    try {
      setSearchLoading(true);

      const params = new URLSearchParams();
      if (filters.query) params.append('query', filters.query);
      if (filters.categoryIds?.length > 0) params.append('categoryIds', filters.categoryIds.join(','));
      if (filters.accountIds?.length > 0) params.append('accountIds', filters.accountIds.join(','));
      if (filters.types?.length > 0) params.append('types', filters.types.join(','));
      if (filters.amountMin !== undefined) params.append('amountMin', filters.amountMin.toString());
      if (filters.amountMax !== undefined) params.append('amountMax', filters.amountMax.toString());
      if (filters.dateStart) params.append('dateStart', filters.dateStart);
      if (filters.dateEnd) params.append('dateEnd', filters.dateEnd);
      if (filters.isPending) params.append('isPending', 'true');
      if (filters.isSplit) params.append('isSplit', 'true');
      if (filters.hasNotes) params.append('hasNotes', 'true');
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      params.append('limit', pageSize.toString());
      params.append('offset', offset.toString());

      const response = await fetch(`/api/transactions/search?${params.toString()}`);
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
  };

  const handleAdvancedSearch = async (filters: any) => {
    setCurrentFilters(filters);
    setPaginationOffset(0);
    await performSearch(filters, 0);
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

      const today = new Date().toISOString().split('T')[0];

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: transaction.accountId,
          categoryId: transaction.categoryId,
          date: today,
          amount: transaction.amount,
          description: transaction.description,
          notes: transaction.notes,
          type: transaction.type,
        }),
      });

      if (response.ok) {
        await response.json(); // Get the response but don't use it
        // Refetch transactions to get accurate data
        if (currentFilters) {
          // If we're in search mode, re-run the search
          await performSearch(currentFilters, paginationOffset);
        } else {
          // Otherwise, refetch all transactions
          const txResponse = await fetch('/api/transactions?limit=100');
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return { backgroundColor: 'color-mix(in oklch, var(--color-income) 20%, transparent)', color: 'var(--color-income)' };
      case 'expense':
        return { backgroundColor: 'color-mix(in oklch, var(--color-expense) 20%, transparent)', color: 'var(--color-expense)' };
      case 'transfer':
      case 'transfer_in':
      case 'transfer_out':
        return { backgroundColor: 'color-mix(in oklch, var(--color-transfer) 20%, transparent)', color: 'var(--color-transfer)' };
      default:
        return { backgroundColor: 'color-mix(in oklch, var(--color-muted-foreground) 20%, transparent)', color: 'var(--color-muted-foreground)' };
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

  const handleUpdateTransaction = async (transactionId: string, field: 'categoryId' | 'merchantId', value: string) => {
    try {
      setUpdatingTxId(transactionId);

      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        // Refresh transactions
        if (currentFilters) {
          await performSearch(currentFilters, paginationOffset);
        } else {
          const txResponse = await fetch('/api/transactions?limit=100');
          if (txResponse.ok) {
            const txData = await txResponse.json();
            setTransactions(txData);
            setTotalResults(txData.length);
          }
        }
        toast.success(`Transaction updated`);
      } else {
        toast.error('Failed to update transaction');
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast.error('Failed to update transaction');
    } finally {
      setUpdatingTxId(null);
    }
  };

  const handleCreateCategory = async (transactionId: string) => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      setUpdatingTxId(transactionId);

      // Get transaction to determine category type
      const transaction = transactions.find(t => t.id === transactionId);
      const categoryType = transaction?.type === 'income' ? 'income' : 'variable_expense';

      // Create category
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          type: categoryType,
        }),
      });

      if (response.ok) {
        const newCategory = await response.json();

        // Refresh categories
        const catResponse = await fetch('/api/categories');
        if (catResponse.ok) {
          const catData = await catResponse.json();
          setCategories(catData);
        }

        // Update transaction with new category
        await handleUpdateTransaction(transactionId, 'categoryId', newCategory.id);

        setNewCategoryName('');
        setCreatingCategory(false);
        toast.success('Category created and applied');
      } else {
        toast.error('Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Failed to create category');
    } finally {
      setUpdatingTxId(null);
    }
  };

  const handleCreateMerchant = async (transactionId: string) => {
    if (!newMerchantName.trim()) {
      toast.error('Merchant name is required');
      return;
    }

    try {
      setUpdatingTxId(transactionId);

      // Get transaction to determine merchant category
      const transaction = transactions.find(t => t.id === transactionId);

      // If transaction has a category, link merchant to it
      const merchantCategoryId = transaction?.categoryId || null;

      // Create merchant
      const response = await fetch('/api/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMerchantName.trim(),
          categoryId: merchantCategoryId,
        }),
      });

      if (response.ok) {
        const newMerchant = await response.json();

        // Refresh merchants
        const merResponse = await fetch('/api/merchants?limit=1000');
        if (merResponse.ok) {
          const merData = await merResponse.json();
          setMerchants(merData);
        }

        // Update transaction with new merchant
        await handleUpdateTransaction(transactionId, 'merchantId', newMerchant.id);

        setNewMerchantName('');
        setCreatingMerchant(false);
        toast.success('Merchant created and applied');
      } else {
        toast.error('Failed to create merchant');
      }
    } catch (error) {
      console.error('Error creating merchant:', error);
      toast.error('Failed to create merchant');
    } finally {
      setUpdatingTxId(null);
    }
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
                width={24}
                height={24}
                className="object-contain"
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
                className="bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 font-medium"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Transaction
              </Button>
            </Link>
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
            isLoading={searchLoading}
            initialFilters={currentFilters}
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
              <Button className="font-medium bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90">Add Transaction</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => {
              const display = getTransactionDisplay(transaction);
              const accountName = getAccountName(transaction.accountId);
              const categoryName = getCategoryName(transaction.categoryId);
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
                  <Link href={`/dashboard/transactions/${transaction.id}`} className="block">
                    <div className="flex items-center justify-between gap-2" style={{ ':hover': { backgroundColor: 'var(--color-elevated)' } }}>
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
                                : transaction.type === 'transfer' || transaction.type === 'transfer_in' || transaction.type === 'transfer_out'
                                ? 'var(--color-transfer)'
                                : 'var(--color-expense)'
                            }}
                          >
                            {transaction.type === 'transfer' && accountIdFromUrl
                              ? transaction.accountId === accountIdFromUrl
                                ? '-' // Money leaving this account
                                : transaction.transferId === accountIdFromUrl
                                ? '+' // Money coming to this account
                                : '' // Not related to this account (shouldn't happen)
                              : transaction.type === 'transfer'
                              ? '' // General view, no sign for transfers
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
                  </Link>

                  {/* Missing Info Section - Inline */}
                  {hasMissingInfo && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'color-mix(in oklch, var(--color-warning) 30%, transparent)' }} onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs mb-2" style={{ color: 'var(--color-warning)' }}>
                        {updatingTxId === transaction.id ? 'Updating...' : 'Missing information:'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {/* Category selector */}
                        {!transaction.categoryId && (
                          <div className="flex-1 min-w-[200px]">
                            {creatingCategory && pendingTxId === transaction.id ? (
                              <div className="flex gap-1">
                                <Input
                                  value={newCategoryName}
                                  onChange={(e) => setNewCategoryName(e.target.value)}
                                  placeholder="New category name..."
                                  className="h-8 text-xs"
                                  style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleCreateCategory(transaction.id);
                                    } else if (e.key === 'Escape') {
                                      setCreatingCategory(false);
                                      setNewCategoryName('');
                                      setPendingTxId(null);
                                    }
                                  }}
                                  autoFocus
                                  disabled={updatingTxId === transaction.id}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleCreateCategory(transaction.id)}
                                  disabled={updatingTxId === transaction.id || !newCategoryName.trim()}
                                  className="h-8 px-2 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90"
                                >
                                  Add
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setCreatingCategory(false);
                                    setNewCategoryName('');
                                    setPendingTxId(null);
                                  }}
                                  disabled={updatingTxId === transaction.id}
                                  className="h-8 px-2"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Select
                                onValueChange={(value) => {
                                  if (value === '__create_new__') {
                                    setCreatingCategory(true);
                                    setPendingTxId(transaction.id);
                                  } else {
                                    handleUpdateTransaction(transaction.id, 'categoryId', value);
                                  }
                                }}
                                disabled={updatingTxId === transaction.id}
                              >
                                <SelectTrigger className="h-8 text-xs disabled:opacity-50" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                                  <SelectValue placeholder="Select category..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__create_new__" className="font-medium" style={{ color: 'var(--color-income)' }}>
                                    + Create new category...
                                  </SelectItem>
                                  {getFilteredCategories(transaction.type).map((category) => (
                                    <SelectItem key={category.id} value={category.id}>
                                      {category.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )}

                        {/* Merchant selector (only for non-transfer transactions) */}
                        {transaction.type !== 'transfer_out' && transaction.type !== 'transfer_in' && !transaction.merchantId && (
                          <div className="flex-1 min-w-[200px]">
                            {creatingMerchant && pendingTxId === transaction.id ? (
                              <div className="flex gap-1">
                                <Input
                                  value={newMerchantName}
                                  onChange={(e) => setNewMerchantName(e.target.value)}
                                  placeholder="New merchant name..."
                                  className="h-8 text-xs"
                                  style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleCreateMerchant(transaction.id);
                                    } else if (e.key === 'Escape') {
                                      setCreatingMerchant(false);
                                      setNewMerchantName('');
                                      setPendingTxId(null);
                                    }
                                  }}
                                  autoFocus
                                  disabled={updatingTxId === transaction.id}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleCreateMerchant(transaction.id)}
                                  disabled={updatingTxId === transaction.id || !newMerchantName.trim()}
                                  className="h-8 px-2 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90"
                                >
                                  Add
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setCreatingMerchant(false);
                                    setNewMerchantName('');
                                    setPendingTxId(null);
                                  }}
                                  disabled={updatingTxId === transaction.id}
                                  className="h-8 px-2"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Select
                                onValueChange={(value) => {
                                  if (value === '__create_new__') {
                                    setCreatingMerchant(true);
                                    setPendingTxId(transaction.id);
                                  } else {
                                    handleUpdateTransaction(transaction.id, 'merchantId', value);
                                  }
                                }}
                                disabled={updatingTxId === transaction.id}
                              >
                                <SelectTrigger className="h-8 text-xs disabled:opacity-50" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                                  <SelectValue placeholder="Select merchant..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__create_new__" className="font-medium" style={{ color: 'var(--color-income)' }}>
                                    + Create new merchant...
                                  </SelectItem>
                                  {getFilteredMerchants(transaction.type).map((merchant) => (
                                    <SelectItem key={merchant.id} value={merchant.id}>
                                      {merchant.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
            const txResponse = await fetch('/api/transactions?limit=100');
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
