// k1/Ydin/energia.js
// Deterministic kernel utilities and energy subsystem
// - NO Date.now / NO new Date / NO setInterval in kernel logic
// - Deterministic ISO-like timestamps (counter-based, padded)
// - Consistent async/sync store wrapper with optional atomic ops
// - ObservabilityCore persists state
// - EnergyRing uses fixed-point arithmetic and bounded history
// - DriftController tracks system drift
// - Snapshot / restore helpers

const SCHEMA_VERSION = 1;
const META_KEY_SUFFIX = ":meta";
const OBS_KEY_SUFFIX = ":obs:v";

/* ===================== Deterministic time ===================== */

let __timeCounter = 0;

function nowMs(clock) {
  if (clock && typeof clock.now === "function") {
    return Number(clock.now());
  }
  __timeCounter += 1;
  return __timeCounter;
}

function isoNowDeterministic(ts) {
  return String(ts).padStart(20, "0");
}

/* ===================== Helpers ===================== */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function asNumber(x, fallback = 0) {
  const v = Number(x);
  return Number.isFinite(v) ? v : fallback;
}

function isPromise(x) {
  return !!x && typeof x.then === "function";
}

/* ===================== Store wrapper ===================== */

function wrapStore(raw) {
  if (!raw) {
    const m = new Map();
    return {
      async get(k) { return m.get(k); },
      async set(k, v) { m.set(k, v); },
      async remove(k) { m.delete(k); },
      async has(k) { return m.has(k); },
      async setManyAsync(obj) {
        for (const k of Object.keys(obj)) m.set(k, obj[k]);
      }
    };
  }

  if (raw instanceof Map) {
    return {
      async get(k) { return raw.get(k); },
      async set(k, v) { raw.set(k, v); },
      async remove(k) { raw.delete(k); },
      async has(k) { return raw.has(k); },
      async setManyAsync(obj) {
        for (const k of Object.keys(obj)) raw.set(k, obj[k]);
      }
    };
  }

  const hasGet = typeof raw.get === "function";
  const hasSet = typeof raw.set === "function";
  const hasRemove = typeof raw.remove === "function";

  if (hasGet && hasSet) {
    const g = raw.get.bind(raw);
    const s = raw.set.bind(raw);
    const r = hasRemove ? raw.remove.bind(raw) : null;

    const maybeAsync = (fnResult) => (isPromise(fnResult) ? fnResult : Promise.resolve(fnResult));

    const wrapper = {
      async get(k) { return maybeAsync(g(k)); },
      async set(k, v) { return maybeAsync(s(k, v)).then(() => undefined); },
      async remove(k) { if (!r) return Promise.resolve(undefined); return maybeAsync(r(k)).then(() => undefined); },
      async has(k) {
        const v = await maybeAsync(g(k));
        return v !== undefined;
      }
    };

    if (typeof raw.setManyAsync === "function") {
      wrapper.setManyAsync = (obj) => raw.setManyAsync(obj);
    } else {
      wrapper.setManyAsync = async (obj) => {
        for (const k of Object.keys(obj)) {
          await wrapper.set(k, obj[k]);
        }
      };
    }

    return wrapper;
  }

  const m = new Map();
  return {
    async get(k) { return m.get(k); },
    async set(k, v) { m.set(k, v); },
    async remove(k) { m.delete(k); },
    async has(k) { return m.has(k); },
    async setManyAsync(obj) {
      for (const k of Object.keys(obj)) m.set(k, obj[k]);
    }
  };
}

/* ===================== Constants ===================== */

export const COOLING_LEVEL = {
  NORMAL: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3
};

export const ENERGY_SIGNAL = {
  OK: "ENERGY_OK",
  LOW: "ENERGY_LOW",
  CRITICAL: "ENERGY_CRITICAL",
  PRESSURE_HIGH: "PRESSURE_HIGH",
  PRESSURE_CRITICAL: "PRESSURE_CRITICAL",
  THERMAL_HIGH: "THERMAL_HIGH",
  THERMAL_CRITICAL: "THERMAL_CRITICAL",
  SAFE_MODE_SUGGEST: "SAFE_MODE_SUGGEST"
};

export const DRIFT_SEVERITY = {
  NORMAL: "NORMAL",
  ELEVATED: "ELEVATED",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
};

/* ===================== ObservabilityCore ===================== */

export class ObservabilityCore {

  constructor(store, prefix = "k1", clock = null) {
    this._store = wrapStore(store);
    this.clock = clock;
    this.prefix = prefix;
    this.key = `${prefix}${OBS_KEY_SUFFIX}${SCHEMA_VERSION}`;
    this.metaKey = this.key + META_KEY_SUFFIX;

    this.counters = {};
    this.gauges = {};
    this.errors = [];

    this._dirty = false;
  }

  _now() {
    return nowMs(this.clock);
  }

  _markDirty() {
    this._dirty = true;
  }

  async bump(name, delta = 1) {
    this.counters[name] = asNumber(this.counters[name], 0) + asNumber(delta, 1);
    this._markDirty();
  }

  async setGauge(name, value) {
    this.gauges[name] = asNumber(value, 0);
    this._markDirty();
  }

  async error(area, code, message) {
    const ts = this._now();
    const evt = {
      ts,
      iso: isoNowDeterministic(ts),
      area,
      code,
      message
    };
    this.errors.push(evt);
    this._markDirty();
  }

  async persist() {
    const payload = {
      counters: this.counters,
      gauges: this.gauges,
      errors: this.errors
    };
    const meta = {
      persistedAt: this._now(),
      iso: isoNowDeterministic(this._now()),
      countErrors: this.errors.length,
      version: SCHEMA_VERSION
    };

    if (typeof this._store.setManyAsync === "function") {
      await this._store.setManyAsync({
        [this.key]: payload,
        [this.metaKey]: meta
      });
    } else {
      await this._store.set(this.key, payload);
      await this._store.set(this.metaKey, meta);
    }
    this._dirty = false;
  }

  async load() {
    const persisted = await this._store.get(this.key);
    if (persisted && typeof persisted === "object") {
      this.counters = persisted.counters || {};
      this.gauges = persisted.gauges || {};
      this.errors = persisted.errors || [];
    }
  }

  async flushIfDirty() {
    if (this._dirty) await this.persist();
  }

  getState() {
    return {
      counters: { ...this.counters },
      gauges: { ...this.gauges },
      errors: this.errors.slice()
    };
  }

  async clear() {
    this.counters = {};
    this.gauges = {};
    this.errors = [];
    this._dirty = true;
    await this.persist();
  }
}

/* ===================== EnergyRing ===================== */

export class EnergyRing {

  constructor(opts = {}) {
    this.clock = opts.clock;
    this.energyScale = opts.energyScale || 100;
    this.tempScale = opts.tempScale || 100;
    this.historyLimit = Number.isInteger(opts.historyLimit) ? opts.historyLimit : 200;

    this.energy = Math.round((opts.initialEnergy ?? 100) * this.energyScale);
    this.temp = Math.round((opts.initialTemp ?? 12) * this.tempScale);

    this.mode = "IDLE";
    this.history = [];
    this.counters = {};
  }

  _now() {
    return nowMs(this.clock);
  }

  _iso(ts) {
    return isoNowDeterministic(ts);
  }

  async tick() {
    const ts = this._now();

    const energyDelta = Math.round(0.1 * this.energyScale);
    const tempDelta = Math.round(0.05 * this.tempScale);

    this.energy = clamp(this.energy - energyDelta, 0, 100 * this.energyScale);
    this.temp = clamp(this.temp + tempDelta, 0, 100 * this.tempScale);

    const event = {
      ts,
      iso: this._iso(ts),
      energy: this.energy,
      temp: this.temp
    };

    this.history.push(event);
    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }

    return this.status();
  }

  status() {
    return {
      energy: this.energy / this.energyScale,
      temp: this.temp / this.tempScale,
      mode: this.mode,
      history: this.history.slice(-10).map((e) => ({
        ts: e.ts,
        iso: e.iso,
        energy: e.energy / this.energyScale,
        temp: e.temp / this.tempScale
      }))
    };
  }

  consume(amount) {
    const scaled = Math.round(asNumber(amount, 0) * this.energyScale);
    this.energy = clamp(this.energy - scaled, 0, 100 * this.energyScale);
    return this.energy / this.energyScale;
  }

  recharge(amount) {
    const scaled = Math.round(asNumber(amount, 0) * this.energyScale);
    this.energy = clamp(this.energy + scaled, 0, 100 * this.energyScale);
    return this.energy / this.energyScale;
  }

  setMode(mode) {
    this.mode = String(mode);
  }

  getState() {
    return this.status();
  }

  createSnapshot() {
    return {
      energy: this.energy,
      temp: this.temp,
      mode: this.mode,
      history: this.history.slice(),
      counters: { ...this.counters },
      meta: {
        energyScale: this.energyScale,
        tempScale: this.tempScale,
        historyLimit: this.historyLimit
      }
    };
  }

  restoreSnapshot(snap) {
    if (!snap || typeof snap !== "object") return;
    this.energy = snap.energy ?? this.energy;
    this.temp = snap.temp ?? this.temp;
    this.mode = snap.mode ?? this.mode;
    this.history = Array.isArray(snap.history) ? snap.history.slice() : [];
    this.counters = snap.counters ? { ...snap.counters } : {};
    this.energyScale = snap.meta?.energyScale ?? this.energyScale;
    this.tempScale = snap.meta?.tempScale ?? this.tempScale;
    this.historyLimit = snap.meta?.historyLimit ?? this.historyLimit;
  }

  startAutoTick() { /* NO-OP */ }
  stopAutoTick() { /* NO-OP */ }
}

/* ===================== DriftController ===================== */

export class DriftController {

  constructor(store, prefix = "k1", clock = null) {
    this._store = wrapStore(store);
    this.prefix = prefix;
    this.clock = clock;
    this.key = `${prefix}:drift:v${SCHEMA_VERSION}`;

    this.value = 0;
    this.severity = DRIFT_SEVERITY.NORMAL;
    this.history = [];
    this.historyLimit = 100;

    this.thresholds = {
      elevated: 25,
      high: 50,
      critical: 75
    };

    this._tickCount = 0;
  }

  _now() {
    return nowMs(this.clock);
  }

  _iso(ts) {
    return isoNowDeterministic(ts);
  }

  _calculateSeverity(value) {
    if (value >= this.thresholds.critical) return DRIFT_SEVERITY.CRITICAL;
    if (value >= this.thresholds.high) return DRIFT_SEVERITY.HIGH;
    if (value >= this.thresholds.elevated) return DRIFT_SEVERITY.ELEVATED;
    return DRIFT_SEVERITY.NORMAL;
  }

  async tick() {
    this._tickCount += 1;
    const ts = this._now();

    const decay = 0.5;
    this.value = clamp(this.value - decay, 0, 100);
    this.severity = this._calculateSeverity(this.value);

    const event = {
      ts,
      iso: this._iso(ts),
      value: this.value,
      severity: this.severity,
      tickCount: this._tickCount
    };

    this.history.push(event);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    return this.get();
  }

  report(amount = 10, reason = "unknown") {
    const ts = this._now();

    this.value = clamp(this.value + asNumber(amount, 10), 0, 100);
    this.severity = this._calculateSeverity(this.value);

    const event = {
      ts,
      iso: this._iso(ts),
      type: "REPORT",
      amount,
      reason,
      value: this.value,
      severity: this.severity
    };

    this.history.push(event);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    return this.get();
  }

  reset() {
    const ts = this._now();

    this.value = 0;
    this.severity = DRIFT_SEVERITY.NORMAL;

    this.history.push({
      ts,
      iso: this._iso(ts),
      type: "RESET",
      value: 0,
      severity: DRIFT_SEVERITY.NORMAL
    });

    return this.get();
  }

  get() {
    return {
      value: this.value,
      severity: this.severity,
      tickCount: this._tickCount,
      thresholds: { ...this.thresholds }
    };
  }

  getHistory(count = 50) {
    return this.history.slice(-count);
  }

  createSnapshot() {
    return {
      value: this.value,
      severity: this.severity,
      tickCount: this._tickCount,
      history: this.history.slice(),
      thresholds: { ...this.thresholds }
    };
  }

  restoreSnapshot(snap) {
    if (!snap || typeof snap !== "object") return;
    this.value = snap.value ?? 0;
    this.severity = snap.severity ?? DRIFT_SEVERITY.NORMAL;
    this._tickCount = snap.tickCount ?? 0;
    this.history = Array.isArray(snap.history) ? snap.history.slice() : [];
    if (snap.thresholds) {
      this.thresholds = { ...this.thresholds, ...snap.thresholds };
    }
  }

  async persist() {
    await this._store.set(this.key, this.createSnapshot());
  }

  async load() {
    const saved = await this._store.get(this.key);
    if (saved && typeof saved === "object") {
      this.restoreSnapshot(saved);
    }
  }
}

/* ===================== Factory ===================== */

export async function createEnergySystem(opts = {}) {
  const storeWrapper = wrapStore(opts.store);
  const obs = new ObservabilityCore(storeWrapper, opts.prefix || "k1", opts.clock);
  await obs.load();
  const energy = new EnergyRing(opts);
  return { obs, energy, store: storeWrapper };
}