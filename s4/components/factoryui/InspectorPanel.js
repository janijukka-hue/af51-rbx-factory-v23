// s4/components/factoryui/InspectorPanel.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer (view binding)
// Version: 1.0.0
//
// Inspector. Reads InspectorUIOlio (via selector). It does NOT own a selected
// state — the selection lives in the FactoryUIOlio tree (set by HierarchyPanel
// via select(id)); the inspector slice is re-derived from it.

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useAppState } from "../../state/AppContext.js";
import { selectInspector } from "../../hooks/useFactoryUI.js";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

// Build the same property rows the InspectorUIOlio.rows() would, from the
// inspector snapshot's selectedObject (snapshot carries data, not methods).
function rowsFor(obj) {
  if (!obj) return [];
  var rows = [];
  if (obj.name) rows.push({ key: "Name", value: obj.name });
  if (obj.type) rows.push({ key: "Type", value: obj.type });
  if (obj.material) rows.push({ key: "Material", value: obj.material });
  if (obj.position) {
    rows.push({ key: "Position", value: "(" + [obj.position.x, obj.position.y, obj.position.z].join(", ") + ")" });
  }
  if (obj.tags && obj.tags.length) rows.push({ key: "Tags", value: obj.tags.join(", ") });
  return rows;
}

function InspectorPanel(props) {
  var state = useAppState();
  var inspector = selectInspector(state);   // { selectedId, selectedObject } | null
  var obj = inspector && inspector.selectedObject;

  return (
    <View style={[styles.container, props.style]}>
      <Text style={styles.title}>Inspector</Text>
      {!obj ? (
        <Text style={styles.empty}>Nothing selected</Text>
      ) : (
        <ScrollView>
          {rowsFor(obj).map(function (r, i) {
            return (
              <View key={i} style={styles.row}>
                <Text style={styles.rowKey}>{r.key}</Text>
                <Text style={styles.rowVal} numberOfLines={2}>{r.value}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

var styles = StyleSheet.create({
  container: { backgroundColor: COLORS.bg.overlay, borderRadius: RADIUS.md, padding: SPACING.md },
  title: { ...TYPOGRAPHY.h4, color: COLORS.text.primary, marginBottom: SPACING.sm },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border.subtle },
  rowKey: { ...TYPOGRAPHY.caption, color: COLORS.text.muted },
  rowVal: { ...TYPOGRAPHY.caption, color: COLORS.text.primary, fontFamily: "monospace", maxWidth: "65%" },
  empty: { ...TYPOGRAPHY.body, color: COLORS.text.muted, textAlign: "center", paddingVertical: SPACING.md },
});

export { InspectorPanel };
export default InspectorPanel;
