// s4/hooks/useLogStream.js
// ALX Factory - Log Stream Hook
// Version: 1.0.0

import { useState, useEffect, useCallback, useRef } from "react";
import { createLogService, LOG_LEVEL, LOG_SOURCE } from "../services/LogService.js";

function useLogStream(orchestrator, options) {
  var opts = options || {};
  var initialLimit = opts.limit || 100;
  var autoConnect = opts.autoConnect !== false;

  var logsState = useState([]);
  var logs = logsState[0];
  var setLogs = logsState[1];

  var filtersState = useState({
    level: null,
    source: null,
    search: "",
    buildId: null
  });
  var filters = filtersState[0];
  var setFilters = filtersState[1];

  var statsState = useState({
    total: 0,
    byLevel: {},
    bySource: {}
  });
  var stats = statsState[0];
  var setStats = statsState[1];

  var connectedState = useState(false);
  var connected = connectedState[0];
  var setConnected = connectedState[1];

  var pausedState = useState(false);
  var paused = pausedState[0];
  var setPaused = pausedState[1];

  var logServiceRef = useRef(null);
  var limitRef = useRef(initialLimit);

  useEffect(function() {
    if (!orchestrator) return;

    var service = createLogService(orchestrator);
    logServiceRef.current = service;

    if (autoConnect) {
      var didConnect = service.connect();
      setConnected(didConnect);
    }

    var unsubscribe = service.subscribe(function(entry) {
      if (!paused) {
        setLogs(function(prev) {
          var updated = [entry].concat(prev);
          if (updated.length > limitRef.current) {
            updated = updated.slice(0, limitRef.current);
          }
          return updated;
        });

        setStats(service.getStats());
      }
    });

    var initialLogs = service.getLogs({ limit: limitRef.current });
    setLogs(initialLogs);
    setStats(service.getStats());

    return function() {
      unsubscribe();
      service.disconnect();
      logServiceRef.current = null;
    };
  }, [orchestrator, autoConnect, paused, setLogs, setStats, setConnected]);

  var connect = useCallback(function() {
    if (logServiceRef.current) {
      var didConnect = logServiceRef.current.connect();
      setConnected(didConnect);
      return didConnect;
    }
    return false;
  }, [setConnected]);

  var disconnect = useCallback(function() {
    if (logServiceRef.current) {
      logServiceRef.current.disconnect();
      setConnected(false);
    }
  }, [setConnected]);

  var setFilter = useCallback(function(key, value) {
    setFilters(function(prev) {
      return { ...prev, [key]: value };
    });
  }, [setFilters]);

  var clearFilters = useCallback(function() {
    setFilters({
      level: null,
      source: null,
      search: "",
      buildId: null
    });
  }, [setFilters]);

  var clearLogs = useCallback(function() {
    if (logServiceRef.current) {
      logServiceRef.current.clearLogs();
    }
    setLogs([]);
    setStats({ total: 0, byLevel: {}, bySource: {} });
  }, [setLogs, setStats]);

  var pause = useCallback(function() {
    setPaused(true);
  }, [setPaused]);

  var resume = useCallback(function() {
    setPaused(false);
  }, [setPaused]);

  var togglePause = useCallback(function() {
    setPaused(function(prev) { return !prev; });
  }, [setPaused]);

  var exportLogs = useCallback(function(exportOptions) {
    if (logServiceRef.current) {
      return logServiceRef.current.exportLogs(exportOptions || filters);
    }
    return "";
  }, [filters]);

  var getLogsByBuild = useCallback(function(buildId, limit) {
    if (logServiceRef.current) {
      return logServiceRef.current.getLogsByBuild(buildId, limit);
    }
    return [];
  }, []);

  var setLimit = useCallback(function(newLimit) {
    limitRef.current = newLimit;
    if (logServiceRef.current) {
      var refreshedLogs = logServiceRef.current.getLogs({ limit: newLimit, ...filters });
      setLogs(refreshedLogs);
    }
  }, [filters, setLogs]);

  var filteredLogs = logs.filter(function(log) {
    if (filters.level && log.level !== filters.level) {
      return false;
    }

    if (filters.source && log.source !== filters.source) {
      return false;
    }

    if (filters.buildId && log.buildId !== filters.buildId) {
      return false;
    }

    if (filters.search) {
      var searchLower = filters.search.toLowerCase();
      var messageMatch = log.message.toLowerCase().indexOf(searchLower) !== -1;
      var typeMatch = log.type.toLowerCase().indexOf(searchLower) !== -1;
      if (!messageMatch && !typeMatch) {
        return false;
      }
    }

    return true;
  });

  return {
    logs: filteredLogs,
    allLogs: logs,
    stats: stats,
    filters: filters,
    connected: connected,
    paused: paused,
    connect: connect,
    disconnect: disconnect,
    setFilter: setFilter,
    clearFilters: clearFilters,
    clearLogs: clearLogs,
    pause: pause,
    resume: resume,
    togglePause: togglePause,
    exportLogs: exportLogs,
    getLogsByBuild: getLogsByBuild,
    setLimit: setLimit,
    LOG_LEVEL: LOG_LEVEL,
    LOG_SOURCE: LOG_SOURCE
  };
}

export { useLogStream, LOG_LEVEL, LOG_SOURCE };
export default useLogStream;