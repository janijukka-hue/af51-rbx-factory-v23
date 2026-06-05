// ui/components/RightPanel/JobsTab.js
// React Native

import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, SIZES, FONTS } from "../../styles/theme.js";

const statusColors = {
  QUEUED: { bg: "rgba(74,158,255,0.2)", text: COLORS.info },
  RUNNING: { bg: "rgba(255,165,0,0.2)", text: COLORS.warning },
  DONE: { bg: "rgba(50,205,50,0.2)", text: COLORS.lime },
  FAILED: { bg: "rgba(255,68,68,0.2)", text: COLORS.error },
  ABORTED: { bg: "rgba(128,128,128,0.2)", text: COLORS.gray400 }
};

function formatTime(ts) {
  if (!ts) return "-";
  return new Date(ts).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function JobsTab({ jobs, onRetry }) {
  if (!jobs || jobs.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No jobs yet</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      {jobs.map((job) => {
        const colors = statusColors[job.status] || statusColors.QUEUED;
        return (
          <View key={job.id} style={styles.job}>
            <View style={styles.header}>
              <Text style={styles.jobId}>{job.id}</Text>
              <View style={[styles.status, { backgroundColor: colors.bg }]}>
                <Text style={[styles.statusText, { color: colors.text }]}>{job.status}</Text>
              </View>
            </View>
            <Text style={styles.jobType}>{job.type || job.intent || "BUILD"}</Text>
            <View style={styles.meta}>
              <Text style={styles.time}>{formatTime(job.startedAt || job.createdAt)}</Text>
              {job.durationMs && <Text style={styles.time}>{job.durationMs}ms</Text>}
            </View>
            {(job.status === "FAILED" || job.status === "ABORTED") && (
              <TouchableOpacity style={styles.retryButton} onPress={() => onRetry?.(job.id)}>
                <Text style={styles.retryText}>↻ Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SIZES.md
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyText: {
    color: COLORS.gray500,
    fontSize: 13
  },
  job: {
    backgroundColor: COLORS.blackLight,
    borderWidth: 1,
    borderColor: COLORS.gray700,
    borderRadius: SIZES.borderRadius,
    padding: SIZES.md,
    marginBottom: SIZES.sm
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SIZES.xs
  },
  jobId: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.gray400
  },
  status: {
    paddingVertical: 2,
    paddingHorizontal: SIZES.sm,
    borderRadius: SIZES.borderRadius
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600"
  },
  jobType: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.gray200
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SIZES.sm
  },
  time: {
    fontSize: 11,
    color: COLORS.gray500
  },
  retryButton: {
    backgroundColor: COLORS.gray700,
    borderRadius: SIZES.borderRadius,
    paddingVertical: SIZES.xs,
    paddingHorizontal: SIZES.sm,
    marginTop: SIZES.sm,
    alignSelf: "flex-start"
  },
  retryText: {
    color: COLORS.gray300,
    fontSize: 11
  }
});

export default JobsTab;