// ui/components/common/Card.js
// Enterprise Card Component

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SIZES, SHADOWS } from "../../styles/theme.js";

export function Card(props) {
  var title = props.title;
  var icon = props.icon;
  var children = props.children;
  var variant = props.variant || "default";
  var style = props.style;
  var headerRight = props.headerRight;
  var noPadding = props.noPadding;
  
  var variants = {
    default: {
      bg: COLORS.cardBg,
      border: COLORS.border
    },
    elevated: {
      bg: COLORS.elevated,
      border: COLORS.borderLight
    },
    cyan: {
      bg: COLORS.cyanBg,
      border: COLORS.cyanMuted
    },
    purple: {
      bg: COLORS.purpleBg,
      border: COLORS.purpleMuted
    },
    success: {
      bg: COLORS.successBg,
      border: COLORS.success
    },
    warning: {
      bg: COLORS.warningBg,
      border: COLORS.warning
    },
    error: {
      bg: COLORS.errorBg,
      border: COLORS.error
    }
  };
  
  var variantStyle = variants[variant];
  
  return (
    <View style={[
      styles.card,
      {
        backgroundColor: variantStyle.bg,
        borderColor: variantStyle.border
      },
      SHADOWS.sm,
      style
    ]}>
      {title && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {icon && (
              <Text style={styles.headerIcon}>{icon}</Text>
            )}
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
          {headerRight && (
            <View style={styles.headerRight}>
              {headerRight}
            </View>
          )}
        </View>
      )}
      <View style={[styles.content, noPadding && styles.noPadding]}>
        {children}
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: SIZES.radiusLg,
    overflow: "hidden"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "rgba(0, 0, 0, 0.2)"
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headerIcon: {
    fontSize: 18,
    color: COLORS.cyan
  },
  headerTitle: {
    fontSize: SIZES.fontMd,
    fontWeight: "600",
    color: COLORS.textPrimary,
    letterSpacing: 0.5
  },
  headerRight: {},
  content: {
    padding: SIZES.lg
  },
  noPadding: {
    padding: 0
  }
});

export default Card;