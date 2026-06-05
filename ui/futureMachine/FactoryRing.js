// ui/futureMachine/FactoryRing.js
// AF51 FutureMachine — factory ring with 6 segments laid out around a
// central slot that hosts the CoreSphere via `children`.
//
// Read-only projection of the runtime's "factory" ring. Segment ordering
// and labels come from FactoryRingContract.

import React from "react";
import { View, Text, StyleSheet } from "react-native";

var SEG_COLOR = {
  idle:   "#2a2f3d",
  active: "#3b6df0",
  done:   "#3aa46f",
  error:  "#c2453b",
};

var SEG_W = 88;
var SEG_H = 34;

export function FactoryRing(props) {
  var snapshot = props.snapshot || null;
  var diameter = props.diameter || 280;

  var ring = snapshot && snapshot.rings && snapshot.rings.factory;
  var segs = (ring && ring.segments) || [];
  var state = (ring && ring.segState) || {};

  var count = segs.length || 1;
  var arc = 360 / count;
  // Position labels on a circle of radius r centered inside the wrap. The
  // first segment sits at 12 o'clock (-90°) and we go clockwise.
  var r = diameter / 2 - SEG_H;

  return (
    <View style={[styles.wrap, { width: diameter, height: diameter }]}>
      {/* center slot for CoreSphere (or any composed content) */}
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
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  segLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
  },
});

export default FactoryRing;
