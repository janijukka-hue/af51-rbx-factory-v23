// s4/components/common/StatusIndicator.js
// ALX Factory - Status Indicator Component
// Version: 1.0.1

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING } from "../../theme/spacing.js";

var STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
  BUILDING: "building",
  QUEUED: "queued",
  OFFLINE: "offline"
};

var STATUS_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg"
};

function StatusIndicator(props) {
  var status = props.status || STATUS.IDLE;
  var size = props.size || STATUS_SIZE.MD;
  var label = props.label;
  var pulse = props.pulse || false;
  var style = props.style;

  var pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(function() {
    if (pulse || status === STATUS.RUNNING || status === STATUS.BUILDING) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pulse, status, pulseAnim]);

  var color = getStatusColorForStatus(status);
  var sizeStyles = getSizeStyles(size);

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.dot,
          sizeStyles.dot,
          { backgroundColor: color },
          { opacity: pulseAnim }
        ]}
      />
      {label && (
        <Text style={[styles.label, sizeStyles.label, { color: color }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

function getStatusColorForStatus(status) {
  var colors = {
    idle: COLORS.text.muted,
    running: COLORS.primary,
    success: COLORS.status.success,
    warning: COLORS.status.warning,
    error: COLORS.status.error,
    building: COLORS.factory.building,
    queued: COLORS.factory.queued,
    offline: COLORS.text.disabled
  };

  return colors[status] || COLORS.text.muted;
}

function getSizeStyles(size) {
  var sizes = {
    sm: {
      dot: { width: 6, height: 6, borderRadius: 3 },
      label: { fontSize: 10 }
    },
    md: {
      dot: { width: 8, height: 8, borderRadius: 4 },
      label: { fontSize: 12 }
    },
    lg: {
      dot: { width: 12, height: 12, borderRadius: 6 },
      label: { fontSize: 14 }
    }
  };

  return sizes[size] || sizes.md;
}

function StatusBadge(props) {
  var status = props.status || STATUS.IDLE;
  var label = props.label;
  var icon = props.icon;
  var size = props.size || STATUS_SIZE.MD;
  var style = props.style;

  var color = getStatusColorForStatus(status);
  var bgColor = color + "20";

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, style]}>
      {icon && (
        <View style={styles.badgeIcon}>{icon}</View>
      )}
      <StatusIndicator status={status} size={size} />
      {label && (
        <Text style={[styles.badgeLabel, { color: color }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

function FactoryStatus(props) {
  var state = props.state || "OFFLINE";
  var jobCount = props.jobCount || 0;
  var style = props.style;

  var stateMap = {
    OFFLINE: { status: STATUS.OFFLINE, label: "Offline" },
    BOOTING: { status: STATUS.BUILDING, label: "Booting..." },
    READY: { status: STATUS.SUCCESS, label: "Ready" },
    BUILDING: { status: STATUS.BUILDING, label: "Building" },
    STOPPING: { status: STATUS.WARNING, label: "Stopping..." },
    ERROR: { status: STATUS.ERROR, label: "Error" }
  };

  var mapped = stateMap[state] || stateMap.OFFLINE;

  return (
    <View style={[styles.factoryStatus, style]}>
      <StatusIndicator
        status={mapped.status}
        label={mapped.label}
        size={STATUS_SIZE.MD}
        pulse={state === "BUILDING" || state === "BOOTING"}
      />
      {jobCount > 0 && (
        <Text style={styles.jobCount}>
          {jobCount} {jobCount === 1 ? "job" : "jobs"}
        </Text>
      )}
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center"
  },
  dot: {},
  label: {
    marginLeft: SPACING.xs,
    fontWeight: "500"
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12
  },
  badgeIcon: {
    marginRight: SPACING.xs
  },
  badgeLabel: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: "500",
    marginLeft: SPACING.xs
  },
  factoryStatus: {
    flexDirection: "row",
    alignItems: "center"
  },
  jobCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginLeft: SPACING.sm
  }
});

export { StatusIndicator, StatusBadge, FactoryStatus, STATUS, STATUS_SIZE };
export default StatusIndicator;