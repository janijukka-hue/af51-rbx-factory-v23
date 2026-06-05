// ui/components/CenterPanel/ChatInput.js
// React Native

import React, { useState, useCallback } from "react";
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from "react-native";
import { COLORS, SIZES } from "../../styles/theme.js";

export function ChatInput({ onSend, disabled = false }) {
  const [value, setValue] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }, [value, disabled, onSend]);

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, disabled && styles.inputDisabled]}
        value={value}
        onChangeText={setValue}
        value={disabled ? "Processing..." : "Type a command..."}
        valueTextColor={COLORS.gray500}
        returnKeyType="send"
        onSubmitEditing={handleSend}
        editable={!disabled}
        multiline={false}
      />
      <TouchableOpacity
        style={[styles.button, (disabled || !value.trim()) && styles.buttonDisabled]}
        onPress={handleSend}
        disabled={disabled || !value.trim()}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray700,
    backgroundColor: COLORS.black
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.blackLight,
    color: COLORS.gray200,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusFull,
    fontSize: SIZES.fontMd,
    marginRight: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.gray700
  },
  inputDisabled: {
    opacity: 0.5
  },
  button: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.cyan,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center"
  },
  buttonDisabled: {
    backgroundColor: COLORS.gray700
  },
  buttonText: {
    color: COLORS.black,
    fontSize: 18,
    fontWeight: "bold"
  }
});

export default ChatInput;