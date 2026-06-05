// k1/Ydin/kernel.js

import { createMemorySystem } from "./muisti.js";
import { createEnergySystem, ObservabilityCore, DriftController } from "./energia.js";
import { createDecisionCourt } from "./paatos.js";
import { createPolicyEngine, POLICY_MODE } from "./policy.js";
import { EventBus } from "./eventbus.js";

function SimpleMapStore() {
  const m = new Map();
  return {
    get(k) { return m.get(k); },
    set(k, v) { m.set(k, v); }
  };
}

function asNumberOr(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function optsSafe(x, fallback = {}) {
  return x && typeof x === "object" ? x : fallback;
}

export default class Kernel {

  constructor(opts = {}) {
    this.prefix = String(opts.prefix || "k1");
    this.clock = opts.clock;
    this.store = opts.store || SimpleMapStore();
    this.opts = opts;
    this._running = false;

    this.obs = null;
    this.drift = null;
    this.energy = null;
    this.memory = null;
    this.court = null;
    this.policy = null;

    this.kvKey = this.prefix + ":vault";
    this._kv = Object.create(null);
    this._loadedKv = false;

    // EventBus - ensiluokkainen primitive
    this.events = new EventBus({
      prefix: this.prefix,
      clock: this.clock,
      historyLimit: asNumberOr(opts.eventHistoryLimit, 1000),
      onAudit: (event) => this._auditEvent(event)
    });

    this._hb = null;
    this.hbMs = asNumberOr(opts.hbMs, 250);
  }


  /* =========================================================
     AUDIT HOOK
  ========================================================= */

  _auditEvent(event) {
    if (this.obs) {
      this.obs.bump("events:total", 1);
      this.obs.bump(`events:${event.type}`, 1);
    }
  }


  /* =========================================================
     LIFECYCLE
  ========================================================= */

  async start() {
    if (this._running) return;

    await this._initObs();
    await this._initDrift();
    await this._initEnergy();
    await this._initMemory();
    await this._initCourt();
    await this._initPolicy();
    await this._loadKv();

    this._running = true;

    this._startHeartbeat();

    this.events.emit("kernel:started", { prefix: this.prefix });
  }

  async stop() {
    if (!this._running) return;

    this._stopHeartbeat();
    this._running = false;

    this.events.emit("kernel:stopped", { prefix: this.prefix });
  }


  /* =========================================================
     INIT
  ========================================================= */

  async _initObs() {
    this.obs = new ObservabilityCore(this.store, this.prefix, this.clock);
  }

  async _initDrift() {
    this.drift = new DriftController(this.store, this.prefix, this.clock);
  }

  async _initEnergy() {
    const sys = await createEnergySystem({
      clock: this.clock,
      store: this.store,
      prefix: this.prefix
    });

    this.energy = sys.energy;
    this.obs = sys.obs || this.obs;
  }

  async _initMemory() {
    this.memory = await createMemorySystem({
      clock: this.clock,
      store: this.store,
      prefix: this.prefix,
      obs: this.obs,
      drift: this.drift,
      maxItems: optsSafe(this.opts.memoryMaxItems),
      maxBytes: optsSafe(this.opts.memoryMaxBytes)
    });
  }

  async _initCourt() {
    this.court = createDecisionCourt({
      clock: this.clock,
      prefix: this.prefix,
      obs: this.obs,
      drift: this.drift,
      memory: this.memory,
      onDecide: async (result) => {
        await this.memory.write("R2", "decision", result);
        this.events.emit("decision:made", { result });
      }
    });
  }

  async _initPolicy() {
    this.policy = createPolicyEngine(POLICY_MODE.NORMAL, this.clock);
  }

  async _loadKv() {
    if (this._loadedKv) return;
    const saved = await this.store.get(this.kvKey);
    if (saved && typeof saved === "object") {
      this._kv = saved;
    }
    this._loadedKv = true;
  }


  /* =========================================================
     HEARTBEAT
  ========================================================= */

  _startHeartbeat() {
    if (this._hb) return;

    this._hb = setInterval(() => {
      void this._tick().catch(() => {});
    }, this.hbMs);
  }

  _stopHeartbeat() {
    if (this._hb) {
      clearInterval(this._hb);
      this._hb = null;
    }
  }

  async _tick() {
    if (!this._running) return;

    if (this.drift?.tick) await this.drift.tick();
    if (this.energy?.tick) await this.energy.tick();

    this.events.emit("kernel:tick", {
      energy: this.energy?.status?.() || null
    });
  }


  /* =========================================================
     MEMORY
  ========================================================= */

  async addMemory(opts = {}) {
    if (!this._running) throw new Error("Kernel not running");

    const summary = opts.summary || "";
    const domain = opts.domain || "SYSTEM";
    const tier = opts.tier || "R2";
    const redaction = opts.redaction;

    const item = await this.memory.write(tier, "memory:" + domain, { summary, domain }, redaction);

    this.events.emit("memory:added", { item, domain, tier });

    return item;
  }


  /* =========================================================
     DECISION / POLICY
  ========================================================= */

  async decide(input) {
    if (!this._running) throw new Error("Kernel not running");
    return this.court.decide(input);
  }

  evaluatePolicy(role, action, context = {}) {
    if (!this._running) throw new Error("Kernel not running");

    const result = this.policy.evaluate(role, action, context);
    this.policy.logAction(role, action, result.allowed, result.reason);

    this.events.emit("policy:evaluated", { role, action, allowed: result.allowed, reason: result.reason });

    return result;
  }


  /* =========================================================
     STATE
  ========================================================= */

  getState() {
    return {
      running: this._running,
      energy: this.energy?.getState?.() || null,
      memory: this.memory?.getState?.() || null,
      drift: this.drift?.get?.() || null,
      policy: this.policy?.getMode?.() || null,
      court: this.court?.getHealthSnapshot?.() || null,
      events: this.events.getStats()
    };
  }


  /* =========================================================
     METRICS
  ========================================================= */

  getMetrics() {
    if (!this.obs) return null;

    return {
      counters: this.obs.counters || {},
      gauges: this.obs.gauges || {},
      errors: this.obs.errors || []
    };
  }


  /* =========================================================
     EVENT BUS ACCESS
  ========================================================= */

  on(eventType, handler) {
    return this.events.subscribe(eventType, handler);
  }

  onAll(handler) {
    return this.events.subscribeAll(handler);
  }

  emit(eventType, payload = {}) {
    return this.events.emit(eventType, payload);
  }

  getEventHistory(count = 100) {
    return this.events.getHistory(count);
  }
}