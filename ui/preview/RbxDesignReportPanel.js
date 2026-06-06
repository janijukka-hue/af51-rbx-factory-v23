// ui/preview/RbxDesignReportPanel.js
// AF51-RBX — Design Report panel (Creative Director output).
// Read-only display of the design report. Every line shows the verdict, its
// confidence, and the evidence it was derived from — and "undetermined" is
// shown honestly when the code carried no signal (never hidden, never faked).

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../../s4/theme/colors.js";
import { TYPOGRAPHY } from "../../s4/theme/typography.js";
import { SPACING, RADIUS } from "../../s4/theme/spacing.js";

function pct(c) { return Math.round((c || 0) * 100) + "%"; }

function Row(props) {
  var f = props.finding || {};
  var undetermined = !f.value || f.value === "undetermined";
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{props.label}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowValue, undetermined && styles.undetermined]}>
          {undetermined ? "undetermined" : String(f.value)}
        </Text>
        {!undetermined && f.confidence != null ? (
          <Text style={styles.conf}>{pct(f.confidence)}</Text>
        ) : null}
        {!undetermined && f.evidence && f.evidence.length ? (
          <Text style={styles.evidence} numberOfLines={2}>
            {f.evidence.join(" · ")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function RbxDesignReportPanel(props) {
  var report = props.report;
  var studio = props.studio;
  var shots = props.shots;
  var diagnostics = props.diagnostics;
  if (!report && !studio && !diagnostics) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Design Report</Text>
        <Text style={styles.empty}>Build from source to generate a design report.</Text>
      </View>
    );
  }
  return (
    <View style={[styles.container, props.style]}>
      <Text style={styles.title}>Design Report</Text>
      <Text style={styles.subtitle}>Creative Director · derived from your code</Text>
      {report ? (
        <View>
          <Row label="Gameplay type"  finding={report.gameplayType} />
          <Row label="Art direction"  finding={report.artDirection} />
          <Row label="Level design"   finding={report.levelDesign} />
          <Row label="Character art"  finding={report.characterArt} />
          <Row label="UI / UX"        finding={report.uiux} />
          <Row label="Hero object"    finding={report.cinematic} />
        </View>
      ) : null}

      {studio ? (
        <View style={styles.section}>
          <Text style={styles.subtitle}>Studio Director · production readiness</Text>
          <Row label="Readiness" finding={studio.readiness} />
          {(studio.risks || []).map(function (r, i) {
            return <Text key={"risk" + i} style={styles.risk}>⚠ {r}</Text>;
          })}
          {(studio.warnings || []).map(function (w, i) {
            return <Text key={"warn" + i} style={styles.warn}>• {w}</Text>;
          })}
          {studio.runtimeNote ? <Text style={styles.note}>{studio.runtimeNote}</Text> : null}
        </View>
      ) : null}

      {diagnostics ? (
        <View style={styles.section}>
          <Text style={styles.subtitle}>Parser Diagnostics · v65 capabilities</Text>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Direct instances</Text>
            <Text style={styles.diagValue}>{diagnostics.direct || 0}</Text>
            <Text style={styles.diagDesc}>Instance.new() calls</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Factory expansion</Text>
            <Text style={styles.diagValue}>{diagnostics.factory || 0}</Text>
            <Text style={styles.diagDesc}>makePart/makeNPC/makeTool</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>UI Overlays</Text>
            <Text style={styles.diagValue}>{diagnostics.surfaceGui || 0}</Text>
            <Text style={styles.diagDesc}>SurfaceGui/BillboardGui</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Parent resolution</Text>
            <Text style={styles.diagValue}>{diagnostics.parentResolved || 0}</Text>
            <Text style={styles.diagDesc}>Variable → object name</Text>
          </View>
        </View>
      ) : null}

      {shots && shots.shots ? (
        <View style={styles.section}>
          <Text style={styles.subtitle}>Cinematic Director · shots</Text>
          {shots.shots.map(function (s, i) {
            return (
              <Text key={"shot" + i} style={styles.shot}>
                🎬 {s.label} <Text style={styles.shotEv}>· {s.evidence}</Text>
              </Text>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

var styles = StyleSheet.create({
  container: { backgroundColor: (COLORS.bg && COLORS.bg.overlay) || "#1a1f2e", borderRadius: RADIUS.md, padding: SPACING.md },
  title: { ...TYPOGRAPHY.h4, color: (COLORS.text && COLORS.text.primary) || "#ffffff" },
  subtitle: { ...TYPOGRAPHY.caption, color: (COLORS.text && COLORS.text.muted) || "#8899aa", marginBottom: SPACING.sm },
  row: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: (COLORS.border && COLORS.border.subtle) || "#2a3a4d" },
  rowLabel: { ...TYPOGRAPHY.caption, color: (COLORS.text && COLORS.text.muted) || "#8899aa", width: 110 },
  rowBody: { flex: 1 },
  rowValue: { ...TYPOGRAPHY.body, color: (COLORS.text && COLORS.text.primary) || "#ffffff", fontWeight: "600" },
  undetermined: { color: (COLORS.text && COLORS.text.muted) || "#8899aa", fontStyle: "italic", fontWeight: "400" },
  conf: { ...TYPOGRAPHY.caption, color: COLORS.primary || "#00D9FF" },
  evidence: { ...TYPOGRAPHY.caption, color: (COLORS.text && COLORS.text.muted) || "#8899aa", fontFamily: "monospace", marginTop: 2 },
  empty: { ...TYPOGRAPHY.body, color: (COLORS.text && COLORS.text.muted) || "#8899aa", textAlign: "center", paddingVertical: SPACING.md },
  section: { marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: (COLORS.border && COLORS.border.subtle) || "#2a3a4d" },
  risk: { ...TYPOGRAPHY.caption, color: (COLORS.status && COLORS.status.error) || "#ff4444", marginVertical: 2 },
  warn: { ...TYPOGRAPHY.caption, color: (COLORS.status && COLORS.status.warning) || "#F2C94C", marginVertical: 2 },
  note: { ...TYPOGRAPHY.caption, color: (COLORS.text && COLORS.text.muted) || "#8899aa", fontStyle: "italic", marginTop: SPACING.xs },
  shot: { ...TYPOGRAPHY.caption, color: (COLORS.text && COLORS.text.primary) || "#ffffff", marginVertical: 2 },
  shotEv: { color: (COLORS.text && COLORS.text.muted) || "#8899aa" },
  diagRow: { flexDirection: "row", alignItems: "center", marginVertical: 3, paddingVertical: 2 },
  diagLabel: { ...TYPOGRAPHY.caption, color: (COLORS.text && COLORS.text.secondary) || "#8899AA", width: 120, fontSize: 10 },
  diagValue: { ...TYPOGRAPHY.caption, color: (COLORS.accent && COLORS.accent.primary) || "#00D9FF", fontWeight: "700", width: 30, textAlign: "right", fontSize: 11 },
  diagDesc: { ...TYPOGRAPHY.caption, color: (COLORS.text && COLORS.text.muted) || "#667788", marginLeft: 8, fontSize: 9, fontFamily: "monospace" },
});

export { RbxDesignReportPanel };
export default RbxDesignReportPanel;
