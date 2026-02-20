/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { accounts, householdMembers, households, transactions, transfers } from '@/lib/db/schema';
import {
  cleanupTestHousehold,
  createTestAccount,
  createTestHousehold,
  createTestHouseholdMember,
  createTestTransaction,
} from './test-utils';
import { toMoneyCents } from '@/lib/utils/money-cents';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

function req(url: string, init?: RequestInit, householdId?: string): Request {
  const headers = new Headers(init?.headers);
  if (householdId) {
    headers.set('x-household-id', householdId);
  }
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return new Request(url, {
    ...init,
    headers,
  });
}

describe('Integration: Money-Movement Household Isolation Matrix', () => {
  let userId = '';
  let householdA = '';
  let householdB = '';
  let accountA1 = '';
  let accountA2 = '';
  let accountB1 = '';
  let transactionA = '';
  let transferA = '';

  beforeEach(async () => {
    vi.clearAllMocks();
    userId = `money-matrix-user-${crypto.randomUUID()}`;
    (requireAuth as any).mockResolvedValue({ userId });

    const [hhA] = await db
      .insert(households)
      .values(createTestHousehold(userId, { name: 'Money HH A' }))
      .returning();
    householdA = hhA.id;

    const [hhB] = await db
      .insert(households)
      .values(createTestHousehold(userId, { name: 'Money HH B' }))
      .returning();
    householdB = hhB.id;

    await db.insert(householdMembers).values([
      createTestHouseholdMember(householdA, userId, `${userId}@test.example.com`, { role: 'owner' }),
      createTestHouseholdMember(householdB, userId, `${userId}@test.example.com`, { role: 'owner' }),
    ]);

    const [accA1] = await db
      .insert(accounts)
      .values(createTestAccount(userId, householdA, { name: 'A Checking', currentBalance: 800 }))
      .returning();
    const [accA2] = await db
      .insert(accounts)
      .values(createTestAccount(userId, householdA, { name: 'A Savings', currentBalance: 200 }))
      .returning();
    const [accB1] = await db
      .insert(accounts)
      .values(createTestAccount(userId, householdB, { name: 'B Checking', currentBalance: 500 }))
      .returning();

    accountA1 = accA1.id;
    accountA2 = accA2.id;
    accountB1 = accB1.id;

    const [txA] = await db
      .insert(transactions)
      .values(
        createTestTransaction(userId, householdA, accountA1, {
          description: 'HH-A expense',
          amount: 40,
          type: 'expense',
        })
      )
      .returning();
    transactionA = txA.id;

    const [trA] = await db
      .insert(transfers)
      .values({
        id: `transfer-a-${crypto.randomUUID()}`,
        userId,
        householdId: householdA,
        fromAccountId: accountA1,
        toAccountId: accountA2,
        amount: 25,
        amountCents: toMoneyCents(25) ?? 0,
        description: 'HH-A transfer',
        date: '2026-02-19',
        status: 'completed',
        fees: 0,
        feesCents: toMoneyCents(0) ?? 0,
        notes: null,
        createdAt: new Date().toISOString(),
      })
      .returning();
    transferA = trA.id;
  });

  afterEach(async () => {
    await db.delete(transfers).where(eq(transfers.userId, userId));
    await cleanupTestHousehold(userId, householdA);
    await db.delete(householdMembers).where(eq(householdMembers.householdId, householdB));
    await db.delete(households).where(eq(households.id, householdB));
  });

  it('blocks same-user cross-household money movement access and mutations', async () => {
    const { POST: postTransactions } = await import('@/app/api/transactions/route');
    const { PUT: putTransaction, DELETE: deleteTransaction } = await import('@/app/api/transactions/[id]/route');
    const { POST: convertToTransfer } = await import('@/app/api/transactions/[id]/convert-to-transfer/route');
    const { POST: postTransfer } = await import('@/app/api/transfers/route');
    const { GET: getTransferById, PUT: putTransfer, DELETE: deleteTransfer } = await import('@/app/api/transfers/[id]/route');

    const postTxCross = await postTransactions(
      req(
        'http://localhost/api/transactions',
        {
          method: 'POST',
          body: JSON.stringify({
            accountId: accountA1,
            date: '2026-02-19',
            amount: 15,
            description: 'Cross-household create attempt',
            type: 'expense',
          }),
        },
        householdB
      )
    );
    expect(postTxCross.status).toBe(404);

    const putTxCross = await putTransaction(
      req(
        `http://localhost/api/transactions/${transactionA}`,
        {
          method: 'PUT',
          body: JSON.stringify({ amount: 55 }),
        },
        householdB
      ),
      { params: Promise.resolve({ id: transactionA }) }
    );
    expect(putTxCross.status).toBe(404);

    const deleteTxCross = await deleteTransaction(
      req(
        `http://localhost/api/transactions/${transactionA}`,
        { method: 'DELETE' },
        householdB
      ),
      { params: Promise.resolve({ id: transactionA }) }
    );
    expect(deleteTxCross.status).toBe(404);

    const [txStillExists] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, transactionA), eq(transactions.householdId, householdA)))
      .limit(1);
    expect(txStillExists?.id).toBe(transactionA);

    const convertCross = await convertToTransfer(
      req(
        `http://localhost/api/transactions/${transactionA}/convert-to-transfer`,
        {
          method: 'POST',
          body: JSON.stringify({
            targetAccountId: accountB1,
          }),
        },
        householdB
      ),
      { params: Promise.resolve({ id: transactionA }) }
    );
    expect(convertCross.status).toBe(404);

    const postTransferCross = await postTransfer(
      req(
        'http://localhost/api/transfers',
        {
          method: 'POST',
          body: JSON.stringify({
            fromAccountId: accountA1,
            toAccountId: accountA2,
            amount: 10,
            date: '2026-02-19',
            description: 'Cross-household transfer create',
          }),
        },
        householdB
      )
    );
    expect(postTransferCross.status).toBe(404);

    const getTransferCross = await getTransferById(
      req(`http://localhost/api/transfers/${transferA}`, undefined, householdB),
      { params: Promise.resolve({ id: transferA }) }
    );
    expect(getTransferCross.status).toBe(404);

    const putTransferCross = await putTransfer(
      req(
        `http://localhost/api/transfers/${transferA}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            description: 'Should not update',
          }),
        },
        householdB
      ),
      { params: Promise.resolve({ id: transferA }) }
    );
    expect(putTransferCross.status).toBe(404);

    const deleteTransferCross = await deleteTransfer(
      req(
        `http://localhost/api/transfers/${transferA}`,
        { method: 'DELETE' },
        householdB
      ),
      { params: Promise.resolve({ id: transferA }) }
    );
    expect(deleteTransferCross.status).toBe(404);

    const [transferStillExists] = await db
      .select({ id: transfers.id })
      .from(transfers)
      .where(and(eq(transfers.id, transferA), eq(transfers.householdId, householdA)))
      .limit(1);
    expect(transferStillExists?.id).toBe(transferA);
  });
});
