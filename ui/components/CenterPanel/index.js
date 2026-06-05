// ui/components/CenterPanel/index.js
// React Native

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SIZES } from "../../styles/theme.js";
import { ChatHistory } from "./ChatHistory.js";
import { ChatInput } from "./ChatInput.js";

export function CenterPanel({ messages, onSend, isRunning }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MasterRoom Chat</Text>
        <Text style={styles.subtitle}>
          {isRunning ? "Processing..." : "Ready for commands"}
        </Text>
      </View>
      
      <ChatHistory messages={messages} />
      
      <ChatInput onSend={onSend} disabled={isRunning} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black
  },
  header: {
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray700,
    backgroundColor: COLORS.blackMatte
  },
  title: {
    color: COLORS.gray200,
    fontSize: 14,
    fontWeight: "600"
  },
  subtitle: {
    color: COLORS.gray500,
    fontSize: 11,
    marginTop: 2
  }
});

export default CenterPanel;