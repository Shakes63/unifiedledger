/**
 * L-DBG-15: a manual debt payment (POST /api/debts/payments source=debt) must
 * split principal/interest like the transaction-linked path, so principal-based
 * charts don't undercount. Only the principal reduces the balance.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { debts, debtPayments } from '@/lib/db/schema';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
  getHouseholdIdFromRequest: vi.fn(),
  requireHouseholdAuth: vi.fn(),
}));
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';

describe('manual debt payment principal/interest split (L-DBG-15)', () => {
  let ctx: { userId: string; householdId: string };
  let debtId: string;

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: ctx.userId,
    });
    (getAndVerifyHousehold as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      householdId: ctx.householdId,
    });

    debtId = nanoid();
    await db.insert(debts).values({
      id: debtId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Card',
      creditorName: 'Bank',
      debtType: 'credit_card',
      originalAmount: 1000,
      remainingBalance: 1000,
      remainingBalanceCents: 100000,
      startDate: '2026-01-01',
      status: 'active',
      interestType: 'fixed',
      interestRate: 24, // 24% APR -> ~2%/month interest on the payment
      loanType: 'revolving',
      compoundingFrequency: 'monthly',
    } as typeof debts.$inferInsert);
  });

  afterEach(async () => {
    await db.delete(debtPayments).where(eq(debtPayments.householdId, ctx.householdId));
    await db.delete(debts).where(eq(debts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  it('records an interest portion and reduces the balance by principal only', async () => {
    const { POST } = await import('@/app/api/debts/payments/route');
    const res = await POST(
      new Request('http://localhost/api/debts/payments', {
        method: 'POST',
        headers: { 'x-household-id': ctx.householdId },
        body: JSON.stringify({ source: 'debt', id: debtId, amount: 100 }),
      })
    );
    expect(res.status).toBeLessThan(400);

    const [payment] = await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.debtId, debtId));
    // Interest-bearing debt: part of the $100 is interest, so principal < 100.
    expect(payment.interestCents).toBeGreaterThan(0);
    expect(payment.principalCents).toBeLessThan(10000);
    expect((payment.principalCents ?? 0) + (payment.interestCents ?? 0)).toBe(10000);

    // The balance drops by PRINCIPAL only, not the full payment.
    const [debt] = await db.select().from(debts).where(eq(debts.id, debtId));
    expect(debt.remainingBalanceCents).toBe(100000 - (payment.principalCents ?? 0));
  });
});
