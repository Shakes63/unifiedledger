'use client';

import { useExperimentalFeatures } from '@/contexts/experimental-features-context';
import { ReactNode } from 'react';

interface FeatureGateProps {
  /**
   * The ID of the experimental feature (must match ID in EXPERIMENTAL_FEATURES)
   */
  featureId: string;

  /**
   * Optional content to render when experimental features are disabled
   */
  fallback?: ReactNode;

  /**
   * Content to render when experimental features are enabled
   */
  children: ReactNode;
}

/**
 * FeatureGate Component
 *
 * Conditionally renders children based on whether experimental features are enabled.
 * Use this to gate features behind the experimental features flag.
 *
 * @example
 * ```tsx
 * <FeatureGate featureId="quick-entry">
 *   <QuickEntryButton />
 * </FeatureGate>
 * ```
 *
 * @example
 * ```tsx
 * <FeatureGate featureId="advanced-charts" fallback={<BasicChart />}>
 *   <AdvancedChart />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({ featureId: _featureId, fallback = null, children }: FeatureGateProps) {
  const { enabled, loading } = useExperimentalFeatures();

  // Don't render anything while loading
  if (loading) return null;

  // Render fallback (or nothing) if experimental features are disabled
  if (!enabled) return <>{fallback}</>;

  // Render children if experimental features are enabled
  return <>{children}</>;
}
