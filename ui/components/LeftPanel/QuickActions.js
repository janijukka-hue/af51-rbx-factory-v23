// ui/components/LeftPanel/QuickActions.js
// AF51 ROBLOX CODE RUNNER — Quick Actions + Roblox Build Targets
// Spec §19: 5 Roblox target types exposed as one-click builds

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../styles/theme.js';

var RBX_TARGETS = [
  { id: 'obby',      label: 'Obby',      icon: '🏃', color: COLORS.lime,   glow: '#A8FF2F' },
  { id: 'tycoon',    label: 'Tycoon',    icon: '🏭', color: COLORS.cyan,   glow: '#25D0FF' },
  { id: 'simulator', label: 'Simulator', icon: '⚡', color: COLORS.purple, glow: '#8C52FF' },
  { id: 'rpg',       label: 'RPG',       icon: '⚔️',  color: COLORS.pink,   glow: '#FF2FD1' },
  { id: 'fps',       label: 'FPS',       icon: '🎯', color: COLORS.amber,  glow: '#FFC83D' },
];

export function QuickActions({
  onNewApp,
  onNewGame,
  onRebuildLast,
  onPublishRecommended,
  onResetFactory,
  onRbxBuild,
  isRunning
}) {
  return (
    <View style={styles.container}>

      {/* ── ROBLOX TARGETS — one-click builds ── */}
      <Text style={styles.sectionTitle}>── RBX TARGETS ──</Text>

      <View style={styles.rbxGrid}>
        {RBX_TARGETS.map(function(t) {
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.rbxBtn, { borderColor: t.color + '55' }]}
              onPress={function() { onRbxBuild && onRbxBuild(t.id); }}
              disabled={isRunning}
              activeOpacity={0.7}
            >
              <Text style={styles.rbxIcon}>{t.icon}</Text>
              <Text style={[styles.rbxLabel, { color: t.color }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── GENERAL QUICK ACTIONS ── */}
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>── QUICK ──</Text>

      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.qBtn}
          onPress={onNewApp}
          disabled={isRunning}
          activeOpacity={0.7}
        >
          <Text style={styles.qBtnText}>📱 New App</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.qBtn}
          onPress={onNewGame}
          disabled={isRunning}
          activeOpacity={0.7}
        >
          <Text style={styles.qBtnText}>🎮 New Game</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.qBtn}
          onPress={onRebuildLast}
          disabled={isRunning}
          activeOpacity={0.7}
        >
          <Text style={styles.qBtnText}>↻ Rebuild</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.qBtn}
          onPress={onPublishRecommended}
          disabled={isRunning}
          activeOpacity={0.7}
        >
          <Text style={styles.qBtnText}>⬆ Publish</Text>
        </TouchableOpacity>
      </View>

      {/* ── RESET — danger ── */}
      <TouchableOpacity
        style={styles.resetBtn}
        onPress={onResetFactory}
        activeOpacity={0.7}
      >
        <Text style={styles.resetText}>⟲  RESET FACTORY</Text>
      </TouchableOpacity>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { marginTop: 8 },

  sectionTitle: {
    color:         COLORS.textMuted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing:  2,
    marginBottom:   8,
  },

  // RBX target grid
  rbxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rbxBtn: {
    width:           '30%',
    flexGrow:        1,
    alignItems:      'center',
    paddingVertical:  10,
    backgroundColor: '#0A0F18',
    borderWidth:     1,
    borderRadius:    SIZES.radiusMd,
    gap:             3,
  },
  rbxIcon:  { fontSize: 16 },
  rbxLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  // General quick grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qBtn: {
    width:           '48%',
    paddingVertical:  9,
    backgroundColor: '#0A0F18',
    borderWidth:     1,
    borderColor:     COLORS.border,
    borderRadius:    SIZES.radiusMd,
    alignItems:      'center',
  },
  qBtnText: { color: COLORS.textSecondary, fontSize: 11 },

  // Reset
  resetBtn: {
    marginTop:       10,
    paddingVertical:  9,
    backgroundColor: '#FF4D6D08',
    borderWidth:     1,
    borderColor:     '#FF4D6D44',
    borderRadius:    SIZES.radiusMd,
    alignItems:      'center',
  },
  resetText: { color: COLORS.error, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
});

export default QuickActions;