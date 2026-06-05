// s4/screens/Debug/DebugScreen.js
// KERROS: S4 – Studio/UI
// Version: 1.1.0 - Throttled events + FlatList
//
// Debug & Trace UI — yhdellä silmäyksellä mitä järjestelmä teki.
//
// Näkymät (tabit):
//   Pipeline  — 13-vaiheisen pipelinen visuaalinen tila
//   Decisions — orchestratorin decision loop trace
//   Events    — eventbus-tapahtumat reaaliajassa
//   Memory    — memory ring inspection (episodic/semantic/procedural)
//   Invariants — InvariantEngine violations + stats

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, FlatList, Pressable, StyleSheet,
  ActivityIndicator, Platform, RefreshControl
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Värit (inline — ei erillistä importtia) ─────────────────

var C = {
  bg:      "#080c0a",
  surface: "#0d1410",
  elevated:"#111a14",
  border:  "#1e2e22",
  primary: "#39ff5a",
  purple:  "#a78bfa",
  green:   "#22c55e",
  yellow:  "#eab308",
  red:     "#ef4444",
  orange:  "#f97316",
  text:    "#f0f4f1",
  muted:   "#8a9e8f",
  dim:     "#3a3a4d"
};

// ─── Pipeline-vaiheiden järjestys ────────────────────────────

var PIPELINE_PHASES = [
  "INTAKE", "NORMALIZE", "INCREMENTAL_CHECK", "PLAN",
  "TEMPLATE", "SYNTHESIZE", "DEPS", "BUILD",
  "VALIDATE", "SECURITY", "PACKAGE", "PREVIEW", "PUBLISH"
];

// ─── Apufunktiot ─────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return "—";
  var diff = Date.now() - ts;
  if (diff < 1000)   return diff + "ms";
  if (diff < 60000)  return Math.round(diff / 1000) + "s sitten";
  if (diff < 3600000)return Math.round(diff / 60000) + "min sitten";
  return Math.round(diff / 3600000) + "h sitten";
}

function stageColor(status) {
  if (!status) return C.dim;
  if (status === "completed" || status === "passed" || status === "resolved") return C.green;
  if (status === "running")  return C.yellow;
  if (status === "rejected" || status === "failed") return C.red;
  if (status === "pending")  return C.purple;
  return C.muted;
}

function stageIcon(status) {
  if (!status) return "○";
  if (status === "completed" || status === "passed" || status === "resolved") return "✓";
  if (status === "running")  return "⟳";
  if (status === "rejected" || status === "failed") return "✗";
  if (status === "pending")  return "…";
  return "○";
}

// ─── Komponentit ─────────────────────────────────────────────

function SectionHeader(props) {
  return (
    <View style={ss.sectionHeader}>
      <Text style={ss.sectionTitle}>{props.title}</Text>
      {props.badge !== undefined && (
        <View style={ss.badge}>
          <Text style={ss.badgeText}>{props.badge}</Text>
        </View>
      )}
    </View>
  );
}

function EmptyState(props) {
  return (
    <View style={ss.empty}>
      <Text style={ss.emptyIcon}>{props.icon || "📭"}</Text>
      <Text style={ss.emptyText}>{props.text}</Text>
    </View>
  );
}

// ─── TAB 1: Pipeline Visualizer ──────────────────────────────

function PipelineTab(props) {
  var orchestrator = props.orchestrator;
  var [builds, setBuilds]   = useState([]);
  var [loading, setLoading] = useState(false);

  var load = useCallback(async function() {
    if (!orchestrator) return;
    setLoading(true);
    try {
      // Haetaan decision trace — siellä on build-tietoa
      var trace = orchestrator.getDecisionTrace
        ? orchestrator.getDecisionTrace(20)
        : [];
      setBuilds(trace);
    } catch (e) { /* ei kaada */ }
    setLoading(false);
  }, [orchestrator]);

  useEffect(function() { load(); }, [load]);

  if (loading) {
    return <View style={ss.center}><ActivityIndicator color={C.primary} /></View>;
  }

  return (
    <ScrollView
      style={ss.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
    >
      <SectionHeader title="Pipeline — 13 vaihetta" />

      <View style={ss.pipelineGrid}>
        {PIPELINE_PHASES.map(function(phase, i) {
          return (
            <View key={phase} style={ss.phaseBox}>
              <Text style={ss.phaseNum}>{i + 1}</Text>
              <Text style={ss.phaseName}>{phase.replace("_", "\n")}</Text>
              <View style={[ss.phaseStatus, { backgroundColor: C.dim }]} />
            </View>
          );
        })}
      </View>

      <SectionHeader title="Decision trace" badge={builds.length} />

      {builds.length === 0
        ? <EmptyState icon="🔍" text="Ei trace-dataa. Aja komento ALX-tabista." />
        : builds.map(function(t) {
            var stages    = t.stages || {};
            var stageKeys = Object.keys(stages);
            return (
              <View key={t.traceId} style={ss.traceCard}>
                <View style={ss.traceHeader}>
                  <Text style={ss.traceId}>
                    {t.traceId ? t.traceId.slice(-12) : "—"}
                  </Text>
                  <Text style={[ss.traceResult, {
                    color: t.result === "ok" ? C.green : t.result ? C.red : C.muted
                  }]}>
                    {t.result || "…"} {t.durationMs ? t.durationMs + "ms" : ""}
                  </Text>
                </View>
                <Text style={ss.traceInput} numberOfLines={1}>{t.input || "—"}</Text>
                <View style={ss.stageRow}>
                  {stageKeys.map(function(key) {
                    var s = stages[key];
                    return (
                      <View key={key} style={ss.stageChip}>
                        <Text style={[ss.stageChipIcon, { color: stageColor(s.status) }]}>
                          {stageIcon(s.status)}
                        </Text>
                        <Text style={ss.stageChipLabel}>{key.slice(0, 3)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
      }
    </ScrollView>
  );
}

// ─── TAB 2: Decision Trace ───────────────────────────────────

function DecisionsTab(props) {
  var orchestrator = props.orchestrator;
  var [trace,    setTrace]    = useState([]);
  var [selected, setSelected] = useState(null);
  var [loading,  setLoading]  = useState(false);

  var load = useCallback(function() {
    if (!orchestrator || !orchestrator.getDecisionTrace) return;
    setLoading(true);
    try {
      setTrace(orchestrator.getDecisionTrace(30));
    } catch (e) { /* ei kaada */ }
    setLoading(false);
  }, [orchestrator]);

  useEffect(function() { load(); }, [load]);

  var selectedTrace = selected !== null ? trace[selected] : null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[ss.scroll, { maxHeight: "45%" }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
      >
        <SectionHeader title="Decision loop trace" badge={trace.length} />
        {trace.length === 0
          ? <EmptyState icon="🔎" text="Ei päätöshistoriaa vielä." />
          : trace.map(function(t, i) {
              var isSelected = selected === i;
              return (
                <Pressable
                  key={t.traceId || i}
                  style={[ss.traceRow, isSelected && ss.traceRowSelected]}
                  onPress={function() { setSelected(isSelected ? null : i); }}
                >
                  <Text style={[ss.traceRowId, { color: t.result === "ok" ? C.green : C.red }]}>
                    {stageIcon(t.result === "ok" ? "completed" : t.result ? "failed" : "running")}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={ss.traceRowInput} numberOfLines={1}>{t.input || "—"}</Text>
                    <Text style={ss.traceRowMeta}>
                      {t.stages && t.stages.intent && t.stages.intent.intent
                        ? t.stages.intent.intent + " · "
                        : ""}
                      {t.durationMs ? t.durationMs + "ms" : "pending"}
                    </Text>
                  </View>
                </Pressable>
              );
            })
        }
      </ScrollView>

      {selectedTrace && (
        <ScrollView style={[ss.scroll, { flex: 1 }]}>
          <SectionHeader title="Vaiheet" />
          {Object.entries(selectedTrace.stages || {}).map(function(entry) {
            var key = entry[0];
            var s   = entry[1];
            return (
              <View key={key} style={ss.stageDetail}>
                <View style={ss.stageDetailHeader}>
                  <Text style={[ss.stageDetailIcon, { color: stageColor(s.status) }]}>
                    {stageIcon(s.status)}
                  </Text>
                  <Text style={ss.stageDetailName}>{key.toUpperCase()}</Text>
                  <Text style={[ss.stageDetailStatus, { color: stageColor(s.status) }]}>
                    {s.status || "—"}
                  </Text>
                </View>
                {s.intent && (
                  <Text style={ss.stageDetailValue}>intent: {s.intent}</Text>
                )}
                {s.written !== undefined && (
                  <Text style={ss.stageDetailValue}>
                    muisti kirjoitettu: {s.written ? "✓" : "✗"}
                  </Text>
                )}
                {s.violations && s.violations.length > 0 && (
                  <Text style={[ss.stageDetailValue, { color: C.red }]}>
                    invariant: {s.violations[0].reason}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── TAB 3: EventBus Viewer ──────────────────────────────────

function EventsTab(props) {
  var orchestrator = props.orchestrator;
  var [events,   setEvents]   = useState([]);
  var [paused,   setPaused]   = useState(false);
  var eventsRef  = useRef([]);
  var pausedRef  = useRef(false);

  useEffect(function() {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(function() {
    if (!orchestrator || typeof orchestrator.on !== "function") return;

    // Batch pending — kerätään ennen setState-kutsua
    var pendingBatch = [];
    var flushTimer   = null;

    function flushBatch() {
      flushTimer = null;
      if (pendingBatch.length === 0 || pausedRef.current) return;
      var toAdd = pendingBatch.slice();
      pendingBatch = [];
      eventsRef.current = toAdd.concat(eventsRef.current).slice(0, 100);
      setEvents(eventsRef.current.slice());
    }

    var unsub = orchestrator.on("*", function(event) {
      if (pausedRef.current) return;
      var entry = {
        id:      Date.now() + Math.random(),
        type:    event.type || "unknown",
        ts:      Date.now(),
        payload: event.payload || {}
      };
      pendingBatch.push(entry);

      // Throttle: max yksi setState per 100ms
      if (!flushTimer) {
        flushTimer = setTimeout(flushBatch, 100);
      }
      // Pakkoflush jos liian monta odottaa
      if (pendingBatch.length >= 20) {
        clearTimeout(flushTimer);
        flushBatch();
      }
    });

    return function() {
      if (typeof unsub === "function") unsub();
      if (flushTimer) clearTimeout(flushTimer);
      pendingBatch = [];
    };
  }, [orchestrator]);

  function clear() {
    eventsRef.current = [];
    setEvents([]);
  }

  var typeColor = function(type) {
    if (!type) return C.muted;
    if (type.indexOf("loop") !== -1)     return C.purple;
    if (type.indexOf("command") !== -1)  return C.primary;
    if (type.indexOf("factory") !== -1)  return C.orange;
    if (type.indexOf("governance") !== -1) return C.yellow;
    if (type.indexOf("error") !== -1 || type.indexOf("fail") !== -1) return C.red;
    return C.muted;
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={ss.eventToolbar}>
        <Pressable style={[ss.toolBtn, paused && ss.toolBtnActive]} onPress={function() { setPaused(function(p) { return !p; }); }}>
          <Text style={ss.toolBtnText}>{paused ? "▶ Jatka" : "⏸ Pysäytä"}</Text>
        </Pressable>
        <Pressable style={ss.toolBtn} onPress={clear}>
          <Text style={ss.toolBtnText}>🗑 Tyhjennä</Text>
        </Pressable>
        <Text style={ss.eventCount}>{events.length} tapahtumaa</Text>
      </View>

      {events.length === 0
        ? <EmptyState icon="📡" text="Ei tapahtumia. Aja komento aloittaaksesi." />
        : <FlatList
            data={events}
            keyExtractor={function(e) { return String(e.id); }}
            renderItem={function(info) {
              var e = info.item;
              return (
                <View style={ss.eventRow}>
                  <Text style={ss.eventTs}>{new Date(e.ts).toLocaleTimeString("fi-FI")}</Text>
                  <Text style={[ss.eventType, { color: typeColor(e.type) }]} numberOfLines={1}>
                    {e.type}
                  </Text>
                </View>
              );
            }}
            removeClippedSubviews={true}
            maxToRenderPerBatch={20}
            windowSize={5}
            initialNumToRender={30}
            getItemLayout={function(data, index) {
              return { length: 36, offset: 36 * index, index: index };
            }}
          />
      }
    </View>
  );
}

// ─── TAB 4: Memory Ring Inspection ───────────────────────────

function MemoryTab(props) {
  var orchestrator = props.orchestrator;
  var [stats,   setStats]   = useState(null);
  var [entries, setEntries] = useState([]);
  var [store,   setStore]   = useState("episodic");
  var [loading, setLoading] = useState(false);

  var load = useCallback(async function() {
    if (!orchestrator) return;
    setLoading(true);
    try {
      // Stats
      var mem = orchestrator.getCoreMemory ? orchestrator.getCoreMemory() : null;
      if (mem && mem.getStats) {
        setStats(mem.getStats());
      }
      // Entries
      var results = orchestrator.queryMemory
        ? await orchestrator.queryMemory(store, { limit: 20 })
        : [];
      setEntries(results || []);
    } catch (e) { /* ei kaada */ }
    setLoading(false);
  }, [orchestrator, store]);

  useEffect(function() { load(); }, [load]);

  var stores = ["episodic", "semantic", "procedural"];

  return (
    <ScrollView
      style={ss.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
    >
      {stats && (
        <>
          <SectionHeader title="Memory ring stats" />
          <View style={ss.statsGrid}>
            {Object.keys(stats.stores || {}).map(function(s) {
              var st = stats.stores[s];
              return (
                <View key={s} style={ss.statCard}>
                  <Text style={ss.statLabel}>{s}</Text>
                  <Text style={ss.statValue}>{st.count || 0}</Text>
                  <Text style={ss.statSub}>/ {st.limit || "∞"}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      <SectionHeader title="Store" />
      <View style={ss.storeSelector}>
        {stores.map(function(s) {
          return (
            <Pressable
              key={s}
              style={[ss.storeTab, store === s && ss.storeTabActive]}
              onPress={function() { setStore(s); }}
            >
              <Text style={[ss.storeTabText, store === s && ss.storeTabTextActive]}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title={"Viimeiset 20 — " + store} badge={entries.length} />

      {entries.length === 0
        ? <EmptyState icon="🗂" text={"Ei merkintöjä storessa: " + store} />
        : entries.map(function(e, i) {
            return (
              <View key={e.id || i} style={ss.memEntry}>
                <View style={ss.memEntryHeader}>
                  <Text style={ss.memEntryType}>
                    {e.tags ? e.tags.slice(0, 3).join(", ") : "—"}
                  </Text>
                  <Text style={ss.memEntryTs}>{timeAgo(e.timestamp)}</Text>
                </View>
                <Text style={ss.memEntryContent} numberOfLines={2}>
                  {e.content
                    ? (typeof e.content === "string"
                        ? e.content.slice(0, 120)
                        : JSON.stringify(e.content).slice(0, 120))
                    : "—"}
                </Text>
              </View>
            );
          })
      }
    </ScrollView>
  );
}

// ─── TAB 5: Invariant Engine ─────────────────────────────────

function InvariantsTab(props) {
  var orchestrator = props.orchestrator;
  var [violations, setViolations] = useState([]);
  var [govStatus,  setGovStatus]  = useState(null);
  var [loading,    setLoading]    = useState(false);

  var load = useCallback(function() {
    if (!orchestrator) return;
    setLoading(true);
    try {
      var inv = orchestrator.getInvariantEngine
        ? orchestrator.getInvariantEngine()
        : null;
      if (inv) {
        setViolations(inv.getViolations(30));
      }
      // System governance status
      var gov = orchestrator.getGovernance
        ? orchestrator.getGovernance()
        : null;
      if (gov) {
        setGovStatus(gov.getStatus());
      }
    } catch (e) { /* ei kaada */ }
    setLoading(false);
  }, [orchestrator]);

  useEffect(function() { load(); }, [load]);

  var sevColor = function(sev) {
    if (sev === "CRITICAL") return C.red;
    if (sev === "BLOCK")    return C.orange;
    return C.yellow;
  };

  return (
    <ScrollView
      style={ss.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
    >
      {govStatus && (
        <>
          <SectionHeader title="System state" />
          <View style={ss.govCard}>
            <View style={ss.govRow}>
              <Text style={ss.govLabel}>Tila</Text>
              <Text style={[ss.govValue, {
                color: govStatus.systemState && govStatus.systemState.state === "READY"
                  ? C.green : C.yellow
              }]}>
                {govStatus.systemState ? govStatus.systemState.state : "—"}
              </Text>
            </View>
            <View style={ss.govRow}>
              <Text style={ss.govLabel}>Emergency</Text>
              <Text style={[ss.govValue, { color: govStatus.emergencyMode ? C.red : C.green }]}>
                {govStatus.emergencyMode ? "AKTIIVINEN" : "ei aktiivinen"}
              </Text>
            </View>
            <View style={ss.govRow}>
              <Text style={ss.govLabel}>Portit (viimeiset)</Text>
              <Text style={ss.govValue}>{govStatus.recentGates ? govStatus.recentGates.length : 0} kpl</Text>
            </View>
          </View>
        </>
      )}

      <SectionHeader title="Invariant violations" badge={violations.length} />
      {violations.length === 0
        ? <EmptyState icon="✅" text="Ei rikkomuksia — kaikki invariantit ehjänä." />
        : violations.slice().reverse().map(function(v, i) {
            return (
              <View key={i} style={[ss.violationCard, { borderLeftColor: sevColor(v.severity) }]}>
                <View style={ss.violationHeader}>
                  <Text style={[ss.violationSev, { color: sevColor(v.severity) }]}>
                    {v.severity}
                  </Text>
                  <Text style={ss.violationId}>{v.ruleId}</Text>
                  <Text style={ss.violationTs}>{timeAgo(v.ts)}</Text>
                </View>
                <Text style={ss.violationName}>{v.ruleName}</Text>
                <Text style={ss.violationReason}>{v.reason}</Text>
                <Text style={ss.violationCheckpoint}>checkpoint: {v.checkpoint}</Text>
              </View>
            );
          })
      }
    </ScrollView>
  );
}

// ─── Pääkomponentti ──────────────────────────────────────────

var TABS = [
  { id: "pipeline",   label: "Pipeline",  icon: "⚙" },
  { id: "decisions",  label: "Decisions", icon: "🧠" },
  { id: "events",     label: "Events",    icon: "📡" },
  { id: "memory",     label: "Memory",    icon: "💾" },
  { id: "invariants", label: "Rules",     icon: "🛡" }
];

export function DebugScreen(props) {
  var orchestrator = props.orchestrator;
  var [activeTab, setActiveTab] = useState("pipeline");

  var sysMode = orchestrator && orchestrator.getSystemMode
    ? orchestrator.getSystemMode()
    : "NORMAL";

  var modeColor = sysMode === "NORMAL"   ? C.green
                : sysMode === "DEGRADED" ? C.yellow
                : C.red;

  return (
    <SafeAreaView style={ss.root} edges={["top"]}>
      {/* Header */}
      <View style={ss.header}>
        <Text style={ss.headerTitle}>Debug & Trace</Text>
        <View style={[ss.modeBadge, { borderColor: modeColor }]}>
          <Text style={[ss.modeText, { color: modeColor }]}>{sysMode}</Text>
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={ss.tabBar}
        contentContainerStyle={ss.tabBarContent}
      >
        {TABS.map(function(tab) {
          var active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[ss.tab, active && ss.tabActive]}
              onPress={function() { setActiveTab(tab.id); }}
            >
              <Text style={ss.tabIcon}>{tab.icon}</Text>
              <Text style={[ss.tabLabel, active && ss.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === "pipeline"   && <PipelineTab   orchestrator={orchestrator} />}
        {activeTab === "decisions"  && <DecisionsTab  orchestrator={orchestrator} />}
        {activeTab === "events"     && <EventsTab     orchestrator={orchestrator} />}
        {activeTab === "memory"     && <MemoryTab     orchestrator={orchestrator} />}
        {activeTab === "invariants" && <InvariantsTab orchestrator={orchestrator} />}
      </View>
    </SafeAreaView>
  );
}

export default DebugScreen;

// ─── Tyylit ──────────────────────────────────────────────────

var ss = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderColor: C.border },
  headerTitle:  { color: C.text, fontSize: 17, fontWeight: "700" },
  modeBadge:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  modeText:     { fontSize: 12, fontWeight: "600" },

  tabBar:        { maxHeight: 52, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  tabBarContent: { paddingHorizontal: 8, alignItems: "center" },
  tab:           { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive:     { borderBottomColor: C.primary },
  tabIcon:       { fontSize: 14 },
  tabLabel:      { fontSize: 12, color: C.muted, fontWeight: "500" },
  tabLabelActive:{ color: C.primary },

  scroll:        { flex: 1 },
  center:        { flex: 1, justifyContent: "center", alignItems: "center" },

  sectionHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },
  sectionTitle:  { color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", flex: 1 },
  badge:         { backgroundColor: C.elevated, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:     { color: C.muted, fontSize: 11 },

  empty:         { alignItems: "center", paddingVertical: 40 },
  emptyIcon:     { fontSize: 32, marginBottom: 10 },
  emptyText:     { color: C.muted, fontSize: 13, textAlign: "center" },

  // Pipeline
  pipelineGrid:  { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, gap: 6, paddingBottom: 10 },
  phaseBox:      { width: "14%", backgroundColor: C.surface, borderRadius: 8, padding: 6, alignItems: "center", borderWidth: 1, borderColor: C.border },
  phaseNum:      { fontSize: 9, color: C.muted, marginBottom: 2 },
  phaseName:     { fontSize: 7, color: C.text, textAlign: "center", fontWeight: "600" },
  phaseStatus:   { width: 6, height: 6, borderRadius: 3, marginTop: 4 },

  // Trace cards
  traceCard:     { margin: 8, marginTop: 0, backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  traceHeader:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  traceId:       { fontSize: 11, color: C.muted, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  traceResult:   { fontSize: 11, fontWeight: "700" },
  traceInput:    { fontSize: 12, color: C.text, marginBottom: 8 },
  stageRow:      { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  stageChip:     { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.elevated, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  stageChipIcon: { fontSize: 10, fontWeight: "700" },
  stageChipLabel:{ fontSize: 9, color: C.muted },

  // Decision trace rows
  traceRow:          { flexDirection: "row", alignItems: "center", padding: 10, borderBottomWidth: 1, borderColor: C.border, gap: 10 },
  traceRowSelected:  { backgroundColor: C.elevated },
  traceRowId:        { fontSize: 16, width: 20, textAlign: "center" },
  traceRowInput:     { fontSize: 13, color: C.text },
  traceRowMeta:      { fontSize: 11, color: C.muted, marginTop: 2 },

  // Stage detail
  stageDetail:        { marginHorizontal: 12, marginBottom: 6, backgroundColor: C.surface, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.border },
  stageDetailHeader:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  stageDetailIcon:    { fontSize: 14, fontWeight: "700" },
  stageDetailName:    { fontSize: 13, color: C.text, fontWeight: "600", flex: 1 },
  stageDetailStatus:  { fontSize: 11, fontWeight: "600" },
  stageDetailValue:   { fontSize: 11, color: C.muted, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  // Events
  eventToolbar:  { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  toolBtn:       { backgroundColor: C.elevated, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  toolBtnActive: { backgroundColor: C.primary + "30" },
  toolBtnText:   { color: C.text, fontSize: 12, fontWeight: "600" },
  eventCount:    { color: C.muted, fontSize: 11, marginLeft: "auto" },
  eventRow:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderColor: C.border + "44", gap: 10 },
  eventTs:       { fontSize: 10, color: C.muted, minWidth: 60, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  eventType:     { fontSize: 11, flex: 1, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  // Memory
  statsGrid:    { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, gap: 8, paddingBottom: 8 },
  statCard:     { backgroundColor: C.surface, borderRadius: 10, padding: 12, alignItems: "center", minWidth: 90, borderWidth: 1, borderColor: C.border },
  statLabel:    { fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1 },
  statValue:    { fontSize: 24, fontWeight: "800", color: C.primary, marginTop: 4 },
  statSub:      { fontSize: 10, color: C.muted },
  storeSelector:{ flexDirection: "row", paddingHorizontal: 10, gap: 6, marginBottom: 4 },
  storeTab:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  storeTabActive:{ backgroundColor: C.primary + "20", borderColor: C.primary },
  storeTabText: { color: C.muted, fontSize: 12 },
  storeTabTextActive: { color: C.primary },
  memEntry:     { marginHorizontal: 10, marginBottom: 6, backgroundColor: C.surface, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.border },
  memEntryHeader:{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  memEntryType: { fontSize: 11, color: C.primary, fontWeight: "600" },
  memEntryTs:   { fontSize: 10, color: C.muted },
  memEntryContent:{ fontSize: 11, color: C.muted, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  // Invariants
  govCard:   { marginHorizontal: 10, backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 6 },
  govRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  govLabel:  { fontSize: 12, color: C.muted },
  govValue:  { fontSize: 12, fontWeight: "600", color: C.text },
  violationCard:   { marginHorizontal: 10, marginBottom: 6, backgroundColor: C.surface, borderRadius: 8, padding: 12, borderLeftWidth: 3, borderWidth: 1, borderColor: C.border },
  violationHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  violationSev:    { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  violationId:     { fontSize: 11, color: C.muted, flex: 1 },
  violationTs:     { fontSize: 10, color: C.dim },
  violationName:   { fontSize: 12, color: C.text, fontWeight: "600", marginBottom: 2 },
  violationReason: { fontSize: 11, color: C.muted, marginBottom: 2 },
  violationCheckpoint: { fontSize: 10, color: C.dim }
});