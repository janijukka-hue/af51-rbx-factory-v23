// s4/components/factoryui/RingStatusPanel.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer (view binding)
// Version: 1.0.0
//
// Ring status. Reads RingStatusUIOlio (via selector), whose data originates
// from the existing RingRuntime snapshot. No new ring state in React.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppState } from "../../state/AppContext.js";
import { selectRings } from "../../hooks/useFactoryUI.js";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

var RING_ORDER = [
  { id: "world",   label: "World" },
  { id: "energy",  label: "Energy" },
  { id: "memory",  label: "Memory" },
  { id: "intent",  label: "Intent" },
  { id: "factory", label: "Factory" },
  { id: "ghost",   label: "Ghost" },
  { id: "core",    label: "Core" },
];

function dotColor(status) {
  if (status === "active") return COLORS.primary;
  if (status === "done" || status === "ok") return COLORS.status.success;
  if (status === "error" || status === "fail") return COLORS.status.error;
  return COLORS.text.muted; // idle / unknown
}

function RingStatusPanel(props) {
  var state = useAppState();
  var rings = selectRings(state);   // RingStatusUIOlio.toJSON() | null

  return (
    <View style={[styles.container, props.style]}>
      <Text style={styles.title}>Rings</Text>
      <View style={styles.grid}>
        {RING_ORDER.map(function (r) {
          var status = (rings && rings[r.id]) || "idle";
          return (
            <View key={r.id} style={styles.ring}>
              <View style={[styles.dot, { backgroundColor: dotColor(status) }]} />
              <Text style={styles.ringLabel}>{r.label}</Text>
              <Text style={styles.ringStatus}>{status}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { backgroundColor: COLORS.bg.overlay, borderRadius: RADIUS.md, padding: SPACING.md },
  title: { ...TYPOGRAPHY.h4, color: COLORS.text.primary, marginBottom: SPACING.sm },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  ring: { width: "33%", flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  ringLabel: { ...TYPOGRAPHY.caption, color: COLORS.text.primary, marginRight: 4 },
  ringStatus: { ...TYPOGRAPHY.caption, color: COLORS.text.muted },
});

export { RingStatusPanel };
export default RingStatusPanel;
