// s4/components/common/Badge.js
// ALX Factory - Badge Component
// Version: 1.0.0

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

var BADGE_VARIANT = {
  DEFAULT: "default",
  PRIMARY: "primary",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
  INFO: "info"
};

var BADGE_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg"
};

function Badge(props) {
  var variant = props.variant || BADGE_VARIANT.DEFAULT;
  var size = props.size || BADGE_SIZE.MD;
  var label = props.label || props.children;
  var dot = props.dot || false;
  var icon = props.icon;
  var style = props.style;

  var variantStyles = getVariantStyles(variant);
  var sizeStyles = getSizeStyles(size);

  if (dot) {
    return (
      <View style={[styles.dot, variantStyles.dot, style]} />
    );
  }

  return (
    <View style={[styles.badge, variantStyles.container, sizeStyles.container, style]}>
      {icon && (
        <View style={styles.icon}>{icon}</View>
      )}
      <Text style={[styles.text, variantStyles.text, sizeStyles.text]}>
        {label}
      </Text>
    </View>
  );
}

function getVariantStyles(variant) {
  var variants = {
    default: {
      container: {
        backgroundColor: COLORS.bg.overlay
      },
      text: {
        color: COLORS.text.secondary
      },
      dot: {
        backgroundColor: COLORS.text.muted
      }
    },
    primary: {
      container: {
        backgroundColor: COLORS.primaryLight
      },
      text: {
        color: COLORS.primary
      },
      dot: {
        backgroundColor: COLORS.primary
      }
    },
    success: {
      container: {
        backgroundColor: COLORS.status.successLight
      },
      text: {
        color: COLORS.status.success
      },
      dot: {
        backgroundColor: COLORS.status.success
      }
    },
    warning: {
      container: {
        backgroundColor: COLORS.status.warningLight
      },
      text: {
        color: COLORS.status.warning
      },
      dot: {
        backgroundColor: COLORS.status.warning
      }
    },
    error: {
      container: {
        backgroundColor: COLORS.status.errorLight
      },
      text: {
        color: COLORS.status.error
      },
      dot: {
        backgroundColor: COLORS.status.error
      }
    },
    info: {
      container: {
        backgroundColor: COLORS.status.infoLight
      },
      text: {
        color: COLORS.status.info
      },
      dot: {
        backgroundColor: COLORS.status.info
      }
    }
  };

  return variants[variant] || variants.default;
}

function getSizeStyles(size) {
  var sizes = {
    sm: {
      container: {
        paddingVertical: 2,
        paddingHorizontal: SPACING.xs
      },
      text: {
        fontSize: 10
      }
    },
    md: {
      container: {
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm
      },
      text: {
        fontSize: 12
      }
    },
    lg: {
      container: {
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.md
      },
      text: {
        fontSize: 14
      }
    }
  };

  return sizes[size] || sizes.md;
}

// Count Badge (for notifications, etc)
function CountBadge(props) {
  var count = props.count || 0;
  var max = props.max || 99;
  var variant = props.variant || BADGE_VARIANT.ERROR;
  var style = props.style;

  if (count === 0) return null;

  var displayCount = count > max ? max + "+" : count.toString();

  return (
    <Badge
      variant={variant}
      size={BADGE_SIZE.SM}
      label={displayCount}
      style={[styles.countBadge, style]}
    />
  );
}

var styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.badge
  },
  text: {
    fontWeight: "600"
  },
  icon: {
    marginRight: 4
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center"
  }
});

export { Badge, CountBadge, BADGE_VARIANT, BADGE_SIZE };
export default Badge;