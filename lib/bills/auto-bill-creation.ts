/**
 * Auto Bill Creation Helper
 * 
 * Functions for automatically creating bills linked to credit card accounts.
 * Used when creating/editing credit cards and lines of credit with payment tracking enabled.
 */

import { db } from '@/lib/db';
import { billTemplates } from '@/lib/db/schema';
import type { PaymentAmountSource } from '@/lib/types';
import { createBillTemplate } from '@/lib/bills/service';
import { toMoneyCents } from '@/lib/utils/money-cents';

interface CreatePaymentBillParams {
  accountId: string;
  accountName: string;
  userId: string;
  householdId: string;
  amountSource: PaymentAmountSource;
  dueDay: number;
  expectedAmount?: number;
  categoryId?: string | null;
}

interface CreateAnnualFeeBillParams {
  accountId: string;
  accountName: string;
  userId: string;
  householdId: string;
  annualFee: number;
  feeMonth: number; // 1-12
  categoryId?: string | null;
}

/**
 * Creates a monthly payment bill linked to a credit account.
 * This bill tracks the monthly payment due for the credit card or line of credit.
 * 
 * @returns The ID of the created bill
 */
export async function createPaymentBill({
  accountId,
  accountName,
  userId,
  householdId,
  amountSource,
  dueDay,
  expectedAmount = 0,
  categoryId = null,
}: CreatePaymentBillParams): Promise<string> {
  const template = await createBillTemplate(userId, householdId, {
    name: `${accountName} Payment`,
    billType: 'expense',
    classification: 'loan_payment',
    recurrenceType: 'monthly',
    recurrenceDueDay: dueDay,
    defaultAmountCents: toMoneyCents(expectedAmount) ?? 0,
    isVariableAmount: true,
    // Wide tolerance for card/LOC statement variability.
    amountToleranceBps: 10000,
    categoryId,
    linkedLiabilityAccountId: accountId,
    autoMarkPaid: true,
    notes: `Auto-created payment bill (amount source: ${amountSource})`,
    isActive: true,
  });

  return template.id;
}

/**
 * Creates an annual fee bill for a credit card.
 * This bill tracks the annual fee charged by the credit card company.
 * 
 * @returns The ID of the created bill
 */
export async function createAnnualFeeBill({
  accountId,
  accountName,
  userId,
  householdId,
  annualFee,
  feeMonth,
  categoryId = null,
}: CreateAnnualFeeBillParams): Promise<string> {
  const dueDay = 1;
  const template = await createBillTemplate(userId, householdId, {
    name: `${accountName} Annual Fee`,
    billType: 'expense',
    classification: 'membership',
    recurrenceType: 'annual',
    recurrenceDueDay: dueDay,
    recurrenceStartMonth: feeMonth - 1,
    defaultAmountCents: toMoneyCents(annualFee) ?? 0,
    isVariableAmount: false,
    amountToleranceBps: 500,
    categoryId,
    chargedToAccountId: accountId,
    autoMarkPaid: false,
    isActive: true,
  });

  return template.id;
}

/**
 * Deactivates a template by setting isActive to false.
 * Used when disabling payment tracking on an account.
 * 
 * @param templateId - The ID of the template to deactivate
 */
export async function deactivateBillTemplate(templateId: string): Promise<void> {
  const { eq } = await import('drizzle-orm');

  await db
    .update(billTemplates)
    .set({ 
      isActive: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(billTemplates.id, templateId));
}

