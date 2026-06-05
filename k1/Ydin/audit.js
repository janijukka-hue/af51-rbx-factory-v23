// k1/Ydin/audit.js
// Tamper-evident Audit Ledger - k1 kernel
// - Append-only chain
// - Hash verification
// - Deterministic IDs and timestamps
// - Async store
// - Seal support

const AUDIT_SCHEMA_VERSION = 1;

/* =============================================================================
   HELPERS
============================================================================= */

function nowMs(clock) {
  if (clock && typeof clock.now === "function") {
    return Number(clock.now());
  }
  return 0;
}

function isoFromCounter(ts) {
  return String(ts).padStart(20, "0");
}

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function stableStringify(x) {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stableStringify).join(",") + "]";
  const keys = Object.keys(x).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(x[k])).join(",") + "}";
}

function isPromise(x) {
  return !!x && typeof x.then === "function";
}

/* =============================================================================
   STORE WRAPPER (async)
============================================================================= */

function wrapStore(raw) {
  if (!raw) {
    const m = new Map();
    return {
      async get(k) { return m.get(k); },
      async set(k, v) { m.set(k, v); }
    };
  }

  if (raw instanceof Map) {
    return {
      async get(k) { return raw.get(k); },
      async set(k, v) { raw.set(k, v); }
    };
  }

  if (typeof raw.get === "function" && typeof raw.set === "function") {
    return {
      async get(k) {
        const r = raw.get(k);
        if (isPromise(r)) return await r;
        return r;
      },
      async set(k, v) {
        const r = raw.set(k, v);
        if (isPromise(r)) await r;
      }
    };
  }

  const m = new Map();
  return {
    async get(k) { return m.get(k); },
    async set(k, v) { m.set(k, v); }
  };
}

/* =============================================================================
   CONSTANTS
============================================================================= */

export const AUDIT_LEVEL = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
  CRITICAL: "CRITICAL"
};

export const AUDIT_AREA = {
  KERNEL: "KERNEL",
  MEMORY: "MEMORY",
  ENERGY: "ENERGY",
  POLICY: "POLICY",
  DECISION: "DECISION",
  ENTITY: "ENTITY",
  SYSTEM: "SYSTEM",
  EXTERNAL: "EXTERNAL"
};

/* =============================================================================
   SEAL PROVIDERS
============================================================================= */

export class NoopSeal {
  constructor() {
    this.kind = "NO_SEAL";
  }

  seal(input) {
    return "NO_SEAL";
  }
}

export class SimpleSeal {
  constructor(secret = "") {
    this.kind = "SIMPLE_SEAL";
    this.secret = String(secret);
  }

  seal(input) {
    return "SIMPLE_" + fnv1a32(this.secret + "::" + input);
  }
}

export class HMACSeal {
  constructor(secret = "") {
    this.kind = "HMAC_SEAL";
    this.secret = String(secret);
  }

  seal(input) {
    // Simplified HMAC-like seal using fnv1a32
    const inner = fnv1a32(this.secret + ":inner:" + input);
    const outer = fnv1a32(this.secret + ":outer:" + inner);
    return "HMAC_" + outer;
  }
}

/* =============================================================================
   DETERMINISTIC ID GENERATOR
============================================================================= */

class DeterministicIdGenerator {

  constructor(prefix, store) {
    this.prefix = prefix;
    this._store = store;
    this.key = `${prefix}:audit:id:counter`;
    this.counter = 0;
    this._loaded = false;
  }

  async load() {
    if (this._loaded) return;
    const saved = await this._store.get(this.key);
    if (typeof saved === "number" && Number.isFinite(saved)) {
      this.counter = saved;
    }
    this._loaded = true;
  }

  async next(salt = "") {
    await this.load();
    this.counter += 1;
    await this._store.set(this.key, this.counter);

    const base = `${this.prefix}:${this.counter}:${salt}`;
    const hash = fnv1a32(base);

    return `${this.prefix}_audit_${this.counter}_${hash}`;
  }

  getCounter() {
    return this.counter;
  }
}

/* =============================================================================
   AUDIT LEDGER
============================================================================= */

export class AuditLedger {

  constructor(opts = {}) {
    this._store = wrapStore(opts.store);
    this.prefix = String(opts.prefix || "k1");
    this.clock = opts.clock || null;
    this.seal = opts.seal || new NoopSeal();

    this.keyChain = `${this.prefix}:audit:chain:v${AUDIT_SCHEMA_VERSION}`;
    this.keyTip = `${this.prefix}:audit:tip`;
    this.keyMeta = `${this.prefix}:audit:meta`;

    this.idGen = new DeterministicIdGenerator(this.prefix, this._store);

    this.chain = [];
    this.tipHash = "GENESIS";

    this._loaded = false;
    this._counter = 0;
  }

  _now() {
    return nowMs(this.clock);
  }

  _iso(ts) {
    return isoFromCounter(ts);
  }

  /* =========================================================
     LOAD / SAVE
  ========================================================= */

  async load() {
    if (this._loaded) return;

    await this.idGen.load();

    const savedChain = await this._store.get(this.keyChain);
    const savedTip = await this._store.get(this.keyTip);

    if (Array.isArray(savedChain)) {
      this.chain = savedChain;
    }

    if (typeof savedTip === "string") {
      this.tipHash = savedTip;
    } else if (this.chain.length > 0) {
      this.tipHash = this.chain[this.chain.length - 1].hash;
    }

    this._loaded = true;
  }

  async _save() {
    await this._store.set(this.keyChain, this.chain);
    await this._store.set(this.keyTip, this.tipHash);
    await this._store.set(this.keyMeta, {
      count: this.chain.length,
      tipHash: this.tipHash,
      version: AUDIT_SCHEMA_VERSION
    });
  }

  /* =========================================================
     RECORD
  ========================================================= */

  async record(area, action, meta = {}, level = AUDIT_LEVEL.INFO) {
    await this.load();

    const ts = this._now();
    this._counter += 1;

    const prevHash = this.tipHash;
    const id = await this.idGen.next(`${area}:${action}`);

    const event = {
      id,
      ts,
      iso: this._iso(ts),
      level,
      area,
      action,
      meta,
      prevHash
    };

    // Compute hash
    const payload = stableStringify(event);
    const hash = fnv1a32(payload);

    // Add seal
    const sealValue = this.seal.seal(payload + ":" + hash);
    const sealKind = this.seal.kind;

    const fullEvent = Object.freeze({
      ...event,
      hash,
      seal: sealValue,
      sealKind
    });

    this.chain.push(fullEvent);
    this.tipHash = hash;

    await this._save();

    return fullEvent;
  }

  /* =========================================================
     CONVENIENCE RECORD METHODS
  ========================================================= */

  async debug(area, action, meta = {}) {
    return this.record(area, action, meta, AUDIT_LEVEL.DEBUG);
  }

  async info(area, action, meta = {}) {
    return this.record(area, action, meta, AUDIT_LEVEL.INFO);
  }

  async warn(area, action, meta = {}) {
    return this.record(area, action, meta, AUDIT_LEVEL.WARN);
  }

  async error(area, action, meta = {}) {
    return this.record(area, action, meta, AUDIT_LEVEL.ERROR);
  }

  async critical(area, action, meta = {}) {
    return this.record(area, action, meta, AUDIT_LEVEL.CRITICAL);
  }

  /* =========================================================
     VERIFY
  ========================================================= */

  verify() {
    let prevHash = "GENESIS";

    for (let i = 0; i < this.chain.length; i++) {
      const event = this.chain[i];

      // Check chain linkage
      if (event.prevHash !== prevHash) {
        return {
          ok: false,
          badIndex: i,
          error: `Chain break at index ${i}: expected prevHash ${prevHash}, got ${event.prevHash}`
        };
      }

      // Recompute hash
      const payload = stableStringify({
        id: event.id,
        ts: event.ts,
        iso: event.iso,
        level: event.level,
        area: event.area,
        action: event.action,
        meta: event.meta,
        prevHash: event.prevHash
      });

      const recomputedHash = fnv1a32(payload);

      if (recomputedHash !== event.hash) {
        return {
          ok: false,
          badIndex: i,
          error: `Hash mismatch at index ${i}: expected ${recomputedHash}, got ${event.hash}`
        };
      }

      prevHash = event.hash;
    }

    return {
      ok: true,
      count: this.chain.length,
      tipHash: this.tipHash
    };
  }

  /* =========================================================
     QUERIES
  ========================================================= */

  tail(n = 20) {
    return this.chain.slice(-Math.max(0, n));
  }

  head(n = 20) {
    return this.chain.slice(0, Math.max(0, n));
  }

  getByArea(area, limit = 50) {
    return this.chain.filter(e => e.area === area).slice(-limit);
  }

  getByAction(action, limit = 50) {
    return this.chain.filter(e => e.action === action).slice(-limit);
  }

  getByLevel(level, limit = 50) {
    return this.chain.filter(e => e.level === level).slice(-limit);
  }

  getProblems(limit = 100) {
    return this.chain.filter(e =>
      e.level === AUDIT_LEVEL.ERROR ||
      e.level === AUDIT_LEVEL.CRITICAL
    ).slice(-limit);
  }

  getById(id) {
    return this.chain.find(e => e.id === id) || null;
  }

  getByHash(hash) {
    return this.chain.find(e => e.hash === hash) || null;
  }

  search(predicate, limit = 50) {
    if (typeof predicate !== "function") return [];
    return this.chain.filter(predicate).slice(-limit);
  }

  /* =========================================================
     EXPORT
  ========================================================= */

  exportAll() {
    return [...this.chain];
  }

  export() {
    return {
      version: AUDIT_SCHEMA_VERSION,
      tipHash: this.tipHash,
      count: this.chain.length,
      integrity: this.verify(),
      events: this.chain
    };
  }

  exportRange(startIndex, endIndex) {
    return this.chain.slice(startIndex, endIndex);
  }

  /* =========================================================
     STATE
  ========================================================= */

  getTip() {
    return this.tipHash;
  }

  count() {
    return this.chain.length;
  }

  getStats() {
    const stats = {
      total: this.chain.length,
      tipHash: this.tipHash,
      byLevel: {},
      byArea: {}
    };

    for (const event of this.chain) {
      stats.byLevel[event.level] = (stats.byLevel[event.level] || 0) + 1;
      stats.byArea[event.area] = (stats.byArea[event.area] || 0) + 1;
    }

    return stats;
  }

  /* =========================================================
     CLEAR (use with caution)
  ========================================================= */

  async clear() {
    this.chain = [];
    this.tipHash = "GENESIS";
    await this._save();
  }
}

/* =============================================================================
   FACTORY
============================================================================= */

export async function createAuditLedger(opts = {}) {
  const ledger = new AuditLedger(opts);
  await ledger.load();
  return ledger;
}

export default {
  AuditLedger,
  createAuditLedger,
  NoopSeal,
  SimpleSeal,
  HMACSeal,
  AUDIT_LEVEL,
  AUDIT_AREA
};