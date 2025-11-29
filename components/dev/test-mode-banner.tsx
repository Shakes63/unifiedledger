'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * TestModeBanner Component
 *
 * Displays a prominent warning banner when the application is running in test mode.
 * This helps developers and testers clearly identify when authentication is bypassed.
 *
 * The banner is fixed at the top of the viewport and uses warning colors
 * from the semantic theme system.
 */
export function TestModeBanner() {
  const [isTestMode, setIsTestMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if test mode is enabled via API
    const checkTestMode = async () => {
      try {
        const response = await fetch('/api/test-mode/init', {
          method: 'GET',
        });
        if (response.ok) {
          const data = await response.json();
          setIsTestMode(data.testMode === true);
        }
      } catch {
        // If check fails, assume not in test mode
        setIsTestMode(false);
      } finally {
        setLoading(false);
      }
    };

    checkTestMode();
  }, []);

  // Don't render anything while loading or if not in test mode
  if (loading || !isTestMode) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
      style={{
        backgroundColor: 'var(--color-warning)',
        color: 'var(--color-warning-foreground, #000)',
      }}
    >
      <AlertTriangle className="h-4 w-4" />
      <span>
        TEST MODE - Authentication Disabled
      </span>
      <span className="hidden sm:inline text-xs opacity-75">
        (Set TEST_MODE=false to disable)
      </span>
    </div>
  );
}

