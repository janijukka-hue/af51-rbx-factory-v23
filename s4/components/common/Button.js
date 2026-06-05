// s4/components/common/Button.js
// ALX Factory - Button Component
// Version: 1.0.0

import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View
} from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

var BUTTON_VARIANT = {
  PRIMARY: "primary",
  SECONDARY: "secondary",
  OUTLINE: "outline",
  GHOST: "ghost",
  DANGER: "danger",
  SUCCESS: "success"
};

var BUTTON_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg"
};

function Button(props) {
  var variant = props.variant || BUTTON_VARIANT.PRIMARY;
  var size = props.size || BUTTON_SIZE.MD;
  var disabled = props.disabled || false;
  var loading = props.loading || false;
  var icon = props.icon || null;
  var iconPosition = props.iconPosition || "left";
  var fullWidth = props.fullWidth || false;
  var onPress = props.onPress;
  var children = props.children;
  var style = props.style;

  var variantStyles = getVariantStyles(variant, disabled);
  var sizeStyles = getSizeStyles(size);

  function handlePress() {
    if (!disabled && !loading && onPress) {
      onPress();
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={function(state) {
        return [
          styles.base,
          variantStyles.container,
          sizeStyles.container,
          fullWidth && styles.fullWidth,
          state.pressed && variantStyles.pressed,
          disabled && styles.disabled,
          style
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.textColor}
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === "left" && (
            <View style={styles.iconLeft}>{icon}</View>
          )}
          <Text
            style={[
              styles.text,
              sizeStyles.text,
              { color: variantStyles.textColor }
            ]}
          >
            {children}
          </Text>
          {icon && iconPosition === "right" && (
            <View style={styles.iconRight}>{icon}</View>
          )}
        </View>
      )}
    </Pressable>
  );
}

function getVariantStyles(variant, disabled) {
  var variants = {
    primary: {
      container: {
        backgroundColor: disabled ? COLORS.primary + "60" : COLORS.primary
      },
      pressed: {
        backgroundColor: COLORS.primaryDark
      },
      textColor: COLORS.text.inverse
    },
    secondary: {
      container: {
        backgroundColor: disabled ? COLORS.bg.elevated : COLORS.bg.overlay
      },
      pressed: {
        backgroundColor: COLORS.bg.elevated
      },
      textColor: COLORS.text.primary
    },
    outline: {
      container: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: disabled ? COLORS.border.subtle : COLORS.primary
      },
      pressed: {
        backgroundColor: COLORS.primaryLight
      },
      textColor: disabled ? COLORS.text.disabled : COLORS.primary
    },
    ghost: {
      container: {
        backgroundColor: "transparent"
      },
      pressed: {
        backgroundColor: COLORS.bg.overlay
      },
      textColor: disabled ? COLORS.text.disabled : COLORS.text.primary
    },
    danger: {
      container: {
        backgroundColor: disabled ? COLORS.status.error + "60" : COLORS.status.error
      },
      pressed: {
        backgroundColor: "#dc2626"
      },
      textColor: COLORS.white
    },
    success: {
      container: {
        backgroundColor: disabled ? COLORS.status.success + "60" : COLORS.status.success
      },
      pressed: {
        backgroundColor: "#16a34a"
      },
      textColor: COLORS.white
    }
  };

  return variants[variant] || variants.primary;
}

function getSizeStyles(size) {
  var sizes = {
    sm: {
      container: {
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        minHeight: 32
      },
      text: TYPOGRAPHY.buttonSmall
    },
    md: {
      container: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        minHeight: 40
      },
      text: TYPOGRAPHY.button
    },
    lg: {
      container: {
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        minHeight: 48
      },
      text: {
        ...TYPOGRAPHY.button,
        fontSize: 16
      }
    }
  };

  return sizes[size] || sizes.md;
}

var styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.button,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row"
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  text: {
    textAlign: "center"
  },
  iconLeft: {
    marginRight: SPACING.xs
  },
  iconRight: {
    marginLeft: SPACING.xs
  },
  fullWidth: {
    width: "100%"
  },
  disabled: {
    opacity: 0.6
  }
});

export { Button, BUTTON_VARIANT, BUTTON_SIZE };
export default Button;