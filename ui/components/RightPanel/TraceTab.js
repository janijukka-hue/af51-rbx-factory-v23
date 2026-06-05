// ui/components/RightPanel/TraceTab.js
// React Native

import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { COLORS, SIZES, FONTS } from "../../styles/theme.js";

const eventColors = {
  BOOT: COLORS.lime,
  SHUTDOWN: COLORS.gray400,
  STARTED: COLORS.info,
  COMPLETED: COLORS.lime,
  FAILED: COLORS.error,
  ERROR: COLORS.error
};

function getEventColor(type) {
  for (const [key, color] of Object.entries(eventColors)) {
    if (type.includes(key)) return color;
  }
  return COLORS.gray400;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function TraceTab({ trace }) {
  if (!trace || trace.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No trace events yet</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      {trace.map((event) => {
        const color = getEventColor(event.type);
        return (
          <View key={event.id} style={[styles.event, { borderLeftColor: color }]}>
            <View style={styles.timeline}>
              <Text style={styles.time}>{formatTime(event.timestamp)}</Text>
            </View>
            
            <View style={styles.content}>
              <Text style={[styles.type, { color }]}>{event.type}</Text>
              
              {event.payload?.traceId && (
                <Text style={styles.detail} numberOfLines={1}>
                  Trace: {event.payload.traceId}
                </Text>
              )}
              
              {event.payload?.phase && (
                <Text style={styles.detail}>
                  Phase: {event.payload.phase}
                </Text>
              )}
              
              {event.hash && (
                <Text style={styles.hash} numberOfLines={1}>{event.hash}</Text>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SIZES.md
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyText: {
    color: COLORS.gray500,
    fontSize: 13
  },
  event: {
    flexDirection: "row",
    gap: SIZES.md,
    marginBottom: SIZES.sm,
    padding: SIZES.sm,
    backgroundColor: COLORS.blackLight,
    borderRadius: SIZES.borderRadius,
    borderLeftWidth: 3
  },
  timeline: {
    width: 50
  },
  time: {
    fontSize: 10,
    color: COLORS.gray500,
    fontFamily: FONTS.mono
  },
  content: {
    flex: 1
  },
  type: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2
  },
  detail: {
    fontSize: 11,
    color: COLORS.gray400,
    marginTop: 2
  },
  hash: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    color: COLORS.gray600,
    marginTop: SIZES.xs
  }
});

export default TraceTab;