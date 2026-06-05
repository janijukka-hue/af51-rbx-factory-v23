// k1/Ydin/paatos.js
// Decision Court - k1 kernel päätöksenteko
// - Deterministinen
// - Audit-hooked
// - Policy-integrated
// - Memory-aware

const DECISION_SCHEMA_VERSION = 1;

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

/* =============================================================================
   CONSTANTS
============================================================================= */

export const DECISION_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DENIED: "DENIED",
  DEFERRED: "DEFERRED",
  ERROR: "ERROR"
};

export const DECISION_PRIORITY = {
  CRITICAL: 10,
  HIGH: 8,
  NORMAL: 5,
  LOW: 3,
  BACKGROUND: 1
};

export const DECISION_DOMAIN = {
  SYSTEM: "SYSTEM",
  ENTITY: "ENTITY",
  RESOURCE: "RESOURCE",
  POLICY: "POLICY",
  EXTERNAL: "EXTERNAL"
};

/* =============================================================================
   DECISION COURT
============================================================================= */

export class DecisionCourt {

  constructor(opts = {}) {
    this.clock = opts.clock || null;
    this.prefix = String(opts.prefix || "k1");
    this.obs = opts.obs || null;
    this.drift = opts.drift || null;
    this.memory = opts.memory || null;
    this.onDecide = typeof opts.onDecide === "function" ? opts.onDecide : null;

    this._counter = 0;
    this._pending = [];
    this._history = [];
    this._historyLimit = opts.historyLimit || 500;

    this._stats = {
      total: 0,
      approved: 0,
      denied: 0,
      deferred: 0,
      errors: 0
    };
  }

  /* =========================================================
     CORE DECISION
  ========================================================= */

  async decide(input) {
    if (!input || typeof input !== "object") {
      return this._createResult(null, DECISION_STATUS.ERROR, "Invalid input");
    }

    const ts = nowMs(this.clock);
    this._counter += 1;

    const request = {
      id: this._generateId(ts),
      ts: ts,
      iso: isoFromCounter(ts),
      domain: input.domain || DECISION_DOMAIN.SYSTEM,
      priority: input.priority || DECISION_PRIORITY.NORMAL,
      action: input.action || "UNKNOWN",
      payload: input.payload || {},
      context: input.context || {},
      requestedBy: input.requestedBy || "SYSTEM"
    };

    // Bump observability
    if (this.obs) {
      this.obs.bump("decisions:requested", 1);
    }

    // Evaluate decision
    const evaluation = this._evaluate(request);

    // Create result
    const result = this._createResult(request, evaluation.status, evaluation.reason, evaluation.data);

    // Update stats
    this._updateStats(result.status);

    // Store in history
    this._addToHistory(result);

    // Callback
    if (this.onDecide) {
      try {
        await this.onDecide(result);
      } catch (err) {
        if (this.obs) {
          this.obs.error("decision", "CALLBACK_ERROR", err.message);
        }
      }
    }

    return result;
  }

  /* =========================================================
     EVALUATION LOGIC
  ========================================================= */

  _evaluate(request) {
    // Check drift state
    if (this.drift) {
      const driftState = this.drift.get ? this.drift.get() : null;
      if (driftState && driftState.severity === "CRITICAL") {
        return {
          status: DECISION_STATUS.DENIED,
          reason: "System drift critical - decisions suspended",
          data: { drift: driftState }
        };
      }
    }

    // Check memory pressure
    if (this.memory) {
      const memState = this.memory.getState ? this.memory.getState() : null;
      if (memState && memState.pressure > 90) {
        if (request.priority < DECISION_PRIORITY.HIGH) {
          return {
            status: DECISION_STATUS.DEFERRED,
            reason: "Memory pressure high - low priority deferred",
            data: { memoryPressure: memState.pressure }
          };
        }
      }
    }

    // Priority-based quick decisions
    if (request.priority >= DECISION_PRIORITY.CRITICAL) {
      return {
        status: DECISION_STATUS.APPROVED,
        reason: "Critical priority auto-approved",
        data: {}
      };
    }

    // Domain-specific evaluation
    switch (request.domain) {
      case DECISION_DOMAIN.SYSTEM:
        return this._evaluateSystem(request);

      case DECISION_DOMAIN.ENTITY:
        return this._evaluateEntity(request);

      case DECISION_DOMAIN.RESOURCE:
        return this._evaluateResource(request);

      case DECISION_DOMAIN.POLICY:
        return this._evaluatePolicy(request);

      case DECISION_DOMAIN.EXTERNAL:
        return this._evaluateExternal(request);

      default:
        return {
          status: DECISION_STATUS.APPROVED,
          reason: "Default approval",
          data: {}
        };
    }
  }

  _evaluateSystem(request) {
    // System-level decisions - generally approved if not in crisis
    return {
      status: DECISION_STATUS.APPROVED,
      reason: "System action approved",
      data: {}
    };
  }

  _evaluateEntity(request) {
    // Entity actions need valid payload
    if (!request.payload || !request.payload.entityId) {
      return {
        status: DECISION_STATUS.DENIED,
        reason: "Entity action requires entityId",
        data: {}
      };
    }

    return {
      status: DECISION_STATUS.APPROVED,
      reason: "Entity action approved",
      data: { entityId: request.payload.entityId }
    };
  }

  _evaluateResource(request) {
    // Resource allocation checks
    const amount = request.payload?.amount || 0;

    if (amount > 1000) {
      return {
        status: DECISION_STATUS.DEFERRED,
        reason: "Large resource allocation requires review",
        data: { amount }
      };
    }

    return {
      status: DECISION_STATUS.APPROVED,
      reason: "Resource allocation approved",
      data: { amount }
    };
  }

  _evaluatePolicy(request) {
    // Policy changes are sensitive
    if (request.priority < DECISION_PRIORITY.HIGH) {
      return {
        status: DECISION_STATUS.DENIED,
        reason: "Policy changes require HIGH priority",
        data: {}
      };
    }

    return {
      status: DECISION_STATUS.APPROVED,
      reason: "Policy change approved",
      data: {}
    };
  }

  _evaluateExternal(request) {
    // External requests are treated cautiously
    return {
      status: DECISION_STATUS.DEFERRED,
      reason: "External request queued for review",
      data: {}
    };
  }

  /* =========================================================
     RESULT CONSTRUCTION
  ========================================================= */

  _createResult(request, status, reason, data = {}) {
    const ts = nowMs(this.clock);

    const result = {
      id: request ? request.id : this._generateId(ts),
      requestId: request ? request.id : null,
      ts: ts,
      iso: isoFromCounter(ts),
      status: status,
      reason: reason,
      data: data,
      request: request,
      version: DECISION_SCHEMA_VERSION
    };

    // Generate hash for audit
    result.hash = fnv1a32(stableStringify({
      id: result.id,
      ts: result.ts,
      status: result.status,
      reason: result.reason
    }));

    return Object.freeze(result);
  }

  _generateId(ts) {
    const paddedCounter = String(this._counter).padStart(8, "0");
    const paddedTs = String(ts).padStart(12, "0");
    return `${this.prefix}:decision:${paddedCounter}:${paddedTs}`;
  }

  /* =========================================================
     HISTORY & STATS
  ========================================================= */

  _addToHistory(result) {
    this._history.push(result);
    if (this._history.length > this._historyLimit) {
      this._history.shift();
    }
  }

  _updateStats(status) {
    this._stats.total += 1;

    switch (status) {
      case DECISION_STATUS.APPROVED:
        this._stats.approved += 1;
        break;
      case DECISION_STATUS.DENIED:
        this._stats.denied += 1;
        break;
      case DECISION_STATUS.DEFERRED:
        this._stats.deferred += 1;
        break;
      case DECISION_STATUS.ERROR:
        this._stats.errors += 1;
        break;
    }

    // Update observability gauges
    if (this.obs) {
      this.obs.setGauge("decisions:total", this._stats.total);
      this.obs.setGauge("decisions:approved", this._stats.approved);
      this.obs.setGauge("decisions:denied", this._stats.denied);
    }
  }

  /* =========================================================
     QUERIES
  ========================================================= */

  getHistory(count = 100) {
    return this._history.slice(-count);
  }

  getByStatus(status, count = 50) {
    return this._history.filter(r => r.status === status).slice(-count);
  }

  getByDomain(domain, count = 50) {
    return this._history.filter(r => r.request?.domain === domain).slice(-count);
  }

  getPending() {
    return [...this._pending];
  }

  getStats() {
    return { ...this._stats };
  }

  getHealthSnapshot() {
    const approvalRate = this._stats.total > 0
      ? Math.round((this._stats.approved / this._stats.total) * 100)
      : 100;

    return {
      total: this._stats.total,
      approved: this._stats.approved,
      denied: this._stats.denied,
      deferred: this._stats.deferred,
      errors: this._stats.errors,
      approvalRate: approvalRate,
      pendingCount: this._pending.length,
      historySize: this._history.length
    };
  }

  /* =========================================================
     MANUAL CONTROLS
  ========================================================= */

  approvePending(id) {
    const idx = this._pending.findIndex(r => r.id === id);
    if (idx === -1) return null;

    const request = this._pending.splice(idx, 1)[0];
    return this._createResult(request, DECISION_STATUS.APPROVED, "Manually approved", {});
  }

  denyPending(id, reason = "Manually denied") {
    const idx = this._pending.findIndex(r => r.id === id);
    if (idx === -1) return null;

    const request = this._pending.splice(idx, 1)[0];
    return this._createResult(request, DECISION_STATUS.DENIED, reason, {});
  }

  clearHistory() {
    this._history = [];
  }

  resetStats() {
    this._stats = {
      total: 0,
      approved: 0,
      denied: 0,
      deferred: 0,
      errors: 0
    };
  }
}

/* =============================================================================
   FACTORY
============================================================================= */

export function createDecisionCourt(opts = {}) {
  return new DecisionCourt(opts);
}

export default {
  DecisionCourt,
  createDecisionCourt,
  DECISION_STATUS,
  DECISION_PRIORITY,
  DECISION_DOMAIN
};