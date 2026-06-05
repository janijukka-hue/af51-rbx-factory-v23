// s4/screens/ArtifactDetails/ArtifactDetailsScreen.js
// ALX Factory - Artifact Details Screen
// Version: 1.0.1 - Fixed ESLint deps

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { ROUTES } from "../../navigation/routes.js";
import { Card } from "../../components/common/Card.js";
import { Badge, BADGE_VARIANT } from "../../components/common/Badge.js";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "../../components/common/Button.js";
import { useToast } from "../../components/common/Toast.js";
import { EnergyMeter } from "../../components/factory/EnergyMeter.js";
import { CodeBlock } from "../../components/data/CodeBlock.js";
import { ArtifactMetadata } from "../../components/artifacts/ArtifactMetadata.js";
import { ArtifactActions } from "../../components/artifacts/ArtifactActions.js";
import { FileList, FileListHeader } from "../../components/artifacts/FileList.js";
import { useFactory } from "../../hooks/useFactory.js";
import { createArtifactService } from "../../services/ArtifactService.js";
import { formatBytes, formatRelativeTime } from "../../utils/formatters.js";

function ArtifactDetailsScreen(props) {
  var route = props.route;
  var navigation = props.navigation;
  var orchestrator = props.orchestrator;

  var artifactId = route && route.params ? route.params.artifactId : null;

  var factory = useFactory(orchestrator);
  var toast = useToast();

  var artifactServiceRef = useRef(null);

  var refreshingState = useState(false);
  var refreshing = refreshingState[0];
  var setRefreshing = refreshingState[1];

  var artifactState = useState(null);
  var artifact = artifactState[0];
  var setArtifact = artifactState[1];

  var activeTabState = useState("code");
  var activeTab = activeTabState[0];
  var setActiveTab = activeTabState[1];

  var selectedFileState = useState(null);
  var selectedFile = selectedFileState[0];
  var setSelectedFile = selectedFileState[1];

  useEffect(function() {
    artifactServiceRef.current = createArtifactService(orchestrator);
  }, [orchestrator]);

  var loadArtifact = useCallback(async function() {
    if (!artifactServiceRef.current || !artifactId) return;

    var loaded = await artifactServiceRef.current.getArtifact(artifactId);
    if (loaded) {
      setArtifact(loaded);
      if (loaded.files && loaded.files.length > 0) {
        setSelectedFile(loaded.files[0]);
      }
    }
  }, [artifactId, setArtifact, setSelectedFile]);

  useEffect(function() {
    if (artifactId && artifactServiceRef.current) {
      loadArtifact();
    }
  }, [artifactId, loadArtifact]);

  var onRefresh = useCallback(async function() {
    setRefreshing(true);
    await loadArtifact();
    setRefreshing(false);
  }, [loadArtifact, setRefreshing]);

  var handleCopy = useCallback(async function() {
    if (!artifact || !artifactServiceRef.current) return;

    var success = await artifactServiceRef.current.copyToClipboard(
      selectedFile ? selectedFile.content : artifact.code
    );

    if (success) {
      toast.success("Copied to clipboard");
    } else {
      toast.error("Failed to copy");
    }
  }, [artifact, selectedFile, toast]);

  var handleShare = useCallback(async function() {
    if (!artifact || !artifactServiceRef.current) return;

    var result = await artifactServiceRef.current.shareArtifact(artifact);

    if (result.success) {
      toast.success("Shared successfully");
    } else if (result.error) {
      toast.error(result.error);
    }
  }, [artifact, toast]);

  var handleDownload = useCallback(async function() {
    if (!artifact || !artifactServiceRef.current) return;

    var result = await artifactServiceRef.current.downloadArtifact(artifact);

    if (result.success) {
      toast.success("Download started");
    }
  }, [artifact, toast]);

  var handleViewLogs = useCallback(function() {
    if (artifact && artifact.buildId && navigation) {
      navigation.navigate(ROUTES.JOB_DETAILS, { jobId: artifact.buildId });
    }
  }, [artifact, navigation]);

  var handleViewReports = useCallback(function() {
    if (artifact && navigation) {
      navigation.navigate(ROUTES.REPORTS, { artifactId: artifact.id });
    }
  }, [artifact, navigation]);

  var handleFileSelect = useCallback(function(file) {
    setSelectedFile(file);
  }, [setSelectedFile]);

  var handleViewFile = useCallback(function(file) {
    if (navigation && artifact) {
      navigation.navigate(ROUTES.FILE_VIEWER, {
        artifactId: artifact.id,
        fileId: file.id || file.path
      });
    }
  }, [artifact, navigation]);

  function handleGoBack() {
    if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  }

  if (!artifact) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={handleGoBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Artifact Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={handleGoBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {artifact.title}
          </Text>
          <Badge variant={BADGE_VARIANT.PRIMARY} label={artifact.type} size="sm" />
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton
          label="Code"
          active={activeTab === "code"}
          onPress={function() { setActiveTab("code"); }}
        />
        <TabButton
          label="Files"
          active={activeTab === "files"}
          onPress={function() { setActiveTab("files"); }}
          badge={artifact.fileCount}
        />
        <TabButton
          label="Info"
          active={activeTab === "info"}
          onPress={function() { setActiveTab("info"); }}
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {activeTab === "code" && (
          <CodeTab
            artifact={artifact}
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
          />
        )}

        {activeTab === "files" && (
          <FilesTab
            artifact={artifact}
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onViewFile={handleViewFile}
          />
        )}

        {activeTab === "info" && (
          <InfoTab artifact={artifact} />
        )}
      </ScrollView>

      <View style={styles.actionsBar}>
        <ArtifactActions
          artifact={artifact}
          onCopy={handleCopy}
          onShare={handleShare}
          onDownload={handleDownload}
          onViewLogs={artifact.buildId ? handleViewLogs : null}
          onViewReports={artifact.reports && artifact.reports.length > 0 ? handleViewReports : null}
          compact
        />
      </View>
    </SafeAreaView>
  );
}

function TabButton(props) {
  var label = props.label;
  var active = props.active;
  var onPress = props.onPress;
  var badge = props.badge;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
      {badge > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      )}
      {active && <View style={styles.tabIndicator} />}
    </Pressable>
  );
}

function CodeTab(props) {
  var artifact = props.artifact;
  var selectedFile = props.selectedFile;
  var onFileSelect = props.onFileSelect;

  var code = selectedFile ? selectedFile.content : artifact.code;
  var language = selectedFile ? selectedFile.language : artifact.language;
  var filename = selectedFile ? selectedFile.name : "main." + (artifact.language === "typescript" ? "ts" : "js");

  return (
    <View>
      {artifact.files && artifact.files.length > 1 && (
        <Card style={styles.fileSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {artifact.files.map(function(file) {
              var isSelected = selectedFile && (file.id === selectedFile.id || file.path === selectedFile.path);
              return (
                <Pressable
                  key={file.id || file.path}
                  onPress={function() { onFileSelect(file); }}
                  style={[styles.fileSelectorItem, isSelected && styles.fileSelectorItemActive]}
                >
                  <Text style={[styles.fileSelectorText, isSelected && styles.fileSelectorTextActive]}>
                    {file.name || file.path}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>
      )}

      <CodeBlock
        code={code}
        language={language}
        title={filename}
        showLineNumbers
      />
    </View>
  );
}

function FilesTab(props) {
  var artifact = props.artifact;
  var selectedFile = props.selectedFile;
  var onFileSelect = props.onFileSelect;
  var onViewFile = props.onViewFile;

  return (
    <View>
      <FileListHeader
        fileCount={artifact.fileCount}
        totalSize={artifact.size}
      />

      <FileList
        files={artifact.files}
        selectedFileId={selectedFile ? selectedFile.id || selectedFile.path : null}
        onFileSelect={function(file) {
          onFileSelect(file);
          onViewFile(file);
        }}
        showSize
        showIcon
      />
    </View>
  );
}

function InfoTab(props) {
  var artifact = props.artifact;

  return (
    <View>
      <Card title="Energy" style={styles.card}>
        <EnergyMeter
          energy={artifact.energy}
          maxEnergy={100}
          showValue
          size="lg"
        />
      </Card>

      <Card title="Metadata" style={styles.card}>
        <ArtifactMetadata artifact={artifact} />
      </Card>
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm
  },
  backIcon: {
    fontSize: 24,
    color: COLORS.text.primary
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center"
  },
  headerTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    marginRight: SPACING.sm,
    flex: 1
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    position: "relative"
  },
  tabButtonActive: {},
  tabLabel: {
    ...TYPOGRAPHY.button,
    color: COLORS.text.muted
  },
  tabLabelActive: {
    color: COLORS.primary
  },
  tabBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SPACING.xs,
    paddingHorizontal: 4
  },
  tabBadgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "700"
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "25%",
    right: "25%",
    height: 2,
    backgroundColor: COLORS.primary
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: SPACING.md
  },
  card: {
    marginBottom: SPACING.md
  },
  fileSelector: {
    marginBottom: SPACING.md,
    padding: SPACING.xs
  },
  fileSelectorItem: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginRight: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg.overlay
  },
  fileSelectorItemActive: {
    backgroundColor: COLORS.primaryLight
  },
  fileSelectorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary
  },
  fileSelectorTextActive: {
    color: COLORS.primary,
    fontWeight: "600"
  },
  actionsBar: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.subtle,
    backgroundColor: COLORS.bg.surface
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted
  }
});

export { ArtifactDetailsScreen };
export default ArtifactDetailsScreen;