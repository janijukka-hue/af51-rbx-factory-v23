// s4/screens/OllamaChat/OllamaChatScreen.js
// Ollama Chat — suora väylä Ollama-mallille
// AF51 Design System v2.0 — purppura Ollama, lime ALX
//
// ARKKITEHTUURI:
//   OllamaChatScreen → HTTP POST /ollama/chat
//   server.js → OllamaAgent.chat() → Ollama /api/chat
//   EI koske ALX-putkeen.

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  FlatList, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Clipboard, Animated,
} from "react-native";

import SERVER_URL from "../../services/serverConfig.js";
var SERVER = SERVER_URL;

// AF51 Design — Ollama käyttää purppuraa, ALX käyttää limee
var C = {
  bg:       "#080c0a",
  bg2:      "#0d1410",
  bg3:      "#111a14",
  bg4:      "#0a110c",
  border:   "#1e2e22",
  white:    "#f0f4f1",
  gray:     "#8a9e8f",
  gray2:    "#2a3a2e",
  purple:   "#a78bfa",
  purpDim:  "#4c1d95",
  purpGlow: "#a78bfa18",
  red:      "#ff4444",
  amber:    "#f5a623",
  lime:     "#39ff5a",
  limeDim:  "#1a7a2e",
};

function makeId() { return Math.random().toString(36).slice(2, 10); }
function makeMsg(role, content, extra) {
  return Object.assign({ id: makeId(), role: role, content: content, ts: Date.now() }, extra || {});
}

function StatusBar(props) {
  var status = props.status;
  var model  = props.model;
  var dot = status === "online" ? C.lime : status === "offline" ? C.red : C.amber;
  var label = status === "online" ? "ONLINE" : status === "offline" ? "OFFLINE" : "CHECKING...";

  return (
    <View style={s.statusBar}>
      <View style={[s.dot, { backgroundColor: dot }]} />
      <Text style={[s.statusLabel, { color: dot }]}>{label}</Text>
      {model ? <Text style={s.statusModel}>{model}</Text> : null}
      <View style={s.statusBadge}>
        <Text style={s.statusBadgeText}>OLLAMA</Text>
      </View>
    </View>
  );
}

function Bubble(props) {
  var msg      = props.msg;
  var copiedId = props.copiedId;
  var onCopy   = props.onCopy;
  var isUser   = msg.role === "user";
  return (
    <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleOll]}>
      <Text style={s.bubbleRole}>{isUser ? "USER" : "OLLAMA"}</Text>
      <Text style={s.bubbleText}>{msg.content}</Text>
      {msg.durationMs ? <Text style={s.bubbleMeta}>{(msg.durationMs/1000).toFixed(1)}s · muisti:{msg.historyLen || "—"}</Text> : null}
      {msg.error      ? <Text style={s.bubbleErr}>{msg.error}</Text> : null}
      {!isUser && msg.content ? (
        <Pressable
            style={[s.copyBtn, copiedId === msg.id ? s.copyBtnDone : null]}
            onPress={function() { onCopy && onCopy(msg.id, msg.content); }}
          >
            <Text style={[s.copyBtnText, copiedId === msg.id ? s.copyBtnTextDone : null]}>
              {copiedId === msg.id ? "✓ COPIED" : "COPY FOR ALX"}
            </Text>
          </Pressable>
      ) : null}
    </View>
  );
}

export function OllamaChatScreen() {
  var [messages, setMessages]       = useState([]);
  var [inputText, setInputText]     = useState("");
  var [copiedId, setCopiedId]       = useState(null);
  var copyTimer                     = React.useRef(null);

  function copyToClipboard(id, content) {
    try { Clipboard.setString(content || ""); } catch (_) {}
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopiedId(id);
    copyTimer.current = setTimeout(function() { setCopiedId(null); }, 1500);
  }
  var [isLoading, setIsLoading]     = useState(false);
  var [ollamaStatus, setStatus]     = useState("checking");
  var [currentModel, setModel]      = useState(null);
  var listRef = useRef(null);

  useEffect(function() { checkStatus(); }, []);

  var checkStatus = useCallback(async function() {
    setStatus("checking");
    try {
      var res  = await fetch(SERVER + "/ollama/status");
      var data = await res.json();
      setStatus(data.available ? "online" : "offline");
      setModel(data.model || null);
    } catch (e) { setStatus("offline"); }
  }, []);

  var sendMessage = useCallback(async function() {
    var text = inputText.trim();
    if (!text || isLoading) return;
    setInputText("");
    setIsLoading(true);

    var userMsg      = makeMsg("user", text);
    var nextMessages = messages.concat(userMsg);
    setMessages(nextMessages);

    try {
      // Uusi sessiomuistillinen API: lähetetään vain userMessage + sessionId
      // Serveri rakentaa viestiketjun + system prompt + historia automaattisesti
      // AbortController timeout 60s (Ollama CPU voi olla hidas)
      var controller = new AbortController();
      var timeoutId  = setTimeout(function() { controller.abort(); }, 60000);

      var res  = await fetch(SERVER + "/ollama/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal:  controller.signal,
        body: JSON.stringify({
          userMessage: text,
          sessionId:   "ollama-main",
        }),
      });
      clearTimeout(timeoutId);
      var data = await res.json();

      // Serveri voi palauttaa content TAI message TAI text
      var reply = data.content || data.message || data.text || null;

      if (data.ok && reply) {
        setMessages(nextMessages.concat(makeMsg("assistant", reply, {
          durationMs: data.durationMs,
          historyLen: data.historyLen,
        })));
        setStatus("online");
      } else {
        var errMsg = data.error || (data.ok === false ? "MODEL_INVALID tai malli ei löydy" : "Tuntematon virhe");
        setMessages(nextMessages.concat(makeMsg("assistant",
          "⚠  Ollama ei vastannut.\n" + errMsg +
          "\n\nTarkista:\n• ollama serve käynnissä?\n• malli: llama3.2:latest",
          { error: errMsg })));
        setStatus("offline");
      }
    } catch (e) {
      var errText = e.name === "AbortError"
        ? "Timeout (60s) — Ollama vastaa hitaasti. Yritä uudelleen."
        : "Yhteysvirhe: " + e.message + "\n\nOnko server käynnissä? (node server.js)";
      setMessages(nextMessages.concat(makeMsg("assistant", "⚠  " + errText, { error: errText })));
      setStatus("offline");
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages]);

  var renderItem = useCallback(function(info) { return <Bubble msg={info.item} copiedId={copiedId} onCopy={copyToClipboard} />; }, [copiedId, copyToClipboard]);
  var keyExtractor = useCallback(function(item) { return item.id; }, []);

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.badge}><Text style={s.badgeText}>AF51</Text></View>
        <Text style={s.headerTitle}>OLLAMA CHAT</Text>
        <Text style={s.headerSub}>sessiomuisti · ei ALX-putkea</Text>
        <TouchableOpacity onPress={checkStatus} style={s.headerBtn}>
          <Text style={s.headerBtnText}>↺</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={async function() {
          // Tyhjennä sekä UI-historia että server-sessio
          setMessages([]);
          try {
            await fetch(SERVER + "/ollama/memory/ollama-main", { method: "DELETE" });
          } catch (_) {}
        }} style={s.headerBtn}>
          <Text style={s.headerBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <StatusBar status={ollamaStatus} model={currentModel} />

      {/* Separator */}
      <View style={s.sep}>
        <Text style={s.sepText}>Ollama-väylä · {currentModel || "—"}</Text>
      </View>

      {/* Viestit */}
      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={s.list}
        contentContainerStyle={s.listContent}
        onContentSizeChange={function() {
          if (listRef.current && messages.length > 0) {
            listRef.current.scrollToEnd({ animated: true });
          }
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>●</Text>
            <Text style={s.emptyTitle}>OLLAMA CHAT</Text>
            <Text style={s.emptyText}>Suora väylä Ollama-mallille.{"\n"}ALX ei ole tässä mukana.</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={s.inputArea}>
        <View style={s.inputWrap}>
          <Text style={s.inputLabel}>OLLAMA &gt;</Text>
          <TextInput
            style={s.input}
            value={inputText}
            onChangeText={setInputText}
            value="Kirjoita mallille..."
            valueTextColor={C.gray2}
            multiline
            maxLength={4000}
            editable={!isLoading}
          />
        </View>
        <TouchableOpacity
          style={[s.sendBtn, (isLoading || !inputText.trim()) && s.sendBtnOff]}
          onPress={sendMessage}
          disabled={isLoading || !inputText.trim()}
          activeOpacity={0.8}
        >
          {isLoading
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={s.sendBtnText}>SEND</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

var s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },

  // Header
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  badge:  { backgroundColor: C.purple, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#000", fontWeight: "700", fontSize: 9, fontFamily: "Courier New", letterSpacing: 1 },
  headerTitle: { color: C.white, fontSize: 12, fontWeight: "700", fontFamily: "Courier New", letterSpacing: 2 },
  headerSub:   { color: C.gray, fontSize: 8, fontFamily: "Courier New", letterSpacing: 1, flex: 1 },
  headerBtn:   { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  headerBtnText: { color: C.gray, fontSize: 12, fontFamily: "Courier New" },

  // Status
  statusBar:   { flexDirection: "row", alignItems: "center", padding: 6, paddingHorizontal: 14, backgroundColor: C.bg4, borderBottomWidth: 1, borderBottomColor: C.border, gap: 6 },
  dot:         { width: 5, height: 5, borderRadius: 3 },
  statusLabel: { fontSize: 9, fontFamily: "Courier New", letterSpacing: 1 },
  statusModel: { color: C.gray, fontSize: 9, fontFamily: "Courier New" },
  statusBadge: { marginLeft: "auto", backgroundColor: C.purpGlow, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.purpDim },
  statusBadgeText: { color: C.purple, fontSize: 8, fontFamily: "Courier New", fontWeight: "700", letterSpacing: 1 },

  // Separator
  sep:     { paddingHorizontal: 14, paddingVertical: 4, backgroundColor: C.purpGlow, borderBottomWidth: 1, borderBottomColor: C.purpDim },
  sepText: { color: C.purple + "88", fontSize: 9, fontFamily: "Courier New", letterSpacing: 1 },

  // Lista
  list:        { flex: 1 },
  listContent: { padding: 14, gap: 10 },

  // Empty
  empty:      { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyIcon:  { color: C.purple, fontSize: 32, marginBottom: 12, fontFamily: "Courier New" },
  emptyTitle: { color: C.white, fontSize: 12, fontFamily: "Courier New", letterSpacing: 3, marginBottom: 8 },
  emptyText:  { color: C.gray, fontSize: 10, fontFamily: "Courier New", textAlign: "center", lineHeight: 18 },

  // Bubbles
  bubble:     { padding: 10, maxWidth: "85%", borderWidth: 1 },
  bubbleUser: { backgroundColor: C.bg3, borderColor: C.limeDim, alignSelf: "flex-end" },
  bubbleOll:  { backgroundColor: C.bg2, borderColor: C.purpDim, alignSelf: "flex-start" },
  bubbleRole: { fontSize: 8, fontFamily: "Courier New", letterSpacing: 2, marginBottom: 5, color: C.gray },
  bubbleText: { color: C.white, fontSize: 11, fontFamily: "Courier New", lineHeight: 18 },
  bubbleMeta: { color: C.gray, fontSize: 8, fontFamily: "Courier New", marginTop: 6, textAlign: "right" },
  bubbleErr:  { color: C.red, fontSize: 9, fontFamily: "Courier New", marginTop: 4 },
  copyBtn:        { marginTop: 8, alignSelf: "flex-start", backgroundColor: "#1e293b",
                    borderWidth: 1, borderColor: "#334155", borderRadius: 6,
                    paddingHorizontal: 10, paddingVertical: 4 },
  copyBtnDone:    { backgroundColor: "#052012", borderColor: "#166534" },
  copyBtnText:    { color: C.primary, fontSize: 11, fontWeight: "700" },
  copyBtnTextDone:{ color: "#22c55e" },

  // Input
  inputArea: { flexDirection: "row", padding: 10, paddingHorizontal: 14, gap: 8, borderTopWidth: 1, borderTopColor: C.border, alignItems: "flex-end" },
  inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, gap: 8 },
  inputLabel: { color: C.purple, fontSize: 9, fontFamily: "Courier New", letterSpacing: 1, flexShrink: 0 },
  input:      { flex: 1, color: C.white, fontFamily: "Courier New", fontSize: 11, paddingVertical: 10, maxHeight: 80 },
  sendBtn:    { backgroundColor: C.purple, paddingHorizontal: 14, paddingVertical: 10, minWidth: 60, alignItems: "center" },
  sendBtnOff: { backgroundColor: C.purpDim },
  sendBtnText: { color: "#000", fontFamily: "Courier New", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
});