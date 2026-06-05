// s4/components/artifacts/FileList.js
// ALX Factory - File List Component
// Version: 1.0.0

import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Badge, BADGE_VARIANT } from "../common/Badge.js";
import { formatBytes } from "../../utils/formatters.js";

var FILE_ICONS = {
  javascript: "📄",
  typescript: "📘",
  json: "📋",
  html: "🌐",
  css: "🎨",
  markdown: "📝",
  text: "📄",
  binary: "📦"
};

var LANGUAGE_COLORS = {
  javascript: "#f7df1e",
  typescript: "#3178c6",
  json: "#292929",
  html: "#e34c26",
  css: "#264de4",
  markdown: "#083fa1",
  text: COLORS.text.muted
};

function FileList(props) {
  var files = props.files || [];
  var selectedFileId = props.selectedFileId;
  var onFileSelect = props.onFileSelect;
  var showSize = props.showSize !== false;
  var showIcon = props.showIcon !== false;
  var compact = props.compact || false;
  var style = props.style;

  if (files.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Text style={styles.emptyText}>No files</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {files.map(function(file) {
        var isSelected = file.id === selectedFileId || file.path === selectedFileId;

        return (
          <FileListItem
            key={file.id || file.path}
            file={file}
            selected={isSelected}
            onPress={function() {
              if (onFileSelect) {
                onFileSelect(file);
              }
            }}
            showSize={showSize}
            showIcon={showIcon}
            compact={compact}
          />
        );
      })}
    </View>
  );
}

function FileListItem(props) {
  var file = props.file;
  var selected = props.selected || false;
  var onPress = props.onPress;
  var showSize = props.showSize !== false;
  var showIcon = props.showIcon !== false;
  var compact = props.compact || false;

  var icon = FILE_ICONS[file.type] || FILE_ICONS.text;
  var langColor = LANGUAGE_COLORS[file.language] || COLORS.text.muted;

  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.compactItem, selected && styles.itemSelected]}
      >
        {showIcon && <Text style={styles.compactIcon}>{icon}</Text>}
        <Text style={[styles.compactName, selected && styles.nameSelected]} numberOfLines={1}>
          {file.name || file.path}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={[styles.item, selected && styles.itemSelected]}
    >
      <View style={styles.itemContent}>
        {showIcon && (
          <Text style={styles.icon}>{icon}</Text>
        )}

        <View style={styles.itemDetails}>
          <Text style={[styles.fileName, selected && styles.nameSelected]} numberOfLines={1}>
            {file.name || file.path}
          </Text>
          
          <View style={styles.itemMeta}>
            <View style={[styles.languageDot, { backgroundColor: langColor }]} />
            <Text style={styles.language}>{file.language}</Text>
            
            {showSize && file.size > 0 && (
              <Text style={styles.size}>{formatBytes(file.size)}</Text>
            )}
          </View>
        </View>
      </View>

      {selected && (
        <View style={styles.selectedIndicator} />
      )}
    </Pressable>
  );
}

function FileListHeader(props) {
  var fileCount = props.fileCount || 0;
  var totalSize = props.totalSize || 0;
  var onExpandAll = props.onExpandAll;
  var onCollapseAll = props.onCollapseAll;
  var style = props.style;

  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>Files</Text>
        <Badge
          variant={BADGE_VARIANT.DEFAULT}
          label={fileCount + " files"}
          size="sm"
        />
      </View>

      <View style={styles.headerRight}>
        <Text style={styles.headerSize}>{formatBytes(totalSize)}</Text>
      </View>
    </View>
  );
}

function GroupedFileList(props) {
  var files = props.files || [];
  var selectedFileId = props.selectedFileId;
  var onFileSelect = props.onFileSelect;
  var style = props.style;

  var grouped = groupFilesByDirectory(files);
  var directories = Object.keys(grouped).sort();

  return (
    <View style={[styles.container, style]}>
      {directories.map(function(dir) {
        var dirFiles = grouped[dir];
        var isRoot = dir === ".";

        return (
          <View key={dir} style={styles.group}>
            {!isRoot && (
              <View style={styles.groupHeader}>
                <Text style={styles.groupIcon}>📁</Text>
                <Text style={styles.groupName}>{dir}</Text>
                <Text style={styles.groupCount}>{dirFiles.length}</Text>
              </View>
            )}

            {dirFiles.map(function(file) {
              var isSelected = file.id === selectedFileId || file.path === selectedFileId;

              return (
                <FileListItem
                  key={file.id || file.path}
                  file={file}
                  selected={isSelected}
                  onPress={function() {
                    if (onFileSelect) {
                      onFileSelect(file);
                    }
                  }}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function groupFilesByDirectory(files) {
  var groups = {};

  files.forEach(function(file) {
    var path = file.path || file.name || "";
    var parts = path.split("/");
    var dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";

    if (!groups[dir]) {
      groups[dir] = [];
    }

    groups[dir].push({
      ...file,
      name: parts[parts.length - 1]
    });
  });

  return groups;
}

var styles = StyleSheet.create({
  container: {},
  emptyContainer: {
    alignItems: "center",
    padding: SPACING.lg
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle,
    position: "relative"
  },
  compactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm
  },
  itemSelected: {
    backgroundColor: COLORS.primaryLight
  },
  itemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center"
  },
  icon: {
    fontSize: 18,
    marginRight: SPACING.sm
  },
  compactIcon: {
    fontSize: 14,
    marginRight: SPACING.xs
  },
  itemDetails: {
    flex: 1
  },
  fileName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary
  },
  compactName: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.primary
  },
  nameSelected: {
    color: COLORS.primary,
    fontWeight: "600"
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2
  },
  languageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING.xs
  },
  language: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  size: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginLeft: SPACING.sm
  },
  selectedIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: COLORS.primary
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    marginRight: SPACING.sm
  },
  headerRight: {},
  headerSize: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  group: {
    marginBottom: SPACING.sm
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.bg.overlay
  },
  groupIcon: {
    fontSize: 14,
    marginRight: SPACING.xs
  },
  groupName: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.secondary,
    fontWeight: "600",
    flex: 1
  },
  groupCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  }
});

export { FileList, FileListItem, FileListHeader, GroupedFileList };
export default FileList;