// ui/components/Header.js
// AF51 ROBLOX CODE RUNNER — Top Bar
// Spec §23: Replace "AF51 PRODUCT EDITION" with "AF51 ROBLOX CODE RUNNER"
// Spec §24: RBX color system
// Spec §25: darker glass, soft neon glow, premium contrast

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../styles/theme.js';
import { StatusBadge } from './common/StatusBadge.js';

export function Header(props) {
  var alxStatus     = props.alxStatus;
  var factoryStatus = props.factoryStatus;
  var rbxStatus     = props.rbxStatus || null;

  var alxState = 'offline';
  if (alxStatus) {
    if (alxStatus.locked)                  alxState = 'locked';
    else if (alxStatus.state === 'READY')  alxState = 'ready';
    else if (alxStatus.state === 'EXECUTING') alxState = 'processing';
  }

  var factoryState = 'offline';
  if (factoryStatus) {
    if (factoryStatus.state === 'IDLE')     factoryState = 'ready';
    else if (factoryStatus.state === 'BUILDING') factoryState = 'running';
  }

  var rbxState = rbxStatus ? (rbxStatus.building ? 'building' : 'ready') : 'idle';

  return (
    <View style={[styles.header, SHADOWS.md]}>

      {/* ── LEFT: AF51 + ROBLOX CODE RUNNER branding ── */}
      <View style={styles.left}>
        <View style={styles.logoBlock}>
          <View style={styles.logoAF51}>
            <Text style={styles.logoAF51Text}>AF51</Text>
          </View>
          <View style={styles.logoDivider} />
          <View style={styles.logoRBX}>
            <Text style={styles.logoRBXIcon}>⬡</Text>
            <Text style={styles.logoRBXText}>RBX</Text>
          </View>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>ROBLOX CODE RUNNER</Text>
          <Text style={styles.subtitle}>AF51 · Sovereign Factory · k1 Governed</Text>
        </View>
      </View>

      {/* ── CENTER: Runtime status indicators ── */}
      <View style={styles.center}>
        <View style={styles.statusPill}>
          <View style={[styles.dot, { backgroundColor: alxState === 'ready' ? COLORS.lime : COLORS.amber }]} />
          <Text style={styles.statusLabel}>ALX</Text>
          <StatusBadge status={alxState} size="sm" />
        </View>

        <View style={styles.statusDivider} />

        <View style={styles.statusPill}>
          <View style={[styles.dot, { backgroundColor: factoryState === 'ready' ? COLORS.cyan : COLORS.amber }]} />
          <Text style={styles.statusLabel}>FACTORY</Text>
          <StatusBadge status={factoryState} size="sm" />
        </View>

        <View style={styles.statusDivider} />

        <View style={styles.statusPill}>
          <View style={[styles.dot, {
            backgroundColor: rbxState === 'building' ? COLORS.pink
              : rbxState === 'ready' ? COLORS.lime : COLORS.gray
          }]} />
          <Text style={styles.statusLabel}>RBX BUILD</Text>
          <Text style={[styles.rbxStateText, {
            color: rbxState === 'building' ? COLORS.pink
              : rbxState === 'ready' ? COLORS.lime : COLORS.gray
          }]}>
            {rbxState.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── RIGHT: Owner identity ── */}
      <View style={styles.right}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>Jani Segerman</Text>
          <Text style={styles.userRole}>Owner · AF51</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>JS</Text>
        </View>
      </View>

    </View>
  );
}

var styles = StyleSheet.create({
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    backgroundColor:  COLORS.panelBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SIZES.xl,
    paddingVertical:   SIZES.md,
    height: 68,
  },

  // LEFT
  left: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoBlock: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: '#0A0F18',
    borderWidth:    1,
    borderColor:    COLORS.border,
    borderRadius:   SIZES.radiusMd,
    overflow:       'hidden',
  },
  logoAF51: {
    paddingHorizontal: 10,
    paddingVertical:    6,
    backgroundColor:   '#A8FF2F18',
  },
  logoAF51Text: {
    color:      COLORS.lime,
    fontSize:   13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  logoDivider: { width: 1, height: '100%', backgroundColor: COLORS.border },
  logoRBX: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    paddingHorizontal: 10,
    paddingVertical:    6,
    backgroundColor: '#FF2FD118',
  },
  logoRBXIcon: { color: COLORS.pink, fontSize: 12 },
  logoRBXText: {
    color:      COLORS.pink,
    fontSize:   13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  titleBlock: { gap: 2 },
  title: {
    fontSize:   15,
    fontWeight: '800',
    color:      COLORS.textPrimary,
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize:  10,
    color:     COLORS.textMuted,
    letterSpacing: 0.8,
  },

  // CENTER
  center: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statusPill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    paddingHorizontal: 10,
    paddingVertical:    5,
    backgroundColor: '#0A0F18',
    borderWidth:     1,
    borderColor:     COLORS.border,
    borderRadius:    SIZES.radiusFull,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: {
    fontSize:     9,
    color:        COLORS.textMuted,
    fontWeight:   '700',
    letterSpacing: 1.2,
  },
  rbxStateText: {
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  statusDivider: { width: 1, height: 20, backgroundColor: COLORS.border },

  // RIGHT
  right:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userInfo: { alignItems: 'flex-end', gap: 2 },
  userName: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  userRole: { fontSize: 10, color: COLORS.textMuted },
  avatar: {
    width:           38,
    height:          38,
    borderRadius:    SIZES.radiusFull,
    backgroundColor: COLORS.purpleBg,
    borderWidth:     1.5,
    borderColor:     COLORS.purple,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: {
    color:      COLORS.purple,
    fontSize:   12,
    fontWeight: '800',
  },
});

export default Header;