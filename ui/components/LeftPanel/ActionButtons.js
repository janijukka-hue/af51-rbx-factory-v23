// ui/components/LeftPanel/ActionButtons.js
// AF51 ROBLOX CODE RUNNER — Action Buttons
// Spec §26: BUILD=Neon Lime, EXPORT=Electric Cyan, PACKAGE=Purple, DELETE=Dark Red
// Spec §27: soft hover glow, button pulse — no casino effects

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../styles/theme.js';

export function ActionButtons({
  onRunBuild,
  onPublish,
  onStop,
  onRetry,
  onClearQueue,
  isRunning,
  hasQueue
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>── ACTIONS ──</Text>

      {/* BUILD — Neon Lime */}
      <TouchableOpacity
        style={[styles.btn, styles.btnBuild, isRunning && styles.btnDisabled]}
        onPress={onRunBuild}
        disabled={isRunning}
        activeOpacity={0.75}
      >
        <Text style={styles.btnBuildIcon}>▶</Text>
        <Text style={styles.btnBuildText}>RUN BUILD</Text>
      </TouchableOpacity>

      {/* EXPORT — Electric Cyan */}
      <TouchableOpacity
        style={[styles.btn, styles.btnExport, isRunning && styles.btnDisabled]}
        onPress={onPublish}
        disabled={isRunning}
        activeOpacity={0.75}
      >
        <Text style={styles.btnExportIcon}>⬆</Text>
        <Text style={styles.btnExportText}>EXPORT ZIP</Text>
      </TouchableOpacity>

      {/* STOP — Dark Red */}
      <TouchableOpacity
        style={[styles.btn, styles.btnStop, !isRunning && styles.btnDisabled]}
        onPress={onStop}
        disabled={!isRunning}
        activeOpacity={0.75}
      >
        <Text style={styles.btnStopIcon}>⬛</Text>
        <Text style={styles.btnStopText}>STOP JOB</Text>
      </TouchableOpacity>

      {/* RETRY — Package Purple */}
      <TouchableOpacity
        style={[styles.btn, styles.btnPackage]}
        onPress={onRetry}
        activeOpacity={0.75}
      >
        <Text style={styles.btnPackageIcon}>↻</Text>
        <Text style={styles.btnPackageText}>RETRY LAST</Text>
      </TouchableOpacity>

      {/* CLEAR — Dark ghost */}
      <TouchableOpacity
        style={[styles.btn, styles.btnClear, !hasQueue && styles.btnDisabled]}
        onPress={onClearQueue}
        disabled={!hasQueue}
        activeOpacity={0.75}
      >
        <Text style={styles.btnClearText}>✕  CLEAR QUEUE</Text>
      </TouchableOpacity>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { gap: 6 },

  sectionTitle: {
    color:        COLORS.textMuted,
    fontSize:     9,
    fontWeight:   '700',
    letterSpacing: 2,
    marginBottom:  4,
    marginTop:     12,
  },

  // Base button
  btn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    paddingVertical:   10,
    paddingHorizontal: 14,
    borderRadius:    SIZES.radiusMd,
    borderWidth:     1,
  },

  // BUILD — Neon Lime
  btnBuild: {
    backgroundColor: '#A8FF2F',
    borderColor:     '#A8FF2F',
    shadowColor:     '#A8FF2F',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.4,
    shadowRadius:    8,
    elevation:       6,
  },
  btnBuildIcon: { color: '#06080D', fontSize: 13, fontWeight: '900' },
  btnBuildText: { color: '#06080D', fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  // EXPORT — Electric Cyan
  btnExport: {
    backgroundColor: '#25D0FF18',
    borderColor:     '#25D0FF',
    shadowColor:     '#25D0FF',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.25,
    shadowRadius:    6,
    elevation:       4,
  },
  btnExportIcon: { color: '#25D0FF', fontSize: 13, fontWeight: '700' },
  btnExportText: { color: '#25D0FF', fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  // STOP — Dark Red
  btnStop: {
    backgroundColor: '#FF4D6D18',
    borderColor:     '#FF4D6D',
  },
  btnStopIcon: { color: '#FF4D6D', fontSize: 12, fontWeight: '700' },
  btnStopText: { color: '#FF4D6D', fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  // PACKAGE — Purple
  btnPackage: {
    backgroundColor: '#8C52FF18',
    borderColor:     '#8C52FF',
    shadowColor:     '#8C52FF',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.2,
    shadowRadius:    5,
    elevation:       3,
  },
  btnPackageIcon: { color: '#8C52FF', fontSize: 13, fontWeight: '700' },
  btnPackageText: { color: '#8C52FF', fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  // CLEAR — ghost dark
  btnClear: {
    backgroundColor: 'transparent',
    borderColor:     COLORS.border,
  },
  btnClearText: { color: COLORS.textMuted, fontSize: 11, letterSpacing: 0.8 },

  btnDisabled: { opacity: 0.35 },
});

export default ActionButtons;