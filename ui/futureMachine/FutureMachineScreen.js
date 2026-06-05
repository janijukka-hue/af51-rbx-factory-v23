// ui/futureMachine/FutureMachineScreen.js
// AF51 FutureMachine — standalone replay screen.
//
// Lists existing builds (via /rbx/exports) and visualizes the selected one
// as CoreSphere + FactoryRing. 100% read-only: never triggers a build,
// never mutates pipeline state.
//
// Mount anywhere in the app:
//   <FutureMachineScreen server="http://localhost:3000" token={alx_token} />

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useReplayedRuntime } from "./useReplayedRuntime.js";
import { CoreSphere } from "./CoreSphere.js";
import { FactoryRing } from "./FactoryRing.js";
import { GhostRing } from "./GhostRing.js";
import { IntentRing } from "./IntentRing.js";
import { MemoryRing } from "./MemoryRing.js";
import { EnergyRing } from "./EnergyRing.js";
import { WorldRing } from "./WorldRing.js";

var DEFAULT_SERVER = "http://localhost:3000";
var TRACE_RE = /build_[a-z]+_[a-f0-9]+/;

function _buildHeaders(token) {
  var h = { Accept: "application/json" };
  if (token) h["X-ALX-Token"] = token;
  return h;
}

function _extractBuildId(filename) {
  var m = String(filename || "").match(TRACE_RE);
  return m ? m[0] : null;
}

export function FutureMachineScreen(props) {
  var server = props.server || DEFAULT_SERVER;
  var token  = props.token || null;

  var buildsState = useState([]);
  var builds = buildsState[0];
  var setBuilds = buildsState[1];

  var selectedState = useState(null);
  var selected = selectedState[0];
  var setSelected = selectedState[1];

  var listErrState = useState(null);
  var listErr = listErrState[0];
  var setListErr = listErrState[1];

  var refreshBuilds = useCallback(function () {
    setListErr(null);
    return fetch(server + "/rbx/exports", { headers: _buildHeaders(token) })
      .then(function (r) { return r.json(); })
      .then(function (body) {
        if (!body || body.ok !== true) throw new Error((body && body.error) || "exports fetch failed");
        var rows = (body.exports || [])
          .map(function (e) { return { filename: e.filename, buildId: _extractBuildId(e.filename), modifiedAt: e.modifiedAt }; })
          .filter(function (e) { return !!e.buildId; });
        setBuilds(rows);
        if (rows.length && !selected) setSelected(rows[0].buildId);
      })
      .catch(function (e) {
        setListErr(e && e.message ? e.message : String(e));
      });
  }, [server, token, selected]);

  useEffect(function () { refreshBuilds(); }, []); // mount only

  var replay = useReplayedRuntime({ server: server, buildId: selected, token: token });

  return (
    <View style={styles.root}>
      <Text style={styles.title}>FutureMachine — Replay</Text>
      <Text style={styles.subtitle}>Read-only projection of PipelineAudit. No factory mutation.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.buildRow}>
        {builds.map(function (b) {
          var active = b.buildId === selected;
          return (
            <Pressable
              key={b.buildId}
              onPress={function () { setSelected(b.buildId); }}
              style={[styles.buildChip, active && styles.buildChipActive]}
            >
              <Text style={[styles.buildChipText, active && styles.buildChipTextActive]}>
                {b.buildId}
              </Text>
            </Pressable>
          );
        })}
        {!builds.length && !listErr ? <Text style={styles.muted}>No builds in exports-rbx/.</Text> : null}
        {listErr ? <Text style={styles.error}>{listErr}</Text> : null}
      </ScrollView>

      <View style={styles.stage}>
        <WorldRing snapshot={replay.snapshot} diameter={1040}>
          <EnergyRing snapshot={replay.snapshot} diameter={880}>
            <MemoryRing snapshot={replay.snapshot} diameter={720}>
              <IntentRing snapshot={replay.snapshot} diameter={560}>
                <FactoryRing snapshot={replay.snapshot} diameter={400}>
                  <GhostRing snapshot={replay.snapshot} diameter={240}>
                    <CoreSphere snapshot={replay.snapshot} size={130} />
                  </GhostRing>
                </FactoryRing>
              </IntentRing>
            </MemoryRing>
          </EnergyRing>
        </WorldRing>
        {replay.loading ? (
          <View style={styles.overlay}><ActivityIndicator size="large" color="#3b6df0" /></View>
        ) : null}
      </View>

      {replay.error ? <Text style={styles.error}>{replay.error}</Text> : null}

      <View style={styles.statusRow}>
        <Text style={styles.statusKey}>traceId</Text>
        <Text style={styles.statusVal}>{(replay.snapshot && replay.snapshot.traceId) || "—"}</Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusKey}>records</Text>
        <Text style={styles.statusVal}>
          {(replay.snapshot && replay.snapshot.rings && replay.snapshot.rings.factory && replay.snapshot.rings.factory.historyLen) || 0}
        </Text>
      </View>
      {replay.snapshot && replay.snapshot.intent ? (
        <View>
          <View style={styles.statusRow}>
            <Text style={styles.statusKey}>target</Text>
            <Text style={styles.statusVal}>
              {(replay.snapshot.intent.targetId || "—") + " / " + (replay.snapshot.intent.targetType || "—")}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusKey}>quality</Text>
            <Text style={styles.statusVal}>
              {(replay.snapshot.intent.qualityScore == null ? "—" : String(replay.snapshot.intent.qualityScore))
                + (replay.snapshot.intent.qualityPass ? " (pass)" : " (fail)")}
            </Text>
          </View>
          {replay.snapshot.intent.rules && replay.snapshot.intent.rules.identity ? (
            <View style={styles.statusRow}>
              <Text style={styles.statusKey}>identity</Text>
              <Text style={styles.statusVal}>{replay.snapshot.intent.rules.identity}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {replay.snapshot && replay.snapshot.ledger ? (
        <View>
          <View style={styles.statusRow}>
            <Text style={styles.statusKey}>ghost</Text>
            <Text style={styles.statusVal}>{replay.snapshot.ledger.ghostId || "—"}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusKey}>lineage</Text>
            <Text style={styles.statusVal}>
              {"gen " + (replay.snapshot.ledger.buildGeneration == null ? "—" : String(replay.snapshot.ledger.buildGeneration))
                + " · parent " + (replay.snapshot.ledger.parentCapsuleId ? replay.snapshot.ledger.parentCapsuleId : "(genesis)")
                + " · repairs " + (replay.snapshot.ledger.repairCount || 0)}
            </Text>
          </View>
        </View>
      ) : null}
      {replay.snapshot && replay.snapshot.energy ? (
        <View>
          <View style={styles.statusRow}>
            <Text style={styles.statusKey}>energy</Text>
            <Text style={styles.statusVal}>
              {(replay.snapshot.energy.buildDuration == null ? "—" : String(replay.snapshot.energy.buildDuration) + "ms")
                + " · " + (replay.snapshot.energy.zipSize ? (Math.round(replay.snapshot.energy.zipSize / 1024) + "kb") : "—")
                + " · " + (replay.snapshot.energy.recordCount || 0) + " rec"
                + " · " + (replay.snapshot.energy.runtimeModules || 0) + " mod"
                + " · " + (replay.snapshot.energy.entryCount || 0) + " ent"}
            </Text>
          </View>
        </View>
      ) : null}
      {replay.snapshot && replay.snapshot.world ? (
        <View>
          <View style={styles.statusRow}>
            <Text style={styles.statusKey}>world</Text>
            <Text style={styles.statusVal}>
              {(replay.snapshot.world.factory || "—")
                + " · rojo " + (replay.snapshot.world.rojo || "—")
                + " · " + (replay.snapshot.world.robloxCompatible === true ? "compatible"
                          : replay.snapshot.world.robloxCompatible === false ? "INCOMPATIBLE"
                          : "—")}
            </Text>
          </View>
          {replay.snapshot.world.masterHash ? (
            <View style={styles.statusRow}>
              <Text style={styles.statusKey}>master</Text>
              <Text style={styles.statusVal}>{replay.snapshot.world.masterHash}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Pressable onPress={replay.refresh} style={styles.refresh}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

var styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: "#0c1018", padding: 20 },
  title:     { color: "#fff", fontSize: 22, fontWeight: "700", letterSpacing: 1.5 },
  subtitle:  { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 4, marginBottom: 14 },
  buildRow:  { flexGrow: 0, marginBottom: 16 },
  buildChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#1a2030", marginRight: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  buildChipActive: { backgroundColor: "#3b6df0", borderColor: "#5d8af6" },
  buildChipText:   { color: "rgba(255,255,255,0.75)", fontSize: 11, fontFamily: "monospace" },
  buildChipTextActive: { color: "#fff", fontWeight: "700" },
  stage:     { alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  overlay:   { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  error:     { color: "#c2453b", fontSize: 12, marginTop: 8 },
  muted:     { color: "rgba(255,255,255,0.45)", fontSize: 12 },
  statusRow: { flexDirection: "row", marginTop: 6 },
  statusKey: { color: "rgba(255,255,255,0.5)", fontSize: 11, width: 80, fontFamily: "monospace" },
  statusVal: { color: "#fff", fontSize: 11, fontFamily: "monospace" },
  refresh:   { marginTop: 16, alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 16, backgroundColor: "#1a2030", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  refreshText: { color: "#fff", fontSize: 12, letterSpacing: 1 },
});

export default FutureMachineScreen;
