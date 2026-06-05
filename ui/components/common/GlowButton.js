// ui/components/common/GlowButton.js
// Enterprise Glow Button Component

import React from "react";
import { TouchableOpacity, Text, View, StyleSheet } from "react-native";
import { COLORS, SIZES, SHADOWS } from "../../styles/theme.js";

export function GlowButton(props) {
  var onPress = props.onPress;
  var title = props.title;
  var icon = props.icon;
  var variant = props.variant || "cyan";
  var size = props.size || "md";
  var disabled = props.disabled;
  var fullWidth = props.fullWidth;
  var style = props.style;
  
  var colors = {
    cyan: {
      bg: COLORS.cyanBg,
      border: COLORS.cyan,
      text: COLORS.cyan,
      glow: SHADOWS.glow
    },
    purple: {
      bg: COLORS.purpleBg,
      border: COLORS.purple,
      text: COLORS.purple,
      glow: SHADOWS.glowPurple
    },
    lime: {
      bg: COLORS.limeBg,
      border: COLORS.lime,
      text: COLORS.lime,
      glow: {
        shadowColor: COLORS.lime,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8
      }
    },
    ghost: {
      bg: "transparent",
      border: COLORS.border,
      text: COLORS.textSecondary,
      glow: {}
    }
  };
  
  var sizes = {
    sm: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      fontSize: SIZES.fontSm,
      iconSize: 14
    },
    md: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      fontSize: SIZES.fontMd,
      iconSize: 16
    },
    lg: {
      paddingVertical: 16,
      paddingHorizontal: 28,
      fontSize: SIZES.fontLg,
      iconSize: 20
    }
  };
  
  var colorSet = colors[variant];
  var sizeSet = sizes[size];
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: colorSet.bg,
          borderColor: disabled ? COLORS.border : colorSet.border,
          paddingVertical: sizeSet.paddingVertical,
          paddingHorizontal: sizeSet.paddingHorizontal
        },
        !disabled && colorSet.glow,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style
      ]}
    >
      {icon && (
        <Text style={[
          styles.icon,
          { 
            color: disabled ? COLORS.textMuted : colorSet.text,
            fontSize: sizeSet.iconSize
          }
        ]}>
          {icon}
        </Text>
      )}
      <Text style={[
        styles.text,
        { 
          color: disabled ? COLORS.textMuted : colorSet.text,
          fontSize: sizeSet.fontSize
        }
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

var styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: SIZES.radiusMd,
    gap: 8
  },
  fullWidth: {
    width: "100%"
  },
  disabled: {
    opacity: 0.5
  },
  icon: {
    fontWeight: "600"
  },
  text: {
    fontWeight: "600",
    letterSpacing: 0.5
  }
});

export default GlowButton;