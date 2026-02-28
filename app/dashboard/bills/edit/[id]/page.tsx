'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BillForm } from '@/components/bills/bill-form';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useHousehold } from '@/contexts/household-context';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import type { BillData, BillTemplateUpsertPayload } from '@/components/bills/bill-form';
import type { BillTemplateDto, RecurrenceType } from '@/lib/bills/contracts';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface BillAutopayConfig {
  isEnabled: boolean;
  payFromAccountId: string | null;
  amountType: 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';
  fixedAmountCents: number | null;
  daysBeforeDue: number;
}

function centsToDollars(value: number | null | undefined): number {
  return (value || 0) / 100;
}

function recurrenceToFrequency(recurrenceType: RecurrenceType): BillData['frequency'] {
  if (recurrenceType === 'one_time') return 'one-time';
  if (recurrenceType === 'semi_annual') return 'semi-annual';
  return recurrenceType;
}

function getLegacyDueDate(template: BillTemplateDto): number {
  if (template.recurrenceType === 'weekly' || template.recurrenceType === 'biweekly') {
    return template.recurrenceDueWeekday ?? 0;
  }
  if (template.recurrenceType === 'one_time') {
    const day = Number(template.recurrenceSpecificDueDate?.split('-')[2] || '1');
    return Number.isFinite(day) && day > 0 ? day : 1;
  }
  return template.recurrenceDueDay ?? 1;
}

function mapTemplateToBillData(template: BillTemplateDto, autopay: BillAutopayConfig | null): BillData {
  return {
    id: template.id,
    name: template.name,
    expectedAmount: centsToDollars(template.defaultAmountCents),
    dueDate: getLegacyDueDate(template),
    frequency: recurrenceToFrequency(template.recurrenceType),
    specificDueDate: template.recurrenceSpecificDueDate,
    startMonth: template.recurrenceStartMonth,
    isVariableAmount: template.isVariableAmount,
    amountTolerance: (template.amountToleranceBps || 0) / 100,
    categoryId: template.categoryId,
    merchantId: template.merchantId,
    accountId: template.paymentAccountId,
    autoMarkPaid: template.autoMarkPaid,
    notes: template.notes,
    billType: template.billType,
    billClassification: template.classification,
    classificationSubcategory: template.classificationSubcategory,
    linkedAccountId: template.linkedLiabilityAccountId,
    amountSource: 'fixed',
    chargedToAccountId: template.chargedToAccountId,
    isAutopayEnabled: autopay?.isEnabled || false,
    autopayAccountId: autopay?.payFromAccountId || null,
    autopayAmountType: autopay?.amountType || 'fixed',
    autopayFixedAmount:
      autopay?.fixedAmountCents !== null ? centsToDollars(autopay?.fixedAmountCents) : undefined,
    autopayDaysBefore: autopay?.daysBeforeDue || 0,
    isDebt: template.debtEnabled,
    originalBalance:
      template.debtOriginalBalanceCents !== null
        ? centsToDollars(template.debtOriginalBalanceCents)
        : undefined,
    remainingBalance:
      template.debtRemainingBalanceCents !== null
        ? centsToDollars(template.debtRemainingBalanceCents)
        : undefined,
    billInterestRate:
      template.debtInterestAprBps !== null && template.debtInterestAprBps !== undefined
        ? template.debtInterestAprBps / 100
        : undefined,
    interestType: template.debtInterestType || 'none',
    debtStartDate: template.debtStartDate,
    billColor: template.debtColor,
    includeInPayoffStrategy: template.includeInPayoffStrategy,
    isInterestTaxDeductible: template.interestTaxDeductible,
    taxDeductionType: template.interestTaxDeductionType,
    taxDeductionLimit:
      template.interestTaxDeductionLimitCents !== null
        ? centsToDollars(template.interestTaxDeductionLimitCents)
        : undefined,
    budgetPeriodAssignment: template.budgetPeriodAssignment,
    splitAcrossPeriods: template.splitAcrossPeriods,
    splitAllocations: null,
  };
}

export default function EditBillPage({ params }: PageProps) {
  const router = useRouter();
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [isLoading, setIsLoading] = useState(false);
  const [billData, setBillData] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [billId, setBillId] = useState<string>('');

  useEffect(() => {
    const initPage = async () => {
      const resolvedParams = await params;
      setBillId(resolvedParams.id);

      if (!selectedHouseholdId) {
        setLoading(false);
        return;
      }

      // Fetch existing bill data
      try {
        const response = await fetchWithHousehold(`/api/bills/templates/${resolvedParams.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch bill');
        }
        const payload = await response.json() as {
          data?: { template: BillTemplateDto; autopay: BillAutopayConfig | null };
        };
        if (!payload.data?.template) {
          throw new Error('Bill template not found');
        }
        setBillData(mapTemplateToBillData(payload.data.template, payload.data.autopay ?? null));
      } catch (error) {
        console.error('Error fetching bill:', error);
        toast.error('Failed to load bill data');
        router.push('/dashboard/bills');
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, [params, router, selectedHouseholdId, fetchWithHousehold]);

  const handleSubmit = async (data: BillTemplateUpsertPayload) => {
    try {
      setIsLoading(true);

      const response = await fetchWithHousehold(`/api/bills/templates/${billId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update bill');
      }

      await response.json();
      toast.success('Bill updated successfully');
      router.push(`/dashboard/bills/${billId}`);
    } catch (error) {
      console.error('Error updating bill:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update bill');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push(`/dashboard/bills/${billId}`);
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/bills/${billId}`}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Edit Bill</h1>
            <p className="text-gray-400 mt-1">
              Update bill information and settings
            </p>
          </div>
        </div>

        {/* Form Card */}
        <Card className="bg-background border-border">
          <CardHeader>
            <CardTitle>Bill Details</CardTitle>
            <CardDescription className="text-gray-500">
              Modify the bill information. Changes will apply to future instances.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BillForm
              bill={billData ?? undefined}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
