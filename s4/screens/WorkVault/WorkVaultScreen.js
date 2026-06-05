// s4/screens/WorkVault/WorkVaultScreen.js
// Work Vault — tallennettujen töiden listaus, valinta ja poisto
// work artifact ≠ chat message

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView, RefreshControl
} from "react-native";

import SERVER_URL from "../../services/serverConfig.js";
var SERVER = SERVER_URL;
var C = {
  bg:      "#080c0a", surface: "#0d1410", card: "#111a14",
  border:  "#1e2e22", lime:    "#39ff5a", gray:  "#8a9e8f",
  red:     "#ff4444", amber:   "#f5a623", blue:  "#60a5fa",
  text:    "#f0f4f1", muted:   "#4a5e4e",
};

function formatDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("fi-FI"); } catch { return iso; }
}

function typeColor(type) {
  if (!type) return C.gray;
  if (type.includes("react")) return C.blue;
  if (type.includes("node"))  return C.lime;
  return C.amber;
}

export function WorkVaultScreen({ onSelectWork }) {
  var [works,     setWorks]     = useState([]);
  var [loading,   setLoading]   = useState(false);
  var [error,     setError]     = useState(null);
  var [deleting,  setDeleting]  = useState(null);
  var [selected,  setSelected]  = useState(null);

  var load = useCallback(async function() {
    setLoading(true);
    setError(null);
    try {
      var res  = await fetch(SERVER + "/works");
      var data = await res.json();
      if (data.ok) {
        setWorks(data.works || []);
      } else {
        setError(data.error || "Lataus epäonnistui");
      }
    } catch (e) {
      setError("Yhteysvirhe — onko server käynnissä?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(function() { load(); }, [load]);

  var handleSelect = useCallback(async function(work) {
    setSelected(work.id);
    try {
      var res  = await fetch(SERVER + "/works/" + work.id);
      var data = await res.json();
      if (data.ok && data.work && onSelectWork) {
        onSelectWork(data.work);
      }
    } catch (e) {
      Alert.alert("Virhe", "Työn lataus epäonnistui: " + e.message);
    } finally {
      setSelected(null);
    }
  }, [onSelectWork]);

  var handleDelete = useCallback(function(work) {
    Alert.alert(
      "Poista työ",
      "Poistetaanko \"" + work.title + "\"?\nTätä ei voi peruuttaa.",
      [
        { text: "Peruuta", style: "cancel" },
        {
          text: "Poista", style: "destructive",
          onPress: async function() {
            setDeleting(work.id);
            try {
              var res  = await fetch(SERVER + "/works/" + work.id, { method: "DELETE" });
              var data = await res.json();
              if (data.ok) {
                setWorks(function(p) { return p.filter(function(w) { return w.id !== work.id; }); });
              } else {
                Alert.alert("Virhe", data.error || "Poisto epäonnistui");
              }
            } catch (e) {
              Alert.alert("Virhe", e.message);
            } finally {
              setDeleting(null);
            }
          }
        }
      ]
    );
  }, []);

  function renderItem(info) {
    var w = info.item;
    var isSelected = selected === w.id;
    var isDeleting = deleting === w.id;
    return (
      <View style={[s.card, isSelected && s.cardSelected]}>
        <View style={s.cardHeader}>
          <Text style={s.title} numberOfLines={1}>{w.title}</Text>
          <View style={[s.badge, { borderColor: typeColor(w.type) + "60" }]}>
            <Text style={[s.badgeText, { color: typeColor(w.type) }]}>
              {w.type || "unknown"}
            </Text>
          </View>
        </View>

        <View style={s.meta}>
          <Text style={s.metaText}>{formatDate(w.createdAt)}</Text>
          <Text style={s.metaText}>{w.fileCount} tiedostoa</Text>
          {w.source ? <Text style={s.metaText}>via {w.source}</Text> : null}
        </View>

        <View style={s.actions}>
          <Pressable
            style={[s.btn, s.btnPrimary, isSelected && s.btnDisabled]}
            onPress={function() { handleSelect(w); }}
            disabled={!!isSelected || !!deleting}
          >
            {isSelected
              ? <ActivityIndicator size="small" color={C.bg} />
              : <Text style={s.btnPrimaryText}>▶ AVAA</Text>
            }
          </Pressable>

          <Pressable
            style={[s.btn, s.btnDanger, isDeleting && s.btnDisabled]}
            onPress={function() { handleDelete(w); }}
            disabled={!!isSelected || !!deleting}
          >
            {isDeleting
              ? <ActivityIndicator size="small" color={C.red} />
              : <Text style={s.btnDangerText}>🗑 POISTA</Text>
            }
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>WORK VAULT</Text>
        <Text style={s.headerSub}>Tallennetut työt</Text>
      </View>

      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>❌ {error}</Text>
          <Pressable onPress={load} style={s.retryBtn}>
            <Text style={s.retryText}>↺ Yritä uudelleen</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={works}
        keyExtractor={function(w) { return w.id; }}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={C.lime}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📦</Text>
              <Text style={s.emptyText}>Ei tallennettuja töitä</Text>
              <Text style={s.emptyHint}>
                Tallenna työ MasterRoom-näkymässä{"\n"}
                käyttämällä TALLENNA-nappia.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

export default WorkVaultScreen;

var s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:  { color: C.lime, fontFamily: "Courier New", fontSize: 14, fontWeight: "700", letterSpacing: 3 },
  headerSub:    { color: C.gray, fontFamily: "Courier New", fontSize: 10, marginTop: 2 },
  list:         { padding: 12, paddingBottom: 40 },
  card:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
                  borderRadius: 8, marginBottom: 10, padding: 14 },
  cardSelected: { borderColor: C.lime },
  cardHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  title:        { color: C.text, fontFamily: "Courier New", fontSize: 12, fontWeight: "700", flex: 1, marginRight: 8 },
  badge:        { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:    { fontFamily: "Courier New", fontSize: 9, fontWeight: "700" },
  meta:         { flexDirection: "row", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  metaText:     { color: C.muted, fontFamily: "Courier New", fontSize: 9 },
  actions:      { flexDirection: "row", gap: 8 },
  btn:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, borderWidth: 1 },
  btnPrimary:   { backgroundColor: C.lime + "18", borderColor: C.lime + "60" },
  btnPrimaryText:{ color: C.lime, fontFamily: "Courier New", fontSize: 10, fontWeight: "700" },
  btnDanger:    { backgroundColor: C.red + "10", borderColor: C.red + "40" },
  btnDangerText:{ color: C.red, fontFamily: "Courier New", fontSize: 10, fontWeight: "700" },
  btnDisabled:  { opacity: 0.5 },
  errorBox:     { margin: 12, padding: 12, backgroundColor: C.red + "10",
                  borderWidth: 1, borderColor: C.red + "40", borderRadius: 6 },
  errorText:    { color: C.red, fontFamily: "Courier New", fontSize: 11, marginBottom: 8 },
  retryBtn:     { alignSelf: "flex-start" },
  retryText:    { color: C.lime, fontFamily: "Courier New", fontSize: 11 },
  empty:        { alignItems: "center", paddingTop: 60 },
  emptyIcon:    { fontSize: 40, marginBottom: 12 },
  emptyText:    { color: C.gray, fontFamily: "Courier New", fontSize: 13, marginBottom: 8 },
  emptyHint:    { color: C.muted, fontFamily: "Courier New", fontSize: 10, textAlign: "center", lineHeight: 18 },
});