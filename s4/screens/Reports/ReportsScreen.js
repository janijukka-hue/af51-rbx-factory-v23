// s4/screens/Reports/ReportsScreen.js
// KERROS: S4 – Hallinta
// Näkymä: buildi- ja turvallisuusraportit kolmella tabilla.
//   Turvallisuus: npm audit, secret scan, blacklist
//   Testit: jest-tulokset
//   Ajoitukset: pipeline-vaiheiden kestot
//
// Data: orchestrator.getSeedDetails(artifactId) → artifact.reports

import React          from "react";
import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { COLORS }     from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING }    from "../../theme/spacing.js";
import { Badge }      from "../../components/common/Badge.js";
import { Card }       from "../../components/common/Card.js";

// ─── Vakiot ──────────────────────────────────────────────────

var BADGE_VARIANT = { DEFAULT: "default", SUCCESS: "success", WARNING: "warning", DANGER: "error", INFO: "info" };

var TAB = { SECURITY: "security", TESTS: "tests", TIMING: "timing" };

// ─── Apufunktiot ─────────────────────────────────────────────

var RISK_BG = { LOW: "#22c55e", MEDIUM: "#f59e0b", HIGH: "#ef4444", CRITICAL: "#7f1d1d" };
function riskBgColor(level) {
  return RISK_BG[String(level || "").toUpperCase()] || "#6b7280";
}

function riskVariant(level) {
  var l = String(level || "").toUpperCase();
  if (l === "CRITICAL" || l === "HIGH") return BADGE_VARIANT.DANGER;
  if (l === "MEDIUM")                   return BADGE_VARIANT.WARNING;
  if (l === "LOW")                      return BADGE_VARIANT.SUCCESS;
  return BADGE_VARIANT.DEFAULT;
}

function formatMs(ms) {
  if (ms == null) return "—";
  if (ms < 1000)  return ms + "ms";
  if (ms < 60000) return (ms / 1000).toFixed(1) + "s";
  return (ms / 60000).toFixed(1) + "min";
}

// ─── Osanäkymät ──────────────────────────────────────────────

function SectionHeader(props) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{props.icon}</Text>
      <Text style={styles.sectionTitle}>{props.title}</Text>
      {props.badge != null && (
        <Badge label={String(props.badge)} variant={props.badgeVariant || BADGE_VARIANT.DEFAULT} />
      )}
    </View>
  );
}

function EmptySection(props) {
  return (
    <View style={styles.emptySection}>
      <Text style={styles.emptyText}>{props.message || "Ei tietoja"}</Text>
    </View>
  );
}

// ── Turvallisuusraportti ─────────────────────────────────────

function SecurityReport(props) {
  var sec = props.data;
  if (!sec) return <EmptySection message="Turvallisuusskan ei saatavilla" />;
  var audit     = sec.audit     || {};
  var secrets   = sec.secrets   || {};
  var blocklist = sec.blocklist || {};

  return (
    <View>
      <View style={styles.riskRow}>
        <Text style={styles.label}>Riskitaso</Text>
        <Badge label={sec.riskLevel || "UNKNOWN"} variant={riskVariant(sec.riskLevel)} />
      </View>

      <Text style={styles.subheader}>npm audit</Text>
      <View style={styles.auditGrid}>
        {[["Kriittiset", audit.critical, "#dc2626"], ["Korkeat", audit.high, "#ea580c"],
          ["Kohtalaiset", audit.moderate, "#ca8a04"], ["Matalat", audit.low, "#16a34a"]
        ].map(function(item) {
          return (
            <View key={item[0]} style={styles.auditCell}>
              <Text style={[styles.auditCount, { color: item[2] }]}>{item[1] != null ? item[1] : "—"}</Text>
              <Text style={styles.auditLabel}>{item[0]}</Text>
            </View>
          );
        })}
      </View>

      {audit.advisories && audit.advisories.length > 0 && (
        <View style={styles.advisoryList}>
          {audit.advisories.slice(0, 10).map(function(adv, i) {
            return (
              <View key={i} style={styles.advisoryRow}>
                <Badge label={adv.severity} variant={riskVariant(adv.severity)} />
                <Text style={styles.advisoryName}>{adv.name}</Text>
              </View>
            );
          })}
          {audit.advisories.length > 10 && (
            <Text style={styles.moreText}>+ {audit.advisories.length - 10} muuta</Text>
          )}
        </View>
      )}

      <Text style={styles.subheader}>Secret scan</Text>
      {secrets.found && secrets.found.length > 0
        ? secrets.found.map(function(s, i) {
            return (
              <View key={i} style={styles.secretRow}>
                <Text style={styles.secretIcon}>🔑</Text>
                <View>
                  <Text style={styles.secretName}>{s.name}</Text>
                  <Text style={styles.secretFile}>{s.file}</Text>
                </View>
              </View>
            );
          })
        : <Text style={styles.okText}>✅ Ei löydettyjä salaisuuksia</Text>
      }

      <Text style={styles.subheader}>Kielletyt paketit</Text>
      {blocklist.found && blocklist.found.length > 0
        ? blocklist.found.map(function(pkg, i) { return <Text key={i} style={styles.blockedPkg}>🚫 {pkg}</Text>; })
        : <Text style={styles.okText}>✅ Ei kiellettyjä paketteja</Text>
      }

      {sec.failures && sec.failures.length > 0 && (
        <View style={styles.warningBox}>
          {sec.failures.map(function(w, i) { return <Text key={i} style={styles.warningText}>⚠️  {w}</Text>; })}
        </View>
      )}
    </View>
  );
}

// ── Testiraportti ─────────────────────────────────────────────

function TestReport(props) {
  var data = props.data;
  if (!data) return <EmptySection message="Testituloksia ei saatavilla" />;
  var passed  = data.passed  || 0;
  var failed  = data.failed  || 0;
  var skipped = data.skipped || 0;
  var total   = data.total   || (passed + failed + skipped);
  return (
    <View>
      <View style={styles.testSummary}>
        {[["Hyväksytty", passed, "#16a34a"], ["Hylätty", failed, "#dc2626"],
          ["Ohitettu", skipped, COLORS.text ? COLORS.text.muted : "#888"], ["Yhteensä", total, null]
        ].map(function(item) {
          return (
            <View key={item[0]} style={styles.testCell}>
              <Text style={[styles.testCount, item[2] ? { color: item[2] } : {}]}>{item[1]}</Text>
              <Text style={styles.testLabel}>{item[0]}</Text>
            </View>
          );
        })}
      </View>
      {data.suites && data.suites.length > 0 && (
        <View style={styles.suiteList}>
          {data.suites.map(function(suite, i) {
            return (
              <View key={i} style={styles.suiteRow}>
                <Text style={suite.failed > 0 ? styles.suiteFail : styles.suiteOk}>
                  {suite.failed > 0 ? "❌" : "✅"} {suite.name}
                </Text>
                <Text style={styles.suiteMeta}>{suite.passed}/{suite.total} • {formatMs(suite.durationMs)}</Text>
              </View>
            );
          })}
        </View>
      )}
      {(!data.suites || data.suites.length === 0) && total === 0 && (
        <Text style={styles.okText}>Ei testejä suoritettu</Text>
      )}
    </View>
  );
}

// ── Pipeline-ajoitukset ───────────────────────────────────────

function TimingReport(props) {
  var phases = props.phases;
  if (!phases || Object.keys(phases).length === 0) return <EmptySection message="Pipeline-ajoituksia ei saatavilla" />;
  return (
    <View>
      {Object.keys(phases).map(function(name) {
        var info = phases[name] || {};
        return (
          <View key={name} style={styles.timingRow}>
            <Text style={styles.timingName}>{name}</Text>
            <Text style={styles.timingMs}>{formatMs(info.durationMs || info.duration || 0)}</Text>
            <Badge
              label={info.success === false ? "FAIL" : "OK"}
              variant={info.success === false ? BADGE_VARIANT.DANGER : BADGE_VARIANT.SUCCESS}
            />
          </View>
        );
      })}
    </View>
  );
}

// ─── ReportsScreen ───────────────────────────────────────────

export function ReportsScreen(props) {
  var orchestrator = props.orchestrator;
  var artifactId   = props.route && props.route.params && props.route.params.artifactId;
  var navigation   = props.navigation;

  var tabState    = useState(TAB.SECURITY);
  var activeTab   = tabState[0];
  var setActiveTab = tabState[1];

  var loadingState = useState(false);
  var loading      = loadingState[0];
  var setLoading   = loadingState[1];

  var errorState = useState(null);
  var error      = errorState[0];
  var setError   = errorState[1];

  var reportsState = useState(null);
  var reports      = reportsState[0];
  var setReports   = reportsState[1];

  var artifactState = useState(null);
  var artifact      = artifactState[0];
  var setArtifact   = artifactState[1];

  // Tab-moodissa (ei artifactId): haetaan viimeisimmät artifaktit listaksi
  var recentState    = useState([]);
  var recentList     = recentState[0];
  var setRecentList  = recentState[1];
  var recentLoading  = useState(false);
  var loadingRecent  = recentLoading[0];
  var setLoadingRecent = recentLoading[1];

  var load = useCallback(function() {
    if (!orchestrator || !artifactId) return;
    setLoading(true);
    setError(null);
    orchestrator.getSeedDetails(artifactId)
      .then(function(result) {
        if (!result || !result.ok) { setError(result ? result.error : "Artifaktia ei löydy"); return; }
        var art = result.artifact || {};
        setArtifact(art);
        var reps = art.reports || {};
        if (Array.isArray(art.reports)) {
          reps = {};
          art.reports.forEach(function(r) { if (r.type) reps[r.type] = r; });
        }
        setReports(reps);
      })
      .catch(function(err) { setError(err.message || "Lataus epäonnistui"); })
      .finally(function() { setLoading(false); });
  }, [orchestrator, artifactId, setLoading, setError, setArtifact, setReports]);

  // Tab-moodi: lataa viimeisimmät artifaktit jotka sisältävät raportteja
  var loadRecent = useCallback(function() {
    if (!orchestrator || artifactId) return;
    setLoadingRecent(true);
    try {
      var seeds = orchestrator.getSeeds ? orchestrator.getSeeds({ limit: 20 }) : [];
      var withReports = (Array.isArray(seeds) ? seeds : []).filter(function(s) {
        return s.reports && (Array.isArray(s.reports) ? s.reports.length > 0 : Object.keys(s.reports).length > 0);
      });
      setRecentList(withReports);
    } catch (e) {
      setRecentList([]);
    } finally {
      setLoadingRecent(false);
    }
  }, [orchestrator, artifactId, setRecentList, setLoadingRecent]);

  useEffect(function() { load(); }, [load]);
  useEffect(function() { loadRecent(); }, [loadRecent]);

  // ── Tab-moodi: ei artifactId → näytä lista ────────────────
  if (!artifactId) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📊 Raportit</Text>
          <Text style={styles.headerSub}>Valitse artefakti tarkastellaksesi raportteja</Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {loadingRecent && (
            <View style={styles.center}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          )}
          {!loadingRecent && recentList.length === 0 && (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabIcon}>📭</Text>
              <Text style={styles.emptyTabTitle}>Ei raportteja vielä</Text>
              <Text style={styles.emptyTabText}>
                Raportit syntyvät kun buildataan APPLICATION tai LIBRARY -tyyppiä käyttäen.
                Pipeline ajaa automaattisesti SecurityPhase:n ja tallentaa tulokset artifaktiin.
              </Text>
            </View>
          )}
          {recentList.map(function(seed) {
            var sec = seed.reports && (Array.isArray(seed.reports)
              ? seed.reports.find(function(r) { return r.type === "security"; })
              : (seed.reports.security || seed.reports.SECURITY));
            return (
              <TouchableOpacity
                key={seed.id}
                style={styles.recentItem}
                onPress={function() {
                  if (navigation) navigation.navigate("Reports", { artifactId: seed.id });
                }}
              >
                <View style={styles.recentItemLeft}>
                  <Text style={styles.recentItemName}>{seed.projectName || seed.name || seed.id}</Text>
                  <Text style={styles.recentItemId}>{seed.id}</Text>
                </View>
                {sec && (
                  <View style={[styles.riskBadge, { backgroundColor: riskBgColor(sec.riskLevel) }]}>
                    <Text style={styles.riskBadgeText}>{sec.riskLevel || "LOW"}</Text>
                  </View>
                )}
                <Text style={styles.recentItemArrow}>›</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  if (loading && !reports) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Ladataan raportteja…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Yritä uudelleen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  var tabs = [
    { key: TAB.SECURITY, label: "Turvallisuus", icon: "🔒" },
    { key: TAB.TESTS,    label: "Testit",        icon: "🧪" },
    { key: TAB.TIMING,   label: "Ajoitukset",    icon: "⏱"  }
  ];

  var secReport  = reports && (reports.security || reports.SECURITY || null);
  var testReport = reports && (reports.tests    || reports.TEST     || reports.jest || null);
  var phases     = artifact && (artifact.pipeline ? (artifact.pipeline.phases || {}) : (artifact.phases || {}));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Raportit</Text>
        {artifact && (
          <Text style={styles.headerSub}>{artifact.name || artifact.projectName || artifactId}</Text>
        )}
      </View>

      <View style={styles.tabBar}>
        {tabs.map(function(tab) {
          var isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={function() { setActiveTab(tab.key); }}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />}
      >
        {!reports && (
          <Card style={styles.noDataCard}>
            <Text style={styles.noDataText}>
              Tämä artefakti ei sisällä raportteja.{"\n"}
              Raportit syntyvät kun pipeline ajetaan SecurityPhase- ja TestPhase-vaiheiden kautta.
            </Text>
          </Card>
        )}

        {reports && (
          <Card style={styles.card}>
            {activeTab === TAB.SECURITY && (
              <View>
                <SectionHeader icon="🔒" title="Turvallisuusraportti"
                  badge={secReport ? secReport.riskLevel : null}
                  badgeVariant={secReport ? riskVariant(secReport.riskLevel) : null} />
                <SecurityReport data={secReport} />
              </View>
            )}
            {activeTab === TAB.TESTS && (
              <View>
                <SectionHeader icon="🧪" title="Testiraportti"
                  badge={testReport ? (testReport.total || 0) + " testiä" : null} />
                <TestReport data={testReport} />
              </View>
            )}
            {activeTab === TAB.TIMING && (
              <View>
                <SectionHeader icon="⏱" title="Pipeline-ajoitukset" />
                <TimingReport phases={phases} />
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Tyylit ──────────────────────────────────────────────────

var styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: COLORS.bg ? COLORS.bg.base : "#080c0a" },
  center:         { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl || 24 },
  loadingText:    { fontSize: 14, color: "#888", marginTop: 12 },
  errorText:      { fontSize: 14, color: "#dc2626", textAlign: "center", marginBottom: 12 },
  retryBtn:       { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  retryText:      { color: COLORS.primary, fontSize: 14 },
  header:         { padding: SPACING.lg || 16, paddingBottom: SPACING.sm || 8 },
  headerTitle:    { fontSize: 20, fontWeight: "700", color: COLORS.text ? COLORS.text.primary : "#fff" },
  headerSub:      { fontSize: 12, color: "#888", marginTop: 2 },
  tabBar:         { flexDirection: "row", borderBottomWidth: 1, borderColor: COLORS.border ? COLORS.border.subtle : "#222", paddingHorizontal: 16 },
  tab:            { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive:      { borderBottomColor: COLORS.primary },
  tabIcon:        { fontSize: 16, marginBottom: 2 },
  tabLabel:       { fontSize: 12, color: "#888" },
  tabLabelActive: { color: COLORS.primary, fontWeight: "600" },
  scroll:         { flex: 1 },
  scrollContent:  { padding: 16 },
  noDataCard:     { padding: 24, alignItems: "center" },
  noDataText:     { fontSize: 14, color: "#888", textAlign: "center", lineHeight: 22 },
  card:           { padding: 16, marginBottom: 16 },
  sectionHeader:  { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  sectionIcon:    { fontSize: 18, marginRight: 8 },
  sectionTitle:   { fontSize: 16, fontWeight: "700", color: COLORS.text ? COLORS.text.primary : "#fff", flex: 1 },
  emptySection:   { paddingVertical: 16 },
  emptyText:      { fontSize: 14, color: "#888", fontStyle: "italic" },
  subheader:      { fontSize: 12, fontWeight: "600", color: "#888", marginTop: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  riskRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  label:          { fontSize: 14, color: "#aaa" },
  auditGrid:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  auditCell:      { alignItems: "center", flex: 1 },
  auditCount:     { fontSize: 24, fontWeight: "700" },
  auditLabel:     { fontSize: 11, color: "#888", marginTop: 2 },
  advisoryList:   { marginTop: 8 },
  advisoryRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderColor: COLORS.border ? COLORS.border.subtle : "#222" },
  advisoryName:   { fontSize: 14, color: COLORS.text ? COLORS.text.primary : "#fff", flex: 1 },
  moreText:       { fontSize: 12, color: "#888", marginTop: 8 },
  secretRow:      { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 4 },
  secretIcon:     { fontSize: 16 },
  secretName:     { fontSize: 14, color: "#dc2626", fontWeight: "600" },
  secretFile:     { fontSize: 12, color: "#888" },
  blockedPkg:     { fontSize: 14, color: "#dc2626", paddingVertical: 2 },
  okText:         { fontSize: 14, color: "#16a34a" },
  warningBox:     { backgroundColor: "#fef3c720", borderRadius: 8, padding: 12, marginTop: 12 },
  warningText:    { fontSize: 13, color: "#ca8a04", marginBottom: 4 },
  testSummary:    { flexDirection: "row", justifyContent: "space-around", marginBottom: 16, paddingVertical: 12, backgroundColor: COLORS.bg ? COLORS.bg.surface : "#0d1410", borderRadius: 8 },
  testCell:       { alignItems: "center" },
  testCount:      { fontSize: 28, fontWeight: "700", color: COLORS.text ? COLORS.text.primary : "#fff" },
  testLabel:      { fontSize: 11, color: "#888" },
  suiteList:      { marginTop: 8 },
  suiteRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderColor: COLORS.border ? COLORS.border.subtle : "#222" },
  suiteOk:        { fontSize: 14, color: COLORS.text ? COLORS.text.primary : "#fff", flex: 1 },
  suiteFail:      { fontSize: 14, color: "#dc2626", flex: 1 },
  suiteMeta:      { fontSize: 12, color: "#888" },
  timingRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderColor: COLORS.border ? COLORS.border.subtle : "#222" },
  timingName:     { fontSize: 14, color: COLORS.text ? COLORS.text.primary : "#fff", flex: 1 },
  timingMs:       { fontSize: 14, color: "#aaa", marginRight: 8 },

  // Tab-moodistyylit
  emptyTab: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32 },
  emptyTabIcon: { fontSize: 48, marginBottom: 16 },
  emptyTabTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text ? COLORS.text.primary : "#fff", marginBottom: 8, textAlign: "center" },
  emptyTabText: { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 22 },
  recentItem: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.bg ? COLORS.bg.surface : "#111", borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border ? COLORS.border.subtle : "#222" },
  recentItemLeft: { flex: 1 },
  recentItemName: { fontSize: 15, fontWeight: "600", color: COLORS.text ? COLORS.text.primary : "#fff" },
  recentItemId: { fontSize: 11, color: "#888", marginTop: 2 },
  recentItemArrow: { color: "#888", fontSize: 20, marginLeft: 8 },
  riskBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  riskBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" }
});

export default ReportsScreen;