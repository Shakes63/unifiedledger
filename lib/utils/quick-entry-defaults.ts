/**
 * Quick Entry Defaults Utility
 * 
 * Manages smart defaults for Quick Entry Mode based on user's last used values.
 * Defaults are stored per household and transaction type.
 */

const STORAGE_PREFIX = 'quick_entry_defaults_';

interface QuickEntryDefaults {
  accountId?: string;
  toAccountId?: string; // For transfers
  categoryId?: string | null;
  merchantId?: string | null;
  transactionType?: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
}

/**
 * Get storage key for a household and transaction type
 */
function getStorageKey(householdId: string, transactionType: string): string {
  return `${STORAGE_PREFIX}${householdId}_${transactionType}`;
}

/**
 * Load defaults for a household and transaction type
 */
export function loadQuickEntryDefaults(
  householdId: string | null,
  transactionType: 'income' | 'expense' | 'transfer_in' | 'transfer_out'
): QuickEntryDefaults {
  if (!householdId || typeof window === 'undefined') {
    return {};
  }

  try {
    const key = getStorageKey(householdId, transactionType);
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load quick entry defaults:', error);
  }

  return {};
}

/**
 * Save defaults for a household and transaction type
 */
export function saveQuickEntryDefaults(
  householdId: string | null,
  transactionType: 'income' | 'expense' | 'transfer_in' | 'transfer_out',
  defaults: QuickEntryDefaults
): void {
  if (!householdId || typeof window === 'undefined') {
    return;
  }

  try {
    const key = getStorageKey(householdId, transactionType);
    localStorage.setItem(key, JSON.stringify(defaults));
  } catch (error) {
    console.error('Failed to save quick entry defaults:', error);
  }
}

/**
 * Clear defaults for a household (useful when switching households)
 */
export function clearQuickEntryDefaults(householdId: string | null): void {
  if (!householdId || typeof window === 'undefined') {
    return;
  }

  try {
    const transactionTypes: Array<'income' | 'expense' | 'transfer_in' | 'transfer_out'> = [
      'income',
      'expense',
      'transfer_in',
      'transfer_out',
    ];

    transactionTypes.forEach((type) => {
      const key = getStorageKey(householdId, type);
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Failed to clear quick entry defaults:', error);
  }
}

