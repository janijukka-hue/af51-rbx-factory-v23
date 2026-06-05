// s4/components/build/TemplateCard.js
// ALX Factory - Template Card Component
// Version: 1.0.0

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Badge, BADGE_VARIANT } from "../common/Badge.js";

function TemplateCard(props) {
  var template = props.template;
  var selected = props.selected || false;
  var onPress = props.onPress;
  var compact = props.compact || false;
  var disabled = props.disabled || false;
  var style = props.style;

  if (compact) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={[
          styles.compactContainer,
          selected && styles.containerSelected,
          disabled && styles.containerDisabled,
          style
        ]}
      >
        <Text style={styles.compactIcon}>{template.icon}</Text>
        <Text style={[styles.compactName, selected && styles.textSelected]}>
          {template.name}
        </Text>
        {selected && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[
        styles.container,
        selected && styles.containerSelected,
        disabled && styles.containerDisabled,
        style
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{template.icon}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.name, selected && styles.textSelected]}>
            {template.name}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {template.description}
          </Text>
        </View>
        {selected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>✓</Text>
          </View>
        )}
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Language:</Text>
          <Text style={styles.detailValue}>{template.defaultLanguage}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Stages:</Text>
          <Text style={styles.detailValue}>{template.stages.length}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Energy:</Text>
          <Text style={styles.detailValue}>{template.energyCost}</Text>
        </View>
      </View>

      <View style={styles.stages}>
        {template.stages.slice(0, 5).map(function(stage, index) {
          return (
            <Badge
              key={index}
              variant={BADGE_VARIANT.DEFAULT}
              label={stage}
              size="sm"
              style={styles.stageBadge}
            />
          );
        })}
        {template.stages.length > 5 && (
          <Badge
            variant={BADGE_VARIANT.DEFAULT}
            label={"+" + (template.stages.length - 5)}
            size="sm"
          />
        )}
      </View>
    </Pressable>
  );
}

function TemplateCardSkeleton(props) {
  var compact = props.compact || false;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.skeleton, styles.skeletonIcon]} />
        <View style={[styles.skeleton, styles.skeletonName]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.skeleton, styles.skeletonIconLarge]} />
        <View style={styles.headerText}>
          <View style={[styles.skeleton, styles.skeletonTitle]} />
          <View style={[styles.skeleton, styles.skeletonDesc]} />
        </View>
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bg.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.border.subtle
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginRight: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.border.subtle
  },
  containerSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight
  },
  containerDisabled: {
    opacity: 0.5
  },
  header: {
    flexDirection: "row",
    marginBottom: SPACING.sm
  },
  icon: {
    fontSize: 32,
    marginRight: SPACING.md
  },
  compactIcon: {
    fontSize: 20,
    marginRight: SPACING.sm
  },
  headerText: {
    flex: 1
  },
  name: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs
  },
  compactName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: "600"
  },
  textSelected: {
    color: COLORS.primary
  },
  description: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.secondary
  },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  selectedBadgeText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14
  },
  checkmark: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 16,
    marginLeft: SPACING.sm
  },
  details: {
    marginBottom: SPACING.sm
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.xs
  },
  detailLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  detailValue: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.primary,
    fontWeight: "500"
  },
  stages: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  stageBadge: {
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs
  },
  skeleton: {
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.sm
  },
  skeletonIcon: {
    width: 20,
    height: 20,
    marginRight: SPACING.sm
  },
  skeletonIconLarge: {
    width: 32,
    height: 32,
    marginRight: SPACING.md
  },
  skeletonName: {
    width: 80,
    height: 16
  },
  skeletonTitle: {
    width: 100,
    height: 18,
    marginBottom: SPACING.xs
  },
  skeletonDesc: {
    width: "80%",
    height: 14
  }
});

export { TemplateCard, TemplateCardSkeleton };
export default TemplateCard;