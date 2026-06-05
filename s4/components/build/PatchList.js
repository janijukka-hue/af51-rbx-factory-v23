// s4/components/build/PatchList.js
// ALX Factory - Patch List Component
// Version: 1.0.0

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Card } from "../common/Card.js";
import { Badge, BADGE_VARIANT } from "../common/Badge.js";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "../common/Button.js";
import { PatchEditor, NewPatchForm, OPERATION_CONFIG } from "./PatchEditor.js";

function PatchList(props) {
  var patches = props.patches || [];
  var onAddPatch = props.onAddPatch;
  var onUpdatePatch = props.onUpdatePatch;
  var onRemovePatch = props.onRemovePatch;
  var onReorderPatches = props.onReorderPatches;
  var style = props.style;

  var expandedState = useState(null);
  var expandedId = expandedState[0];
  var setExpandedId = expandedState[1];

  var showNewFormState = useState(false);
  var showNewForm = showNewFormState[0];
  var setShowNewForm = showNewFormState[1];

  var handleToggleExpand = useCallback(function(patchId) {
    setExpandedId(function(prev) {
      return prev === patchId ? null : patchId;
    });
  }, [setExpandedId]);

  var handleAdd = useCallback(function(patchData) {
    onAddPatch(patchData.op, patchData.path, patchData.value, patchData.from);
    setShowNewForm(false);
  }, [onAddPatch, setShowNewForm]);

  var handleMoveUp = useCallback(function(index) {
    if (index > 0) {
      onReorderPatches(index, index - 1);
    }
  }, [onReorderPatches]);

  var handleMoveDown = useCallback(function(index) {
    if (index < patches.length - 1) {
      onReorderPatches(index, index + 1);
    }
  }, [onReorderPatches, patches.length]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Patches</Text>
          <Badge
            variant={BADGE_VARIANT.DEFAULT}
            label={patches.length + " patches"}
            size="sm"
          />
        </View>
        <Button
          variant={BUTTON_VARIANT.PRIMARY}
          size={BUTTON_SIZE.SM}
          onPress={function() { setShowNewForm(!showNewForm); }}
        >
          {showNewForm ? "Cancel" : "+ Add"}
        </Button>
      </View>

      <Text style={styles.description}>
        Patches are applied in order using JSON Patch operations (RFC 6902)
      </Text>

      {showNewForm && (
        <NewPatchForm
          onAdd={handleAdd}
          style={styles.newForm}
        />
      )}

      {patches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyText}>No patches defined</Text>
          <Text style={styles.emptyHint}>
            Add patches to modify the template output
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {patches.map(function(patch, index) {
            return (
              <PatchEditor
                key={patch.id}
                patch={patch}
                index={index}
                expanded={expandedId === patch.id}
                onToggleExpand={function() { handleToggleExpand(patch.id); }}
                onChange={function(updated) { onUpdatePatch(patch.id, updated); }}
                onDelete={function() { onRemovePatch(patch.id); }}
                onMoveUp={function() { handleMoveUp(index); }}
                onMoveDown={function() { handleMoveDown(index); }}
                canMoveUp={index > 0}
                canMoveDown={index < patches.length - 1}
              />
            );
          })}
        </View>
      )}

      {patches.length > 0 && (
        <PatchPreview patches={patches} />
      )}
    </View>
  );
}

function PatchPreview(props) {
  var patches = props.patches || [];

  var showPreviewState = useState(false);
  var showPreview = showPreviewState[0];
  var setShowPreview = showPreviewState[1];

  return (
    <Card style={styles.previewCard}>
      <View style={styles.previewHeader}>
        <Text style={styles.previewTitle}>Patch Preview</Text>
        <Button
          variant={BUTTON_VARIANT.GHOST}
          size={BUTTON_SIZE.SM}
          onPress={function() { setShowPreview(!showPreview); }}
        >
          {showPreview ? "Hide" : "Show"}
        </Button>
      </View>

      {showPreview && (
        <ScrollView style={styles.previewContent} horizontal>
          <Text style={styles.previewCode}>
            {JSON.stringify(patches.map(function(p) {
              var clean = { op: p.op, path: p.path };
              if (p.value !== undefined) clean.value = p.value;
              if (p.from) clean.from = p.from;
              return clean;
            }), null, 2)}
          </Text>
        </ScrollView>
      )}
    </Card>
  );
}

function PatchSummary(props) {
  var patches = props.patches || [];
  var compact = props.compact || false;
  var style = props.style;

  var counts = {};
  Object.keys(OPERATION_CONFIG).forEach(function(op) {
    counts[op] = 0;
  });

  patches.forEach(function(p) {
    if (counts[p.op] !== undefined) {
      counts[p.op]++;
    }
  });

  if (compact) {
    return (
      <View style={[styles.summaryCompact, style]}>
        {Object.keys(counts).map(function(op) {
          if (counts[op] === 0) return null;
          var config = OPERATION_CONFIG[op];
          return (
            <View key={op} style={styles.summaryItem}>
              <Text style={[styles.summaryIcon, { color: config.color }]}>
                {config.icon}
              </Text>
              <Text style={styles.summaryCount}>{counts[op]}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.summary, style]}>
      {Object.keys(counts).map(function(op) {
        var config = OPERATION_CONFIG[op];
        return (
          <View key={op} style={styles.summaryRow}>
            <View style={[styles.summaryDot, { backgroundColor: config.color }]} />
            <Text style={styles.summaryLabel}>{config.label}</Text>
            <Text style={styles.summaryValue}>{counts[op]}</Text>
          </View>
        );
      })}
    </View>
  );
}

var styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xs
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  title: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    marginRight: SPACING.sm
  },
  description: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.muted,
    marginBottom: SPACING.md
  },
  newForm: {
    marginBottom: SPACING.md
  },
  list: {},
  emptyContainer: {
    alignItems: "center",
    padding: SPACING.xl,
    backgroundColor: COLORS.bg.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border.subtle,
    borderStyle: "dashed"
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: SPACING.sm
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs
  },
  emptyHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  previewCard: {
    marginTop: SPACING.md
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  previewTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.secondary
  },
  previewContent: {
    marginTop: SPACING.sm,
    maxHeight: 200
  },
  previewCode: {
    ...TYPOGRAPHY.code,
    color: COLORS.text.primary,
    fontSize: 11
  },
  summary: {},
  summaryCompact: {
    flexDirection: "row",
    alignItems: "center"
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: SPACING.sm
  },
  summaryIcon: {
    fontSize: 12,
    marginRight: 2
  },
  summaryCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm
  },
  summaryLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.secondary,
    flex: 1
  },
  summaryValue: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.primary,
    fontWeight: "600"
  }
});

export { PatchList, PatchPreview, PatchSummary };
export default PatchList;