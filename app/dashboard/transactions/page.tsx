'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Copy, Split, Upload } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
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
}

interface Account {
  id: string;
  name: string;
}

interface Merchant {
  id: string;
  name: string;
}

export default function TransactionsPage() {
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

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);

        // Fetch transactions
        const txResponse = await fetch('/api/transactions?limit=100');
        if (txResponse.ok) {
          const txData = await txResponse.json();
          setTransactions(txData.reverse()); // Show newest first
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
        const newTransaction = await response.json();
        setTransactions([newTransaction, ...transactions]);
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
        return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />;
      case 'expense':
        return <ArrowUpRight className="w-4 h-4 text-red-400" />;
      case 'transfer':
      case 'transfer_in':
      case 'transfer_out':
        return <ArrowRightLeft className="w-4 h-4 text-blue-400" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'expense':
        return 'bg-red-500/20 text-red-400';
      case 'transfer':
      case 'transfer_in':
      case 'transfer_out':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
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

  const getTransactionDisplay = (transaction: Transaction): string => {
    if (transaction.type === 'transfer') {
      return `${getAccountName(transaction.accountId)} → ${getAccountName(transaction.transferId)}`;
    }
    const merchant = getMerchantName(transaction.merchantId);
    if (merchant) {
      return merchant;
    }
    return transaction.description;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-elevated/50 backdrop-blur-sm sticky top-0 z-50">
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
              <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
              <p className="text-sm text-muted-foreground">
                {totalResults} transaction{totalResults !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#6b7280]">Search & Filter</h2>
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

        {/* Advanced Search */}
        <div className="mb-8">
          <AdvancedSearch
            categories={categories}
            accounts={accounts}
            onSearch={handleAdvancedSearch}
            isLoading={searchLoading}
          />
        </div>

        {/* Transactions List */}
        {loading ? (
          <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] text-center py-12 rounded-xl">
            <p className="text-gray-400">Loading transactions...</p>
          </Card>
        ) : transactions.length === 0 ? (
          <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] text-center py-12 rounded-xl">
            <p className="text-gray-400 mb-4">
              {transactions.length === 0
                ? 'No transactions yet.'
                : 'No transactions match your filters.'}
            </p>
            <Link href="/dashboard/transactions/new">
              <Button className="bg-white text-black hover:bg-gray-100 font-medium">Add Transaction</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <Link key={transaction.id} href={`/dashboard/transactions/${transaction.id}`}>
                <Card className="p-2 border border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#242424] transition-colors rounded-lg cursor-pointer">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="p-1.5 bg-[#242424] rounded flex-shrink-0">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">
                          {getTransactionDisplay(transaction)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                          {transaction.isSplit && ' • Split'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="text-right">
                        <p
                          className={`font-semibold text-sm ${
                            transaction.type === 'income'
                              ? 'text-emerald-400'
                              : 'text-white'
                          }`}
                        >
                          {transaction.type === 'income' ? '+' : '-'}$
                          {transaction.amount.toFixed(2)}
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
                        className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#242424] flex-shrink-0"
                        title="Repeat this transaction with today's date"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {currentFilters && transactions.length > 0 && (
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-[#9ca3af]">
              Showing {paginationOffset + 1}-{Math.min(paginationOffset + pageSize, totalResults)} of {totalResults}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handlePreviousPage}
                disabled={paginationOffset === 0 || searchLoading}
                className="bg-[#242424] hover:bg-[#2a2a2a] text-white disabled:opacity-50"
              >
                Previous
              </Button>
              <Button
                onClick={handleNextPage}
                disabled={!hasMore || searchLoading}
                className="bg-[#242424] hover:bg-[#2a2a2a] text-white disabled:opacity-50"
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
        accounts={accounts}
      />
    </div>
  );
}
