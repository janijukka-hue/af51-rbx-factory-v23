// App.js
// ALX Factory - Main Entry Point
// Version: 4.0.0 - Enterprise boot, factory wired in m2

import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider } from "./s4/state/AppContext.js";
import { ToastProvider } from "./s4/components/common/Toast.js";
import { AppNavigator } from "./s4/navigation/AppNavigator.js";
// Web-safe runtime split
let createOrchestrator = null;

// ─── ErrorBoundary ────────────────────────────────────────────
// Kaappaa runtime render-virheet — estää valkoisen sivun.
// Luokkakomentti: React vaatii class-komponentin componentDidCatch:lle.

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: null };
    this._handleReset = this._handleReset.bind(this);
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error && error.message ? error.message : String(error) };
  }
  componentDidCatch(error, info) {
    console.error("[ALX ErrorBoundary]", error);
    console.error("[ALX ErrorBoundary] stack:", info && info.componentStack);
  }
  _handleReset() {
    this.setState({ hasError: false, errorMsg: null });
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    var isObjectError = this.state.errorMsg &&
      this.state.errorMsg.includes("Objects are not valid");
    return (
      <View style={ebStyles.container}>
        <View style={ebStyles.card}>
          <Text style={ebStyles.title}>ALX — RENDER ERROR</Text>
          <ScrollView style={ebStyles.msgScroll}>
            <Text style={ebStyles.msg}>{this.state.errorMsg || "Tuntematon virhe"}</Text>
          </ScrollView>
          {isObjectError ? (
            <View style={ebStyles.hint}>
              <Text style={ebStyles.hintText}>
                Objekti yritettiin renderöidä JSX:ssä.{"\n"}
                Tarkista data boundary — navProps ei saa vuotaa UI:hin.
              </Text>
            </View>
          ) : null}
          <TouchableOpacity style={ebStyles.btn} onPress={this._handleReset} activeOpacity={0.7}>
            <Text style={ebStyles.btnText}>↺ YRITÄ UUDELLEEN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}
var ebStyles = StyleSheet.create({
  container: { flex:1, backgroundColor:"#080c0a", justifyContent:"center", alignItems:"center", padding:24 },
  card:      { backgroundColor:"#0d1410", borderWidth:1, borderColor:"#ff4444", padding:24, width:"100%", maxWidth:480 },
  title:     { color:"#ff4444", fontSize:12, fontFamily:"Courier New", letterSpacing:3, textAlign:"center", marginBottom:16 },
  msgScroll: { maxHeight:120, marginBottom:16 },
  msg:       { color:"#f0f4f1", fontSize:11, fontFamily:"Courier New", lineHeight:20 },
  hint:      { backgroundColor:"#0a110c", borderLeftWidth:3, borderLeftColor:"#39ff5a", padding:10, marginBottom:16 },
  hintText:  { color:"#8a9e8f", fontSize:10, fontFamily:"Courier New", lineHeight:18 },
  btn:       { borderWidth:1, borderColor:"#39ff5a", paddingVertical:10, alignItems:"center" },
  btnText:   { color:"#39ff5a", fontFamily:"Courier New", fontSize:10, letterSpacing:3, fontWeight:"700" },
});

function BootScreen() {
  return (
    <View style={styles.boot}>
      <Text style={styles.bootTitle}>ALX Factory</Text>
      <ActivityIndicator color="#39ff5a" size="large" style={styles.spinner} />
      <Text style={styles.bootStatus}>Starting ALX...</Text>
    </View>
  );
}

function BootErrorScreen(props) {
  return (
    <View style={styles.boot}>
      <Text style={styles.bootTitle}>ALX Factory</Text>
      <Text style={styles.bootError}>{props.error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={props.onRetry} activeOpacity={0.7}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  var bootStatusState = useState("booting");
  var bootStatus = bootStatusState[0];
  var setBootStatus = bootStatusState[1];

  var bootErrorState = useState(null);
  var bootError = bootErrorState[0];
  var setBootError = bootErrorState[1];

  var orchestratorState = useState(null);
  var orchestrator = orchestratorState[0];
  var setOrchestrator = orchestratorState[1];

  var orchRef = useRef(null);

  var boot = useCallback(async function() {
    setBootStatus("booting");
    setBootError(null);

    try {
      // createOrchestrator hoitaa kaiken sisäisesti:
      // CoreMemory -> ALX -> Factory -> FactoryBridge -> Skills
      // S4 (UI) ei tiedä mitään skillien yksityiskohdista
      if (typeof window !== "undefined") {
        setOrchestrator({
          webMode: true,

          getFactory: () => null,

          execute: async () => {
            return {
              ok: true,
              runtime: true,
              output: "WEB SAFE MODE ACTIVE"
            };
          },

          build: async () => {
            return {
              ok: true,
              runtime: true,
              output: "BUILD SAFE MODE ACTIVE"
            };
          }
        });
        setBootStatus("ready");
        return;
      }

      const orchestratorModule = await import("./m2/Ohjaus/orchestrator.js");
      createOrchestrator = orchestratorModule.createOrchestrator;

      var orch = createOrchestrator({
        owner: "app",
        debug: false,
        llmEnabled: false,
        learningEnabled: false,
        factoryEnabled: true,
        episodicLimit: 1000,
        semanticLimit: 500,
        proceduralLimit: 200,
        localMemoryLimit: 200
      });

      var result = await orch.boot();

      if (!result.ok) {
        throw new Error(result.error || "Boot failed");
      }

      orchRef.current = orch;
      setOrchestrator(orch);
      setBootStatus("ready");

    } catch (err) {
      console.error("[App] Boot failed:", err);
      setBootError(err.message || "Boot failed");
      setBootStatus("error");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(function() {
    boot();
    return function() {
      if (orchRef.current && typeof orchRef.current.shutdown === "function") {
        orchRef.current.shutdown().catch(function() {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (bootStatus === "booting") {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <BootScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (bootStatus === "error") {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <BootErrorScreen error={bootError} onRetry={boot} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppProvider orchestrator={orchestrator} factory={orchestrator ? orchestrator?.getFactory?.() : null}>
          <ToastProvider>
            <ErrorBoundary>
              <AppNavigator
                orchestrator={orchestrator}
                factory={orchestrator ? orchestrator?.getFactory?.() : null}
              />
            </ErrorBoundary>
          </ToastProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

var styles = StyleSheet.create({
  root: {
    flex: 1
  },
  boot: {
    flex: 1,
    backgroundColor: "#080c0a",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  bootTitle: {
    color: "#39ff5a",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 32
  },
  spinner: {
    marginBottom: 16
  },
  bootStatus: {
    color: "#8a9e8f",
    fontSize: 13
  },
  bootError: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24
  },
  retryButton: {
    borderWidth: 1,
    borderColor: "#39ff5a",
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  retryText: {
    color: "#39ff5a",
    fontSize: 15
  }
});