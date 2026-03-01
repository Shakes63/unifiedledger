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
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/transactions/new">
            <Button
              size="sm"
              className="hover:opacity-90 font-medium rounded-lg"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span className="hidden xs:inline">New</span>
              <span className="hidden sm:inline"> Transaction</span>
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
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenImportModal}
          className="rounded-lg hover:opacity-90"
            style={{ color: 'var(--color-muted-foreground)' }}
        >
          <Upload className="w-4 h-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Import</span>
        </Button>
      </div>

      <AdvancedSearch
        categories={categories}
        accounts={accounts}
        onSearch={onSearch}
        onClear={onClearFilters}
        isLoading={searchLoading}
        initialFilters={currentFilters ?? undefined}
      />
    </div>
  );
}
