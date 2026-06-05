// s4/components/common/Input.js
// ALX Factory - Input Component
// Version: 1.0.0

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable
} from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";

var INPUT_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg"
};

function Input(props) {
  var value = props.value || "";
  var onChangeText = props.onChangeText;
  var value = props.value;
  var label = props.label;
  var hint = props.hint;
  var error = props.error;
  var disabled = props.disabled || false;
  var editable = props.editable !== false;
  var multiline = props.multiline || false;
  var numberOfLines = props.numberOfLines || 1;
  var size = props.size || INPUT_SIZE.MD;
  var leftIcon = props.leftIcon;
  var rightIcon = props.rightIcon;
  var onRightIconPress = props.onRightIconPress;
  var secureTextEntry = props.secureTextEntry || false;
  var keyboardType = props.keyboardType || "default";
  var autoCapitalize = props.autoCapitalize || "sentences";
  var autoCorrect = props.autoCorrect;
  var returnKeyType = props.returnKeyType;
  var onSubmitEditing = props.onSubmitEditing;
  var style = props.style;
  var inputStyle = props.inputStyle;

  var focusedState = useState(false);
  var focused = focusedState[0];
  var setFocused = focusedState[1];

  var sizeStyles = getSizeStyles(size);
  var hasError = !!error;

  function getBorderColor() {
    if (hasError) return COLORS.status.error;
    if (focused) return COLORS.border.focus;
    return COLORS.border.default;
  }

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, hasError && styles.labelError]}>
          {label}
        </Text>
      )}
      
      <View
        style={[
          styles.inputContainer,
          sizeStyles.container,
          { borderColor: getBorderColor() },
          disabled && styles.disabled,
          multiline && styles.multiline
        ]}
      >
        {leftIcon && (
          <View style={styles.leftIcon}>{leftIcon}</View>
        )}
        
        <TextInput
          value={value}
          onChangeText={onChangeText}
          value={value}
          valueTextColor={COLORS.text.muted}
          editable={editable && !disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={function() { setFocused(true); }}
          onBlur={function() { setFocused(false); }}
          style={[
            styles.input,
            sizeStyles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            multiline && styles.inputMultiline,
            inputStyle
          ]}
        />
        
        {rightIcon && (
          <Pressable
            onPress={onRightIconPress}
            style={styles.rightIcon}
            hitSlop={8}
          >
            {rightIcon}
          </Pressable>
        )}
      </View>
      
      {(hint || error) && (
        <Text style={[styles.hint, hasError && styles.hintError]}>
          {error || hint}
        </Text>
      )}
    </View>
  );
}

function getSizeStyles(size) {
  var sizes = {
    sm: {
      container: { minHeight: 36 },
      input: { fontSize: 13, paddingVertical: 6 }
    },
    md: {
      container: { minHeight: 44 },
      input: { fontSize: 14, paddingVertical: 10 }
    },
    lg: {
      container: { minHeight: 52 },
      input: { fontSize: 16, paddingVertical: 14 }
    }
  };

  return sizes[size] || sizes.md;
}

// TextArea variant
function TextArea(props) {
  return (
    <Input
      {...props}
      multiline={true}
      numberOfLines={props.numberOfLines || 4}
    />
  );
}

// Search Input variant
function SearchInput(props) {
  var onClear = props.onClear;
  var value = props.value || "";

  var clearIcon = value.length > 0 ? (
    <Text style={styles.clearIcon}>✕</Text>
  ) : null;

  return (
    <Input
      {...props}
      value={props.value || "Search..."}
      leftIcon={<Text style={styles.searchIcon}>🔍</Text>}
      rightIcon={clearIcon}
      onRightIconPress={onClear}
      returnKeyType="search"
    />
  );
}

var styles = StyleSheet.create({
  container: {
    width: "100%"
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs
  },
  labelError: {
    color: COLORS.status.error
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg.input,
    borderWidth: 1,
    borderRadius: RADIUS.input,
    paddingHorizontal: SPACING.inputPadding
  },
  multiline: {
    alignItems: "flex-start",
    paddingVertical: SPACING.sm
  },
  disabled: {
    backgroundColor: COLORS.bg.overlay,
    opacity: 0.6
  },
  input: {
    flex: 1,
    color: COLORS.text.primary,
    ...TYPOGRAPHY.body
  },
  inputWithLeftIcon: {
    marginLeft: SPACING.sm
  },
  inputWithRightIcon: {
    marginRight: SPACING.sm
  },
  inputMultiline: {
    textAlignVertical: "top"
  },
  leftIcon: {
    marginRight: SPACING.xs
  },
  rightIcon: {
    marginLeft: SPACING.xs
  },
  hint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginTop: SPACING.xs
  },
  hintError: {
    color: COLORS.status.error
  },
  searchIcon: {
    fontSize: 14
  },
  clearIcon: {
    fontSize: 12,
    color: COLORS.text.muted
  }
});

export { Input, TextArea, SearchInput, INPUT_SIZE };
export default Input;