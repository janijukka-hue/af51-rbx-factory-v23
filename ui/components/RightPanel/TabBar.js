// ui/components/RightPanel/TabBar.js
// React Native

import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { COLORS, SIZES } from "../../styles/theme.js";

export function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.tabActive]}
          onPress={() => onTabChange(tab.id)}
        >
          <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray700,
    backgroundColor: COLORS.blackMatte
  },
  content: {
    paddingHorizontal: SIZES.sm
  },
  tab: {
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent"
  },
  tabActive: {
    borderBottomColor: COLORS.lime
  },
  tabText: {
    color: COLORS.gray400,
    fontSize: 12,
    fontWeight: "500"
  },
  tabTextActive: {
    color: COLORS.lime
  }
});

export default TabBar;