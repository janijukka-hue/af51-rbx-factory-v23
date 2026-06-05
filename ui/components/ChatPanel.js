// ui/components/ChatPanel.js
// Enterprise Chat Panel Component

import React, { useState, useRef } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { COLORS, SIZES, SHADOWS } from "../styles/theme.js";
import { GlowButton } from "./common/GlowButton.js";

export function ChatPanel(props) {
  var messages = props.messages || [];
  var onSend = props.onSend;
  var isRunning = props.isRunning;
  
  var inputState = useState("");
  var inputText = inputState[0];
  var setInputText = inputState[1];
  
  var scrollRef = useRef(null);
  
  function handleSend() {
    if (!inputText.trim() || isRunning) return;
    
    onSend(inputText.trim(), "chat");
    setInputText("");
  }
  
  function handleKeyPress(e) {
    if (e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
      handleSend();
    }
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>💬</Text>
        <Text style={styles.headerTitle}>Command Interface</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{messages.length}</Text>
        </View>
      </View>
      
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={function() {
          if (scrollRef.current) {
            scrollRef.current.scrollToEnd({ animated: true });
          }
        }}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🤖</Text>
            <Text style={styles.emptyTitle}>ALX Ready</Text>
            <Text style={styles.emptyText}>
              Type a command or paste code to analyze.
            </Text>
            <View style={styles.emptyHints}>
              <Text style={styles.emptyHint}>Try: status, help, memory</Text>
              <Text style={styles.emptyHint}>Or paste code in ```blocks```</Text>
            </View>
          </View>
        )}
        
        {messages.map(function(msg) {
          return (
            <MessageBubble
              key={msg.id}
              sender={msg.sender}
              text={msg.text}
              timestamp={msg.timestamp}
            />
          );
        })}
        
        {isRunning && (
          <View style={styles.typingIndicator}>
            <View style={styles.typingDot} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
            <Text style={styles.typingText}>ALX is processing...</Text>
          </View>
        )}
      </ScrollView>
      
      <View style={styles.inputArea}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            value="Type a command or paste code..."
            valueTextColor={COLORS.textMuted}
            multiline
            maxLength={50000}
            onKeyPress={handleKeyPress}
            editable={!isRunning}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isRunning) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isRunning}
          >
            <Text style={styles.sendButtonText}>▶</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputHints}>
          <Text style={styles.inputHint}>Enter to send • Shift+Enter for new line</Text>
        </View>
      </View>
    </View>
  );
}

function MessageBubble(props) {
  var sender = props.sender;
  var text = props.text;
  var timestamp = props.timestamp;
  
  var isUser = sender === "user";
  var isALX = sender === "alx";
  var isSystem = sender === "system";
  
  var time = new Date(timestamp).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit"
  });
  
  return (
    <View style={[
      styles.messageBubble,
      isUser && styles.messageBubbleUser,
      isALX && styles.messageBubbleALX,
      isSystem && styles.messageBubbleSystem
    ]}>
      <View style={styles.messageHeader}>
        <Text style={[
          styles.messageSender,
          isUser && styles.messageSenderUser,
          isALX && styles.messageSenderALX
        ]}>
          {isUser ? "You" : isALX ? "ALX" : "System"}
        </Text>
        <Text style={styles.messageTime}>{time}</Text>
      </View>
      <Text style={[
        styles.messageText,
        isUser && styles.messageTextUser
      ]}>
        {text}
      </Text>
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.darkBg
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.panelBg,
    gap: 10
  },
  headerIcon: {
    fontSize: 18
  },
  headerTitle: {
    fontSize: SIZES.fontMd,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1
  },
  headerBadge: {
    backgroundColor: COLORS.cyanBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: SIZES.radiusFull
  },
  headerBadgeText: {
    fontSize: SIZES.fontXs,
    fontWeight: "700",
    color: COLORS.cyan
  },
  messageList: {
    flex: 1
  },
  messageListContent: {
    padding: SIZES.xl,
    gap: SIZES.md
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: SIZES.fontXl,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 8
  },
  emptyText: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20
  },
  emptyHints: {
    gap: 4
  },
  emptyHint: {
    fontSize: SIZES.fontSm,
    color: COLORS.textMuted,
    textAlign: "center"
  },
  messageBubble: {
    backgroundColor: COLORS.cardBg,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    maxWidth: "85%",
    borderWidth: 1,
    borderColor: COLORS.border
  },
  messageBubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.cyanBg,
    borderColor: COLORS.cyanMuted
  },
  messageBubbleALX: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.purpleBg,
    borderColor: COLORS.purpleMuted
  },
  messageBubbleSystem: {
    alignSelf: "center",
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.borderLight
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  messageSender: {
    fontSize: SIZES.fontXs,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 0.5
  },
  messageSenderUser: {
    color: COLORS.cyan
  },
  messageSenderALX: {
    color: COLORS.purple
  },
  messageTime: {
    fontSize: SIZES.fontXs,
    color: COLORS.textDark
  },
  messageText: {
    fontSize: SIZES.fontMd,
    color: COLORS.textPrimary,
    lineHeight: 22
  },
  messageTextUser: {
    color: COLORS.cyanLight
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.purple,
    opacity: 0.6
  },
  typingDot2: {
    opacity: 0.8
  },
  typingDot3: {
    opacity: 1
  },
  typingText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textMuted,
    marginLeft: 8
  },
  inputArea: {
    padding: SIZES.lg,
    backgroundColor: COLORS.panelBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radiusMd,
    overflow: "hidden"
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: SIZES.fontMd,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    maxHeight: 120,
    minHeight: 48
  },
  sendButton: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.cyan,
    alignItems: "center",
    justifyContent: "center"
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border
  },
  sendButtonText: {
    color: COLORS.black,
    fontSize: 18,
    fontWeight: "bold"
  },
  inputHints: {
    marginTop: 8,
    alignItems: "center"
  },
  inputHint: {
    fontSize: SIZES.fontXs,
    color: COLORS.textDark
  }
});

export default ChatPanel;