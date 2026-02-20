export interface TransactionListItem {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  accountId: string;
  categoryId?: string;
  merchantId?: string;
  transferId?: string;
  transferGroupId?: string | null;
  pairedTransactionId?: string | null;
  transferSourceAccountId?: string | null;
  transferDestinationAccountId?: string | null;
  notes?: string;
  isSplit?: boolean;
  isSalesTaxable?: boolean;
  savingsGoalId?: string | null;
  savingsGoalName?: string | null;
  savingsGoalColor?: string | null;
}

export interface CategoryListItem {
  id: string;
  name: string;
  type: string;
}

export interface AccountListItem {
  id: string;
  name: string;
  enableSalesTax?: boolean;
}

export interface MerchantListItem {
  id: string;
  name: string;
  categoryId?: string;
}

export interface TransactionSearchFilters {
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
  [key: string]: unknown;
}
