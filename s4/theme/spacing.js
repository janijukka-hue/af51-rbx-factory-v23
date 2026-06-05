// s4/theme/spacing.js
// ALX Factory Design System - Spacing
// Version: 1.0.0

var SPACING = {
  // Base scale (4px increments)
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,

  // Semantic spacing
  gutter: 16,
  section: 32,
  page: 24,

  // Component-specific
  cardPadding: 16,
  cardGap: 12,
  inputPadding: 12,
  buttonPadding: 12,
  listItemPadding: 12,
  modalPadding: 24,
  headerHeight: 56,
  tabBarHeight: 60,
  bottomSheetHandle: 24
};

var RADIUS = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  round: 9999,

  // Semantic
  button: 8,
  card: 12,
  input: 8,
  modal: 16,
  badge: 4,
  tag: 6
};

var ICON_SIZE = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48
};

var AVATAR_SIZE = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
  xxl: 120
};

// Z-index layers
var Z_INDEX = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  tooltip: 600,
  toast: 700
};

// Animation durations (ms)
var DURATION = {
  instant: 0,
  fast: 100,
  normal: 200,
  slow: 300,
  slower: 500
};

// Breakpoints (for responsive)
var BREAKPOINT = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280
};

export {
  SPACING,
  RADIUS,
  ICON_SIZE,
  AVATAR_SIZE,
  Z_INDEX,
  DURATION,
  BREAKPOINT
};

export default SPACING;