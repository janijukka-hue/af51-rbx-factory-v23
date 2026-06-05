// s4/components/layout/Header.js
// ALX Factory - Header Component
// Version: 1.0.0

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING } from "../../theme/spacing.js";

function Header(props) {
  var title = props.title;
  var subtitle = props.subtitle;
  var leftAction = props.leftAction;
  var rightAction = props.rightAction;
  var onLeftPress = props.onLeftPress;
  var onRightPress = props.onRightPress;
  var style = props.style;
  var transparent = props.transparent || false;

  return (
    <View style={[
      styles.header,
      transparent && styles.headerTransparent,
      style
    ]}>
      <View style={styles.leftSection}>
        {leftAction && (
          <Pressable onPress={onLeftPress} style={styles.actionButton}>
            {leftAction}
          </Pressable>
        )}
      </View>

      <View style={styles.centerSection}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.rightSection}>
        {rightAction && (
          <Pressable onPress={onRightPress} style={styles.actionButton}>
            {rightAction}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function HeaderAction(props) {
  var icon = props.icon;
  var label = props.label;
  var onPress = props.onPress;
  var badge = props.badge;

  return (
    <Pressable onPress={onPress} style={styles.headerAction}>
      {icon && <Text style={styles.actionIcon}>{icon}</Text>}
      {label && <Text style={styles.actionLabel}>{label}</Text>}
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

var styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: SPACING.headerHeight,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  headerTransparent: {
    backgroundColor: "transparent",
    borderBottomWidth: 0
  },
  leftSection: {
    flex: 1,
    alignItems: "flex-start"
  },
  centerSection: {
    flex: 2,
    alignItems: "center"
  },
  rightSection: {
    flex: 1,
    alignItems: "flex-end"
  },
  title: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  actionButton: {
    padding: SPACING.xs
  },
  headerAction: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.xs,
    position: "relative"
  },
  actionIcon: {
    fontSize: 20,
    color: COLORS.text.primary
  },
  actionLabel: {
    ...TYPOGRAPHY.button,
    color: COLORS.primary,
    marginLeft: SPACING.xs
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: COLORS.status.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  badgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "700"
  }
});

export { Header, HeaderAction };
export default Header;