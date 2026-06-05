// ui/components/RightPanel/MetricsTab.js
// React Native

import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { COLORS, SIZES, FONTS } from "../../styles/theme.js";

function formatMs(ms) {
  if (!ms) return "0";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatNumber(n) {
  if (!n) return "0";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function MetricCard({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ProgressBar({ label, value, max, color }) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const barColor = percent > 80 ? COLORS.error : percent > 50 ? COLORS.warning : color || COLORS.lime;
  
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressPercent}>{percent.toFixed(0)}%</Text>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

export function MetricsTab({ metrics, status }) {
  if (!metrics && !status) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No metrics available</Text>
      </View>
    );
  }
  
  const uptimeMs = metrics?.uptimeMs || status?.uptimeMs || 0;
  const queueSize = metrics?.queueSize || status?.memory?.queue?.queueLength || 0;
  const runningJobs = metrics?.runningJobs || status?.memory?.queue?.runningCount || 0;
  const artifactCount = metrics?.artifactCount || status?.memory?.vault?.count || 0;
  const auditCount = metrics?.auditCount || status?.memory?.audit?.count || 0;
  const energyUsed = metrics?.energyUsed || status?.memory?.energy?.totalMs || 0;
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.grid}>
        <MetricCard label="UPTIME" value={formatMs(uptimeMs)} />
        <MetricCard label="QUEUE SIZE" value={queueSize.toString()} />
        <MetricCard label="RUNNING JOBS" value={runningJobs.toString()} />
        <MetricCard label="ARTIFACTS" value={formatNumber(artifactCount)} />
        <MetricCard label="AUDIT EVENTS" value={formatNumber(auditCount)} />
        <MetricCard label="ENERGY USED" value={formatMs(energyUsed)} />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MEMORY PRESSURE</Text>
        <ProgressBar label="Queue" value={queueSize} max={100} />
        <ProgressBar label="Artifact Vault" value={artifactCount} max={10000} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SIZES.md
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyText: {
    color: COLORS.gray500,
    fontSize: 13
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SIZES.sm
  },
  metric: {
    width: "48%",
    backgroundColor: COLORS.blackLight,
    padding: SIZES.md,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.gray700
  },
  metricLabel: {
    fontSize: 10,
    color: COLORS.gray500,
    marginBottom: SIZES.xs
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.lime,
    fontFamily: FONTS.mono
  },
  section: {
    marginTop: SIZES.lg
  },
  sectionTitle: {
    color: COLORS.gray400,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: SIZES.sm
  },
  progressContainer: {
    marginBottom: SIZES.md
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SIZES.xs
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.gray400
  },
  progressPercent: {
    fontSize: 11,
    color: COLORS.gray400
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.gray700,
    borderRadius: 4,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 4
  }
});

export default MetricsTab;