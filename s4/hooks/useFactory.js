// s4/hooks/useFactory.js
// ALX Factory - Factory Hook
// Version: 1.0.2

import { useState, useEffect, useCallback } from "react";
import { useOrchestrator } from "./useOrchestrator.js";
import { useBuildEvents } from "./useEventBus.js";

var FACTORY_STATE = {
  OFFLINE: "OFFLINE",
  BOOTING: "BOOTING",
  READY: "READY",
  BUILDING: "BUILDING",
  STOPPING: "STOPPING",
  ERROR: "ERROR"
};

function useFactory(orchestratorRef) {
  var orchestrator = useOrchestrator(orchestratorRef);
  var buildEvents = useBuildEvents(orchestratorRef);

  var factoryStatusState = useState(null);
  var factoryStatus = factoryStatusState[0];
  var setFactoryStatus = factoryStatusState[1];

  var artifactsState = useState([]);
  var artifacts = artifactsState[0];
  var setArtifacts = artifactsState[1];

  useEffect(function() {
    if (!orchestrator.status) {
      setFactoryStatus(null);
      return;
    }

    var status = orchestrator.status;

    setFactoryStatus({
      connected: status.factoryConnected || false,
      state: status.factory ? status.factory.state : FACTORY_STATE.OFFLINE,
      stats: status.factory || null,
      workers: status.factory ? status.factory.workers : [],
      activeJobs: status.factory ? status.factory.activeJobs : 0,
      completedJobs: status.factory ? status.factory.completedJobs : 0
    });
  }, [orchestrator.status, setFactoryStatus]);

  var refreshArtifacts = useCallback(async function(limit) {
    var seeds = await orchestrator.querySeeds({ limit: limit || 20 });
    setArtifacts(seeds);
    return seeds;
  }, [orchestrator, setArtifacts]);

  var submitBuild = useCallback(async function(input, options) {
    var buildCommand = "build " + (options && options.projectName ? options.projectName : "");
    
    if (typeof input === "string") {
      buildCommand = buildCommand + "\n```\n" + input + "\n```";
    } else if (input && input.code) {
      buildCommand = buildCommand + "\n```\n" + input.code + "\n```";
    }

    var result = await orchestrator.execute(buildCommand.trim());

    if (result.ok) {
      setTimeout(function() {
        refreshArtifacts();
      }, 500);
    }

    return result;
  }, [orchestrator, refreshArtifacts]);

  var getJob = useCallback(function(jobId) {
    if (buildEvents.currentBuild && buildEvents.currentBuild.id === jobId) {
      return buildEvents.currentBuild;
    }

    var artifact = artifacts.find(function(a) {
      return a.id === jobId || (a.metadata && a.metadata.buildId === jobId);
    });

    if (artifact) {
      return {
        id: artifact.id,
        status: "completed",
        artifact: artifact
      };
    }

    return null;
  }, [buildEvents.currentBuild, artifacts]);

  useEffect(function() {
    refreshArtifacts();
  }, [refreshArtifacts]);

  return {
    factoryStatus: factoryStatus,
    isConnected: factoryStatus && factoryStatus.connected,
    isReady: factoryStatus && factoryStatus.state === FACTORY_STATE.READY,
    isBuilding: factoryStatus && factoryStatus.state === FACTORY_STATE.BUILDING,
    currentBuild: buildEvents.currentBuild,
    buildProgress: buildEvents.currentBuild ? buildEvents.currentBuild.progress : 0,
    artifacts: artifacts,
    refreshArtifacts: refreshArtifacts,
    submitBuild: submitBuild,
    getJob: getJob,
    buildEvents: buildEvents.events,
    execute: orchestrator.execute,
    loading: orchestrator.loading,
    error: orchestrator.error,
    refreshStatus: orchestrator.refreshStatus
  };
}

export { useFactory, FACTORY_STATE };
export default useFactory;