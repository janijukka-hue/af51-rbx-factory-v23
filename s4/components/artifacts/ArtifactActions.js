// s4/components/artifacts/ArtifactActions.js
// ALX Factory - Artifact Actions Component
// Version: 1.0.0

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "../common/Button.js";
import { Modal, ConfirmDialog } from "../common/Modal.js";

function ArtifactActions(props) {
  var artifact = props.artifact;
  var onCopy = props.onCopy;
  var onShare = props.onShare;
  var onDownload = props.onDownload;
  var onExport = props.onExport;
  var onDelete = props.onDelete;
  var onRebuild = props.onRebuild;
  var onViewLogs = props.onViewLogs;
  var onViewReports = props.onViewReports;
  var compact = props.compact || false;
  var style = props.style;

  var loadingState = useState(null);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var confirmDeleteState = useState(false);
  var confirmDelete = confirmDeleteState[0];
  var setConfirmDelete = confirmDeleteState[1];

  var handleAction = useCallback(async function(action, handler) {
    if (!handler) return;

    setLoading(action);
    try {
      await handler(artifact);
    } catch (err) {
      console.error("[ArtifactActions] " + action + " error:", err);
    } finally {
      setLoading(null);
    }
  }, [artifact, setLoading]);

  var handleCopy = useCallback(function() {
    handleAction("copy", onCopy);
  }, [handleAction, onCopy]);

  var handleShare = useCallback(function() {
    handleAction("share", onShare);
  }, [handleAction, onShare]);

  var handleDownload = useCallback(function() {
    handleAction("download", onDownload);
  }, [handleAction, onDownload]);

  var handleExport = useCallback(function() {
    handleAction("export", onExport);
  }, [handleAction, onExport]);

  var handleDelete = useCallback(function() {
    setConfirmDelete(true);
  }, [setConfirmDelete]);

  var confirmDeleteAction = useCallback(async function() {
    setConfirmDelete(false);
    await handleAction("delete", onDelete);
  }, [handleAction, onDelete, setConfirmDelete]);

  var handleRebuild = useCallback(function() {
    handleAction("rebuild", onRebuild);
  }, [handleAction, onRebuild]);

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <ActionIconButton
          icon="📋"
          label="Copy"
          onPress={handleCopy}
          loading={loading === "copy"}
          disabled={!onCopy}
        />
        <ActionIconButton
          icon="↗"
          label="Share"
          onPress={handleShare}
          loading={loading === "share"}
          disabled={!onShare}
        />
        <ActionIconButton
          icon="⬇"
          label="Download"
          onPress={handleDownload}
          loading={loading === "download"}
          disabled={!onDownload}
        />
        {onViewLogs && (
          <ActionIconButton
            icon="📋"
            label="Logs"
            onPress={onViewLogs}
          />
        )}
        {onViewReports && (
          <ActionIconButton
            icon="📊"
            label="Reports"
            onPress={onViewReports}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.primaryActions}>
        <Button
          variant={BUTTON_VARIANT.PRIMARY}
          size={BUTTON_SIZE.MD}
          onPress={handleCopy}
          loading={loading === "copy"}
          disabled={!onCopy}
          style={styles.actionButton}
        >
          Copy Code
        </Button>

        <Button
          variant={BUTTON_VARIANT.OUTLINE}
          size={BUTTON_SIZE.MD}
          onPress={handleShare}
          loading={loading === "share"}
          disabled={!onShare}
          style={styles.actionButton}
        >
          Share
        </Button>

        <Button
          variant={BUTTON_VARIANT.OUTLINE}
          size={BUTTON_SIZE.MD}
          onPress={handleDownload}
          loading={loading === "download"}
          disabled={!onDownload}
          style={styles.actionButton}
        >
          Download
        </Button>
      </View>

      <View style={styles.secondaryActions}>
        {onExport && (
          <Button
            variant={BUTTON_VARIANT.GHOST}
            size={BUTTON_SIZE.SM}
            onPress={handleExport}
            loading={loading === "export"}
          >
            Export
          </Button>
        )}

        {onRebuild && (
          <Button
            variant={BUTTON_VARIANT.GHOST}
            size={BUTTON_SIZE.SM}
            onPress={handleRebuild}
            loading={loading === "rebuild"}
          >
            Rebuild
          </Button>
        )}

        {onViewLogs && (
          <Button
            variant={BUTTON_VARIANT.GHOST}
            size={BUTTON_SIZE.SM}
            onPress={onViewLogs}
          >
            View Logs
          </Button>
        )}

        {onViewReports && (
          <Button
            variant={BUTTON_VARIANT.GHOST}
            size={BUTTON_SIZE.SM}
            onPress={onViewReports}
          >
            Reports
          </Button>
        )}

        {onDelete && (
          <Button
            variant={BUTTON_VARIANT.DANGER}
            size={BUTTON_SIZE.SM}
            onPress={handleDelete}
            loading={loading === "delete"}
          >
            Delete
          </Button>
        )}
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete Artifact"
        message={"Are you sure you want to delete \"" + (artifact ? artifact.title : "") + "\"? This action cannot be undone."}
        confirmLabel="Delete"
        confirmVariant={BUTTON_VARIANT.DANGER}
        onConfirm={confirmDeleteAction}
        onCancel={function() { setConfirmDelete(false); }}
      />
    </View>
  );
}

function ActionIconButton(props) {
  var icon = props.icon;
  var label = props.label;
  var onPress = props.onPress;
  var loading = props.loading || false;
  var disabled = props.disabled || false;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.iconButton,
        disabled && styles.iconButtonDisabled
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <Text style={[styles.iconButtonIcon, disabled && styles.iconButtonIconDisabled]}>
          {icon}
        </Text>
      )}
      <Text style={[styles.iconButtonLabel, disabled && styles.iconButtonLabelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ExportOptionsModal(props) {
  var visible = props.visible || false;
  var onClose = props.onClose;
  var onSelectFormat = props.onSelectFormat;

  var formats = [
    { id: "json", label: "JSON", description: "Full artifact data" },
    { id: "code", label: "Code Only", description: "Just the source code" },
    { id: "markdown", label: "Markdown", description: "Documentation format" }
  ];

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Export Format"
      size="sm"
    >
      <View style={styles.exportOptions}>
        {formats.map(function(format) {
          return (
            <Pressable
              key={format.id}
              onPress={function() {
                onSelectFormat(format.id);
                onClose();
              }}
              style={styles.exportOption}
            >
              <Text style={styles.exportOptionLabel}>{format.label}</Text>
              <Text style={styles.exportOptionDescription}>{format.description}</Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

var styles = StyleSheet.create({
  container: {},
  compactContainer: {
    flexDirection: "row",
    justifyContent: "space-around"
  },
  primaryActions: {
    flexDirection: "row",
    marginBottom: SPACING.sm
  },
  secondaryActions: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  actionButton: {
    flex: 1,
    marginRight: SPACING.sm
  },
  iconButton: {
    alignItems: "center",
    padding: SPACING.sm
  },
  iconButtonDisabled: {
    opacity: 0.5
  },
  iconButtonIcon: {
    fontSize: 20,
    marginBottom: SPACING.xs
  },
  iconButtonIconDisabled: {
    color: COLORS.text.disabled
  },
  iconButtonLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary
  },
  iconButtonLabelDisabled: {
    color: COLORS.text.disabled
  },
  exportOptions: {},
  exportOption: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  exportOptionLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: "600"
  },
  exportOptionDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginTop: SPACING.xs
  }
});

export { ArtifactActions, ActionIconButton, ExportOptionsModal };
export default ArtifactActions;