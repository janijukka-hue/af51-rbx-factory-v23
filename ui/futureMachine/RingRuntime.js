// ui/futureMachine/RingRuntime.js
// AF51 FutureMachine — read-only orchestrator.
//
// Consumes PipelineAudit records (live or replayed from a ZIP) and updates
// the rings (CoreSphere + FactoryRing for now). Designed so that:
//
//   runtime.replay(audit.records) === <state after live build>
//
// i.e. any visualization can be reconstructed from the audit alone, which
// means demos, tests and bug-investigation never need to run a real build.

import { RingState } from "./RingState.js";
import {
  FactoryRingContract,
  GhostRingContract,
  IntentRingContract,
  MemoryRingContract,
  EnergyRingContract,
  WorldRingContract,
  recordToRingEvents,
  intentToRingEvents,
  memoryToRingEvents,
  energyToRingEvents,
  worldToRingEvents,
} from "./RingEvents.js";

export class RingRuntime {
  constructor(opts) {
    opts = opts || {};
    this._rings = new Map();
    this._rings.set("world", new RingState({
      id: "world",
      segments: WorldRingContract.segments,
      maxHistory: opts.worldHistory || 32,
    }));
    this._rings.set("energy", new RingState({
      id: "energy",
      segments: EnergyRingContract.segments,
      maxHistory: opts.energyHistory || 32,
    }));
    this._rings.set("memory", new RingState({
      id: "memory",
      segments: MemoryRingContract.segments,
      maxHistory: opts.memoryHistory || 32,
    }));
    this._rings.set("intent", new RingState({
      id: "intent",
      segments: IntentRingContract.segments,
      maxHistory: opts.intentHistory || 32,
    }));
    this._rings.set("factory", new RingState({
      id: "factory",
      segments: FactoryRingContract.segments,
      maxHistory: opts.factoryHistory || 200,
    }));
    this._rings.set("ghost", new RingState({
      id: "ghost",
      segments: GhostRingContract.segments,
      maxHistory: opts.ghostHistory || 64,
    }));
    this._rings.set("core", new RingState({
      id: "core",
      segments: [],
      maxHistory: opts.coreHistory || 64,
    }));
    this._traceId      = null;
    this._lastRecordAt = 0;
    this._intent       = null;
    this._ledger       = null;
    this._energy       = null;
    this._world        = null;
    this._listeners    = new Set();
  }

  // Live ingestion: feed one PipelineAudit record.
  consume(record) {
    if (!record) return;
    // New build → reset rings so traces don't blend.
    if (record.traceId && record.traceId !== this._traceId) {
      this._traceId = record.traceId;
      this._rings.forEach(function (r) { r.reset(); });
    }
    this._lastRecordAt = record.at || Date.now();
    var events = recordToRingEvents(record);
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var ring = this._rings.get(ev.ring);
      if (ring) ring.apply(ev);
    }
    this._emit();
  }

  // Replay invariant: rebuild the full ring state from an audit's records[].
  // Pure result — does not touch the production pipeline. Optionally also
  // applies static `intent` (manifest+quality), `ledger` (lineage),
  // `energy` (resource footprint) and `world` (deploy surface) payloads,
  // none of which are carried in the records themselves.
  replay(records, intent, ledger, energy, world) {
    if (!Array.isArray(records)) return;
    this._rings.forEach(function (r) { r.reset(); });
    this._traceId = null;
    this._lastRecordAt = 0;
    this._intent = null;
    this._ledger = null;
    this._energy = null;
    this._world = null;
    for (var i = 0; i < records.length; i++) this.consume(records[i]);
    if (intent) this.applyIntent(intent);
    if (ledger) this.applyMemory(ledger);
    if (energy) this.applyEnergy(energy);
    if (world)  this.applyWorld(world);
  }

  // Static, idempotent: applying the same intent twice yields the same state.
  // Separate from consume() because intent is metadata, not a timed event.
  // Events are stamped with the last record timestamp (or 1) so replay() and
  // live ingestion produce identical lastAt — preserving the replay invariant.
  applyIntent(intent) {
    if (!intent || typeof intent !== "object") return;
    this._intent = intent;
    var ring = this._rings.get("intent");
    if (!ring) return;
    var stamp = this._lastRecordAt > 0 ? this._lastRecordAt : 1;
    var events = intentToRingEvents(intent, stamp);
    for (var i = 0; i < events.length; i++) ring.apply(events[i]);
    this._emit();
  }

  // Static, idempotent: applying the same ledger twice yields the same state.
  // Same determinism contract as applyIntent — stamped with lastRecordAt.
  applyMemory(ledger) {
    if (!ledger || typeof ledger !== "object") return;
    this._ledger = ledger;
    var ring = this._rings.get("memory");
    if (!ring) return;
    var stamp = this._lastRecordAt > 0 ? this._lastRecordAt : 1;
    var events = memoryToRingEvents(ledger, stamp);
    for (var i = 0; i < events.length; i++) ring.apply(events[i]);
    this._emit();
  }

  // Static, idempotent: applying the same energy twice yields the same state.
  // Same determinism contract as applyIntent/applyMemory.
  applyEnergy(energy) {
    if (!energy || typeof energy !== "object") return;
    this._energy = energy;
    var ring = this._rings.get("energy");
    if (!ring) return;
    var stamp = this._lastRecordAt > 0 ? this._lastRecordAt : 1;
    var events = energyToRingEvents(energy, stamp);
    for (var i = 0; i < events.length; i++) ring.apply(events[i]);
    this._emit();
  }

  // Static, idempotent: applying the same world twice yields the same state.
  // Same determinism contract as the other apply* methods.
  applyWorld(world) {
    if (!world || typeof world !== "object") return;
    this._world = world;
    var ring = this._rings.get("world");
    if (!ring) return;
    var stamp = this._lastRecordAt > 0 ? this._lastRecordAt : 1;
    var events = worldToRingEvents(world, stamp);
    for (var i = 0; i < events.length; i++) ring.apply(events[i]);
    this._emit();
  }

  getRing(id) { return this._rings.get(id) || null; }
  getIntent() { return this._intent; }
  getLedger() { return this._ledger; }
  getEnergy() { return this._energy; }
  getWorld()  { return this._world; }

  snapshot() {
    var rings = {};
    this._rings.forEach(function (ring, id) { rings[id] = ring.snapshot(); });
    return Object.freeze({
      traceId:      this._traceId,
      lastRecordAt: this._lastRecordAt,
      intent:       this._intent,
      ledger:       this._ledger,
      energy:       this._energy,
      world:        this._world,
      rings:        rings,
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
      try { fn(snap); } catch (_) { /* never break the runtime */ }
    });
  }
}

export function createRingRuntime(opts) {
  return new RingRuntime(opts);
}

export default RingRuntime;
