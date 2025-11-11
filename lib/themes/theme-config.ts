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
  mode: 'dark' | 'light';
  colors: ThemeColors;  // All colors in OKLCH format
  preview?: string;     // Preview image URL (future feature)
}

/**
 * Dark Mode Theme
 * The default professional dark theme optimized for finance tracking
 */
export const darkModeTheme: Theme = {
  id: 'dark-mode',
  name: 'Dark Green',
  description: 'Professional dark theme optimized for finance tracking',
  isAvailable: true,
  mode: 'dark',
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
    primary: 'oklch(0.695873 0.149074 162.479602)', // Green for primary actions
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
 * Dark Pink Theme
 * Elegant dark theme with pink accents
 */
export const darkPinkTheme: Theme = {
  id: 'dark-pink',
  name: 'Dark Pink',
  description: 'Elegant dark theme with pink accents',
  isAvailable: true,
  mode: 'dark',
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
 * Light Bubblegum Theme
 * Vibrant, playful light theme with bubblegum pinks and candy accents
 */
export const lightBubblegumTheme: Theme = {
  id: 'light-bubblegum',
  name: 'Light Bubblegum',
  description: 'Vibrant light theme with playful bubblegum pinks and candy accents',
  isAvailable: true,
  mode: 'light',
  colors: {
    // Backgrounds - bright with a subtle pink tint
    background: 'oklch(0.985000 0.010000 330.000000)', // near-white, slight pink
    surface: 'oklch(0.976000 0.014000 330.000000)',    // card
    elevated: 'oklch(0.945000 0.022000 330.000000)',   // elevated/hover (more contrast)
    border: 'oklch(0.780000 0.020000 270.000000)',     // stronger neutral border for contrast

    // Transactions & UI accents
    income: 'oklch(0.620000 0.190000 200.000000)',     // deeper turquoise for contrast
    expense: 'oklch(0.820000 0.220000 350.000000)',    // hot pink
    transfer: 'oklch(0.830000 0.180000 300.000000)',   // purple/violet

    // UI states
    primary: 'oklch(0.840000 0.220000 350.000000)',    // bubblegum pink
    success: 'oklch(0.630000 0.160000 180.000000)',    // deeper mint for contrast
    warning: 'oklch(0.720000 0.220000 85.000000)',     // stronger amber for borders
    error: 'oklch(0.800000 0.180000 25.000000)',       // rose/red

    // Text
    textPrimary: 'oklch(0.160000 0.010000 270.000000)',     // near-black
    textSecondary: 'oklch(0.420000 0.020000 270.000000)',   // dark gray
    textMuted: 'oklch(0.620000 0.015000 270.000000)',       // medium gray

    // Foregrounds
    primaryForeground: 'oklch(1.000000 0.000000 0.000000)',       // white on pink
    secondaryForeground: 'oklch(0.160000 0.010000 270.000000)',   // dark on light secondary
    accentForeground: 'oklch(1.000000 0.000000 0.000000)',        // white on accent
    destructiveForeground: 'oklch(1.000000 0.000000 0.000000)',   // white on red
  },
};

/**
 * Dark Blue Theme
 * Professional dark theme with blue accents instead of green
 */
export const darkBlueTheme: Theme = {
  id: 'dark-blue',
  name: 'Dark Blue',
  description: 'Professional dark theme with blue accents',
  isAvailable: true,
  mode: 'dark',
  colors: {
    // Background colors (OKLCH) - same as dark mode
    background: 'oklch(0.144788 0.000000 0.000000)',
    surface: 'oklch(0.217787 0.000000 0.000000)',
    elevated: 'oklch(0.260325 0.000000 0.000000)',
    border: 'oklch(0.285017 0.000000 0.000000)',

    // Semantic colors (OKLCH) - keep green and red for income/expense
    income: 'oklch(0.695873 0.149074 162.479602)', // Keep green
    expense: 'oklch(0.710627 0.166148 22.216224)', // Keep red
    transfer: 'oklch(0.713740 0.143381 254.624021)',

    // UI colors (OKLCH) - blue instead of green
    primary: 'oklch(0.695873 0.149074 240.000000)', // Blue instead of green
    success: 'oklch(0.695873 0.149074 240.000000)', // Blue instead of green
    warning: 'oklch(0.768590 0.164659 70.080390)',
    error: 'oklch(0.636834 0.207849 25.331328)',

    // Text colors (OKLCH) - same as dark mode
    textPrimary: 'oklch(1.000000 0.000000 0.000000)',
    textSecondary: 'oklch(0.713660 0.019176 261.324645)',
    textMuted: 'oklch(0.551019 0.023361 264.363742)',

    // Foregrounds (OKLCH) - same as dark mode
    primaryForeground: 'oklch(0.000000 0.000000 0.000000)',
    secondaryForeground: 'oklch(1.000000 0.000000 0.000000)',
    accentForeground: 'oklch(1.000000 0.000000 0.000000)',
    destructiveForeground: 'oklch(1.000000 0.000000 0.000000)',
  },
};

/**
 * Dark Turquoise Theme
 * Vibrant dark theme with turquoise/cyan accents
 */
export const darkTurquoiseTheme: Theme = {
  id: 'dark-turquoise',
  name: 'Dark Turquoise',
  description: 'Vibrant dark theme with turquoise/cyan accents',
  isAvailable: true,
  mode: 'dark',
  colors: {
    // Background colors (OKLCH) - same as dark mode
    background: 'oklch(0.144788 0.000000 0.000000)',
    surface: 'oklch(0.217787 0.000000 0.000000)',
    elevated: 'oklch(0.260325 0.000000 0.000000)',
    border: 'oklch(0.285017 0.000000 0.000000)',

    // Semantic colors (OKLCH) - turquoise theme
    income: 'oklch(0.750000 0.150000 200.000000)',     // Bright cyan
    expense: 'oklch(0.720000 0.180000 40.000000)',     // Coral
    transfer: 'oklch(0.680000 0.140000 180.000000)',   // Teal

    // UI colors (OKLCH) - turquoise accents
    primary: 'oklch(0.750000 0.150000 200.000000)',    // Turquoise
    success: 'oklch(0.780000 0.160000 210.000000)',    // Bright cyan
    warning: 'oklch(0.768590 0.164659 70.080390)',     // Amber
    error: 'oklch(0.636834 0.207849 25.331328)',       // Red

    // Text colors (OKLCH) - same as dark mode
    textPrimary: 'oklch(1.000000 0.000000 0.000000)',
    textSecondary: 'oklch(0.713660 0.019176 261.324645)',
    textMuted: 'oklch(0.551019 0.023361 264.363742)',

    // Foregrounds (OKLCH) - same as dark mode
    primaryForeground: 'oklch(0.000000 0.000000 0.000000)',
    secondaryForeground: 'oklch(1.000000 0.000000 0.000000)',
    accentForeground: 'oklch(0.000000 0.000000 0.000000)',
    destructiveForeground: 'oklch(1.000000 0.000000 0.000000)',
  },
};

/**
 * Light Turquoise Theme
 * Bright, professional light theme with turquoise/cyan accents
 */
export const lightTurquoiseTheme: Theme = {
  id: 'light-turquoise',
  name: 'Light Turquoise',
  description: 'Bright, professional light theme with turquoise/cyan accents',
  isAvailable: true,
  mode: 'light',
  colors: {
    // Background colors (OKLCH) - bright with cool tint
    background: 'oklch(0.985000 0.005000 200.000000)',
    surface: 'oklch(0.976000 0.008000 200.000000)',
    elevated: 'oklch(0.950000 0.012000 200.000000)',
    border: 'oklch(0.780000 0.020000 200.000000)',

    // Semantic colors (OKLCH) - turquoise theme for light mode
    income: 'oklch(0.550000 0.160000 200.000000)',     // Deep turquoise
    expense: 'oklch(0.600000 0.180000 40.000000)',     // Coral
    transfer: 'oklch(0.580000 0.150000 180.000000)',   // Teal

    // UI colors (OKLCH) - turquoise accents
    primary: 'oklch(0.550000 0.160000 200.000000)',    // Turquoise
    success: 'oklch(0.520000 0.150000 180.000000)',    // Deep teal
    warning: 'oklch(0.650000 0.180000 80.000000)',     // Amber
    error: 'oklch(0.580000 0.200000 25.000000)',       // Deep red

    // Text colors (OKLCH) - dark for light mode
    textPrimary: 'oklch(0.180000 0.010000 200.000000)',
    textSecondary: 'oklch(0.420000 0.015000 200.000000)',
    textMuted: 'oklch(0.600000 0.012000 200.000000)',

    // Foregrounds (OKLCH)
    primaryForeground: 'oklch(1.000000 0.000000 0.000000)',
    secondaryForeground: 'oklch(0.180000 0.010000 200.000000)',
    accentForeground: 'oklch(1.000000 0.000000 0.000000)',
    destructiveForeground: 'oklch(1.000000 0.000000 0.000000)',
  },
};

/**
 * All available themes
 */
export const themes: Theme[] = [
  darkModeTheme,
  darkPinkTheme,
  darkBlueTheme,
  darkTurquoiseTheme,
  lightTurquoiseTheme,
  lightBubblegumTheme,
];

/**
 * Default theme ID
 */
export const DEFAULT_THEME_ID = 'dark-mode';
