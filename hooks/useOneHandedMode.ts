import { useState, useEffect } from 'react';

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
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    // Detect touch capability
    setIsTouch(() => {
      return (
        typeof window !== 'undefined' &&
        ('ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          (navigator as any).msMaxTouchPoints > 0)
      );
    });

    // Initial detection
    const updateScreenInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setScreenWidth(width);
      setIsMobile(width < 768);
      setIsLandscape(width > height);
    };

    updateScreenInfo();

    // Listen for resize events
    window.addEventListener('resize', updateScreenInfo);
    window.addEventListener('orientationchange', updateScreenInfo);

    return () => {
      window.removeEventListener('resize', updateScreenInfo);
      window.removeEventListener('orientationchange', updateScreenInfo);
    };
  }, []);

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
