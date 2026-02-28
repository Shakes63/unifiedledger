import Decimal from 'decimal.js';
import { and, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { accounts, billTemplates, debts, householdSettings } from '@/lib/db/schema';
import { toMoneyCents } from '@/lib/utils/money-cents';
import type { DebtInput, PaymentFrequency, PayoffMethod } from '@/lib/debts/payoff-calculator';

type UnifiedDebtSourceType = 'account' | 'bill' | 'debt';

const VALID_METHODS: PayoffMethod[] = ['snowball', 'avalanche'];
const VALID_FREQUENCIES: PaymentFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly'];
type HouseholdPaymentFrequency = 'weekly' | 'biweekly' | 'monthly';

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

function toHouseholdPaymentFrequency(
  value: PaymentFrequency
): HouseholdPaymentFrequency {
  // household_settings currently supports weekly/biweekly/monthly only
  return value === 'quarterly' ? 'monthly' : value;
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

export interface DebtStrategySettingsUpdate {
  extraMonthlyPayment?: number;
  preferredMethod?: PayoffMethod;
  paymentFrequency?: PaymentFrequency;
  debtStrategyEnabled?: boolean;
}

export async function getDebtStrategySettings(
  _userId: string,
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

  return {
    extraMonthlyPayment: 0,
    preferredMethod: 'avalanche',
    paymentFrequency: 'monthly',
    debtStrategyEnabled: false,
  };
}

export async function upsertDebtStrategySettings(
  _userId: string,
  householdId: string,
  update: DebtStrategySettingsUpdate
): Promise<DebtStrategySettings> {
  const current = await getDebtStrategySettings(_userId, householdId);
  const next: DebtStrategySettings = {
    extraMonthlyPayment:
      update.extraMonthlyPayment !== undefined
        ? update.extraMonthlyPayment
        : current.extraMonthlyPayment,
    preferredMethod: update.preferredMethod || current.preferredMethod,
    paymentFrequency: update.paymentFrequency || current.paymentFrequency,
    debtStrategyEnabled:
      update.debtStrategyEnabled !== undefined
        ? update.debtStrategyEnabled
        : current.debtStrategyEnabled,
  };

  const [existingHouseholdSettings] = await db
    .select()
    .from(householdSettings)
    .where(eq(householdSettings.householdId, householdId))
    .limit(1);

  if (existingHouseholdSettings) {
    await db
      .update(householdSettings)
      .set({
        extraMonthlyPayment: next.extraMonthlyPayment,
        debtPayoffMethod: next.preferredMethod,
        paymentFrequency: toHouseholdPaymentFrequency(next.paymentFrequency),
        debtStrategyEnabled: next.debtStrategyEnabled,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(householdSettings.householdId, householdId));
  } else {
    await db.insert(householdSettings).values({
      id: nanoid(),
      householdId,
      extraMonthlyPayment: next.extraMonthlyPayment,
      debtPayoffMethod: next.preferredMethod,
      paymentFrequency: toHouseholdPaymentFrequency(next.paymentFrequency),
      debtStrategyEnabled: next.debtStrategyEnabled,
    });
  }

  return next;
}

export async function getUnifiedDebtSources(
  householdId: string,
  options: { includeZeroBalances?: boolean } = {}
): Promise<UnifiedDebtSource[]> {
  const includeZeroBalances = options.includeZeroBalances ?? false;

  const [creditAccounts, debtTemplates, standaloneDebts] = await Promise.all([
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
      .from(billTemplates)
      .where(
        and(
          eq(billTemplates.householdId, householdId),
          eq(billTemplates.debtEnabled, true),
          eq(billTemplates.isActive, true)
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

  for (const template of debtTemplates) {
    const balance =
      template.debtRemainingBalanceCents !== null
        ? toAmount(template.debtRemainingBalanceCents)
        : 0;
    if (!includeZeroBalances && balance <= 0) continue;

    unified.push({
      id: template.id,
      name: template.name,
      source: 'bill',
      sourceType: 'other',
      remainingBalance: balance,
      originalBalance:
        template.debtOriginalBalanceCents !== null
          ? toAmount(template.debtOriginalBalanceCents)
          : balance,
      minimumPayment: 0,
      additionalMonthlyPayment: 0,
      interestRate:
        template.debtInterestAprBps !== null
          ? new Decimal(template.debtInterestAprBps).div(100).toNumber()
          : 0,
      type: 'other',
      loanType: 'installment',
      compoundingFrequency:
        (template.debtInterestType as 'daily' | 'monthly' | 'quarterly' | 'annually' | null) ||
        'monthly',
      billingCycleDays: 30,
      color: template.debtColor || undefined,
      icon: undefined,
      includeInPayoffStrategy: template.includeInPayoffStrategy !== false,
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
