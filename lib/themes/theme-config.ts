/**
 * Theme Configuration
 *
 * Defines all available themes for the Unified Ledger application.
 * Each theme contains a complete color palette using OKLCH color format.
 */

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  elevated: string;
  border: string;

  // Semantic colors
  income: string;
  expense: string;
  transfer: string;

  // UI colors
  primary: string;
  success: string;
  warning: string;
  error: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Foregrounds
  primaryForeground: string;
  secondaryForeground: string;
  accentForeground: string;
  destructiveForeground: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  isAvailable: boolean;
  colors: ThemeColors;  // All colors in OKLCH format
  preview?: string;     // Preview image URL (future feature)
}

/**
 * Dark Mode Theme
 * The default professional dark theme optimized for finance tracking
 */
export const darkModeTheme: Theme = {
  id: 'dark-mode',
  name: 'Dark Mode',
  description: 'Professional dark theme optimized for finance tracking',
  isAvailable: true,
  colors: {
    // Background colors (OKLCH)
    background: 'oklch(0.144788 0.000000 0.000000)',
    surface: 'oklch(0.217787 0.000000 0.000000)',
    elevated: 'oklch(0.260325 0.000000 0.000000)',
    border: 'oklch(0.285017 0.000000 0.000000)',

    // Semantic colors (OKLCH)
    income: 'oklch(0.695873 0.149074 162.479602)',
    expense: 'oklch(0.710627 0.166148 22.216224)',
    transfer: 'oklch(0.713740 0.143381 254.624021)',

    // UI colors (OKLCH)
    primary: 'oklch(0.695873 0.149074 162.479602)',
    success: 'oklch(0.695873 0.149074 162.479602)',
    warning: 'oklch(0.768590 0.164659 70.080390)',
    error: 'oklch(0.636834 0.207849 25.331328)',

    // Text colors (OKLCH)
    textPrimary: 'oklch(1.000000 0.000000 0.000000)',
    textSecondary: 'oklch(0.713660 0.019176 261.324645)',
    textMuted: 'oklch(0.551019 0.023361 264.363742)',

    // Foregrounds (OKLCH)
    primaryForeground: 'oklch(0.000000 0.000000 0.000000)',
    secondaryForeground: 'oklch(1.000000 0.000000 0.000000)',
    accentForeground: 'oklch(1.000000 0.000000 0.000000)',
    destructiveForeground: 'oklch(1.000000 0.000000 0.000000)',
  },
};

/**
 * Pink & Turquoise Theme
 * Elegant, colorful theme with pink and turquoise accents
 */
export const pinkTurquoiseTheme: Theme = {
  id: 'pink-turquoise',
  name: 'Pink & Turquoise',
  description: 'Elegant and colorful theme with pink and turquoise accents',
  isAvailable: true,
  colors: {
    // Backgrounds (deep aubergine base for elegance) - OKLCH
    background: 'oklch(0.155506 0.018491 312.515996)',
    surface: 'oklch(0.199368 0.029768 309.973432)',
    elevated: 'oklch(0.228815 0.043923 313.832051)',
    border: 'oklch(0.316141 0.052839 309.805027)',

    // Transactions & UI accents - OKLCH
    income: 'oklch(0.797116 0.133888 211.530189)',     // Turquoise
    expense: 'oklch(0.725266 0.175227 349.760748)',    // Pink
    transfer: 'oklch(0.708969 0.159168 293.541199)',   // Purple

    // UI states - OKLCH
    primary: 'oklch(0.655920 0.211773 354.308441)',    // Pink for primary actions
    success: 'oklch(0.784520 0.132529 181.911977)',    // Turquoise/teal
    warning: 'oklch(0.836861 0.164422 84.428628)',     // Amber
    error: 'oklch(0.719186 0.168984 13.427993)',       // Rose

    // Text - OKLCH
    textPrimary: 'oklch(1.000000 0.000000 0.000000)',
    textSecondary: 'oklch(0.927582 0.005814 264.531291)',
    textMuted: 'oklch(0.713660 0.019176 261.324645)',

    // Foregrounds - OKLCH
    primaryForeground: 'oklch(0.000000 0.000000 0.000000)',
    secondaryForeground: 'oklch(1.000000 0.000000 0.000000)',
    accentForeground: 'oklch(1.000000 0.000000 0.000000)',
    destructiveForeground: 'oklch(1.000000 0.000000 0.000000)',
  },
};

/**
 * All available themes
 */
export const themes: Theme[] = [
  darkModeTheme,
  pinkTurquoiseTheme,
];

/**
 * Default theme ID
 */
export const DEFAULT_THEME_ID = 'dark-mode';
