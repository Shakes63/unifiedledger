import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { toastWarningWithHelp } from '@/lib/help/toast-with-help';
import { HELP_SECTIONS } from '@/lib/help/help-sections';

interface DuplicateMatch {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  similarity: number;
}

interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicateCount: number;
  potentialMatches: DuplicateMatch[];
  riskLevel: 'low' | 'medium' | 'high';
}

export function useDuplicateCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);

  const checkDuplicates = useCallback(
    async (
      description: string,
      amount: number,
      date: string,
      options?: {
        descriptionThreshold?: number;
        amountThreshold?: number;
        dateRangeInDays?: number;
        silent?: boolean;
      }
    ): Promise<DuplicateCheckResult | null> => {
      if (!description || !amount || !date) {
        return null;
      }

      try {
        setIsChecking(true);

        const response = await fetch('/api/transactions/check-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description,
            amount,
            date,
            descriptionThreshold: options?.descriptionThreshold,
            amountThreshold: options?.amountThreshold,
            dateRangeInDays: options?.dateRangeInDays,
          }),
        });

        if (!response.ok) {
          if (!options?.silent) {
            toast.error('Failed to check for duplicates');
          }
          return null;
        }

        const result: DuplicateCheckResult = await response.json();
        setDuplicateResult(result);

        if (result.hasDuplicates && !options?.silent) {
          if (result.riskLevel === 'high') {
            toastWarningWithHelp(`${result.duplicateCount} very similar transaction(s) found`, {
              description: 'This may be a duplicate entry. Review before saving.',
              helpSection: HELP_SECTIONS.TRANSACTIONS,
            });
          }
        }

        return result;
      } catch (error) {
        console.error('Error checking duplicates:', error);
        if (!options?.silent) {
          toast.error('Error checking for duplicates');
        }
        return null;
      } finally {
        setIsChecking(false);
      }
    },
    []
  );

  const clearResult = useCallback(() => {
    setDuplicateResult(null);
  }, []);

  return {
    isChecking,
    duplicateResult,
    checkDuplicates,
    clearResult,
  };
}
