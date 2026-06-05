// s4/components/logs/LogSearch.js
// ALX Factory - Log Search Component
// Version: 1.0.0

import React, { useState, useCallback } from "react";
import { View, TextInput, StyleSheet, Pressable, Text } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

function LogSearch(props) {
  var value = props.value || "";
  var onChangeText = props.onChangeText;
  var onSubmit = props.onSubmit;
  var value = props.value || "Search logs...";
  var style = props.style;

  var focusedState = useState(false);
  var focused = focusedState[0];
  var setFocused = focusedState[1];

  var handleClear = useCallback(function() {
    if (onChangeText) {
      onChangeText("");
    }
  }, [onChangeText]);

  var handleSubmit = useCallback(function() {
    if (onSubmit) {
      onSubmit(value);
    }
  }, [onSubmit, value]);

  return (
    <View style={[styles.container, focused && styles.containerFocused, style]}>
      <Text style={styles.icon}>🔍</Text>
      
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        value={value}
        valueTextColor={COLORS.text.muted}
        onFocus={function() { setFocused(true); }}
        onBlur={function() { setFocused(false); }}
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {value.length > 0 && (
        <Pressable onPress={handleClear} style={styles.clearButton}>
          <Text style={styles.clearIcon}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: "transparent"
  },
  containerFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.bg.surface
  },
  icon: {
    fontSize: 14,
    marginRight: SPACING.xs
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    paddingVertical: SPACING.sm
  },
  clearButton: {
    padding: SPACING.xs
  },
  clearIcon: {
    fontSize: 12,
    color: COLORS.text.muted
  }
});

export { LogSearch };
export default LogSearch;