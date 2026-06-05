// s4/components/logs/LogFilter.js
// ALX Factory - Log Filter Component
// Version: 1.0.0

import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { LOG_LEVEL, LOG_SOURCE } from "../../services/LogService.js";

var LEVEL_CONFIG = {
  debug: { label: "Debug", color: COLORS.text.muted },
  info: { label: "Info", color: COLORS.status.info },
  warn: { label: "Warn", color: COLORS.status.warning },
  error: { label: "Error", color: COLORS.status.error }
};

var SOURCE_CONFIG = {
  kernel: { label: "Kernel", short: "K1" },
  orchestrator: { label: "Orchestrator", short: "M2" },
  factory: { label: "Factory", short: "T3" },
  worker: { label: "Worker", short: "W" },
  build: { label: "Build", short: "B" },
  system: { label: "System", short: "S" }
};

function LogFilter(props) {
  var filters = props.filters || {};
  var onFilterChange = props.onFilterChange;
  var onClearFilters = props.onClearFilters;
  var stats = props.stats || {};
  var compact = props.compact || false;
  var style = props.style;

  var hasActiveFilters = filters.level || filters.source || filters.search;

  function handleLevelSelect(level) {
    if (onFilterChange) {
      onFilterChange("level", filters.level === level ? null : level);
    }
  }

  function handleSourceSelect(source) {
    if (onFilterChange) {
      onFilterChange("source", filters.source === source ? null : source);
    }
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Level</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {Object.keys(LEVEL_CONFIG).map(function(level) {
              var config = LEVEL_CONFIG[level];
              var isActive = filters.level === level;
              var count = stats.byLevel ? stats.byLevel[level] || 0 : 0;

              return (
                <FilterChip
                  key={level}
                  label={compact ? config.label.charAt(0) : config.label}
                  color={config.color}
                  count={count}
                  active={isActive}
                  onPress={function() { handleLevelSelect(level); }}
                  compact={compact}
                />
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Source</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {Object.keys(SOURCE_CONFIG).map(function(source) {
              var config = SOURCE_CONFIG[source];
              var isActive = filters.source === source;
              var count = stats.bySource ? stats.bySource[source] || 0 : 0;

              return (
                <FilterChip
                  key={source}
                  label={compact ? config.short : config.label}
                  count={count}
                  active={isActive}
                  onPress={function() { handleSourceSelect(source); }}
                  compact={compact}
                />
              );
            })}
          </View>
        </ScrollView>
      </View>

      {hasActiveFilters && (
        <Pressable onPress={onClearFilters} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear filters</Text>
        </Pressable>
      )}
    </View>
  );
}

function FilterChip(props) {
  var label = props.label;
  var color = props.color;
  var count = props.count;
  var active = props.active;
  var onPress = props.onPress;
  var compact = props.compact;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        active && styles.chipActive,
        active && color && { backgroundColor: color + "20", borderColor: color }
      ]}
    >
      {color && (
        <View style={[styles.chipDot, { backgroundColor: color }]} />
      )}
      <Text style={[
        styles.chipLabel,
        compact && styles.chipLabelCompact,
        active && styles.chipLabelActive,
        active && color && { color: color }
      ]}>
        {label}
      </Text>
      {count > 0 && !compact && (
        <Text style={[styles.chipCount, active && color && { color: color }]}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

var styles = StyleSheet.create({
  container: {},
  section: {
    marginBottom: SPACING.sm
  },
  sectionLabel: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.text.muted,
    marginBottom: SPACING.xs
  },
  filterRow: {
    flexDirection: "row"
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginRight: SPACING.xs,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.bg.overlay,
    borderWidth: 1,
    borderColor: "transparent"
  },
  chipCompact: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.xs
  },
  chipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING.xs
  },
  chipLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary
  },
  chipLabelCompact: {
    fontSize: 10
  },
  chipLabelActive: {
    color: COLORS.primary,
    fontWeight: "600"
  },
  chipCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginLeft: SPACING.xs,
    fontSize: 10
  },
  clearButton: {
    alignSelf: "flex-start",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm
  },
  clearButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary
  }
});

export { LogFilter, LEVEL_CONFIG, SOURCE_CONFIG };
export default LogFilter;