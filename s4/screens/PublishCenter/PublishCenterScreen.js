// s4/screens/PublishCenter/PublishCenterScreen.js
// AF51-RBX — Publish Center rewritten for RBX mode
// Shows RBX export registry (exports-rbx/export-registry.json)
// Blob download only — NO Linking.openURL, NO localhost redirect

import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList,
  Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

var SERVER = "http://localhost:3000";

var C = {
  bg:       "#06080D", bg2: "#0E141B", bg3: "#111820",
  border:   "#1A2535",
  lime:     "#A8FF2F", limeDim: "#3A5A0A", limeGlow: "#A8FF2F18",
  cyan:     "#25D0FF", cyanDim: "#0A4A5A",
  purple:   "#8C52FF",
  white:    "#F0F4FF", gray: "#7A8BA8", gray2: "#1E2A3A",
  red:      "#FF4D6D", amber: "#FFC83D",
};

function formatBytes(b) {
  if (!b || b === 0) return "—";
  return (b / 1024).toFixed(1) + " KB";
}
function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("fi-FI");
}

function blobDownload(url, filename) {
  fetch(url)
    .then(function(r) {
      if (!r.ok) throw new Error("Server " + r.status);
      return r.blob();
    })
    .then(function(blob) {
      var ou = window.URL.createObjectURL(blob);
      var a  = document.createElement("a");
      a.href = ou; a.download = filename || "roblox-project.zip";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(ou);
    })
    .catch(function(e) { alert("Download failed: " + e.message); });
}

function ExportRow(props) {
  var r = props.item;
  var filename = r.zipName || r.filename || (r.buildId + ".zip");
  var dlUrl    = SERVER + "/rbx/download/" + filename;
  var isOk     = r.status === "DONE" || r.ok;

  return (
    <View style={s.row}>
      <View style={s.rowHead}>
        <View style={[s.badge, {backgroundColor: isOk ? C.limeGlow : "#FF4D6D18", borderColor: isOk ? C.limeDim : C.red}]}>
          <Text style={[s.badgeText, {color: isOk ? C.lime : C.red}]}>{isOk ? "✓ READY" : "✗ FAILED"}</Text>
        </View>
        <Text style={s.target}>{(r.targetId || "?").toUpperCase()}</Text>
        <Text style={s.date}>{formatDate(r.exportedAt)}</Text>
      </View>

      <Text style={s.buildId} numberOfLines={1}>{r.buildId || "—"}</Text>
      <Text style={s.zipName} numberOfLines={1}>{filename}</Text>

      <View style={s.meta}>
        <Text style={s.metaItem}>ZIP: {formatBytes(r.sizeBytes)}</Text>
        <Text style={s.metaItem}>Duration: {r.durationMs || 0}ms</Text>
        <Text style={s.metaItem}>Profile: {r.profileId || "dev"}</Text>
      </View>

      {isOk && (
        <Pressable
          style={s.dlBtn}
          onPress={function() { blobDownload(dlUrl, filename); }}
          activeOpacity={0.7}
        >
          <Text style={s.dlBtnText}>⬇ DOWNLOAD ZIP</Text>
        </Pressable>
      )}
    </View>
  );
}

export function PublishCenterScreen() {
  var [items,      setItems]      = useState([]);
  var [loading,    setLoading]    = useState(true);
  var [refreshing, setRefreshing] = useState(false);
  var [error,      setError]      = useState(null);

  var load = useCallback(async function(isRefresh) {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError(null);
    try {
      var res  = await fetch(SERVER + "/rbx/exports");
      var data = await res.json();
      if (data.ok) {
        setItems(data.exports || []);
      } else {
        setError(data.error || "Could not load exports");
      }
    } catch (e) {
      setError("Server offline? Run: npm run server");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(function() { load(false); }, []);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <View style={s.af51badge}><Text style={s.af51text}>AF51</Text></View>
        <Text style={s.title}>RBX EXPORT HISTORY</Text>
        <Text style={s.count}>{items.length} builds</Text>
        <Pressable onPress={function() { load(true); }} style={s.refreshBtn}>
          <Text style={s.refreshText}>↺</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.lime} />
          <Text style={s.grayText}>Loading exports...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={function() { load(false); }}>
            <Text style={s.retryText}>↺ RETRY</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Text style={[s.grayText, {fontSize:14, marginBottom:8}]}>⬡</Text>
          <Text style={s.whiteText}>NO EXPORTS YET</Text>
          <Text style={s.grayText}>Run a build first:{"\n"}type: build tycoon</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={function(info) { return <ExportRow item={info.item} />; }}
          keyExtractor={function(item) { return item.buildId || String(Math.random()); }}
          style={s.list}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={function(){ load(true); }} tintColor={C.lime} />}
        />
      )}
    </SafeAreaView>
  );
}

var s = StyleSheet.create({
  root:   { flex:1, backgroundColor: C.bg },
  header: { flexDirection:"row", alignItems:"center", padding:14, borderBottomWidth:1, borderBottomColor:C.border, gap:10 },
  af51badge: { backgroundColor:C.limeGlow, borderWidth:1, borderColor:C.limeDim, paddingHorizontal:8, paddingVertical:3 },
  af51text: { color:C.lime, fontSize:9, fontWeight:"900", letterSpacing:2 },
  title:  { color:C.white, fontSize:12, fontWeight:"700", letterSpacing:2, flex:1 },
  count:  { color:C.gray, fontSize:9 },
  refreshBtn: { borderWidth:1, borderColor:C.border, paddingHorizontal:10, paddingVertical:4 },
  refreshText: { color:C.gray, fontSize:12 },

  list:        { flex:1 },
  listContent: { padding:12, gap:10 },

  row:     { backgroundColor:C.bg2, borderWidth:1, borderColor:C.border, borderRadius:8, padding:12, gap:8 },
  rowHead: { flexDirection:"row", alignItems:"center", gap:8 },
  badge:   { borderWidth:1, paddingHorizontal:8, paddingVertical:2, borderRadius:4 },
  badgeText: { fontSize:9, fontWeight:"900", letterSpacing:1 },
  target:  { color:C.cyan, fontSize:11, fontWeight:"700", letterSpacing:1 },
  date:    { color:C.gray, fontSize:9, marginLeft:"auto" },
  buildId: { color:C.gray, fontSize:9 },
  zipName: { color:C.lime, fontSize:10, fontWeight:"700" },
  meta:    { flexDirection:"row", gap:12, flexWrap:"wrap" },
  metaItem:{ color:C.gray, fontSize:9 },
  dlBtn:   { backgroundColor:C.cyanDim, borderWidth:1, borderColor:C.cyan, padding:10, alignItems:"center", borderRadius:6,
             shadowColor:C.cyan, shadowOffset:{width:0,height:0}, shadowOpacity:0.3, shadowRadius:6 },
  dlBtnText: { color:C.cyan, fontSize:11, fontWeight:"900", letterSpacing:2 },

  center:    { flex:1, alignItems:"center", justifyContent:"center", padding:24, gap:12 },
  grayText:  { color:C.gray, fontSize:10, textAlign:"center", lineHeight:18 },
  whiteText: { color:C.white, fontSize:12, fontWeight:"700", letterSpacing:2 },
  errorText: { color:C.red, fontSize:10, textAlign:"center" },
  retryBtn:  { borderWidth:1, borderColor:C.lime, paddingHorizontal:16, paddingVertical:8 },
  retryText: { color:C.lime, fontSize:10, fontWeight:"700", letterSpacing:2 },
});