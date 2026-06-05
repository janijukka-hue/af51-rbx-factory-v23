// s4/screens/CommandCenter/CommandCenterScreen.js
// Enterprise-safe, Snack-optimized version

import React, {
  useState,
  useCallback,
  useRef,
  useMemo
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from "react-native";

const MAX_MESSAGES = 200;

function createMessage(type, text) {
  const now = new Date();
  return {
    id: now.getTime().toString() + Math.random().toString(16).slice(2),
    type,
    text,
    displayTime: now.toLocaleTimeString()
  };
}

const MessageBubble = React.memo(function MessageBubble({ message }) {
  const isUser = message.type === "user";

  return (
    <View
      style={[
        styles.messageContainer,
        isUser ? styles.userMessage : styles.alxMessage
      ]}
    >
      <Text style={styles.messageText}>{message.text}</Text>
      <Text style={styles.messageTime}>{message.displayTime}</Text>
    </View>
  );
});

export function CommandCenterScreen({ orchestrator }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);

  const flatListRef = useRef(null);

  const addMessage = useCallback((type, text) => {
    setMessages((prev) => {
      const next = prev.concat(createMessage(type, text));
      if (next.length > MAX_MESSAGES) {
        return next.slice(next.length - MAX_MESSAGES);
      }
      return next;
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    const userText = input.trim();
    setInput("");
    addMessage("user", userText);

    try {
      const result = await orchestrator.execute(userText);

      if (result && result.output) {
        addMessage("alx", result.output);
      } else {
        addMessage("alx", "No response.");
      }
    } catch (err) {
      addMessage("alx", "Error: " + err.message);
    }
  }, [input, orchestrator, addMessage]);

  const renderItem = useCallback(({ item }) => {
    return <MessageBubble message={item} />;
  }, []);

  const keyExtractor = useCallback((item) => item.id, []);

  const memoizedData = useMemo(() => messages, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        ref={flatListRef}
        data={memoizedData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          value="Type command..."
          valueTextColor="#666"
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080c0a"
  },
  messagesContainer: {
    padding: 12
  },
  messageContainer: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    maxWidth: "80%"
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#39ff5a22"
  },
  alxMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#222"
  },
  messageText: {
    color: "#fff",
    fontSize: 14
  },
  messageTime: {
    marginTop: 4,
    fontSize: 10,
    color: "#888"
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#222"
  },
  input: {
    flex: 1,
    backgroundColor: "#111",
    color: "#fff",
    paddingHorizontal: 12,
    borderRadius: 6
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: "#39ff5a",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 6
  },
  sendText: {
    color: "#000",
    fontWeight: "600"
  }
});