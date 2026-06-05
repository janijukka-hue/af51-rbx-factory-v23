// ui/components/Sidebar.js
// Enterprise Sidebar Component

import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { COLORS, SIZES, SHADOWS } from "../styles/theme.js";
import { GlowButton } from "./common/GlowButton.js";
import { Card } from "./common/Card.js";
import { MetricCard } from "./common/MetricCard.js";

export function Sidebar(props) {
  var onBuild = props.onBuild;
  var onPublish = props.onPublish;
  var onAnalyze = props.onAnalyze;
  var onStatus = props.onStatus;
  var onHelp = props.onHelp;
  var onMemory = props.onMemory;
  var isRunning = props.isRunning;
  var alxStatus = props.alxStatus;
  var factoryStatus = props.factoryStatus;
  
  var executionCount = alxStatus && alxStatus.executionCount ? alxStatus.executionCount : 0;
  var errorCount = alxStatus && alxStatus.errorCount ? alxStatus.errorCount : 0;
  var skillCount = alxStatus && alxStatus.skills ? alxStatus.skills.totalSkills : 0;
  var memoryUsage = alxStatus && alxStatus.memory ? Math.round(alxStatus.memory.utilization * 100) : 0;
  
  return (
    <View style={styles.sidebar}>
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ QUICK ACTIONS</Text>
          <View style={styles.buttonGroup}>
            <GlowButton
              title="Build"
              icon="🔨"
              variant="cyan"
              size="md"
              fullWidth
              onPress={onBuild}
              disabled={isRunning}
            />
            <GlowButton
              title="Publish"
              icon="🚀"
              variant="purple"
              size="md"
              fullWidth
              onPress={onPublish}
              disabled={isRunning}
            />
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛠 TOOLS</Text>
          <View style={styles.toolGrid}>
            <TouchableOpacity style={styles.toolButton} onPress={onAnalyze}>
              <Text style={styles.toolIcon}>🔍</Text>
              <Text style={styles.toolLabel}>Analyze</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={onStatus}>
              <Text style={styles.toolIcon}>📊</Text>
              <Text style={styles.toolLabel}>Status</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={onMemory}>
              <Text style={styles.toolIcon}>🧠</Text>
              <Text style={styles.toolLabel}>Memory</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={onHelp}>
              <Text style={styles.toolIcon}>❓</Text>
              <Text style={styles.toolLabel}>Help</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 METRICS</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{executionCount}</Text>
              <Text style={styles.metricLabel}>Executions</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, errorCount > 0 && styles.metricError]}>
                {errorCount}
              </Text>
              <Text style={styles.metricLabel}>Errors</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{skillCount}</Text>
              <Text style={styles.metricLabel}>Skills</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{memoryUsage}%</Text>
              <Text style={styles.metricLabel}>Memory</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 COMMANDS</Text>
          <View style={styles.commandList}>
            <CommandItem cmd="status" desc="System status" />
            <CommandItem cmd="help" desc="Show help" />
            <CommandItem cmd="memory" desc="View memory" />
            <CommandItem cmd="audit" desc="Audit log" />
            <CommandItem cmd="build" desc="Build project" />
            <CommandItem cmd="analyze" desc="Analyze code" />
          </View>
        </View>
        
      </ScrollView>
    </View>
  );
}

function CommandItem(props) {
  return (
    <View style={styles.commandItem}>
      <Text style={styles.commandText}>{props.cmd}</Text>
      <Text style={styles.commandDesc}>{props.desc}</Text>
    </View>
  );
}

var styles = StyleSheet.create({
  sidebar: {
    width: 260,
    backgroundColor: COLORS.panelBg,
    borderRightWidth: 1,
    borderRightColor: COLORS.border
  },
  scrollArea: {
    flex: 1,
    padding: SIZES.lg
  },
  section: {
    marginBottom: SIZES.xl
  },
  sectionTitle: {
    fontSize: SIZES.fontXs,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginBottom: SIZES.md
  },
  buttonGroup: {
    gap: SIZES.sm
  },
  toolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SIZES.sm
  },
  toolButton: {
    width: "47%",
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    alignItems: "center",
    gap: 6
  },
  toolIcon: {
    fontSize: 22
  },
  toolLabel: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
    fontWeight: "500"
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SIZES.sm
  },
  metricItem: {
    width: "47%",
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    alignItems: "center"
  },
  metricValue: {
    fontSize: SIZES.fontXl,
    fontWeight: "700",
    color: COLORS.cyan
  },
  metricError: {
    color: COLORS.error
  },
  metricLabel: {
    fontSize: SIZES.fontXs,
    color: COLORS.textMuted,
    marginTop: 2
  },
  commandList: {
    gap: 6
  },
  commandItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.cardBg,
    borderRadius: SIZES.radiusSm,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  commandText: {
    fontSize: SIZES.fontSm,
    fontFamily: "monospace",
    color: COLORS.cyan,
    fontWeight: "600"
  },
  commandDesc: {
    fontSize: SIZES.fontXs,
    color: COLORS.textMuted
  }
});

export default Sidebar;