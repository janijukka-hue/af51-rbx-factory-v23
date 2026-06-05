// s4/components/factoryui/ArtifactStatusPanel.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer (view binding)
// Version: 1.0.0
//
// Artifact / ZIP status. Status comes from ArtifactUIOlio (via selector).
// The download button still uses whatever existing handler is passed in via
// props.onDownload — we only changed where the STATUS comes from, not the
// download mechanism.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppState } from "../../state/AppContext.js";
import { selectArtifact } from "../../hooks/useFactoryUI.js";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Badge, BADGE_VARIANT } from "../common/Badge.js";
import { Button } from "../common/Button.js";

function sizeLabel(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function Row(props) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{props.label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{props.value || "—"}</Text>
    </View>
  );
}

function ArtifactStatusPanel(props) {
  var state = useAppState();
  var art = selectArtifact(state);   // ArtifactUIOlio.toJSON() | null

  var ready = !!(art && art.zipPath);
  var verified = !!(art && art.verified);
  var statusText = !ready ? "No artifact" : (verified ? "Artifact Verified" : "ZIP Ready");
  var statusVariant = !ready ? BADGE_VARIANT.NEUTRAL
                    : verified ? BADGE_VARIANT.SUCCESS : BADGE_VARIANT.INFO;

  return (
    <View style={[styles.container, props.style]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Artifact</Text>
        <Badge variant={statusVariant} label={statusText} />
      </View>

      <Row label="Hash" value={art && art.hash} />
      <Row label="Ghost ID" value={art && art.ghostId} />
      <Row label="ZIP" value={art && art.zipPath} />
      <Row label="Size" value={art ? sizeLabel(art.sizeBytes) : "—"} />

      <Button
        title="Download ZIP"
        disabled={!ready}
        onPress={props.onDownload}        /* existing download logic, unchanged */
        style={styles.button}
      />
    </View>
  );
}

var styles = StyleSheet.create({
  container: { backgroundColor: COLORS.bg.overlay, borderRadius: RADIUS.md, padding: SPACING.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  title: { ...TYPOGRAPHY.h4, color: COLORS.text.primary },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  rowLabel: { ...TYPOGRAPHY.caption, color: COLORS.text.muted },
  rowValue: { ...TYPOGRAPHY.caption, color: COLORS.text.primary, fontFamily: "monospace", maxWidth: "65%" },
  button: { marginTop: SPACING.md },
});

export { ArtifactStatusPanel };
export default ArtifactStatusPanel;
