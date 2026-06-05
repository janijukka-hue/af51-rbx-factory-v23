// ui/components/LeftPanel/index.js
// AF51 ROBLOX CODE RUNNER — Left Panel (Factory Control)

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../styles/theme.js';
import { ActionButtons } from './ActionButtons.js';
import { FactoryStatus } from './FactoryStatus.js';
import { QuickActions } from './QuickActions.js';

export function LeftPanel({
  status,
  isRunning,
  onRunBuild,
  onPublish,
  onStop,
  onRetry,
  onClearQueue,
  onNewApp,
  onNewGame,
  onRebuildLast,
  onPublishRecommended,
  onResetFactory,
  onRbxBuild,
  rbxLastBuild,
}) {
  var queueSize = status?.memory?.queue?.queueLength || 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Panel header */}
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>T3</Text>
        </View>
        <View>
          <Text style={styles.title}>Factory Control</Text>
          <Text style={styles.subtitle}>RBX Pipeline</Text>
        </View>
      </View>

      <ActionButtons
        onRunBuild={onRunBuild}
        onPublish={onPublish}
        onStop={onStop}
        onRetry={onRetry}
        onClearQueue={onClearQueue}
        isRunning={isRunning}
        hasQueue={queueSize > 0}
      />

      <FactoryStatus status={status} rbxLastBuild={rbxLastBuild} />

      <QuickActions
        onNewApp={onNewApp}
        onNewGame={onNewGame}
        onRebuildLast={onRebuildLast}
        onPublishRecommended={onPublishRecommended}
        onResetFactory={onResetFactory}
        onRbxBuild={onRbxBuild}
        isRunning={isRunning}
      />

    </ScrollView>
  );
}

var styles = StyleSheet.create({
  container: {
    flex:             1,
    backgroundColor:  COLORS.panelBg,
    paddingHorizontal: SIZES.lg,
    paddingTop:        SIZES.md,
    borderRightWidth:  1,
    borderRightColor:  COLORS.border,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
    paddingBottom:   12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom:    4,
  },
  logo: {
    width:           34,
    height:          34,
    backgroundColor: '#A8FF2F18',
    borderWidth:     1,
    borderColor:     '#A8FF2F44',
    borderRadius:    SIZES.radiusMd,
    alignItems:      'center',
    justifyContent:  'center',
  },
  logoText: {
    color:      COLORS.lime,
    fontSize:   12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color:      COLORS.textPrimary,
    fontSize:   13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    color:     COLORS.textMuted,
    fontSize:  9,
    letterSpacing: 1,
  },
});

export default LeftPanel;