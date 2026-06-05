// k1/Ydin/event-throttle.js
// KERROS: k1 – Kernel/Ydin
// Version: 1.0.0
//
// EventThrottle — throttle ja batch layer EventBusin päälle.
//
// Ongelma:
//   EventBus.emit() on synkroninen ja kutsuu kaikki handlerit välittömästi.
//   17+ emittiä per execute() → DebugScreen wildcardsubscriptio
//   → 17 React setState-kutsua → 17 rerenderiä.
//
// Ratkaisu:
//   ThrottledEventBus wrappaa olemassaolevan EventBusin.
//   Korkean prioriteetin eventit (CRITICAL, HIGH) menevät läpi välittömästi.
//   NORMAL ja LOW batcataan → flushataan requestAnimationFrame:ssa
//   tai max-delay:n jälkeen (16ms / 100ms).
//
// Käyttö:
//   var throttled = createThrottledEventBus(originalEventBus, { batchMs: 16 });
//   orchestrator._tEventBus = throttled;
//   DebugScreen subscriboituu throttled-bussiin eikä suoraan orchestratoriin.

var DEFAULT_BATCH_MS  = 16;   // ~1 frame
var DEFAULT_FLUSH_MS  = 100;  // max delay ennen pakkoflushia
var MAX_BATCH_SIZE    = 50;   // Max eventtiä per batch ennen pakkoflushia

// ─── EventThrottle ───────────────────────────────────────────

function EventThrottle(eventBus, options) {
  var opts = options || {};
  this._bus         = eventBus;
  this._batchMs     = opts.batchMs     || DEFAULT_BATCH_MS;
  this._flushMs     = opts.flushMs     || DEFAULT_FLUSH_MS;
  this._maxBatch    = opts.maxBatch    || MAX_BATCH_SIZE;
  this._debug       = opts.debug       || false;

  // Buffer: { type, payload, ts }[]
  this._buffer      = [];
  this._flushTimer  = null;
  this._lastFlush   = 0;

  // Throttled subscribers: type → [handler]
  // Nämä saavat batched-versiot
  this._throttledSubs = new Map();
  this._throttledWild = [];

  // Pass-through subscribers (kuten EventBus.on()) — ei throttlattu
  // Nämä käyttävät suoraan alkuperäistä bustaT
  this._passthroughActive = false;
}

// ── subscribe(type, handler, throttled) ──────────────────────
// throttled=true → handler saa batched flush-kutsun
// throttled=false (oletus) → delegoidaan suoraan EventBusiin

EventThrottle.prototype.subscribe = function(type, handler, throttled) {
  if (!throttled) {
    return this._bus.subscribe(type, handler);
  }

  if (!this._throttledSubs.has(type)) {
    this._throttledSubs.set(type, []);
  }
  this._throttledSubs.get(type).push(handler);

  var self = this;
  return function unsubscribe() {
    var handlers = self._throttledSubs.get(type);
    if (handlers) {
      var idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  };
};

// ── subscribeAll(handler, throttled) ─────────────────────────

EventThrottle.prototype.subscribeAll = function(handler, throttled) {
  if (!throttled) {
    return this._bus.subscribeAll(handler);
  }

  this._throttledWild.push(handler);
  var self = this;
  return function unsubscribe() {
    var idx = self._throttledWild.indexOf(handler);
    if (idx !== -1) self._throttledWild.splice(idx, 1);
  };
};

// ── emit(type, payload, priority) ────────────────────────────
// priority: 0=CRITICAL, 1=HIGH → läpi heti
//           2=NORMAL, 3=LOW   → buffer + batch

EventThrottle.prototype.emit = function(type, payload, priority) {
  var prio = priority !== undefined ? priority : 2; // NORMAL oletus

  // CRITICAL ja HIGH — pass-through välittömästi
  if (prio <= 1) {
    this._flushOne(type, payload);
    return;
  }

  // Bufferoi
  this._buffer.push({ type: type, payload: payload || {}, ts: Date.now() });

  // Pakkoflush jos buffer täynnä
  if (this._buffer.length >= this._maxBatch) {
    this._flush();
    return;
  }

  // Pakkoflush jos liikaa aikaa kulunut
  var now = Date.now();
  if (now - this._lastFlush > this._flushMs) {
    this._flush();
    return;
  }

  // Normaalifluush requestAnimationFrame:ssa
  this._scheduleFlush();
};

// ── scheduleFlush() ──────────────────────────────────────────

EventThrottle.prototype._scheduleFlush = function() {
  if (this._flushTimer !== null) return;
  var self = this;

  if (typeof requestAnimationFrame !== "undefined") {
    this._flushTimer = requestAnimationFrame(function() {
      self._flushTimer = null;
      self._flush();
    });
  } else {
    this._flushTimer = setTimeout(function() {
      self._flushTimer = null;
      self._flush();
    }, self._batchMs);
  }
};

// ── _flush() ─────────────────────────────────────────────────
// Toimittaa kaikki bufferoidut eventit throttled-handlereille.

EventThrottle.prototype._flush = function() {
  if (this._buffer.length === 0) return;

  var batch   = this._buffer.slice();
  this._buffer = [];
  this._lastFlush = Date.now();

  if (this._debug) {
    
  }

  // Toimita per-type throttled subscriberit
  for (var i = 0; i < batch.length; i++) {
    var event = batch[i];

    var typeSubs = this._throttledSubs.get(event.type);
    if (typeSubs) {
      for (var j = 0; j < typeSubs.length; j++) {
        try { typeSubs[j](event.payload); } catch (e) { /* ei kaada */ }
      }
    }
  }

  // Wildcard throttled subscriberit saavat koko batchin kerralla
  if (this._throttledWild.length > 0) {
    for (var k = 0; k < this._throttledWild.length; k++) {
      try {
        this._throttledWild[k](batch);
      } catch (e) { /* ei kaada */ }
    }
  }
};

// ── _flushOne(type, payload) ──────────────────────────────────
// Pass-through yksittäiselle eventille (CRITICAL/HIGH).

EventThrottle.prototype._flushOne = function(type, payload) {
  // Lähetä myös alkuperäisen bussin kautta
  this._bus.emit(type, payload);

  // Ja throttled subscriberit
  var typeSubs = this._throttledSubs.get(type);
  if (typeSubs) {
    for (var j = 0; j < typeSubs.length; j++) {
      try { typeSubs[j](payload); } catch (e) { /* ei kaada */ }
    }
  }

  if (this._throttledWild.length > 0) {
    var batch = [{ type: type, payload: payload || {}, ts: Date.now() }];
    for (var k = 0; k < this._throttledWild.length; k++) {
      try { this._throttledWild[k](batch); } catch (e) { /* ei kaada */ }
    }
  }
};

// ── getBufferSize() ───────────────────────────────────────────

EventThrottle.prototype.getBufferSize = function() {
  return this._buffer.length;
};

EventThrottle.prototype.getStats = function() {
  return {
    bufferSize:       this._buffer.length,
    lastFlush:        this._lastFlush,
    throttledTypes:   this._throttledSubs.size,
    throttledWild:    this._throttledWild.length
  };
};

// ─── useThrottledEvents React hook ───────────────────────────
// Käytetään DebugScreenin EventsTabissa.
// Subscriboi batch-muodossa → yksi setState per flush, ei per event.
//
// Käyttö:
//   var events = useThrottledEvents(throttle, maxEvents);

export function useThrottledEvents(throttle, maxEvents) {
  // Tämä hook importataan DebugScreenissä
  // Toteutus on DebugScreen.js:ssä React importin kanssa
  // Tässä exportataan vain helper-tyyppi dokumentaatiota varten
  return null;
}

// ─── Factory ─────────────────────────────────────────────────

export function createEventThrottle(eventBus, options) {
  return new EventThrottle(eventBus, options);
}

export { EventThrottle };
export default EventThrottle;