// s4/screens/JobsQueue/JobsQueueScreen.js
// ALX Factory - Jobs Queue Screen
// Version: 1.1.0 - Added navigation to JobDetails

import React, { useState, useCallback } from "react";
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
import { SPACING } from "../../theme/spacing.js";
import { ROUTES } from "../../navigation/routes.js";
import { Card } from "../../components/common/Card.js";
import { Badge, BADGE_VARIANT } from "../../components/common/Badge.js";
import { ProgressBar, PROGRESS_VARIANT } from "../../components/common/ProgressBar.js";
import { StatusIndicator, STATUS } from "../../components/common/StatusIndicator.js";
import { useFactory } from "../../hooks/useFactory.js";
import { useBuildEvents } from "../../hooks/useEventBus.js";

function JobsQueueScreen(props) {
  var orchestrator = props.orchestrator;
  var navigation = props.navigation;

  var factory = useFactory(orchestrator);
  var buildEvents = useBuildEvents(orchestrator);

  var refreshingState = useState(false);
  var refreshing = refreshingState[0];
  var setRefreshing = refreshingState[1];

  var onRefresh = useCallback(async function() {
    setRefreshing(true);
    await factory.refreshArtifacts();
    setRefreshing(false);
  }, [factory, setRefreshing]);

  var currentBuild = buildEvents.currentBuild;

  var recentJobs = factory.artifacts.slice(0, 10).map(function(artifact) {
    return {
      id: artifact.id,
      name: artifact.title || artifact.name,
      status: "completed",
      completedAt: artifact.createdAt,
      duration: artifact.durationMs || 0
    };
  });

  function handleJobPress(jobId) {
    if (navigation) {
      navigation.navigate(ROUTES.JOB_DETAILS, { jobId: jobId });
    }
  }

  function handleCurrentBuildPress() {
    if (currentBuild && navigation) {
      navigation.navigate(ROUTES.JOB_DETAILS, { jobId: currentBuild.id });
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jobs Queue</Text>
        {factory.isBuilding && (
          <Badge variant={BADGE_VARIANT.WARNING} label="Building" />
        )}
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
        {currentBuild && (
          <Pressable onPress={handleCurrentBuildPress}>
            <Card
              title="Current Build"
              variant="elevated"
              style={styles.currentBuildCard}
            >
              <View style={styles.currentBuild}>
                <StatusIndicator
                  status={currentBuild.status === "running" ? STATUS.BUILDING : STATUS.SUCCESS}
                  label={currentBuild.id}
                  pulse={currentBuild.status === "running"}
                />
                <ProgressBar
                  progress={currentBuild.progress || 0}
                  variant={PROGRESS_VARIANT.PRIMARY}
                  showLabel
                  style={styles.progressBar}
                />
                {currentBuild.stages && currentBuild.stages.length > 0 && (
                  <View style={styles.stagesContainer}>
                    <Text style={styles.stagesLabel}>Completed stages:</Text>
                    <Text style={styles.stagesText}>
                      {currentBuild.stages.join(" → ")}
                    </Text>
                  </View>
                )}
                <Text style={styles.tapHint}>Tap for details →</Text>
              </View>
            </Card>
          </Pressable>
        )}

        {!currentBuild && (
          <Card variant="outlined" style={styles.emptyCard}>
            <View style={styles.emptyContent}>
              <Text style={styles.emptyIcon}>🏭</Text>
              <Text style={styles.emptyText}>No active builds</Text>
              <Text style={styles.emptyHint}>
                Go to Command Center to start a build
              </Text>
            </View>
          </Card>
        )}

        <Text style={styles.sectionTitle}>Recent Jobs</Text>

        {recentJobs.length === 0 ? (
          <Card variant="outlined">
            <Text style={styles.noJobsText}>No completed jobs yet</Text>
          </Card>
        ) : (
          recentJobs.map(function(job) {
            return (
              <JobCard
                key={job.id}
                job={job}
                onPress={function() { handleJobPress(job.id); }}
              />
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function JobCard(props) {
  var job = props.job;
  var onPress = props.onPress;

  var statusVariant = job.status === "completed" ? BADGE_VARIANT.SUCCESS :
                      job.status === "failed" ? BADGE_VARIANT.ERROR :
                      job.status === "running" ? BADGE_VARIANT.WARNING :
                      BADGE_VARIANT.DEFAULT;

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.jobCard}>
        <View style={styles.jobHeader}>
          <Text style={styles.jobName} numberOfLines={1}>
            {job.name}
          </Text>
          <Badge variant={statusVariant} label={job.status} size="sm" />
        </View>
        
        <View style={styles.jobMeta}>
          <Text style={styles.jobMetaText}>
            {job.completedAt ? new Date(job.completedAt).toLocaleString() : ""}
          </Text>
          {job.duration > 0 && (
            <Text style={styles.jobMetaText}>
              {job.duration}ms
            </Text>
          )}
        </View>
      </Card>
    </Pressable>
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
  currentBuildCard: {
    marginBottom: SPACING.lg
  },
  currentBuild: {},
  progressBar: {
    marginTop: SPACING.md
  },
  stagesContainer: {
    marginTop: SPACING.md
  },
  stagesLabel: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.text.muted,
    marginBottom: SPACING.xs
  },
  stagesText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text.secondary
  },
  tapHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    marginTop: SPACING.sm,
    textAlign: "right"
  },
  emptyCard: {
    marginBottom: SPACING.lg
  },
  emptyContent: {
    alignItems: "center",
    padding: SPACING.lg
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
  sectionTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    marginBottom: SPACING.md
  },
  jobCard: {
    marginBottom: SPACING.sm
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  jobName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    flex: 1,
    marginRight: SPACING.sm
  },
  jobMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.xs
  },
  jobMetaText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.muted
  },
  noJobsText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.muted,
    textAlign: "center",
    padding: SPACING.lg
  }
});

export { JobsQueueScreen };
export default JobsQueueScreen;