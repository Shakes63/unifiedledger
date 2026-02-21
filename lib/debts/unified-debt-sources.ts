import Decimal from 'decimal.js';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, bills, debtSettings, debts, householdSettings } from '@/lib/db/schema';
import { toMoneyCents } from '@/lib/utils/money-cents';
import type { DebtInput, PaymentFrequency, PayoffMethod } from '@/lib/debts/payoff-calculator';

type UnifiedDebtSourceType = 'account' | 'bill' | 'debt';

const VALID_METHODS: PayoffMethod[] = ['snowball', 'avalanche'];
const VALID_FREQUENCIES: PaymentFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly'];

function toAmount(cents: number): number {
  return new Decimal(cents).div(100).toNumber();
}

function normalizeFrequency(value: unknown): PaymentFrequency | null {
  if (typeof value !== 'string') return null;
  return VALID_FREQUENCIES.includes(value as PaymentFrequency)
    ? (value as PaymentFrequency)
    : null;
}

function normalizeMethod(value: unknown): PayoffMethod | null {
  if (typeof value !== 'string') return null;
  return VALID_METHODS.includes(value as PayoffMethod)
    ? (value as PayoffMethod)
    : null;
}

export interface UnifiedDebtSource extends DebtInput {
  source: UnifiedDebtSourceType;
  sourceType: string;
  includeInPayoffStrategy: boolean;
  originalBalance: number;
}

export interface DebtStrategySettings {
  extraMonthlyPayment: number;
  preferredMethod: PayoffMethod;
  paymentFrequency: PaymentFrequency;
  debtStrategyEnabled: boolean;
}

export async function getDebtStrategySettings(
  userId: string,
  householdId: string
): Promise<DebtStrategySettings> {
  const [householdLevel] = await db
    .select()
    .from(householdSettings)
    .where(eq(householdSettings.householdId, householdId))
    .limit(1);

  if (householdLevel) {
    return {
      extraMonthlyPayment: householdLevel.extraMonthlyPayment || 0,
      preferredMethod: normalizeMethod(householdLevel.debtPayoffMethod) || 'avalanche',
      paymentFrequency: normalizeFrequency(householdLevel.paymentFrequency) || 'monthly',
      debtStrategyEnabled: householdLevel.debtStrategyEnabled ?? false,
    };
  }

  const [legacy] = await db
    .select()
    .from(debtSettings)
    .where(
      and(
        eq(debtSettings.userId, userId),
        eq(debtSettings.householdId, householdId)
      )
    )
    .limit(1);

  if (legacy) {
    return {
      extraMonthlyPayment: legacy.extraMonthlyPayment || 0,
      preferredMethod: normalizeMethod(legacy.preferredMethod) || 'avalanche',
      paymentFrequency: normalizeFrequency(legacy.paymentFrequency) || 'monthly',
      debtStrategyEnabled: false,
    };
  }

  return {
    extraMonthlyPayment: 0,
    preferredMethod: 'avalanche',
    paymentFrequency: 'monthly',
    debtStrategyEnabled: false,
  };
}

export async function getUnifiedDebtSources(
  householdId: string,
  options: { includeZeroBalances?: boolean } = {}
): Promise<UnifiedDebtSource[]> {
  const includeZeroBalances = options.includeZeroBalances ?? false;

  const [creditAccounts, debtBills, standaloneDebts] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          inArray(accounts.type, ['credit', 'line_of_credit']),
          eq(accounts.isActive, true)
        )
      ),
    db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.householdId, householdId),
          eq(bills.isDebt, true),
          eq(bills.isActive, true)
        )
      ),
    db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.householdId, householdId),
          eq(debts.status, 'active')
        )
      ),
  ]);

  const unified: UnifiedDebtSource[] = [];

  for (const account of creditAccounts) {
    const balanceCents = Math.abs(
      account.currentBalanceCents ?? toMoneyCents(account.currentBalance) ?? 0
    );
    const balance = toAmount(balanceCents);
    if (!includeZeroBalances && balance <= 0) continue;

    const minimumPayment = account.minimumPaymentAmount || 0;
    const budgetedExtra = account.budgetedMonthlyPayment
      ? Math.max(0, account.budgetedMonthlyPayment - minimumPayment)
      : 0;
    const additionalMonthlyPayment = Math.max(
      0,
      account.additionalMonthlyPayment ?? budgetedExtra
    );
    const originalCents =
      account.creditLimitCents ??
      toMoneyCents(account.creditLimit) ??
      toMoneyCents(balance) ??
      0;

    unified.push({
      id: account.id,
      name: account.name,
      source: 'account',
      sourceType: account.type,
      remainingBalance: balance,
      originalBalance: toAmount(originalCents),
      minimumPayment,
      additionalMonthlyPayment,
      interestRate: account.interestRate || 0,
      type: account.type,
      loanType: 'revolving',
      compoundingFrequency: account.interestType === 'variable' ? 'daily' : 'monthly',
      billingCycleDays: 30,
      color: account.color || undefined,
      icon: account.icon || undefined,
      includeInPayoffStrategy: account.includeInPayoffStrategy !== false,
    });
  }

  for (const bill of debtBills) {
    const balance = bill.remainingBalance || 0;
    if (!includeZeroBalances && balance <= 0) continue;

    const minimumPayment = bill.minimumPayment || 0;
    const budgetedExtra = bill.budgetedMonthlyPayment
      ? Math.max(0, bill.budgetedMonthlyPayment - minimumPayment)
      : 0;
    const additionalMonthlyPayment = Math.max(
      0,
      bill.billAdditionalMonthlyPayment ?? budgetedExtra
    );

    unified.push({
      id: bill.id,
      name: bill.name,
      source: 'bill',
      sourceType: bill.debtType || 'other',
      remainingBalance: balance,
      originalBalance: bill.originalBalance || balance,
      minimumPayment,
      additionalMonthlyPayment,
      interestRate: bill.billInterestRate || 0,
      type: bill.debtType || 'other',
      loanType: 'installment',
      compoundingFrequency:
        (bill.interestType as 'daily' | 'monthly' | 'quarterly' | 'annually' | null) ||
        'monthly',
      billingCycleDays: 30,
      color: bill.billColor || undefined,
      icon: undefined,
      includeInPayoffStrategy: bill.includeInPayoffStrategy !== false,
    });
  }

  for (const debt of standaloneDebts) {
    const balance = debt.remainingBalance || 0;
    if (!includeZeroBalances && balance <= 0) continue;

    const inferredLoanType = debt.type === 'credit_card' ? 'revolving' : 'installment';
    unified.push({
      id: debt.id,
      name: debt.name,
      source: 'debt',
      sourceType: debt.type || 'other',
      remainingBalance: balance,
      originalBalance: debt.originalAmount || balance,
      minimumPayment: debt.minimumPayment || 0,
      additionalMonthlyPayment: debt.additionalMonthlyPayment || 0,
      interestRate: debt.interestRate || 0,
      type: debt.type || 'other',
      loanType: (debt.loanType as 'revolving' | 'installment' | null) || inferredLoanType,
      compoundingFrequency:
        (debt.compoundingFrequency as 'daily' | 'monthly' | 'quarterly' | 'annually' | null) ||
        'monthly',
      billingCycleDays: debt.billingCycleDays || 30,
      color: debt.color || undefined,
      icon: debt.icon || undefined,
      // Standalone debts are always included until a dedicated toggle column exists.
      includeInPayoffStrategy: true,
    });
  }

  return unified;
}

export function toDebtInputs(
  debts: UnifiedDebtSource[],
  options: { inStrategyOnly?: boolean } = {}
): DebtInput[] {
  const inStrategyOnly = options.inStrategyOnly ?? true;
  const selected = inStrategyOnly
    ? debts.filter((debt) => debt.includeInPayoffStrategy)
    : debts;

  return selected.map(
    ({
      source: _source,
      sourceType: _sourceType,
      includeInPayoffStrategy: _includeInPayoffStrategy,
      originalBalance: _originalBalance,
      ...debtInput
    }) => debtInput
  );
}

export function isValidPayoffMethod(value: unknown): value is PayoffMethod {
  return normalizeMethod(value) !== null;
}

export function isValidPaymentFrequency(value: unknown): value is PaymentFrequency {
  return normalizeFrequency(value) !== null;
}
