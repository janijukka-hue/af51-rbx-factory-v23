// ui/preview/RbxInspectorPanel.js
// AF51-RBX v58 — Object inspector. Shows selected structure fields.
// Never throws on missing data — falls back to "unknown".

import React from "react";
import { View, Text, ScrollView, StyleSheet, Platform } from "react-native";
import { classifyStructure, fmtTriple, fmtColor, fmtVal } from "./rbxPreviewUtils.js";

var GROUP_LABEL = { workspace: "Workspace", server: "ServerScriptService", ui: "UI Layer", unresolved: "Unresolved" };

function Field(props) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldKey}>{props.k}</Text>
      <Text style={styles.fieldVal} numberOfLines={2}>{props.v}</Text>
    </View>
  );
}

export function RbxInspectorPanel(props) {
  var s = props.selected;

  if (!s) {
    return (
      <View style={styles.panel}>
        <Text style={styles.header}>INSPECTOR</Text>
        <Text style={styles.placeholder}>Select an object from Hierarchy</Text>
      </View>
    );
  }

  var group = classifyStructure(s);
  var isUI = group === "ui";
  var runtimeNote = isUI
    ? "Renders in PlayerGui during Roblox Studio Play"
    : "Static structure — runtime behavior runs in Roblox Studio";

  return (
    <View style={styles.panel}>
      <Text style={styles.header}>INSPECTOR</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 10 }}>
        <View style={styles.swatchRow}>
          <View style={[styles.swatch, { backgroundColor: (typeof s.color === "string" ? s.color : "#4488CC") }]} />
          <Text style={styles.objName}>{fmtVal(s.label, s.luaClass || "Object")}</Text>
        </View>

        <Field k="Class" v={fmtVal(s.luaClass, s.type)} />
        <Field k="Parent" v={fmtVal(s.parent, "workspace")} />
        {!isUI ? <Field k="Position" v={fmtTriple(s.x, s.y, s.z)} /> : null}
        {!isUI ? <Field k="Size" v={fmtTriple(s.w, s.h, s.d)} /> : null}
        <Field k="Color" v={fmtColor(s.color)} />
        {!isUI ? <Field k="Material" v={fmtVal(s.material)} /> : null}
        {!isUI ? <Field k="Shape" v={fmtVal(s.shape)} /> : null}
        {!isUI ? <Field k="Anchored" v={fmtVal(s.anchored)} /> : null}
        <Field k="Glow" v={fmtVal(s.glow)} />
        <Field k="Group" v={GROUP_LABEL[group] || group} />

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{runtimeNote}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

var mono = Platform.OS === "web" ? "ui-monospace,Menlo,monospace" : undefined;
var styles = StyleSheet.create({
  panel:       { width: 230, backgroundColor: "#0a0f17", borderLeftColor: "#1d2836", borderLeftWidth: 1, paddingTop: 10 },
  header:      { color: "#5a7fa0", fontSize: 10, fontWeight: "900", letterSpacing: 2, paddingHorizontal: 12, marginBottom: 10 },
  scroll:      { flex: 1 },
  placeholder: { color: "#46586b", fontSize: 11, paddingHorizontal: 12, fontStyle: "italic" },
  swatchRow:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, marginBottom: 12 },
  swatch:      { width: 22, height: 22, borderRadius: 5, marginRight: 10, borderColor: "#2a3a4d", borderWidth: 1 },
  objName:     { color: "#eafff4", fontSize: 13, fontWeight: "800", flex: 1, fontFamily: mono },
  field:       { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 4 },
  fieldKey:    { color: "#6d8298", fontSize: 11, width: 78, fontFamily: mono },
  fieldVal:    { color: "#c2cedd", fontSize: 11, flex: 1, fontFamily: mono },
  noteBox:     { marginTop: 12, marginHorizontal: 12, padding: 8, backgroundColor: "rgba(0,180,255,0.06)", borderColor: "#1d3a4d", borderWidth: 1, borderRadius: 6 },
  noteText:    { color: "#5e92b5", fontSize: 9, lineHeight: 14, fontStyle: "italic" },
});

export default RbxInspectorPanel;
