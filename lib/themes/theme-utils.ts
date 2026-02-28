/**
 * Theme Utilities
 *
 * Helper functions for working with themes in the Unified Ledger application.
 */

import {
  themes,
  DEFAULT_THEME_ID,
  THEME_RUNTIME_CONFIG,
  type Theme,
  type ThemeId,
} from './theme-config';

const THEME_STORAGE_PREFIX = 'unified-ledger:theme';
const LEGACY_THEME_ID_MAP: Record<string, ThemeId> = {
  'dark-mode': 'dark-green',
};

function normalizeThemeId(themeId: string): string {
  return LEGACY_THEME_ID_MAP[themeId] ?? themeId;
}

/**
 * Get a theme by ID
 * @param themeId - The theme ID to retrieve
 * @returns The theme object or null if not found
 */
export function getTheme(themeId: string): Theme | null {
  const normalizedThemeId = normalizeThemeId(themeId);
  const theme = themes.find((t) => t.id === normalizedThemeId);
  return theme || null;
}

/**
 * Get the default theme
 * @returns The default theme object
 */
export function getDefaultTheme(): Theme {
  const theme = getTheme(DEFAULT_THEME_ID);
  if (!theme) {
    throw new Error(`Default theme '${DEFAULT_THEME_ID}' not found`);
  }
  return theme;
}

/**
 * Get all available themes (only themes that are available)
 * @returns Array of available theme objects
 */
export function getAvailableThemes(): Theme[] {
  return themes.filter((theme) => theme.isAvailable);
}

/**
 * Get all themes (including unavailable ones for preview)
 * @returns Array of all theme objects
 */
export function getAllThemes(): Theme[] {
  return themes;
}

/**
 * Validate if a theme ID is valid
 * @param themeId - The theme ID to validate
 * @returns True if the theme exists, false otherwise
 */
export function isValidThemeId(themeId: string): boolean {
  const normalizedThemeId = normalizeThemeId(themeId);
  return themes.some((theme) => theme.id === normalizedThemeId);
}

/**
 * Validate if a theme is available for use
 * @param themeId - The theme ID to check
 * @returns True if the theme is available, false otherwise
 */
export function isThemeAvailable(themeId: string): boolean {
  const theme = getTheme(themeId);
  return theme ? theme.isAvailable : false;
}

export function getThemeStorageKey(householdId?: string | null): string {
  return householdId ? `${THEME_STORAGE_PREFIX}:${householdId}` : THEME_STORAGE_PREFIX;
}

export function getCachedTheme(householdId?: string | null): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const cachedTheme = window.localStorage.getItem(getThemeStorageKey(householdId));
    if (cachedTheme && isValidThemeId(cachedTheme)) {
      const normalizedThemeId = normalizeThemeId(cachedTheme);
      if (normalizedThemeId !== cachedTheme) {
        window.localStorage.setItem(getThemeStorageKey(householdId), normalizedThemeId);
      }
      return normalizedThemeId;
    }
  } catch {
    // Ignore storage failures (private mode, etc.)
  }

  return null;
}

interface ApplyThemeOptions {
  householdId?: string | null;
  persist?: boolean;
  force?: boolean;
}

/**
 * Apply theme to the document root
 * This function can be used to dynamically apply theme colors to CSS variables
 *
 * Note: Currently only dark mode is available, so this is a placeholder
 * for future multi-theme support (Feature #15)
 *
 * @param themeId - The theme ID to apply
 */
export function applyTheme(themeId: string, options: ApplyThemeOptions = {}): void {
  const { householdId = null, persist = true, force = false } = options;
  const normalizedThemeId = normalizeThemeId(themeId);
  const requestedTheme = getTheme(normalizedThemeId);
  const theme =
    requestedTheme && requestedTheme.isAvailable
      ? requestedTheme
      : getTheme(DEFAULT_THEME_ID);
  if (!theme) {
    return;
  }

  // Apply theme ID as data attribute to root element
  // This will trigger the CSS rules in globals.css for the selected theme
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    const nextThemeId = theme.id as ThemeId;
    const currentThemeId = root.getAttribute('data-theme');

    if (!force && currentThemeId === nextThemeId) {
      if (persist && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(getThemeStorageKey(householdId), theme.id);
        } catch {
          // Ignore storage failures (private mode, etc.)
        }
      }
      return;
    }

    root.setAttribute('data-theme', nextThemeId);
    const runtimeTheme = THEME_RUNTIME_CONFIG[nextThemeId];
    const cssVars = runtimeTheme?.cssVars ?? {};
    for (const [name, value] of Object.entries(cssVars)) {
      root.style.setProperty(name, value);
    }

    // Use the theme's color scheme for native UI controls.
    const scheme = runtimeTheme?.mode === 'light' ? 'light' : 'dark';
    root.classList.toggle('dark', scheme === 'dark');
    root.style.setProperty('color-scheme', scheme);

    const themeColorMeta = document.querySelector(
      'meta[name="theme-color"]'
    ) as HTMLMetaElement | null;
    if (themeColorMeta) {
      themeColorMeta.content = scheme === 'light' ? '#ffffff' : '#0a0a0a';
    }
  }

  if (persist && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(getThemeStorageKey(householdId), theme.id);
    } catch {
      // Ignore storage failures (private mode, etc.)
    }
  }
}

/**
 * Get the current active theme from the document
 * @returns The currently active theme ID or default
 */
export function getCurrentThemeId(): string {
  if (typeof document === 'undefined') {
    return DEFAULT_THEME_ID;
  }

  const themeId = document.documentElement.getAttribute('data-theme');
  return themeId ? normalizeThemeId(themeId) : DEFAULT_THEME_ID;
}
