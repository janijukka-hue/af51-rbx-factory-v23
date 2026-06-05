// s4/screens/LogStream/LogStreamScreen.js
// ALX Factory - Log Stream Screen
// Version: 2.0.0 - Enhanced with filtering, search, and export

import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "../../components/common/Button.js";
import { Badge, BADGE_VARIANT } from "../../components/common/Badge.js";
import { StatusIndicator, STATUS } from "../../components/common/StatusIndicator.js";
import { LogFilter } from "../../components/logs/LogFilter.js";
import { LogSearch } from "../../components/logs/LogSearch.js";
import { LogEntryCard } from "../../components/logs/LogEntryCard.js";
import { useLogStream } from "../../hooks/useLogStream.js";

function LogStreamScreen(props) {
  var orchestrator = props.orchestrator;

  var logStream = useLogStream(orchestrator, { limit: 200 });

  var autoScrollState = useState(true);
  var autoScroll = autoScrollState[0];
  var setAutoScroll = autoScrollState[1];

  var showFiltersState = useState(false);
  var showFilters = showFiltersState[0];
  var setShowFilters = showFiltersState[1];

  var compactModeState = useState(false);
  var compactMode = compactModeState[0];
  var setCompactMode = compactModeState[1];

  var scrollViewRef = useRef(null);

  var handleSearchChange = useCallback(function(text) {
    logStream.setFilter("search", text);
  }, [logStream]);

  var handleFilterChange = useCallback(function(key, value) {
    logStream.setFilter(key, value);
  }, [logStream]);

  var handleExport = useCallback(async function() {
    var exportedLogs = logStream.exportLogs();

    if (Platform.OS === "web") {
      
      return;
    }

    try {
      await Share.share({
        message: exportedLogs,
        title: "ALX Factory Logs"
      });
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [logStream]);

  var scrollToBottom = useCallback(function() {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, []);

  var handleScroll = useCallback(function(event) {
    var contentOffset = event.nativeEvent.contentOffset;
    var contentSize = event.nativeEvent.contentSize;
    var layoutMeasurement = event.nativeEvent.layoutMeasurement;

    var isAtBottom = contentOffset.y >= contentSize.height - layoutMeasurement.height - 50;

    if (autoScroll && !isAtBottom) {
      setAutoScroll(false);
    }
  }, [autoScroll, setAutoScroll]);

  var hasActiveFilters = logStream.filters.level || 
                         logStream.filters.source || 
                         logStream.filters.search;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Log Stream</Text>
          <StatusIndicator
            status={logStream.connected ? STATUS.SUCCESS : STATUS.OFFLINE}
            label={logStream.connected ? "Live" : "Offline"}
            pulse={logStream.connected && !logStream.paused}
            size="sm"
          />
        </View>
        <View style={styles.headerRight}>
          <Badge
            variant={BADGE_VARIANT.DEFAULT}
            label={logStream.logs.length + " logs"}
            size="sm"
          />
        </View>
      </View>

      <View style={styles.searchRow}>
        <LogSearch
          value={logStream.filters.search}
          onChangeText={handleSearchChange}
          style={styles.searchInput}
        />
        <Pressable
          onPress={function() { setShowFilters(!showFilters); }}
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
        >
          <Text style={styles.filterToggleIcon}>⚙</Text>
          {hasActiveFilters && <View style={styles.filterDot} />}
        </Pressable>
      </View>

      {showFilters && (
        <View style={styles.filtersContainer}>
          <LogFilter
            filters={logStream.filters}
            onFilterChange={handleFilterChange}
            onClearFilters={logStream.clearFilters}
            stats={logStream.stats}
            compact
          />
        </View>
      )}

      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <Pressable
            onPress={logStream.togglePause}
            style={styles.toolbarButton}
          >
            <Text style={styles.toolbarButtonIcon}>
              {logStream.paused ? "▶" : "⏸"}
            </Text>
            <Text style={styles.toolbarButtonText}>
              {logStream.paused ? "Resume" : "Pause"}
            </Text>
          </Pressable>

          <Pressable
            onPress={function() { setAutoScroll(!autoScroll); }}
            style={[styles.toolbarButton, autoScroll && styles.toolbarButtonActive]}
          >
            <Text style={styles.toolbarButtonIcon}>↓</Text>
            <Text style={[
              styles.toolbarButtonText,
              autoScroll && styles.toolbarButtonTextActive
            ]}>
              Auto-scroll
            </Text>
          </Pressable>

          <Pressable
            onPress={function() { setCompactMode(!compactMode); }}
            style={[styles.toolbarButton, compactMode && styles.toolbarButtonActive]}
          >
            <Text style={styles.toolbarButtonIcon}>☰</Text>
            <Text style={[
              styles.toolbarButtonText,
              compactMode && styles.toolbarButtonTextActive
            ]}>
              Compact
            </Text>
          </Pressable>
        </View>

        <View style={styles.toolbarRight}>
          <Button
            variant={BUTTON_VARIANT.GHOST}
            size={BUTTON_SIZE.SM}
            onPress={handleExport}
          >
            Export
          </Button>
          <Button
            variant={BUTTON_VARIANT.GHOST}
            size={BUTTON_SIZE.SM}
            onPress={logStream.clearLogs}
          >
            Clear
          </Button>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.logContainer}
        contentContainerStyle={styles.logContent}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        onContentSizeChange={function() {
          if (autoScroll) {
            scrollToBottom();
          }
        }}
      >
        {logStream.logs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No logs</Text>
            <Text style={styles.emptyHint}>
              {hasActiveFilters
                ? "No logs match the current filters"
                : "Events will appear here as they happen"}
            </Text>
            {hasActiveFilters && (
              <Button
                variant={BUTTON_VARIANT.OUTLINE}
                size={BUTTON_SIZE.SM}
                onPress={logStream.clearFilters}
                style={styles.emptyButton}
              >
                Clear Filters
              </Button>
            )}
          </View>
        ) : (
          logStream.logs.map(function(log) {
            return (
              <LogEntryCard
                key={log.id}
                log={log}
                compact={compactMode}
                showPayload={!compactMode}
              />
            );
          })
        )}
      </ScrollView>

      {!autoScroll && logStream.logs.length > 0 && (
        <Pressable
          onPress={function() {
            setAutoScroll(true);
            scrollToBottom();
          }}
          style={styles.scrollToBottomButton}
        >
          <Text style={styles.scrollToBottomText}>↓ Scroll to bottom</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg.base
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    marginRight: SPACING.md
  },
  headerRight: {},
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  searchInput: {
    flex: 1,
    marginRight: SPACING.sm
  },
  filterToggle: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg.overlay,
    position: "relative"
  },
  filterToggleActive: {
    backgroundColor: COLORS.primaryLight
  },
  filterToggleIcon: {
    fontSize: 18,
    color: COLORS.text.secondary
  },
  filterDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary
  },
  filtersContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle,
    backgroundColor: COLORS.bg.surface
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  toolbarLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  toolbarRight: {
    flexDirection: "row",
    alignItems: "center"
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginRight: SPACING.xs,
    borderRadius: RADIUS.sm
  },
  toolbarButtonActive: {
    backgroundColor: COLORS.primaryLight
  },
  toolbarButtonIcon: {
    fontSize: 12,
    marginRight: 4,
    color: COLORS.text.muted
  },
  toolbarButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  toolbarButtonTextActive: {
    color: COLORS.primary
  },
  logContainer: {
    flex: 1
  },
  logContent: {
    padding: SPACING.sm
  },
  emptyContainer: {
    alignItems: "center",
    padding: SPACING.xxl
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md
  },
  emptyText: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs
  },
  emptyHint: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.muted,
    textAlign: "center"
  },
  emptyButton: {
    marginTop: SPACING.md
  },
  scrollToBottomButton: {
    position: "absolute",
    bottom: SPACING.lg,
    alignSelf: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.round,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  scrollToBottomText: {
    ...TYPOGRAPHY.buttonSmall,
    color: COLORS.white
  }
});

export { LogStreamScreen };
export default LogStreamScreen;