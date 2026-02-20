'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { Dispatch, SetStateAction } from 'react';

import type {
  CategoryListItem,
  MerchantListItem,
  TransactionListItem,
  TransactionSearchFilters,
} from '@/lib/types/transactions-ui';

type HouseholdPut = (
  url: string,
  data: Record<string, unknown>,
  options?: RequestInit
) => Promise<Response>;

type HouseholdPost = (
  url: string,
  data: Record<string, unknown>,
  options?: RequestInit
) => Promise<Response>;

interface UseTransactionMutationsArgs {
  transactions: TransactionListItem[];
  setTransactions: Dispatch<SetStateAction<TransactionListItem[]>>;
  setCategories: Dispatch<SetStateAction<CategoryListItem[]>>;
  setMerchants: Dispatch<SetStateAction<MerchantListItem[]>>;
  currentFilters: TransactionSearchFilters | null;
  paginationOffset: number;
  performSearch: (
    filters: TransactionSearchFilters,
    offset?: number,
    skipCache?: boolean
  ) => Promise<void>;
  refreshTransactionsPage: (offset?: number, skipCache?: boolean) => Promise<void>;
  putWithHousehold: HouseholdPut;
  postWithHousehold: HouseholdPost;
}

export function useTransactionMutations({
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
}: UseTransactionMutationsArgs) {
  const [updatingTxId, setUpdatingTxId] = useState<string | null>(null);
  const [repeatingTxId, setRepeatingTxId] = useState<string | null>(null);

  const handleUpdateTransaction = useCallback(async (
    transactionId: string,
    field: 'categoryId' | 'merchantId' | 'accountId' | 'date' | 'amount' | 'description',
    value: string | number
  ) => {
    const previousTransactions = [...transactions];

    try {
      setUpdatingTxId(transactionId);

      setTransactions((prev) =>
        prev.map((tx) => (tx.id === transactionId ? { ...tx, [field]: value } : tx))
      );

      const response = await putWithHousehold(`/api/transactions/${transactionId}`, { [field]: value });

      if (response.ok) {
        toast.success('Transaction updated');
      } else {
        setTransactions(previousTransactions);
        toast.error('Failed to update transaction');
      }
    } catch (error) {
      setTransactions(previousTransactions);
      console.error('Error updating transaction:', error);
      toast.error('Failed to update transaction');
    } finally {
      setUpdatingTxId(null);
    }
  }, [putWithHousehold, setTransactions, transactions]);

  const handleUpdateTransferAccount = useCallback(async (
    transactionId: string,
    transactionType: 'transfer_out' | 'transfer_in',
    accountId: string
  ) => {
    const previousTransactions = [...transactions];

    try {
      setUpdatingTxId(transactionId);

      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === transactionId
            ? (
                transactionType === 'transfer_out'
                  ? { ...tx, transferDestinationAccountId: accountId }
                  : { ...tx, transferSourceAccountId: accountId }
              )
            : tx
        )
      );

      const response = await putWithHousehold(
        `/api/transactions/${transactionId}`,
        transactionType === 'transfer_out'
          ? { transferDestinationAccountId: accountId }
          : { transferSourceAccountId: accountId }
      );

      if (response.ok) {
        toast.success('Transfer account updated');
      } else {
        setTransactions(previousTransactions);
        toast.error('Failed to update transfer account');
      }
    } catch (error) {
      setTransactions(previousTransactions);
      console.error('Error updating transfer account:', error);
      toast.error('Failed to update transfer account');
    } finally {
      setUpdatingTxId(null);
    }
  }, [putWithHousehold, setTransactions, transactions]);

  const handleInlineCreate = useCallback(async (
    transactionId: string,
    type: 'category' | 'merchant',
    name: string
  ) => {
    try {
      setUpdatingTxId(transactionId);
      const transaction = transactions.find((tx) => tx.id === transactionId);

      if (type === 'category') {
        const categoryType = transaction?.type === 'income' ? 'income' : 'variable_expense';
        const response = await postWithHousehold('/api/categories', {
          name: name.trim(),
          type: categoryType,
        });

        if (!response.ok) {
          toast.error('Failed to create category');
          return;
        }

        const newCategory = await response.json();
        setCategories((prev) => [
          ...prev,
          {
            id: newCategory.id,
            name: newCategory.name,
            type: newCategory.type,
          },
        ]);

        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === transactionId ? { ...tx, categoryId: newCategory.id } : tx
          )
        );

        putWithHousehold(`/api/transactions/${transactionId}`, { categoryId: newCategory.id })
          .catch((err) => console.error('Failed to update transaction category:', err));

        toast.success(`Category "${name}" created`);
        return;
      }

      const merchantCategoryId = transaction?.categoryId || null;
      const response = await postWithHousehold('/api/merchants', {
        name: name.trim(),
        categoryId: merchantCategoryId,
      });

      if (!response.ok) {
        toast.error('Failed to create merchant');
        return;
      }

      const newMerchant = await response.json();
      setMerchants((prev) => [
        ...prev,
        {
          id: newMerchant.id,
          name: newMerchant.name,
          categoryId: newMerchant.categoryId,
        },
      ]);

      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === transactionId ? { ...tx, merchantId: newMerchant.id } : tx
        )
      );

      putWithHousehold(`/api/transactions/${transactionId}`, { merchantId: newMerchant.id })
        .catch((err) => console.error('Failed to update transaction merchant:', err));

      toast.success(`Merchant "${name}" created`);
    } catch (error) {
      console.error(`Error creating ${type}:`, error);
      toast.error(`Failed to create ${type}`);
    } finally {
      setUpdatingTxId(null);
    }
  }, [
    postWithHousehold,
    putWithHousehold,
    setCategories,
    setMerchants,
    setTransactions,
    transactions,
  ]);

  const handleRepeatTransaction = useCallback(async (transaction: TransactionListItem) => {
    try {
      setRepeatingTxId(transaction.id);
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

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to repeat transaction');
        return;
      }

      if (currentFilters) {
        await performSearch(currentFilters, paginationOffset, true);
      } else {
        await refreshTransactionsPage(paginationOffset, true);
      }

      toast.success(`Transaction repeated: ${transaction.description}`);
    } catch (error) {
      console.error('Error repeating transaction:', error);
      toast.error('Failed to repeat transaction');
    } finally {
      setRepeatingTxId(null);
    }
  }, [currentFilters, paginationOffset, performSearch, postWithHousehold, refreshTransactionsPage]);

  const refreshAfterRuleCreated = useCallback(async () => {
    if (currentFilters) {
      await performSearch(currentFilters, 0, true);
      return;
    }
    await refreshTransactionsPage(0, true);
  }, [currentFilters, performSearch, refreshTransactionsPage]);

  return {
    updatingTxId,
    repeatingTxId,
    handleUpdateTransaction,
    handleUpdateTransferAccount,
    handleInlineCreate,
    handleRepeatTransaction,
    refreshAfterRuleCreated,
  };
}
