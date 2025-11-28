import { useState, useEffect } from 'react';

// Helper function to detect touch capability
function detectTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as unknown as { msMaxTouchPoints: number }).msMaxTouchPoints > 0
  );
}

// Helper function to get screen info
function getScreenInfo() {
  if (typeof window === 'undefined') {
    return { width: 0, isMobile: false, isLandscape: false };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    width,
    isMobile: width < 768,
    isLandscape: width > height,
  };
}

/**
 * Hook to detect and manage one-handed use mode
 *
 * Detects:
 * - Mobile device (screen < 768px)
 * - Landscape orientation (when one-handed use is less natural)
 * - Touch device vs mouse
 * - Device size (phone vs tablet)
 */
export function useOneHandedMode() {
  // Initialize with computed values (already handles SSR)
  const [screenInfo, setScreenInfo] = useState(getScreenInfo);
  // Touch detection is stable on client, no need to re-check
  const isTouch = detectTouch();

  useEffect(() => {
    // Update screen info handler
    const updateScreenInfo = () => {
      setScreenInfo(getScreenInfo());
    };

    // Listen for resize events
    window.addEventListener('resize', updateScreenInfo);
    window.addEventListener('orientationchange', updateScreenInfo);

    return () => {
      window.removeEventListener('resize', updateScreenInfo);
      window.removeEventListener('orientationchange', updateScreenInfo);
    };
  }, []);

  const { width: screenWidth, isMobile, isLandscape } = screenInfo;

  /**
   * Returns true if one-handed mode should be active
   * - Mobile AND portrait orientation AND touch device
   */
  const isOneHandedMode = isMobile && !isLandscape && isTouch;

  /**
   * Returns recommended button height for touch targets
   * - Mobile one-handed: 48px (larger for thumbs)
   * - Mobile landscape: 44px
   * - Desktop: 40px (default)
   */
  const recommendedButtonHeight = isOneHandedMode ? 'h-12' : isMobile ? 'h-11' : 'h-10';

  /**
   * Returns recommended touch target spacing
   * - One-handed: 12px (larger gaps)
   * - Mobile: 8px
   * - Desktop: 4px
   */
  const touchSpacing = isOneHandedMode ? 'gap-3' : isMobile ? 'gap-2' : 'gap-1';

  return {
    isMobile,
    isLandscape,
    isTouch,
    screenWidth,
    isOneHandedMode,
    recommendedButtonHeight,
    touchSpacing,
  };
}
