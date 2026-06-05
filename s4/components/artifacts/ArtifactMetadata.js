// s4/components/artifacts/ArtifactMetadata.js
// ALX Factory - Artifact Metadata Component
// Version: 1.0.0

import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Badge, BADGE_VARIANT } from "../common/Badge.js";
import { CodeBlock } from "../data/CodeBlock.js";
import { formatBytes, formatRelativeTime, formatISODate } from "../../utils/formatters.js";

function ArtifactMetadata(props) {
  var artifact = props.artifact;
  var expanded = props.expanded || false;
  var onToggleExpand = props.onToggleExpand;
  var style = props.style;

  var showRawState = useState(false);
  var showRaw = showRawState[0];
  var setShowRaw = showRawState[1];

  if (!artifact) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Info</Text>
        <MetadataRow label="ID" value={artifact.id} selectable />
        <MetadataRow label="Name" value={artifact.title || artifact.name} />
        <MetadataRow label="Type" value={artifact.type} />
        <MetadataRow label="Language" value={artifact.language} />
        <MetadataRow label="Version" value={artifact.version || "1.0.0"} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <MetadataRow label="Files" value={artifact.fileCount + " files"} />
        <MetadataRow label="Total Size" value={formatBytes(artifact.size)} />
        <MetadataRow label="Energy" value={artifact.energy + " / 100"} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timestamps</Text>
        <MetadataRow
          label="Created"
          value={formatISODate(artifact.createdAt) + " (" + formatRelativeTime(artifact.createdAt) + ")"}
        />
        {artifact.updatedAt && artifact.updatedAt !== artifact.createdAt && (
          <MetadataRow
            label="Updated"
            value={formatISODate(artifact.updatedAt) + " (" + formatRelativeTime(artifact.updatedAt) + ")"}
          />
        )}
      </View>

      {artifact.buildId && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Build Info</Text>
          <MetadataRow label="Build ID" value={artifact.buildId} selectable />
        </View>
      )}

      {artifact.tags && artifact.tags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagsRow}>
            {artifact.tags.map(function(tag, index) {
              return (
                <Badge
                  key={index}
                  variant={BADGE_VARIANT.DEFAULT}
                  label={tag}
                  size="sm"
                  style={styles.tag}
                />
              );
            })}
          </View>
        </View>
      )}

      {artifact.dependencies && artifact.dependencies.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dependencies</Text>
          {artifact.dependencies.map(function(dep, index) {
            var depStr = typeof dep === "string" ? dep : dep.name + "@" + (dep.version || "*");
            return (
              <Text key={index} style={styles.dependency}>
                • {depStr}
              </Text>
            );
          })}
        </View>
      )}

      {artifact.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{artifact.description}</Text>
        </View>
      )}

      {artifact.metadata && Object.keys(artifact.metadata).length > 0 && (
        <View style={styles.section}>
          <Pressable
            onPress={function() { setShowRaw(!showRaw); }}
            style={styles.sectionHeader}
          >
            <Text style={styles.sectionTitle}>Raw Metadata</Text>
            <Text style={styles.expandIcon}>{showRaw ? "▼" : "▶"}</Text>
          </Pressable>
          
          {showRaw && (
            <CodeBlock
              code={JSON.stringify(artifact.metadata, null, 2)}
              language="json"
              maxHeight={200}
            />
          )}
        </View>
      )}
    </View>
  );
}

function MetadataRow(props) {
  var label = props.label;
  var value = props.value;
  var selectable = props.selectable || false;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={styles.value}
        selectable={selectable}
        numberOfLines={selectable ? undefined : 1}
      >
        {value}
      </Text>
    </View>
  );
}

function MetadataTable(props) {
  var data = props.data || {};
  var style = props.style;

  var entries = Object.entries(data);

  if (entries.length === 0) {
    return null;
  }

  return (
    <View style={[styles.table, style]}>
      {entries.map(function(entry, index) {
        var key = entry[0];
        var val = entry[1];
        var displayValue = typeof val === "object" ? JSON.stringify(val) : String(val);

        return (
          <MetadataRow
            key={index}
            label={key}
            value={displayValue}
          />
        );
      })}
    </View>
  );
}

var styles = StyleSheet.create({
  container: {},
  section: {
    marginBottom: SPACING.md
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.xs
  },
  expandIcon: {
    fontSize: 10,
    color: COLORS.text.muted
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  label: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.muted,
    flex: 1
  },
  value: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.primary,
    flex: 2,
    textAlign: "right"
  },
  table: {},
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  tag: {
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs
  },
  dependency: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs
  },
  description: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary
  }
});

export { ArtifactMetadata, MetadataRow, MetadataTable };
export default ArtifactMetadata;