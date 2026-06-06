// s4/screens/Cockpit/RbxProductionCockpit.js
// AF51-RBX — Production Cockpit (fullscreen).
//
// The cockpit is the primary experience: write Lua → RUN → see the whole
// product live. ZIP export is the LAST step, not the goal. Layout:
//   left:   scene graph / hierarchy
//   center: video preview engine (animated camera)
//   right:  Director reports (Preview / Creative / Studio / Cinematic)
//   bottom: build pipeline + Export ZIP
//
// RUN routes Lua source to /rbx/lua-build (the production line). The cockpit
// only reads the response — it never generates or alters the product.

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform } from "react-native";
import RbxPreviewCanvas from "../../../ui/preview/RbxPreviewCanvas.js";
import RbxRealPreviewEngine from "../../../ui/preview/RbxRealPreviewEngine.js";
import RbxHierarchyPanel from "../../../ui/preview/RbxHierarchyPanel.js";
import RbxDesignReportPanel from "../../../ui/preview/RbxDesignReportPanel.js";
import { structuresFromPreviewData, normalizeStructures } from "../../../ui/preview/rbxPreviewUtils.js";
import { useAppState, useAppActions } from "../../state/AppContext.js";
import { normalizeLuaBuild, failedBuild } from "../../state/latestBuild.js";

var SERVER = "http://localhost:3000";

function looksLikeRawLua(text) {
  var s = String(text || "");
  var signals = ["Instance.new", "Vector3.new", "CFrame.new", "game.", "workspace",
                 "script.Parent", "Enum.", "UDim2.new", "Color3."];
  for (var i = 0; i < signals.length; i++) if (s.indexOf(signals[i]) !== -1) return true;
  var kw = (s.match(/\b(local|function|end|then|return)\b/g) || []).length;
  return kw >= 2 && s.split(/\n/).length >= 2;
}

var STAGES = ["Parse", "Build", "Analyze", "Preview", "Export"];

function RbxProductionCockpit(props) {
  var appState = useAppState();
  var actions = useAppActions();
  var data = appState.latestBuild;   // shared: a build from Builder OR Cockpit

  var inputState = useState(""); var input = inputState[0]; var setInput = inputState[1];
  var busyState = useState(false); var busy = busyState[0]; var setBusy = busyState[1];
  var selState = useState(null); var selectedId = selState[0]; var setSelectedId = selState[1];
  var stageState = useState(-1); var stage = stageState[0]; var setStage = stageState[1];
  // Premium preview = real 3D engine by default; 2D canvas is the fallback.
  var view3dState = useState(true); var view3d = view3dState[0]; var setView3d = view3dState[1];

  var run = useCallback(async function () {
    if (!input.trim() || busy) return;
    setBusy(true); setStage(0);
    try {
      if (!looksLikeRawLua(input)) {
        actions.setLatestBuild(failedBuild(input, "Cockpit builds from Roblox Lua source. Paste code that creates instances."));
        setBusy(false); setStage(-1); return;
      }
      setStage(1); // Build
      var res = await fetch(SERVER + "/rbx/lua-build", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: input }),
      });
      var json = await res.json();
      setStage(2); // Analyze
      if (!json.ok) {
        actions.setLatestBuild(failedBuild(input, json.error || "Build failed"));
        setBusy(false); setStage(-1); return;
      }
      setStage(3); // Preview
      actions.setLatestBuild(normalizeLuaBuild(input, json));  // shared → Builder sees it too
      setBusy(false);
    } catch (e) {
      var hint = (e.message || "").includes("Failed to fetch")
        ? "\nServer not reachable at " + SERVER + " — run: npm run server" : "";
      actions.setLatestBuild(failedBuild(input, (e.message || String(e)) + hint));
      setBusy(false); setStage(-1);
    }
  }, [input, busy, actions]);

  var err = data && data.status === "failed" ? (data.errors || [])[0] : null;
  var preview = data && data.status === "ok" ? data.previewData : null;
  var structures = preview ? normalizeStructures(structuresFromPreviewData(preview)) : [];
  var selected = null;
  for (var i = 0; i < structures.length; i++) if (structures[i].__id === selectedId) selected = structures[i];

  var downloadProject = useCallback(function() {
    if (Platform.OS === 'web') {
      window.open(SERVER + '/download-project', '_blank');
    }
  }, []);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>AF51 · RBX PRODUCTION COCKPIT</Text>
          <Text style={styles.brandSub}>Lua → Build → Analyze → Live Preview → Export</Text>
        </View>
        <Pressable style={styles.downloadBtn} onPress={downloadProject}>
          <Text style={styles.downloadBtnText}>⬇ DOWNLOAD PROJECT ZIP</Text>
        </Pressable>
      </View>

      {/* Body: 3 columns */}
      <View style={styles.body}>
        {/* LEFT — scene graph / hierarchy */}
        <View style={styles.left}>
          <Text style={styles.colTitle}>Scene Graph</Text>
          {preview ? (
            <RbxHierarchyPanel
              structures={structures}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <Text style={styles.empty}>Run a build to populate the hierarchy.</Text>
          )}
        </View>

        {/* CENTER — video preview engine + input */}
        <View style={styles.center}>
          <View style={styles.previewWrap}>
            {preview ? (
              view3d ? (
                <RbxRealPreviewEngine
                  buildId={data.buildId || ""}
                  previewData={preview}
                  selectedId={selectedId}
                  label="RBX 3D PREVIEW"
                />
              ) : (
                <RbxPreviewCanvas
                  targetId="source"
                  buildId={data.buildId || ""}
                  previewData={preview}
                  qualityReport={null}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )
            ) : (
              <View style={styles.previewEmpty}>
                <Text style={styles.previewEmptyText}>
                  {busy ? "Building…" : "Live preview appears here after RUN"}
                </Text>
              </View>
            )}
            {preview ? (
              <View style={styles.viewToggle}>
                <Pressable onPress={function () { setView3d(true); }} style={[styles.toggleBtn, view3d && styles.toggleBtnOn]}>
                  <Text style={[styles.toggleTxt, view3d && styles.toggleTxtOn]}>3D</Text>
                </Pressable>
                <Pressable onPress={function () { setView3d(false); }} style={[styles.toggleBtn, !view3d && styles.toggleBtnOn]}>
                  <Text style={[styles.toggleTxt, !view3d && styles.toggleTxtOn]}>2D</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Build input + RUN (RUN = preview, not ZIP) */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Paste Roblox Lua source…  (RUN builds a live preview)"
              placeholderTextColor="#56697d"
              multiline
            />
            <Pressable style={[styles.runBtn, busy && styles.runBtnBusy]} onPress={run} disabled={busy}>
              <Text style={styles.runBtnText}>{busy ? "…" : "RUN"}</Text>
            </Pressable>
          </View>
          {err ? <Text style={styles.error}>{err}</Text> : null}
        </View>

        {/* RIGHT — Director reports */}
        <View style={styles.right}>
          <ScrollView>
            {data ? (
              <RbxDesignReportPanel
                report={data.design}
                studio={data.studio}
                shots={data.shots}
                diagnostics={data.diagnostics}
                skillsRing={data.skillsRing}
              />
            ) : (
              <Text style={styles.empty}>Director reports appear after analysis.</Text>
            )}
            {data && data.enriched ? (
              <View style={styles.techCard}>
                <Text style={styles.techTitle}>Preview Director · technical</Text>
                <Text style={styles.techRow}>Performance: {data.enriched.performance.mobile} ({data.enriched.performance.drawCallEstimate} draws)</Text>
                <Text style={styles.techRow}>Parts: {data.enriched.performance.parts} · Meshes: {data.enriched.performance.meshes} · Lights: {data.enriched.performance.lights}</Text>
                <Text style={styles.techRow}>Characters: {data.enriched.characters.rigs.length} rig(s)</Text>
                <Text style={styles.techRow}>Materials: {Object.keys(data.enriched.materials.counts).join(", ") || "—"}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>

      {/* BOTTOM — build pipeline + export */}
      <View style={styles.bottom}>
        <View style={styles.pipeline}>
          {STAGES.map(function (s, i) {
            var done = stage > i || (data && i <= 3);
            var active = stage === i;
            return (
              <View key={s} style={styles.stageWrap}>
                <View style={[styles.stageDot, done && styles.stageDotDone, active && styles.stageDotActive]} />
                <Text style={[styles.stageLabel, done && styles.stageLabelDone]}>{s}</Text>
                {i < STAGES.length - 1 ? <View style={styles.stageBar} /> : null}
              </View>
            );
          })}
        </View>
        <Pressable
          style={[styles.exportBtn, !(data && data.status === "ok") && styles.exportBtnDisabled]}
          disabled={!(data && data.status === "ok")}
          onPress={function () {
            if (data && data.status === "ok") {
              var url = data.downloadUrl ? (SERVER + data.downloadUrl) : null;
              if (url && Platform.OS === "web" && typeof window !== "undefined") {
                window.open(url, "_blank");
              }
              if (props.onExport) props.onExport(data);
            }
          }}
        >
          <Text style={styles.exportBtnText}>
            {data && data.status === "ok" ? "⬇ Export ZIP" : "Export ZIP (build first)"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05080a" },
  header: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(142,255,102,0.18)", flexDirection: "row", alignItems: "center" },
  brand: { color: "#8EFF66", fontSize: 13, fontWeight: "800", letterSpacing: 1.5 },
  brandSub: { color: "#56697d", fontSize: 10, letterSpacing: 1, marginTop: 2 },
  downloadBtn: { backgroundColor: "#1a2736", borderRadius: 6, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "#2a3a4d" },
  downloadBtnText: { color: "#8EFF66", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  body: { flex: 1, flexDirection: "row" },
  left: { width: 240, borderRightWidth: 1, borderRightColor: "#16202b", padding: 10 },
  center: { flex: 1, padding: 10 },
  right: { width: 320, borderLeftWidth: 1, borderLeftColor: "#16202b", padding: 10 },
  colTitle: { color: "#9fb2c8", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  previewWrap: { flex: 1, borderRadius: 8, overflow: "hidden", backgroundColor: "#0a1018", minHeight: 280, position: "relative" },
  viewToggle: { position: "absolute", bottom: 10, left: 10, flexDirection: "row", backgroundColor: "rgba(8,12,18,0.85)", borderRadius: 6, padding: 2 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 4 },
  toggleBtnOn: { backgroundColor: "#8EFF66" },
  toggleTxt: { color: "#9fb2c8", fontSize: 11, fontWeight: "700" },
  toggleTxtOn: { color: "#05080a" },
  previewEmpty: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 280 },
  previewEmptyText: { color: "#56697d", fontSize: 13 },
  inputRow: { flexDirection: "row", marginTop: 10, alignItems: "flex-end" },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: "#0c1320", color: "#cfe0f0",
           borderRadius: 8, borderWidth: 1, borderColor: "#1f2d3d", paddingHorizontal: 12, paddingVertical: 8,
           fontFamily: Platform.OS === "web" ? "monospace" : undefined, fontSize: 12 },
  runBtn: { marginLeft: 8, backgroundColor: "#8EFF66", borderRadius: 8, paddingHorizontal: 22, paddingVertical: 12 },
  runBtnBusy: { backgroundColor: "#3a5a2a" },
  runBtnText: { color: "#05080a", fontWeight: "800", fontSize: 14 },
  error: { color: "#FF6B6B", fontSize: 11, marginTop: 6 },
  empty: { color: "#56697d", fontSize: 12, paddingVertical: 12 },
  techCard: { marginTop: 12, backgroundColor: "#0c1320", borderRadius: 8, padding: 10 },
  techTitle: { color: "#9fb2c8", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  techRow: { color: "#7a90a8", fontSize: 11, marginVertical: 1, fontFamily: Platform.OS === "web" ? "monospace" : undefined },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#16202b" },
  pipeline: { flexDirection: "row", alignItems: "center" },
  stageWrap: { flexDirection: "row", alignItems: "center" },
  stageDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#2a3a4d" },
  stageDotDone: { backgroundColor: "#5BE49B" },
  stageDotActive: { backgroundColor: "#8EFF66" },
  stageLabel: { color: "#56697d", fontSize: 10, marginLeft: 5, letterSpacing: 0.5 },
  stageLabelDone: { color: "#9fb2c8" },
  stageBar: { width: 24, height: 1, backgroundColor: "#2a3a4d", marginHorizontal: 8 },
  exportBtn: { backgroundColor: "#1f2d3d", borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: "#2a3a4d" },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { color: "#cfe0f0", fontWeight: "700", fontSize: 12 },
});

export { RbxProductionCockpit };
export default RbxProductionCockpit;
