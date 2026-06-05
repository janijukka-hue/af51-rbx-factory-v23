// s4/theme/typography.js
// ALX Factory Design System - Typography
// Version: 1.0.0

import { Platform } from "react-native";

var FONT_FAMILY = {
  regular: Platform.select({
    ios: "System",
    android: "Roboto",
    web: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  }),
  medium: Platform.select({
    ios: "System",
    android: "Roboto-Medium",
    web: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  }),
  bold: Platform.select({
    ios: "System",
    android: "Roboto-Bold",
    web: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  }),
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    web: "'SF Mono', 'Fira Code', 'Consolas', monospace"
  })
};

var FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  display: 36
};

var LINE_HEIGHT = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
  loose: 1.8
};

var FONT_WEIGHT = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700"
};

var TYPOGRAPHY = {
  // Display
  display: {
    fontSize: FONT_SIZE.display,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: FONT_SIZE.display * LINE_HEIGHT.tight,
    letterSpacing: -0.5
  },

  // Headings
  h1: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: FONT_SIZE.xxxl * LINE_HEIGHT.tight,
    letterSpacing: -0.3
  },
  h2: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: FONT_SIZE.xxl * LINE_HEIGHT.tight,
    letterSpacing: -0.2
  },
  h3: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: FONT_SIZE.xl * LINE_HEIGHT.normal
  },
  h4: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: FONT_SIZE.lg * LINE_HEIGHT.normal
  },

  // Body text
  bodyLarge: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.normal,
    lineHeight: FONT_SIZE.lg * LINE_HEIGHT.relaxed
  },
  body: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.normal,
    lineHeight: FONT_SIZE.md * LINE_HEIGHT.relaxed
  },
  bodySmall: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.normal,
    lineHeight: FONT_SIZE.sm * LINE_HEIGHT.relaxed
  },

  // Labels
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    lineHeight: FONT_SIZE.sm * LINE_HEIGHT.normal,
    letterSpacing: 0.2
  },
  labelSmall: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    lineHeight: FONT_SIZE.xs * LINE_HEIGHT.normal,
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },

  // Code / Mono
  code: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.mono,
    lineHeight: FONT_SIZE.sm * LINE_HEIGHT.relaxed
  },
  codeSmall: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.mono,
    lineHeight: FONT_SIZE.xs * LINE_HEIGHT.relaxed
  },
  codeLarge: {
    fontSize: FONT_SIZE.md,
    fontFamily: FONT_FAMILY.mono,
    lineHeight: FONT_SIZE.md * LINE_HEIGHT.relaxed
  },

  // Caption
  caption: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.normal,
    lineHeight: FONT_SIZE.xs * LINE_HEIGHT.normal
  },

  // Button text
  button: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: FONT_SIZE.md * LINE_HEIGHT.normal,
    letterSpacing: 0.2
  },
  buttonSmall: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: FONT_SIZE.sm * LINE_HEIGHT.normal,
    letterSpacing: 0.2
  }
};

export { TYPOGRAPHY, FONT_FAMILY, FONT_SIZE, LINE_HEIGHT, FONT_WEIGHT };
export default TYPOGRAPHY;