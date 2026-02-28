/**
 * Interest Tax Deduction Utilities
 * 
 * Phase 11: Tax Integration
 * 
 * Handles automatic classification of interest payments from debt bills
 * as tax deductible, with proper limit enforcement.
 */

import { db } from '@/lib/db';
import { interestDeductions, billTemplates, taxCategories, notifications } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

/**
 * Annual IRS limits for interest deductions (2024)
 */
export const INTEREST_DEDUCTION_LIMITS = {
  student_loan: 2500, // $2,500 max per year
  mortgage: null, // No annual dollar limit (limited by $750k loan principal)
  heloc_home: null, // Same as mortgage if used for home improvement
  business: null, // Generally unlimited for business purposes
} as const;

/**
 * Tax category names for each deduction type
 */
export const INTEREST_TAX_CATEGORY_MAP: Record<string, string> = {
  mortgage: 'Mortgage Interest',
  student_loan: 'Student Loan Interest',
  heloc_home: 'HELOC/Home Equity Interest',
  business: 'Business Interest Expense',
};

/**
 * Result from classifying an interest payment
 */
export interface InterestClassificationResult {
  success: boolean;
  deductionId?: string;
  interestAmount: number;
  deductibleAmount: number;
  limitApplied?: number;
  billLimitApplied: boolean;
  annualLimitApplied: boolean;
  taxCategoryId?: string;
  warningMessage?: string;
  error?: string;
}

/**
 * Interest deduction summary for a tax year
 */
export interface InterestDeductionSummary {
  taxYear: number;
  byType: {
    type: string;
    displayName: string;
    totalInterestPaid: number;
    totalDeductible: number;
    annualLimit: number | null;
    remainingCapacity: number | null;
    percentUsed: number | null;
    paymentCount: number;
  }[];
  totals: {
    totalInterestPaid: number;
    totalDeductible: number;
    totalLimitReductions: number;
  };
}

/**
 * Status of interest deduction limit
 */
export interface LimitStatus {
  type: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  percentUsed: number | null;
  isAtLimit: boolean;
  isApproachingLimit: boolean; // >80%
}

interface DebtBillTaxSettings {
  isInterestTaxDeductible: boolean;
  deductionType: 'mortgage' | 'student_loan' | 'business' | 'heloc_home' | 'none';
  deductionLimit: number | null;
}

async function getDebtBillTaxSettings(
  _userId: string,
  householdId: string,
  billId: string
): Promise<DebtBillTaxSettings | null> {
  const [template] = await db
    .select({
      isInterestTaxDeductible: billTemplates.interestTaxDeductible,
      deductionType: billTemplates.interestTaxDeductionType,
      deductionLimitCents: billTemplates.interestTaxDeductionLimitCents,
    })
    .from(billTemplates)
    .where(and(eq(billTemplates.id, billId), eq(billTemplates.householdId, householdId)))
    .limit(1);

  if (template) {
    return {
      isInterestTaxDeductible: template.isInterestTaxDeductible ?? false,
      deductionType:
        (template.deductionType as DebtBillTaxSettings['deductionType']) || 'none',
      deductionLimit:
        template.deductionLimitCents !== null
          ? new Decimal(template.deductionLimitCents).div(100).toNumber()
          : null,
    };
  }

  return null;
}

/**
 * Get the tax category ID for a deduction type
 */
async function getTaxCategoryId(deductionType: string): Promise<string | null> {
  const categoryName = INTEREST_TAX_CATEGORY_MAP[deductionType];
  if (!categoryName) return null;

  const [category] = await db
    .select({ id: taxCategories.id })
    .from(taxCategories)
    .where(eq(taxCategories.name, categoryName))
    .limit(1);

  return category?.id || null;
}

/**
 * Get total deductible interest for a user/year/type (for limit checking)
 */
async function getYearToDateDeductible(
  userId: string,
  taxYear: number,
  deductionType: 'mortgage' | 'student_loan' | 'business' | 'heloc_home'
): Promise<number> {
  const [result] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${interestDeductions.deductibleAmount}), 0)`,
    })
    .from(interestDeductions)
    .where(
      and(
        eq(interestDeductions.userId, userId),
        eq(interestDeductions.taxYear, taxYear),
        eq(interestDeductions.deductionType, deductionType)
      )
    );

  return result?.total || 0;
}

/**
 * Classify an interest payment for tax deduction purposes
 * 
 * This function:
 * 1. Checks if the bill has tax-deductible interest enabled
 * 2. Calculates deductible amount respecting both bill-level and annual limits
 * 3. Creates an interest_deductions record
 * 4. Returns classification result with any warnings
 */
export async function classifyInterestPayment(
  userId: string,
  householdId: string,
  billId: string,
  billPaymentId: string,
  interestAmount: number,
  paymentDate: string
): Promise<InterestClassificationResult> {
  try {
    const billSettings = await getDebtBillTaxSettings(userId, householdId, billId);
    if (!billSettings) {
      return {
        success: false,
        interestAmount,
        deductibleAmount: 0,
        billLimitApplied: false,
        annualLimitApplied: false,
        error: 'Bill not found',
      };
    }

    // Check if interest is tax deductible on this bill
    if (!billSettings.isInterestTaxDeductible || billSettings.deductionType === 'none') {
      return {
        success: false,
        interestAmount,
        deductibleAmount: 0,
        billLimitApplied: false,
        annualLimitApplied: false,
        error: 'Interest is not tax deductible for this bill',
      };
    }

    if (interestAmount <= 0) {
      return {
        success: false,
        interestAmount,
        deductibleAmount: 0,
        billLimitApplied: false,
        annualLimitApplied: false,
        error: 'No interest to classify',
      };
    }

    const deductionType = billSettings.deductionType as 'mortgage' | 'student_loan' | 'business' | 'heloc_home';
    const taxYear = new Date(paymentDate).getFullYear();
    
    // Get tax category for this deduction type
    const taxCategoryId = await getTaxCategoryId(deductionType);

    // Calculate deductible amount with limits
    let deductibleAmount = new Decimal(interestAmount);
    let limitApplied: number | undefined;
    let billLimitApplied = false;
    let annualLimitApplied = false;
    let warningMessage: string | undefined;

    // Apply bill-level limit first (if set)
    if (billSettings.deductionLimit && billSettings.deductionLimit > 0) {
      // Get total already deducted for this bill this year
      const [billYtd] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${interestDeductions.deductibleAmount}), 0)`,
        })
        .from(interestDeductions)
        .where(
          and(
            eq(interestDeductions.billId, billId),
            eq(interestDeductions.taxYear, taxYear)
          )
        );

      const billYtdTotal = billYtd?.total || 0;
      const billRemainingCapacity = new Decimal(billSettings.deductionLimit).minus(billYtdTotal);

      if (billRemainingCapacity.lessThanOrEqualTo(0)) {
        deductibleAmount = new Decimal(0);
        limitApplied = 0;
        billLimitApplied = true;
        warningMessage = `Bill-level limit of $${billSettings.deductionLimit.toLocaleString()} reached for ${taxYear}`;
      } else if (deductibleAmount.greaterThan(billRemainingCapacity)) {
        limitApplied = deductibleAmount.minus(billRemainingCapacity).toNumber();
        deductibleAmount = billRemainingCapacity;
        billLimitApplied = true;
      }
    }

    // Apply annual IRS limit second (for types with limits)
    const annualLimit = INTEREST_DEDUCTION_LIMITS[deductionType];
    if (annualLimit !== null && deductibleAmount.greaterThan(0)) {
      const ytdDeductible = await getYearToDateDeductible(userId, taxYear, deductionType);
      const remainingCapacity = new Decimal(annualLimit).minus(ytdDeductible);

      if (remainingCapacity.lessThanOrEqualTo(0)) {
        limitApplied = deductibleAmount.toNumber();
        deductibleAmount = new Decimal(0);
        annualLimitApplied = true;
        warningMessage = `Annual ${deductionType.replace('_', ' ')} interest limit of $${annualLimit.toLocaleString()} reached for ${taxYear}`;
      } else if (deductibleAmount.greaterThan(remainingCapacity)) {
        const reduction = deductibleAmount.minus(remainingCapacity);
        limitApplied = (limitApplied || 0) + reduction.toNumber();
        deductibleAmount = remainingCapacity;
        annualLimitApplied = true;
        
        const newYtd = ytdDeductible + remainingCapacity.toNumber();
        const percentUsed = (newYtd / annualLimit) * 100;
        if (percentUsed >= 100) {
          warningMessage = `Annual ${deductionType.replace('_', ' ')} interest limit of $${annualLimit.toLocaleString()} reached for ${taxYear}`;
        } else if (percentUsed >= 80) {
          warningMessage = `${percentUsed.toFixed(0)}% of annual ${deductionType.replace('_', ' ')} interest limit used`;
        }
      }
    }

    // Create the interest deduction record
    const deductionId = nanoid();
    await db.insert(interestDeductions).values({
      id: deductionId,
      userId,
      householdId,
      billId,
      billPaymentId,
      taxYear,
      deductionType,
      interestAmount,
      deductibleAmount: deductibleAmount.toNumber(),
      limitApplied: limitApplied || null,
      billLimitApplied,
      annualLimitApplied,
      paymentDate,
      taxCategoryId: taxCategoryId || null,
      createdAt: new Date().toISOString(),
    });

    // Create notification if annual limit was hit or approached
    const irsLimit = INTEREST_DEDUCTION_LIMITS[deductionType];
    if (irsLimit !== null && annualLimitApplied) {
      const ytdAfter = (await getYearToDateDeductible(userId, taxYear, deductionType));
      const percentUsed = (ytdAfter / irsLimit) * 100;
      
      // Create notification asynchronously (don't await to not slow down payment)
      createInterestLimitNotification(
        userId,
        householdId,
        deductionType,
        percentUsed,
        irsLimit,
        percentUsed >= 100
      ).catch(err => console.warn('Failed to create interest limit notification:', err));
    }

    return {
      success: true,
      deductionId,
      interestAmount,
      deductibleAmount: deductibleAmount.toNumber(),
      limitApplied,
      billLimitApplied,
      annualLimitApplied,
      taxCategoryId: taxCategoryId || undefined,
      warningMessage,
    };
  } catch (error) {
    console.error('Error classifying interest payment:', error);
    return {
      success: false,
      interestAmount,
      deductibleAmount: 0,
      billLimitApplied: false,
      annualLimitApplied: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get interest deduction summary for a tax year
 */
export async function getInterestDeductionSummary(
  userId: string,
  taxYear: number
): Promise<InterestDeductionSummary> {
  const deductionTypes: Array<'mortgage' | 'student_loan' | 'business' | 'heloc_home'> = [
    'mortgage', 'student_loan', 'business', 'heloc_home'
  ];
  
  const byType: InterestDeductionSummary['byType'] = [];
  let totalInterestPaid = 0;
  let totalDeductible = 0;
  let totalLimitReductions = 0;

  for (const type of deductionTypes) {
    const [result] = await db
      .select({
        totalInterest: sql<number>`COALESCE(SUM(${interestDeductions.interestAmount}), 0)`,
        totalDeductible: sql<number>`COALESCE(SUM(${interestDeductions.deductibleAmount}), 0)`,
        totalLimitApplied: sql<number>`COALESCE(SUM(${interestDeductions.limitApplied}), 0)`,
        paymentCount: sql<number>`COUNT(*)`,
      })
      .from(interestDeductions)
      .where(
        and(
          eq(interestDeductions.userId, userId),
          eq(interestDeductions.taxYear, taxYear),
          eq(interestDeductions.deductionType, type)
        )
      );

    const typeInterest = result?.totalInterest || 0;
    const typeDeductible = result?.totalDeductible || 0;
    const paymentCount = Number(result?.paymentCount) || 0;
    const annualLimit = INTEREST_DEDUCTION_LIMITS[type];

    byType.push({
      type,
      displayName: INTEREST_TAX_CATEGORY_MAP[type] || type,
      totalInterestPaid: typeInterest,
      totalDeductible: typeDeductible,
      annualLimit,
      remainingCapacity: annualLimit !== null ? Math.max(0, annualLimit - typeDeductible) : null,
      percentUsed: annualLimit !== null ? (typeDeductible / annualLimit) * 100 : null,
      paymentCount,
    });

    totalInterestPaid += typeInterest;
    totalDeductible += typeDeductible;
    totalLimitReductions += result?.totalLimitApplied || 0;
  }

  return {
    taxYear,
    byType: byType.filter(t => t.paymentCount > 0), // Only include types with payments
    totals: {
      totalInterestPaid,
      totalDeductible,
      totalLimitReductions,
    },
  };
}

/**
 * Check the status of interest deduction limits for a specific type
 */
export async function checkInterestLimitStatus(
  userId: string,
  taxYear: number,
  deductionType: 'mortgage' | 'student_loan' | 'business' | 'heloc_home'
): Promise<LimitStatus> {
  const used = await getYearToDateDeductible(userId, taxYear, deductionType);
  const limit = INTEREST_DEDUCTION_LIMITS[deductionType];

  if (limit === null) {
    return {
      type: deductionType,
      limit: null,
      used,
      remaining: null,
      percentUsed: null,
      isAtLimit: false,
      isApproachingLimit: false,
    };
  }

  const remaining = Math.max(0, limit - used);
  const percentUsed = (used / limit) * 100;

  return {
    type: deductionType,
    limit,
    used,
    remaining,
    percentUsed,
    isAtLimit: remaining <= 0,
    isApproachingLimit: percentUsed >= 80 && percentUsed < 100,
  };
}

/**
 * Get all interest deduction limit statuses for a user's tax year
 */
export async function getAllInterestLimitStatuses(
  userId: string,
  taxYear: number
): Promise<LimitStatus[]> {
  const types: Array<'mortgage' | 'student_loan' | 'business' | 'heloc_home'> = [
    'mortgage', 'student_loan', 'business', 'heloc_home'
  ];
  return Promise.all(types.map(type => checkInterestLimitStatus(userId, taxYear, type)));
}

/**
 * Delete interest deduction when a bill payment is deleted
 */
export async function deleteInterestDeduction(billPaymentId: string): Promise<boolean> {
  try {
    await db
      .delete(interestDeductions)
      .where(eq(interestDeductions.billPaymentId, billPaymentId));
    return true;
  } catch (error) {
    console.error('Error deleting interest deduction:', error);
    return false;
  }
}

/**
 * Create a notification for interest deduction limit warning
 */
export async function createInterestLimitNotification(
  userId: string,
  householdId: string,
  deductionType: string,
  percentUsed: number,
  limit: number,
  isAtLimit: boolean
): Promise<string | null> {
  try {
    const notificationId = nanoid();
    const typeName = INTEREST_TAX_CATEGORY_MAP[deductionType] || deductionType;
    const formattedLimit = limit.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    const title = isAtLimit
      ? `${typeName} Deduction Limit Reached`
      : `${typeName} Deduction Limit Approaching`;

    const message = isAtLimit
      ? `You have reached the annual ${formattedLimit} limit for ${typeName.toLowerCase()} deductions. Additional interest payments will not be tax deductible this year.`
      : `You have used ${percentUsed.toFixed(0)}% of your annual ${formattedLimit} ${typeName.toLowerCase()} deduction limit. Consider this when planning payments.`;

    await db.insert(notifications).values({
      id: notificationId,
      userId,
      householdId,
      type: 'budget_warning', // Reusing existing type - similar concept of limit warning
      title,
      message,
      priority: isAtLimit ? 'high' : 'normal',
      entityType: 'tax',
      entityId: `interest_${deductionType}`,
      actionUrl: '/dashboard/tax',
      actionLabel: 'View Tax Dashboard',
      isActionable: true,
      metadata: JSON.stringify({
        notificationType: 'interest_deduction_limit',
        deductionType,
        percentUsed,
        limit,
        isAtLimit,
      }),
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    return notificationId;
  } catch (error) {
    console.error('Error creating interest limit notification:', error);
    return null;
  }
}

/**
 * Check and create interest limit notifications for all types
 * Called periodically or after payments to ensure users are notified
 */
export async function checkInterestLimitNotifications(
  userId: string,
  householdId: string,
  taxYear?: number
): Promise<void> {
  const year = taxYear || new Date().getFullYear();
  
  try {
    const statuses = await getAllInterestLimitStatuses(userId, year);
    
    for (const status of statuses) {
      // Only notify for types with limits
      if (status.limit === null) continue;
      
      // Notify at 80% (approaching) and 100% (reached)
      if (status.isAtLimit || status.isApproachingLimit) {
        // Check if we already sent a notification recently (within last 7 days)
        const recentNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, userId),
              eq(notifications.type, 'budget_warning'),
              eq(notifications.entityId, `interest_${status.type}`)
            )
          )
          .limit(1);

        // Only create notification if none exists or it's been more than 7 days
        if (recentNotifications.length === 0) {
          await createInterestLimitNotification(
            userId,
            householdId,
            status.type,
            status.percentUsed || 0,
            status.limit,
            status.isAtLimit
          );
        }
      }
    }
  } catch (error) {
    console.error('Error checking interest limit notifications:', error);
  }
}

