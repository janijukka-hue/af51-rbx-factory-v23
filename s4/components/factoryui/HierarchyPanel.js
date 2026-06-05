// s4/components/factoryui/HierarchyPanel.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer (view binding)
// Version: 1.0.0
//
// Explorer tree. Reads HierarchyUIOlio (via selector). Clicking a node calls
// select(id) from useFactoryUI — selection flows through the FactoryUIOlio
// tree, which drives the inspector. No local selection state here.

import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useAppState } from "../../state/AppContext.js";
import { useFactoryUI, selectHierarchy } from "../../hooks/useFactoryUI.js";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING } from "../../theme/spacing.js";

function TreeNode(props) {
  var node = props.node;
  var depth = props.depth || 0;
  var selectedId = props.selectedId;
  var onSelect = props.onSelect;
  var isSelected = node.id === selectedId;
  var hasChildren = node.children && node.children.length > 0;

  return (
    <View>
      <Pressable
        onPress={function () { onSelect(node.id); }}
        style={[styles.nodeRow, isSelected && styles.nodeRowSelected, { paddingLeft: SPACING.sm + depth * 16 }]}
      >
        <Text style={styles.nodeIcon}>{hasChildren ? "▸" : "•"}</Text>
        <Text style={[styles.nodeName, isSelected && styles.nodeNameSelected]} numberOfLines={1}>
          {node.name}
        </Text>
        <Text style={styles.nodeType}>{node.type}</Text>
      </Pressable>
      {hasChildren && node.children.map(function (child, i) {
        return (
          <TreeNode key={child.id || i} node={child} depth={depth + 1}
            selectedId={selectedId} onSelect={onSelect} />
        );
      })}
    </View>
  );
}

function HierarchyPanel(props) {
  var state = useAppState();
  var factoryUI = useFactoryUI();
  var hierarchy = selectHierarchy(state);                 // HierarchyUIOlio.toJSON()
  var selectedId = state.factoryUI && state.factoryUI.selection
    ? state.factoryUI.selection.currentSelection : null;

  var roots = (hierarchy && hierarchy.roots) || [];

  return (
    <View style={[styles.container, props.style]}>
      <Text style={styles.title}>Hierarchy</Text>
      <ScrollView style={styles.scroll}>
        {roots.length === 0 ? (
          <Text style={styles.empty}>No scene</Text>
        ) : roots.map(function (node, i) {
          return (
            <TreeNode key={node.id || i} node={node} depth={0}
              selectedId={selectedId}
              onSelect={factoryUI.select} />   /* select(id) from the hook */
          );
        })}
      </ScrollView>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { backgroundColor: COLORS.bg.overlay, borderRadius: 8, padding: SPACING.sm },
  title: { ...TYPOGRAPHY.h4, color: COLORS.text.primary, marginBottom: SPACING.xs, paddingHorizontal: SPACING.xs },
  scroll: { maxHeight: 320 },
  nodeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingRight: SPACING.sm, borderRadius: 4 },
  nodeRowSelected: { backgroundColor: COLORS.primaryLight },
  nodeIcon: { ...TYPOGRAPHY.caption, color: COLORS.text.muted, width: 14 },
  nodeName: { ...TYPOGRAPHY.caption, color: COLORS.text.primary, flex: 1 },
  nodeNameSelected: { color: COLORS.primary, fontWeight: "600" },
  nodeType: { ...TYPOGRAPHY.caption, color: COLORS.text.muted, marginLeft: SPACING.xs },
  empty: { ...TYPOGRAPHY.caption, color: COLORS.text.muted, padding: SPACING.sm },
});

export { HierarchyPanel };
export default HierarchyPanel;
