// s4/components/factory/EnergyMeter.js
// ALX Factory - Energy Meter Component
// Version: 1.0.0

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, getEnergyColor } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

function EnergyMeter(props) {
  var energy = props.energy || 0;
  var maxEnergy = props.maxEnergy || 100;
  var label = props.label || "Energy";
  var showValue = props.showValue !== false;
  var size = props.size || "md";
  var style = props.style;

  var percentage = Math.min(100, Math.max(0, (energy / maxEnergy) * 100));
  var color = getEnergyColor(percentage);
  var sizeStyles = getSizeStyles(size);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, sizeStyles.label]}>{label}</Text>
      )}
      
      <View style={[styles.track, sizeStyles.track]}>
        <View
          style={[
            styles.fill,
            sizeStyles.fill,
            {
              width: percentage + "%",
              backgroundColor: color
            }
          ]}
        />
        
        <View
          style={[
            styles.glow,
            {
              width: percentage + "%",
              backgroundColor: color,
              opacity: 0.3
            }
          ]}
        />
      </View>

      {showValue && (
        <Text style={[styles.value, sizeStyles.value, { color: color }]}>
          {Math.round(energy)}/{maxEnergy}
        </Text>
      )}
    </View>
  );
}

function getSizeStyles(size) {
  var sizes = {
    sm: {
      track: { height: 6 },
      fill: { height: 6 },
      label: { fontSize: 10 },
      value: { fontSize: 10 }
    },
    md: {
      track: { height: 10 },
      fill: { height: 10 },
      label: { fontSize: 12 },
      value: { fontSize: 12 }
    },
    lg: {
      track: { height: 16 },
      fill: { height: 16 },
      label: { fontSize: 14 },
      value: { fontSize: 14 }
    }
  };

  return sizes[size] || sizes.md;
}

function CircularEnergyMeter(props) {
  var energy = props.energy || 0;
  var maxEnergy = props.maxEnergy || 100;
  var size = props.size || 80;
  var strokeWidth = props.strokeWidth || 8;
  var style = props.style;

  var percentage = Math.min(100, Math.max(0, (energy / maxEnergy) * 100));
  var color = getEnergyColor(percentage);

  return (
    <View style={[styles.circularContainer, { width: size, height: size }, style]}>
      <View
        style={[
          styles.circularTrack,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: COLORS.bg.overlay
          }
        ]}
      />
      
      <View
        style={[
          styles.circularProgress,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: color,
            borderTopColor: "transparent",
            borderRightColor: percentage > 25 ? color : "transparent",
            borderBottomColor: percentage > 50 ? color : "transparent",
            borderLeftColor: percentage > 75 ? color : "transparent",
            transform: [{ rotate: "-90deg" }]
          }
        ]}
      />
      
      <View style={styles.circularCenter}>
        <Text style={[styles.circularValue, { color: color }]}>
          {Math.round(percentage)}
        </Text>
        <Text style={styles.circularUnit}>%</Text>
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center"
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.secondary,
    marginRight: SPACING.sm
  },
  track: {
    flex: 1,
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.round,
    overflow: "hidden",
    position: "relative"
  },
  fill: {
    borderRadius: RADIUS.round
  },
  glow: {
    position: "absolute",
    top: -2,
    left: 0,
    height: "150%",
    borderRadius: RADIUS.round
  },
  value: {
    ...TYPOGRAPHY.label,
    marginLeft: SPACING.sm,
    fontWeight: "700"
  },
  circularContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  circularTrack: {
    position: "absolute"
  },
  circularProgress: {
    position: "absolute"
  },
  circularCenter: {
    alignItems: "center",
    justifyContent: "center"
  },
  circularValue: {
    ...TYPOGRAPHY.h3,
    fontWeight: "700"
  },
  circularUnit: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  }
});

export { EnergyMeter, CircularEnergyMeter };
export default EnergyMeter;