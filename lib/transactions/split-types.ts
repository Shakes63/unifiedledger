export interface SplitEntry {
  amount?: number;
  percentage?: number;
  isPercentage: boolean;
  categoryId?: string;
}

export interface SplitValidationResult {
  valid: boolean;
  errors: string[];
  totalAmount?: number;
  totalPercentage?: number;
}

export interface SplitValidationOptions {
  requireCategory?: boolean;
  requirePositiveValues?: boolean;
  tolerance?: number;
  transactionAmount?: number;
}

export interface BatchSplitItem {
  id?: string;
  categoryId: string;
  amount?: number;
  percentage?: number;
  isPercentage: boolean;
  description?: string;
  notes?: string;
  sortOrder?: number;
}

export const DEFAULT_SPLIT_TOLERANCE = 0.01;
