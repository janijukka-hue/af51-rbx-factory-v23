// ui/futureMachine/CoreSphere.js
// AF51 FutureMachine — central sphere visualization.
//
// Pure projection of the runtime's "core" ring overall state. Read-only:
// the component never triggers builds and never mutates pipeline state.

import React from "react";
import { View, Text, StyleSheet } from "react-native";

var STATE_COLOR = {
  idle:     "#1a2030",
  building: "#3b6df0",
  sealed:   "#3aa46f",
  error:    "#c2453b",
};

var STATE_LABEL = {
  idle:     "IDLE",
  building: "BUILDING",
  sealed:   "SEALED",
  error:    "FAILED",
};

export function CoreSphere(props) {
  var snapshot = props.snapshot || null;
  var size = props.size || 140;

  var core = snapshot && snapshot.rings && snapshot.rings.core;
  var state = (core && core.overall) || "idle";
  var color = STATE_COLOR[state] || STATE_COLOR.idle;
  var label = STATE_LABEL[state] || String(state).toUpperCase();
  var traceId = (snapshot && snapshot.traceId) || "—";
  var trimmedTrace = traceId.length > 18 ? traceId.slice(0, 15) + "…" : traceId;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[styles.sphere, {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }]}
      >
        <Text style={styles.state}>{label}</Text>
        <Text style={styles.trace}>{trimmedTrace}</Text>
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  sphere: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  state: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 1.5,
  },
  trace: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    marginTop: 4,
    fontFamily: "monospace",
  },
});

export default CoreSphere;
