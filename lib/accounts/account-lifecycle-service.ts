import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { accounts, bills, billInstances } from '@/lib/db/schema';
import { createAnnualFeeBill, createPaymentBill, deactivateBill } from '@/lib/bills/auto-bill-creation';
import { createMerchantForBank } from '@/lib/merchants/auto-create';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { calculateMinimumPayment, determineChangeReason, trackCreditLimitChange } from '@/lib/accounts';
import type { PaymentAmountSource } from '@/lib/types';
import { toMoneyCents } from '@/lib/utils/money-cents';

export class AccountLifecycleError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AccountLifecycleError';
    this.status = status;
  }
}

export function resolveCreditProfileForAccountType({
  accountType,
  existing,
  updates,
  calculatedMinimumPayment,
}: {
  accountType: string;
  existing: {
    interestRate: number | null;
    minimumPaymentPercent: number | null;
    minimumPaymentFloor: number | null;
    statementDueDate: string | null;
    annualFee: number | null;
    annualFeeMonth: number | null;
    autoCreatePaymentBill: boolean;
    includeInPayoffStrategy: boolean;
    isSecured: boolean;
    securedAsset: string | null;
    drawPeriodEndDate: string | null;
    repaymentPeriodEndDate: string | null;
    interestType: string | null;
    primeRateMargin: number | null;
  };
  updates: {
    interestRate?: unknown;
    minimumPaymentPercent?: unknown;
    minimumPaymentFloor?: unknown;
    statementDueDay?: unknown;
    annualFee?: unknown;
    annualFeeMonth?: unknown;
    autoCreatePaymentBill?: unknown;
    includeInPayoffStrategy?: unknown;
    isSecured?: unknown;
    securedAsset?: unknown;
    drawPeriodEndDate?: unknown;
    repaymentPeriodEndDate?: unknown;
    interestType?: unknown;
    primeRateMargin?: unknown;
  };
  calculatedMinimumPayment: number | null;
}) {
  const isCreditType = accountType === 'credit' || accountType === 'line_of_credit';
  const isLineOfCredit = accountType === 'line_of_credit';

  return {
    interestRate: isCreditType
      ? (updates.interestRate !== undefined ? (updates.interestRate ? Number(updates.interestRate) : null) : existing.interestRate)
      : null,
    minimumPaymentPercent: isCreditType
      ? (updates.minimumPaymentPercent !== undefined ? (updates.minimumPaymentPercent ? Number(updates.minimumPaymentPercent) : null) : existing.minimumPaymentPercent)
      : null,
    minimumPaymentFloor: isCreditType
      ? (updates.minimumPaymentFloor !== undefined ? (updates.minimumPaymentFloor ? Number(updates.minimumPaymentFloor) : null) : existing.minimumPaymentFloor)
      : null,
    minimumPaymentAmount: isCreditType ? calculatedMinimumPayment : null,
    statementDueDate: isCreditType
      ? (updates.statementDueDay !== undefined ? (updates.statementDueDay ? String(updates.statementDueDay) : null) : existing.statementDueDate)
      : null,
    annualFee: isCreditType
      ? (updates.annualFee !== undefined ? (updates.annualFee ? Number(updates.annualFee) : null) : existing.annualFee)
      : null,
    annualFeeMonth: isCreditType
      ? (updates.annualFeeMonth !== undefined ? (updates.annualFeeMonth ? Number(updates.annualFeeMonth) : null) : existing.annualFeeMonth)
      : null,
    autoCreatePaymentBill: isCreditType
      ? (updates.autoCreatePaymentBill !== undefined ? Boolean(updates.autoCreatePaymentBill) : existing.autoCreatePaymentBill)
      : true,
    includeInPayoffStrategy: isCreditType
      ? (updates.includeInPayoffStrategy !== undefined ? Boolean(updates.includeInPayoffStrategy) : existing.includeInPayoffStrategy)
      : false,
    isSecured: isLineOfCredit
      ? (updates.isSecured !== undefined ? Boolean(updates.isSecured) : existing.isSecured)
      : false,
    securedAsset: isLineOfCredit
      ? (updates.securedAsset !== undefined ? (updates.securedAsset ? String(updates.securedAsset) : null) : existing.securedAsset)
      : null,
    drawPeriodEndDate: isLineOfCredit
      ? (updates.drawPeriodEndDate !== undefined ? (updates.drawPeriodEndDate ? String(updates.drawPeriodEndDate) : null) : existing.drawPeriodEndDate)
      : null,
    repaymentPeriodEndDate: isLineOfCredit
      ? (updates.repaymentPeriodEndDate !== undefined ? (updates.repaymentPeriodEndDate ? String(updates.repaymentPeriodEndDate) : null) : existing.repaymentPeriodEndDate)
      : null,
    interestType: isLineOfCredit
      ? (updates.interestType !== undefined ? String(updates.interestType) : existing.interestType)
      : 'fixed',
    primeRateMargin: isLineOfCredit
      ? (updates.primeRateMargin !== undefined ? (updates.primeRateMargin ? Number(updates.primeRateMargin) : null) : existing.primeRateMargin)
      : null,
  };
}

function assertCreateRequiredFields(name?: string, type?: string, bankName?: string) {
  if (!name || !type || !bankName) {
    throw new AccountLifecycleError('Missing required fields (name, type, and bankName are required)', 400);
  }
}

export async function createAccountWithLifecycleEffects({
  userId,
  householdId,
  entityId,
  body,
}: {
  userId: string;
  householdId: string;
  entityId: string;
  body: Record<string, unknown>;
}) {
  const {
    name,
    type,
    bankName,
    accountNumberLast4,
    currentBalance = 0,
    creditLimit,
    color = '#3b82f6',
    icon = 'wallet',
    isBusinessAccount = false,
    enableSalesTax = false,
    enableTaxDeductions = false,
    interestRate,
    minimumPaymentPercent,
    minimumPaymentFloor,
    statementDueDay,
    annualFee,
    annualFeeMonth,
    autoCreatePaymentBill = true,
    includeInPayoffStrategy = true,
    paymentAmountSource = 'statement_balance',
    isSecured,
    securedAsset,
    drawPeriodEndDate,
    repaymentPeriodEndDate,
    interestType = 'fixed',
    primeRateMargin,
    includeInDiscretionary,
  } = body;

  assertCreateRequiredFields(name as string, type as string, bankName as string);

  const accountId = nanoid();
  const now = new Date().toISOString();
  const accountType = String(type);
  const isCreditType = accountType === 'credit' || accountType === 'line_of_credit';

  let calculatedMinimumPayment = 0;
  if (isCreditType && currentBalance) {
    const { minimumPaymentAmount } = calculateMinimumPayment({
      currentBalance: Number(currentBalance),
      minimumPaymentPercent: Number(minimumPaymentPercent) || null,
      minimumPaymentFloor: Number(minimumPaymentFloor) || null,
    });
    calculatedMinimumPayment = minimumPaymentAmount;
  }

  const computedIsBusinessAccount = Boolean(isBusinessAccount || enableSalesTax || enableTaxDeductions);

  await db.insert(accounts).values({
    id: accountId,
    userId,
    householdId,
    entityId,
    name: String(name),
    type: accountType,
    bankName: String(bankName).trim(),
    accountNumberLast4: accountNumberLast4 ? String(accountNumberLast4) : null,
    currentBalance: Number(currentBalance),
    currentBalanceCents: toMoneyCents(Number(currentBalance)) ?? 0,
    creditLimit: creditLimit ? Number(creditLimit) : null,
    creditLimitCents: toMoneyCents(creditLimit ? Number(creditLimit) : null),
    color: String(color),
    icon: String(icon),
    isBusinessAccount: computedIsBusinessAccount,
    enableSalesTax: Boolean(enableSalesTax),
    enableTaxDeductions: Boolean(enableTaxDeductions),
    createdAt: now,
    updatedAt: now,
    interestRate: isCreditType ? (interestRate ? Number(interestRate) : null) : null,
    minimumPaymentPercent: isCreditType ? (minimumPaymentPercent ? Number(minimumPaymentPercent) : null) : null,
    minimumPaymentFloor: isCreditType ? (minimumPaymentFloor ? Number(minimumPaymentFloor) : null) : null,
    minimumPaymentAmount: isCreditType ? calculatedMinimumPayment : null,
    statementDueDate: isCreditType && statementDueDay ? String(statementDueDay) : null,
    annualFee: isCreditType ? (annualFee ? Number(annualFee) : null) : null,
    annualFeeMonth: isCreditType ? (annualFeeMonth ? Number(annualFeeMonth) : null) : null,
    autoCreatePaymentBill: isCreditType ? Boolean(autoCreatePaymentBill) : true,
    includeInPayoffStrategy: isCreditType ? Boolean(includeInPayoffStrategy) : true,
    isSecured: accountType === 'line_of_credit' ? Boolean(isSecured) : false,
    securedAsset: accountType === 'line_of_credit' ? (securedAsset ? String(securedAsset) : null) : null,
    drawPeriodEndDate: accountType === 'line_of_credit' ? (drawPeriodEndDate ? String(drawPeriodEndDate) : null) : null,
    repaymentPeriodEndDate: accountType === 'line_of_credit' ? (repaymentPeriodEndDate ? String(repaymentPeriodEndDate) : null) : null,
    interestType: accountType === 'line_of_credit' ? String(interestType) : 'fixed',
    primeRateMargin: accountType === 'line_of_credit' ? (primeRateMargin ? Number(primeRateMargin) : null) : null,
    includeInDiscretionary: includeInDiscretionary !== undefined
      ? Boolean(includeInDiscretionary)
      : ['checking', 'cash'].includes(accountType),
  });

  const postCreationTasks: Promise<unknown>[] = [];
  postCreationTasks.push(createMerchantForBank(userId, householdId, String(bankName)));

  if (isCreditType) {
    if (autoCreatePaymentBill && statementDueDay) {
      postCreationTasks.push(
        createPaymentBill({
          accountId,
          accountName: String(name),
          userId,
          householdId,
          amountSource: paymentAmountSource as PaymentAmountSource,
          dueDay: Number(statementDueDay),
          expectedAmount: calculatedMinimumPayment,
        })
      );
    }

    if (annualFee && Number(annualFee) > 0 && annualFeeMonth) {
      postCreationTasks.push(
        createAnnualFeeBill({
          accountId,
          accountName: String(name),
          userId,
          householdId,
          annualFee: Number(annualFee),
          feeMonth: Number(annualFeeMonth),
        }).then((feeBillId) => {
          return db
            .update(accounts)
            .set({ annualFeeBillId: feeBillId })
            .where(eq(accounts.id, accountId));
        })
      );
    }

    if (creditLimit && Number(creditLimit) > 0) {
      postCreationTasks.push(
        trackInitialCreditLimitSafe({
          accountId,
          userId,
          householdId,
          creditLimit: Number(creditLimit),
          currentBalance: Number(currentBalance),
        })
      );
    }
  }

  await Promise.all(postCreationTasks);
  return { id: accountId, message: 'Account created successfully' };
}

async function trackInitialCreditLimitSafe({
  accountId,
  userId,
  householdId,
  creditLimit,
  currentBalance,
}: {
  accountId: string;
  userId: string;
  householdId: string;
  creditLimit: number;
  currentBalance: number;
}) {
  return trackCreditLimitChange({
    accountId,
    userId,
    householdId,
    previousLimit: null,
    newLimit: creditLimit,
    changeReason: 'initial',
    currentBalance,
  });
}

export async function updateAccountWithLifecycleEffects({
  id,
  userId,
  householdId,
  entityId,
  allowLegacyUnscoped = false,
  body,
}: {
  id: string;
  userId: string;
  householdId: string;
  entityId: string;
  allowLegacyUnscoped?: boolean;
  body: Record<string, unknown>;
}) {
  const entityScope = allowLegacyUnscoped
    ? or(eq(accounts.entityId, entityId), isNull(accounts.entityId))
    : eq(accounts.entityId, entityId);

  const existingAccount = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, id),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId),
        entityScope
      )
    )
    .limit(1);

  if (!existingAccount || existingAccount.length === 0) {
    throw new AccountLifecycleError('Account not found', 404);
  }

  const existing = existingAccount[0];
  const {
    name,
    type,
    bankName,
    accountNumberLast4,
    currentBalance,
    creditLimit,
    color,
    icon,
    enableSalesTax,
    enableTaxDeductions,
    interestRate,
    minimumPaymentPercent,
    minimumPaymentFloor,
    statementDueDay,
    annualFee,
    annualFeeMonth,
    autoCreatePaymentBill,
    includeInPayoffStrategy,
    paymentAmountSource,
    isSecured,
    securedAsset,
    drawPeriodEndDate,
    repaymentPeriodEndDate,
    interestType,
    primeRateMargin,
    includeInDiscretionary,
  } = body;

  if (!name || !type) {
    throw new AccountLifecycleError('Name and type are required', 400);
  }

  const accountType = String(type);
  const isCreditType = accountType === 'credit' || accountType === 'line_of_credit';
  const wasCreditType = existing.type === 'credit' || existing.type === 'line_of_credit';

  const finalEnableSalesTax = enableSalesTax !== undefined
    ? Boolean(enableSalesTax)
    : Boolean(existing.enableSalesTax ?? existing.isBusinessAccount ?? false);
  const finalEnableTaxDeductions = enableTaxDeductions !== undefined
    ? Boolean(enableTaxDeductions)
    : Boolean(existing.enableTaxDeductions ?? existing.isBusinessAccount ?? false);
  const computedIsBusinessAccount = finalEnableSalesTax || finalEnableTaxDeductions;

  let calculatedMinimumPayment: number | null = null;
  if (isCreditType) {
    const finalBalance = currentBalance !== undefined ? Number(currentBalance) : (existing.currentBalance ?? 0);
    const finalPercent = minimumPaymentPercent !== undefined ? Number(minimumPaymentPercent) : existing.minimumPaymentPercent;
    const finalFloor = minimumPaymentFloor !== undefined ? Number(minimumPaymentFloor) : existing.minimumPaymentFloor;
    const { minimumPaymentAmount } = calculateMinimumPayment({
      currentBalance: finalBalance,
      minimumPaymentPercent: finalPercent || null,
      minimumPaymentFloor: finalFloor || null,
    });
    calculatedMinimumPayment = minimumPaymentAmount;
  }

  const finalCurrentBalance = currentBalance !== undefined ? Number(currentBalance) : existing.currentBalance;
  const finalCreditLimit = creditLimit !== undefined ? (creditLimit ? Number(creditLimit) : null) : existing.creditLimit;
  const nowIso = new Date().toISOString();

  const creditProfile = resolveCreditProfileForAccountType({
    accountType,
    existing: {
      interestRate: existing.interestRate,
      minimumPaymentPercent: existing.minimumPaymentPercent,
      minimumPaymentFloor: existing.minimumPaymentFloor,
      statementDueDate: existing.statementDueDate,
      annualFee: existing.annualFee,
      annualFeeMonth: existing.annualFeeMonth,
      autoCreatePaymentBill: existing.autoCreatePaymentBill,
      includeInPayoffStrategy: existing.includeInPayoffStrategy,
      isSecured: existing.isSecured,
      securedAsset: existing.securedAsset,
      drawPeriodEndDate: existing.drawPeriodEndDate,
      repaymentPeriodEndDate: existing.repaymentPeriodEndDate,
      interestType: existing.interestType,
      primeRateMargin: existing.primeRateMargin,
    },
    updates: {
      interestRate,
      minimumPaymentPercent,
      minimumPaymentFloor,
      statementDueDay,
      annualFee,
      annualFeeMonth,
      autoCreatePaymentBill,
      includeInPayoffStrategy,
      isSecured,
      securedAsset,
      drawPeriodEndDate,
      repaymentPeriodEndDate,
      interestType,
      primeRateMargin,
    },
    calculatedMinimumPayment,
  });

  await db
    .update(accounts)
    .set({
      name: String(name),
      type: accountType,
      bankName: bankName ? String(bankName) : null,
      accountNumberLast4: accountNumberLast4 ? String(accountNumberLast4) : null,
      currentBalance: finalCurrentBalance,
      currentBalanceCents: toMoneyCents(finalCurrentBalance) ?? 0,
      creditLimit: finalCreditLimit,
      creditLimitCents: toMoneyCents(finalCreditLimit),
      color: color ? String(color) : existing.color,
      icon: icon ? String(icon) : existing.icon,
      isBusinessAccount: computedIsBusinessAccount,
      enableSalesTax: finalEnableSalesTax,
      enableTaxDeductions: finalEnableTaxDeductions,
      updatedAt: nowIso,
      ...creditProfile,
      includeInDiscretionary: includeInDiscretionary !== undefined
        ? Boolean(includeInDiscretionary)
        : existing.includeInDiscretionary,
      annualFeeBillId: isCreditType ? existing.annualFeeBillId : null,
    })
    .where(eq(accounts.id, id));

  const postUpdateTasks: Promise<unknown>[] = [];

  if (isCreditType && creditLimit !== undefined) {
    const previousLimit = existing.creditLimit;
    const newLimit = creditLimit ? Number(creditLimit) : 0;
    if (previousLimit !== newLimit && newLimit > 0) {
      const changeReason = determineChangeReason(previousLimit, newLimit);
      const finalBalance = currentBalance !== undefined ? Number(currentBalance) : existing.currentBalance;
      postUpdateTasks.push(
        trackCreditLimitChange({
          accountId: id,
          userId,
          householdId,
          previousLimit,
          newLimit,
          changeReason,
          currentBalance: finalBalance ?? 0,
        })
      );
    }
  }

  if (isCreditType && autoCreatePaymentBill !== undefined) {
    const wasEnabled = existing.autoCreatePaymentBill;
    const isNowEnabled = Boolean(autoCreatePaymentBill);
    const dueDay = statementDueDay !== undefined ? Number(statementDueDay) : parseInt(existing.statementDueDate || '0', 10);

    if (isNowEnabled && !wasEnabled && dueDay) {
      postUpdateTasks.push(
        createPaymentBill({
          accountId: id,
          accountName: String(name),
          userId,
          householdId,
          amountSource: ((paymentAmountSource as PaymentAmountSource) || 'statement_balance'),
          dueDay,
          expectedAmount: calculatedMinimumPayment || 0,
        })
      );
    }
  }

  if (isCreditType) {
    const previousFee = existing.annualFee;
    const newFee = annualFee !== undefined ? Number(annualFee) : previousFee;
    const newFeeMonth = annualFeeMonth !== undefined ? Number(annualFeeMonth) : existing.annualFeeMonth;
    const existingFeeBillId = existing.annualFeeBillId;

    if (newFee && newFee > 0 && newFeeMonth && !existingFeeBillId) {
      postUpdateTasks.push(
        createAnnualFeeBill({
          accountId: id,
          accountName: String(name),
          userId,
          householdId,
          annualFee: newFee,
          feeMonth: newFeeMonth,
        }).then((feeBillId) => {
          return db
            .update(accounts)
            .set({ annualFeeBillId: feeBillId })
            .where(eq(accounts.id, id));
        })
      );
    } else if ((!newFee || newFee <= 0) && existingFeeBillId) {
      postUpdateTasks.push(deactivateBill(existingFeeBillId));
      postUpdateTasks.push(
        db
          .update(accounts)
          .set({ annualFeeBillId: null })
          .where(eq(accounts.id, id))
      );
    }
  }

  // Cleanup credit-linked annual fee bill when transitioning away from credit account types.
  if (wasCreditType && !isCreditType && existing.annualFeeBillId) {
    postUpdateTasks.push(deactivateBill(existing.annualFeeBillId));
  }

  await Promise.all(postUpdateTasks);
  return { id, message: 'Account updated successfully' };
}

export async function deleteAccountWithLifecycleEffects({
  id,
  userId,
  householdId,
  entityId,
  allowLegacyUnscoped = false,
}: {
  id: string;
  userId: string;
  householdId: string;
  entityId: string;
  allowLegacyUnscoped?: boolean;
}) {
  const entityScope = allowLegacyUnscoped
    ? or(eq(accounts.entityId, entityId), isNull(accounts.entityId))
    : eq(accounts.entityId, entityId);

  const account = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, id),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId),
        entityScope
      )
    )
    .limit(1);

  if (!account || account.length === 0) {
    throw new AccountLifecycleError('Account not found', 404);
  }

  await runInDatabaseTransaction(async (tx) => {
    const linkedBills = await tx
      .select({ id: bills.id })
      .from(bills)
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.householdId, householdId),
          or(
            eq(bills.linkedAccountId, id),
            eq(bills.chargedToAccountId, id)
          )
        )
      );

    const billIds = linkedBills.map((b) => b.id);
    if (billIds.length > 0) {
      await tx.delete(billInstances).where(inArray(billInstances.billId, billIds));
      await tx.delete(bills).where(inArray(bills.id, billIds));
    }

    await tx
      .delete(accounts)
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId),
          entityScope
        )
      );
  });

  return { message: 'Account deleted successfully' };
}
