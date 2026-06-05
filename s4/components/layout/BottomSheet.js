// s4/components/layout/BottomSheet.js
// ALX Factory - Bottom Sheet Component
// Version: 1.0.2

import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  Dimensions,
  PanResponder
} from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS, Z_INDEX } from "../../theme/spacing.js";

var screenHeight = Dimensions.get("window").height;

function BottomSheet(props) {
  var visible = props.visible || false;
  var onClose = props.onClose;
  var title = props.title;
  var children = props.children;
  var height = props.height || screenHeight * 0.5;
  var showHandle = props.showHandle !== false;
  var closeOnBackdrop = props.closeOnBackdrop !== false;

  var translateY = useRef(new Animated.Value(height)).current;
  var backdropOpacity = useRef(new Animated.Value(0)).current;

  var close = useCallback(function() {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(function() {
      if (onClose) onClose();
    });
  }, [translateY, backdropOpacity, height, onClose]);

  useEffect(function() {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    } else {
      translateY.setValue(height);
      backdropOpacity.setValue(0);
    }
  }, [visible, height, translateY, backdropOpacity]);

  var panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: function() { return true; },
      onMoveShouldSetPanResponder: function(_, gestureState) {
        return gestureState.dy > 10;
      },
      onPanResponderMove: function(_, gestureState) {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: function(_, gestureState) {
        if (gestureState.dy > height * 0.3 || gestureState.vy > 0.5) {
          close();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true
          }).start();
        }
      }
    })
  ).current;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={close}
    >
      <View style={styles.container}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeOnBackdrop ? close : undefined}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { height: height },
            { transform: [{ translateY: translateY }] }
          ]}
        >
          {showHandle && (
            <View {...panResponder.panHandlers} style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>
          )}

          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={close} style={styles.closeButton}>
                <Text style={styles.closeIcon}>✕</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.content}>
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

var styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    zIndex: Z_INDEX.overlay
  },
  sheet: {
    backgroundColor: COLORS.bg.elevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    zIndex: Z_INDEX.modal,
    overflow: "hidden"
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: SPACING.sm
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.text.muted,
    borderRadius: 2
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  title: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary
  },
  closeButton: {
    padding: SPACING.xs
  },
  closeIcon: {
    fontSize: 18,
    color: COLORS.text.muted
  },
  content: {
    flex: 1,
    padding: SPACING.md
  }
});

export { BottomSheet };
export default BottomSheet;