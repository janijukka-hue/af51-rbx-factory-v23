// s4/screens/Preview/LiveRenderView.js
// Legacy non-RBX live preview. RBX targets use RbxPreviewCanvas instead.
// Renders provided code in a sandboxed iframe on web; shows summary elsewhere.

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

export function LiveRenderView(props) {
  var code  = props.code || "";
  var title = props.title || "Live Preview";

  var srcDoc = useMemo(function() {
    var safe = String(code || "").replace(/<\/script>/gi, "<\\/script>");
    return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<style>html,body{margin:0;padding:16px;background:#06080D;color:#C8D2E0;' +
      'font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:18px;}' +
      'pre{white-space:pre-wrap;word-break:break-word;}</style></head>' +
      '<body><pre>' + safe.replace(/</g, "&lt;") + '</pre></body></html>';
  }, [code]);

  if (Platform.OS !== "web") {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>Preview requires web browser.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <iframe
        srcDoc={srcDoc}
        style={{ width: "100%", height: "100%", border: "none", display: "block", backgroundColor: "#06080D" }}
        sandbox="allow-scripts"
        title={title}
      />
    </View>
  );
}

var styles = StyleSheet.create({
  wrap:  { flex: 1, width: "100%", height: "100%", minHeight: 300, backgroundColor: "#06080D", padding: 12 },
  title: { color: "#A8FF2F", fontSize: 14, fontWeight: "900", marginBottom: 8 },
  sub:   { color: "#445566", fontSize: 12 },
});

export default LiveRenderView;
