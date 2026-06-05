// ui/futureMachine/WorldRing.js
// AF51 FutureMachine — outermost ring representing the build's deploy
// surface / outer environment: platform, runtime, compatibility,
// signature, identity.
//
// Read-only projection of the runtime's "world" ring. World is supplied
// via runtime.applyWorld(world) and reflects manifest.json values
// (factory, rojo, robloxCompatible, signedAt, masterHash) extracted from
// the build's ZIP. Nest EnergyRing inside via `children`.

import React from "react";
import { View, Text, StyleSheet } from "react-native";

var SEG_COLOR = {
  idle:   "#1a1f2c",
  active: "#3aa890",
  done:   "#62d4b6",
  error:  "#c2453b",
};

var SEG_W = 112;
var SEG_H = 44;

export function WorldRing(props) {
  var snapshot = props.snapshot || null;
  var diameter = props.diameter || 1020;

  var ring = snapshot && snapshot.rings && snapshot.rings.world;
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
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  segLabel: {
    color: "#0e1118",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
});

export default WorldRing;
