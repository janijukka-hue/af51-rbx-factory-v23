// s4/components/common/Modal.js
// ALX Factory - Modal Component
// Version: 1.0.1

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  Pressable,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS, Z_INDEX } from "../../theme/spacing.js";
import { Button, BUTTON_VARIANT } from "./Button.js";

var MODAL_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg",
  FULL: "full"
};

var screenWidth = Dimensions.get("window").width;
var screenHeight = Dimensions.get("window").height;

function Modal(props) {
  var visible = props.visible || false;
  var onClose = props.onClose;
  var title = props.title;
  var subtitle = props.subtitle;
  var size = props.size || MODAL_SIZE.MD;
  var showCloseButton = props.showCloseButton !== false;
  var closeOnBackdrop = props.closeOnBackdrop !== false;
  var children = props.children;
  var footer = props.footer;
  var style = props.style;

  var fadeAnim = useRef(new Animated.Value(0)).current;
  var scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(function() {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true
        })
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible, fadeAnim, scaleAnim]);

  var sizeStyles = getSizeStyles(size);

  function handleBackdropPress() {
    if (closeOnBackdrop && onClose) {
      onClose();
    }
  }

  return (
    <RNModal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoid}
      >
        <Animated.View
          style={[styles.backdrop, { opacity: fadeAnim }]}
        >
          <Pressable
            style={styles.backdropPressable}
            onPress={handleBackdropPress}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContainer,
            sizeStyles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            },
            style
          ]}
        >
          {(title || showCloseButton) && (
            <View style={styles.header}>
              <View style={styles.headerText}>
                {title && (
                  <Text style={styles.title}>{title}</Text>
                )}
                {subtitle && (
                  <Text style={styles.subtitle}>{subtitle}</Text>
                )}
              </View>
              {showCloseButton && (
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeIcon}>✕</Text>
                </Pressable>
              )}
            </View>
          )}

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer && (
            <View style={styles.footer}>{footer}</View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

function getSizeStyles(size) {
  var sizes = {
    sm: {
      container: { width: Math.min(320, screenWidth - 48) }
    },
    md: {
      container: { width: Math.min(480, screenWidth - 48) }
    },
    lg: {
      container: { width: Math.min(640, screenWidth - 32) }
    },
    full: {
      container: {
        width: screenWidth - 32,
        maxHeight: screenHeight - 100
      }
    }
  };

  return sizes[size] || sizes.md;
}

function ConfirmDialog(props) {
  var visible = props.visible || false;
  var onConfirm = props.onConfirm;
  var onCancel = props.onCancel;
  var title = props.title || "Confirm";
  var message = props.message;
  var confirmLabel = props.confirmLabel || "Confirm";
  var cancelLabel = props.cancelLabel || "Cancel";
  var confirmVariant = props.confirmVariant || BUTTON_VARIANT.PRIMARY;
  var loading = props.loading || false;

  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      title={title}
      size={MODAL_SIZE.SM}
      footer={
        <View style={styles.dialogFooter}>
          <Button
            variant={BUTTON_VARIANT.GHOST}
            onPress={onCancel}
            disabled={loading}
            style={styles.dialogButton}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onPress={onConfirm}
            loading={loading}
            style={styles.dialogButton}
          >
            {confirmLabel}
          </Button>
        </View>
      }
    >
      {message && (
        <Text style={styles.dialogMessage}>{message}</Text>
      )}
    </Modal>
  );
}

function AlertDialog(props) {
  var visible = props.visible || false;
  var onClose = props.onClose;
  var title = props.title || "Alert";
  var message = props.message;
  var buttonLabel = props.buttonLabel || "OK";

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title}
      size={MODAL_SIZE.SM}
      footer={
        <View style={styles.dialogFooter}>
          <Button
            variant={BUTTON_VARIANT.PRIMARY}
            onPress={onClose}
            fullWidth
          >
            {buttonLabel}
          </Button>
        </View>
      }
    >
      {message && (
        <Text style={styles.dialogMessage}>{message}</Text>
      )}
    </Modal>
  );
}

var styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    zIndex: Z_INDEX.overlay
  },
  backdropPressable: {
    flex: 1
  },
  modalContainer: {
    backgroundColor: COLORS.bg.elevated,
    borderRadius: RADIUS.modal,
    maxHeight: screenHeight * 0.8,
    zIndex: Z_INDEX.modal,
    overflow: "hidden"
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: SPACING.modalPadding,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  headerText: {
    flex: 1
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary
  },
  subtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.secondary,
    marginTop: 4
  },
  closeButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
    marginTop: -SPACING.xs
  },
  closeIcon: {
    fontSize: 18,
    color: COLORS.text.muted
  },
  content: {
    flexGrow: 0,
    flexShrink: 1
  },
  contentContainer: {
    padding: SPACING.modalPadding
  },
  footer: {
    padding: SPACING.modalPadding,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.subtle
  },
  dialogFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm
  },
  dialogButton: {
    minWidth: 80
  },
  dialogMessage: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary
  }
});

export { Modal, ConfirmDialog, AlertDialog, MODAL_SIZE };
export default Modal;