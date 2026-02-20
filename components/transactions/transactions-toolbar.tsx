'use client';

import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';

import { AdvancedSearch } from '@/components/transactions/advanced-search';
import { TransactionTemplatesManager } from '@/components/transactions/transaction-templates-manager';
import { Button } from '@/components/ui/button';
import type {
  AccountListItem,
  CategoryListItem,
  TransactionSearchFilters,
} from '@/lib/types/transactions-ui';

interface TransactionsToolbarProps {
  categories: CategoryListItem[];
  accounts: AccountListItem[];
  searchLoading: boolean;
  currentFilters: TransactionSearchFilters | null;
  onSearch: (filters: TransactionSearchFilters) => Promise<void>;
  onClearFilters: () => Promise<void>;
  onOpenImportModal: () => void;
}

export function TransactionsToolbar({
  categories,
  accounts,
  searchLoading,
  currentFilters,
  onSearch,
  onClearFilters,
  onOpenImportModal,
}: TransactionsToolbarProps) {
  return (
    <>
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
            onClick={onOpenImportModal}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Button>
        </div>
      </div>

      <div className="mb-8">
        <AdvancedSearch
          categories={categories}
          accounts={accounts}
          onSearch={onSearch}
          onClear={onClearFilters}
          isLoading={searchLoading}
          initialFilters={currentFilters ?? undefined}
        />
      </div>
    </>
  );
}
