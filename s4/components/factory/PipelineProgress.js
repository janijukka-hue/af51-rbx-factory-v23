// s4/components/factory/PipelineProgress.js
// ALX Factory - Pipeline Progress Component
// Version: 1.0.0

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

var PIPELINE_STAGES = [
  { id: "validate", label: "Validate", icon: "✓" },
  { id: "template", label: "Template", icon: "📋" },
  { id: "synthesize", label: "Synth", icon: "🔧" },
  { id: "deps", label: "Deps", icon: "📦" },
  { id: "build", label: "Build", icon: "🏗️" },
  { id: "test", label: "Test", icon: "🧪" },
  { id: "security", label: "Security", icon: "🔒" },
  { id: "package", label: "Package", icon: "📁" },
  { id: "preview", label: "Preview", icon: "👁️" },
  { id: "publish", label: "Publish", icon: "🚀" }
];

var STAGE_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped"
};

function PipelineProgress(props) {
  var currentStage = props.currentStage || 0;
  var stageStatuses = props.stageStatuses || {};
  var compact = props.compact || false;
  var style = props.style;

  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      {PIPELINE_STAGES.map(function(stage, index) {
        var status = stageStatuses[stage.id] ||
          (index < currentStage ? STAGE_STATUS.COMPLETED :
           index === currentStage ? STAGE_STATUS.RUNNING :
           STAGE_STATUS.PENDING);

        return (
          <React.Fragment key={stage.id}>
            <StageNode
              stage={stage}
              status={status}
              compact={compact}
            />
            {index < PIPELINE_STAGES.length - 1 && (
              <StageConnector
                completed={status === STAGE_STATUS.COMPLETED}
                compact={compact}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function StageNode(props) {
  var stage = props.stage;
  var status = props.status;
  var compact = props.compact;

  var statusStyles = getStatusStyles(status);

  return (
    <View style={[styles.stageNode, compact && styles.stageNodeCompact]}>
      <View style={[styles.stageCircle, statusStyles.circle]}>
        <Text style={[styles.stageIcon, statusStyles.icon]}>
          {status === STAGE_STATUS.COMPLETED ? "✓" :
           status === STAGE_STATUS.FAILED ? "✕" :
           status === STAGE_STATUS.RUNNING ? "◎" :
           stage.icon}
        </Text>
      </View>
      {!compact && (
        <Text style={[styles.stageLabel, statusStyles.label]}>
          {stage.label}
        </Text>
      )}
    </View>
  );
}

function StageConnector(props) {
  var completed = props.completed;
  var compact = props.compact;

  return (
    <View style={[
      styles.connector,
      compact && styles.connectorCompact,
      completed && styles.connectorCompleted
    ]} />
  );
}

function getStatusStyles(status) {
  var statusMap = {
    pending: {
      circle: { backgroundColor: COLORS.bg.overlay, borderColor: COLORS.border.default },
      icon: { color: COLORS.text.muted },
      label: { color: COLORS.text.muted }
    },
    running: {
      circle: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
      icon: { color: COLORS.primary },
      label: { color: COLORS.primary }
    },
    completed: {
      circle: { backgroundColor: COLORS.status.successLight, borderColor: COLORS.status.success },
      icon: { color: COLORS.status.success },
      label: { color: COLORS.status.success }
    },
    failed: {
      circle: { backgroundColor: COLORS.status.errorLight, borderColor: COLORS.status.error },
      icon: { color: COLORS.status.error },
      label: { color: COLORS.status.error }
    },
    skipped: {
      circle: { backgroundColor: COLORS.bg.overlay, borderColor: COLORS.border.subtle },
      icon: { color: COLORS.text.disabled },
      label: { color: COLORS.text.disabled }
    }
  };

  return statusMap[status] || statusMap.pending;
}

var styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap"
  },
  containerCompact: {
    alignItems: "center"
  },
  stageNode: {
    alignItems: "center",
    minWidth: 60
  },
  stageNodeCompact: {
    minWidth: 24
  },
  stageCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  stageIcon: {
    fontSize: 14
  },
  stageLabel: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
    textAlign: "center"
  },
  connector: {
    height: 2,
    flex: 1,
    minWidth: 20,
    maxWidth: 40,
    backgroundColor: COLORS.border.default,
    marginTop: 15,
    marginHorizontal: 4
  },
  connectorCompact: {
    minWidth: 8,
    maxWidth: 16,
    marginTop: 0
  },
  connectorCompleted: {
    backgroundColor: COLORS.status.success
  }
});

export { PipelineProgress, PIPELINE_STAGES, STAGE_STATUS };
export default PipelineProgress;