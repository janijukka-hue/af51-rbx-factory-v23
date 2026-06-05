// ui/futureMachine/RingState.js
// AF51 FutureMachine — bounded state container for a single ring.
//
// Holds the current state of every segment plus a small rolling history
// of applied events. Read-only from the outside (snapshots are frozen);
// the only mutation paths are apply(event) and reset().

var DEFAULT_HISTORY = 200;

export class RingState {
  constructor(opts) {
    opts = opts || {};
    this.id        = opts.id || "ring";
    this.segments  = (opts.segments || []).slice();
    this.maxHist   = opts.maxHistory || DEFAULT_HISTORY;
    this._segState = {};          // segment → "idle"|"active"|"done"|"error"
    this._lastAt   = {};          // segment → epoch ms
    this._history  = [];          // bounded list of applied events
    this._overall  = "idle";      // ring-level state (used when segments=[])
    this._listeners = new Set();
    this._resetSegments();
  }

  _resetSegments() {
    for (var i = 0; i < this.segments.length; i++) {
      this._segState[this.segments[i]] = "idle";
      this._lastAt[this.segments[i]]   = 0;
    }
  }

  apply(event) {
    if (!event) return;
    if (event.segment) {
      // Ignore segments we don't know about — keeps the contract authoritative.
      if (Object.prototype.hasOwnProperty.call(this._segState, event.segment)) {
        this._segState[event.segment] = event.state;
        this._lastAt[event.segment]   = event.at || Date.now();
      }
    } else {
      this._overall = event.state;
    }
    this._history.push(event);
    if (this._history.length > this.maxHist) this._history.shift();
    this._emit();
  }

  reset() {
    this._resetSegments();
    this._overall = "idle";
    this._history.length = 0;
    this._emit();
  }

  snapshot() {
    return Object.freeze({
      id:         this.id,
      segments:   this.segments.slice(),
      segState:   Object.assign({}, this._segState),
      lastAt:     Object.assign({}, this._lastAt),
      overall:    this._overall,
      historyLen: this._history.length,
    });
  }

  subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    this._listeners.add(fn);
    var self = this;
    return function () { self._listeners.delete(fn); };
  }

  _emit() {
    var snap = this.snapshot();
    this._listeners.forEach(function (fn) {
      try { fn(snap); } catch (_) { /* listener errors never break the ring */ }
    });
  }
}

export default RingState;
