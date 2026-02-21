import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import {
  accounts,
  householdEntities,
  householdEntityMembers,
  householdMembers,
} from '@/lib/db/schema';

export type HouseholdEntityType = 'personal' | 'business';

interface HouseholdEntity {
  id: string;
  householdId: string;
  name: string;
  type: HouseholdEntityType;
  isDefault: boolean;
  enableSalesTax: boolean;
  isActive: boolean;
}

function mapHouseholdRoleToEntity(role: string): {
  role: 'owner' | 'manager' | 'editor' | 'viewer';
  canManageEntity: boolean;
} {
  switch (role) {
    case 'owner':
      return { role: 'owner', canManageEntity: true };
    case 'admin':
      return { role: 'manager', canManageEntity: true };
    case 'member':
      return { role: 'editor', canManageEntity: false };
    default:
      return { role: 'viewer', canManageEntity: false };
  }
}

export async function ensureDefaultPersonalEntityForHousehold(
  householdId: string,
  actorUserId: string
): Promise<HouseholdEntity> {
  const existingDefault = await db
    .select()
    .from(householdEntities)
    .where(
      and(
        eq(householdEntities.householdId, householdId),
        eq(householdEntities.type, 'personal'),
        eq(householdEntities.isDefault, true),
        eq(householdEntities.isActive, true)
      )
    )
    .limit(1);

  let entity = existingDefault[0];

  if (!entity) {
    const now = new Date().toISOString();
    const entityId = nanoid();
    await db.insert(householdEntities).values({
      id: entityId,
      householdId,
      name: 'Personal',
      type: 'personal',
      isDefault: true,
      enableSalesTax: false,
      isActive: true,
      createdBy: actorUserId,
      createdAt: now,
      updatedAt: now,
    });

    const created = await db
      .select()
      .from(householdEntities)
      .where(eq(householdEntities.id, entityId))
      .limit(1);
    entity = created[0];
  }

  if (!entity) {
    throw new Error('Failed to ensure default household entity');
  }

  const activeMembers = await db
    .select({ userId: householdMembers.userId, role: householdMembers.role })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.isActive, true)
      )
    );

  for (const member of activeMembers) {
    const existingMembership = await db
      .select({ id: householdEntityMembers.id })
      .from(householdEntityMembers)
      .where(
        and(
          eq(householdEntityMembers.entityId, entity.id),
          eq(householdEntityMembers.userId, member.userId)
        )
      )
      .limit(1);

    const mapped = mapHouseholdRoleToEntity(member.role || 'viewer');

    if (existingMembership.length > 0) {
      await db
        .update(householdEntityMembers)
        .set({
          role: mapped.role,
          canManageEntity: mapped.canManageEntity,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(householdEntityMembers.id, existingMembership[0].id));
    } else {
      await db.insert(householdEntityMembers).values({
        id: nanoid(),
        entityId: entity.id,
        householdId,
        userId: member.userId,
        role: mapped.role,
        canManageEntity: mapped.canManageEntity,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return entity as HouseholdEntity;
}

export async function listAccessibleEntitiesForUser(
  householdId: string,
  userId: string
): Promise<HouseholdEntity[]> {
  await ensureDefaultPersonalEntityForHousehold(householdId, userId);

  const rows = await db
    .select({
      id: householdEntities.id,
      householdId: householdEntities.householdId,
      name: householdEntities.name,
      type: householdEntities.type,
      isDefault: householdEntities.isDefault,
      enableSalesTax: householdEntities.enableSalesTax,
      isActive: householdEntities.isActive,
    })
    .from(householdEntities)
    .innerJoin(
      householdEntityMembers,
      eq(householdEntities.id, householdEntityMembers.entityId)
    )
    .where(
      and(
        eq(householdEntities.householdId, householdId),
        eq(householdEntities.isActive, true),
        eq(householdEntityMembers.userId, userId),
        eq(householdEntityMembers.isActive, true)
      )
    );

  return rows.map((row) => ({
    id: row.id,
    householdId: row.householdId,
    name: row.name,
    type: row.type as HouseholdEntityType,
    isDefault: Boolean(row.isDefault),
    enableSalesTax: Boolean(row.enableSalesTax),
    isActive: Boolean(row.isActive),
  }));
}

export async function requireEntityAccess(
  userId: string,
  householdId: string,
  entityId: string | null | undefined
): Promise<HouseholdEntity> {
  const entities = await listAccessibleEntitiesForUser(householdId, userId);

  if (entities.length === 0) {
    throw new Error('Unauthorized: No accessible entities in this household');
  }

  if (!entityId) {
    return entities.find((entity) => entity.isDefault) || entities[0];
  }

  const selected = entities.find((entity) => entity.id === entityId);
  if (!selected) {
    throw new Error('Unauthorized: No access to this entity');
  }

  return selected;
}

export async function resolveDefaultEntityIdForHousehold(
  householdId: string,
  userId: string
): Promise<string> {
  const entity = await ensureDefaultPersonalEntityForHousehold(householdId, userId);
  return entity.id;
}

export async function resolveAccountEntityId(
  householdId: string,
  userId: string,
  accountEntityId: string | null | undefined
): Promise<string> {
  if (accountEntityId) {
    return accountEntityId;
  }
  return resolveDefaultEntityIdForHousehold(householdId, userId);
}

export async function requireAccountEntityAccess(
  userId: string,
  householdId: string,
  accountEntityId: string | null | undefined
) {
  const entityId = await resolveAccountEntityId(householdId, userId, accountEntityId);
  return requireEntityAccess(userId, householdId, entityId);
}

export async function getAccountWithEntityAccess({
  userId,
  householdId,
  accountId,
}: {
  userId: string;
  householdId: string;
  accountId: string;
}) {
  const account = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    )
    .limit(1);

  if (account.length === 0) {
    throw new Error('Account not found');
  }

  await requireAccountEntityAccess(userId, householdId, account[0].entityId);
  return account[0];
}

export async function createBusinessEntity(
  householdId: string,
  userId: string,
  name: string,
  enableSalesTax = false
) {
  const entity = await requireEntityAccess(userId, householdId, null);
  const isManager = await db
    .select({
      canManageEntity: householdEntityMembers.canManageEntity,
      role: householdEntityMembers.role,
    })
    .from(householdEntityMembers)
    .where(
      and(
        eq(householdEntityMembers.entityId, entity.id),
        eq(householdEntityMembers.userId, userId),
        eq(householdEntityMembers.isActive, true)
      )
    )
    .limit(1);

  const canCreate = isManager[0]?.canManageEntity || isManager[0]?.role === 'owner';
  if (!canCreate) {
    throw new Error('Unauthorized: Not authorized to create business entities');
  }

  const entityId = nanoid();
  const now = new Date().toISOString();

  await db.insert(householdEntities).values({
    id: entityId,
    householdId,
    name,
    type: 'business',
    isDefault: false,
    enableSalesTax,
    isActive: true,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(householdEntityMembers).values({
    id: nanoid(),
    entityId,
    householdId,
    userId,
    role: 'owner',
    canManageEntity: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const created = await db
    .select()
    .from(householdEntities)
    .where(eq(householdEntities.id, entityId))
    .limit(1);

  return created[0] as HouseholdEntity;
}
