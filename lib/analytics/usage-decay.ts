/**
 * Usage Decay Algorithm
 *
 * Implements intelligent decay of usage scores to keep recommendations fresh.
 * Older usage gradually decays while recent usage is weighted more heavily.
 *
 * Strategies:
 * 1. Time-Weighted Decay - Score decays based on age
 * 2. Exponential Decay - Score decays exponentially with age
 * 3. Recency Bonus - Recent usage gets bonus multiplier
 */

export type DecayStrategy = "time-weighted" | "exponential" | "recency-bonus";

export interface UsageDecayConfig {
  strategy: DecayStrategy;
  decayRate: number; // Rate at which score decays (0-1)
  halfLifeDays: number; // Days for score to decay to 50%
  recencyBonusWindow: number; // Days for recency bonus window
  recencyBonusMultiplier: number; // Multiplier for recent usage
  minScore: number; // Minimum score to keep (prevent complete decay)
}

/**
 * Default decay configurations
 */
export const DEFAULT_DECAY_CONFIGS: Record<string, UsageDecayConfig> = {
  // Accounts: Slower decay (people use main accounts regularly)
  accounts: {
    strategy: "exponential",
    decayRate: 0.95,
    halfLifeDays: 90,
    recencyBonusWindow: 7,
    recencyBonusMultiplier: 1.5,
    minScore: 1,
  },

  // Categories: Medium decay (spending patterns change seasonally)
  categories: {
    strategy: "time-weighted",
    decayRate: 0.92,
    halfLifeDays: 60,
    recencyBonusWindow: 14,
    recencyBonusMultiplier: 1.3,
    minScore: 0.5,
  },

  // Merchants: Fast decay (spending preferences change frequently)
  merchants: {
    strategy: "recency-bonus",
    decayRate: 0.85,
    halfLifeDays: 30,
    recencyBonusWindow: 7,
    recencyBonusMultiplier: 2,
    minScore: 0.1,
  },

  // Tags: Medium decay (usage patterns vary)
  tags: {
    strategy: "exponential",
    decayRate: 0.93,
    halfLifeDays: 45,
    recencyBonusWindow: 7,
    recencyBonusMultiplier: 1.4,
    minScore: 0.5,
  },

  // Transfers: Slower decay (recurring transfers are predictable)
  transfers: {
    strategy: "exponential",
    decayRate: 0.96,
    halfLifeDays: 120,
    recencyBonusWindow: 30,
    recencyBonusMultiplier: 1.2,
    minScore: 1,
  },
};

/**
 * Calculate days since date
 */
export function daysSince(date: Date | string): number {
  const pastDate = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - pastDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Time-Weighted Decay Strategy
 *
 * Score decays linearly based on age.
 * Formula: score = currentScore * (1 - (daysSince / halfLifeDays))
 * Reaches zero when age = halfLifeDays
 */
export function applyTimeWeightedDecay(
  score: number,
  lastUsedDate: Date | string,
  config: UsageDecayConfig
): number {
  const days = daysSince(lastUsedDate);
  const decayFactor = Math.max(0, 1 - days / config.halfLifeDays);
  const newScore = score * decayFactor;

  // Apply recency bonus if within bonus window
  const recencyBonus = applyRecencyBonus(days, config);

  return Math.max(config.minScore, newScore * recencyBonus);
}

/**
 * Exponential Decay Strategy
 *
 * Score decays exponentially based on age.
 * Formula: score = currentScore * (decayRate ^ (daysSince / halfLifeDays))
 * More gradual decay than time-weighted
 */
export function applyExponentialDecay(
  score: number,
  lastUsedDate: Date | string,
  config: UsageDecayConfig
): number {
  const days = daysSince(lastUsedDate);
  const decayFactor = Math.pow(
    config.decayRate,
    days / config.halfLifeDays
  );
  const newScore = score * decayFactor;

  // Apply recency bonus if within bonus window
  const recencyBonus = applyRecencyBonus(days, config);

  return Math.max(config.minScore, newScore * recencyBonus);
}

/**
 * Recency Bonus Strategy
 *
 * Gives bonus multiplier to recent usage while exponentially decaying older usage.
 * Combines recency advantage with gradual decay.
 */
export function applyRecencyBonusDecay(
  score: number,
  lastUsedDate: Date | string,
  config: UsageDecayConfig
): number {
  const days = daysSince(lastUsedDate);

  // Apply exponential decay
  const decayFactor = Math.pow(
    config.decayRate,
    days / config.halfLifeDays
  );
  let newScore = score * decayFactor;

  // Apply recency bonus multiplier
  const recencyBonus = applyRecencyBonus(days, config);
  newScore = newScore * recencyBonus;

  return Math.max(config.minScore, newScore);
}

/**
 * Calculate recency bonus based on days since last use
 *
 * Bonus is highest within the recency window, then gradually decays.
 * Formula: If days <= window: bonus = multiplier
 *          If days > window: bonus = multiplier - ((days - window) * 0.01)
 */
function applyRecencyBonus(days: number, config: UsageDecayConfig): number {
  if (days <= config.recencyBonusWindow) {
    // Full bonus within window
    return config.recencyBonusMultiplier;
  }

  // Gradually reduce bonus after window
  const daysOverWindow = days - config.recencyBonusWindow;
  const bonusDecay = Math.max(
    1,
    config.recencyBonusMultiplier - daysOverWindow * 0.01
  );

  return bonusDecay;
}

/**
 * Apply decay strategy based on config
 */
export function applyUsageDecay(
  score: number,
  lastUsedDate: Date | string,
  config: UsageDecayConfig
): number {
  switch (config.strategy) {
    case "time-weighted":
      return applyTimeWeightedDecay(score, lastUsedDate, config);
    case "exponential":
      return applyExponentialDecay(score, lastUsedDate, config);
    case "recency-bonus":
      return applyRecencyBonusDecay(score, lastUsedDate, config);
    default:
      return score;
  }
}

/**
 * Batch apply decay to multiple items
 *
 * Useful for updating all usage scores at once.
 */
export function applyBatchDecay(
  items: Array<{
    id: string;
    usageCount: number;
    lastUsedAt: Date | string | null;
  }>,
  config: UsageDecayConfig
): Array<{
  id: string;
  originalScore: number;
  decayedScore: number;
  decayPercentage: number;
}> {
  return items.map((item) => {
    if (!item.lastUsedAt) {
      // No usage, no decay
      return {
        id: item.id,
        originalScore: item.usageCount,
        decayedScore: item.usageCount,
        decayPercentage: 0,
      };
    }

    const original = item.usageCount;
    const decayed = applyUsageDecay(original, item.lastUsedAt, config);
    const percentage = ((original - decayed) / original) * 100;

    return {
      id: item.id,
      originalScore: original,
      decayedScore: Math.round(decayed * 100) / 100,
      decayPercentage: Math.round(percentage * 10) / 10,
    };
  });
}

/**
 * Calculate impact statistics for decay application
 */
export function calculateDecayImpact(
  items: Array<{
    id: string;
    usageCount: number;
    lastUsedAt: Date | string | null;
  }>,
  config: UsageDecayConfig
): {
  itemsAffected: number;
  totalScoreChange: number;
  averageDecayPercentage: number;
  maxDecayPercentage: number;
  minDecayPercentage: number;
} {
  const results = applyBatchDecay(items, config);

  const affected = results.filter((r) => r.decayPercentage > 0);
  const totalChange = results.reduce(
    (sum, r) => sum + (r.originalScore - r.decayedScore),
    0
  );
  const avgDecay =
    affected.length > 0
      ? affected.reduce((sum, r) => sum + r.decayPercentage, 0) /
        affected.length
      : 0;
  const maxDecay =
    affected.length > 0
      ? Math.max(...affected.map((r) => r.decayPercentage))
      : 0;
  const minDecay =
    affected.length > 0
      ? Math.min(...affected.map((r) => r.decayPercentage))
      : 0;

  return {
    itemsAffected: affected.length,
    totalScoreChange: Math.round(totalChange * 100) / 100,
    averageDecayPercentage: Math.round(avgDecay * 10) / 10,
    maxDecayPercentage: Math.round(maxDecay * 10) / 10,
    minDecayPercentage: Math.round(minDecay * 10) / 10,
  };
}

/**
 * Generate decay report for analysis
 */
export function generateDecayReport(
  items: Array<{
    id: string;
    name?: string;
    usageCount: number;
    lastUsedAt: Date | string | null;
  }>,
  config: UsageDecayConfig,
  category: string
): string {
  const results = applyBatchDecay(items, config);
  const impact = calculateDecayImpact(items, config);

  let report = `# Usage Decay Report - ${category}\n\n`;
  report += `## Configuration\n`;
  report += `- Strategy: ${config.strategy}\n`;
  report += `- Decay Rate: ${(config.decayRate * 100).toFixed(1)}%\n`;
  report += `- Half-Life: ${config.halfLifeDays} days\n`;
  report += `- Min Score: ${config.minScore}\n\n`;

  report += `## Impact Summary\n`;
  report += `- Items Affected: ${impact.itemsAffected} / ${items.length}\n`;
  report += `- Total Score Change: -${impact.totalScoreChange}\n`;
  report += `- Average Decay: ${impact.averageDecayPercentage}%\n`;
  report += `- Range: ${impact.minDecayPercentage}% - ${impact.maxDecayPercentage}%\n\n`;

  report += `## Top Decayed Items\n\n`;
  report += `| Name | Original | Decayed | Change |\n`;
  report += `|------|----------|---------|--------|\n`;

  results
    .sort((a, b) => b.decayPercentage - a.decayPercentage)
    .slice(0, 10)
    .forEach((result) => {
      const item = items.find((i) => i.id === result.id);
      const name = item?.name || result.id;
      report += `| ${name} | ${result.originalScore.toFixed(2)} | ${result.decayedScore.toFixed(2)} | -${result.decayPercentage.toFixed(1)}% |\n`;
    });

  return report;
}

/**
 * Get decay configuration recommendations
 */
export function getDecayConfigByType(
  type: "accounts" | "categories" | "merchants" | "tags" | "transfers"
): UsageDecayConfig {
  return DEFAULT_DECAY_CONFIGS[type];
}

/**
 * Create custom decay configuration
 */
export function createCustomDecayConfig(
  strategy: DecayStrategy,
  overrides: Partial<UsageDecayConfig>
): UsageDecayConfig {
  const baseConfig = {
    strategy,
    decayRate: 0.9,
    halfLifeDays: 60,
    recencyBonusWindow: 7,
    recencyBonusMultiplier: 1.5,
    minScore: 0.5,
  };

  return { ...baseConfig, ...overrides };
}
