import Decimal from 'decimal.js';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  accounts,
  billPaymentEvents,
  billTemplates,
  householdSettings,
  transactions,
} from '@/lib/db/schema';
import { toMoneyCents } from '@/lib/utils/money-cents';

export interface UnifiedDebtItem {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  balance: number;
  minimumPayment: number;
  recommendedPayment: number;
  budgetedPayment: number | null;
  actualPaid: number;
  isFocusDebt: boolean;
  includeInPayoffStrategy: boolean;
  interestRate?: number;
  color?: string;
}

export interface UnifiedDebtBudgetResponse {
  strategyEnabled: boolean;
  payoffMethod: 'snowball' | 'avalanche';
  extraMonthlyPayment: number;
  paymentFrequency: 'weekly' | 'biweekly' | 'monthly';
  strategyDebts: {
    items: UnifiedDebtItem[];
    totalMinimum: number;
    totalRecommended: number;
    totalPaid: number;
  };
  manualDebts: UnifiedDebtItem[];
  totalMinimumPayments: number;
  totalBudgetedPayments: number;
  totalActualPaid: number;
  debtCount: number;
}

function centsToAmount(cents: number): number {
  return new Decimal(cents).div(100).toNumber();
}

function getAccountBalanceAmount(account: {
  currentBalance: number | null;
  currentBalanceCents: number | null;
}): number {
  return centsToAmount(
    Math.abs(account.currentBalanceCents ?? toMoneyCents(account.currentBalance) ?? 0)
  );
}

function getTransactionAmountAmount(transaction: {
  amount: number;
  amountCents: number | null;
}): number {
  return centsToAmount(transaction.amountCents ?? toMoneyCents(transaction.amount) ?? 0);
}

export async function getUnifiedDebtBudget(params: {
  householdId: string;
  monthStart: string;
  monthEnd: string;
}): Promise<UnifiedDebtBudgetResponse> {
  const { householdId, monthStart, monthEnd } = params;

  const settings = await db
    .select()
    .from(householdSettings)
    .where(eq(householdSettings.householdId, householdId))
    .limit(1);

  const strategyEnabled = settings[0]?.debtStrategyEnabled ?? false;
  const payoffMethod = (settings[0]?.debtPayoffMethod ?? 'avalanche') as
    | 'snowball'
    | 'avalanche';
  const extraMonthlyPayment = settings[0]?.extraMonthlyPayment ?? 0;
  const paymentFrequency = (settings[0]?.paymentFrequency ?? 'monthly') as
    | 'weekly'
    | 'biweekly'
    | 'monthly';

  const creditAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.householdId, householdId),
        inArray(accounts.type, ['credit', 'line_of_credit']),
        eq(accounts.isActive, true)
      )
    );

  const debtTemplates = await db
    .select()
    .from(billTemplates)
    .where(
      and(
        eq(billTemplates.householdId, householdId),
        eq(billTemplates.debtEnabled, true),
        eq(billTemplates.isActive, true)
      )
    );

  const paymentMap = new Map<string, number>();

  if (creditAccounts.length > 0) {
    const accountIds = creditAccounts.map((a) => a.id);
    const creditPayments = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          eq(transactions.type, 'transfer_in'),
          inArray(transactions.accountId, accountIds),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd)
        )
      );

    for (const payment of creditPayments) {
      const current = paymentMap.get(payment.accountId) ?? 0;
      paymentMap.set(
        payment.accountId,
        new Decimal(current).plus(getTransactionAmountAmount(payment)).toNumber()
      );
    }
  }

  if (debtTemplates.length > 0) {
    const templateIds = debtTemplates.map((t) => t.id);
    const templatePayments = await db
      .select({
        templateId: billPaymentEvents.templateId,
        amountCents: billPaymentEvents.amountCents,
      })
      .from(billPaymentEvents)
      .where(
        and(
          eq(billPaymentEvents.householdId, householdId),
          inArray(billPaymentEvents.templateId, templateIds),
          gte(billPaymentEvents.paymentDate, monthStart),
          lte(billPaymentEvents.paymentDate, monthEnd)
        )
      );

    for (const payment of templatePayments) {
      const current = paymentMap.get(payment.templateId) ?? 0;
      paymentMap.set(
        payment.templateId,
        new Decimal(current).plus(centsToAmount(payment.amountCents)).toNumber()
      );
    }
  }

  const allDebts: UnifiedDebtItem[] = [];

  for (const account of creditAccounts) {
    allDebts.push({
      id: account.id,
      name: account.name,
      source: 'account',
      sourceType: account.type,
      balance: getAccountBalanceAmount(account),
      minimumPayment: account.minimumPaymentAmount ?? 0,
      recommendedPayment: account.minimumPaymentAmount ?? 0,
      budgetedPayment: account.budgetedMonthlyPayment,
      actualPaid: paymentMap.get(account.id) ?? 0,
      isFocusDebt: false,
      includeInPayoffStrategy: account.includeInPayoffStrategy ?? true,
      interestRate: account.interestRate ?? undefined,
      color: account.color ?? undefined,
    });
  }

  for (const template of debtTemplates) {
    allDebts.push({
      id: template.id,
      name: template.name,
      source: 'bill',
      sourceType: 'other',
      balance:
        template.debtRemainingBalanceCents !== null
          ? centsToAmount(template.debtRemainingBalanceCents)
          : 0,
      minimumPayment: 0,
      recommendedPayment: 0,
      budgetedPayment: null,
      actualPaid: paymentMap.get(template.id) ?? 0,
      isFocusDebt: false,
      includeInPayoffStrategy: template.includeInPayoffStrategy ?? true,
      interestRate:
        template.debtInterestAprBps !== null
          ? new Decimal(template.debtInterestAprBps).div(100).toNumber()
          : undefined,
      color: template.debtColor ?? undefined,
    });
  }

  const strategyDebts = allDebts.filter((d) => d.includeInPayoffStrategy);
  const manualDebts = allDebts.filter((d) => !d.includeInPayoffStrategy);

  if (strategyEnabled && strategyDebts.length > 0) {
    if (payoffMethod === 'avalanche') {
      strategyDebts.sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
    } else {
      strategyDebts.sort((a, b) => a.balance - b.balance);
    }

    strategyDebts[0].isFocusDebt = true;
    strategyDebts[0].recommendedPayment = new Decimal(strategyDebts[0].minimumPayment)
      .plus(extraMonthlyPayment)
      .toNumber();
  }

  const strategyTotalMinimum = strategyDebts.reduce(
    (sum, d) => new Decimal(sum).plus(d.minimumPayment).toNumber(),
    0
  );
  const strategyTotalRecommended = strategyDebts.reduce(
    (sum, d) => new Decimal(sum).plus(d.recommendedPayment).toNumber(),
    0
  );
  const strategyTotalPaid = strategyDebts.reduce(
    (sum, d) => new Decimal(sum).plus(d.actualPaid).toNumber(),
    0
  );
  const manualTotalBudgeted = manualDebts.reduce(
    (sum, d) => new Decimal(sum).plus(d.budgetedPayment ?? d.minimumPayment).toNumber(),
    0
  );
  const manualTotalPaid = manualDebts.reduce(
    (sum, d) => new Decimal(sum).plus(d.actualPaid).toNumber(),
    0
  );

  return {
    strategyEnabled,
    payoffMethod,
    extraMonthlyPayment,
    paymentFrequency,
    strategyDebts: {
      items: strategyDebts,
      totalMinimum: strategyTotalMinimum,
      totalRecommended: strategyTotalRecommended,
      totalPaid: strategyTotalPaid,
    },
    manualDebts,
    totalMinimumPayments: new Decimal(strategyTotalMinimum)
      .plus(
        manualDebts.reduce(
          (sum, d) => new Decimal(sum).plus(d.minimumPayment).toNumber(),
          0
        )
      )
      .toNumber(),
    totalBudgetedPayments: new Decimal(strategyTotalRecommended)
      .plus(manualTotalBudgeted)
      .toNumber(),
    totalActualPaid: new Decimal(strategyTotalPaid).plus(manualTotalPaid).toNumber(),
    debtCount: allDebts.length,
  };
}
