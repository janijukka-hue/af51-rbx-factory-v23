// s4/screens/BuildWizard/BuildWizardScreen.js
// ALX Factory - Build Wizard Screen
// Version: 1.0.0

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { ROUTES } from "../../navigation/routes.js";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Badge, BADGE_VARIANT } from "../../components/common/Badge.js";
import { ProgressBar, PROGRESS_VARIANT } from "../../components/common/ProgressBar.js";
import { useToast } from "../../components/common/Toast.js";
import { EnergyMeter } from "../../components/factory/EnergyMeter.js";
import { TemplateSelector } from "../../components/build/TemplateSelector.js";
import { BuildConfigForm } from "../../components/build/BuildConfigForm.js";
import { PatchList } from "../../components/build/PatchList.js";
import { DependencyManager } from "../../components/build/DependencyManager.js";
import { useBuildConfig } from "../../hooks/useBuildConfig.js";
import { formatDuration } from "../../utils/formatters.js";

var WIZARD_STEPS = [
  { id: "template", label: "Template", icon: "📋" },
  { id: "config", label: "Configure", icon: "⚙️" },
  { id: "patches", label: "Patches", icon: "🔧" },
  { id: "deps", label: "Dependencies", icon: "📦" },
  { id: "review", label: "Review", icon: "✓" }
];

function BuildWizardScreen(props) {
  var orchestrator = props.orchestrator;
  var navigation = props.navigation;

  var buildConfig = useBuildConfig(orchestrator);
  var toast = useToast();

  var stepState = useState(0);
  var currentStep = stepState[0];
  var setCurrentStep = stepState[1];

  var handleNext = useCallback(function() {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, setCurrentStep]);

  var handleBack = useCallback(function() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, setCurrentStep]);

  var handleStepPress = useCallback(function(index) {
    if (index <= currentStep) {
      setCurrentStep(index);
    }
  }, [currentStep, setCurrentStep]);

  var handleSubmit = useCallback(async function() {
    var result = await buildConfig.submit();

    if (result.ok) {
      toast.success("Build started!");
      if (navigation) {
        navigation.navigate(ROUTES.JOBS_QUEUE);
      }
    } else {
      toast.error(result.error || "Build failed");
    }
  }, [buildConfig, toast, navigation]);

  var handleCancel = useCallback(function() {
    buildConfig.reset();
    if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  }, [buildConfig, navigation]);

  var canProceed = function() {
    if (currentStep === 0) {
      return buildConfig.config !== null;
    }
    if (currentStep === 1) {
      var validation = buildConfig.validate();
      return validation.errors.filter(function(e) {
        return e.field === "name" || e.field === "code";
      }).length === 0;
    }
    return true;
  };

  var step = WIZARD_STEPS[currentStep];
  var progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  var estimates = buildConfig.getEstimates();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Build</Text>
        <View style={styles.headerRight}>
          {buildConfig.config && (
            <Badge
              variant={BADGE_VARIANT.PRIMARY}
              label={buildConfig.config.templateId}
              size="sm"
            />
          )}
        </View>
      </View>

      <View style={styles.stepNav}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {WIZARD_STEPS.map(function(s, index) {
            var isActive = index === currentStep;
            var isComplete = index < currentStep;
            var isAccessible = index <= currentStep;

            return (
              <Pressable
                key={s.id}
                onPress={isAccessible ? function() { handleStepPress(index); } : undefined}
                style={[
                  styles.stepNavItem,
                  isActive && styles.stepNavItemActive,
                  isComplete && styles.stepNavItemComplete
                ]}
              >
                <Text style={styles.stepNavIcon}>{s.icon}</Text>
                <Text style={[
                  styles.stepNavLabel,
                  isActive && styles.stepNavLabelActive,
                  isComplete && styles.stepNavLabelComplete
                ]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ProgressBar
        progress={progress}
        variant={PROGRESS_VARIANT.PRIMARY}
        size="sm"
        style={styles.progressBar}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
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
          <ReviewContent
            config={buildConfig.config}
            validation={buildConfig.validation}
            estimates={estimates}
            previewCommand={buildConfig.getPreviewCommand()}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerEstimates}>
          <View style={styles.estimateItem}>
            <Text style={styles.estimateLabel}>Energy</Text>
            <Text style={styles.estimateValue}>{estimates.energy}</Text>
          </View>
          <View style={styles.estimateItem}>
            <Text style={styles.estimateLabel}>Time</Text>
            <Text style={styles.estimateValue}>~{formatDuration(estimates.duration)}</Text>
          </View>
        </View>

        <View style={styles.footerActions}>
          {currentStep > 0 && (
            <Button
              variant={BUTTON_VARIANT.GHOST}
              size={BUTTON_SIZE.MD}
              onPress={handleBack}
              style={styles.footerButton}
            >
              Back
            </Button>
          )}

          {currentStep < WIZARD_STEPS.length - 1 ? (
            <Button
              variant={BUTTON_VARIANT.PRIMARY}
              size={BUTTON_SIZE.MD}
              onPress={handleNext}
              disabled={!canProceed()}
              style={styles.footerButton}
            >
              Next
            </Button>
          ) : (
            <Button
              variant={BUTTON_VARIANT.PRIMARY}
              size={BUTTON_SIZE.MD}
              onPress={handleSubmit}
              loading={buildConfig.submitting}
              disabled={!buildConfig.validation.valid}
              style={styles.footerButton}
            >
              Start Build
            </Button>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function ReviewContent(props) {
  var config = props.config;
  var validation = props.validation;
  var estimates = props.estimates;
  var previewCommand = props.previewCommand;

  if (!config) {
    return (
      <View style={styles.reviewEmpty}>
        <Text style={styles.reviewEmptyText}>No configuration</Text>
      </View>
    );
  }

  return (
    <View>
      <Card title="Build Summary" style={styles.card}>
        <ReviewRow label="Template" value={config.templateId} />
        <ReviewRow label="Name" value={config.name} />
        <ReviewRow label="Language" value={config.language} />
        <ReviewRow label="Code" value={config.code ? "✓ Provided" : "—"} />
        <ReviewRow label="Patches" value={config.patches.length + " patches"} />
        <ReviewRow label="Dependencies" value={config.dependencies.length + " packages"} />
        <ReviewRow label="Tags" value={config.tags.join(", ") || "—"} />
      </Card>

      <Card title="Estimates" style={styles.card}>
        <View style={styles.estimatesGrid}>
          <View style={styles.estimateBox}>
            <EnergyMeter
              energy={estimates.energy}
              maxEnergy={100}
              size="md"
              showValue
            />
            <Text style={styles.estimateBoxLabel}>Energy Cost</Text>
          </View>
          <View style={styles.estimateBox}>
            <Text style={styles.estimateBigValue}>
              {formatDuration(estimates.duration)}
            </Text>
            <Text style={styles.estimateBoxLabel}>Est. Duration</Text>
          </View>
        </View>
      </Card>

      {validation.errors.length > 0 && (
        <Card title="Errors" style={styles.errorCard}>
          {validation.errors.map(function(e, i) {
            return (
              <Text key={i} style={styles.errorText}>
                ✕ {e.field}: {e.message}
              </Text>
            );
          })}
        </Card>
      )}

      {validation.failures.length > 0 && (
        <Card title="Warnings" style={styles.warningCard}>
          {validation.failures.map(function(w, i) {
            return (
              <Text key={i} style={styles.warningText}>
                ⚠️ {w.message}
              </Text>
            );
          })}
        </Card>
      )}
    </View>
  );
}

function ReviewRow(props) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{props.label}</Text>
      <Text style={styles.reviewValue}>{props.value}</Text>
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg.base
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  cancelButton: {
    padding: SPACING.xs
  },
  cancelText: {
    ...TYPOGRAPHY.button,
    color: COLORS.text.muted
  },
  headerTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary
  },
  headerRight: {},
  stepNav: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  stepNavItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent"
  },
  stepNavItemActive: {
    borderBottomColor: COLORS.primary
  },
  stepNavItemComplete: {
    borderBottomColor: COLORS.status.success
  },
  stepNavIcon: {
    fontSize: 16,
    marginRight: SPACING.xs
  },
  stepNavLabel: {
    ...TYPOGRAPHY.button,
    color: COLORS.text.muted
  },
  stepNavLabelActive: {
    color: COLORS.primary
  },
  stepNavLabelComplete: {
    color: COLORS.status.success
  },
  progressBar: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: SPACING.md
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.subtle,
    backgroundColor: COLORS.bg.surface
  },
  footerEstimates: {
    flexDirection: "row"
  },
  estimateItem: {
    marginRight: SPACING.lg
  },
  estimateLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  estimateValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: "600"
  },
  footerActions: {
    flexDirection: "row"
  },
  footerButton: {
    marginLeft: SPACING.sm
  },
  card: {
    marginBottom: SPACING.md
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  reviewEmpty: {
    alignItems: "center",
    padding: SPACING.xl
  },
  reviewEmptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted
  },
  estimatesGrid: {
    flexDirection: "row"
  },
  estimateBox: {
    flex: 1,
    alignItems: "center",
    padding: SPACING.md
  },
  estimateBoxLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginTop: SPACING.sm
  },
  estimateBigValue: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary
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
  warningCard: {
    marginBottom: SPACING.md,
    borderColor: COLORS.status.warning,
    borderWidth: 1
  },
  warningText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.status.warning,
    marginBottom: SPACING.xs
  }
});

export { BuildWizardScreen };
export default BuildWizardScreen;