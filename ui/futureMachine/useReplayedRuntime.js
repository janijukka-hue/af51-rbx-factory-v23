// ui/futureMachine/useReplayedRuntime.js
// AF51 FutureMachine — React hook that fetches a build's PipelineAudit and
// replays it into a RingRuntime. Read-only: never triggers builds.
//
// Usage:
//   const { snapshot, loading, error, refresh, runtime } =
//     useReplayedRuntime({ server, buildId, token });
//
// - server  : optional base URL, defaults to "http://localhost:3000"
// - buildId : the build trace identifier (e.g. "build_obby_0d8150c0")
// - token   : optional X-ALX-Token value, only required when the server runs
//             in strict-auth mode (NODE_ENV=production or ALX_REQUIRE_AUTH=1)

import { useEffect, useMemo, useState, useCallback } from "react";
import { createRingRuntime } from "./RingRuntime.js";

var DEFAULT_SERVER = "http://localhost:3000";

function _buildHeaders(token) {
  var h = { Accept: "application/json" };
  if (token) h["X-ALX-Token"] = token;
  return h;
}

export function useReplayedRuntime(opts) {
  opts = opts || {};
  var server  = opts.server || DEFAULT_SERVER;
  var buildId = opts.buildId || null;
  var token   = opts.token || null;

  // One runtime per hook instance; replayed in place when buildId changes.
  var runtime = useMemo(function () { return createRingRuntime(); }, []);

  var snapshotState = useState(function () { return runtime.snapshot(); });
  var snapshot = snapshotState[0];
  var setSnapshot = snapshotState[1];

  var loadingState = useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var errorState = useState(null);
  var error = errorState[0];
  var setError = errorState[1];

  var fetchAndReplay = useCallback(function () {
    if (!buildId) {
      runtime.replay([]);
      setSnapshot(runtime.snapshot());
      setError(null);
      return Promise.resolve();
    }
    setLoading(true);
    setError(null);
    return fetch(server + "/rbx/audit/" + encodeURIComponent(buildId), {
      method: "GET",
      headers: _buildHeaders(token),
    })
      .then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            var msg;
            try { msg = JSON.parse(t).error || ("HTTP " + r.status); }
            catch (_) { msg = "HTTP " + r.status; }
            throw new Error(msg);
          });
        }
        return r.json();
      })
      .then(function (body) {
        if (!body || body.ok !== true) {
          throw new Error((body && body.error) || "audit fetch failed");
        }
        var records = (body.audit && body.audit.records) || [];
        var intent  = body.intent || null;
        var ledger  = body.ledger || null;
        var energy  = body.energy || null;
        var world   = body.world  || null;
        runtime.replay(records, intent, ledger, energy, world);
        setSnapshot(runtime.snapshot());
      })
      .catch(function (e) {
        setError(e && e.message ? e.message : String(e));
        runtime.replay([]);
        setSnapshot(runtime.snapshot());
      })
      .then(function () {
        setLoading(false);
      });
  }, [server, buildId, token, runtime]);

  useEffect(function () {
    fetchAndReplay();
  }, [fetchAndReplay]);

  return {
    runtime:  runtime,
    snapshot: snapshot,
    loading:  loading,
    error:    error,
    refresh:  fetchAndReplay,
  };
}

export default useReplayedRuntime;
