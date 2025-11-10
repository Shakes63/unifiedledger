/**
 * Credit Utilization Tracking Utilities
 *
 * Functions for calculating and managing credit card utilization,
 * which is a key factor in credit scores.
 *
 * Industry best practice: Keep utilization below 30% for optimal credit health
 */

export type UtilizationLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export interface CreditCardData {
  id: string;
  name: string;
  balance: number;
  limit: number;
  color?: string;
}

export interface CreditCardUtilization extends CreditCardData {
  utilization: number;
  available: number;
  level: UtilizationLevel;
}

export interface CreditStats {
  totalLimit: number;
  totalUsed: number;
  totalAvailable: number;
  overallUtilization: number;
  cardsOverThreshold: number;
  cards: CreditCardUtilization[];
}

/**
 * Calculate utilization percentage
 *
 * @param balance Current balance on the card
 * @param limit Credit limit of the card
 * @returns Utilization percentage (0-100+)
 */
export function calculateUtilization(balance: number, limit: number): number {
  // Prevent division by zero
  if (!limit || limit === 0) {
    return 0;
  }

  // Handle negative balance (credit on account)
  if (balance < 0) {
    return 0;
  }

  const utilization = (balance / limit) * 100;

  // Round to 1 decimal place
  return Math.round(utilization * 10) / 10;
}

/**
 * Get utilization health level based on percentage
 *
 * Thresholds:
 * - Excellent: 0-10%
 * - Good: 10-30%
 * - Fair: 30-50%
 * - Poor: 50-75%
 * - Critical: 75%+
 *
 * @param utilization Utilization percentage
 * @returns Health level
 */
export function getUtilizationLevel(utilization: number): UtilizationLevel {
  if (utilization < 0) return 'excellent';
  if (utilization <= 10) return 'excellent';
  if (utilization <= 30) return 'good';
  if (utilization <= 50) return 'fair';
  if (utilization <= 75) return 'poor';
  return 'critical';
}

/**
 * Get CSS color variable for utilization level
 *
 * Uses theme variables for consistency
 *
 * @param utilization Utilization percentage
 * @returns CSS variable string
 */
export function getUtilizationColor(utilization: number): string {
  const level = getUtilizationLevel(utilization);

  switch (level) {
    case 'excellent':
    case 'good':
      return 'var(--color-success)';
    case 'fair':
      return 'var(--color-warning)';
    case 'poor':
      return 'oklch(0.768590 0.164659 70.080390)'; // Darker amber/orange
    case 'critical':
      return 'var(--color-error)';
    default:
      return 'var(--color-muted-foreground)';
  }
}

/**
 * Get label text for utilization level
 *
 * @param utilization Utilization percentage
 * @returns Label string
 */
export function getUtilizationLabel(utilization: number): string {
  const level = getUtilizationLevel(utilization);

  switch (level) {
    case 'excellent':
      return 'EXCELLENT';
    case 'good':
      return 'GOOD';
    case 'fair':
      return 'FAIR';
    case 'poor':
      return 'POOR';
    case 'critical':
      return 'CRITICAL';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Get emoji indicator for utilization level
 *
 * @param utilization Utilization percentage
 * @returns Emoji string
 */
export function getUtilizationEmoji(utilization: number): string {
  const level = getUtilizationLevel(utilization);

  switch (level) {
    case 'excellent':
      return '🟢';
    case 'good':
      return '🟢';
    case 'fair':
      return '🟡';
    case 'poor':
      return '🟠';
    case 'critical':
      return '🔴';
    default:
      return '⚪';
  }
}

/**
 * Format utilization percentage for display
 *
 * @param utilization Utilization percentage
 * @returns Formatted string (e.g., "45.0%")
 */
export function formatUtilization(utilization: number): string {
  return `${utilization.toFixed(1)}%`;
}

/**
 * Calculate total credit statistics across all cards
 *
 * @param creditCards Array of credit card data
 * @param threshold Utilization threshold for warnings (default: 30)
 * @returns Aggregate credit statistics
 */
export function calculateCreditStats(
  creditCards: CreditCardData[],
  threshold: number = 30
): CreditStats {
  // Filter out cards without credit limits
  const validCards = creditCards.filter((card) => card.limit && card.limit > 0);

  // Calculate per-card utilization
  const cards: CreditCardUtilization[] = validCards.map((card) => {
    const utilization = calculateUtilization(card.balance, card.limit);
    const available = Math.max(0, card.limit - card.balance);
    const level = getUtilizationLevel(utilization);

    return {
      ...card,
      utilization,
      available,
      level,
    };
  });

  // Sort by utilization (highest first)
  cards.sort((a, b) => b.utilization - a.utilization);

  // Calculate totals
  const totalLimit = cards.reduce((sum, card) => sum + card.limit, 0);
  const totalUsed = cards.reduce((sum, card) => sum + card.balance, 0);
  const totalAvailable = Math.max(0, totalLimit - totalUsed);
  const overallUtilization = calculateUtilization(totalUsed, totalLimit);

  // Count cards over threshold
  const cardsOverThreshold = cards.filter((card) => card.utilization > threshold).length;

  return {
    totalLimit,
    totalUsed,
    totalAvailable,
    overallUtilization,
    cardsOverThreshold,
    cards,
  };
}

/**
 * Check if utilization is healthy (< 30%)
 *
 * @param utilization Utilization percentage
 * @returns True if healthy
 */
export function isUtilizationHealthy(utilization: number): boolean {
  return utilization < 30;
}

/**
 * Get recommendation message based on utilization
 *
 * @param utilization Utilization percentage
 * @returns Recommendation string
 */
export function getUtilizationRecommendation(utilization: number): string {
  const level = getUtilizationLevel(utilization);

  switch (level) {
    case 'excellent':
      return 'Excellent! Your low utilization helps your credit score.';
    case 'good':
      return 'Good job! Keep your utilization below 30% for optimal credit health.';
    case 'fair':
      return 'Consider paying down this balance to improve your credit score.';
    case 'poor':
      return 'High utilization may hurt your credit score. Try to pay this down soon.';
    case 'critical':
      return 'Critical! Very high utilization can significantly damage your credit score.';
    default:
      return '';
  }
}

/**
 * Calculate how much to pay to reach target utilization
 *
 * @param balance Current balance
 * @param limit Credit limit
 * @param targetUtilization Target utilization percentage (default: 30)
 * @returns Amount to pay
 */
export function calculatePaymentToTarget(
  balance: number,
  limit: number,
  targetUtilization: number = 30
): number {
  if (!limit || limit === 0) {
    return 0;
  }

  const currentUtilization = calculateUtilization(balance, limit);

  // Already at or below target
  if (currentUtilization <= targetUtilization) {
    return 0;
  }

  const targetBalance = (targetUtilization / 100) * limit;
  const paymentNeeded = Math.max(0, balance - targetBalance);

  // Round to nearest dollar
  return Math.ceil(paymentNeeded);
}

/**
 * Estimate credit score impact based on utilization change
 *
 * Note: This is a rough estimate. Actual credit score impact depends on many factors.
 *
 * @param oldUtilization Previous utilization percentage
 * @param newUtilization New utilization percentage
 * @returns Estimated point change (can be negative)
 */
export function estimateCreditScoreImpact(
  oldUtilization: number,
  newUtilization: number
): number {
  // Simplified model: utilization accounts for ~30% of credit score (roughly 300 points)
  // So each 1% change in utilization might affect ~3 points

  const oldLevel = getUtilizationLevel(oldUtilization);
  const newLevel = getUtilizationLevel(newUtilization);

  // Level improvements/degradations
  const levelValue: Record<UtilizationLevel, number> = {
    excellent: 5,
    good: 4,
    fair: 3,
    poor: 2,
    critical: 1,
  };

  const levelChange = levelValue[newLevel] - levelValue[oldLevel];
  const percentChange = oldUtilization - newUtilization;

  // Rough estimate: level change * 10 + percent change * 2
  return Math.round(levelChange * 10 + percentChange * 2);
}
