// s4/components/build/BuildConfigForm.js
// ALX Factory - Build Config Form Component
// Version: 1.0.0

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Input, TextArea } from "../common/Input.js";
import { Card } from "../common/Card.js";
import { Badge, BADGE_VARIANT } from "../common/Badge.js";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "../common/Button.js";

var LANGUAGES = [
  { id: "javascript", label: "JavaScript", icon: "📜" },
  { id: "typescript", label: "TypeScript", icon: "📘" },
  { id: "json", label: "JSON", icon: "📋" },
  { id: "html", label: "HTML", icon: "🌐" },
  { id: "css", label: "CSS", icon: "🎨" },
  { id: "markdown", label: "Markdown", icon: "📝" }
];

function BuildConfigForm(props) {
  var config = props.config;
  var validation = props.validation || { errors: [], failures: [] };
  var onChangeName = props.onChangeName;
  var onChangeDescription = props.onChangeDescription;
  var onChangeLanguage = props.onChangeLanguage;
  var onChangeCode = props.onChangeCode;
  var onAddTag = props.onAddTag;
  var onRemoveTag = props.onRemoveTag;
  var style = props.style;

  if (!config) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.emptyText}>No template selected</Text>
      </View>
    );
  }

  var nameError = validation.errors.find(function(e) {
    return e.field === "name";
  });
  var codeError = validation.errors.find(function(e) {
    return e.field === "code";
  });

  return (
    <ScrollView style={[styles.container, style]}>
      <Card title="Basic Info" style={styles.card}>
        <Input
          label="Name"
          value={config.name}
          onChangeText={onChangeName}
          value="Enter project name"
          error={nameError ? nameError.message : null}
        />

        <Input
          label="Description"
          value={config.description}
          onChangeText={onChangeDescription}
          value="Brief description (optional)"
          style={styles.inputMargin}
        />
      </Card>

      <Card title="Language" style={styles.card}>
        <View style={styles.languageGrid}>
          {LANGUAGES.map(function(lang) {
            var isSelected = config.language === lang.id;
            return (
              <LanguageOption
                key={lang.id}
                language={lang}
                selected={isSelected}
                onPress={function() { onChangeLanguage(lang.id); }}
              />
            );
          })}
        </View>
      </Card>

      <Card title="Code" style={styles.card}>
        <TextArea
          value={config.code}
          onChangeText={onChangeCode}
          value={"// Enter your " + config.language + " code here..."}
          numberOfLines={12}
          style={styles.codeInput}
          error={codeError ? codeError.message : null}
        />
      </Card>

      <Card title="Tags" style={styles.card}>
        <View style={styles.tagsContainer}>
          {config.tags.map(function(tag) {
            return (
              <Badge
                key={tag}
                variant={BADGE_VARIANT.PRIMARY}
                label={tag}
                onPress={function() { onRemoveTag(tag); }}
                style={styles.tag}
              />
            );
          })}
          <AddTagButton onAdd={onAddTag} />
        </View>
      </Card>

      {validation.failures.length > 0 && (
        <Card title="Warnings" style={styles.warningCard}>
          {validation.failures.map(function(warning, index) {
            return (
              <Text key={index} style={styles.warningText}>
                ⚠️ {warning.message}
              </Text>
            );
          })}
        </Card>
      )}

      {validation.errors.length > 0 && (
        <Card title="Errors" style={styles.errorCard}>
          {validation.errors.map(function(error, index) {
            return (
              <Text key={index} style={styles.errorText}>
                ✕ {error.field}: {error.message}
              </Text>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

function LanguageOption(props) {
  var language = props.language;
  var selected = props.selected;
  var onPress = props.onPress;

  return (
    <Button
      variant={selected ? BUTTON_VARIANT.PRIMARY : BUTTON_VARIANT.OUTLINE}
      size={BUTTON_SIZE.SM}
      onPress={onPress}
      style={styles.languageButton}
    >
      {language.icon} {language.label}
    </Button>
  );
}

function AddTagButton(props) {
  var onAdd = props.onAdd;

  var inputState = React.useState("");
  var input = inputState[0];
  var setInput = inputState[1];

  var showInputState = React.useState(false);
  var showInput = showInputState[0];
  var setShowInput = showInputState[1];

  function handleAdd() {
    if (input.trim()) {
      onAdd(input.trim());
      setInput("");
      setShowInput(false);
    }
  }

  if (showInput) {
    return (
      <View style={styles.addTagInput}>
        <Input
          value={input}
          onChangeText={setInput}
          value="Tag name"
          size="sm"
          style={styles.tagInput}
          autoFocus
          onSubmitEditing={handleAdd}
        />
        <Button
          variant={BUTTON_VARIANT.PRIMARY}
          size={BUTTON_SIZE.SM}
          onPress={handleAdd}
        >
          Add
        </Button>
        <Button
          variant={BUTTON_VARIANT.GHOST}
          size={BUTTON_SIZE.SM}
          onPress={function() { setShowInput(false); setInput(""); }}
        >
          ✕
        </Button>
      </View>
    );
  }

  return (
    <Button
      variant={BUTTON_VARIANT.OUTLINE}
      size={BUTTON_SIZE.SM}
      onPress={function() { setShowInput(true); }}
    >
      + Add Tag
    </Button>
  );
}

var styles = StyleSheet.create({
  container: {
    flex: 1
  },
  card: {
    marginBottom: SPACING.md
  },
  inputMargin: {
    marginTop: SPACING.sm
  },
  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  languageButton: {
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm
  },
  codeInput: {
    fontFamily: "monospace"
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center"
  },
  tag: {
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs
  },
  addTagInput: {
    flexDirection: "row",
    alignItems: "center"
  },
  tagInput: {
    width: 120,
    marginRight: SPACING.xs
  },
  warningCard: {
    marginBottom: SPACING.md,
    borderColor: COLORS.status.warning,
    borderWidth: 1
  },
  warningText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.status.warning,
    marginBottom: SPACING.xs
  },
  errorCard: {
    marginBottom: SPACING.md,
    borderColor: COLORS.status.error,
    borderWidth: 1
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.status.error,
    marginBottom: SPACING.xs
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted,
    textAlign: "center",
    padding: SPACING.xl
  }
});

export { BuildConfigForm, LANGUAGES };
export default BuildConfigForm;