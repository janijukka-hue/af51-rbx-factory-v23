// ui/preview/RbxHierarchyPanel.js
// AF51-RBX v58 — Hierarchy tree. Groups structures into Workspace / UI Layer /
// ServerScriptService / Unresolved. Click selects. Never drops an object.

import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { classifyStructure, iconFor } from "./rbxPreviewUtils.js";

var GROUP_ORDER = ["workspace", "server", "ui", "unresolved"];
var GROUP_LABEL = {
  workspace: "Workspace",
  server: "ServerScriptService",
  ui: "UI Layer",
  unresolved: "Unresolved",
};

export function RbxHierarchyPanel(props) {
  var structures = props.structures || [];
  var selectedId = props.selectedId;
  var onSelect = props.onSelect || function () {};
  var routeFile = props.routeFile; // e.g. "Main.server.lua"

  // Bucket structures by group
  var groups = { workspace: [], server: [], ui: [], unresolved: [] };
  structures.forEach(function (s) {
    var g = classifyStructure(s);
    (groups[g] || groups.unresolved).push(s);
  });

  return (
    <View style={styles.panel}>
      <Text style={styles.header}>HIERARCHY</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
        {GROUP_ORDER.map(function (gkey) {
          var items = groups[gkey];
          // ServerScriptService always shows the routed script even if no structures
          var showServerScript = gkey === "server" && routeFile;
          if ((!items || items.length === 0) && !showServerScript) return null;

          return (
            <View key={gkey} style={styles.group}>
              <Text style={styles.groupLabel}>{"\u25BE " + GROUP_LABEL[gkey]}</Text>

              {showServerScript ? (
                <View style={styles.row}>
                  <Text style={styles.icon}>{"\u00A7"}</Text>
                  <Text style={styles.scriptName}>{routeFile}</Text>
                </View>
              ) : null}

              {items.map(function (s, i) {
                var isSel = s.__id === selectedId;
                return (
                  <Pressable
                    key={s.__id || i}
                    onPress={function () { onSelect(s.__id); }}
                    style={[styles.row, isSel && styles.rowSelected]}
                  >
                    <Text style={[styles.icon, isSel && styles.iconSel]}>{iconFor(s)}</Text>
                    <Text style={[styles.itemName, isSel && styles.itemNameSel]} numberOfLines={1}>
                      {s.label || s.luaClass || "Item"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        {structures.length === 0 ? (
          <Text style={styles.empty}>No objects yet</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

var mono = Platform.OS === "web" ? "ui-monospace,Menlo,monospace" : undefined;
var styles = StyleSheet.create({
  panel:      { width: 220, backgroundColor: "#0a0f17", borderRightColor: "#1d2836", borderRightWidth: 1, paddingTop: 10 },
  header:     { color: "#5a7fa0", fontSize: 10, fontWeight: "900", letterSpacing: 2, paddingHorizontal: 12, marginBottom: 8 },
  scroll:     { flex: 1 },
  group:      { marginBottom: 6 },
  groupLabel: { color: "#7a90a8", fontSize: 11, fontWeight: "700", paddingHorizontal: 12, paddingVertical: 4, fontFamily: mono },
  row:        { flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingLeft: 26, paddingRight: 10 },
  rowSelected:{ backgroundColor: "rgba(0,255,140,0.10)", borderLeftColor: "#00FF8C", borderLeftWidth: 2, paddingLeft: 24 },
  icon:       { color: "#6d8298", fontSize: 11, width: 16, fontFamily: mono },
  iconSel:    { color: "#00FF8C" },
  itemName:   { color: "#c2cedd", fontSize: 11, flex: 1, fontFamily: mono },
  itemNameSel:{ color: "#eafff4", fontWeight: "700" },
  scriptName: { color: "#9fb2c8", fontSize: 11, flex: 1, fontFamily: mono },
  empty:      { color: "#46586b", fontSize: 11, paddingHorizontal: 12, paddingVertical: 8, fontStyle: "italic" },
});

export default RbxHierarchyPanel;
