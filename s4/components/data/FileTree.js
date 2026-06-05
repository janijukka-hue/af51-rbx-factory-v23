// s4/components/data/FileTree.js
// ALX Factory - File Tree Component
// Version: 1.0.0

import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

var FILE_ICONS = {
  folder: "📁",
  folderOpen: "📂",
  js: "📄",
  jsx: "⚛️",
  ts: "📘",
  tsx: "⚛️",
  json: "📋",
  md: "📝",
  html: "🌐",
  css: "🎨",
  default: "📄"
};

function FileTree(props) {
  var files = props.files || [];
  var onSelect = props.onSelect;
  var selectedPath = props.selectedPath;
  var style = props.style;

  var tree = buildTree(files);

  return (
    <ScrollView style={[styles.container, style]}>
      {tree.map(function(node) {
        return (
          <TreeNode
            key={node.path}
            node={node}
            level={0}
            onSelect={onSelect}
            selectedPath={selectedPath}
          />
        );
      })}
    </ScrollView>
  );
}

function TreeNode(props) {
  var node = props.node;
  var level = props.level;
  var onSelect = props.onSelect;
  var selectedPath = props.selectedPath;

  var expandedState = useState(level < 2);
  var expanded = expandedState[0];
  var setExpanded = expandedState[1];

  var isFolder = node.type === "folder";
  var isSelected = selectedPath === node.path;

  var icon = isFolder
    ? (expanded ? FILE_ICONS.folderOpen : FILE_ICONS.folder)
    : getFileIcon(node.name);

  function handlePress() {
    if (isFolder) {
      setExpanded(!expanded);
    } else if (onSelect) {
      onSelect(node);
    }
  }

  return (
    <View>
      <Pressable
        onPress={handlePress}
        style={[
          styles.node,
          { paddingLeft: SPACING.md + level * SPACING.md },
          isSelected && styles.nodeSelected
        ]}
      >
        <Text style={styles.icon}>{icon}</Text>
        <Text
          style={[styles.name, isSelected && styles.nameSelected]}
          numberOfLines={1}
        >
          {node.name}
        </Text>
        {node.size && (
          <Text style={styles.size}>{formatSize(node.size)}</Text>
        )}
      </Pressable>

      {isFolder && expanded && node.children && (
        <View>
          {node.children.map(function(child) {
            return (
              <TreeNode
                key={child.path}
                node={child}
                level={level + 1}
                onSelect={onSelect}
                selectedPath={selectedPath}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

function buildTree(files) {
  var root = [];
  var map = {};

  files.forEach(function(file) {
    var parts = file.path.split("/").filter(Boolean);
    var current = root;
    var currentPath = "";

    parts.forEach(function(part, index) {
      currentPath = currentPath ? currentPath + "/" + part : part;
      var isLast = index === parts.length - 1;

      var existing = current.find(function(n) { return n.name === part; });

      if (!existing) {
        var newNode = {
          name: part,
          path: currentPath,
          type: isLast ? "file" : "folder",
          children: isLast ? undefined : [],
          content: isLast ? file.content : undefined,
          size: isLast ? (file.content ? file.content.length : 0) : undefined
        };
        current.push(newNode);
        map[currentPath] = newNode;
        current = newNode.children || [];
      } else {
        current = existing.children || [];
      }
    });
  });

  function sortNodes(nodes) {
    nodes.sort(function(a, b) {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(function(node) {
      if (node.children) sortNodes(node.children);
    });
  }

  sortNodes(root);
  return root;
}

function getFileIcon(filename) {
  if (!filename) return FILE_ICONS.default;
  var ext = filename.split(".").pop().toLowerCase();
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

var styles = StyleSheet.create({
  container: {
    flex: 1
  },
  node: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    paddingRight: SPACING.md
  },
  nodeSelected: {
    backgroundColor: COLORS.primaryLight
  },
  icon: {
    fontSize: 14,
    marginRight: SPACING.xs
  },
  name: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.primary,
    flex: 1
  },
  nameSelected: {
    color: COLORS.primary,
    fontWeight: "600"
  },
  size: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  }
});

export { FileTree };
export default FileTree;