// s4/oliot/ui/RingStatusUIOlio.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer
// Version: 1.0.0
//
// RingStatusUIOlio — yhdistää olemassa olevat ringit UI-oliokerrokseen.
// EI korvaa RingRuntimea/RingStatea — se LUKEE RingRuntimen snapshotin ja
// tarjoaa sen muille UI-olioille yhtenäisessä muodossa. Ringit pysyvät
// totuuslähteenä; tämä on vain adapteri niiden tilaan.
//
//   world energy memory intent factory ghost core  → kunkin ringin overall-tila

var RING_IDS = ["world", "energy", "memory", "intent", "factory", "ghost", "core"];

function RingStatusUIOlio(opts) {
  opts = opts || {};
  this.world   = opts.world   || "idle";
  this.energy  = opts.energy  || "idle";
  this.memory  = opts.memory  || "idle";
  this.intent  = opts.intent  || "idle";
  this.factory = opts.factory || "idle";
  this.ghost   = opts.ghost   || "idle";
  this.core    = opts.core    || "idle";
}

// Build from a RingRuntime.snapshot() object — the live ring system.
RingStatusUIOlio.fromSnapshot = function (snapshot) {
  var o = {};
  var rings = (snapshot && snapshot.rings) || {};
  for (var i = 0; i < RING_IDS.length; i++) {
    var id = RING_IDS[i];
    var r = rings[id];
    // RingState.snapshot exposes overall state; fall back to "idle".
    o[id] = (r && (r.overall || r.state)) || "idle";
  }
  return new RingStatusUIOlio(o);
};

// Convenience: build directly from a live RingRuntime instance.
RingStatusUIOlio.fromRuntime = function (runtime) {
  if (!runtime || typeof runtime.snapshot !== "function") return new RingStatusUIOlio();
  return RingStatusUIOlio.fromSnapshot(runtime.snapshot());
};

RingStatusUIOlio.prototype.anyError = function () {
  for (var i = 0; i < RING_IDS.length; i++) {
    if (this[RING_IDS[i]] === "error") return true;
  }
  return false;
};

RingStatusUIOlio.prototype.toJSON = function () {
  var out = {};
  for (var i = 0; i < RING_IDS.length; i++) out[RING_IDS[i]] = this[RING_IDS[i]];
  return out;
};

export { RingStatusUIOlio, RING_IDS };
export function createRingStatusUIOlio(opts) { return new RingStatusUIOlio(opts); }
