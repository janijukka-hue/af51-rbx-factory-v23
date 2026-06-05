// ui/components/common/MetricCard.js
// Enterprise Metric Display Component

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SIZES, SHADOWS } from "../../styles/theme.js";

export function MetricCard(props) {
  var label = props.label;
  var value = props.value;
  var unit = props.unit;
  var icon = props.icon;
  var trend = props.trend;
  var color = props.color || "cyan";
  var size = props.size || "md";
  
  var colors = {
    cyan: COLORS.cyan,
    purple: COLORS.purple,
    lime: COLORS.lime,
    warning: COLORS.warning,
    error: COLORS.error
  };
  
  var accentColor = colors[color];
  
  return (
    <View style={[styles.container, SHADOWS.sm]}>
      <View style={styles.header}>
        {icon && (
          <Text style={[styles.icon, { color: accentColor }]}>{icon}</Text>
        )}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
        {unit && (
          <Text style={styles.unit}>{unit}</Text>
        )}
      </View>
      {trend !== undefined && (
        <View style={styles.trendRow}>
          <Text style={[
            styles.trend,
            { color: trend >= 0 ? COLORS.success : COLORS.error }
          ]}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </Text>
        </View>
      )}
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.lg,
    minWidth: 120
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8
  },
  icon: {
    fontSize: 14
  },
  label: {
    fontSize: SIZES.fontSm,
    color: COLORS.textMuted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4
  },
  value: {
    fontSize: SIZES.fontXxl,
    fontWeight: "700"
  },
  unit: {
    fontSize: SIZES.fontSm,
    color: COLORS.textMuted
  },
  trendRow: {
    marginTop: 6
  },
  trend: {
    fontSize: SIZES.fontSm,
    fontWeight: "600"
  }
});

export default MetricCard;