// ui/components/RightPanel.js
// Enterprise Right Panel - Logs, Jobs, Artifacts

import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { COLORS, SIZES, SHADOWS } from "../styles/theme.js";
import { Card } from "./common/Card.js";
import { StatusBadge } from "./common/StatusBadge.js";

export function RightPanel(props) {
  var logs = props.logs || [];
  var jobs = props.jobs || [];
  var artifacts = props.artifacts || [];
  var onClearLogs = props.onClearLogs;
  
  var tabState = useState("logs");
  var activeTab = tabState[0];
  var setActiveTab = tabState[1];
  
  return (
    <View style={styles.panel}>
      <View style={styles.tabs}>
        <TabButton
          label="Logs"
          count={logs.length}
          active={activeTab === "logs"}
          onPress={function() { setActiveTab("logs"); }}
        />
        <TabButton
          label="Jobs"
          count={jobs.length}
          active={activeTab === "jobs"}
          onPress={function() { setActiveTab("jobs"); }}
        />
        <TabButton
          label="Artifacts"
          count={artifacts.length}
          active={activeTab === "artifacts"}
          onPress={function() { setActiveTab("artifacts"); }}
        />
      </View>
      
      <View style={styles.content}>
        {activeTab === "logs" && (
          <LogsTab logs={logs} onClear={onClearLogs} />
        )}
        {activeTab === "jobs" && (
          <JobsTab jobs={jobs} />
        )}
        {activeTab === "artifacts" && (
          <ArtifactsTab artifacts={artifacts} />
        )}
      </View>
    </View>
  );
}

function TabButton(props) {
  var label = props.label;
  var count = props.count;
  var active = props.active;
  var onPress = props.onPress;
  
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
          <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function LogsTab(props) {
  var logs = props.logs || [];
  var onClear = props.onClear;
  
  var getLevelStyle = function(level) {
    if (level === "ERROR") return { color: COLORS.error, bg: COLORS.errorBg };
    if (level === "WARN") return { color: COLORS.warning, bg: COLORS.warningBg };
    if (level === "INFO") return { color: COLORS.cyan, bg: COLORS.cyanBg };
    return { color: COLORS.textMuted, bg: COLORS.cardBg };
  };
  
  return (
    <View style={styles.tabContent}>
      {logs.length > 0 && onClear && (
        <TouchableOpacity style={styles.clearButton} onPress={onClear}>
          <Text style={styles.clearButtonText}>Clear Logs</Text>
        </TouchableOpacity>
      )}
      
      <ScrollView style={styles.scrollArea}>
        {logs.length === 0 && (
          <View style={styles.emptyTab}>
            <Text style={styles.emptyTabText}>No logs yet</Text>
          </View>
        )}
        
        {logs.slice(-50).reverse().map(function(log, index) {
          var levelStyle = getLevelStyle(log.level);
          var time = new Date(log.timestamp).toLocaleTimeString("fi-FI", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          });
          
          return (
            <View key={index} style={styles.logItem}>
              <View style={styles.logHeader}>
                <View style={[styles.logLevel, { backgroundColor: levelStyle.bg }]}>
                  <Text style={[styles.logLevelText, { color: levelStyle.color }]}>
                    {log.level}
                  </Text>
                </View>
                <Text style={styles.logTime}>{time}</Text>
              </View>
              <Text style={styles.logMessage}>{log.message}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function JobsTab(props) {
  var jobs = props.jobs || [];
  
  var getJobStatus = function(status) {
    if (status === "COMPLETED") return "success";
    if (status === "RUNNING") return "running";
    if (status === "FAILED") return "error";
    if (status === "QUEUED") return "idle";
    return "idle";
  };
  
  return (
    <ScrollView style={styles.tabContent}>
      {jobs.length === 0 && (
        <View style={styles.emptyTab}>
          <Text style={styles.emptyTabText}>No jobs</Text>
        </View>
      )}
      
      {jobs.map(function(job, index) {
        return (
          <View key={job.id || index} style={styles.jobItem}>
            <View style={styles.jobHeader}>
              <Text style={styles.jobName}>{job.name || "Job " + (index + 1)}</Text>
              <StatusBadge status={getJobStatus(job.status)} size="sm" />
            </View>
            {job.duration && (
              <Text style={styles.jobDuration}>{job.duration}ms</Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function ArtifactsTab(props) {
  var artifacts = props.artifacts || [];
  
  return (
    <ScrollView style={styles.tabContent}>
      {artifacts.length === 0 && (
        <View style={styles.emptyTab}>
          <Text style={styles.emptyTabText}>No artifacts</Text>
        </View>
      )}
      
      {artifacts.map(function(artifact, index) {
        return (
          <View key={artifact.id || index} style={styles.artifactItem}>
            <Text style={styles.artifactIcon}>📦</Text>
            <View style={styles.artifactInfo}>
              <Text style={styles.artifactName}>{artifact.name || "Artifact"}</Text>
              <Text style={styles.artifactMeta}>
                {artifact.type || "unknown"} • {artifact.size || "0 KB"}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

var styles = StyleSheet.create({
  panel: {
    width: 300,
    backgroundColor: COLORS.panelBg,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SIZES.md,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent"
  },
  tabActive: {
    borderBottomColor: COLORS.cyan
  },
  tabLabel: {
    fontSize: SIZES.fontSm,
    fontWeight: "600",
    color: COLORS.textMuted
  },
  tabLabelActive: {
    color: COLORS.cyan
  },
  tabBadge: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: SIZES.radiusFull
  },
  tabBadgeActive: {
    backgroundColor: COLORS.cyanBg
  },
  tabBadgeText: {
    fontSize: SIZES.fontXs,
    fontWeight: "700",
    color: COLORS.textMuted
  },
  tabBadgeTextActive: {
    color: COLORS.cyan
  },
  content: {
    flex: 1
  },
  tabContent: {
    flex: 1,
    padding: SIZES.md
  },
  scrollArea: {
    flex: 1
  },
  emptyTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40
  },
  emptyTabText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textMuted
  },
  clearButton: {
    alignSelf: "flex-end",
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    marginBottom: SIZES.sm
  },
  clearButtonText: {
    fontSize: SIZES.fontXs,
    color: COLORS.textMuted
  },
  logItem: {
    backgroundColor: COLORS.cardBg,
    borderRadius: SIZES.radiusSm,
    padding: SIZES.sm,
    marginBottom: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  logLevel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: SIZES.radiusSm
  },
  logLevelText: {
    fontSize: SIZES.fontXs,
    fontWeight: "700"
  },
  logTime: {
    fontSize: SIZES.fontXs,
    color: COLORS.textDark,
    fontFamily: "monospace"
  },
  logMessage: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    lineHeight: 18
  },
  jobItem: {
    backgroundColor: COLORS.cardBg,
    borderRadius: SIZES.radiusSm,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  jobName: {
    fontSize: SIZES.fontSm,
    fontWeight: "600",
    color: COLORS.textPrimary
  },
  jobDuration: {
    fontSize: SIZES.fontXs,
    color: COLORS.textMuted,
    marginTop: 4
  },
  artifactItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: SIZES.radiusSm,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12
  },
  artifactIcon: {
    fontSize: 24
  },
  artifactInfo: {
    flex: 1
  },
  artifactName: {
    fontSize: SIZES.fontSm,
    fontWeight: "600",
    color: COLORS.textPrimary
  },
  artifactMeta: {
    fontSize: SIZES.fontXs,
    color: COLORS.textMuted,
    marginTop: 2
  }
});

export default RightPanel;