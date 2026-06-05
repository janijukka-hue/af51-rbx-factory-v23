// ui/components/RightPanel/ManifestTab.js
// React Native

import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { COLORS, SIZES, FONTS } from "../../styles/theme.js";

export function ManifestTab({ manifest }) {
  if (!manifest) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No manifest available</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>PROJECT INFO</Text>
      <View style={styles.grid}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Kind</Text>
          <Text style={styles.fieldValue}>{manifest.projectKind || "-"}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Version</Text>
          <Text style={styles.fieldValue}>{manifest.version || "-"}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Stack</Text>
          <Text style={styles.fieldValue}>{manifest.stack || manifest.language || "-"}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Target</Text>
          <Text style={styles.fieldValue}>{manifest.target || "-"}</Text>
        </View>
      </View>
      
      {manifest.targets && manifest.targets.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TARGETS</Text>
          <View style={styles.list}>
            {manifest.targets.map((target, i) => (
              <Text key={i} style={styles.listItem}>{target}</Text>
            ))}
          </View>
        </View>
      )}
      
      {manifest.folderPlan && manifest.folderPlan.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FOLDER PLAN</Text>
          <View style={styles.list}>
            {manifest.folderPlan.map((item, i) => (
              <View key={i} style={styles.planItem}>
                <Text style={styles.planFile}>{item.file}</Text>
                {item.reason && <Text style={styles.planReason}>{item.reason}</Text>}
              </View>
            ))}
          </View>
        </View>
      )}
      
      {manifest.riskFlags && manifest.riskFlags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RISK FLAGS</Text>
          <View style={styles.flags}>
            {manifest.riskFlags.map((flag, i) => (
              <View key={i} style={styles.flag}>
                <Text style={styles.flagText}>{flag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
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
  section: {
    marginTop: SIZES.lg
  },
  sectionTitle: {
    color: COLORS.gray400,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: SIZES.sm
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SIZES.sm
  },
  field: {
    width: "48%",
    backgroundColor: COLORS.blackLight,
    padding: SIZES.sm,
    borderRadius: SIZES.borderRadius
  },
  fieldLabel: {
    fontSize: 10,
    color: COLORS.gray500,
    marginBottom: 2
  },
  fieldValue: {
    fontSize: 12,
    color: COLORS.gray200,
    fontFamily: FONTS.mono
  },
  list: {
    backgroundColor: COLORS.blackLight,
    padding: SIZES.sm,
    borderRadius: SIZES.borderRadius
  },
  listItem: {
    paddingVertical: SIZES.xs,
    fontSize: 12,
    color: COLORS.gray300,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray700
  },
  planItem: {
    paddingVertical: SIZES.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray700
  },
  planFile: {
    fontSize: 12,
    color: COLORS.lime,
    fontFamily: FONTS.mono
  },
  planReason: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 2
  },
  flags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SIZES.xs
  },
  flag: {
    backgroundColor: "rgba(255,165,0,0.2)",
    paddingVertical: 2,
    paddingHorizontal: SIZES.sm,
    borderRadius: SIZES.borderRadius
  },
  flagText: {
    fontSize: 10,
    color: COLORS.warning
  }
});

export default ManifestTab;