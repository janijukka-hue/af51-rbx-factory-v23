// s4/components/common/Card.js
// ALX Factory - Card Component
// Version: 1.0.0

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { getShadow } from "../../theme/shadows.js";

var CARD_VARIANT = {
  DEFAULT: "default",
  ELEVATED: "elevated",
  OUTLINED: "outlined",
  FILLED: "filled"
};

function Card(props) {
  var variant = props.variant || CARD_VARIANT.DEFAULT;
  var title = props.title;
  var subtitle = props.subtitle;
  var headerRight = props.headerRight;
  var footer = props.footer;
  var onPress = props.onPress;
  var children = props.children;
  var style = props.style;
  var contentStyle = props.contentStyle;
  var noPadding = props.noPadding || false;

  var variantStyles = getVariantStyles(variant);

  var Container = onPress ? Pressable : View;
  var containerProps = onPress ? {
    onPress: onPress,
    style: function(state) {
      return [
        styles.card,
        variantStyles,
        state.pressed && styles.pressed,
        style
      ];
    }
  } : {
    style: [styles.card, variantStyles, style]
  };

  var hasHeader = title || subtitle || headerRight;

  return (
    <Container {...containerProps}>
      {hasHeader && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title && (
              <Text style={styles.title}>{title}</Text>
            )}
            {subtitle && (
              <Text style={styles.subtitle}>{subtitle}</Text>
            )}
          </View>
          {headerRight && (
            <View style={styles.headerRight}>{headerRight}</View>
          )}
        </View>
      )}
      
      <View style={[
        styles.content,
        noPadding && styles.noPadding,
        hasHeader && styles.contentWithHeader,
        contentStyle
      ]}>
        {children}
      </View>
      
      {footer && (
        <View style={styles.footer}>{footer}</View>
      )}
    </Container>
  );
}

function getVariantStyles(variant) {
  var variants = {
    default: {
      backgroundColor: COLORS.bg.surface,
      borderWidth: 1,
      borderColor: COLORS.border.subtle
    },
    elevated: {
      backgroundColor: COLORS.bg.elevated,
      ...getShadow("md")
    },
    outlined: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: COLORS.border.default
    },
    filled: {
      backgroundColor: COLORS.bg.overlay
    }
  };

  return variants[variant] || variants.default;
}

function CardSection(props) {
  var title = props.title;
  var children = props.children;
  var style = props.style;

  return (
    <View style={[styles.section, style]}>
      {title && (
        <Text style={styles.sectionTitle}>{title}</Text>
      )}
      {children}
    </View>
  );
}

function CardDivider() {
  return <View style={styles.divider} />;
}

var styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    overflow: "hidden"
  },
  pressed: {
    opacity: 0.9
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.cardPadding,
    paddingTop: SPACING.cardPadding,
    paddingBottom: SPACING.sm
  },
  headerText: {
    flex: 1
  },
  headerRight: {
    marginLeft: SPACING.sm
  },
  title: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary
  },
  subtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.secondary,
    marginTop: 2
  },
  content: {
    padding: SPACING.cardPadding
  },
  contentWithHeader: {
    paddingTop: SPACING.sm
  },
  noPadding: {
    padding: 0
  },
  footer: {
    paddingHorizontal: SPACING.cardPadding,
    paddingBottom: SPACING.cardPadding,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.subtle
  },
  section: {
    marginBottom: SPACING.md
  },
  sectionTitle: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.text.muted,
    marginBottom: SPACING.sm
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border.subtle,
    marginVertical: SPACING.md
  }
});

export { Card, CardSection, CardDivider, CARD_VARIANT };
export default Card;