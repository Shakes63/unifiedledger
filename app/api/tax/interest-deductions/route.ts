/**
 * Interest Deductions API
 * 
 * Phase 11: Tax Integration
 * 
 * GET: Retrieve interest deduction summary for a tax year
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { 
  getInterestDeductionSummary, 
  getAllInterestLimitStatuses 
} from '@/lib/tax/interest-tax-utils';
import { db } from '@/lib/db';
import { billTemplates, interestDeductions } from '@/lib/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);
    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const includePayments = searchParams.get('includePayments') === 'true';

    // Get summary by type
    const summary = await getInterestDeductionSummary(userId, householdId, year);
    
    // Get limit statuses
    const limitStatuses = await getAllInterestLimitStatuses(userId, householdId, year);

    // Optionally include detailed payment list
    let payments: Array<{
      id: string;
      billId: string;
      billName: string;
      deductionType: string;
      interestAmount: number;
      deductibleAmount: number;
      limitApplied: number | null;
      paymentDate: string;
    }> = [];

    if (includePayments) {
      const deductions = await db
        .select({
          id: interestDeductions.id,
          billId: interestDeductions.billId,
          householdId: interestDeductions.householdId,
          deductionType: interestDeductions.deductionType,
          interestAmount: interestDeductions.interestAmount,
          deductibleAmount: interestDeductions.deductibleAmount,
          limitApplied: interestDeductions.limitApplied,
          paymentDate: interestDeductions.paymentDate,
        })
        .from(interestDeductions)
        .where(
          and(
            eq(interestDeductions.userId, userId),
            eq(interestDeductions.householdId, householdId),
            eq(interestDeductions.taxYear, year)
          )
        )
        .orderBy(desc(interestDeductions.paymentDate));

      // Get bill/template names for the payments
      const billIds = [...new Set(deductions.map(d => d.billId))];
      const householdIds = [...new Set(deductions.map((d) => d.householdId).filter(Boolean))];
      const billNames = new Map<string, string>();
      
      if (billIds.length > 0) {
        const templateRows = householdIds.length > 0
          ? await db
              .select({ id: billTemplates.id, name: billTemplates.name })
              .from(billTemplates)
              .where(
                and(
                  inArray(billTemplates.householdId, householdIds),
                  inArray(billTemplates.id, billIds)
                )
              )
          : [];

        for (const row of templateRows) {
          billNames.set(row.id, row.name);
        }
      }

      payments = deductions.map(d => ({
        id: d.id,
        billId: d.billId,
        billName: billNames.get(d.billId) || 'Unknown Bill',
        deductionType: d.deductionType,
        interestAmount: d.interestAmount,
        deductibleAmount: d.deductibleAmount,
        limitApplied: d.limitApplied,
        paymentDate: d.paymentDate,
      }));
    }

    return NextResponse.json({
      year,
      summary,
      limitStatuses,
      ...(includePayments && { payments }),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching interest deductions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interest deductions' },
      { status: 500 }
    );
  }
}

