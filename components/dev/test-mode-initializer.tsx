'use client';

import { useEffect, useState, ReactNode } from 'react';

interface TestModeInitializerProps {
  children: ReactNode;
}

/**
 * TestModeInitializer Component
 *
 * Ensures test mode data is initialized before rendering children.
 * This component should wrap the main content of the app to ensure
 * the test user and household exist before any authenticated API calls.
 *
 * The component:
 * 1. Checks if test mode is enabled
 * 2. If enabled, calls the init API to create test user/household
 * 3. Renders children once initialization is complete (or immediately if not in test mode)
 */
export function TestModeInitializer({ children }: TestModeInitializerProps) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initTestMode = async () => {
      try {
        // First check if test mode is enabled
        const statusResponse = await fetch('/api/test-mode/init', {
          method: 'GET',
        });

        if (!statusResponse.ok) {
          // API error, assume not in test mode
          setInitialized(true);
          return;
        }

        const statusData = await statusResponse.json();

        if (!statusData.testMode) {
          // Not in test mode, no initialization needed
          setInitialized(true);
          return;
        }

        // Test mode is enabled, initialize test data
        const initResponse = await fetch('/api/test-mode/init', {
          method: 'POST',
        });

        if (!initResponse.ok) {
          const errorData = await initResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to initialize test mode');
        }

        const initData = await initResponse.json();
        console.log('[Test Mode] Initialized:', initData.alreadyExists ? 'Data already exists' : 'Created new test data');

        setInitialized(true);
      } catch (err) {
        console.error('[Test Mode] Initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize test mode');
        // Still allow the app to render even if test mode init fails
        setInitialized(true);
      }
    };

    initTestMode();
  }, []);

  // Show error state if initialization failed
  if (error && !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="rounded-xl border border-error bg-card p-6 text-center">
          <h2 className="text-lg font-semibold text-error">
            Test Mode Initialization Failed
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show loading state only briefly for test mode init
  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

