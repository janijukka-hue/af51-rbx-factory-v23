// ui/hooks/useFactory.js
// Factory connection hook - React Native

import { useState, useCallback, useEffect, useRef } from "react";

export function useFactory(factory) {
  const [status, setStatus] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [manifest, setManifest] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [trace, setTrace] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastError, setLastError] = useState(null);

  const addLog = useCallback((level, message, data = null) => {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      message,
      data
    };
    setLogs((prev) => [entry, ...prev].slice(0, 500));
  }, []);

  const refreshStatus = useCallback(() => {
    if (!factory) return;
    try {
      const factoryStatus = factory.getStatus();
      setStatus(factoryStatus);
      setMetrics({
        uptimeMs: factoryStatus.uptimeMs,
        queueSize: factoryStatus.memory?.queue?.queueLength || 0,
        runningJobs: factoryStatus.memory?.queue?.runningCount || 0,
        artifactCount: factoryStatus.memory?.vault?.count || 0,
        auditCount: factoryStatus.memory?.audit?.count || 0,
        energyUsed: factoryStatus.memory?.energy?.totalMs || 0
      });
    } catch (err) {
      setLastError(err.message);
    }
  }, [factory]);

  const runBuild = useCallback(async (files, metadata = {}) => {
    if (!factory) return null;
    setIsRunning(true);
    setLastError(null);
    try {
      const result = await factory.handleCommand({
        intent: "BUILD",
        files,
        metadata
      });
      refreshStatus();
      setIsRunning(false);
      if (result.ok) {
        setArtifacts((prev) => [...result.artifacts, ...prev].slice(0, 100));
        if (result.snapshot?.phaseResults?.PLAN?.manifest) {
          setManifest(result.snapshot.phaseResults.PLAN.manifest);
        }
      } else {
        setLastError(result.error?.message || "Build failed");
      }
      return result;
    } catch (err) {
      setIsRunning(false);
      setLastError(err.message);
      return { ok: false, error: err };
    }
  }, [factory, refreshStatus]);

  const runBuildAndPublish = useCallback(async (files, metadata = {}, channels = []) => {
    if (!factory) return null;
    setIsRunning(true);
    setLastError(null);
    try {
      const result = await factory.handleCommand({
        intent: "BUILD_AND_PUBLISH",
        files,
        metadata,
        options: { channels }
      });
      refreshStatus();
      setIsRunning(false);
      if (result.ok) {
        setArtifacts((prev) => [...result.artifacts, ...prev].slice(0, 100));
      } else {
        setLastError(result.error?.message || "Build and publish failed");
      }
      return result;
    } catch (err) {
      setIsRunning(false);
      setLastError(err.message);
      return { ok: false, error: err };
    }
  }, [factory, refreshStatus]);

  const publish = useCallback(async (channels = ["LOCAL"]) => {
    if (!factory) return null;
    setIsRunning(true);
    setLastError(null);
    try {
      const result = await factory.handleCommand({
        intent: "PUBLISH",
        options: { channels }
      });
      refreshStatus();
      setIsRunning(false);
      if (!result.ok) {
        setLastError(result.error?.message || "Publish failed");
      }
      return result;
    } catch (err) {
      setIsRunning(false);
      setLastError(err.message);
      return { ok: false, error: err };
    }
  }, [factory, refreshStatus]);

  const stopCurrentJob = useCallback(() => {
    addLog("WARN", "Stop not implemented - jobs run to completion");
  }, [addLog]);

  const clearQueue = useCallback(() => {
    if (!factory) return;
    addLog("INFO", "Queue clear requested");
    refreshStatus();
  }, [factory, refreshStatus, addLog]);

  const pruneArtifacts = useCallback(async () => {
    if (!factory) return;
    const result = await factory.handleCommand({ intent: "PRUNE_ARTIFACTS" });
    refreshStatus();
    return result;
  }, [factory, refreshStatus]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    if (!factory) return;
    const eventBus = factory.getEventBus();
    if (!eventBus) return;
    const unsubscribe = eventBus.subscribeAll((event) => {
      setTrace((prev) => [{
        id: event.id,
        type: event.type,
        timestamp: event.timestamp,
        payload: event.payload
      }, ...prev].slice(0, 200));
      if (event.type.includes("FAILED") || event.type.includes("ERROR")) {
        addLog("ERROR", event.type, event.payload);
      } else if (event.type.includes("COMPLETED") || event.type.includes("STARTED")) {
        addLog("INFO", event.type, event.payload);
      }
    });
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [factory, addLog]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    status, jobs, logs, artifacts, manifest, metrics, trace, isRunning, lastError,
    runBuild, runBuildAndPublish, publish, stopCurrentJob, clearQueue,
    pruneArtifacts, clearLogs, refreshStatus, addLog
  };
}

export default useFactory;