// s4/components/common/ProgressBar.js
// ALX Factory - ProgressBar Component
// Version: 1.0.1

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

var PROGRESS_VARIANT = {
  DEFAULT: "default",
  PRIMARY: "primary",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error"
};

var PROGRESS_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg"
};

function ProgressBar(props) {
  var progress = props.progress || 0;
  var variant = props.variant || PROGRESS_VARIANT.PRIMARY;
  var size = props.size || PROGRESS_SIZE.MD;
  var showLabel = props.showLabel || false;
  var label = props.label;
  var animated = props.animated !== false;
  var indeterminate = props.indeterminate || false;
  var style = props.style;

  var animatedWidth = useRef(new Animated.Value(0)).current;
  var indeterminateAnim = useRef(new Animated.Value(0)).current;

  useEffect(function() {
    if (indeterminate) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(indeterminateAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false
          }),
          Animated.timing(indeterminateAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false
          })
        ])
      ).start();
    } else if (animated) {
      Animated.timing(animatedWidth, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false
      }).start();
    } else {
      animatedWidth.setValue(progress);
    }
  }, [progress, animated, indeterminate, animatedWidth, indeterminateAnim]);

  var variantStyles = getVariantStyles(variant);
  var sizeStyles = getSizeStyles(size);

  var widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"]
  });

  var indeterminateInterpolation = indeterminateAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0%", "50%", "100%"]
  });

  return (
    <View style={[styles.container, style]}>
      {(showLabel || label) && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label || ""}</Text>
          {showLabel && !indeterminate && (
            <Text style={styles.percentage}>{Math.round(progress)}%</Text>
          )}
        </View>
      )}
      
      <View style={[styles.track, sizeStyles.track]}>
        {indeterminate ? (
          <Animated.View
            style={[
              styles.fill,
              variantStyles,
              sizeStyles.fill,
              styles.indeterminate,
              {
                left: indeterminateInterpolation,
                width: "30%"
              }
            ]}
          />
        ) : (
          <Animated.View
            style={[
              styles.fill,
              variantStyles,
              sizeStyles.fill,
              { width: widthInterpolation }
            ]}
          />
        )}
      </View>
    </View>
  );
}

function getVariantStyles(variant) {
  var colors = {
    default: COLORS.text.muted,
    primary: COLORS.primary,
    success: COLORS.status.success,
    warning: COLORS.status.warning,
    error: COLORS.status.error
  };

  return {
    backgroundColor: colors[variant] || colors.primary
  };
}

function getSizeStyles(size) {
  var sizes = {
    sm: {
      track: { height: 4 },
      fill: { height: 4 }
    },
    md: {
      track: { height: 8 },
      fill: { height: 8 }
    },
    lg: {
      track: { height: 12 },
      fill: { height: 12 }
    }
  };

  return sizes[size] || sizes.md;
}

function SegmentedProgress(props) {
  var segments = props.segments || [];
  var size = props.size || PROGRESS_SIZE.MD;
  var showLabels = props.showLabels || false;
  var style = props.style;

  var sizeStyles = getSizeStyles(size);

  return (
    <View style={[styles.container, style]}>
      {showLabels && (
        <View style={styles.segmentLabels}>
          {segments.map(function(segment, index) {
            return (
              <Text
                key={index}
                style={[styles.segmentLabel, { flex: 1 }]}
              >
                {segment.label || ""}
              </Text>
            );
          })}
        </View>
      )}
      
      <View style={[styles.track, sizeStyles.track, styles.segmentedTrack]}>
        {segments.map(function(segment, index) {
          var segmentVariantStyles = getVariantStyles(segment.variant || "primary");
          var isFirst = index === 0;
          var isLast = index === segments.length - 1;
          
          return (
            <View
              key={index}
              style={[
                styles.segment,
                { flex: 1 },
                !isFirst && styles.segmentGap
              ]}
            >
              <View
                style={[
                  styles.segmentFill,
                  segmentVariantStyles,
                  sizeStyles.fill,
                  { width: segment.value + "%" },
                  isFirst && styles.segmentFirst,
                  isLast && styles.segmentLast
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    width: "100%"
  },
  labelContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.xs
  },
  label: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.secondary
  },
  percentage: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.muted
  },
  track: {
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.round,
    overflow: "hidden"
  },
  fill: {
    borderRadius: RADIUS.round
  },
  indeterminate: {
    position: "absolute"
  },
  segmentedTrack: {
    flexDirection: "row"
  },
  segment: {
    overflow: "hidden"
  },
  segmentGap: {
    marginLeft: 2
  },
  segmentFill: {
    height: "100%"
  },
  segmentFirst: {
    borderTopLeftRadius: RADIUS.round,
    borderBottomLeftRadius: RADIUS.round
  },
  segmentLast: {
    borderTopRightRadius: RADIUS.round,
    borderBottomRightRadius: RADIUS.round
  },
  segmentLabels: {
    flexDirection: "row",
    marginBottom: SPACING.xs
  },
  segmentLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    textAlign: "center"
  }
});

export { ProgressBar, SegmentedProgress, PROGRESS_VARIANT, PROGRESS_SIZE };
export default ProgressBar;