// ui/futureMachine/useLiveRuntime.js
// AF51 FutureMachine — React hook that opens an SSE stream from
// /rbx/audit/stream/:buildId and feeds each PipelineAudit record into a
// RingRuntime via runtime.consume(record). The server paces delivery so
// ring segments animate phase by phase instead of jumping to all-done.
//
// Replay invariant: when the stream's `done` event fires, the runtime's
// snapshot is byte-identical to what useReplayedRuntime would produce
// for the same buildId — same records, same intent/ledger/energy/world
// metadata, same lastRecordAt stamps. The only difference is delivery
// timing. Read-only: never triggers builds.
//
// Usage:
//   const { snapshot, status, error, runtime, start, stop } =
//     useLiveRuntime({ server, buildId, token, pacingMs });
//
// - server   : optional base URL, defaults to "http://localhost:3000"
// - buildId  : the build trace identifier (e.g. "build_obby_0d8150c0")
// - token    : optional X-ALX-Token (only required in strict-auth mode)
// - pacingMs : optional server-side pacing between records (0–2000, default 80)
// - status   : "idle" | "streaming" | "done" | "error"
//
// Requires EventSource — works in Expo web; on native, prefer
// useReplayedRuntime since react-native lacks a built-in EventSource.

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createRingRuntime } from "./RingRuntime.js";

var DEFAULT_SERVER = "http://localhost:3000";

export function useLiveRuntime(opts) {
  opts = opts || {};
  var server   = opts.server   || DEFAULT_SERVER;
  var buildId  = opts.buildId  || null;
  var token    = opts.token    || null;
  var pacingMs = (typeof opts.pacingMs === "number") ? opts.pacingMs : 80;

  var runtime = useMemo(function () { return createRingRuntime(); }, []);

  var snapshotState = useState(function () { return runtime.snapshot(); });
  var snapshot = snapshotState[0];
  var setSnapshot = snapshotState[1];

  var statusState = useState("idle");
  var status = statusState[0];
  var setStatus = statusState[1];

  var errorState = useState(null);
  var error = errorState[0];
  var setError = errorState[1];

  var esRef = useRef(null);

  var stop = useCallback(function () {
    if (esRef.current) {
      try { esRef.current.close(); } catch (_) {}
      esRef.current = null;
    }
  }, []);

  var start = useCallback(function () {
    if (typeof EventSource === "undefined") {
      setError("EventSource not available in this environment");
      setStatus("error");
      return;
    }
    stop();
    runtime.replay([]);
    setSnapshot(runtime.snapshot());
    if (!buildId) {
      setStatus("idle");
      setError(null);
      return;
    }

    var qs = "";
    if (typeof pacingMs === "number") qs = "?pacingMs=" + Math.max(0, pacingMs | 0);
    // Token can't ride on EventSource as a header. If the server runs in
    // strict-auth mode, pass it via query string; the server accepts both.
    if (token) qs += (qs ? "&" : "?") + "token=" + encodeURIComponent(token);
    var url = server + "/rbx/audit/stream/" + encodeURIComponent(buildId) + qs;

    setStatus("streaming");
    setError(null);

    var es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("meta", function (ev) {
      try {
        var m = JSON.parse(ev.data);
        // Static metadata first; consume() will overwrite _lastRecordAt as
        // records arrive, so apply* timestamps stay correct at the end.
        if (m.intent) runtime.applyIntent(m.intent);
        if (m.ledger) runtime.applyMemory(m.ledger);
        if (m.energy) runtime.applyEnergy(m.energy);
        if (m.world)  runtime.applyWorld(m.world);
        setSnapshot(runtime.snapshot());
      } catch (e) { /* skip malformed */ }
    });

    es.addEventListener("record", function (ev) {
      try {
        var rec = JSON.parse(ev.data);
        runtime.consume(rec);
        setSnapshot(runtime.snapshot());
      } catch (e) { /* skip malformed */ }
    });

    es.addEventListener("done", function () {
      // Re-apply static metadata so its events carry the FINAL lastRecordAt
      // (matches useReplayedRuntime's order: records first, then apply*).
      var s = runtime.snapshot();
      if (s.intent) runtime.applyIntent(s.intent);
      if (s.ledger) runtime.applyMemory(s.ledger);
      if (s.energy) runtime.applyEnergy(s.energy);
      if (s.world)  runtime.applyWorld(s.world);
      setSnapshot(runtime.snapshot());
      setStatus("done");
      stop();
    });

    es.addEventListener("error", function (ev) {
      // SSE "error" with no data → transport/close. Only surface if we
      // never reached "done"; otherwise stop() already cleaned up.
      var msg = null;
      if (ev && typeof ev.data === "string" && ev.data.length > 0) {
        try { msg = JSON.parse(ev.data).message || ev.data; } catch (_) { msg = ev.data; }
      }
      if (esRef.current) {
        setError(msg || "stream closed unexpectedly");
        setStatus("error");
        stop();
      }
    });
  }, [server, buildId, token, pacingMs, runtime, stop]);

  useEffect(function () {
    start();
    return stop;
  }, [start, stop]);

  return {
    runtime:  runtime,
    snapshot: snapshot,
    status:   status,
    error:    error,
    start:    start,
    stop:     stop,
  };
}

export default useLiveRuntime;
