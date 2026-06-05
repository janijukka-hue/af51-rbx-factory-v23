// s4/components/build/PatchEditor.js
// ALX Factory - Patch Editor Component
// Version: 1.0.0

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Input, TextArea } from "../common/Input.js";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "../common/Button.js";
import { Card } from "../common/Card.js";
import { Badge, BADGE_VARIANT } from "../common/Badge.js";
import { PATCH_OPERATION } from "../../services/BuildService.js";

var OPERATION_CONFIG = {
  add: { label: "Add", icon: "+", color: COLORS.status.success, needsValue: true },
  remove: { label: "Remove", icon: "−", color: COLORS.status.error, needsValue: false },
  replace: { label: "Replace", icon: "↔", color: COLORS.status.warning, needsValue: true },
  move: { label: "Move", icon: "→", color: COLORS.status.info, needsFrom: true },
  copy: { label: "Copy", icon: "⎘", color: COLORS.primary, needsFrom: true },
  test: { label: "Test", icon: "?", color: COLORS.text.muted, needsValue: true }
};

function PatchEditor(props) {
  var patch = props.patch;
  var onChange = props.onChange;
  var onDelete = props.onDelete;
  var onMoveUp = props.onMoveUp;
  var onMoveDown = props.onMoveDown;
  var canMoveUp = props.canMoveUp;
  var canMoveDown = props.canMoveDown;
  var expanded = props.expanded || false;
  var onToggleExpand = props.onToggleExpand;
  var index = props.index;
  var style = props.style;

  var opConfig = OPERATION_CONFIG[patch.op] || OPERATION_CONFIG.add;

  var handleChange = useCallback(function(field, value) {
    onChange({ ...patch, [field]: value });
  }, [patch, onChange]);

  if (!expanded) {
    return (
      <Pressable
        onPress={onToggleExpand}
        style={[styles.collapsedContainer, style]}
      >
        <View style={[styles.opIndicator, { backgroundColor: opConfig.color }]}>
          <Text style={styles.opIcon}>{opConfig.icon}</Text>
        </View>
        <View style={styles.collapsedContent}>
          <Text style={styles.collapsedOp}>{opConfig.label}</Text>
          <Text style={styles.collapsedPath} numberOfLines={1}>
            {patch.path}
          </Text>
        </View>
        <Text style={styles.expandIcon}>▼</Text>
      </Pressable>
    );
  }

  return (
    <Card style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Badge
            variant={BADGE_VARIANT.DEFAULT}
            label={"#" + (index + 1)}
            size="sm"
          />
          <Text style={styles.headerTitle}>Patch</Text>
        </View>
        <View style={styles.headerActions}>
          {canMoveUp && (
            <Pressable onPress={onMoveUp} style={styles.moveButton}>
              <Text style={styles.moveIcon}>↑</Text>
            </Pressable>
          )}
          {canMoveDown && (
            <Pressable onPress={onMoveDown} style={styles.moveButton}>
              <Text style={styles.moveIcon}>↓</Text>
            </Pressable>
          )}
          <Pressable onPress={onToggleExpand} style={styles.collapseButton}>
            <Text style={styles.collapseIcon}>▲</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.operations}>
        {Object.keys(OPERATION_CONFIG).map(function(op) {
          var config = OPERATION_CONFIG[op];
          var isSelected = patch.op === op;

          return (
            <Pressable
              key={op}
              onPress={function() { handleChange("op", op); }}
              style={[
                styles.opButton,
                isSelected && { backgroundColor: config.color + "20", borderColor: config.color }
              ]}
            >
              <Text style={[styles.opButtonIcon, { color: config.color }]}>
                {config.icon}
              </Text>
              <Text style={[
                styles.opButtonLabel,
                isSelected && { color: config.color }
              ]}>
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Input
        label="Path"
        value={patch.path}
        onChangeText={function(v) { handleChange("path", v); }}
        value="/path/to/property"
        hint="JSON Pointer path (e.g., /config/name)"
      />

      {opConfig.needsFrom && (
        <Input
          label="From"
          value={patch.from || ""}
          onChangeText={function(v) { handleChange("from", v); }}
          value="/source/path"
          hint="Source path for move/copy"
          style={styles.inputMargin}
        />
      )}

      {opConfig.needsValue && (
        <View style={styles.inputMargin}>
          <Text style={styles.inputLabel}>Value</Text>
          <TextArea
            value={typeof patch.value === "string" ? patch.value : JSON.stringify(patch.value, null, 2)}
            onChangeText={function(v) {
              try {
                handleChange("value", JSON.parse(v));
              } catch (e) {
                handleChange("value", v);
              }
            }}
            value="Value to set (JSON or string)"
            numberOfLines={4}
          />
        </View>
      )}

      <View style={styles.footer}>
        <Button
          variant={BUTTON_VARIANT.DANGER}
          size={BUTTON_SIZE.SM}
          onPress={onDelete}
        >
          Delete Patch
        </Button>
      </View>
    </Card>
  );
}

function NewPatchForm(props) {
  var onAdd = props.onAdd;
  var style = props.style;

  var opState = useState(PATCH_OPERATION.ADD);
  var op = opState[0];
  var setOp = opState[1];

  var pathState = useState("");
  var path = pathState[0];
  var setPath = pathState[1];

  var valueState = useState("");
  var value = valueState[0];
  var setValue = valueState[1];

  var fromState = useState("");
  var from = fromState[0];
  var setFrom = fromState[1];

  var opConfig = OPERATION_CONFIG[op];

  function handleAdd() {
    if (!path) return;

    var patch = { op: op, path: path };

    if (opConfig.needsValue && value) {
      try {
        patch.value = JSON.parse(value);
      } catch (e) {
        patch.value = value;
      }
    }

    if (opConfig.needsFrom && from) {
      patch.from = from;
    }

    onAdd(patch);

    setPath("");
    setValue("");
    setFrom("");
  }

  return (
    <Card title="Add Patch" style={style}>
      <View style={styles.operations}>
        {Object.keys(OPERATION_CONFIG).map(function(opKey) {
          var config = OPERATION_CONFIG[opKey];
          var isSelected = op === opKey;

          return (
            <Pressable
              key={opKey}
              onPress={function() { setOp(opKey); }}
              style={[
                styles.opButton,
                isSelected && { backgroundColor: config.color + "20", borderColor: config.color }
              ]}
            >
              <Text style={[styles.opButtonIcon, { color: config.color }]}>
                {config.icon}
              </Text>
              <Text style={[
                styles.opButtonLabel,
                isSelected && { color: config.color }
              ]}>
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Input
        label="Path"
        value={path}
        onChangeText={setPath}
        value="/path/to/property"
      />

      {opConfig.needsFrom && (
        <Input
          label="From"
          value={from}
          onChangeText={setFrom}
          value="/source/path"
          style={styles.inputMargin}
        />
      )}

      {opConfig.needsValue && (
        <TextArea
          label="Value"
          value={value}
          onChangeText={setValue}
          value="Value (JSON or string)"
          numberOfLines={3}
          style={styles.inputMargin}
        />
      )}

      <Button
        variant={BUTTON_VARIANT.PRIMARY}
        onPress={handleAdd}
        disabled={!path}
        style={styles.addButton}
      >
        Add Patch
      </Button>
    </Card>
  );
}

var styles = StyleSheet.create({
  container: {},
  collapsedContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border.subtle
  },
  opIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm
  },
  opIcon: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 16
  },
  collapsedContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center"
  },
  collapsedOp: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.primary,
    fontWeight: "600",
    marginRight: SPACING.sm
  },
  collapsedPath: {
    ...TYPOGRAPHY.code,
    color: COLORS.text.muted,
    flex: 1,
    fontSize: 12
  },
  expandIcon: {
    color: COLORS.text.muted,
    fontSize: 12
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    marginLeft: SPACING.sm
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center"
  },
  moveButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs
  },
  moveIcon: {
    fontSize: 16,
    color: COLORS.text.muted
  },
  collapseButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm
  },
  collapseIcon: {
    fontSize: 12,
    color: COLORS.text.muted
  },
  operations: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: SPACING.md
  },
  opButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border.subtle,
    backgroundColor: COLORS.bg.overlay
  },
  opButtonIcon: {
    fontSize: 14,
    marginRight: 4
  },
  opButtonLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary
  },
  inputMargin: {
    marginTop: SPACING.sm
  },
  inputLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs
  },
  footer: {
    marginTop: SPACING.md,
    alignItems: "flex-start"
  },
  addButton: {
    marginTop: SPACING.md
  }
});

export { PatchEditor, NewPatchForm, OPERATION_CONFIG };
export default PatchEditor;