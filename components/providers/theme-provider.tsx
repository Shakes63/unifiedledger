'use client';

import { useEffect } from 'react';
import { applyTheme, getCachedTheme } from '@/lib/themes/theme-utils';
import { DEFAULT_THEME_ID } from '@/lib/themes/theme-config';

/**
 * ThemeProvider applies the initial theme from localStorage for instant rendering.
 * The HouseholdContext will load the user's per-household theme preferences and
 * apply them automatically, overriding this initial theme if needed.
 *
 * This prevents theme flash while the household context is loading.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		// Apply theme from localStorage immediately (if available)
		// This provides instant theme application while HouseholdContext loads
		if (typeof window === 'undefined') {
			return;
		}

		try {
			const params = new URLSearchParams(window.location.search);
			const isFirstSetupSignUp =
				window.location.pathname.startsWith('/sign-up') &&
				params.get('firstSetup') === 'true';

			if (isFirstSetupSignUp) {
				window.localStorage.removeItem('unified-ledger:selected-household');
			}

			const selectedHouseholdId = window.localStorage.getItem('unified-ledger:selected-household');
			const storedTheme = !isFirstSetupSignUp && selectedHouseholdId ? getCachedTheme(selectedHouseholdId) : null;
			if (storedTheme) {
				applyTheme(storedTheme, { householdId: selectedHouseholdId, persist: false });
				return;
			}
		} catch {
			// Ignore storage access issues (private mode, etc.)
		}

		// Fall back to default theme if no stored theme
		applyTheme(DEFAULT_THEME_ID, { persist: false });
	}, []);

	return <>{children}</>;
}
