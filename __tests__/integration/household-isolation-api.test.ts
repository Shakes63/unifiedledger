/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration: Household Data Isolation (Route-level)
 *
 * Proves that household-scoped API routes do not leak data across households.
 * Uses real DB + real household membership checks, mocking only requireAuth.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import {
  households,
  householdMembers,
  accounts,
  budgetCategories,
  merchants,
  transactions,
} from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  createTestHousehold,
  createTestHouseholdMember,
  createTestAccount,
  createTestCategory,
  createTestMerchant,
  createTestTransaction,
  cleanupTestHousehold,
} from './test-utils';

// IMPORTANT: Only mock auth. Household auth must remain real.
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));
import { requireAuth } from '@/lib/auth-helpers';

function req(url: string, init?: RequestInit, householdId?: string): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...(householdId ? { 'x-household-id': householdId } : {}),
      ...(init?.headers || {}),
    },
  });
}

describe('Integration: Household Data Isolation (API)', () => {
  let userId: string;
  let hhA: string;
  let hhB: string;
  let hhC: string;

  let accountA: string;
  let accountB: string;

  let categoryA: string;
  let categoryB: string;

  let merchantA: string;
  let merchantB: string;

  let txA: string;
  let txB: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    userId = `hh-iso-user-${crypto.randomUUID()}`;
    (requireAuth as any).mockResolvedValue({ userId });

    // Create households A/B where user is a member
    const hA = createTestHousehold(userId, { name: 'HH A' });
    const hB = createTestHousehold(userId, { name: 'HH B' });

    const [insA] = await db.insert(households).values(hA).returning();
    const [insB] = await db.insert(households).values(hB).returning();

    hhA = insA.id;
    hhB = insB.id;

    await db.insert(householdMembers).values([
      createTestHouseholdMember(hhA, userId, `${userId}@test.example.com`, { role: 'owner' }),
      createTestHouseholdMember(hhB, userId, `${userId}@test.example.com`, { role: 'owner' }),
    ]);

    // Create household C where user is NOT a member
    const hC = createTestHousehold(`other-${userId}`, { name: 'HH C' });
    const [insC] = await db.insert(households).values(hC).returning();
    hhC = insC.id;

    // Accounts
    const [aA] = await db.insert(accounts).values(createTestAccount(userId, hhA, { name: 'A1' })).returning();
    const [aB] = await db.insert(accounts).values(createTestAccount(userId, hhB, { name: 'B1' })).returning();
    accountA = aA.id;
    accountB = aB.id;

    // Categories
    const [cA] = await db.insert(budgetCategories).values(createTestCategory(userId, hhA, { name: 'Cat A' })).returning();
    const [cB] = await db.insert(budgetCategories).values(createTestCategory(userId, hhB, { name: 'Cat B' })).returning();
    categoryA = cA.id;
    categoryB = cB.id;

    // Merchants
    const [mA] = await db.insert(merchants).values(createTestMerchant(userId, hhA, { name: 'Merch A' })).returning();
    const [mB] = await db.insert(merchants).values(createTestMerchant(userId, hhB, { name: 'Merch B' })).returning();
    merchantA = mA.id;
    merchantB = mB.id;

    // Transactions
    const [tA] = await db
      .insert(transactions)
      .values(
        createTestTransaction(userId, hhA, accountA, {
          description: 'Tx A',
          categoryId: categoryA,
          merchantId: merchantA,
        })
      )
      .returning();

    const [tB] = await db
      .insert(transactions)
      .values(
        createTestTransaction(userId, hhB, accountB, {
          description: 'Tx B',
          categoryId: categoryB,
          merchantId: merchantB,
        })
      )
      .returning();

    txA = tA.id;
    txB = tB.id;
  });

  afterEach(async () => {
    // cleanupTestHousehold deletes user-scoped data across all households.
    await cleanupTestHousehold(userId, hhA);

    // Remove remaining households B/C (and members) explicitly.
    await db.delete(householdMembers).where(eq(householdMembers.householdId, hhB));
    await db.delete(households).where(eq(households.id, hhB));

    await db.delete(householdMembers).where(eq(householdMembers.householdId, hhC));
    await db.delete(households).where(eq(households.id, hhC));
  });

  it('GET /api/accounts lists only accounts in the active household', async () => {
    const { GET } = await import('@/app/api/accounts/route');

    const resA = await GET(req('http://localhost/api/accounts', undefined, hhA) as any);
    expect(resA.status).toBe(200);
    const dataA = (await resA.json()) as any[];
    expect(dataA.map(a => a.id)).toContain(accountA);
    expect(dataA.map(a => a.id)).not.toContain(accountB);

    const resB = await GET(req('http://localhost/api/accounts', undefined, hhB) as any);
    expect(resB.status).toBe(200);
    const dataB = (await resB.json()) as any[];
    expect(dataB.map(a => a.id)).toContain(accountB);
    expect(dataB.map(a => a.id)).not.toContain(accountA);
  });

  it('DELETE /api/accounts/[id] returns 404 when the account belongs to another household', async () => {
    const { DELETE } = await import('@/app/api/accounts/[id]/route');

    const res = await DELETE(req('http://localhost/api/accounts/' + accountA, undefined, hhB) as any, {
      params: Promise.resolve({ id: accountA }),
    } as any);

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('Account not found');

    // Ensure account still exists in its original household
    const stillThere = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, accountA), eq(accounts.householdId, hhA)))
      .limit(1);
    expect(stillThere.length).toBe(1);
  });

  it('GET /api/transactions lists only transactions in the active household', async () => {
    const { GET } = await import('@/app/api/transactions/route');

    const resA = await GET(req('http://localhost/api/transactions?limit=100&offset=0', undefined, hhA) as any);
    expect(resA.status).toBe(200);
    const payloadA = await resA.json() as { data?: any[] } | any[];
    const dataA = Array.isArray(payloadA) ? payloadA : (payloadA.data || []);
    expect(dataA.map(t => t.id)).toContain(txA);
    expect(dataA.map(t => t.id)).not.toContain(txB);

    const resB = await GET(req('http://localhost/api/transactions?limit=100&offset=0', undefined, hhB) as any);
    expect(resB.status).toBe(200);
    const payloadB = await resB.json() as { data?: any[] } | any[];
    const dataB = Array.isArray(payloadB) ? payloadB : (payloadB.data || []);
    expect(dataB.map(t => t.id)).toContain(txB);
    expect(dataB.map(t => t.id)).not.toContain(txA);
  });

  it('GET /api/transactions/[id] returns 404 when requesting a transaction from another household', async () => {
    const { GET } = await import('@/app/api/transactions/[id]/route');

    const res = await GET(req('http://localhost/api/transactions/' + txA, undefined, hhB) as any, {
      params: Promise.resolve({ id: txA }),
    } as any);

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('Transaction not found');
  });

  it('PUT /api/categories/[id] returns 404 when category belongs to another household', async () => {
    const { PUT } = await import('@/app/api/categories/[id]/route');

    const res = await PUT(
      req(
        'http://localhost/api/categories/' + categoryA,
        { method: 'PUT', body: JSON.stringify({ name: 'Nope' }) },
        hhB
      ) as any,
      { params: Promise.resolve({ id: categoryA }) } as any
    );

    expect(res.status).toBe(404);
  });

  it('PUT /api/merchants/[id] returns 404 when merchant belongs to another household', async () => {
    const { PUT } = await import('@/app/api/merchants/[id]/route');

    const res = await PUT(
      req(
        'http://localhost/api/merchants/' + merchantA,
        { method: 'PUT', body: JSON.stringify({ name: 'Nope' }) },
        hhB
      ) as any,
      { params: Promise.resolve({ id: merchantA }) } as any
    );

    expect(res.status).toBe(404);
  });

  it('returns 403 when the user is not a member of the requested household', async () => {
    const { GET } = await import('@/app/api/accounts/route');

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(req('http://localhost/api/accounts', undefined, hhC) as any);
    expect(res.status).toBe(403);

    const data = await res.json();
    // message comes from household auth helpers
    expect(JSON.stringify(data).toLowerCase()).toContain('household');

    consoleError.mockRestore();
  });
});
