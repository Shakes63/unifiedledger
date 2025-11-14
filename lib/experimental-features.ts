/**
 * Experimental Features System
 *
 * This file defines all experimental features available in the application.
 * Features can be gated behind the experimental features flag in user settings.
 */

export type FeatureRiskLevel = 'low' | 'medium' | 'high';
export type FeatureCategory = 'ui' | 'data' | 'performance' | 'analytics';

export interface ExperimentalFeature {
  id: string;
  name: string;
  description: string;
  category: FeatureCategory;
  riskLevel: FeatureRiskLevel;
}

/**
 * Registry of all experimental features
 *
 * To add a new experimental feature:
 * 1. Add it to this object
 * 2. Use <FeatureGate featureId="your-feature-id"> to wrap the feature UI
 * 3. Update Advanced tab to show the feature in the list
 */
export const EXPERIMENTAL_FEATURES: Record<string, ExperimentalFeature> = {
  'quick-entry': {
    id: 'quick-entry',
    name: 'Quick Entry Mode',
    description: 'Keyboard-focused rapid transaction entry (press Q to open)',
    category: 'ui',
    riskLevel: 'low',
  },
  'enhanced-search': {
    id: 'enhanced-search',
    name: 'Enhanced Transaction Search',
    description: 'Advanced search with regex support and saved search filters',
    category: 'ui',
    riskLevel: 'low',
  },
  'advanced-charts': {
    id: 'advanced-charts',
    name: 'Advanced Chart Types',
    description: 'Additional visualization options including heatmaps and treemaps',
    category: 'analytics',
    riskLevel: 'low',
  },
};

/**
 * Get all experimental features
 */
export function getExperimentalFeatures(): ExperimentalFeature[] {
  return Object.values(EXPERIMENTAL_FEATURES);
}

/**
 * Get a specific experimental feature by ID
 */
export function getExperimentalFeature(featureId: string): ExperimentalFeature | undefined {
  return EXPERIMENTAL_FEATURES[featureId];
}

/**
 * Get features by category
 */
export function getFeaturesByCategory(category: FeatureCategory): ExperimentalFeature[] {
  return Object.values(EXPERIMENTAL_FEATURES).filter(f => f.category === category);
}

/**
 * Get features by risk level
 */
export function getFeaturesByRiskLevel(riskLevel: FeatureRiskLevel): ExperimentalFeature[] {
  return Object.values(EXPERIMENTAL_FEATURES).filter(f => f.riskLevel === riskLevel);
}

/**
 * Get risk level color for UI display
 */
export function getRiskLevelColor(riskLevel: FeatureRiskLevel): string {
  switch (riskLevel) {
    case 'low':
      return 'var(--color-success)';
    case 'medium':
      return 'var(--color-warning)';
    case 'high':
      return 'var(--color-error)';
    default:
      return 'var(--color-muted-foreground)';
  }
}
