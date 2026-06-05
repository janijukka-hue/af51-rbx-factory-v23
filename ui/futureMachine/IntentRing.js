// ui/futureMachine/IntentRing.js
// AF51 FutureMachine — outermost ring representing the build's intent:
// what target/template was requested and whether it passed the quality gate.
//
// Read-only projection of the runtime's "intent" ring. Intent is supplied via
// runtime.applyIntent(intent) and reflects manifest.json + production-quality-
// report.json values extracted from the build's ZIP. Nest FactoryRing inside
// via `children`.

import React from "react";
import { View, Text, StyleSheet } from "react-native";

var SEG_COLOR = {
  idle:   "#1b2030",
  active: "#d29b3a",
  done:   "#f0c14b",
  error:  "#c2453b",
};

var SEG_W = 96;
var SEG_H = 38;

export function IntentRing(props) {
  var snapshot = props.snapshot || null;
  var diameter = props.diameter || 560;

  var ring = snapshot && snapshot.rings && snapshot.rings.intent;
  var segs = (ring && ring.segments) || [];
  var state = (ring && ring.segState) || {};

  var count = segs.length || 1;
  var arc = 360 / count;
  var r = diameter / 2 - SEG_H;

  return (
    <View style={[styles.wrap, { width: diameter, height: diameter }]}>
      <View pointerEvents="none" style={styles.center}>
        {props.children}
      </View>

      {segs.map(function (seg, i) {
        var s = state[seg] || "idle";
        var deg = -90 + i * arc;
        var rad = (deg * Math.PI) / 180;
        var x = diameter / 2 + Math.cos(rad) * r - SEG_W / 2;
        var y = diameter / 2 + Math.sin(rad) * r - SEG_H / 2;
        return (
          <View
            key={seg}
            style={[styles.seg, {
              left: x,
              top: y,
              width: SEG_W,
              height: SEG_H,
              backgroundColor: SEG_COLOR[s] || SEG_COLOR.idle,
            }]}
          >
            <Text style={styles.segLabel}>{seg}</Text>
          </View>
        );
      })}
    </View>
  );
}

var styles = StyleSheet.create({
  wrap: {
    position: "relative",
    alignSelf: "center",
  },
  center: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  seg: {
    position: "absolute",
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  segLabel: {
    color: "#0e1118",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
});

export default IntentRing;
