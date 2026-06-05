// s4/components/build/BuildConfigModal.js
// ALX Factory - Build Config Modal Component
// Version: 1.0.0

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Modal } from "../common/Modal.js";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "../common/Button.js";
import { Badge, BADGE_VARIANT } from "../common/Badge.js";
import { Card } from "../common/Card.js";
import { ProgressBar, PROGRESS_VARIANT } from "../common/ProgressBar.js";
import { EnergyMeter } from "../factory/EnergyMeter.js";
import { TemplateSelector } from "./TemplateSelector.js";
import { BuildConfigForm } from "./BuildConfigForm.js";
import { PatchList } from "./PatchList.js";
import { DependencyManager } from "./DependencyManager.js";
import { useBuildConfig } from "../../hooks/useBuildConfig.js";
import { formatDuration } from "../../utils/formatters.js";

var STEPS = [
  { id: "template", label: "Template" },
  { id: "config", label: "Configure" },
  { id: "patches", label: "Patches" },
  { id: "deps", label: "Dependencies" },
  { id: "review", label: "Review" }
];

function BuildConfigModal(props) {
  var visible = props.visible || false;
  var onClose = props.onClose;
  var onSubmit = props.onSubmit;
  var orchestrator = props.orchestrator;
  var initialTemplate = props.initialTemplate;

  var buildConfig = useBuildConfig(orchestrator, initialTemplate);

  var stepState = useState(0);
  var currentStep = stepState[0];
  var setCurrentStep = stepState[1];

  var handleNext = useCallback(function() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, setCurrentStep]);

  var handleBack = useCallback(function() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, setCurrentStep]);

  var handleSubmit = useCallback(async function() {
    var result = await buildConfig.submit();
    if (result.ok) {
      if (onSubmit) {
        onSubmit(result);
      }
      onClose();
    }
  }, [buildConfig, onSubmit, onClose]);

  var handleClose = useCallback(function() {
    buildConfig.reset();
    setCurrentStep(0);
    onClose();
  }, [buildConfig, setCurrentStep, onClose]);

  var canProceed = function() {
    if (currentStep === 0) {
      return buildConfig.config !== null;
    }
    if (currentStep === 1) {
      var validation = buildConfig.validate();
      return validation.valid || validation.errors.length === 0;
    }
    return true;
  };

  var step = STEPS[currentStep];
  var progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="New Build"
      size="lg"
      footer={
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {currentStep > 0 && (
              <Button
                variant={BUTTON_VARIANT.GHOST}
                size={BUTTON_SIZE.MD}
                onPress={handleBack}
              >
                ← Back
              </Button>
            )}
          </View>
          <View style={styles.footerRight}>
            {currentStep < STEPS.length - 1 ? (
              <Button
                variant={BUTTON_VARIANT.PRIMARY}
                size={BUTTON_SIZE.MD}
                onPress={handleNext}
                disabled={!canProceed()}
              >
                Next →
              </Button>
            ) : (
              <Button
                variant={BUTTON_VARIANT.PRIMARY}
                size={BUTTON_SIZE.MD}
                onPress={handleSubmit}
                loading={buildConfig.submitting}
                disabled={!buildConfig.validation.valid}
              >
                Start Build
              </Button>
            )}
          </View>
        </View>
      }
    >
      <View style={styles.stepIndicator}>
        {STEPS.map(function(s, index) {
          var isActive = index === currentStep;
          var isComplete = index < currentStep;
          return (
            <View key={s.id} style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                isActive && styles.stepDotActive,
                isComplete && styles.stepDotComplete
              ]}>
                {isComplete ? (
                  <Text style={styles.stepDotCheck}>✓</Text>
                ) : (
                  <Text style={[styles.stepDotNumber, isActive && styles.stepDotNumberActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>

      <ProgressBar
        progress={progress}
        variant={PROGRESS_VARIANT.PRIMARY}
        size="sm"
        style={styles.progressBar}
      />

      <ScrollView style={styles.content}>
        {step.id === "template" && (
          <TemplateSelector
            selectedId={buildConfig.config ? buildConfig.config.templateId : null}
            onSelect={buildConfig.selectTemplate}
          />
        )}

        {step.id === "config" && (
          <BuildConfigForm
            config={buildConfig.config}
            validation={buildConfig.validation}
            onChangeName={buildConfig.setName}
            onChangeDescription={buildConfig.setDescription}
            onChangeLanguage={buildConfig.setLanguage}
            onChangeCode={buildConfig.setCode}
            onAddTag={buildConfig.addTag}
            onRemoveTag={buildConfig.removeTag}
          />
        )}

        {step.id === "patches" && (
          <PatchList
            patches={buildConfig.config ? buildConfig.config.patches : []}
            onAddPatch={buildConfig.addPatch}
            onUpdatePatch={buildConfig.updatePatch}
            onRemovePatch={buildConfig.removePatch}
            onReorderPatches={buildConfig.reorderPatches}
          />
        )}

        {step.id === "deps" && (
          <DependencyManager
            dependencies={buildConfig.config ? buildConfig.config.dependencies : []}
            onAdd={buildConfig.addDependency}
            onUpdate={buildConfig.updateDependency}
            onRemove={buildConfig.removeDependency}
          />
        )}

        {step.id === "review" && (
          <ReviewStep
            config={buildConfig.config}
            validation={buildConfig.validation}
            estimates={buildConfig.getEstimates()}
            previewCommand={buildConfig.getPreviewCommand()}
          />
        )}
      </ScrollView>
    </Modal>
  );
}

function ReviewStep(props) {
  var config = props.config;
  var validation = props.validation;
  var estimates = props.estimates;
  var previewCommand = props.previewCommand;

  var showCommandState = useState(false);
  var showCommand = showCommandState[0];
  var setShowCommand = showCommandState[1];

  if (!config) {
    return (
      <View style={styles.reviewEmpty}>
        <Text style={styles.reviewEmptyText}>No configuration to review</Text>
      </View>
    );
  }

  return (
    <View>
      <Card title="Summary" style={styles.reviewCard}>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Template</Text>
          <Badge
            variant={BADGE_VARIANT.PRIMARY}
            label={config.templateId}
          />
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Name</Text>
          <Text style={styles.reviewValue}>{config.name}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Language</Text>
          <Text style={styles.reviewValue}>{config.language}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Files</Text>
          <Text style={styles.reviewValue}>
            {config.files.length + (config.code ? 1 : 0)}
          </Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Patches</Text>
          <Text style={styles.reviewValue}>{config.patches.length}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Dependencies</Text>
          <Text style={styles.reviewValue}>{config.dependencies.length}</Text>
        </View>
      </Card>

      <Card title="Estimates" style={styles.reviewCard}>
        <View style={styles.estimatesRow}>
          <View style={styles.estimateItem}>
            <Text style={styles.estimateLabel}>Energy Cost</Text>
            <EnergyMeter
              energy={estimates.energy}
              maxEnergy={100}
              size="sm"
              showValue
            />
          </View>
          <View style={styles.estimateItem}>
            <Text style={styles.estimateLabel}>Duration</Text>
            <Text style={styles.estimateValue}>
              ~{formatDuration(estimates.duration)}
            </Text>
          </View>
        </View>
      </Card>

      {validation.failures.length > 0 && (
        <Card title="Warnings" style={styles.warningCard}>
          {validation.failures.map(function(w, i) {
            return (
              <Text key={i} style={styles.warningText}>⚠️ {w.message}</Text>
            );
          })}
        </Card>
      )}

      <Card style={styles.reviewCard}>
        <View style={styles.commandHeader}>
          <Text style={styles.commandTitle}>Build Command</Text>
          <Button
            variant={BUTTON_VARIANT.GHOST}
            size={BUTTON_SIZE.SM}
            onPress={function() { setShowCommand(!showCommand); }}
          >
            {showCommand ? "Hide" : "Show"}
          </Button>
        </View>
        {showCommand && (
          <ScrollView style={styles.commandPreview} horizontal>
            <Text style={styles.commandText}>{previewCommand}</Text>
          </ScrollView>
        )}
      </Card>
    </View>
  );
}

var styles = StyleSheet.create({
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md
  },
  stepItem: {
    alignItems: "center",
    flex: 1
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.bg.overlay,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs
  },
  stepDotActive: {
    backgroundColor: COLORS.primary
  },
  stepDotComplete: {
    backgroundColor: COLORS.status.success
  },
  stepDotNumber: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    fontWeight: "700"
  },
  stepDotNumberActive: {
    color: COLORS.white
  },
  stepDotCheck: {
    color: COLORS.white,
    fontWeight: "700"
  },
  stepLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  stepLabelActive: {
    color: COLORS.primary,
    fontWeight: "600"
  },
  progressBar: {
    marginBottom: SPACING.md
  },
  content: {
    flex: 1
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  footerLeft: {},
  footerRight: {},
  reviewCard: {
    marginBottom: SPACING.md
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  reviewLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted
  },
  reviewValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: "500"
  },
  estimatesRow: {
    flexDirection: "row"
  },
  estimateItem: {
    flex: 1
  },
  estimateLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginBottom: SPACING.xs
  },
  estimateValue: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary
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
  commandHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  commandTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.secondary
  },
  commandPreview: {
    marginTop: SPACING.sm,
    maxHeight: 150,
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm
  },
  commandText: {
    ...TYPOGRAPHY.code,
    color: COLORS.text.primary,
    fontSize: 11
  },
  reviewEmpty: {
    alignItems: "center",
    padding: SPACING.xl
  },
  reviewEmptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted
  }
});

export { BuildConfigModal };
export default BuildConfigModal;