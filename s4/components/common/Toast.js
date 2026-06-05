// s4/components/common/Toast.js
// ALX Factory - Toast Component
// Version: 1.0.2

import React, { useEffect, useRef, useState, createContext, useContext, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions
} from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS, Z_INDEX } from "../../theme/spacing.js";
import { getShadow } from "../../theme/shadows.js";

var TOAST_VARIANT = {
  DEFAULT: "default",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
  INFO: "info"
};

var TOAST_POSITION = {
  TOP: "top",
  BOTTOM: "bottom"
};

var screenWidth = Dimensions.get("window").width;

function Toast(props) {
  var id = props.id;
  var message = props.message;
  var variant = props.variant || TOAST_VARIANT.DEFAULT;
  var duration = props.duration || 3000;
  var onDismiss = props.onDismiss;
  var action = props.action;
  var onAction = props.onAction;
  var icon = props.icon;

  var translateY = useRef(new Animated.Value(-100)).current;
  var opacity = useRef(new Animated.Value(0)).current;

  var dismiss = useCallback(function() {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(function() {
      if (onDismiss) {
        onDismiss(id);
      }
    });
  }, [translateY, opacity, onDismiss, id]);

  useEffect(function() {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();

    if (duration > 0) {
      var timer = setTimeout(function() {
        dismiss();
      }, duration);

      return function() {
        clearTimeout(timer);
      };
    }
  }, [translateY, opacity, duration, dismiss]);

  var variantStyles = getVariantStyles(variant);

  return (
    <Animated.View
      style={[
        styles.toast,
        variantStyles.container,
        getShadow("lg"),
        {
          transform: [{ translateY: translateY }],
          opacity: opacity
        }
      ]}
    >
      <Pressable onPress={dismiss} style={styles.toastContent}>
        {icon && (
          <View style={styles.icon}>{icon}</View>
        )}
        
        <Text style={[styles.message, variantStyles.text]} numberOfLines={2}>
          {message}
        </Text>

        {action && (
          <Pressable onPress={onAction} style={styles.actionButton}>
            <Text style={styles.actionText}>{action}</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

function getVariantStyles(variant) {
  var variants = {
    default: {
      container: {
        backgroundColor: COLORS.bg.elevated,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary
      },
      text: { color: COLORS.text.primary }
    },
    success: {
      container: {
        backgroundColor: COLORS.bg.elevated,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.status.success
      },
      text: { color: COLORS.text.primary }
    },
    warning: {
      container: {
        backgroundColor: COLORS.bg.elevated,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.status.warning
      },
      text: { color: COLORS.text.primary }
    },
    error: {
      container: {
        backgroundColor: COLORS.bg.elevated,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.status.error
      },
      text: { color: COLORS.text.primary }
    },
    info: {
      container: {
        backgroundColor: COLORS.bg.elevated,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.status.info
      },
      text: { color: COLORS.text.primary }
    }
  };

  return variants[variant] || variants.default;
}

var ToastContext = createContext(null);

function ToastProvider(props) {
  var children = props.children;
  var position = props.position || TOAST_POSITION.TOP;

  var toastsState = useState([]);
  var toasts = toastsState[0];
  var setToasts = toastsState[1];

  var toastIdRef = useRef(0);

  var dismiss = useCallback(function(id) {
    setToasts(function(prev) {
      return prev.filter(function(t) {
        return t.id !== id;
      });
    });
  }, [setToasts]);

  var show = useCallback(function(options) {
    var id = toastIdRef.current++;
    var newToast = {
      id: id,
      message: typeof options === "string" ? options : options.message,
      variant: options.variant || TOAST_VARIANT.DEFAULT,
      duration: options.duration || 3000,
      action: options.action,
      onAction: options.onAction,
      icon: options.icon
    };

    setToasts(function(prev) {
      return [newToast].concat(prev.slice(0, 2));
    });

    return id;
  }, [setToasts]);

  var dismissAll = useCallback(function() {
    setToasts([]);
  }, [setToasts]);

  var success = useCallback(function(message, options) {
    return show({ message: message, variant: TOAST_VARIANT.SUCCESS, ...options });
  }, [show]);

  var error = useCallback(function(message, options) {
    return show({ message: message, variant: TOAST_VARIANT.ERROR, ...options });
  }, [show]);

  var warning = useCallback(function(message, options) {
    return show({ message: message, variant: TOAST_VARIANT.WARNING, ...options });
  }, [show]);

  var info = useCallback(function(message, options) {
    return show({ message: message, variant: TOAST_VARIANT.INFO, ...options });
  }, [show]);

  var contextValue = {
    show: show,
    dismiss: dismiss,
    dismissAll: dismissAll,
    success: success,
    error: error,
    warning: warning,
    info: info
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      <View
        style={[
          styles.container,
          position === TOAST_POSITION.BOTTOM && styles.containerBottom
        ]}
        pointerEvents="box-none"
      >
        {toasts.map(function(toast) {
          return (
            <Toast
              key={toast.id}
              id={toast.id}
              message={toast.message}
              variant={toast.variant}
              duration={toast.duration}
              action={toast.action}
              onAction={toast.onAction}
              icon={toast.icon}
              onDismiss={dismiss}
            />
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

function useToast() {
  var context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

var styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: Z_INDEX.toast,
    pointerEvents: "box-none"
  },
  containerBottom: {
    top: undefined,
    bottom: 100
  },
  toast: {
    width: screenWidth - 32,
    maxWidth: 400,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    overflow: "hidden"
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md
  },
  icon: {
    marginRight: SPACING.sm
  },
  message: {
    ...TYPOGRAPHY.body,
    flex: 1
  },
  actionButton: {
    marginLeft: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs
  },
  actionText: {
    ...TYPOGRAPHY.buttonSmall,
    color: COLORS.primary
  }
});

export { Toast, ToastProvider, useToast, TOAST_VARIANT, TOAST_POSITION };
export default Toast;