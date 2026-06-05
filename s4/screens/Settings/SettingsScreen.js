// s4/screens/Settings/SettingsScreen.js
// ALX Factory - Settings Screen
// Version: 2.0.0 - Power User mode toggle

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Card } from "../../components/common/Card.js";
import { Button, BUTTON_VARIANT } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { StatusIndicator, STATUS } from "../../components/common/StatusIndicator.js";
import { useFactory } from "../../hooks/useFactory.js";
import { useAppState, useAppActions } from "../../state/AppContext.js";

function SettingsScreen(props) {
  var orchestrator = props.orchestrator;
  var factory = useFactory(orchestrator);

  var appState   = useAppState();
  var appActions = useAppActions();

  var isPowerUser = appState && appState.uiMode === "power";

  function toggleUiMode() {
    if (appActions && appActions.setUiMode) {
      appActions.setUiMode(isPowerUser ? "basic" : "power");
    }
  }

  var autoRefreshState = useState(true);
  var autoRefresh = autoRefreshState[0];
  var setAutoRefresh = autoRefreshState[1];

  var darkModeState = useState(true);
  var darkMode = darkModeState[0];
  var setDarkMode = darkModeState[1];

  var debugModeState = useState(false);
  var debugMode = debugModeState[0];
  var setDebugMode = debugModeState[1];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <Card title="Factory Status" style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Connection:</Text>
            <StatusIndicator
              status={factory.isConnected ? STATUS.SUCCESS : STATUS.ERROR}
              label={factory.isConnected ? "Connected" : "Disconnected"}
            />
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>State:</Text>
            <Text style={styles.statusValue}>
              {factory.factoryStatus ? factory.factoryStatus.state : "OFFLINE"}
            </Text>
          </View>
        </Card>

        <Card title="General" style={styles.card}>
          <SettingRow
            label="Auto-refresh"
            description="Automatically refresh data"
          >
            <Switch
              value={autoRefresh}
              onValueChange={setAutoRefresh}
              trackColor={{ false: COLORS.bg.overlay, true: COLORS.primaryLight }}
              thumbColor={autoRefresh ? COLORS.primary : COLORS.text.muted}
            />
          </SettingRow>

          <SettingRow
            label="Dark Mode"
            description="Use dark theme"
          >
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: COLORS.bg.overlay, true: COLORS.primaryLight }}
              thumbColor={darkMode ? COLORS.primary : COLORS.text.muted}
            />
          </SettingRow>

          <SettingRow
            label="Debug Mode"
            description="Show debug information"
          >
            <Switch
              value={debugMode}
              onValueChange={setDebugMode}
              trackColor={{ false: COLORS.bg.overlay, true: COLORS.primaryLight }}
              thumbColor={debugMode ? COLORS.primary : COLORS.text.muted}
            />
          </SettingRow>
        </Card>

        <Card title="LLM Configuration" style={styles.card}>
          <Input
            label="Ollama Endpoint"
            value="http://localhost:11434"
            hint="Local Ollama server address"
            style={styles.input}
          />
          <Input
            label="Model"
            value="llama3.2"
            hint="Model to use for generation"
            style={styles.input}
          />
        </Card>

        <Card title="Actions" style={styles.card}>
          <Button
            variant={BUTTON_VARIANT.OUTLINE}
            onPress={factory.refreshStatus}
            style={styles.actionButton}
            fullWidth
          >
            Refresh Factory Status
          </Button>
          <Button
            variant={BUTTON_VARIANT.OUTLINE}
            onPress={function() { factory.refreshArtifacts(); }}
            style={styles.actionButton}
            fullWidth
          >
            Refresh Artifacts
          </Button>
          <Button
            variant={BUTTON_VARIANT.DANGER}
            style={styles.actionButton}
            fullWidth
          >
            Clear All Data
          </Button>
        </Card>

        <Card title="About" style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version:</Text>
            <Text style={styles.aboutValue}>2.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Architecture:</Text>
            <Text style={styles.aboutValue}>k1 → m2 → t3 → s4</Text>
          </View>
        </Card>
        {/* Power User mode toggle */}
        <Card title="Käyttöliittymä" style={styles.card}>
          <SettingRow
            label="Power User -moodi"
            description={isPowerUser
              ? "Kaikki tabit näkyvissä: Debug, Logs, Jobs, Reports"
              : "Ydintoiminnot: ALX, Build, Preview, Artifacts"}
          >
            <Switch
              value={!!isPowerUser}
              onValueChange={toggleUiMode}
              trackColor={{ false: COLORS.border.default, true: COLORS.primary }}
              thumbColor={isPowerUser ? COLORS.bg.base : COLORS.text.muted}
            />
          </SettingRow>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow(props) {
  var label = props.label;
  var description = props.description;
  var children = props.children;

  return (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && (
          <Text style={styles.settingDescription}>{description}</Text>
        )}
      </View>
      <View style={styles.settingControl}>
        {children}
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg.base
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: SPACING.md
  },
  card: {
    marginBottom: SPACING.md
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm
  },
  statusLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary
  },
  statusValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: "600"
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  settingText: {
    flex: 1,
    marginRight: SPACING.md
  },
  settingLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary
  },
  settingDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted,
    marginTop: 2
  },
  settingControl: {},
  input: {
    marginBottom: SPACING.md
  },
  actionButton: {
    marginBottom: SPACING.sm
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.xs
  },
  aboutLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted
  },
  aboutValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary
  }
});

export { SettingsScreen };
export default SettingsScreen;