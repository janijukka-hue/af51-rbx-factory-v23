// ui/components/RightPanel/index.js
// React Native - Updated with all tabs

import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { COLORS } from "../../styles/theme.js";
import { TabBar } from "./TabBar.js";
import { JobsTab } from "./JobsTab.js";
import { LogsTab } from "./LogsTab.js";
import { ArtifactsTab } from "./ArtifactsTab.js";
import { ManifestTab } from "./ManifestTab.js";
import { MetricsTab } from "./MetricsTab.js";
import { TraceTab } from "./TraceTab.js";

const TABS = [
  { id: "jobs", label: "Jobs" },
  { id: "logs", label: "Logs" },
  { id: "artifacts", label: "Artifacts" },
  { id: "manifest", label: "Manifest" },
  { id: "metrics", label: "Metrics" },
  { id: "trace", label: "Trace" }
];

export function RightPanel({
  jobs,
  logs,
  artifacts,
  manifest,
  metrics,
  trace,
  status,
  onRetryJob,
  onClearLogs,
  onDownloadArtifact,
  onPublishArtifact
}) {
  const [activeTab, setActiveTab] = useState("jobs");
  
  const renderContent = () => {
    switch (activeTab) {
      case "jobs":
        return <JobsTab jobs={jobs} onRetry={onRetryJob} />;
      case "logs":
        return <LogsTab logs={logs} onClear={onClearLogs} />;
      case "artifacts":
        return <ArtifactsTab artifacts={artifacts} onDownload={onDownloadArtifact} onPublish={onPublishArtifact} />;
      case "manifest":
        return <ManifestTab manifest={manifest} />;
      case "metrics":
        return <MetricsTab metrics={metrics} status={status} />;
      case "trace":
        return <TraceTab trace={trace} />;
      default:
        return null;
    }
  };
  
  return (
    <View style={styles.container}>
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.blackMatte
  }
});

export default RightPanel;