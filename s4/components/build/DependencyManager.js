// s4/components/build/DependencyManager.js
// ALX Factory - Dependency Manager Component
// Version: 1.0.2 - Fixed ESLint deps with stable default

import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Input } from "../common/Input.js";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "../common/Button.js";
import { Card } from "../common/Card.js";
import { Badge, BADGE_VARIANT } from "../common/Badge.js";

var EMPTY_ARRAY = [];

function DependencyManager(props) {
  var dependencies = props.dependencies || EMPTY_ARRAY;
  var onAdd = props.onAdd;
  var onUpdate = props.onUpdate;
  var onRemove = props.onRemove;
  var style = props.style;

  var showAddFormState = useState(false);
  var showAddForm = showAddFormState[0];
  var setShowAddForm = showAddFormState[1];

  var existingNames = useMemo(function() {
    return dependencies.map(function(d) { return d.name; });
  }, [dependencies]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Dependencies</Text>
          <Badge
            variant={BADGE_VARIANT.DEFAULT}
            label={dependencies.length + " packages"}
            size="sm"
          />
        </View>
        <Button
          variant={BUTTON_VARIANT.PRIMARY}
          size={BUTTON_SIZE.SM}
          onPress={function() { setShowAddForm(!showAddForm); }}
        >
          {showAddForm ? "Cancel" : "+ Add"}
        </Button>
      </View>

      {showAddForm && (
        <AddDependencyForm
          onAdd={function(dep) {
            onAdd(dep);
            setShowAddForm(false);
          }}
          existingNames={existingNames}
        />
      )}

      {dependencies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>No dependencies</Text>
          <Text style={styles.emptyHint}>
            Add npm packages your code needs
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {dependencies.map(function(dep) {
            return (
              <DependencyItem
                key={dep.name}
                dependency={dep}
                onUpdate={function(version) { onUpdate(dep.name, version); }}
                onRemove={function() { onRemove(dep.name); }}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

function DependencyItem(props) {
  var dependency = props.dependency;
  var onUpdate = props.onUpdate;
  var onRemove = props.onRemove;

  var editingState = useState(false);
  var editing = editingState[0];
  var setEditing = editingState[1];

  var versionState = useState(dependency.version);
  var version = versionState[0];
  var setVersion = versionState[1];

  var handleSave = useCallback(function() {
    onUpdate(version);
    setEditing(false);
  }, [version, onUpdate, setEditing]);

  return (
    <View style={styles.depItem}>
      <View style={styles.depInfo}>
        <Text style={styles.depName}>{dependency.name}</Text>
        {editing ? (
          <View style={styles.depVersionEdit}>
            <Input
              value={version}
              onChangeText={setVersion}
              value="version"
              size="sm"
              style={styles.versionInput}
              autoFocus
            />
            <Button
              variant={BUTTON_VARIANT.PRIMARY}
              size={BUTTON_SIZE.SM}
              onPress={handleSave}
            >
              ✓
            </Button>
            <Button
              variant={BUTTON_VARIANT.GHOST}
              size={BUTTON_SIZE.SM}
              onPress={function() {
                setVersion(dependency.version);
                setEditing(false);
              }}
            >
              ✕
            </Button>
          </View>
        ) : (
          <Pressable onPress={function() { setEditing(true); }}>
            <Text style={styles.depVersion}>@{dependency.version}</Text>
          </Pressable>
        )}
      </View>
      <Pressable onPress={onRemove} style={styles.removeButton}>
        <Text style={styles.removeIcon}>✕</Text>
      </Pressable>
    </View>
  );
}

function AddDependencyForm(props) {
  var onAdd = props.onAdd;
  var existingNames = props.existingNames;

  var nameState = useState("");
  var name = nameState[0];
  var setName = nameState[1];

  var versionState = useState("latest");
  var version = versionState[0];
  var setVersion = versionState[1];

  var errorState = useState(null);
  var error = errorState[0];
  var setError = errorState[1];

  var handleAdd = useCallback(function() {
    var trimmedName = name.trim();

    if (!trimmedName) {
      setError("Package name is required");
      return;
    }

    if (existingNames.indexOf(trimmedName) !== -1) {
      setError("Package already added");
      return;
    }

    onAdd({ name: trimmedName, version: version || "latest" });
    setName("");
    setVersion("latest");
    setError(null);
  }, [name, version, existingNames, onAdd, setName, setVersion, setError]);

  return (
    <Card style={styles.addForm}>
      <View style={styles.addFormRow}>
        <Input
          value={name}
          onChangeText={function(v) {
            setName(v);
            setError(null);
          }}
          value="package-name"
          style={styles.nameInput}
          error={error}
          autoFocus
        />
        <Input
          value={version}
          onChangeText={setVersion}
          value="version"
          style={styles.versionInputAdd}
        />
        <Button
          variant={BUTTON_VARIANT.PRIMARY}
          size={BUTTON_SIZE.MD}
          onPress={handleAdd}
          disabled={!name.trim()}
        >
          Add
        </Button>
      </View>

      <View style={styles.suggestions}>
        <Text style={styles.suggestionsLabel}>Popular:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {["lodash", "axios", "dayjs", "uuid", "zod"].map(function(pkg) {
            var exists = existingNames.indexOf(pkg) !== -1;
            return (
              <Pressable
                key={pkg}
                onPress={exists ? undefined : function() { setName(pkg); }}
                style={[styles.suggestion, exists && styles.suggestionDisabled]}
              >
                <Text style={[styles.suggestionText, exists && styles.suggestionTextDisabled]}>
                  {pkg}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Card>
  );
}

function DependencyList(props) {
  var dependencies = props.dependencies || EMPTY_ARRAY;
  var compact = props.compact || false;
  var style = props.style;

  if (dependencies.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <View style={[styles.compactList, style]}>
        {dependencies.map(function(dep) {
          return (
            <Badge
              key={dep.name}
              variant={BADGE_VARIANT.DEFAULT}
              label={dep.name + "@" + dep.version}
              size="sm"
              style={styles.compactBadge}
            />
          );
        })}
      </View>
    );
  }

  return (
    <View style={style}>
      {dependencies.map(function(dep) {
        return (
          <View key={dep.name} style={styles.listItem}>
            <Text style={styles.listItemName}>{dep.name}</Text>
            <Text style={styles.listItemVersion}>{dep.version}</Text>
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
    marginBottom: SPACING.md
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
  list: {},
  depItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.bg.surface,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border.subtle
  },
  depInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center"
  },
  depName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: "600"
  },
  depVersion: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.muted,
    marginLeft: SPACING.xs
  },
  depVersionEdit: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: SPACING.sm
  },
  versionInput: {
    width: 80,
    marginRight: SPACING.xs
  },
  removeButton: {
    padding: SPACING.xs
  },
  removeIcon: {
    fontSize: 14,
    color: COLORS.status.error
  },
  addForm: {
    marginBottom: SPACING.md
  },
  addFormRow: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  nameInput: {
    flex: 2,
    marginRight: SPACING.sm
  },
  versionInputAdd: {
    flex: 1,
    marginRight: SPACING.sm
  },
  suggestions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.sm
  },
  suggestionsLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginRight: SPACING.sm
  },
  suggestion: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.xs
  },
  suggestionDisabled: {
    opacity: 0.5
  },
  suggestionText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary
  },
  suggestionTextDisabled: {
    color: COLORS.text.disabled
  },
  compactList: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  compactBadge: {
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  listItemName: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.primary
  },
  listItemVersion: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  }
});

export { DependencyManager, DependencyItem, DependencyList };
export default DependencyManager;