import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { merchants } from '@/lib/db/schema';

export async function isMerchantSalesTaxExempt(
  type: string,
  finalMerchantId: string | null
): Promise<boolean> {
  if (type !== 'income' || !finalMerchantId) {
    return false;
  }

  const merchantExemptCheck = await db
    .select({ isSalesTaxExempt: merchants.isSalesTaxExempt })
    .from(merchants)
    .where(eq(merchants.id, finalMerchantId))
    .limit(1);

  return merchantExemptCheck[0]?.isSalesTaxExempt || false;
}

export function deriveCreditRefundFlag({
  accountType,
  type,
}: {
  accountType: string;
  type: string;
}): boolean {
  const accountIsCreditAccount = accountType === 'credit' || accountType === 'line_of_credit';
  return type === 'income' && accountIsCreditAccount;
}

export function resolveTaxDeductionType({
  isTaxDeductible,
  enableTaxDeductions,
  isBusinessAccount,
}: {
  isTaxDeductible: boolean;
  enableTaxDeductions?: boolean | null;
  isBusinessAccount?: boolean | null;
}): 'business' | 'personal' | 'none' {
  if (!isTaxDeductible) {
    return 'none';
  }

  return (enableTaxDeductions ?? isBusinessAccount) ? 'business' : 'personal';
}

export function computeUpdatedBalanceCents({
  type,
  currentBalanceCents,
  amountCents,
}: {
  type: string;
  currentBalanceCents: number;
  amountCents: number;
}): number {
  return type === 'expense'
    ? currentBalanceCents - amountCents
    : currentBalanceCents + amountCents;
}
