/**
 * Haptic Feedback Hook
 *
 * Provides haptic (vibration) feedback for user interactions
 * Uses the Vibration API available on modern mobile devices
 *
 * Browser Support:
 * - Chrome/Chromium: 32+
 * - Firefox: 26+
 * - Safari: 13+ (iOS 13+)
 * - Edge: 15+
 * - Opera: 19+
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection' | 'custom';

interface HapticOptions {
  pattern?: HapticPattern;
  duration?: number;
  intensity?: number; // 0-100
  repeat?: number;
}

/**
 * Haptic feedback patterns (in milliseconds)
 * Based on iOS Haptic Engine patterns and Android vibration API
 */
const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10, // Very subtle - selection/light tap
  medium: 30, // Standard - confirmation
  heavy: 50, // Strong - important action
  success: [20, 10, 30, 10, 20], // Pattern: tap pause longer-tap - celebratory
  error: [100, 100, 100], // Triple vibration - warning pattern
  warning: [50, 50, 50, 50], // Double pulse - caution pattern
  selection: [10, 20], // Light-medium - selection/focus
  custom: 30, // Default
};

/**
 * Check if device supports haptic feedback
 */
function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback
 *
 * @param pattern - Predefined haptic pattern
 * @param options - Custom options (duration, intensity, repeat)
 *
 * @example
 * // Light success feedback
 * triggerHaptic('success');
 *
 * @example
 * // Custom pattern: 100ms vibration, 50ms pause, 100ms vibration
 * triggerHaptic('custom', { duration: [100, 50, 100] });
 *
 * @example
 * // Error with custom intensity
 * triggerHaptic('error', { intensity: 50 });
 */
export function triggerHaptic(pattern: HapticPattern = 'medium', options?: HapticOptions): void {
  if (!isHapticSupported()) {
    return;
  }

  const patternData = options?.pattern ? HAPTIC_PATTERNS[options.pattern] : HAPTIC_PATTERNS[pattern];
  let vibrationPattern = Array.isArray(patternData) ? patternData : [patternData];

  try {
    // Adjust intensity if specified
    if (options?.intensity !== undefined) {
      const intensity = options.intensity;
      vibrationPattern = vibrationPattern.map((duration, index) => {
        // Odd indices are pause durations, don't adjust them
        return index % 2 === 0 ? (duration * intensity) / 100 : duration;
      });
    }

    // Repeat pattern if specified
    let finalPattern: number | number[] = vibrationPattern;
    if (options?.repeat && options.repeat > 1) {
      finalPattern = vibrationPattern.flatMap(() => vibrationPattern);
    }

    navigator.vibrate(finalPattern);
  } catch (error) {
    // Silently fail if vibration API fails
    console.debug('Haptic feedback error:', error);
  }
}

/**
 * Stop any ongoing haptic feedback
 */
export function stopHaptic(): void {
  if (isHapticSupported()) {
    navigator.vibrate(0);
  }
}

/**
 * React Hook for haptic feedback management
 */
export function useHapticFeedback() {
  const triggerSuccess = () => triggerHaptic('success');
  const triggerError = () => triggerHaptic('error');
  const triggerWarning = () => triggerHaptic('warning');
  const triggerSelection = () => triggerHaptic('selection');
  const triggerLight = () => triggerHaptic('light');
  const triggerMedium = () => triggerHaptic('medium');
  const triggerHeavy = () => triggerHaptic('heavy');

  return {
    isSupported: isHapticSupported(),
    trigger: triggerHaptic,
    stop: stopHaptic,
    triggerSuccess,
    triggerError,
    triggerWarning,
    triggerSelection,
    triggerLight,
    triggerMedium,
    triggerHeavy,
  };
}

/**
 * Haptic feedback types for common UI actions
 */
export const HapticFeedbackTypes = {
  // Form interactions
  fieldFocus: () => triggerHaptic('light'),
  fieldComplete: () => triggerHaptic('selection'),
  fieldError: () => triggerHaptic('warning'),

  // Form submission
  formSubmit: () => triggerHaptic('medium'),
  formSuccess: () => triggerHaptic('success'),
  formError: () => triggerHaptic('error'),

  // User confirmations
  buttonPress: () => triggerHaptic('light'),
  buttonConfirm: () => triggerHaptic('medium'),
  buttonWarning: () => triggerHaptic('warning'),

  // Transaction-specific
  transactionCreated: () => triggerHaptic('success'),
  transactionError: () => triggerHaptic('error'),
  duplicateDetected: () => triggerHaptic('warning'),
  validationError: () => triggerHaptic('error'),

  // List interactions
  itemSelected: () => triggerHaptic('light'),
  itemDeleted: () => triggerHaptic('medium'),

  // Navigation
  navigationTap: () => triggerHaptic('light'),
  navigationWarning: () => triggerHaptic('warning'),
};
