// s4/theme/shadows.js
// ALX Factory Design System - Shadows
// Version: 1.0.0

import { Platform } from "react-native";

// Shadow definitions
var SHADOW_DEFINITIONS = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0
  },
  
  sm: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  },
  
  md: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4
  },
  
  lg: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  
  xl: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 16
  },
  
  xxl: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24
  }
};

// Glow effects (for primary color elements)
var GLOW_DEFINITIONS = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0
  },
  
  primary: {
    shadowColor: "#39ff5a",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4
  },
  
  primaryStrong: {
    shadowColor: "#39ff5a",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8
  },
  
  success: {
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4
  },
  
  warning: {
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4
  },
  
  error: {
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4
  }
};

// Inner shadow simulation (using border)
var INNER_SHADOW = {
  subtle: {
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)"
  },
  medium: {
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.2)"
  },
  strong: {
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.3)"
  }
};

// Get shadow style based on platform
function getShadow(size) {
  var shadow = SHADOW_DEFINITIONS[size] || SHADOW_DEFINITIONS.none;
  
  if (Platform.OS === "web") {
    // Web uses boxShadow
    var x = shadow.shadowOffset.width;
    var y = shadow.shadowOffset.height;
    var blur = shadow.shadowRadius;
    var opacity = shadow.shadowOpacity;
    return {
      boxShadow: x + "px " + y + "px " + blur + "px rgba(0, 0, 0, " + opacity + ")"
    };
  }
  
  return shadow;
}

function getGlow(type) {
  var glow = GLOW_DEFINITIONS[type] || GLOW_DEFINITIONS.none;
  
  if (Platform.OS === "web") {
    var blur = glow.shadowRadius;
    var opacity = glow.shadowOpacity;
    var color = glow.shadowColor;
    return {
      boxShadow: "0 0 " + blur + "px " + color + Math.round(opacity * 100).toString(16)
    };
  }
  
  return glow;
}

var SHADOWS = {
  ...SHADOW_DEFINITIONS,
  glow: GLOW_DEFINITIONS,
  inner: INNER_SHADOW
};

export { SHADOWS, GLOW_DEFINITIONS, INNER_SHADOW, getShadow, getGlow };
export default SHADOWS;