/**
 * Theme Utilities
 *
 * Helper functions for working with themes in the Unified Ledger application.
 */

import { themes, DEFAULT_THEME_ID, type Theme } from './theme-config';

/**
 * Get a theme by ID
 * @param themeId - The theme ID to retrieve
 * @returns The theme object or null if not found
 */
export function getTheme(themeId: string): Theme | null {
  const theme = themes.find((t) => t.id === themeId);
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
  return themes.some((theme) => theme.id === themeId);
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

/**
 * Apply theme to the document root
 * This function can be used to dynamically apply theme colors to CSS variables
 *
 * Note: Currently only dark mode is available, so this is a placeholder
 * for future multi-theme support (Feature #15)
 *
 * @param themeId - The theme ID to apply
 */
export function applyTheme(themeId: string): void {
  console.log(`[Theme] Applying theme: ${themeId}`);

  const theme = getTheme(themeId);
  if (!theme || !theme.isAvailable) {
    console.warn(`[Theme] Theme '${themeId}' not available, using default`);
    return;
  }

  // Apply theme ID as data attribute to root element
  // This will trigger the CSS rules in globals.css for the selected theme
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    const previousTheme = root.getAttribute('data-theme');
    root.setAttribute('data-theme', themeId);
    root.style.setProperty('color-scheme', 'dark');

    console.log(`[Theme] Changed data-theme from '${previousTheme}' to '${themeId}'`);
    console.log(`[Theme] Root element now has data-theme="${root.getAttribute('data-theme')}"`);
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('unified-ledger:theme', theme.id);
      console.log(`[Theme] Saved to localStorage: ${theme.id}`);
    } catch {
      // Ignore storage failures (private mode, etc.)
      console.warn('[Theme] Failed to save to localStorage');
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
  return themeId || DEFAULT_THEME_ID;
}
