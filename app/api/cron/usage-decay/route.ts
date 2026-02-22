/**
 * API Route: POST /api/cron/usage-decay
 *
 * Applies usage decay to recommendation surfaces so stale usage loses weight.
 * Security: requires CRON_SECRET as Bearer token.
 */

import { and, eq, gt } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import {
  applyBatchDecay,
  calculateDecayImpact,
  generateDecayReport,
  getDecayConfigByType,
} from '@/lib/analytics/usage-decay';
import { db } from '@/lib/db';
import { accounts, budgetCategories, merchants, tags, usageAnalytics } from '@/lib/db/schema';
import { apiError, apiOk } from '@/lib/api/route-helpers';

type DecayType = 'accounts' | 'categories' | 'merchants' | 'tags' | 'transfers';

interface DecayResult {
  type: DecayType;
  itemsProcessed: number;
  itemsAffected: number;
  totalScoreChange: number;
  averageDecay: number;
}

interface DecayItem {
  id: string;
  name?: string;
  usageCount: number;
  lastUsedAt: string | null;
}

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '');
  return token === cronSecret;
}

function roundDecayedUsage(value: number): number {
  return Math.max(0, Math.round(value));
}

async function getDecayItems(type: DecayType): Promise<DecayItem[]> {
  switch (type) {
    case 'accounts': {
      const rows = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          usageCount: accounts.usageCount,
          lastUsedAt: accounts.lastUsedAt,
        })
        .from(accounts)
        .where(gt(accounts.usageCount, 0));

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        usageCount: row.usageCount ?? 0,
        lastUsedAt: row.lastUsedAt ?? null,
      }));
    }

    case 'categories': {
      const rows = await db
        .select({
          id: budgetCategories.id,
          name: budgetCategories.name,
          usageCount: budgetCategories.usageCount,
          lastUsedAt: budgetCategories.lastUsedAt,
        })
        .from(budgetCategories)
        .where(gt(budgetCategories.usageCount, 0));

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        usageCount: row.usageCount ?? 0,
        lastUsedAt: row.lastUsedAt ?? null,
      }));
    }

    case 'merchants': {
      const rows = await db
        .select({
          id: merchants.id,
          name: merchants.name,
          usageCount: merchants.usageCount,
          lastUsedAt: merchants.lastUsedAt,
        })
        .from(merchants)
        .where(gt(merchants.usageCount, 0));

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        usageCount: row.usageCount ?? 0,
        lastUsedAt: row.lastUsedAt ?? null,
      }));
    }

    case 'tags': {
      const rows = await db
        .select({
          id: tags.id,
          name: tags.name,
          usageCount: tags.usageCount,
          lastUsedAt: tags.lastUsedAt,
        })
        .from(tags)
        .where(gt(tags.usageCount, 0));

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        usageCount: row.usageCount ?? 0,
        lastUsedAt: row.lastUsedAt ?? null,
      }));
    }

    case 'transfers': {
      const rows = await db
        .select({
          id: usageAnalytics.id,
          itemId: usageAnalytics.itemId,
          usageCount: usageAnalytics.usageCount,
          lastUsedAt: usageAnalytics.lastUsedAt,
        })
        .from(usageAnalytics)
        .where(
          and(
            eq(usageAnalytics.itemType, 'transfer_pair'),
            gt(usageAnalytics.usageCount, 0)
          )
        );

      return rows.map((row) => ({
        id: row.id,
        name: row.itemId,
        usageCount: row.usageCount ?? 0,
        lastUsedAt: row.lastUsedAt ?? null,
      }));
    }

    default:
      return [];
  }
}

async function persistDecayedUsage(type: DecayType, itemId: string, decayedScore: number) {
  const usageCount = roundDecayedUsage(decayedScore);

  switch (type) {
    case 'accounts':
      await db.update(accounts).set({ usageCount }).where(eq(accounts.id, itemId));
      return;
    case 'categories':
      await db.update(budgetCategories).set({ usageCount }).where(eq(budgetCategories.id, itemId));
      return;
    case 'merchants':
      await db.update(merchants).set({ usageCount }).where(eq(merchants.id, itemId));
      return;
    case 'tags':
      await db.update(tags).set({ usageCount }).where(eq(tags.id, itemId));
      return;
    case 'transfers':
      await db.update(usageAnalytics).set({ usageCount }).where(eq(usageAnalytics.id, itemId));
      return;
    default:
      return;
  }
}

async function applyDecayForType(type: DecayType): Promise<DecayResult> {
  const items = await getDecayItems(type);
  const config = getDecayConfigByType(type);

  const decayRows = applyBatchDecay(items, config);
  const impact = calculateDecayImpact(items, config);

  const changedRows = decayRows.filter((row) => roundDecayedUsage(row.decayedScore) !== row.originalScore);

  for (const row of changedRows) {
    await persistDecayedUsage(type, row.id, row.decayedScore);
  }

  return {
    type,
    itemsProcessed: items.length,
    itemsAffected: impact.itemsAffected,
    totalScoreChange: impact.totalScoreChange,
    averageDecay: impact.averageDecayPercentage,
  };
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return apiError('Unauthorized - Invalid or missing CRON_SECRET', 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedType = searchParams.get('type') as DecayType | null;

    const types: DecayType[] = requestedType
      ? [requestedType]
      : ['accounts', 'categories', 'merchants', 'tags', 'transfers'];

    const results: DecayResult[] = [];
    for (const type of types) {
      results.push(await applyDecayForType(type));
    }

    const totalItems = results.reduce((sum, r) => sum + r.itemsProcessed, 0);
    const totalAffected = results.reduce((sum, r) => sum + r.itemsAffected, 0);
    const totalChange = results.reduce((sum, r) => sum + r.totalScoreChange, 0);

    return apiOk({
      timestamp: Date.now(),
      totalItemsProcessed: totalItems,
      totalItemsAffected: totalAffected,
      totalScoreChange: Math.round(totalChange * 100) / 100,
      results,
    });
  } catch (error) {
    console.error('[UsageDecay] Error:', error);
    return apiError(
      'Decay application failed',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const type = searchParams.get('type') as DecayType | null;

    if (action !== 'report' || !type) {
      return apiError(
        'Invalid request. Usage: ?action=report&type=accounts|categories|merchants|tags|transfers',
        400
      );
    }

    const items = await getDecayItems(type);
    const config = getDecayConfigByType(type);
    const report = generateDecayReport(items, config, type);

    return apiOk({
      type,
      config,
      report,
      markdown: report,
      itemCount: items.length,
    });
  } catch (error) {
    console.error('[UsageDecay] Error:', error);
    return apiError(
      'Report generation failed',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
