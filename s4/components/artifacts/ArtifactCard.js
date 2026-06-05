// s4/components/artifacts/ArtifactCard.js
// ALX Factory - Artifact Card Component
// Version: 1.0.0

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Badge, BADGE_VARIANT } from "../common/Badge.js";
import { EnergyMeter } from "../factory/EnergyMeter.js";
import { formatBytes, formatRelativeTime } from "../../utils/formatters.js";

var TYPE_COLORS = {
  CALM: COLORS.primary,
  COMPONENT: COLORS.status.info,
  MODULE: COLORS.status.success,
  APPLICATION: COLORS.status.warning,
  LIBRARY: COLORS.factory.artifact,
  CONFIG: COLORS.text.muted,
  TEST: COLORS.factory.testing
};

function ArtifactCard(props) {
  var artifact = props.artifact;
  var onPress = props.onPress;
  var onLongPress = props.onLongPress;
  var selected = props.selected || false;
  var compact = props.compact || false;
  var showEnergy = props.showEnergy !== false;
  var showPreview = props.showPreview || false;
  var style = props.style;

  var typeColor = TYPE_COLORS[artifact.type] || COLORS.primary;

  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={[styles.compactContainer, selected && styles.selected, style]}
      >
        <View style={[styles.typeIndicator, { backgroundColor: typeColor }]} />
        <View style={styles.compactContent}>
          <Text style={styles.compactName} numberOfLines={1}>
            {artifact.title || artifact.name}
          </Text>
          <Text style={styles.compactMeta}>
            {artifact.language} · {formatBytes(artifact.size)}
          </Text>
        </View>
        <Badge
          variant={BADGE_VARIANT.DEFAULT}
          label={artifact.fileCount + " files"}
          size="sm"
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.container, selected && styles.selected, style]}
    >
      <View style={[styles.typeIndicator, { backgroundColor: typeColor }]} />

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {artifact.title || artifact.name}
            </Text>
            <Badge
              variant={BADGE_VARIANT.PRIMARY}
              label={artifact.type}
              size="sm"
            />
          </View>

          {artifact.description && (
            <Text style={styles.description} numberOfLines={2}>
              {artifact.description}
            </Text>
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Language</Text>
            <Text style={styles.metaValue}>{artifact.language}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Files</Text>
            <Text style={styles.metaValue}>{artifact.fileCount}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Size</Text>
            <Text style={styles.metaValue}>{formatBytes(artifact.size)}</Text>
          </View>
        </View>

        {showEnergy && (
          <EnergyMeter
            energy={artifact.energy}
            maxEnergy={100}
            size="sm"
            style={styles.energy}
          />
        )}

        {showPreview && artifact.code && (
          <View style={styles.preview}>
            <Text style={styles.previewCode} numberOfLines={3}>
              {artifact.code.substring(0, 150)}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.timestamp}>
            {formatRelativeTime(artifact.createdAt)}
          </Text>
          {artifact.version && (
            <Text style={styles.version}>v{artifact.version}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ArtifactCardSkeleton(props) {
  var compact = props.compact || false;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.skeleton, styles.skeletonIndicator]} />
        <View style={styles.compactContent}>
          <View style={[styles.skeleton, styles.skeletonTitle]} />
          <View style={[styles.skeleton, styles.skeletonMeta]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.skeleton, styles.skeletonIndicator]} />
      <View style={styles.content}>
        <View style={[styles.skeleton, styles.skeletonTitle]} />
        <View style={[styles.skeleton, styles.skeletonDescription]} />
        <View style={styles.metaRow}>
          <View style={[styles.skeleton, styles.skeletonMetaItem]} />
          <View style={[styles.skeleton, styles.skeletonMetaItem]} />
          <View style={[styles.skeleton, styles.skeletonMetaItem]} />
        </View>
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: COLORS.bg.surface,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border.subtle
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg.surface,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border.subtle
  },
  selected: {
    borderColor: COLORS.primary,
    borderWidth: 2
  },
  typeIndicator: {
    width: 4
  },
  content: {
    flex: 1,
    padding: SPACING.md
  },
  compactContent: {
    flex: 1,
    marginLeft: SPACING.sm
  },
  header: {
    marginBottom: SPACING.sm
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xs
  },
  title: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    flex: 1,
    marginRight: SPACING.sm
  },
  compactName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: "600"
  },
  compactMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  description: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.secondary
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: SPACING.sm
  },
  metaItem: {
    marginRight: SPACING.lg
  },
  metaLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  metaValue: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.primary,
    fontWeight: "500"
  },
  energy: {
    marginBottom: SPACING.sm
  },
  preview: {
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm
  },
  previewCode: {
    ...TYPOGRAPHY.code,
    color: COLORS.text.secondary,
    fontSize: 11
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  timestamp: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  version: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  skeleton: {
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.sm
  },
  skeletonIndicator: {
    width: 4,
    height: "100%"
  },
  skeletonTitle: {
    height: 20,
    width: "60%",
    marginBottom: SPACING.xs
  },
  skeletonDescription: {
    height: 14,
    width: "80%",
    marginBottom: SPACING.sm
  },
  skeletonMeta: {
    height: 12,
    width: "40%"
  },
  skeletonMetaItem: {
    height: 14,
    width: 60,
    marginRight: SPACING.lg
  }
});

export { ArtifactCard, ArtifactCardSkeleton, TYPE_COLORS };
export default ArtifactCard;