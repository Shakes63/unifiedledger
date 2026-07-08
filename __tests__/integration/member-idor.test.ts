/**
 * H-SEC-2: an admin of one household must not be able to remove or re-role a
 * member of another household by passing that member's id, and must not be able
 * to grant a role above their own. Uses the real DB + real permission checks,
 * mocking only requireAuth.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { households, householdMembers } from '@/lib/db/schema';
import { createTestHousehold, createTestHouseholdMember } from './test-utils';

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: vi.fn() }));
import { requireAuth } from '@/lib/auth-helpers';

const ids: string[] = [];

async function makeHousehold(ownerId: string, name: string): Promise<string> {
  const [row] = await db.insert(households).values(createTestHousehold(ownerId, { name })).returning();
  ids.push(row.id);
  return row.id;
}

async function addMember(householdId: string, userId: string, role: string): Promise<string> {
  const member = createTestHouseholdMember(householdId, userId, `${userId}@test.example.com`, {
    role: role as 'owner',
  });
  await db.insert(householdMembers).values(member);
  return member.id as string;
}

describe('members/[memberId] cross-household IDOR (H-SEC-2)', () => {
  const attacker = `attacker-${crypto.randomUUID()}`;

  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: attacker,
    });
  });

  afterEach(async () => {
    for (const id of ids.splice(0)) {
      await db.delete(householdMembers).where(eq(householdMembers.householdId, id));
      await db.delete(households).where(eq(households.id, id));
    }
  });

  it('DELETE cannot remove a member of another household', async () => {
    const hhA = await makeHousehold(attacker, 'A');
    await addMember(hhA, attacker, 'admin');
    const hhB = await makeHousehold(`victim-${crypto.randomUUID()}`, 'B');
    const victimMemberId = await addMember(hhB, `victim-${crypto.randomUUID()}`, 'member');

    const { DELETE } = await import('@/app/api/households/[householdId]/members/[memberId]/route');
    // Attacker uses their own household in the URL (which they administer) but a
    // memberId belonging to household B.
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ householdId: hhA, memberId: victimMemberId }),
    });

    expect(res.status).toBe(404);
    const stillThere = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.id, victimMemberId));
    expect(stillThere).toHaveLength(1);
  });

  it('PUT cannot promote anyone to a role above the actor (admin cannot mint owner)', async () => {
    const hhA = await makeHousehold(attacker, 'A');
    await addMember(hhA, attacker, 'admin');
    const targetId = await addMember(hhA, `target-${crypto.randomUUID()}`, 'member');

    const { PUT } = await import('@/app/api/households/[householdId]/members/[memberId]/route');
    const res = await PUT(
      new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ role: 'owner' }) }),
      { params: Promise.resolve({ householdId: hhA, memberId: targetId }) }
    );

    expect(res.status).toBe(403);
    const [member] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.id, targetId), eq(householdMembers.householdId, hhA)));
    expect(member.role).toBe('member');
  });
});
