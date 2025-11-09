'use client';

import { useEffect } from 'react';
import { applyTheme, isValidThemeId } from '@/lib/themes/theme-utils';
import { DEFAULT_THEME_ID } from '@/lib/themes/theme-config';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		let isMounted = true;
		let fallbackTheme = DEFAULT_THEME_ID;

		const applyStoredTheme = () => {
			if (typeof window === 'undefined') {
				return;
			}

			try {
				const storedTheme = window.localStorage.getItem('unified-ledger:theme');
				if (storedTheme && isValidThemeId(storedTheme)) {
					fallbackTheme = storedTheme;
					applyTheme(storedTheme);
					return;
				}
			} catch {
				// Ignore storage access issues (private mode, etc.)
			}

			applyTheme(DEFAULT_THEME_ID);
		};

		applyStoredTheme();

		const init = async () => {
			try {
				const res = await fetch('/api/user/settings/theme', { cache: 'no-store' });
				if (!isMounted) return;
				if (res.ok) {
					const data = await res.json();
					const themeId = data.theme && isValidThemeId(data.theme) ? data.theme : DEFAULT_THEME_ID;
					applyTheme(themeId);
				} else {
					applyTheme(fallbackTheme);
				}
			} catch {
				applyTheme(fallbackTheme);
			}
		};
		init();
		return () => {
			isMounted = false;
		};
	}, []);

	return <>{children}</>;
}
