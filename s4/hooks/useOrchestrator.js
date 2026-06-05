// s4/hooks/useOrchestrator.js
// ALX Factory - Orchestrator Hook
// Version: 1.1.0 - lisätty getSeedDetails wrapper

import { useState, useEffect, useCallback, useRef } from "react";

function useOrchestrator(orchestratorRef) {
  var statusState = useState(null);
  var status = statusState[0];
  var setStatus = statusState[1];

  var loadingState = useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var errorState = useState(null);
  var error = errorState[0];
  var setError = errorState[1];

  var lastResultState = useState(null);
  var lastResult = lastResultState[0];
  var setLastResult = lastResultState[1];

  var pollIntervalRef = useRef(null);

  var getOrchestrator = useCallback(function() {
    if (!orchestratorRef) return null;
    if (typeof orchestratorRef === "function") return orchestratorRef();
    if (orchestratorRef.current) return orchestratorRef.current;
    return orchestratorRef;
  }, [orchestratorRef]);

  var refreshStatus = useCallback(function() {
    var orch = getOrchestrator();
    if (!orch) {
      setStatus(null);
      return;
    }

    try {
      var newStatus = orch.getStatus ? orch.getStatus() : null;
      setStatus(newStatus);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [getOrchestrator, setStatus, setError]);

  var execute = useCallback(async function(input, ctx) {
    var orch = getOrchestrator();
    if (!orch) {
      return { ok: false, error: "Orchestrator not available" };
    }

    setLoading(true);
    setError(null);

    try {
      var result = await orch.execute(input, ctx || {});
      setLastResult(result);
      setLoading(false);
      refreshStatus();
      return result;
    } catch (err) {
      var errorResult = { ok: false, error: err.message };
      setError(err.message);
      setLastResult(errorResult);
      setLoading(false);
      return errorResult;
    }
  }, [getOrchestrator, refreshStatus, setLoading, setError, setLastResult]);

  var querySeeds = useCallback(async function(options) {
    var orch = getOrchestrator();
    if (!orch || !orch.querySeeds) {
      return [];
    }

    try {
      return await orch.querySeeds(options || {});
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, [getOrchestrator, setError]);

  var getSeedDetails = useCallback(async function(id) {
    var orch = getOrchestrator();
    if (!orch || typeof orch.getSeedDetails !== "function") {
      return { ok: false, error: "getSeedDetails ei saatavilla" };
    }

    try {
      return await orch.getSeedDetails(id);
    } catch (err) {
      setError(err.message);
      return { ok: false, error: err.message };
    }
  }, [getOrchestrator, setError]);

  var queryMemory = useCallback(async function(store, options) {
    var orch = getOrchestrator();
    if (!orch || !orch.queryMemory) {
      return [];
    }

    try {
      return await orch.queryMemory(store, options || {});
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, [getOrchestrator, setError]);

  var getSuggestions = useCallback(function(context) {
    var orch = getOrchestrator();
    if (!orch || !orch.getSuggestions) {
      return [];
    }

    try {
      return orch.getSuggestions(context || {});
    } catch (err) {
      return [];
    }
  }, [getOrchestrator]);

  var getSkills = useCallback(function() {
    var orch = getOrchestrator();
    if (!orch || !orch.getAllSkills) {
      return [];
    }

    try {
      return orch.getAllSkills();
    } catch (err) {
      return [];
    }
  }, [getOrchestrator]);

  var isRunning = useCallback(function() {
    var orch = getOrchestrator();
    return orch && orch.isRunning ? orch.isRunning() : false;
  }, [getOrchestrator]);

  var stopPolling = useCallback(function() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  var startPolling = useCallback(function(intervalMs) {
    stopPolling();
    pollIntervalRef.current = setInterval(refreshStatus, intervalMs || 2000);
  }, [refreshStatus, stopPolling]);

  useEffect(function() {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(function() {
    return function() {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    status: status,
    loading: loading,
    error: error,
    lastResult: lastResult,
    execute: execute,
    querySeeds: querySeeds,
    getSeedDetails: getSeedDetails,
    queryMemory: queryMemory,
    getSuggestions: getSuggestions,
    getSkills: getSkills,
    refreshStatus: refreshStatus,
    startPolling: startPolling,
    stopPolling: stopPolling,
    isRunning: isRunning,
    isReady: status && status.state === "RUNNING"
  };
}

export { useOrchestrator };
export default useOrchestrator;