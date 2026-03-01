'use client';

import { useCallback, useState, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { CreateRuleSheet } from '@/components/rules/create-rule-sheet';
import { CSVImportModal } from '@/components/csv-import/csv-import-modal';
import { TransactionsList } from '@/components/transactions/transactions-list';
import { TransactionsToolbar } from '@/components/transactions/transactions-toolbar';
import { Button } from '@/components/ui/button';
import { HouseholdLoadingState } from '@/components/household/household-loading-state';
import { NoHouseholdError } from '@/components/household/no-household-error';
import { useHousehold } from '@/contexts/household-context';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useTransactionsData } from '@/hooks/use-transactions-data';
import { useTransactionMutations } from '@/hooks/use-transaction-mutations';

function TransactionsContent() {
  const searchParams = useSearchParams();
  const accountIdFromUrl = searchParams.get('accountId');
  const { initialized, loading: householdLoading, selectedHouseholdId } = useHousehold();
  const householdId = selectedHouseholdId;
  const {
    fetchWithHousehold,
    postWithHousehold,
    putWithHousehold,
  } = useHouseholdFetch();

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [createRuleSheetOpen, setCreateRuleSheetOpen] = useState(false);
  const [createRuleDescription, setCreateRuleDescription] = useState('');
  const [createRuleTransactionId, setCreateRuleTransactionId] = useState('');

  const {
    transactions,
    setTransactions,
    categories,
    setCategories,
    accounts,
    merchants,
    setMerchants,
    loading,
    searchLoading,
    totalResults,
    paginationOffset,
    pageSize,
    hasMore,
    currentFilters,
    combinedTransferView,
    defaultImportTemplateId,
    performSearch,
    refreshTransactionsPage,
    handleAdvancedSearch,
    handleClearFilters,
    handleNextPage,
    handlePreviousPage,
  } = useTransactionsData({
    initialized,
    householdLoading,
    householdId,
    selectedHouseholdId,
    accountIdFromUrl,
    fetchWithHousehold,
  });

  const {
    updatingTxId,
    repeatingTxId,
    handleUpdateTransaction,
    handleUpdateTransferAccount,
    handleInlineCreate,
    handleRepeatTransaction,
    refreshAfterRuleCreated,
  } = useTransactionMutations({
    transactions,
    setTransactions,
    setCategories,
    setMerchants,
    currentFilters,
    paginationOffset,
    performSearch,
    refreshTransactionsPage,
    putWithHousehold,
    postWithHousehold,
  });

  const handleCreateRuleFromTransaction = useCallback((transactionId: string, description: string) => {
    setCreateRuleTransactionId(transactionId);
    setCreateRuleDescription(description);
    setCreateRuleSheetOpen(true);
  }, []);

  if (!initialized || householdLoading) {
    return <HouseholdLoadingState />;
  }

  if (!selectedHouseholdId || !householdId) {
    return <NoHouseholdError />;
  }

  const accountNameFromUrl = accountIdFromUrl && accounts.length > 0
    ? accounts.find((account) => account.id === accountIdFromUrl)?.name || 'Account'
    : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
                {accountNameFromUrl ? `${accountNameFromUrl} Transactions` : 'Transactions'}
              </h1>
            </div>
            <span className="font-mono text-xs tabular-nums tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>
              {totalResults.toLocaleString()} record{totalResults !== 1 ? 's' : ''}
              {accountIdFromUrl && ' \u00b7 filtered'}
            </span>
          </div>
        </div>
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <TransactionsToolbar
          categories={categories}
          accounts={accounts}
          searchLoading={searchLoading}
          currentFilters={currentFilters}
          onSearch={handleAdvancedSearch}
          onClearFilters={handleClearFilters}
          onOpenImportModal={() => setImportModalOpen(true)}
        />

        <TransactionsList
          loading={loading}
          transactions={transactions}
          totalResults={totalResults}
          pageSize={pageSize}
          paginationOffset={paginationOffset}
          hasMore={hasMore}
          searchLoading={searchLoading}
          accountIdFromUrl={accountIdFromUrl}
          currentFilters={currentFilters}
          combinedTransferView={combinedTransferView}
          accounts={accounts}
          categories={categories}
          merchants={merchants}
          updatingTxId={updatingTxId}
          repeatingTxId={repeatingTxId}
          onUpdateTransaction={handleUpdateTransaction}
          onUpdateTransferAccount={handleUpdateTransferAccount}
          onInlineCreate={handleInlineCreate}
          onRepeatTransaction={handleRepeatTransaction}
          onCreateRuleFromTransaction={handleCreateRuleFromTransaction}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
        />
      </main>

      <CSVImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={async () => {
          try {
            await refreshTransactionsPage(0, true);
            toast.success('Transactions refreshed');
          } catch (error) {
            console.error('Failed to refresh transactions:', error);
          }
        }}
        accounts={accounts}
        defaultTemplateId={defaultImportTemplateId}
      />

      <CreateRuleSheet
        open={createRuleSheetOpen}
        onOpenChange={setCreateRuleSheetOpen}
        prefillDescription={createRuleDescription}
        transactionId={createRuleTransactionId}
        onRuleCreated={async () => {
          await refreshAfterRuleCreated();
        }}
      />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={(
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
          <div className="text-center space-y-2">
            <div
              className="mx-auto h-8 w-8 rounded-full animate-pulse"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 20%, transparent)' }}
            />
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading transactions...</p>
          </div>
        </div>
      )}
    >
      <TransactionsContent />
    </Suspense>
  );
}
