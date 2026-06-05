// ui/components/RightPanel/LogsTab.js
// React Native

import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, SIZES, FONTS } from "../../styles/theme.js";

const levelColors = {
  DEBUG: COLORS.gray500,
  INFO: COLORS.lime,
  WARN: COLORS.warning,
  ERROR: COLORS.error
};

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function LogsTab({ logs, onClear }) {
  const [filter, setFilter] = useState("ALL");
  
  const filteredLogs = filter === "ALL" ? logs : logs.filter((log) => log.level === filter);
  
  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.filters}>
          {["ALL", "INFO", "WARN", "ERROR"].map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.filterButton, filter === level && styles.filterActive]}
              onPress={() => setFilter(level)}
            >
              <Text style={[styles.filterText, filter === level && styles.filterTextActive]}>
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.clearButton} onPress={onClear}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.logs}>
        {filteredLogs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No logs</Text>
          </View>
        ) : (
          filteredLogs.map((log) => (
            <View key={log.id} style={styles.logEntry}>
              <Text style={styles.timestamp}>{formatTime(log.timestamp)}</Text>
              <Text style={[styles.level, { color: levelColors[log.level] }]}>{log.level}</Text>
              <Text style={styles.message} numberOfLines={2}>{log.message}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray700,
    backgroundColor: COLORS.blackMatte
  },
  filters: {
    flexDirection: "row",
    gap: SIZES.xs
  },
  filterButton: {
    paddingVertical: SIZES.xs,
    paddingHorizontal: SIZES.sm,
    borderRadius: SIZES.borderRadius
  },
  filterActive: {
    backgroundColor: COLORS.gray700
  },
  filterText: {
    color: COLORS.gray400,
    fontSize: 11
  },
  filterTextActive: {
    color: COLORS.gray200
  },
  clearButton: {
    paddingVertical: SIZES.xs,
    paddingHorizontal: SIZES.sm,
    backgroundColor: COLORS.gray700,
    borderRadius: SIZES.borderRadius
  },
  clearText: {
    color: COLORS.gray300,
    fontSize: 11
  },
  logs: {
    flex: 1,
    padding: SIZES.sm
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 50
  },
  emptyText: {
    color: COLORS.gray500,
    fontSize: 13
  },
  logEntry: {
    flexDirection: "row",
    gap: SIZES.sm,
    paddingVertical: SIZES.xs,
    paddingHorizontal: SIZES.sm,
    marginBottom: 2
  },
  timestamp: {
    color: COLORS.gray500,
    fontSize: 10,
    fontFamily: FONTS.mono,
    width: 60
  },
  level: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: FONTS.mono,
    width: 40
  },
  message: {
    flex: 1,
    color: COLORS.gray200,
    fontSize: 11,
    fontFamily: FONTS.mono
  }
});

export default LogsTab;