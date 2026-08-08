/**
 * Product decision (bug-hunt S1, 2026-08-08): standalone debts are
 * HOUSEHOLD-SHARED. Any member can read, update, and pay a debt another
 * member created — household membership is the authorization boundary, and
 * cross-household access stays blocked by the household predicate.
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

type MockFn = { mockResolvedValue: (v: unknown) => void };

describe('debts are household-shared (S1)', () => {
  let ctx: { userId: string; householdId: string };
  let otherCtx: { userId: string; householdId: string };
  const memberB = `member-b-${nanoid(6)}`;
  let debtId: string;

  beforeEach(async () => {
    // Household 1 with creator A; memberB acts as a second member of the SAME
    // household (auth is mocked, so membership comes from the mocked
    // household verification). otherCtx is a different household entirely.
    ctx = await setupTestUserWithHousehold();
    otherCtx = await setupTestUserWithHousehold();

    debtId = nanoid();
    await db.insert(debts).values({
      id: debtId,
      userId: ctx.userId, // created by member A
      householdId: ctx.householdId,
      name: 'Shared Car Loan',
      creditorName: 'Bank',
      debtType: 'loan',
      originalAmount: 5000,
      remainingBalance: 5000,
      remainingBalanceCents: 500000,
      startDate: '2026-01-01',
      status: 'active',
      interestType: 'none',
      interestRate: 0,
    } as typeof debts.$inferInsert);
  });

  afterEach(async () => {
    await db.delete(debtPayments).where(eq(debtPayments.householdId, ctx.householdId));
    await db.delete(debts).where(eq(debts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
    await cleanupTestHousehold(otherCtx.userId, otherCtx.householdId);
  });

  function actAs(userId: string, householdId: string) {
    (requireAuth as unknown as MockFn).mockResolvedValue({ userId });
    (getAndVerifyHousehold as unknown as MockFn).mockResolvedValue({ householdId });
  }

  it("another household member can read the creator's debt", async () => {
    actAs(memberB, ctx.householdId);
    const { GET } = await import('@/app/api/debts/[id]/route');
    const res = await GET(
      new Request('http://localhost/api/debts/x', {
        headers: { 'x-household-id': ctx.householdId },
      }),
      { params: Promise.resolve({ id: debtId }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('Shared Car Loan');
  });

  it("another household member can pay the creator's debt", async () => {
    actAs(memberB, ctx.householdId);
    const { POST } = await import('@/app/api/debts/payments/route');
    const res = await POST(
      new Request('http://localhost/api/debts/payments', {
        method: 'POST',
        headers: { 'x-household-id': ctx.householdId },
        body: JSON.stringify({ source: 'debt', id: debtId, amount: 100 }),
      })
    );
    expect(res.status).toBeLessThan(400);

    const [debt] = await db.select().from(debts).where(eq(debts.id, debtId));
    expect(debt.remainingBalanceCents).toBe(490000);
  });

  it('a member of a DIFFERENT household still cannot see the debt', async () => {
    actAs(otherCtx.userId, otherCtx.householdId);
    const { GET } = await import('@/app/api/debts/[id]/route');
    const res = await GET(
      new Request('http://localhost/api/debts/x', {
        headers: { 'x-household-id': otherCtx.householdId },
      }),
      { params: Promise.resolve({ id: debtId }) }
    );
    expect(res.status).toBe(404);
  });
});
