// s4/screens/ArtifactBrowser/ArtifactBrowserScreen.js
// AF51 ONE — Vault Build Browser
// Näyttää: id, intent, päivämäärä, koko, hash

import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList,
  Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

var SERVER = "http://localhost:3000";

var C = {
  bg:     "#080c0a",
  bg2:    "#0d1410",
  bg3:    "#111a14",
  border: "#1e2e22",
  lime:   "#39ff5a",
  limeDim:"#1a7a2e",
  white:  "#f0f4f1",
  gray:   "#8a9e8f",
  gray2:  "#2a3a2e",
  red:    "#ff4444",
  amber:  "#f5a623",
};

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("fi-FI");
}

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function BuildRow(props) {
  var b = props.build;
  var onPress = props.onPress;
  var index   = props.index;

  var statusColor = b.status === "stored"    ? C.lime :
                    b.status === "published"  ? C.amber :
                    b.status === "error"      ? C.red : C.gray;

  return (
    <Pressable style={s.row} onPress={function() { onPress(b); }}>
      <View style={s.rowHead}>
        <Text style={s.rowIndex}>{(index + 1).toString().padStart(2, "0")}</Text>
        <Text style={s.rowId} numberOfLines={1}>
          {(b.buildId || b.id || "?").slice(0, 20)}
        </Text>
        <View style={[s.statusDot, { backgroundColor: statusColor }]} />
      </View>

      <View style={s.rowMeta}>
        <Text style={s.rowIntent}>{b.intent || "GENERATE_JSX"}</Text>
        <Text style={s.rowDate}>{formatDate(b.savedAt || b.createdAt)}</Text>
      </View>

      <View style={s.rowFoot}>
        <Text style={s.rowHash}>
          sha: {b.sha256 ? b.sha256.slice(0, 16) + "…" : "—"}
        </Text>
        <Text style={s.rowSize}>{formatSize(b.size)}</Text>
      </View>
    </Pressable>
  );
}

function BuildDetail(props) {
  var b = props.build;
  var onClose = props.onClose;
  if (!b) return null;

  return (
    <View style={s.detail}>
      <View style={s.detailHead}>
        <Text style={s.detailTitle}>BUILD DETAIL</Text>
        <Pressable onPress={onClose} style={s.closeBtn}>
          <Text style={s.closeBtnText}>✕ SULJE</Text>
        </Pressable>
      </View>
      <View style={s.detailBody}>
        {[
          ["Build ID",  b.buildId || b.id || "?"],
          ["Status",    b.status || "stored"],
          ["Intent",    b.intent || "GENERATE_JSX"],
          ["Tallennettu", formatDate(b.savedAt || b.createdAt)],
          ["SHA-256",   b.sha256 || "—"],
          ["Koko",      formatSize(b.size)],
          ["Standalone", b.standalone ? "kyllä" : "ei"],
          ["AF51 ver",  b.af51_version || "—"],
        ].map(function(row) {
          return (
            <View key={row[0]} style={s.detailRow}>
              <Text style={s.detailKey}>{row[0]}</Text>
              <Text style={s.detailVal} numberOfLines={2} selectable>{row[1]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ArtifactBrowserScreen() {
  var [builds, setBuilds]       = useState([]);
  var [loading, setLoading]     = useState(true);
  var [refreshing, setRefreshing] = useState(false);
  var [error, setError]         = useState(null);
  var [selected, setSelected]   = useState(null);

  var fetchBuilds = useCallback(async function(isRefresh) {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError(null);
    try {
      var res  = await fetch(SERVER + "/vault/builds");
      var data = await res.json();
      if (data.ok) {
        setBuilds(data.builds || []);
      } else {
        setError(data.error || "Varasto ei vastaa");
      }
    } catch (e) {
      setError("Yhteysvirhe — onko server käynnissä?\n(npm run server)");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(function() { fetchBuilds(false); }, []);

  var renderItem = useCallback(function(info) {
    return (
      <BuildRow
        build={info.item}
        index={info.index}
        onPress={setSelected}
      />
    );
  }, []);

  var keyExtractor = useCallback(function(item) {
    return item.buildId || item.id || String(Math.random());
  }, []);

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.badge}><Text style={s.badgeText}>AF51</Text></View>
        <Text style={s.title}>VARASTO</Text>
        <Text style={s.count}>{builds.length} buildia</Text>
        <Pressable onPress={function() { fetchBuilds(true); }} style={s.refreshBtn}>
          <Text style={s.refreshBtnText}>↺</Text>
        </Pressable>
      </View>

      {/* Detail overlay */}
      {selected ? (
        <BuildDetail build={selected} onClose={function() { setSelected(null); }} />
      ) : null}

      {/* Lista */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.lime} />
          <Text style={s.loadingText}>Ladataan varastoa...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={function() { fetchBuilds(false); }}>
            <Text style={s.retryBtnText}>↺ YritÄ UUDELLEEN</Text>
          </Pressable>
        </View>
      ) : builds.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>□</Text>
          <Text style={s.emptyTitle}>VARASTO TYHJÄ</Text>
          <Text style={s.emptyText}>
            Tallenna ja buildaa ALX-chatissa.{"\n"}
            Rakenteet ilmestyvät tänne automaattisesti.
          </Text>
        </View>
      ) : (
        <FlatList
          data={builds}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={s.list}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={function() { fetchBuilds(true); }}
              tintColor={C.lime}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

var s = StyleSheet.create({
  root:   { flex:1, backgroundColor: C.bg },

  header: { flexDirection:"row", alignItems:"center", padding:14,
            borderBottomWidth:1, borderBottomColor:C.border, gap:8 },
  badge:  { backgroundColor:C.lime, paddingHorizontal:6, paddingVertical:2 },
  badgeText: { color:"#000", fontFamily:"Courier New", fontSize:9, fontWeight:"700", letterSpacing:2 },
  title:  { color:C.white, fontFamily:"Courier New", fontSize:12, fontWeight:"700", letterSpacing:3 },
  count:  { color:C.gray, fontFamily:"Courier New", fontSize:9, flex:1 },
  refreshBtn: { borderWidth:1, borderColor:C.border, paddingHorizontal:10, paddingVertical:4 },
  refreshBtnText: { color:C.gray, fontFamily:"Courier New", fontSize:12 },

  list:        { flex:1 },
  listContent: { padding:12, gap:8 },

  row: { backgroundColor:C.bg2, borderWidth:1, borderColor:C.border, padding:12, gap:6 },
  rowHead: { flexDirection:"row", alignItems:"center", gap:8 },
  rowIndex: { color:C.limeDim, fontFamily:"Courier New", fontSize:10, fontWeight:"700", minWidth:20 },
  rowId:    { color:C.lime, fontFamily:"Courier New", fontSize:11, flex:1 },
  statusDot: { width:6, height:6, borderRadius:3 },
  rowMeta:  { flexDirection:"row", justifyContent:"space-between" },
  rowIntent: { color:C.gray, fontFamily:"Courier New", fontSize:9, letterSpacing:1 },
  rowDate:   { color:C.gray, fontFamily:"Courier New", fontSize:9 },
  rowFoot:  { flexDirection:"row", justifyContent:"space-between" },
  rowHash:  { color:C.gray2, fontFamily:"Courier New", fontSize:8 },
  rowSize:  { color:C.gray2, fontFamily:"Courier New", fontSize:8 },

  detail: { backgroundColor:C.bg3, borderWidth:1, borderColor:C.limeDim, margin:12, padding:14 },
  detailHead: { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:12 },
  detailTitle: { color:C.lime, fontFamily:"Courier New", fontSize:11, fontWeight:"700", letterSpacing:3 },
  closeBtn: { borderWidth:1, borderColor:C.border, paddingHorizontal:8, paddingVertical:3 },
  closeBtnText: { color:C.gray, fontFamily:"Courier New", fontSize:9 },
  detailBody: { gap:8 },
  detailRow: { flexDirection:"row", gap:12 },
  detailKey: { color:C.gray, fontFamily:"Courier New", fontSize:9, letterSpacing:1, minWidth:90 },
  detailVal: { color:C.white, fontFamily:"Courier New", fontSize:9, flex:1 },

  center:     { flex:1, alignItems:"center", justifyContent:"center", padding:24 },
  loadingText: { color:C.gray, fontFamily:"Courier New", fontSize:10, marginTop:12 },
  errorText:   { color:C.red, fontFamily:"Courier New", fontSize:10, textAlign:"center", marginBottom:16 },
  retryBtn:    { borderWidth:1, borderColor:C.lime, paddingHorizontal:16, paddingVertical:8 },
  retryBtnText: { color:C.lime, fontFamily:"Courier New", fontSize:10, letterSpacing:2 },
  emptyIcon:   { color:C.limeDim, fontSize:32, fontFamily:"Courier New", marginBottom:12 },
  emptyTitle:  { color:C.white, fontFamily:"Courier New", fontSize:12, letterSpacing:3, marginBottom:8 },
  emptyText:   { color:C.gray, fontFamily:"Courier New", fontSize:10, textAlign:"center", lineHeight:18 },
});