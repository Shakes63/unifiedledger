/**
 * Bug-hunt findings AG1/AG2/AG3: the unified debt list double-counted a card
 * tracked as an account AND a linked debt-enabled bill template, converted
 * overpaid (negative-owed) credit accounts into positive debt via Math.abs,
 * and emitted bill-template debts with a $0 minimum payment.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { accounts, billTemplates, debts } from '@/lib/db/schema';
import { getUnifiedDebtSources } from '@/lib/debts/unified-debt-sources';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

describe('getUnifiedDebtSources (AG1/AG2/AG3)', () => {
  let ctx: { userId: string; householdId: string };
  let cardId: string;

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    cardId = nanoid();
  });

  afterEach(async () => {
    await db.delete(billTemplates).where(eq(billTemplates.householdId, ctx.householdId));
    await db.delete(debts).where(eq(debts.householdId, ctx.householdId));
    await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  it('AG1: a card tracked as account + linked template counts ONCE', async () => {
    await db.insert(accounts).values({
      id: cardId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Unified Visa',
      type: 'credit',
      bankName: 'Test',
      currentBalance: 850,
      currentBalanceCents: 85000,
      minimumPaymentAmount: 35,
      interestRate: 24,
    } as typeof accounts.$inferInsert);

    await db.insert(billTemplates).values({
      id: nanoid(),
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      name: 'Visa Payment Bill',
      billType: 'expense',
      classification: 'loan_payment',
      recurrenceType: 'monthly',
      recurrenceDueDay: 1,
      defaultAmountCents: 3500,
      linkedLiabilityAccountId: cardId,
      debtEnabled: true,
      debtRemainingBalanceCents: 85000,
    } as typeof billTemplates.$inferInsert);

    const unified = await getUnifiedDebtSources(ctx.householdId);
    // The old code returned both — $1,700 of "debt" for an $850 card.
    expect(unified).toHaveLength(1);
    expect(unified[0].id).toBe(cardId);
    expect(unified[0].remainingBalance).toBe(850);
  });

  it('AG2: an overpaid card is not debt', async () => {
    await db.insert(accounts).values({
      id: cardId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Overpaid Visa',
      type: 'credit',
      bankName: 'Test',
      // Positive-owed convention: negative means the issuer owes the USER.
      currentBalance: -120,
      currentBalanceCents: -12000,
    } as typeof accounts.$inferInsert);

    const unified = await getUnifiedDebtSources(ctx.householdId);
    // Math.abs turned this into $120 of debt; max(0) makes it zero and the
    // zero-balance skip drops it.
    expect(unified).toHaveLength(0);
  });

  it('AG3: an unlinked debt-enabled bill carries its recurring amount as the minimum', async () => {
    await db.insert(billTemplates).values({
      id: nanoid(),
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      name: 'Car Loan Bill',
      billType: 'expense',
      classification: 'loan_payment',
      recurrenceType: 'monthly',
      recurrenceDueDay: 1,
      defaultAmountCents: 20000,
      debtEnabled: true,
      debtRemainingBalanceCents: 500000,
      debtInterestAprBps: 800,
    } as typeof billTemplates.$inferInsert);

    const unified = await getUnifiedDebtSources(ctx.householdId);
    expect(unified).toHaveLength(1);
    // The old code emitted minimumPayment: 0, so the simulator paid this debt
    // NOTHING while other debts were focused and its balance grew.
    expect(unified[0].minimumPayment).toBe(200);
    expect(unified[0].interestRate).toBe(8);
    expect(unified[0].compoundingFrequency).toBe('monthly');
  });
});
