/**
 * Premium Design System
 *
 * A refined design system with 8px grid, curated colors,
 * and typography that creates a premium, polished feel.
 */

// Color Palette - Refined and purposeful
export const colors = {
  // Primary brand colors
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1', // Main primary
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },

  // Accent colors for tags and highlights
  accent: {
    rose: {
      light: '#fdf2f8',
      base: '#ec4899',
      dark: '#be185d',
    },
    emerald: {
      light: '#ecfdf5',
      base: '#10b981',
      dark: '#047857',
    },
    violet: {
      light: '#f5f3ff',
      base: '#8b5cf6',
      dark: '#6d28d9',
    },
    amber: {
      light: '#fffbeb',
      base: '#f59e0b',
      dark: '#b45309',
    },
    sky: {
      light: '#f0f9ff',
      base: '#0ea5e9',
      dark: '#0369a1',
    },
  },

  // Semantic colors
  semantic: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },

  // Neutrals - Warm gray for premium feel
  neutral: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f5f5f4',
    200: '#e7e5e4',
    300: '#d6d3d1',
    400: '#a8a29e',
    500: '#78716c',
    600: '#57534e',
    700: '#44403c',
    800: '#292524',
    900: '#1c1917',
    950: '#0c0a09',
  },

  // Background colors (light mode)
  background: {
    primary: '#fafafa',
    secondary: '#ffffff',
    tertiary: '#f5f5f4',
    elevated: '#ffffff',
    overlay: 'rgba(12, 10, 9, 0.4)',
    overlayDark: 'rgba(12, 10, 9, 0.7)',
  },

  // Dark mode background colors
  backgroundDark: {
    primary: '#0c0a09',
    secondary: '#1c1917',
    tertiary: '#292524',
    elevated: '#292524',
    overlay: 'rgba(0, 0, 0, 0.6)',
    overlayDark: 'rgba(0, 0, 0, 0.8)',
  },

  // Gradient presets
  gradients: {
    primary: ['#6366f1', '#8b5cf6'],
    warm: ['#f59e0b', '#ec4899'],
    cool: ['#0ea5e9', '#6366f1'],
    success: ['#10b981', '#0ea5e9'],
  },
};

// Typography - Generous line height, clear hierarchy
export const typography = {
  // Font families (can be customized with custom fonts)
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },

  // Font sizes following a modular scale
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 28,
    '3xl': 34,
    '4xl': 40,
  },

  // Line heights - generous for readability
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Font weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
};

// Text presets for consistent typography
export const textPresets = {
  // Headings
  h1: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.fontSize['3xl'] * typography.lineHeight.tight,
    letterSpacing: typography.letterSpacing.tight,
    color: colors.neutral[900],
  },
  h2: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.fontSize['2xl'] * typography.lineHeight.tight,
    letterSpacing: typography.letterSpacing.tight,
    color: colors.neutral[900],
  },
  h3: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize.xl * typography.lineHeight.tight,
    color: colors.neutral[900],
  },
  h4: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize.lg * typography.lineHeight.normal,
    color: colors.neutral[900],
  },

  // Body text
  bodyLarge: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.fontSize.md * typography.lineHeight.relaxed,
    color: colors.neutral[700],
  },
  body: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
    color: colors.neutral[700],
  },
  bodySmall: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
    color: colors.neutral[600],
  },

  // UI text
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
    color: colors.neutral[600],
  },
  caption: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.fontSize.xs * typography.lineHeight.normal,
    color: colors.neutral[500],
  },
  button: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
    letterSpacing: typography.letterSpacing.wide,
  },
  buttonSmall: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
    letterSpacing: typography.letterSpacing.wide,
  },
};

// Spacing - 8px grid system
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
};

// Border radius - Contemporary without being cartoonish
export const borderRadius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 9999,
};

// Shadows - Subtle depth without harsh edges
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  // Colored shadows for floating elements
  primary: {
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  soft: {
    shadowColor: colors.neutral[400],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
};

// Animation timing
export const animation = {
  // Duration in milliseconds
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
    slower: 700,
  },

  // Spring configurations for react-native-reanimated
  spring: {
    // Quick, snappy interactions
    snappy: {
      damping: 15,
      stiffness: 400,
      mass: 0.8,
    },
    // Default smooth spring
    default: {
      damping: 20,
      stiffness: 300,
      mass: 1,
    },
    // Bouncy for playful interactions
    bouncy: {
      damping: 10,
      stiffness: 200,
      mass: 0.8,
    },
    // Gentle for subtle animations
    gentle: {
      damping: 25,
      stiffness: 150,
      mass: 1,
    },
    // Heavy for large elements
    heavy: {
      damping: 30,
      stiffness: 200,
      mass: 1.2,
    },
  },

  // Easing presets
  easing: {
    easeInOut: [0.42, 0, 0.58, 1],
    easeOut: [0, 0, 0.58, 1],
    easeIn: [0.42, 0, 1, 1],
    spring: [0.175, 0.885, 0.32, 1.275],
  },
};

// Layout constants
export const layout = {
  // Screen padding
  screenPadding: spacing[5],
  // Card padding
  cardPadding: spacing[4],
  // Minimum touch target size
  minTouchTarget: 48,
  // Tab bar height
  tabBarHeight: 84,
  // Header height
  headerHeight: 56,
  // Status bar offset (approximate, should use SafeAreaView)
  statusBarOffset: 48,
};

// Tag colors mapping
export const tagColors = {
  reminder: {
    background: colors.accent.rose.light,
    text: colors.accent.rose.dark,
    icon: colors.accent.rose.base,
    border: colors.accent.rose.base,
  },
  preference: {
    background: colors.accent.emerald.light,
    text: colors.accent.emerald.dark,
    icon: colors.accent.emerald.base,
    border: colors.accent.emerald.base,
  },
  my_type: {
    background: colors.accent.violet.light,
    text: colors.accent.violet.dark,
    icon: colors.accent.violet.base,
    border: colors.accent.violet.base,
  },
  my_vibe: {
    background: colors.accent.amber.light,
    text: colors.accent.amber.dark,
    icon: colors.accent.amber.base,
    border: colors.accent.amber.base,
  },
};

// Helper function to get themed colors based on dark mode
export const getThemedColors = (isDark: boolean) => ({
  ...colors,
  background: isDark ? colors.backgroundDark : colors.background,
  // Text colors swap in dark mode
  text: {
    primary: isDark ? colors.neutral[50] : colors.neutral[900],
    secondary: isDark ? colors.neutral[300] : colors.neutral[700],
    tertiary: isDark ? colors.neutral[400] : colors.neutral[500],
    muted: isDark ? colors.neutral[500] : colors.neutral[400],
    inverse: isDark ? colors.neutral[900] : colors.neutral[0],
  },
  // Card and surface colors
  surface: {
    primary: isDark ? colors.neutral[900] : colors.neutral[0],
    secondary: isDark ? colors.neutral[800] : colors.neutral[50],
    border: isDark ? colors.neutral[700] : colors.neutral[200],
  },
  // Input colors
  input: {
    background: isDark ? colors.neutral[800] : colors.neutral[50],
    border: isDark ? colors.neutral[700] : colors.neutral[200],
    placeholder: isDark ? colors.neutral[500] : colors.neutral[400],
  },
});

// Export everything as default theme object
const theme = {
  colors,
  typography,
  textPresets,
  spacing,
  borderRadius,
  shadows,
  animation,
  layout,
  tagColors,
  getThemedColors,
};

export default theme;
