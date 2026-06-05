// s4/components/build/TemplateSelector.js
// ALX Factory - Template Selector Component
// Version: 1.0.0

import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { TemplateCard } from "./TemplateCard.js";
import { TEMPLATE_DEFINITIONS } from "../../services/BuildService.js";

function TemplateSelector(props) {
  var selectedId = props.selectedId;
  var onSelect = props.onSelect;
  var templates = props.templates || Object.values(TEMPLATE_DEFINITIONS);
  var compact = props.compact || false;
  var showDescription = props.showDescription !== false;
  var style = props.style;

  var filterState = useState("all");
  var filter = filterState[0];
  var setFilter = filterState[1];

  var filteredTemplates = templates;

  if (filter === "simple") {
    filteredTemplates = templates.filter(function(t) {
      return t.stages.length <= 4;
    });
  } else if (filter === "advanced") {
    filteredTemplates = templates.filter(function(t) {
      return t.stages.length > 4;
    });
  }

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {templates.map(function(template) {
            return (
              <TemplateCard
                key={template.id}
                template={template}
                selected={selectedId === template.id}
                onPress={function() { onSelect(template.id); }}
                compact
              />
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {showDescription && (
        <View style={styles.header}>
          <Text style={styles.title}>Select Template</Text>
          <Text style={styles.subtitle}>
            Choose a template for your build
          </Text>
        </View>
      )}

      <View style={styles.filters}>
        <FilterButton
          label="All"
          active={filter === "all"}
          onPress={function() { setFilter("all"); }}
        />
        <FilterButton
          label="Simple"
          active={filter === "simple"}
          onPress={function() { setFilter("simple"); }}
        />
        <FilterButton
          label="Advanced"
          active={filter === "advanced"}
          onPress={function() { setFilter("advanced"); }}
        />
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filteredTemplates.map(function(template) {
          return (
            <TemplateCard
              key={template.id}
              template={template}
              selected={selectedId === template.id}
              onPress={function() { onSelect(template.id); }}
            />
          );
        })}

        {filteredTemplates.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No templates match the filter</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function FilterButton(props) {
  var label = props.label;
  var active = props.active;
  var onPress = props.onPress;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterButton, active && styles.filterButtonActive]}
    >
      <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

var styles = StyleSheet.create({
  container: {
    flex: 1
  },
  compactContainer: {},
  header: {
    marginBottom: SPACING.md
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary
  },
  filters: {
    flexDirection: "row",
    marginBottom: SPACING.md
  },
  filterButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginRight: SPACING.sm,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.bg.overlay
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary
  },
  filterButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.text.secondary
  },
  filterButtonTextActive: {
    color: COLORS.white
  },
  list: {
    flex: 1
  },
  emptyContainer: {
    alignItems: "center",
    padding: SPACING.xl
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted
  }
});

export { TemplateSelector };
export default TemplateSelector;