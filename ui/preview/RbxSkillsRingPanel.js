// ui/preview/RbxSkillsRingPanel.js
// Skills Ring Dashboard - Shows analysis from all 14 skills
// Version: 1.0.0

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

/**
 * RbxSkillsRingPanel - Displays Skills Ring analysis results
 * 
 * Shows insights from 14 skills across 4 domains:
 * - Creation (geometry, vehicles, architecture, characters, world)
 * - Analysis (semantic, obby, tycoon, rpg, performance, gameplay)
 * - Design (composition, preview)
 * - Production (quality gate)
 */
export function RbxSkillsRingPanel(props) {
  const { skillsRingResult } = props;

  if (!skillsRingResult || !skillsRingResult.results) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No Skills Ring data available</Text>
      </View>
    );
  }

  const results = skillsRingResult.results;

  // Extract key insights
  const semantic = results['semantic-analysis'];
  const vehicle = results['vehicle-analysis'];
  const composition = results['composition-analysis'];
  const geometry = results['geometry-analysis'];
  const performance = results['performance-analysis'];
  const gameplay = results['gameplay-analysis'];
  const quality = results['quality-gate'];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚡ SKILLS RING ANALYSIS</Text>
        <Text style={styles.subtitle}>
          {skillsRingResult.pipeline.length} skills · {skillsRingResult.energyUsed} energy
        </Text>
      </View>

      {/* Semantic Analysis */}
      {semantic && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 SEMANTIC ANALYSIS</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Intent:</Text>
            <Text style={styles.value}>{semantic.intent || 'unknown'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Confidence:</Text>
            <Text style={styles.value}>{semantic.confidence || 'low'}</Text>
          </View>
          {semantic.vehicles && semantic.vehicles.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Vehicles:</Text>
              <Text style={styles.value}>{semantic.vehicles.length}</Text>
            </View>
          )}
        </View>
      )}

      {/* Vehicle Analysis */}
      {vehicle && vehicle.vehicles && vehicle.vehicles.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚗 VEHICLE ANALYSIS</Text>
          {vehicle.vehicles.map((v, idx) => (
            <View key={idx} style={styles.subsection}>
              <Text style={styles.subsectionTitle}>{v.name}</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Type:</Text>
                <Text style={styles.value}>{v.type}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Wheels:</Text>
                <Text style={styles.value}>{v.wheelConfig.count} ({v.wheelConfig.layout})</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Quality:</Text>
                <Text style={[styles.value, getQualityColor(v.quality.score)]}>
                  {v.quality.rating} ({v.quality.score}/100)
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Symmetry:</Text>
                <Text style={styles.value}>{v.symmetry.balance}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Composition */}
      {composition && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎨 COMPOSITION</Text>
          {composition.hero && (
            <View style={styles.row}>
              <Text style={styles.label}>Hero:</Text>
              <Text style={styles.value}>{composition.hero.name} ({composition.hero.type})</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Quality:</Text>
            <Text style={[styles.value, getQualityColor(composition.quality.score)]}>
              {composition.quality.rating} ({composition.quality.score}/100)
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Balance:</Text>
            <Text style={styles.value}>{composition.balance.quality}</Text>
          </View>
        </View>
      )}

      {/* Geometry */}
      {geometry && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📐 GEOMETRY</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Primitives:</Text>
            <Text style={styles.value}>
              {geometry.primitives.total} ({geometry.primitives.blocks}B {geometry.primitives.cylinders}C {geometry.primitives.balls}S)
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Symmetry:</Text>
            <Text style={styles.value}>{geometry.symmetry.balance}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Complexity:</Text>
            <Text style={styles.value}>{geometry.complexity.level} ({geometry.complexity.score}/100)</Text>
          </View>
        </View>
      )}

      {/* Performance */}
      {performance && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ PERFORMANCE</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Draw Calls:</Text>
            <Text style={styles.value}>{performance.drawCalls.estimated} ({performance.drawCalls.level})</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Memory:</Text>
            <Text style={styles.value}>{performance.memory.estimatedMB} MB ({performance.memory.level})</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Mobile Ready:</Text>
            <Text style={[styles.value, performance.mobileReadiness.ready ? styles.green : styles.red]}>
              {performance.mobileReadiness.level} ({performance.mobileReadiness.score}/100)
            </Text>
          </View>
        </View>
      )}

      {/* Quality Gate */}
      {quality && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ QUALITY GATE</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Overall:</Text>
            <Text style={[styles.valueLarge, getQualityColor(quality.scores.overall)]}>
              {quality.scores.overall}/100
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Verdict:</Text>
            <Text style={[styles.value, quality.ready ? styles.green : styles.amber]}>
              {quality.verdict}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tier:</Text>
            <Text style={styles.value}>{quality.tier}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function getQualityColor(score) {
  if (score >= 80) return styles.green;
  if (score >= 60) return styles.amber;
  return styles.red;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3a4d",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#25D0FF",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 11,
    color: "#56697d",
    marginTop: 4,
  },
  emptyText: {
    textAlign: "center",
    color: "#56697d",
    fontSize: 13,
    marginTop: 40,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a2534",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9fb2c8",
    marginBottom: 8,
  },
  subsection: {
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#2a3a4d",
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7a90a8",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 2,
  },
  label: {
    fontSize: 11,
    color: "#56697d",
    fontWeight: "600",
  },
  value: {
    fontSize: 11,
    color: "#9fb2c8",
    fontWeight: "600",
  },
  valueLarge: {
    fontSize: 16,
    fontWeight: "700",
  },
  green: { color: "#5BE49B" },
  amber: { color: "#F2C94C" },
  red: { color: "#FF6B6B" },
});

export default RbxSkillsRingPanel;
