// s4/components/data/CodeBlock.js
// ALX Factory - Code Block Component
// Version: 1.0.0

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable
} from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

var SYNTAX_COLORS = {
  keyword: "#c678dd",
  string: "#98c379",
  number: "#d19a66",
  comment: "#5c6370",
  function: "#61afef",
  variable: "#e06c75",
  operator: "#56b6c2",
  punctuation: "#abb2bf"
};

var KEYWORDS = [
  "const", "let", "var", "function", "class", "import", "export",
  "from", "return", "if", "else", "for", "while", "switch", "case",
  "break", "continue", "try", "catch", "finally", "throw", "new",
  "async", "await", "default", "extends", "super", "this", "null",
  "undefined", "true", "false", "typeof", "instanceof"
];

function CodeBlock(props) {
  var code = props.code || "";
  var language = props.language || "javascript";
  var title = props.title;
  var showLineNumbers = props.showLineNumbers !== false;
  var maxHeight = props.maxHeight;
  var style = props.style;
  var onCopy = props.onCopy;

  var copiedState = useState(false);
  var copied = copiedState[0];
  var setCopied = copiedState[1];

  var lines = code.split("\n");

  function handleCopy() {
    if (onCopy) {
      onCopy(code);
    }
    setCopied(true);
    setTimeout(function() {
      setCopied(false);
    }, 2000);
  }

  return (
    <View style={[styles.container, style]}>
      {title && (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerRight}>
            <Text style={styles.language}>{language}</Text>
            <Pressable onPress={handleCopy} style={styles.copyButton}>
              <Text style={styles.copyButtonText}>
                {copied ? "✓ Copied" : "Copy"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        style={[styles.codeScroll, maxHeight && { maxHeight: maxHeight }]}
        horizontal={false}
        showsVerticalScrollIndicator={true}
      >
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.codeContainer}>
            {showLineNumbers && (
              <View style={styles.lineNumbers}>
                {lines.map(function(_, index) {
                  return (
                    <Text key={index} style={styles.lineNumber}>
                      {index + 1}
                    </Text>
                  );
                })}
              </View>
            )}

            <View style={styles.codeContent}>
              {lines.map(function(line, index) {
                return (
                  <Text key={index} style={styles.codeLine}>
                    {highlightLine(line, language)}
                  </Text>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

function highlightLine(line, language) {
  var parts = [];
  var remaining = line;
  var key = 0;

  var commentIndex = remaining.indexOf("//");
  if (commentIndex !== -1) {
    if (commentIndex > 0) {
      parts.push(
        <Text key={key++}>{highlightTokens(remaining.substring(0, commentIndex))}</Text>
      );
    }
    parts.push(
      <Text key={key++} style={{ color: SYNTAX_COLORS.comment }}>
        {remaining.substring(commentIndex)}
      </Text>
    );
    return parts;
  }

  return highlightTokens(line);
}

function highlightTokens(text) {
  if (!text) return text;

  var parts = [];
  var regex = /(".*?"|'.*?'|`.*?`|\b\d+\.?\d*\b|\b[a-zA-Z_]\w*\b|[^\s\w]+|\s+)/g;
  var match;
  var key = 0;

  while ((match = regex.exec(text)) !== null) {
    var token = match[0];
    var style = null;

    if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`")) {
      style = { color: SYNTAX_COLORS.string };
    }
    else if (/^\d+\.?\d*$/.test(token)) {
      style = { color: SYNTAX_COLORS.number };
    }
    else if (KEYWORDS.indexOf(token) !== -1) {
      style = { color: SYNTAX_COLORS.keyword };
    }
    else if (/^[a-zA-Z_]\w*$/.test(token)) {
      var nextChar = text.charAt(regex.lastIndex);
      if (nextChar === "(") {
        style = { color: SYNTAX_COLORS.function };
      }
    }
    else if (/^[+\-*/%=<>!&|^~?:]+$/.test(token)) {
      style = { color: SYNTAX_COLORS.operator };
    }
    else if (/^[{}[\]();,.]$/.test(token)) {
      style = { color: SYNTAX_COLORS.punctuation };
    }

    parts.push(
      <Text key={key++} style={style}>
        {token}
      </Text>
    );
  }

  return parts.length > 0 ? parts : text;
}

var styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bg.base,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border.subtle
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  title: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.secondary,
    fontWeight: "600"
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center"
  },
  language: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginRight: SPACING.sm
  },
  copyButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.sm
  },
  copyButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary
  },
  codeScroll: {
    flex: 1
  },
  codeContainer: {
    flexDirection: "row",
    padding: SPACING.sm
  },
  lineNumbers: {
    paddingRight: SPACING.sm,
    borderRightWidth: 1,
    borderRightColor: COLORS.border.subtle,
    marginRight: SPACING.sm
  },
  lineNumber: {
    ...TYPOGRAPHY.code,
    color: COLORS.text.muted,
    textAlign: "right",
    minWidth: 24
  },
  codeContent: {
    flex: 1
  },
  codeLine: {
    ...TYPOGRAPHY.code,
    color: COLORS.text.primary
  }
});

export { CodeBlock, SYNTAX_COLORS };
export default CodeBlock;