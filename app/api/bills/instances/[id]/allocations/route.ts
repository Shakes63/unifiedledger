/**
 * Bill Instance Allocations API
 * 
 * GET /api/bills/instances/[id]/allocations - Get allocations for a bill instance
 * POST /api/bills/instances/[id]/allocations - Create/update allocations for a bill instance
 * DELETE /api/bills/instances/[id]/allocations - Remove all allocations (revert to non-split)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billInstances, billInstanceAllocations, bills } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface AllocationInput {
  periodNumber: number;
  allocatedAmount: number;
}

/**
 * GET /api/bills/instances/[id]/allocations
 * Get all allocations for a bill instance
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id: instanceId } = await params;
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Verify bill instance exists and belongs to user's household
    const instance = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.id, instanceId),
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId)
        )
      )
      .limit(1);

    if (!instance.length) {
      return NextResponse.json(
        { error: 'Bill instance not found' },
        { status: 404 }
      );
    }

    // Get all allocations for this instance
    const allocations = await db
      .select()
      .from(billInstanceAllocations)
      .where(
        and(
          eq(billInstanceAllocations.billInstanceId, instanceId),
          eq(billInstanceAllocations.userId, userId),
          eq(billInstanceAllocations.householdId, householdId)
        )
      )
      .orderBy(billInstanceAllocations.periodNumber);

    // Calculate totals
    const totalAllocated = allocations.reduce(
      (sum: number, a: typeof allocations[0]) => new Decimal(sum).plus(a.allocatedAmount).toNumber(),
      0
    );
    const totalPaid = allocations.reduce(
      (sum: number, a: typeof allocations[0]) => new Decimal(sum).plus(a.paidAmount || 0).toNumber(),
      0
    );

    return NextResponse.json({
      instanceId,
      billId: instance[0].billId,
      expectedAmount: instance[0].expectedAmount,
      allocations,
      summary: {
        totalAllocated,
        totalPaid,
        remainingToAllocate: new Decimal(instance[0].expectedAmount)
          .minus(totalAllocated)
          .toNumber(),
        isSplit: allocations.length > 1,
        allocationCount: allocations.length,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching allocations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch allocations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bills/instances/[id]/allocations
 * Create or update allocations for a bill instance
 * 
 * Request body:
 * - allocations: Array of { periodNumber: number, allocatedAmount: number }
 * 
 * This will replace all existing allocations with the new ones
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { id: instanceId } = await params;
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const { allocations } = body as { allocations: AllocationInput[] };

    // Validate allocations array
    if (!Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json(
        { error: 'allocations must be a non-empty array' },
        { status: 400 }
      );
    }

    // Verify bill instance exists and belongs to user's household
    const instanceResult = await db
      .select({
        instance: billInstances,
        bill: bills,
      })
      .from(billInstances)
      .innerJoin(bills, eq(billInstances.billId, bills.id))
      .where(
        and(
          eq(billInstances.id, instanceId),
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId)
        )
      )
      .limit(1);

    if (!instanceResult.length) {
      return NextResponse.json(
        { error: 'Bill instance not found' },
        { status: 404 }
      );
    }

    const { instance, bill } = instanceResult[0];

    // Validate allocations sum to expected amount
    const totalAllocated = allocations.reduce(
      (sum: number, a: AllocationInput) => new Decimal(sum).plus(a.allocatedAmount).toNumber(),
      0
    );

    // Allow a small tolerance for rounding
    const expectedAmount = new Decimal(instance.expectedAmount);
    const difference = expectedAmount.minus(totalAllocated).abs();
    
    if (difference.greaterThan(0.01)) {
      return NextResponse.json(
        { 
          error: `Allocations must sum to ${instance.expectedAmount}. Current sum: ${totalAllocated}` 
        },
        { status: 400 }
      );
    }

    // Validate period numbers
    const periodNumbers = allocations.map(a => a.periodNumber);
    const uniquePeriods = new Set(periodNumbers);
    if (uniquePeriods.size !== periodNumbers.length) {
      return NextResponse.json(
        { error: 'Duplicate period numbers not allowed' },
        { status: 400 }
      );
    }

    // Get existing allocations to preserve paid amounts
    const existingAllocations = await db
      .select()
      .from(billInstanceAllocations)
      .where(
        and(
          eq(billInstanceAllocations.billInstanceId, instanceId),
          eq(billInstanceAllocations.userId, userId)
        )
      );

    const existingByPeriod = new Map<number, typeof existingAllocations[0]>(
      existingAllocations.map((a: typeof existingAllocations[0]) => [a.periodNumber, a])
    );

    const now = new Date().toISOString();

    // Delete existing allocations
    await db
      .delete(billInstanceAllocations)
      .where(
        and(
          eq(billInstanceAllocations.billInstanceId, instanceId),
          eq(billInstanceAllocations.userId, userId)
        )
      );

    // Create new allocations
    const newAllocations = allocations.map(a => {
      const existing = existingByPeriod.get(a.periodNumber);
      return {
        id: existing?.id || nanoid(),
        billInstanceId: instanceId,
        billId: bill.id,
        userId,
        householdId,
        periodNumber: a.periodNumber,
        allocatedAmount: a.allocatedAmount,
        isPaid: existing?.isPaid || false,
        paidAmount: existing?.paidAmount || 0,
        allocationId: existing?.allocationId || null,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
    });

    await db.insert(billInstanceAllocations).values(newAllocations);

    return NextResponse.json({
      success: true,
      instanceId,
      allocations: newAllocations,
      summary: {
        totalAllocated,
        allocationCount: newAllocations.length,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating allocations:', error);
    return NextResponse.json(
      { error: 'Failed to create allocations' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bills/instances/[id]/allocations
 * Remove all allocations for a bill instance (revert to non-split)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id: instanceId } = await params;
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Verify bill instance exists and belongs to user's household
    const instance = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.id, instanceId),
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId)
        )
      )
      .limit(1);

    if (!instance.length) {
      return NextResponse.json(
        { error: 'Bill instance not found' },
        { status: 404 }
      );
    }

    // Check if any allocations have been paid
    const paidAllocations = await db
      .select()
      .from(billInstanceAllocations)
      .where(
        and(
          eq(billInstanceAllocations.billInstanceId, instanceId),
          eq(billInstanceAllocations.isPaid, true)
        )
      );

    if (paidAllocations.length > 0) {
      return NextResponse.json(
        { error: 'Cannot remove allocations that have been paid' },
        { status: 400 }
      );
    }

    // Delete all allocations
    await db
      .delete(billInstanceAllocations)
      .where(
        and(
          eq(billInstanceAllocations.billInstanceId, instanceId),
          eq(billInstanceAllocations.userId, userId)
        )
      );

    return NextResponse.json({
      success: true,
      instanceId,
      message: 'All allocations removed',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting allocations:', error);
    return NextResponse.json(
      { error: 'Failed to delete allocations' },
      { status: 500 }
    );
  }
}

