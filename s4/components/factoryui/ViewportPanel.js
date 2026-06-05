// s4/components/factoryui/ViewportPanel.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer (view binding)
// Version: 1.0.0
//
// Viewport. Renders ONLY SceneUIOlio nodes (via selector) using the camera
// from ViewportUIOlio. It never reads a raw SceneGraph or pipeline output.
// This is a read-only orthographic projection of node positions — a view, not
// an editor. Clicking a node selects it through the shared tree.

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAppState } from "../../state/AppContext.js";
import { useFactoryUI, selectScene, selectViewport } from "../../hooks/useFactoryUI.js";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

var VIEW_W = 300;
var VIEW_H = 200;

// Simple top-down (X-Z) orthographic projection around the camera target.
function project(pos, viewport) {
  var target = (viewport && viewport.target) || { x: 0, y: 0, z: 0 };
  var zoom = (viewport && viewport.zoom) || 50;
  var scale = VIEW_W / (zoom * 2);
  return {
    left: VIEW_W / 2 + ((pos.x - target.x) * scale),
    top:  VIEW_H / 2 + ((pos.z - target.z) * scale),
  };
}

function colorForType(type) {
  if (type === "SpawnLocation") return COLORS.status.success;
  if (type === "Part") return COLORS.primary;
  return COLORS.text.muted;
}

function ViewportPanel(props) {
  var state = useAppState();
  var factoryUI = useFactoryUI();
  var scene = selectScene(state);         // SceneUIOlio.toJSON() | null
  var viewport = selectViewport(state);   // ViewportUIOlio.toJSON() | null
  var selectedId = state.factoryUI && state.factoryUI.selection
    ? state.factoryUI.selection.currentSelection : null;

  var nodes = (scene && scene.nodes) || [];
  var placeable = nodes.filter(function (n) { return n.position; });

  return (
    <View style={[styles.container, props.style]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Viewport</Text>
        <Text style={styles.meta}>{nodes.length} nodes</Text>
      </View>

      <View style={styles.stage}>
        {placeable.length === 0 ? (
          <Text style={styles.empty}>No scene nodes</Text>
        ) : placeable.map(function (n, i) {
          var p = project(n.position, viewport);
          var isSel = n.id === selectedId;
          return (
            <Pressable
              key={n.id || i}
              onPress={function () { factoryUI.select(n.id); }}
              style={[
                styles.node,
                { left: p.left - 5, top: p.top - 5, backgroundColor: colorForType(n.type) },
                isSel && styles.nodeSelected,
              ]}
            />
          );
        })}
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.ctrl} onPress={function () { factoryUI.viewport.zoomBy(-10); }}>
          <Text style={styles.ctrlText}>＋</Text>
        </Pressable>
        <Pressable style={styles.ctrl} onPress={function () { factoryUI.viewport.zoomBy(10); }}>
          <Text style={styles.ctrlText}>－</Text>
        </Pressable>
        <Pressable style={styles.ctrl} onPress={function () { factoryUI.viewport.orbit(0.3, 0); }}>
          <Text style={styles.ctrlText}>⟳</Text>
        </Pressable>
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { backgroundColor: COLORS.bg.overlay, borderRadius: RADIUS.md, padding: SPACING.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  title: { ...TYPOGRAPHY.h4, color: COLORS.text.primary },
  meta: { ...TYPOGRAPHY.caption, color: COLORS.text.muted },
  stage: { width: VIEW_W, height: VIEW_H, backgroundColor: COLORS.bg.base, borderRadius: RADIUS.sm,
           borderWidth: 1, borderColor: COLORS.border.subtle, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  node: { position: "absolute", width: 10, height: 10, borderRadius: 2 },
  nodeSelected: { borderWidth: 2, borderColor: COLORS.text.primary, width: 12, height: 12 },
  empty: { ...TYPOGRAPHY.caption, color: COLORS.text.muted },
  controls: { flexDirection: "row", marginTop: SPACING.sm },
  ctrl: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bg.base,
          alignItems: "center", justifyContent: "center", marginRight: SPACING.sm },
  ctrlText: { ...TYPOGRAPHY.body, color: COLORS.text.primary },
});

export { ViewportPanel };
export default ViewportPanel;
