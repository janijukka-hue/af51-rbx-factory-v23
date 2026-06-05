// s4/components/factoryui/BuildConsolePanel.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer (view binding)
// Version: 1.0.0
//
// Build status / console. Reads BuildStateUIOlio ONLY through useFactoryUI's
// snapshot selector. Never touches a raw build result.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppState } from "../../state/AppContext.js";
import { selectBuildState } from "../../hooks/useFactoryUI.js";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { ProgressBar } from "../common/ProgressBar.js";

function stateColor(state) {
  if (state === "OK") return COLORS.status.success;
  if (state === "FAIL") return COLORS.status.error;
  if (state === "BUILDING") return COLORS.primary;
  return COLORS.text.muted;
}

function BuildConsolePanel(props) {
  var state = useAppState();
  var build = selectBuildState(state);   // BuildStateUIOlio.toJSON() | null

  if (!build) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>No build yet</Text>
      </View>
    );
  }

  // label is precomputed by the olio ("OK · RBXLX_EMIT" etc.)
  var label = build.state +
    (build.currentPhase ? " · " + build.currentPhase : "") +
    (build.state === "BUILDING" ? " · " + Math.round(build.progress) + "%" : "");

  return (
    <View style={[styles.container, props.style]}>
      <View style={styles.headerRow}>
        <Text style={[styles.state, { color: stateColor(build.state) }]}>{label}</Text>
        {build.durationMs ? (
          <Text style={styles.duration}>{(build.durationMs / 1000).toFixed(1)}s</Text>
        ) : null}
      </View>

      <ProgressBar
        progress={build.progress / 100}
        color={stateColor(build.state)}
        style={styles.progress}
      />

      <View style={styles.phases}>
        {(build.phases || []).map(function (p, i) {
          var c = p.status === "FAIL" ? COLORS.status.error
                : p.status === "OK" ? COLORS.status.success
                : COLORS.text.muted;
          return (
            <Text key={i} style={[styles.phase, { color: c }]}>
              {(p.status === "OK" ? "✓ " : p.status === "FAIL" ? "✕ " : "• ") + p.name}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { backgroundColor: COLORS.bg.overlay, borderRadius: RADIUS.md, padding: SPACING.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  state: { ...TYPOGRAPHY.h4 },
  duration: { ...TYPOGRAPHY.caption, color: COLORS.text.muted },
  progress: { marginVertical: SPACING.sm },
  phases: { marginTop: SPACING.xs },
  phase: { ...TYPOGRAPHY.caption, fontFamily: "monospace", marginVertical: 1 },
  empty: { ...TYPOGRAPHY.body, color: COLORS.text.muted, textAlign: "center" },
});

export { BuildConsolePanel };
export default BuildConsolePanel;
