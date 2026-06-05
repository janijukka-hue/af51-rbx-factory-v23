// ui/components/common/StatusBadge.js
// Enterprise Status Badge Component

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SIZES } from "../../styles/theme.js";

export function StatusBadge(props) {
  var status = props.status || "idle";
  var label = props.label;
  var size = props.size || "md";
  var pulse = props.pulse;
  
  var statuses = {
    idle: { color: COLORS.textMuted, bg: "rgba(106, 106, 130, 0.2)", label: "IDLE" },
    ready: { color: COLORS.cyan, bg: COLORS.cyanBg, label: "READY" },
    running: { color: COLORS.lime, bg: COLORS.limeBg, label: "RUNNING" },
    processing: { color: COLORS.purple, bg: COLORS.purpleBg, label: "PROCESSING" },
    success: { color: COLORS.success, bg: COLORS.successBg, label: "SUCCESS" },
    warning: { color: COLORS.warning, bg: COLORS.warningBg, label: "WARNING" },
    error: { color: COLORS.error, bg: COLORS.errorBg, label: "ERROR" },
    offline: { color: COLORS.textDark, bg: "rgba(69, 69, 90, 0.2)", label: "OFFLINE" },
    locked: { color: COLORS.warning, bg: COLORS.warningBg, label: "LOCKED" }
  };
  
  var sizes = {
    sm: { dot: 6, fontSize: 9, padding: 4, paddingH: 8 },
    md: { dot: 8, fontSize: 10, padding: 6, paddingH: 10 },
    lg: { dot: 10, fontSize: 12, padding: 8, paddingH: 14 }
  };
  
  var statusConfig = statuses[status] || statuses.idle;
  var sizeConfig = sizes[size];
  var displayLabel = label || statusConfig.label;
  
  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: statusConfig.bg,
        paddingVertical: sizeConfig.padding,
        paddingHorizontal: sizeConfig.paddingH
      }
    ]}>
      <View style={[
        styles.dot,
        {
          width: sizeConfig.dot,
          height: sizeConfig.dot,
          backgroundColor: statusConfig.color
        },
        pulse && styles.pulse
      ]} />
      <Text style={[
        styles.label,
        {
          color: statusConfig.color,
          fontSize: sizeConfig.fontSize
        }
      ]}>
        {displayLabel}
      </Text>
    </View>
  );
}

var styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: SIZES.radiusFull,
    gap: 6
  },
  dot: {
    borderRadius: SIZES.radiusFull
  },
  pulse: {
    opacity: 0.8
  },
  label: {
    fontWeight: "700",
    letterSpacing: 1
  }
});

export default StatusBadge;