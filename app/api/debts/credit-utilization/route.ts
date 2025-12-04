import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq, and, isNotNull, inArray } from 'drizzle-orm';
import {
  getUtilizationLevel,
  getUtilizationColor,
  getUtilizationRecommendation,
  calculatePaymentToTarget,
  estimateCreditScoreImpact,
  calculateCreditStats,
} from '@/lib/debts/credit-utilization-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    
    // Get all active credit accounts (credit cards + lines of credit) with credit limits
    // Now using the accounts table instead of debts table (Phase 13 unified architecture)
    const creditAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          inArray(accounts.type, ['credit', 'line_of_credit']),
          eq(accounts.isActive, true),
          isNotNull(accounts.creditLimit)
        )
      );

    // If no credit accounts with limits, return empty response
    if (creditAccounts.length === 0) {
      return new Response(
        JSON.stringify({
          cards: [],
          summary: {
            totalBalance: 0,
            totalCreditLimit: 0,
            totalAvailable: 0,
            avgUtilization: 0,
            overallUtilization: 0,
            level: 'excellent',
            cardsOverTarget: 0,
            healthScore: 100,
          },
        }),
        { status: 200 }
      );
    }

    // Transform to the format expected by utility functions
    // Credit accounts store balance as negative (liability), so we use absolute value
    const cardData = creditAccounts.map((acc) => ({
      id: acc.id,
      name: acc.name || 'Unknown Account',
      balance: Math.abs(acc.currentBalance || 0),
      limit: acc.creditLimit || 0,
      color: acc.color || undefined,
      type: acc.type, // Include type for UI differentiation
    }));

    // Calculate aggregate statistics
    const stats = calculateCreditStats(cardData, 30); // 30% threshold

    // Build detailed card information with recommendations
    const cardsWithDetails = stats.cards.map((card) => {
      const originalAcc = creditAccounts.find(a => a.id === card.id);
      const recommendation = getUtilizationRecommendation(card.utilization);
      const paymentToTarget = calculatePaymentToTarget(card.balance, card.limit, 30);
      const currentUtilization = card.utilization;
      const targetUtilization = paymentToTarget > 0 ? 30 : currentUtilization;
      const scoreImpact =
        paymentToTarget > 0
          ? estimateCreditScoreImpact(currentUtilization, targetUtilization)
          : 0;

      return {
        debtId: card.id, // Keep as debtId for backwards compatibility
        accountId: card.id, // Also include as accountId for new architecture
        name: card.name,
        balance: card.balance,
        creditLimit: card.limit,
        available: card.available,
        utilization: card.utilization,
        level: card.level,
        color: getUtilizationColor(card.utilization),
        accountColor: originalAcc?.color || undefined,
        accountType: originalAcc?.type || 'credit',
        recommendation,
        paymentToTarget: paymentToTarget > 0 ? paymentToTarget : null,
        estimatedScoreImpact: scoreImpact,
      };
    });

    // Calculate health score (0-100, where 100 is best)
    // Based on how far from ideal utilization (0-10%)
    const healthScore = Math.max(
      0,
      Math.min(100, 100 - Math.max(0, stats.overallUtilization - 10) * 2)
    );

    // Build summary
    const summary = {
      totalBalance: stats.totalUsed,
      totalCreditLimit: stats.totalLimit,
      totalAvailable: stats.totalAvailable,
      avgUtilization:
        stats.cards.length > 0
          ? stats.cards.reduce((sum, c) => sum + c.utilization, 0) / stats.cards.length
          : 0,
      overallUtilization: stats.overallUtilization,
      level: getUtilizationLevel(stats.overallUtilization),
      cardsOverTarget: stats.cardsOverThreshold,
      healthScore: Math.round(healthScore),
      // Include type breakdown for UI
      creditCardCount: creditAccounts.filter(a => a.type === 'credit').length,
      lineOfCreditCount: creditAccounts.filter(a => a.type === 'line_of_credit').length,
    };

    return new Response(
      JSON.stringify({
        cards: cardsWithDetails,
        summary,
      }),
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    console.error('Error fetching credit utilization:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch credit utilization data' }), {
      status: 500,
    });
  }
}
