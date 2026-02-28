import Decimal from 'decimal.js';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { salesTaxSettings, salesTaxTransactions } from '@/lib/db/schema';
import { fromMoneyCents } from '@/lib/utils/money-cents';

export function getQuarterAndYear(dateString: string): {
  quarter: number;
  taxYear: number;
} {
  const date = new Date(dateString);
  const month = date.getMonth();
  const year = date.getFullYear();

  return {
    quarter: Math.floor(month / 3) + 1,
    taxYear: year,
  };
}

function toRateBps(ratePercent: number): number {
  return new Decimal(ratePercent).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

function resolveAppliedRateBps(settings: typeof salesTaxSettings.$inferSelect): number {
  const stateRate = settings.stateRate ?? 0;
  const countyRate = settings.countyRate ?? 0;
  const cityRate = settings.cityRate ?? 0;
  const specialDistrictRate = settings.specialDistrictRate ?? 0;

  const componentTotal = new Decimal(stateRate)
    .plus(countyRate)
    .plus(cityRate)
    .plus(specialDistrictRate);

  if (componentTotal.greaterThan(0)) {
    return toRateBps(componentTotal.toNumber());
  }

  return toRateBps(settings.defaultRate ?? 0);
}

function buildJurisdictionSnapshot(settings: typeof salesTaxSettings.$inferSelect): string {
  const snapshot = {
    jurisdiction: settings.jurisdiction ?? null,
    state: {
      name: settings.stateName ?? null,
      ratePercent: settings.stateRate ?? 0,
    },
    county: {
      name: settings.countyName ?? null,
      ratePercent: settings.countyRate ?? 0,
    },
    city: {
      name: settings.cityName ?? null,
      ratePercent: settings.cityRate ?? 0,
    },
    specialDistrict: {
      name: settings.specialDistrictName ?? null,
      ratePercent: settings.specialDistrictRate ?? 0,
    },
  };

  return JSON.stringify(snapshot);
}

export async function upsertSalesTaxSnapshot(params: {
  transactionId: string;
  userId: string;
  householdId: string;
  accountId: string;
  amountCents: number;
  date: string;
}): Promise<void> {
  const settingsResult = await db
    .select()
    .from(salesTaxSettings)
    .where(
      and(
        eq(salesTaxSettings.userId, params.userId),
        eq(salesTaxSettings.householdId, params.householdId)
      )
    )
    .limit(1);

  const settings = settingsResult[0];
  if (!settings || settings.enableTracking === false) {
    await deleteSalesTaxRecord(params.transactionId);
    return;
  }

  const appliedRateBps = resolveAppliedRateBps(settings);
  if (appliedRateBps <= 0) {
    await deleteSalesTaxRecord(params.transactionId);
    return;
  }

  const taxAmountCents = new Decimal(params.amountCents)
    .times(appliedRateBps)
    .dividedBy(10_000)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  const { quarter, taxYear } = getQuarterAndYear(params.date);
  const nowIso = new Date().toISOString();
  const jurisdictionSnapshot = buildJurisdictionSnapshot(settings);

  const existing = await db
    .select({ id: salesTaxTransactions.id })
    .from(salesTaxTransactions)
    .where(eq(salesTaxTransactions.transactionId, params.transactionId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(salesTaxTransactions)
      .set({
        accountId: params.accountId,
        transactionDate: params.date,
        taxableAmountCents: params.amountCents,
        taxAmountCents,
        appliedRateBps,
        jurisdictionSnapshot,
        quarter,
        taxYear,
        updatedAt: nowIso,
      })
      .where(eq(salesTaxTransactions.id, existing[0].id));
    return;
  }

  await db.insert(salesTaxTransactions).values({
    id: crypto.randomUUID(),
    userId: params.userId,
    householdId: params.householdId,
    accountId: params.accountId,
    transactionId: params.transactionId,
    transactionDate: params.date,
    taxableAmountCents: params.amountCents,
    taxAmountCents,
    appliedRateBps,
    jurisdictionSnapshot,
    quarter,
    taxYear,
    reportedStatus: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
  });
}

export async function deleteSalesTaxRecord(transactionId: string): Promise<void> {
  try {
    await db
      .delete(salesTaxTransactions)
      .where(eq(salesTaxTransactions.transactionId, transactionId));
  } catch (error) {
    console.error('Failed to delete sales tax record:', error);
  }
}

export async function hasSalesTax(transactionId: string): Promise<boolean> {
  const recordResult = await db
    .select({ id: salesTaxTransactions.id })
    .from(salesTaxTransactions)
    .where(eq(salesTaxTransactions.transactionId, transactionId))
    .limit(1);

  return recordResult.length > 0;
}

export async function getSalesTaxSummary(transactionIds: string[]): Promise<{
  totalSales: number;
  totalTax: number;
  count: number;
}> {
  if (transactionIds.length === 0) {
    return { totalSales: 0, totalTax: 0, count: 0 };
  }

  const records = await db
    .select({
      taxableAmountCents: salesTaxTransactions.taxableAmountCents,
      taxAmountCents: salesTaxTransactions.taxAmountCents,
    })
    .from(salesTaxTransactions)
    .where(inArray(salesTaxTransactions.transactionId, transactionIds));

  const totalSales = records.reduce(
    (sum, record) => sum + (fromMoneyCents(record.taxableAmountCents) ?? 0),
    0
  );
  const totalTax = records.reduce(
    (sum, record) => sum + (fromMoneyCents(record.taxAmountCents) ?? 0),
    0
  );

  return {
    totalSales,
    totalTax,
    count: records.length,
  };
}
