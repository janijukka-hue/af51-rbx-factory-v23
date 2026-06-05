// ui/components/LeftPanel/FactoryStatus.js
// AF51 ROBLOX CODE RUNNER — Factory + RBX Runtime Status
// Spec §24 colors, §25 panel style

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../styles/theme.js';

function Dot({ active, color }) {
  return (
    <View style={[styles.dot, {
      backgroundColor: active ? (color || COLORS.lime) : COLORS.gray2,
      shadowColor:     active ? (color || COLORS.lime) : 'transparent',
      shadowOpacity:   active ? 0.8 : 0,
      shadowRadius:    active ? 4  : 0,
      elevation:       active ? 3  : 0,
    }]} />
  );
}

function Row({ label, value, valueColor }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor || COLORS.textPrimary }]}>{value}</Text>
    </View>
  );
}

export function FactoryStatus({ status, rbxLastBuild }) {
  var state        = status?.state || 'OFFLINE';
  var queueSize    = status?.memory?.queue?.queueLength || 0;
  var runningJobs  = status?.memory?.queue?.runningCount || 0;
  var isOnline     = state !== 'OFFLINE';
  var isBuilding   = state === 'BUILDING';

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>── FACTORY STATUS ──</Text>

      {/* Runtime dots row */}
      <View style={styles.dotsRow}>
        <View style={styles.dotItem}>
          <Dot active={isOnline}   color={COLORS.lime} />
          <Text style={styles.dotLabel}>k1</Text>
        </View>
        <View style={styles.dotItem}>
          <Dot active={isOnline}   color={COLORS.cyan} />
          <Text style={styles.dotLabel}>m2</Text>
        </View>
        <View style={styles.dotItem}>
          <Dot active={isOnline}   color={COLORS.purple} />
          <Text style={styles.dotLabel}>t3</Text>
        </View>
        <View style={styles.dotItem}>
          <Dot active={isBuilding} color={COLORS.pink} />
          <Text style={styles.dotLabel}>RBX</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Row
          label="State"
          value={state}
          valueColor={
            isBuilding ? COLORS.amber
            : isOnline ? COLORS.lime
            : COLORS.error
          }
        />
        <Row
          label="Queue"
          value={queueSize}
          valueColor={queueSize > 0 ? COLORS.amber : COLORS.textMuted}
        />
        <Row
          label="Running"
          value={runningJobs}
          valueColor={runningJobs > 0 ? COLORS.cyan : COLORS.textMuted}
        />
        {rbxLastBuild && (
          <Row
            label="Last RBX"
            value={rbxLastBuild}
            valueColor={COLORS.lime}
          />
        )}
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { marginTop: 4 },

  sectionTitle: {
    color:         COLORS.textMuted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing:  2,
    marginBottom:   10,
    marginTop:      14,
  },

  dotsRow: {
    flexDirection:  'row',
    gap:            12,
    marginBottom:   10,
    paddingLeft:    2,
  },
  dotItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  dotLabel: {
    color:      COLORS.textMuted,
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  card: {
    backgroundColor: '#0A0F18',
    borderWidth:     1,
    borderColor:     COLORS.border,
    borderRadius:    SIZES.radiusMd,
    paddingVertical:   8,
    paddingHorizontal: 10,
    gap:             6,
  },

  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  rowLabel: {
    color:      COLORS.textMuted,
    fontSize:   10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  rowValue: {
    fontSize:   10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default FactoryStatus;