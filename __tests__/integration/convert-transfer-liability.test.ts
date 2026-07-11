/**
 * Converting a transaction into a transfer whose TARGET is a liability must
 * apply the liability rule (C-MATH-1) to the target's balance. The convert
 * flow hardcoded the ASSET rule since before the audit, so converting an
 * expense into a credit-card payment INCREASED the card's owed balance
 * instead of reducing it. Caught in the live transfer re-verification.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { accounts, transactions, transfers } from '@/lib/db/schema';
import { setupTestUserWithHousehold, cleanupTestHousehold, createTestTransaction } from './test-utils';

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/api/household-auth', () => ({
  getHouseholdIdFromRequest: vi.fn(),
  requireHouseholdAuth: vi.fn(),
}));
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest } from '@/lib/api/household-auth';

describe('convert-to-transfer with a liability target (C-MATH-1)', () => {
  let ctx: { userId: string; householdId: string };
  let checkingId: string;
  let creditId: string;

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: ctx.userId,
    });
    (getHouseholdIdFromRequest as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      ctx.householdId
    );

    checkingId = nanoid();
    creditId = nanoid();
    await db.insert(accounts).values([
      {
        id: checkingId,
        userId: ctx.userId,
        householdId: ctx.householdId,
        name: 'Conv Checking',
        type: 'checking',
        bankName: 'Test',
        currentBalance: 1000,
        currentBalanceCents: 100000,
      },
      {
        id: creditId,
        userId: ctx.userId,
        householdId: ctx.householdId,
        name: 'Conv Credit',
        type: 'credit',
        bankName: 'Test',
        // Positive-owed convention: the user owes $500.
        currentBalance: 500,
        currentBalanceCents: 50000,
        creditLimit: 5000,
        creditLimitCents: 500000,
      },
    ] as Array<typeof accounts.$inferInsert>);
  });

  afterEach(async () => {
    await db.delete(transfers).where(eq(transfers.householdId, ctx.householdId));
    await db.delete(transactions).where(eq(transactions.householdId, ctx.householdId));
    await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  it('an expense converted into a card payment REDUCES the owed balance', async () => {
    // A $75 expense on checking (already debited at creation time).
    const tx = createTestTransaction(ctx.userId, ctx.householdId, checkingId, {
      type: 'expense',
      amount: 75,
      description: 'to become a card payment',
    });
    await db.insert(transactions).values(tx as typeof transactions.$inferInsert);

    const { POST } = await import('@/app/api/transactions/[id]/convert-to-transfer/route');
    const res = await POST(
      new Request(`http://localhost/api/transactions/${tx.id}/convert-to-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-household-id': ctx.householdId },
        body: JSON.stringify({ targetAccountId: creditId, householdId: ctx.householdId }),
      }),
      { params: Promise.resolve({ id: tx.id }) }
    );
    expect(res.status).toBe(200);

    const [credit] = await db.select().from(accounts).where(eq(accounts.id, creditId));
    // $500 owed - $75 payment = $425 owed. The old asset-rule bug produced 575.
    expect(credit.currentBalanceCents).toBe(42500);

    // Both legs exist and are linked.
    const legs = await db
      .select()
      .from(transactions)
      .where(eq(transactions.householdId, ctx.householdId));
    const types = legs.map((l) => l.type).sort();
    expect(types).toEqual(['transfer_in', 'transfer_out']);
  });

  it('an income converted into a draw FROM a liability INCREASES the owed balance', async () => {
    // A $75 income on checking, reinterpreted as money drawn from the card.
    const tx = createTestTransaction(ctx.userId, ctx.householdId, checkingId, {
      type: 'income',
      amount: 75,
      description: 'to become a cash advance',
    });
    await db.insert(transactions).values(tx as typeof transactions.$inferInsert);

    const { POST } = await import('@/app/api/transactions/[id]/convert-to-transfer/route');
    const res = await POST(
      new Request(`http://localhost/api/transactions/${tx.id}/convert-to-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-household-id': ctx.householdId },
        body: JSON.stringify({ targetAccountId: creditId, householdId: ctx.householdId }),
      }),
      { params: Promise.resolve({ id: tx.id }) }
    );
    expect(res.status).toBe(200);

    const [credit] = await db.select().from(accounts).where(eq(accounts.id, creditId));
    // $500 owed + $75 draw = $575 owed.
    expect(credit.currentBalanceCents).toBe(57500);
  });

  it('asset targets keep the original behavior', async () => {
    const savingsId = nanoid();
    await db.insert(accounts).values({
      id: savingsId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Conv Savings',
      type: 'savings',
      bankName: 'Test',
      currentBalance: 200,
      currentBalanceCents: 20000,
    } as typeof accounts.$inferInsert);

    const tx = createTestTransaction(ctx.userId, ctx.householdId, checkingId, {
      type: 'expense',
      amount: 75,
      description: 'to become a savings transfer',
    });
    await db.insert(transactions).values(tx as typeof transactions.$inferInsert);

    const { POST } = await import('@/app/api/transactions/[id]/convert-to-transfer/route');
    const res = await POST(
      new Request(`http://localhost/api/transactions/${tx.id}/convert-to-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-household-id': ctx.householdId },
        body: JSON.stringify({ targetAccountId: savingsId, householdId: ctx.householdId }),
      }),
      { params: Promise.resolve({ id: tx.id }) }
    );
    expect(res.status).toBe(200);

    const [savings] = await db.select().from(accounts).where(eq(accounts.id, savingsId));
    // Asset destination gains the transfer: $200 + $75.
    expect(savings.currentBalanceCents).toBe(27500);
  });
});
