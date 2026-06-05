// s4/screens/JobDetails/JobDetailsScreen.js
// ALX Factory - Job Details Screen
// Version: 1.0.0

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../theme/colors.js";
import { TYPOGRAPHY } from "../../theme/typography.js";
import { SPACING, RADIUS } from "../../theme/spacing.js";
import { Card } from "../../components/common/Card.js";
import { Badge, BADGE_VARIANT } from "../../components/common/Badge.js";
import { ProgressBar, PROGRESS_VARIANT } from "../../components/common/ProgressBar.js";
import { StatusIndicator, STATUS } from "../../components/common/StatusIndicator.js";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "../../components/common/Button.js";
import { PipelineProgress, STAGE_STATUS } from "../../components/factory/PipelineProgress.js";
import { EnergyMeter } from "../../components/factory/EnergyMeter.js";
import { LogEntryList } from "../../components/logs/LogEntryCard.js";
import { CodeBlock } from "../../components/data/CodeBlock.js";
import { useFactory } from "../../hooks/useFactory.js";
import { useLogStream } from "../../hooks/useLogStream.js";
// Enterprise UI Object Layer panels — all read the FactoryUIOlio snapshot via
// useFactoryUI selectors. No raw pipeline/build-result access here.
import {
  BuildConsolePanel, ArtifactStatusPanel, RingStatusPanel,
  HierarchyPanel, InspectorPanel, ViewportPanel
} from "../../components/factoryui/index.js";
import { formatDuration, formatRelativeTime } from "../../utils/formatters.js";

function JobDetailsScreen(props) {
  var route = props.route;
  var navigation = props.navigation;
  var orchestrator = props.orchestrator;

  var jobId = route && route.params ? route.params.jobId : null;

  var factory = useFactory(orchestrator);
  var logStream = useLogStream(orchestrator);

  var refreshingState = useState(false);
  var refreshing = refreshingState[0];
  var setRefreshing = refreshingState[1];

  // v11: Factory UI (Enterprise UI Object Layer) is the default tab so the
  // user sees the new UI Ring layer first after a successful build. Legacy
  // Overview/Logs/Output remain available as fallback (slated for v12 cleanup
  // only once Factory UI demonstrably shows the same data better).
  var activeTabState = useState("factoryui");
  var activeTab = activeTabState[0];
  var setActiveTab = activeTabState[1];

  var jobState = useState(null);
  var job = jobState[0];
  var setJob = jobState[1];

  useEffect(function() {
    if (jobId) {
      var foundJob = factory.getJob(jobId);
      setJob(foundJob);
    }
  }, [jobId, factory, setJob]);

  var jobLogs = logStream.getLogsByBuild(jobId, 100);

  var onRefresh = useCallback(async function() {
    setRefreshing(true);
    await factory.refreshArtifacts();
    if (jobId) {
      var refreshedJob = factory.getJob(jobId);
      setJob(refreshedJob);
    }
    setRefreshing(false);
  }, [factory, jobId, setJob, setRefreshing]);

  function handleGoBack() {
    if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={handleGoBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Job Details</Text>
        </View>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundIcon}>🔍</Text>
          <Text style={styles.notFoundText}>Job not found</Text>
          <Text style={styles.notFoundHint}>
            The job may have been deleted or does not exist
          </Text>
          <Button
            variant={BUTTON_VARIANT.OUTLINE}
            onPress={handleGoBack}
            style={styles.notFoundButton}
          >
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  var statusVariant = job.status === "completed" ? BADGE_VARIANT.SUCCESS :
                      job.status === "failed" ? BADGE_VARIANT.ERROR :
                      job.status === "running" ? BADGE_VARIANT.WARNING :
                      BADGE_VARIANT.DEFAULT;

  var statusIndicator = job.status === "completed" ? STATUS.SUCCESS :
                        job.status === "failed" ? STATUS.ERROR :
                        job.status === "running" ? STATUS.BUILDING :
                        STATUS.IDLE;

  var artifact = job.artifact || null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={handleGoBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {artifact ? artifact.title || artifact.name : "Job " + jobId}
          </Text>
          <Badge variant={statusVariant} label={job.status} size="sm" />
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton
          label="Overview"
          active={activeTab === "overview"}
          onPress={function() { setActiveTab("overview"); }}
        />
        <TabButton
          label="Logs"
          active={activeTab === "logs"}
          onPress={function() { setActiveTab("logs"); }}
          badge={jobLogs.length}
        />
        <TabButton
          label="Output"
          active={activeTab === "output"}
          onPress={function() { setActiveTab("output"); }}
        />
        <TabButton
          label="Factory UI"
          active={activeTab === "factoryui"}
          onPress={function() { setActiveTab("factoryui"); }}
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {activeTab === "overview" && (
          <OverviewTab job={job} artifact={artifact} />
        )}

        {activeTab === "logs" && (
          <LogsTab logs={jobLogs} />
        )}

        {activeTab === "output" && (
          <OutputTab artifact={artifact} />
        )}

        {activeTab === "factoryui" && (
          <FactoryUITab job={job} onDownload={function () {
            // reuse the existing artifact path — refresh pulls/serves the zip
            onRefresh();
          }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton(props) {
  var label = props.label;
  var active = props.active;
  var onPress = props.onPress;
  var badge = props.badge;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
      {badge > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
      {active && <View style={styles.tabIndicator} />}
    </Pressable>
  );
}

function OverviewTab(props) {
  var job = props.job;
  var artifact = props.artifact;

  var duration = 0;
  if (job.startedAt) {
    var endTime = job.completedAt || job.failedAt || new Date().toISOString();
    duration = new Date(endTime).getTime() - new Date(job.startedAt).getTime();
  }

  var stageStatuses = {};
  if (job.stages) {
    job.stages.forEach(function(stage) {
      stageStatuses[stage] = STAGE_STATUS.COMPLETED;
    });
  }

  var currentStageIndex = job.stages ? job.stages.length : 0;

  return (
    <View>
      <Card title="Status" style={styles.card}>
        <View style={styles.statusRow}>
          <StatusIndicator
            status={job.status === "running" ? STATUS.BUILDING : 
                   job.status === "completed" ? STATUS.SUCCESS : 
                   job.status === "failed" ? STATUS.ERROR : STATUS.IDLE}
            label={job.status}
            pulse={job.status === "running"}
            size="lg"
          />
        </View>

        {job.status === "running" && (
          <ProgressBar
            progress={job.progress || 0}
            variant={PROGRESS_VARIANT.PRIMARY}
            showLabel
            style={styles.progressBar}
          />
        )}
      </Card>

      <Card title="Pipeline" style={styles.card}>
        <PipelineProgress
          currentStage={currentStageIndex}
          stageStatuses={stageStatuses}
        />
      </Card>

      <Card title="Details" style={styles.card}>
        <DetailRow label="Job ID" value={job.id} />
        
        {job.startedAt && (
          <DetailRow
            label="Started"
            value={formatRelativeTime(job.startedAt)}
          />
        )}

        {job.completedAt && (
          <DetailRow
            label="Completed"
            value={formatRelativeTime(job.completedAt)}
          />
        )}

        {duration > 0 && (
          <DetailRow
            label="Duration"
            value={formatDuration(duration)}
          />
        )}

        {artifact && (
          <>
            <DetailRow label="Type" value={artifact.seedType || "CALM"} />
            <DetailRow label="Language" value={artifact.language || "javascript"} />
          </>
        )}
      </Card>

      {artifact && (
        <Card title="Energy" style={styles.card}>
          <EnergyMeter
            energy={artifact.energy || 50}
            maxEnergy={100}
            showValue
            size="lg"
          />
        </Card>
      )}

      {job.error && (
        <Card title="Error" style={styles.errorCard}>
          <Text style={styles.errorText}>{job.error}</Text>
        </Card>
      )}
    </View>
  );
}

function DetailRow(props) {
  var label = props.label;
  var value = props.value;

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function LogsTab(props) {
  var logs = props.logs || [];

  return (
    <View>
      <LogEntryList
        logs={logs}
        emptyMessage="No logs for this job"
        showPayload
      />
    </View>
  );
}

function OutputTab(props) {
  var artifact = props.artifact;

  if (!artifact) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📄</Text>
        <Text style={styles.emptyText}>No output yet</Text>
        <Text style={styles.emptyHint}>
          Output will appear when the build completes
        </Text>
      </View>
    );
  }

  return (
    <View>
      {artifact.code && (
        <Card title="Generated Code" style={styles.card}>
          <CodeBlock
            code={artifact.code}
            language={artifact.language || "javascript"}
            showLineNumbers
            maxHeight={400}
          />
        </Card>
      )}

      {artifact.files && artifact.files.length > 0 && (
        <Card title="Files" style={styles.card}>
          {artifact.files.map(function(file, index) {
            return (
              <View key={index} style={styles.fileRow}>
                <Text style={styles.fileIcon}>📄</Text>
                <Text style={styles.fileName}>{file.path || file.name}</Text>
                <Text style={styles.fileSize}>
                  {file.size ? file.size + " B" : ""}
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      {artifact.metadata && (
        <Card title="Metadata" style={styles.card}>
          <CodeBlock
            code={JSON.stringify(artifact.metadata, null, 2)}
            language="json"
            maxHeight={200}
          />
        </Card>
      )}
    </View>
  );
}

// ── Factory UI tab — the Enterprise UI Object Layer made visible ──────────
// Lays out the six panels. Each panel reads the FactoryUIOlio snapshot through
// its own selector (useFactoryUI/useAppState), so this tab only composes them;
// it does not read the raw build result. The artifact download reuses the
// existing handler passed in via props.onDownload.
function FactoryUITab(props) {
  return (
    <View style={styles.factoryUiTab}>
      <BuildConsolePanel style={styles.panel} />
      <ArtifactStatusPanel style={styles.panel} onDownload={props.onDownload} />
      <RingStatusPanel style={styles.panel} />
      <ViewportPanel style={styles.panel} />
      <HierarchyPanel style={styles.panel} />
      <InspectorPanel style={styles.panel} />
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg.base
  },
  factoryUiTab: {
    paddingBottom: SPACING.lg
  },
  panel: {
    marginBottom: SPACING.md
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm
  },
  backIcon: {
    fontSize: 24,
    color: COLORS.text.primary
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center"
  },
  headerTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    marginRight: SPACING.sm,
    flex: 1
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    position: "relative"
  },
  tabButtonActive: {},
  tabLabel: {
    ...TYPOGRAPHY.button,
    color: COLORS.text.muted
  },
  tabLabelActive: {
    color: COLORS.primary
  },
  tabBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SPACING.xs,
    paddingHorizontal: 4
  },
  tabBadgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "700"
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "25%",
    right: "25%",
    height: 2,
    backgroundColor: COLORS.primary
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
    alignItems: "center"
  },
  progressBar: {
    marginTop: SPACING.md
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  detailLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted
  },
  detailValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: "500"
  },
  errorCard: {
    marginBottom: SPACING.md,
    borderColor: COLORS.status.error,
    borderWidth: 1
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.status.error
  },
  emptyContainer: {
    alignItems: "center",
    padding: SPACING.xxl
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md
  },
  emptyText: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs
  },
  emptyHint: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.muted
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle
  },
  fileIcon: {
    fontSize: 14,
    marginRight: SPACING.sm
  },
  fileName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    flex: 1
  },
  fileSize: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl
  },
  notFoundIcon: {
    fontSize: 64,
    marginBottom: SPACING.md
  },
  notFoundText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs
  },
  notFoundHint: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted,
    textAlign: "center",
    marginBottom: SPACING.lg
  },
  notFoundButton: {
    minWidth: 120
  }
});

export { JobDetailsScreen };
export default JobDetailsScreen;