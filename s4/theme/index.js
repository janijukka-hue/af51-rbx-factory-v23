// s4/theme/index.js
// ALX Factory Design System - Entry Point
// Version: 1.0.0

export {
  COLORS,
  withOpacity,
  getStatusColor,
  getEnergyColor
} from "./colors.js";

export {
  TYPOGRAPHY,
  FONT_FAMILY,
  FONT_SIZE,
  LINE_HEIGHT,
  FONT_WEIGHT
} from "./typography.js";

export {
  SPACING,
  RADIUS,
  ICON_SIZE,
  AVATAR_SIZE,
  Z_INDEX,
  DURATION,
  BREAKPOINT
} from "./spacing.js";

export {
  SHADOWS,
  GLOW_DEFINITIONS,
  INNER_SHADOW,
  getShadow,
  getGlow
} from "./shadows.js";

// Unified theme object for convenience
import { COLORS } from "./colors.js";
import { TYPOGRAPHY, FONT_FAMILY } from "./typography.js";
import { SPACING, RADIUS, Z_INDEX, DURATION } from "./spacing.js";
import { SHADOWS, getShadow, getGlow } from "./shadows.js";

var THEME = {
  colors: COLORS,
  typography: TYPOGRAPHY,
  fonts: FONT_FAMILY,
  spacing: SPACING,
  radius: RADIUS,
  shadows: SHADOWS,
  zIndex: Z_INDEX,
  duration: DURATION,
  
  // Helpers
  getShadow: getShadow,
  getGlow: getGlow
};

export { THEME };
export default THEME;