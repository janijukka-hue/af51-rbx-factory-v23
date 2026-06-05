// s4/screens/FileViewer/FileViewerScreen.js
// ALX Factory - File Viewer Screen
// Version: 1.0.1 - Fixed ESLint deps

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Badge, BADGE_VARIANT } from "../../components/common/Badge.js";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "../../components/common/Button.js";
import { useToast } from "../../components/common/Toast.js";
import { CodeBlock } from "../../components/data/CodeBlock.js";
import { createArtifactService } from "../../services/ArtifactService.js";
import { formatBytes } from "../../utils/formatters.js";

var screenWidth = Dimensions.get("window").width;

function FileViewerScreen(props) {
  var route = props.route;
  var navigation = props.navigation;
  var orchestrator = props.orchestrator;

  var artifactId = route && route.params ? route.params.artifactId : null;
  var fileId = route && route.params ? route.params.fileId : null;

  var toast = useToast();
  var artifactServiceRef = useRef(null);

  var artifactState = useState(null);
  var artifact = artifactState[0];
  var setArtifact = artifactState[1];

  var fileState = useState(null);
  var file = fileState[0];
  var setFile = fileState[1];

  var currentFileIndexState = useState(0);
  var currentFileIndex = currentFileIndexState[0];
  var setCurrentFileIndex = currentFileIndexState[1];

  var wrapLinesState = useState(false);
  var wrapLines = wrapLinesState[0];
  var setWrapLines = wrapLinesState[1];

  var showLineNumbersState = useState(true);
  var showLineNumbers = showLineNumbersState[0];
  var setShowLineNumbers = showLineNumbersState[1];

  useEffect(function() {
    artifactServiceRef.current = createArtifactService(orchestrator);
  }, [orchestrator]);

  var loadArtifact = useCallback(async function() {
    if (!artifactServiceRef.current || !artifactId) return;

    var loaded = await artifactServiceRef.current.getArtifact(artifactId);
    if (loaded) {
      setArtifact(loaded);
    }
  }, [artifactId, setArtifact]);

  useEffect(function() {
    if (artifactId && artifactServiceRef.current) {
      loadArtifact();
    }
  }, [artifactId, loadArtifact]);

  useEffect(function() {
    if (artifact && fileId && artifactServiceRef.current) {
      var found = artifactServiceRef.current.getFile(artifact, fileId);
      if (found) {
        setFile(found);
        var index = artifact.files.findIndex(function(f) {
          return f.id === fileId || f.path === fileId;
        });
        if (index >= 0) {
          setCurrentFileIndex(index);
        }
      }
    }
  }, [artifact, fileId, setFile, setCurrentFileIndex]);

  var handleCopy = useCallback(async function() {
    if (!file || !artifactServiceRef.current) return;

    var success = await artifactServiceRef.current.copyToClipboard(file.content);

    if (success) {
      toast.success("Copied to clipboard");
    } else {
      toast.error("Failed to copy");
    }
  }, [file, toast]);

  var handlePrevFile = useCallback(function() {
    if (!artifact || currentFileIndex <= 0) return;

    var newIndex = currentFileIndex - 1;
    var newFile = artifact.files[newIndex];
    setCurrentFileIndex(newIndex);
    setFile(newFile);
  }, [artifact, currentFileIndex, setCurrentFileIndex, setFile]);

  var handleNextFile = useCallback(function() {
    if (!artifact || currentFileIndex >= artifact.files.length - 1) return;

    var newIndex = currentFileIndex + 1;
    var newFile = artifact.files[newIndex];
    setCurrentFileIndex(newIndex);
    setFile(newFile);
  }, [artifact, currentFileIndex, setCurrentFileIndex, setFile]);

  function handleGoBack() {
    if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  }

  if (!file) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={handleGoBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>File Viewer</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  var lineCount = file.content ? file.content.split("\n").length : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={handleGoBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {file.name || file.path}
          </Text>
          <Badge variant={BADGE_VARIANT.DEFAULT} label={file.language} size="sm" />
        </View>
        <Pressable onPress={handleCopy} style={styles.copyButton}>
          <Text style={styles.copyIcon}>📋</Text>
        </Pressable>
      </View>

      <View style={styles.fileInfo}>
        <View style={styles.fileInfoLeft}>
          <Text style={styles.fileInfoText}>
            {lineCount} lines · {formatBytes(file.size)}
          </Text>
        </View>

        {artifact && artifact.files.length > 1 && (
          <View style={styles.fileNavigation}>
            <Pressable
              onPress={handlePrevFile}
              disabled={currentFileIndex <= 0}
              style={[styles.navButton, currentFileIndex <= 0 && styles.navButtonDisabled]}
            >
              <Text style={styles.navButtonText}>←</Text>
            </Pressable>
            <Text style={styles.fileCounter}>
              {currentFileIndex + 1} / {artifact.files.length}
            </Text>
            <Pressable
              onPress={handleNextFile}
              disabled={currentFileIndex >= artifact.files.length - 1}
              style={[styles.navButton, currentFileIndex >= artifact.files.length - 1 && styles.navButtonDisabled]}
            >
              <Text style={styles.navButtonText}>→</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.toolbar}>
        <Pressable
          onPress={function() { setShowLineNumbers(!showLineNumbers); }}
          style={[styles.toolbarButton, showLineNumbers && styles.toolbarButtonActive]}
        >
          <Text style={styles.toolbarButtonText}>Line #</Text>
        </Pressable>
        <Pressable
          onPress={function() { setWrapLines(!wrapLines); }}
          style={[styles.toolbarButton, wrapLines && styles.toolbarButtonActive]}
        >
          <Text style={styles.toolbarButtonText}>Wrap</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content}>
        <CodeBlock
          code={file.content}
          language={file.language}
          showLineNumbers={showLineNumbers}
        />
      </ScrollView>

      {artifact && artifact.files.length > 1 && (
        <View style={styles.fileList}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {artifact.files.map(function(f, index) {
              var isActive = index === currentFileIndex;

              return (
                <Pressable
                  key={f.id || f.path}
                  onPress={function() {
                    setCurrentFileIndex(index);
                    setFile(f);
                  }}
                  style={[styles.fileListItem, isActive && styles.fileListItemActive]}
                >
                  <Text
                    style={[styles.fileListItemText, isActive && styles.fileListItemTextActive]}
                    numberOfLines={1}
                  >
                    {f.name || f.path}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
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
  copyButton: {
    padding: SPACING.xs
  },
  copyIcon: {
    fontSize: 18
  },
  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle,
    backgroundColor: COLORS.bg.surface
  },
  fileInfoLeft: {},
  fileInfoText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  fileNavigation: {
    flexDirection: "row",
    alignItems: "center"
  },
  navButton: {
    padding: SPACING.xs
  },
  navButtonDisabled: {
    opacity: 0.3
  },
  navButtonText: {
    fontSize: 16,
    color: COLORS.primary
  },
  fileCounter: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginHorizontal: SPACING.sm
  },
  toolbar: {
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  toolbarButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginRight: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg.overlay
  },
  toolbarButtonActive: {
    backgroundColor: COLORS.primaryLight
  },
  toolbarButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary
  },
  content: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted
  },
  fileList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border.subtle,
    backgroundColor: COLORS.bg.surface,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm
  },
  fileListItem: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginRight: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg.overlay,
    maxWidth: 120
  },
  fileListItemActive: {
    backgroundColor: COLORS.primaryLight
  },
  fileListItemText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary
  },
  fileListItemTextActive: {
    color: COLORS.primary,
    fontWeight: "600"
  }
});

export { FileViewerScreen };
export default FileViewerScreen;