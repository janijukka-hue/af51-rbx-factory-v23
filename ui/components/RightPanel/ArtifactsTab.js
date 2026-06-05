// ui/components/RightPanel/ArtifactsTab.js
// React Native

import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, SIZES, FONTS } from "../../styles/theme.js";

function formatBytes(bytes) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ArtifactsTab({ artifacts, onDownload, onPublish }) {
  if (!artifacts || artifacts.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No artifacts yet</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      {artifacts.map((artifact) => (
        <View key={artifact.id} style={styles.artifact}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {artifact.metadata?.projectName || artifact.id}
            </Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{artifact.type}</Text>
            </View>
          </View>
          
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Platform: </Text>
              <Text style={styles.metaValue}>{artifact.metadata?.target || "-"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Size: </Text>
              <Text style={styles.metaValue}>{formatBytes(artifact.bytes)}</Text>
            </View>
          </View>
          
          {artifact.checksum && (
            <Text style={styles.checksum} numberOfLines={1}>
              SHA: {artifact.checksum}
            </Text>
          )}
          
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => onDownload?.(artifact)}
            >
              <Text style={styles.buttonText}>⬇ Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.publishButton]}
              onPress={() => onPublish?.(artifact)}
            >
              <Text style={styles.publishText}>⬆ Publish</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
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
  artifact: {
    backgroundColor: COLORS.blackLight,
    borderWidth: 1,
    borderColor: COLORS.gray700,
    borderRadius: SIZES.borderRadius,
    padding: SIZES.md,
    marginBottom: SIZES.sm
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SIZES.sm
  },
  name: {
    flex: 1,
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.gray200,
    fontWeight: "500"
  },
  typeBadge: {
    paddingVertical: 2,
    paddingHorizontal: SIZES.sm,
    backgroundColor: COLORS.gray700,
    borderRadius: SIZES.borderRadius,
    marginLeft: SIZES.sm
  },
  typeText: {
    fontSize: 10,
    color: COLORS.gray300
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SIZES.sm
  },
  metaItem: {
    flexDirection: "row"
  },
  metaLabel: {
    fontSize: 11,
    color: COLORS.gray500
  },
  metaValue: {
    fontSize: 11,
    color: COLORS.gray300,
    fontFamily: FONTS.mono
  },
  checksum: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.gray500,
    marginBottom: SIZES.sm
  },
  actions: {
    flexDirection: "row",
    gap: SIZES.sm
  },
  button: {
    flex: 1,
    paddingVertical: SIZES.sm,
    backgroundColor: COLORS.gray700,
    borderRadius: SIZES.borderRadius,
    alignItems: "center"
  },
  buttonText: {
    color: COLORS.gray300,
    fontSize: 11
  },
  publishButton: {
    backgroundColor: COLORS.limeMuted
  },
  publishText: {
    color: COLORS.lime,
    fontSize: 11
  }
});

export default ArtifactsTab;