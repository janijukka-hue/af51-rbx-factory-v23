// s4/oliot/DirtyStateQueue.js
// KERROS: S4 – Studio/UI
// Version: 1.0.0
//
// DirtyStateQueue — odottavien toimintojen jono offline-tilanteessa.
//
// Kun yhteys katkeaa, toiminnot eivät häviä vaan jonottavat.
// Kun yhteys palautuu, jono flushataan järjestyksessä.
//
// Toiminnot:
//   enqueue(action)    — lisää jonoon
//   flush(executor)    — yrittää ajaa jonon (kutsutaan reconnect:ssa)
//   getQueue()         — näytä jono (UI debuggausta varten)
//
// Action-rakenne:
//   { id, type, payload, createdAt, retryCount, maxRetries, lastError }

var MAX_QUEUE_SIZE  = 100;
var DEFAULT_RETRIES = 3;
var RETRY_DELAY_MS  = 1000;

function DirtyStateQueue(options) {
  var opts        = options || {};
  this._debug     = opts.debug     || false;
  this._queue     = [];
  this._flushing  = false;
  this._listeners = [];   // flush progress listeners
}

// ── enqueue(action) ───────────────────────────────────────────

DirtyStateQueue.prototype.enqueue = function(action) {
  if (!action || !action.type) {
    return { ok: false, error: "action.type vaaditaan" };
  }

  if (this._queue.length >= MAX_QUEUE_SIZE) {
    if (this._debug) console.warn("[DirtyStateQueue] jono täynnä, hylätään:", action.type);
    return { ok: false, error: "Jono täynnä (" + MAX_QUEUE_SIZE + ")" };
  }

  var item = {
    id:         "dq_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    type:       action.type,
    payload:    action.payload || {},
    createdAt:  Date.now(),
    retryCount: 0,
    maxRetries: action.maxRetries !== undefined ? action.maxRetries : DEFAULT_RETRIES,
    lastError:  null,
    status:     "pending"   // pending | retrying | failed
  };

  this._queue.push(item);

  if (this._debug) 

  return { ok: true, itemId: item.id };
};

// ── flush(executor) ───────────────────────────────────────────
// executor(action) → Promise<{ ok, error? }>
// Flushataan järjestyksessä — yksi kerrallaan.
// Epäonnistuneet yritetään uudelleen retryCount < maxRetries.

DirtyStateQueue.prototype.flush = async function(executor) {
  if (this._flushing) return { ok: false, error: "Flush jo käynnissä" };
  if (!executor || typeof executor !== "function") return { ok: false, error: "executor vaaditaan" };
  if (this._queue.length === 0) return { ok: true, processed: 0, failed: 0 };

  this._flushing = true;
  var processed  = 0;
  var failed     = 0;
  var remaining  = [];

  if (this._debug) 

  for (var i = 0; i < this._queue.length; i++) {
    var item = this._queue[i];
    item.status = "retrying";

    try {
      var result = await executor(item);

      if (result && result.ok) {
        processed++;
        this._notify({ action: "processed", item: item });
        if (this._debug) console.log("[DirtyStateQueue] processed");
      } else {
        var errMsg = result ? (result.error || "executor palautti ok:false") : "null result";
        item.retryCount++;
        item.lastError = errMsg;

        if (item.retryCount < item.maxRetries) {
          item.status = "pending";
          remaining.push(item);
          if (this._debug) 
//         } else {
          item.status = "failed";
          failed++;
          this._notify({ action: "failed", item: item });
          if (this._debug) console.warn("[DirtyStateQueue] FAIL final:", item.type, errMsg);
        }
      }
    } catch (err) {
      item.retryCount++;
      item.lastError = err.message;

      if (item.retryCount < item.maxRetries) {
        item.status = "pending";
        remaining.push(item);
      } else {
        item.status = "failed";
        failed++;
        this._notify({ action: "failed", item: item });
      }
    }

    // Pieni viive retryjien välillä
    if (remaining.length > 0 && i < this._queue.length - 1) {
      await new Promise(function(res) { setTimeout(res, RETRY_DELAY_MS); });
    }
  }

  this._queue    = remaining;
  this._flushing = false;

  this._notify({ action: "flush_complete", processed: processed, failed: failed, remaining: remaining.length });

  if (this._debug) {
    
  }

  return { ok: true, processed: processed, failed: failed, remaining: remaining.length };
};

// ── getQueue() ────────────────────────────────────────────────

DirtyStateQueue.prototype.getQueue = function() {
  return this._queue.slice();
};

DirtyStateQueue.prototype.getSize = function() {
  return this._queue.length;
};

DirtyStateQueue.prototype.clear = function() {
  this._queue    = [];
  this._flushing = false;
};

DirtyStateQueue.prototype.isFlushing = function() {
  return this._flushing;
};

// ── onFlushEvent(handler) ─────────────────────────────────────

DirtyStateQueue.prototype.onFlushEvent = function(handler) {
  this._listeners.push(handler);
  var self = this;
  return function unsubscribe() {
    var idx = self._listeners.indexOf(handler);
    if (idx !== -1) self._listeners.splice(idx, 1);
  };
};

DirtyStateQueue.prototype._notify = function(event) {
  for (var i = 0; i < this._listeners.length; i++) {
    try { this._listeners[i](event); } catch (e) { /* ei kaada */ }
  }
};

// ─── Factory ─────────────────────────────────────────────────

export function createDirtyStateQueue(options) {
  return new DirtyStateQueue(options);
}

export { DirtyStateQueue };
export default DirtyStateQueue;