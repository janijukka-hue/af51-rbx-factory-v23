// s4/services/LogService.js
// ALX Factory - Log Service
// Version: 1.0.0
// Real-time log streaming via m2 Orchestrator

var LOG_LEVEL = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error"
};

var LOG_SOURCE = {
  KERNEL: "kernel",
  ORCHESTRATOR: "orchestrator",
  FACTORY: "factory",
  WORKER: "worker",
  BUILD: "build",
  SYSTEM: "system"
};

function createLogService(orchestrator) {
  var listeners = [];
  var logBuffer = [];
  var maxBufferSize = 1000;
  var isConnected = false;
  var unsubscribes = [];

  function connect() {
    if (isConnected || !orchestrator) {
      return false;
    }

    if (typeof orchestrator.on === "function") {
      var unsubAll = orchestrator.on("*", function(event) {
        handleEvent(event);
      });
      if (unsubAll) {
        unsubscribes.push(unsubAll);
      }
    }

    var alx = orchestrator.getALX ? orchestrator.getALX() : null;
    var eventBus = alx && alx._eventBus ? alx._eventBus : null;

    if (eventBus && typeof eventBus.on === "function") {
      var unsubBus = eventBus.on("*", function(event) {
        handleEvent(event);
      });
      if (unsubBus) {
        unsubscribes.push(unsubBus);
      }
    }

    isConnected = true;
    addSystemLog("info", "Log service connected");

    return true;
  }

  function disconnect() {
    unsubscribes.forEach(function(unsub) {
      if (typeof unsub === "function") {
        unsub();
      }
    });
    unsubscribes = [];
    isConnected = false;
    addSystemLog("info", "Log service disconnected");
  }

  function handleEvent(event) {
    var logEntry = eventToLogEntry(event);
    if (logEntry) {
      addLog(logEntry);
    }
  }

  function eventToLogEntry(event) {
    var type = event.type || event;
    var payload = event.payload || {};

    var level = LOG_LEVEL.INFO;
    var source = LOG_SOURCE.SYSTEM;
    var message = "";

    if (type.indexOf("error") !== -1 || type.indexOf("failed") !== -1) {
      level = LOG_LEVEL.ERROR;
    } else if (type.indexOf("warn") !== -1) {
      level = LOG_LEVEL.WARN;
    } else if (type.indexOf("debug") !== -1) {
      level = LOG_LEVEL.DEBUG;
    }

    if (type.indexOf("kernel") !== -1 || type.indexOf("k1") !== -1) {
      source = LOG_SOURCE.KERNEL;
    } else if (type.indexOf("orchestrator") !== -1 || type.indexOf("m2") !== -1) {
      source = LOG_SOURCE.ORCHESTRATOR;
    } else if (type.indexOf("factory") !== -1 || type.indexOf("t3") !== -1) {
      source = LOG_SOURCE.FACTORY;
    } else if (type.indexOf("worker") !== -1) {
      source = LOG_SOURCE.WORKER;
    } else if (type.indexOf("build") !== -1) {
      source = LOG_SOURCE.BUILD;
    }

    if (type === "factory:build:started") {
      message = "Build started: " + (payload.buildId || "unknown");
    } else if (type === "factory:build:completed") {
      message = "Build completed: " + (payload.buildId || "unknown");
      if (payload.durationMs) {
        message += " (" + payload.durationMs + "ms)";
      }
    } else if (type === "factory:build:failed") {
      message = "Build failed: " + (payload.error || "unknown error");
    } else if (type === "factory:build:progress") {
      message = "Build progress: " + (payload.progress || 0) + "%";
    } else if (type === "factory:stage:started") {
      message = "Stage started: " + (payload.stage || "unknown");
    } else if (type === "factory:stage:completed") {
      message = "Stage completed: " + (payload.stage || "unknown");
    } else if (type === "factory:stage:failed") {
      message = "Stage failed: " + (payload.stage || "unknown") + " - " + (payload.error || "");
    } else if (type === "factory:worker:started") {
      message = "Worker started: " + (payload.workerId || "unknown");
    } else if (type === "factory:worker:completed") {
      message = "Worker completed: " + (payload.workerId || "unknown");
    } else if (type === "factory:artifact:created") {
      message = "Artifact created: " + (payload.artifactId || payload.name || "unknown");
    } else if (type === "orchestrator:command:completed") {
      message = "Command completed: " + (payload.intent || "unknown");
    } else if (type === "orchestrator:error") {
      message = "Orchestrator error: " + (payload.error || payload.message || "unknown");
    } else {
      message = type;
      if (payload.message) {
        message += ": " + payload.message;
      }
    }

    return {
      id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      level: level,
      source: source,
      type: type,
      message: message,
      payload: payload,
      buildId: payload.buildId || null,
      stage: payload.stage || null
    };
  }

  function addLog(entry) {
    logBuffer.unshift(entry);

    if (logBuffer.length > maxBufferSize) {
      logBuffer = logBuffer.slice(0, maxBufferSize);
    }

    notifyListeners(entry);
  }

  function addSystemLog(level, message) {
    var entry = {
      id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      level: level,
      source: LOG_SOURCE.SYSTEM,
      type: "system:log",
      message: message,
      payload: {},
      buildId: null,
      stage: null
    };

    addLog(entry);
  }

  function notifyListeners(entry) {
    listeners.forEach(function(listener) {
      try {
        listener(entry);
      } catch (err) {
        console.error("[LogService] Listener error:", err);
      }
    });
  }

  function subscribe(callback) {
    listeners.push(callback);

    return function unsubscribe() {
      var index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  function getLogs(options) {
    var opts = options || {};
    var limit = opts.limit || 100;
    var level = opts.level || null;
    var source = opts.source || null;
    var buildId = opts.buildId || null;
    var search = opts.search || null;
    var startTime = opts.startTime || null;
    var endTime = opts.endTime || null;

    var filtered = logBuffer.filter(function(log) {
      if (level && log.level !== level) {
        return false;
      }

      if (source && log.source !== source) {
        return false;
      }

      if (buildId && log.buildId !== buildId) {
        return false;
      }

      if (search) {
        var searchLower = search.toLowerCase();
        var messageMatch = log.message.toLowerCase().indexOf(searchLower) !== -1;
        var typeMatch = log.type.toLowerCase().indexOf(searchLower) !== -1;
        if (!messageMatch && !typeMatch) {
          return false;
        }
      }

      if (startTime) {
        var logTime = new Date(log.timestamp).getTime();
        var startMs = new Date(startTime).getTime();
        if (logTime < startMs) {
          return false;
        }
      }

      if (endTime) {
        var logTimeEnd = new Date(log.timestamp).getTime();
        var endMs = new Date(endTime).getTime();
        if (logTimeEnd > endMs) {
          return false;
        }
      }

      return true;
    });

    return filtered.slice(0, limit);
  }

  function getLogsByBuild(buildId, limit) {
    return getLogs({ buildId: buildId, limit: limit || 500 });
  }

  function clearLogs() {
    logBuffer = [];
    addSystemLog("info", "Logs cleared");
  }

  function getStats() {
    var stats = {
      total: logBuffer.length,
      byLevel: {},
      bySource: {}
    };

    Object.keys(LOG_LEVEL).forEach(function(key) {
      stats.byLevel[LOG_LEVEL[key]] = 0;
    });

    Object.keys(LOG_SOURCE).forEach(function(key) {
      stats.bySource[LOG_SOURCE[key]] = 0;
    });

    logBuffer.forEach(function(log) {
      if (stats.byLevel[log.level] !== undefined) {
        stats.byLevel[log.level]++;
      }
      if (stats.bySource[log.source] !== undefined) {
        stats.bySource[log.source]++;
      }
    });

    return stats;
  }

  function exportLogs(options) {
    var logs = getLogs(options);

    return logs.map(function(log) {
      return [
        log.timestamp,
        log.level.toUpperCase(),
        "[" + log.source + "]",
        log.message
      ].join(" ");
    }).join("\n");
  }

  return {
    connect: connect,
    disconnect: disconnect,
    subscribe: subscribe,
    getLogs: getLogs,
    getLogsByBuild: getLogsByBuild,
    clearLogs: clearLogs,
    getStats: getStats,
    exportLogs: exportLogs,
    addSystemLog: addSystemLog,
    isConnected: function() { return isConnected; },
    LOG_LEVEL: LOG_LEVEL,
    LOG_SOURCE: LOG_SOURCE
  };
}

export { createLogService, LOG_LEVEL, LOG_SOURCE };
export default createLogService;