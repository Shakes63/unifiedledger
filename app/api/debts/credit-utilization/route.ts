import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { debts } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import {
  calculateUtilization,
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
    // Get all active credit card debts with credit limits set
    const creditCards = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.userId, userId),
          eq(debts.status, 'active'),
          eq(debts.type, 'credit_card'),
          isNotNull(debts.creditLimit)
        )
      );

    // If no credit cards with limits, return empty response
    if (creditCards.length === 0) {
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
    const cardData = creditCards.map((card) => ({
      id: card.id,
      name: card.name || 'Unknown Card',
      balance: card.remainingBalance || 0,
      limit: card.creditLimit || 0,
      color: card.color || undefined,
    }));

    // Calculate aggregate statistics
    const stats = calculateCreditStats(cardData, 30); // 30% threshold

    // Build detailed card information with recommendations
    const cardsWithDetails = stats.cards.map((card) => {
      const recommendation = getUtilizationRecommendation(card.utilization);
      const paymentToTarget = calculatePaymentToTarget(card.balance, card.limit, 30);
      const currentUtilization = card.utilization;
      const targetUtilization = paymentToTarget > 0 ? 30 : currentUtilization;
      const scoreImpact =
        paymentToTarget > 0
          ? estimateCreditScoreImpact(currentUtilization, targetUtilization)
          : 0;

      return {
        debtId: card.id,
        name: card.name,
        balance: card.balance,
        creditLimit: card.limit,
        available: card.available,
        utilization: card.utilization,
        level: card.level,
        color: getUtilizationColor(card.utilization),
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
    console.error('Error fetching credit utilization:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch credit utilization data' }), {
      status: 500,
    });
  }
}
