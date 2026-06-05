// ui/components/CenterPanel/ChatHistory.js
// React Native

import React, { useRef, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { COLORS, SIZES, FONTS } from "../../styles/theme.js";

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ChatHistory({ messages }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  if (!messages || messages.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No messages yet. Start by typing a command.</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={styles.container}>
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const isSystem = msg.role === "system";

        return (
          <View
            key={msg.id}
            style={[
              styles.message,
              isUser ? styles.userMessage : isSystem ? styles.systemMessage : styles.alxMessage
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.sender, isUser ? styles.userSender : styles.alxSender]}>
                {isUser ? "You" : isSystem ? "System" : "ALX"}
              </Text>
              <Text style={styles.timestamp}>{formatTime(msg.timestamp)}</Text>
            </View>
            <Text style={styles.content}>{msg.content}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SIZES.md
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyText: {
    color: COLORS.gray500,
    fontSize: 14
  },
  message: {
    marginBottom: SIZES.md,
    padding: SIZES.md,
    borderRadius: SIZES.borderRadius,
    maxWidth: "90%"
  },
  userMessage: {
    backgroundColor: COLORS.gray700,
    alignSelf: "flex-end"
  },
  alxMessage: {
    backgroundColor: COLORS.blackLight,
    borderWidth: 1,
    borderColor: COLORS.gray600,
    alignSelf: "flex-start"
  },
  systemMessage: {
    backgroundColor: "rgba(50,205,50,0.1)",
    borderWidth: 1,
    borderColor: COLORS.limeMuted,
    alignSelf: "flex-start"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SIZES.xs
  },
  sender: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase"
  },
  userSender: {
    color: COLORS.gray300
  },
  alxSender: {
    color: COLORS.lime
  },
  timestamp: {
    fontSize: 10,
    color: COLORS.gray500
  },
  content: {
    fontSize: 13,
    color: COLORS.gray200,
    lineHeight: 20
  }
});

export default ChatHistory;