// middleware/logger.js — v12
// Strukturoitu JSON-loggaus stdout/stderr:iin
// ALX_LOG_FORMAT=json (oletus) tai text
// ALX_LOG_LEVEL=debug | info (oletus) | error

var FORMAT = process.env.ALX_LOG_FORMAT || "json";
var LEVEL  = process.env.ALX_LOG_LEVEL  || "info";

function write(stream, entry) {
  if (FORMAT === "json") {
    stream.write(JSON.stringify(entry) + "\n");
  } else {
    var parts = [entry.ts, entry.type || "REQ", entry.requestId || "-"];
    if (entry.method) parts.push(entry.method, entry.url, entry.status, entry.durationMs + "ms");
    if (entry.error)  parts.push("ERR:" + entry.error);
    stream.write(parts.join(" ") + "\n");
  }
}

export function logRequest(requestId, method, url, status, durationMs) {
  write(process.stdout, {
    ts: new Date().toISOString(), type: "REQUEST",
    requestId, method, url, status, durationMs,
  });
}

export function logBuild(requestId, buildId, projectName, buildMode, sourceOrigin, status, durationMs) {
  write(process.stdout, {
    ts: new Date().toISOString(), type: "BUILD",
    requestId, buildId, projectName, buildMode, sourceOrigin, status, durationMs,
  });
}

export function logError(requestId, url, error, code) {
  write(process.stderr, {
    ts: new Date().toISOString(), type: "ERROR",
    requestId, url, error, code: code || "UNKNOWN",
  });
}

export function logInfo(message, extra) {
  if (LEVEL === "error") return;
  write(process.stdout, Object.assign(
    { ts: new Date().toISOString(), type: "INFO", message },
    extra || {}
  ));
}

export function logDebug(message, extra) {
  if (LEVEL !== "debug") return;
  write(process.stdout, Object.assign(
    { ts: new Date().toISOString(), type: "DEBUG", message },
    extra || {}
  ));
}

// Structured logging domains: PIPELINE EXPORT VAULT SECURITY AUDIT ERROR
