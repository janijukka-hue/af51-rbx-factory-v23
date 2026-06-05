// s4/hooks/useConnectionStatus.js
// KERROS: S4 – Studio/UI
// Version: 1.0.0
//
// useConnectionStatus — yhteyden tilan hallinta + reconnect + cache fallback.
//
// Havaitsee orchestratorin tilan:
//   online   — orchestrator vastaa, data tuoretta
//   offline  — orchestrator ei vastaa, käytetään cachea
//   degraded — osittainen toiminta
//
// Reconnect:
//   - Eksponentiaalinen retry (1s, 2s, 4s, 8s, max 30s)
//   - Reconnect onnistuessa flushaa DirtyStateQueue
//
// Käyttö:
//   var conn = useConnectionStatus(orchestrator, { cache, dirtyQueue });
//   conn.isOnline      // true/false
//   conn.status        // "online" | "offline" | "degraded" | "reconnecting"
//   conn.lastSeenAt    // milloin viimeksi online
//   conn.seeds         // cache-backed data

import { useState, useEffect, useCallback, useRef } from "react";

var PING_INTERVAL_MS  = 5000;    // Tarkistetaan 5s välein
var RECONNECT_BASE_MS = 1000;    // Alku-delay
var RECONNECT_MAX_MS  = 30000;   // Max delay
var OFFLINE_THRESHOLD = 2;       // Montako peräkkäistä epäonnistumista = offline

export function useConnectionStatus(orchestrator, options) {
  var opts       = options || {};
  var cache      = opts.cache      || null;
  var dirtyQueue = opts.dirtyQueue || null;

  var [connStatus, setConnStatus]   = useState("connecting");
  var [lastSeenAt, setLastSeenAt]   = useState(null);
  var [retryCount, setRetryCount]   = useState(0);
  var [seeds,      setSeeds]        = useState([]);
  var [status,     setStatus]       = useState(null);
  var [queueSize,  setQueueSize]    = useState(0);

  var failCountRef     = useRef(0);
  var retryTimerRef    = useRef(null);
  var pingIntervalRef  = useRef(null);
  var mountedRef       = useRef(true);
  var reconnectingRef  = useRef(false);

  // ── ping — tarkistaa onko orchestrator elossa ───────────────

  var ping = useCallback(async function() {
    if (!orchestrator) {
      if (mountedRef.current) setConnStatus("offline");
      return false;
    }

    try {
      var s = orchestrator.getStatus ? orchestrator.getStatus() : null;
      if (!s || !orchestrator.isRunning || !orchestrator.isRunning()) {
        throw new Error("Orchestrator ei ole RUNNING-tilassa");
      }

      // Online ✓
      failCountRef.current = 0;
      if (mountedRef.current) {
        setConnStatus("online");
        setLastSeenAt(Date.now());
        setRetryCount(0);
        setStatus(s);
      }

      // Päivitä cache
      if (cache) cache.setStatus(s);

      return true;

    } catch (err) {
      failCountRef.current++;

      if (failCountRef.current >= OFFLINE_THRESHOLD) {
        if (mountedRef.current) setConnStatus("offline");
      } else {
        if (mountedRef.current) setConnStatus("degraded");
      }

      return false;
    }
  }, [orchestrator, cache]);

  // ── loadSeeds — cache-backed seeds ─────────────────────────

  var loadSeeds = useCallback(async function(forceRefresh) {
    // Tarkista cache ensin
    if (!forceRefresh && cache) {
      var cached = cache.getSeeds({ allowStale: connStatus === "offline" });
      if (cached) {
        if (mountedRef.current) setSeeds(cached.value || []);
        if (!cached.stale) return;  // Tuore cache — ei tarvita verkkohausta
      }
    }

    if (!orchestrator || !orchestrator.querySeeds) return;

    try {
      var fresh = await orchestrator.querySeeds({ limit: 30 });
      if (mountedRef.current) setSeeds(fresh || []);
      if (cache) cache.setSeeds(fresh || []);
    } catch (err) {
      // Offline — käytä stale-cachea
      if (cache) {
        var stale = cache.getSeeds({ allowStale: true });
        if (stale && mountedRef.current) setSeeds(stale.value || []);
      }
    }
  }, [orchestrator, cache, connStatus]);

  // ── reconnect — eksponentiaalinen retry ─────────────────────

  var scheduleReconnect = useCallback(function(attempt) {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (reconnectingRef.current) return;

    var delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt || 0), RECONNECT_MAX_MS);
    reconnectingRef.current = true;

    if (mountedRef.current) {
      setConnStatus("reconnecting");
      setRetryCount(function(c) { return c + 1; });
    }

    retryTimerRef.current = setTimeout(async function() {
      reconnectingRef.current = false;
      var ok = await ping();

      if (ok) {
        // Reconnect onnistui — flush dirty queue
        if (dirtyQueue && dirtyQueue.getSize() > 0 && orchestrator) {
          var executor = function(action) {
            return orchestrator.execute(action.payload.input || action.type, action.payload.ctx || {});
          };
          dirtyQueue.flush(executor).then(function(result) {
            if (mountedRef.current) setQueueSize(dirtyQueue.getSize());
          });
        }
        // Lataa tuore data
        loadSeeds(true);
      } else {
        // Epäonnistui — yritä uudelleen
        if (mountedRef.current) {
          scheduleReconnect((attempt || 0) + 1);
        }
      }
    }, delay);
  }, [ping, dirtyQueue, orchestrator, loadSeeds]);

  // ── Päätasolla — automaattinen ping + reconnect ──────────────

  useEffect(function() {
    mountedRef.current = true;

    // Aloita ping-loop
    ping().then(function(ok) {
      if (!ok && mountedRef.current) scheduleReconnect(0);
      loadSeeds(false);
    });

    pingIntervalRef.current = setInterval(async function() {
      if (!mountedRef.current) return;
      var ok = await ping();
      if (!ok && connStatus !== "reconnecting") {
        scheduleReconnect(failCountRef.current);
      }
    }, PING_INTERVAL_MS);

    return function() {
      mountedRef.current = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (retryTimerRef.current)   clearTimeout(retryTimerRef.current);
    };
  }, [orchestrator]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seuraa dirty queue kokoa
  useEffect(function() {
    if (!dirtyQueue) return;
    var unsub = dirtyQueue.onFlushEvent(function() {
      if (mountedRef.current) setQueueSize(dirtyQueue.getSize());
    });
    return unsub;
  }, [dirtyQueue]);

  // ── Palautetaan ───────────────────────────────────────────────

  var isOnline   = connStatus === "online";
  var isOffline  = connStatus === "offline";

  return {
    // Tilat
    status:      connStatus,       // "connecting"|"online"|"offline"|"degraded"|"reconnecting"
    isOnline:    isOnline,
    isOffline:   isOffline,
    isDegraded:  connStatus === "degraded",
    isReconnecting: connStatus === "reconnecting",

    // Data
    lastSeenAt:  lastSeenAt,
    retryCount:  retryCount,
    seeds:       seeds,
    systemStatus: status,
    queueSize:   queueSize,        // Odottavien toimintojen määrä

    // Kontrollit
    reconnect:   function() { scheduleReconnect(0); },
    refreshSeeds: function() { loadSeeds(true); },
    ping:        ping
  };
}

export default useConnectionStatus;