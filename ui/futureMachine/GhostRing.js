// ui/futureMachine/GhostRing.js
// AF51 FutureMachine — inner ring representing the Ghost Vault seal.
//
// Read-only projection of the runtime's "ghost" ring. The 5 segments map
// 1:1 to the files produced by GHOST_SEAL (lineage.json, recovery.map,
// deploy.signature, runtime.hash, policy.snapshot). Designed to be nested
// inside FactoryRing's center slot via `children`.

import React from "react";
import { View, Text, StyleSheet } from "react-native";

var SEG_COLOR = {
  idle:   "#202434",
  active: "#7a5cc0",
  done:   "#9a7feb",
  error:  "#c2453b",
};

var SEG_W = 70;
var SEG_H = 26;

export function GhostRing(props) {
  var snapshot = props.snapshot || null;
  var diameter = props.diameter || 230;

  var ring = snapshot && snapshot.rings && snapshot.rings.ghost;
  var segs = (ring && ring.segments) || [];
  var state = (ring && ring.segState) || {};

  var count = segs.length || 1;
  var arc = 360 / count;
  // Start at 12 o'clock and proceed clockwise, just like FactoryRing.
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
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  segLabel: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
});

export default GhostRing;
