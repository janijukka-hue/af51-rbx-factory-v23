// s4/components/logs/LogEntryCard.js
// ALX Factory - Log Entry Card Component
// Version: 1.0.0

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

var LEVEL_COLORS = {
  debug: COLORS.text.muted,
  info: COLORS.status.info,
  warn: COLORS.status.warning,
  error: COLORS.status.error
};

var LEVEL_ICONS = {
  debug: "○",
  info: "●",
  warn: "⚠",
  error: "✕"
};

function LogEntryCard(props) {
  var log = props.log;
  var compact = props.compact || false;
  var showPayload = props.showPayload !== false;
  var onPress = props.onPress;
  var style = props.style;

  var expandedState = useState(false);
  var expanded = expandedState[0];
  var setExpanded = expandedState[1];

  var levelColor = LEVEL_COLORS[log.level] || COLORS.text.muted;
  var levelIcon = LEVEL_ICONS[log.level] || "●";

  var handlePress = useCallback(function() {
    if (onPress) {
      onPress(log);
    } else if (showPayload && log.payload && Object.keys(log.payload).length > 0) {
      setExpanded(function(prev) { return !prev; });
    }
  }, [onPress, showPayload, log, setExpanded]);

  var timestamp = new Date(log.timestamp);
  var timeString = timestamp.toLocaleTimeString();

  if (compact) {
    return (
      <Pressable onPress={handlePress} style={[styles.compactContainer, style]}>
        <Text style={[styles.compactIcon, { color: levelColor }]}>
          {levelIcon}
        </Text>
        <Text style={styles.compactTime}>{timeString}</Text>
        <Text style={styles.compactMessage} numberOfLines={1}>
          {log.message}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={[styles.container, style]}>
      <View style={[styles.levelIndicator, { backgroundColor: levelColor }]} />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.levelIcon, { color: levelColor }]}>
              {levelIcon}
            </Text>
            <Text style={styles.time}>{timeString}</Text>
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceText}>{log.source}</Text>
            </View>
          </View>
          
          {log.buildId && (
            <Text style={styles.buildId}>#{log.buildId.slice(-6)}</Text>
          )}
        </View>

        <Text style={styles.message}>
          {log.message}
        </Text>

        {log.stage && (
          <Text style={styles.stage}>Stage: {log.stage}</Text>
        )}

        {expanded && log.payload && Object.keys(log.payload).length > 0 && (
          <View style={styles.payloadContainer}>
            <Text style={styles.payloadLabel}>Payload:</Text>
            <Text style={styles.payloadText}>
              {JSON.stringify(log.payload, null, 2)}
            </Text>
          </View>
        )}

        {showPayload && log.payload && Object.keys(log.payload).length > 0 && !expanded && (
          <Text style={styles.expandHint}>Tap to expand</Text>
        )}
      </View>
    </Pressable>
  );
}

function LogEntryList(props) {
  var logs = props.logs || [];
  var compact = props.compact || false;
  var showPayload = props.showPayload !== false;
  var onLogPress = props.onLogPress;
  var emptyMessage = props.emptyMessage || "No logs";
  var style = props.style;

  if (logs.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={style}>
      {logs.map(function(log) {
        return (
          <LogEntryCard
            key={log.id}
            log={log}
            compact={compact}
            showPayload={showPayload}
            onPress={onLogPress}
          />
        );
      })}
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: COLORS.bg.surface,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs,
    overflow: "hidden"
  },
  levelIndicator: {
    width: 3
  },
  content: {
    flex: 1,
    padding: SPACING.sm
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xs
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  levelIcon: {
    fontSize: 12,
    marginRight: SPACING.xs
  },
  time: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginRight: SPACING.sm
  },
  sourceBadge: {
    backgroundColor: COLORS.bg.overlay,
    paddingVertical: 2,
    paddingHorizontal: SPACING.xs,
    borderRadius: 4
  },
  sourceText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: 10,
    textTransform: "uppercase"
  },
  buildId: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    fontSize: 10
  },
  message: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.primary
  },
  stage: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginTop: SPACING.xs
  },
  payloadContainer: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.sm
  },
  payloadLabel: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.text.muted,
    marginBottom: SPACING.xs
  },
  payloadText: {
    ...TYPOGRAPHY.code,
    color: COLORS.text.secondary,
    fontSize: 11
  },
  expandHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginTop: SPACING.xs,
    fontStyle: "italic"
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  compactIcon: {
    fontSize: 10,
    marginRight: SPACING.xs
  },
  compactTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginRight: SPACING.sm,
    fontSize: 10,
    width: 65
  },
  compactMessage: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.primary,
    flex: 1
  },
  emptyContainer: {
    alignItems: "center",
    padding: SPACING.xl
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted
  }
});

export { LogEntryCard, LogEntryList };
export default LogEntryCard;