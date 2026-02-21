'use client';

import { useEffect, useState } from 'react';
import type { SavingsDetectionResult } from '@/lib/transactions/savings-detection';
import type { PaymentBillDetectionResult } from '@/lib/bills/payment-bill-detection';

type HouseholdFetch = (input: string, init?: RequestInit) => Promise<Response>;

interface UseTransferDetectionsOptions {
  enabled: boolean;
  toAccountId: string;
  fetchWithHousehold: HouseholdFetch;
}

interface UseTransferDetectionsResult {
  savingsDetection: SavingsDetectionResult | null;
  paymentBillDetection: PaymentBillDetectionResult | null;
  loadingSavingsDetection: boolean;
  loadingPaymentBillDetection: boolean;
  clear: () => void;
}

export function useTransferDetections({
  enabled,
  toAccountId,
  fetchWithHousehold,
}: UseTransferDetectionsOptions): UseTransferDetectionsResult {
  const [savingsDetection, setSavingsDetection] = useState<SavingsDetectionResult | null>(null);
  const [paymentBillDetection, setPaymentBillDetection] = useState<PaymentBillDetectionResult | null>(null);
  const [loadingSavingsDetection, setLoadingSavingsDetection] = useState(false);
  const [loadingPaymentBillDetection, setLoadingPaymentBillDetection] = useState(false);

  useEffect(() => {
    const runSavingsDetection = async () => {
      if (!enabled || !toAccountId) {
        setSavingsDetection(null);
        setLoadingSavingsDetection(false);
        return;
      }

      try {
        setLoadingSavingsDetection(true);
        const response = await fetchWithHousehold(`/api/savings-goals/detect?accountId=${toAccountId}`);
        if (!response.ok) {
          setSavingsDetection(null);
          return;
        }
        const result: SavingsDetectionResult = await response.json();
        setSavingsDetection(result);
      } catch {
        setSavingsDetection(null);
      } finally {
        setLoadingSavingsDetection(false);
      }
    };

    void runSavingsDetection();
  }, [enabled, toAccountId, fetchWithHousehold]);

  useEffect(() => {
    const runPaymentDetection = async () => {
      if (!enabled || !toAccountId) {
        setPaymentBillDetection(null);
        setLoadingPaymentBillDetection(false);
        return;
      }

      try {
        setLoadingPaymentBillDetection(true);
        const response = await fetchWithHousehold(`/api/bills-v2/detect-payment?accountId=${toAccountId}`);
        if (!response.ok) {
          setPaymentBillDetection(null);
          return;
        }
        const result: PaymentBillDetectionResult = await response.json();
        setPaymentBillDetection(result);
      } catch {
        setPaymentBillDetection(null);
      } finally {
        setLoadingPaymentBillDetection(false);
      }
    };

    void runPaymentDetection();
  }, [enabled, toAccountId, fetchWithHousehold]);

  return {
    savingsDetection,
    paymentBillDetection,
    loadingSavingsDetection,
    loadingPaymentBillDetection,
    clear: () => {
      setSavingsDetection(null);
      setPaymentBillDetection(null);
    },
  };
}
