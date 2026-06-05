// m2/Ohjaus/intent-handler.js
// M2 Intent Handler - käskyjen parsinta ja reititys
// - Intent tunnistus
// - Validointi
// - Routing
// - Handler registry

import { fnv1a32 } from "../../k1/Ydin/alydin.js";
import { DECISION_PRIORITY, DECISION_DOMAIN } from "../../k1/Ydin/paatos.js";
import { AL_ROLE } from "../../k1/Ydin/policy.js";

const INTENT_HANDLER_VERSION = "1.0.0";

/* =============================================================================
   INTENT TYPES
============================================================================= */

export const INTENT_TYPE = {
  // System
  SYSTEM_STATUS: "SYSTEM_STATUS",
  SYSTEM_SHUTDOWN: "SYSTEM_SHUTDOWN",
  SYSTEM_RESET: "SYSTEM_RESET",

  // Memory
  MEMORY_READ: "MEMORY_READ",
  MEMORY_WRITE: "MEMORY_WRITE",
  MEMORY_SNAPSHOT: "MEMORY_SNAPSHOT",
  MEMORY_ROLLBACK: "MEMORY_ROLLBACK",

  // Entity
  ENTITY_CREATE: "ENTITY_CREATE",
  ENTITY_UPDATE: "ENTITY_UPDATE",
  ENTITY_DELETE: "ENTITY_DELETE",
  ENTITY_QUERY: "ENTITY_QUERY",

  // Decision
  DECISION_REQUEST: "DECISION_REQUEST",
  DECISION_APPROVE: "DECISION_APPROVE",
  DECISION_DENY: "DECISION_DENY",

  // Policy
  POLICY_SET_MODE: "POLICY_SET_MODE",
  POLICY_EVALUATE: "POLICY_EVALUATE",

  // Learning
  LEARN: "LEARN",
  REFLECT: "REFLECT",

  // Custom
  CUSTOM: "CUSTOM",
  UNKNOWN: "UNKNOWN"
};

/* =============================================================================
   INTENT STATUS
============================================================================= */

export const INTENT_STATUS = {
  PENDING: "PENDING",
  VALIDATED: "VALIDATED",
  ROUTED: "ROUTED",
  HANDLED: "HANDLED",
  FAILED: "FAILED",
  REJECTED: "REJECTED"
};

/* =============================================================================
   INTENT HANDLER
============================================================================= */

export class IntentHandler {

  constructor(opts = {}) {
    this.cfg = {
      prefix: opts.prefix || "m2",
      maxPayloadSize: opts.maxPayloadSize || 65536,
      allowUnknown: opts.allowUnknown || false,
      ...opts.config
    };

    this.clock = opts.clock || { now: () => Date.now() };
    this.orchestrator = opts.orchestrator || null;

    // Handler registry
    this._handlers = new Map();
    this._middlewares = [];

    // Stats
    this._stats = {
      total: 0,
      handled: 0,
      failed: 0,
      rejected: 0,
      byType: {}
    };

    // History
    this._history = [];
    this._historyLimit = opts.historyLimit || 200;

    // Register default handlers
    this._registerDefaultHandlers();
  }

  /* =========================================================
     HANDLER REGISTRY
  ========================================================= */

  register(intentType, handler) {
    if (typeof handler !== "function") {
      throw new Error("Handler must be a function");
    }
    this._handlers.set(intentType, handler);
    return this;
  }

  unregister(intentType) {
    this._handlers.delete(intentType);
    return this;
  }

  hasHandler(intentType) {
    return this._handlers.has(intentType);
  }

  /* =========================================================
     MIDDLEWARE
  ========================================================= */

  use(middleware) {
    if (typeof middleware !== "function") {
      throw new Error("Middleware must be a function");
    }
    this._middlewares.push(middleware);
    return this;
  }

  /* =========================================================
     PARSE & VALIDATE
  ========================================================= */

  parse(input) {
    if (!input) {
      return {
        ok: false,
        error: "Empty input"
      };
    }

    // String input
    if (typeof input === "string") {
      const parsed = this._parseString(input);
      return {
        ok: true,
        intent: parsed
      };
    }

    // Object input
    if (typeof input === "object") {
      const parsed = this._parseObject(input);
      return {
        ok: true,
        intent: parsed
      };
    }

    return {
      ok: false,
      error: "Invalid input type"
    };
  }

  _parseString(str) {
    const trimmed = str.trim();
    const upper = trimmed.toUpperCase();

    // Check for known intent types
    for (const [key, value] of Object.entries(INTENT_TYPE)) {
      if (upper === value || upper === key) {
        return this._createIntent(value, {});
      }
    }

    // Check for prefixed commands
    if (upper.startsWith("MEMORY:")) {
      const action = upper.replace("MEMORY:", "").trim();
      return this._createIntent(`MEMORY_${action}`, { raw: trimmed });
    }

    if (upper.startsWith("ENTITY:")) {
      const action = upper.replace("ENTITY:", "").trim();
      return this._createIntent(`ENTITY_${action}`, { raw: trimmed });
    }

    if (upper.startsWith("POLICY:")) {
      const action = upper.replace("POLICY:", "").trim();
      return this._createIntent(`POLICY_${action}`, { raw: trimmed });
    }

    // Default: treat as custom intent
    return this._createIntent(INTENT_TYPE.CUSTOM, { raw: trimmed, action: trimmed });
  }

  _parseObject(obj) {
    const type = this._resolveType(obj.type || obj.intent || obj.action);
    
    return this._createIntent(type, {
      ...obj.payload,
      _original: obj
    }, {
      priority: obj.priority,
      role: obj.role,
      domain: obj.domain,
      context: obj.context
    });
  }

  _resolveType(typeStr) {
    if (!typeStr) return INTENT_TYPE.UNKNOWN;

    const upper = String(typeStr).toUpperCase().replace(/-/g, "_").replace(/\s+/g, "_");

    // Direct match
    if (Object.values(INTENT_TYPE).includes(upper)) {
      return upper;
    }

    // Key match
    if (INTENT_TYPE[upper]) {
      return INTENT_TYPE[upper];
    }

    return INTENT_TYPE.UNKNOWN;
  }

  _createIntent(type, payload = {}, opts = {}) {
    const ts = this.clock.now();

    return {
      id: this._generateId(ts),
      type: type,
      payload: payload,
      priority: opts.priority || DECISION_PRIORITY.NORMAL,
      role: opts.role || AL_ROLE.AL2,
      domain: opts.domain || DECISION_DOMAIN.SYSTEM,
      context: opts.context || {},
      createdAt: ts,
      status: INTENT_STATUS.PENDING
    };
  }

  _generateId(ts) {
    return `intent:${ts}:${fnv1a32(String(ts) + String(Math.random()))}`;
  }

  validate(intent) {
    const errors = [];

    if (!intent) {
      errors.push("Intent is null");
      return { valid: false, errors };
    }

    if (!intent.type) {
      errors.push("Missing intent type");
    }

    if (intent.type === INTENT_TYPE.UNKNOWN && !this.cfg.allowUnknown) {
      errors.push("Unknown intent type not allowed");
    }

    if (intent.payload) {
      const payloadStr = JSON.stringify(intent.payload);
      if (payloadStr.length > this.cfg.maxPayloadSize) {
        errors.push(`Payload too large: ${payloadStr.length} > ${this.cfg.maxPayloadSize}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /* =========================================================
     HANDLE
  ========================================================= */

  async handle(input) {
    this._stats.total += 1;

    // Parse
    const parseResult = this.parse(input);
    if (!parseResult.ok) {
      this._stats.failed += 1;
      return {
        ok: false,
        code: "PARSE_ERROR",
        error: parseResult.error
      };
    }

    let intent = parseResult.intent;

    // Validate
    const validation = this.validate(intent);
    if (!validation.valid) {
      this._stats.rejected += 1;
      intent.status = INTENT_STATUS.REJECTED;
      this._addToHistory(intent);

      return {
        ok: false,
        code: "VALIDATION_ERROR",
        errors: validation.errors,
        intentId: intent.id
      };
    }

    intent.status = INTENT_STATUS.VALIDATED;

    // Run middlewares
    try {
      for (const middleware of this._middlewares) {
        intent = await middleware(intent, this);
        if (!intent) {
          this._stats.rejected += 1;
          return {
            ok: false,
            code: "MIDDLEWARE_REJECTED",
            intentId: intent?.id
          };
        }
      }
    } catch (err) {
      this._stats.failed += 1;
      intent.status = INTENT_STATUS.FAILED;
      this._addToHistory(intent);

      return {
        ok: false,
        code: "MIDDLEWARE_ERROR",
        error: err.message,
        intentId: intent.id
      };
    }

    // Route to handler
    intent.status = INTENT_STATUS.ROUTED;

    const handler = this._handlers.get(intent.type) || this._handlers.get(INTENT_TYPE.UNKNOWN);

    if (!handler) {
      this._stats.failed += 1;
      intent.status = INTENT_STATUS.FAILED;
      this._addToHistory(intent);

      return {
        ok: false,
        code: "NO_HANDLER",
        error: `No handler for intent type: ${intent.type}`,
        intentId: intent.id
      };
    }

    // Execute handler
    try {
      const result = await handler(intent, this);

      this._stats.handled += 1;
      this._stats.byType[intent.type] = (this._stats.byType[intent.type] || 0) + 1;

      intent.status = INTENT_STATUS.HANDLED;
      this._addToHistory(intent);

      return {
        ok: true,
        code: "HANDLED",
        intentId: intent.id,
        intentType: intent.type,
        result: result
      };

    } catch (err) {
      this._stats.failed += 1;
      intent.status = INTENT_STATUS.FAILED;
      this._addToHistory(intent);

      return {
        ok: false,
        code: "HANDLER_ERROR",
        error: err.message,
        intentId: intent.id
      };
    }
  }

  /* =========================================================
     DEFAULT HANDLERS
  ========================================================= */

  _registerDefaultHandlers() {
    // System
    this.register(INTENT_TYPE.SYSTEM_STATUS, async (intent) => {
      if (!this.orchestrator) return { status: "no_orchestrator" };
      return this.orchestrator.getState();
    });

    // Memory read
    this.register(INTENT_TYPE.MEMORY_READ, async (intent) => {
      if (!this.orchestrator) throw new Error("No orchestrator");
      const tier = intent.payload?.tier || "R2";
      const count = intent.payload?.count || 10;
      return this.orchestrator.readMemory(tier, count);
    });

    // Memory write
    this.register(INTENT_TYPE.MEMORY_WRITE, async (intent) => {
      if (!this.orchestrator) throw new Error("No orchestrator");
      const summary = intent.payload?.summary || "";
      const domain = intent.payload?.domain || "SYSTEM";
      const tier = intent.payload?.tier || "R2";
      return this.orchestrator.addMemory(summary, domain, tier);
    });

    // Memory snapshot
    this.register(INTENT_TYPE.MEMORY_SNAPSHOT, async (intent) => {
      if (!this.orchestrator) throw new Error("No orchestrator");
      const label = intent.payload?.label || "manual";
      return this.orchestrator.snapshotMemory(label);
    });

    // Decision request
    this.register(INTENT_TYPE.DECISION_REQUEST, async (intent) => {
      if (!this.orchestrator) throw new Error("No orchestrator");
      return this.orchestrator.decide({
        domain: intent.domain,
        priority: intent.priority,
        action: intent.payload?.action || "custom",
        payload: intent.payload,
        requestedBy: intent.role
      });
    });

    // Policy evaluate
    this.register(INTENT_TYPE.POLICY_EVALUATE, async (intent) => {
      if (!this.orchestrator) throw new Error("No orchestrator");
      const role = intent.payload?.role || intent.role;
      const action = intent.payload?.action || "READ";
      return this.orchestrator.evaluatePolicy(role, action, intent.context);
    });

    // Policy set mode
    this.register(INTENT_TYPE.POLICY_SET_MODE, async (intent) => {
      if (!this.orchestrator) throw new Error("No orchestrator");
      const mode = intent.payload?.mode;
      if (!mode) throw new Error("Mode required");
      this.orchestrator.setMode(mode);
      return { mode };
    });

    // Unknown fallback
    this.register(INTENT_TYPE.UNKNOWN, async (intent) => {
      return {
        message: "Unknown intent",
        type: intent.type,
        payload: intent.payload
      };
    });

    // Custom fallback
    this.register(INTENT_TYPE.CUSTOM, async (intent) => {
      // Custom intents go through orchestrator.execute
      if (!this.orchestrator) throw new Error("No orchestrator");
      return this.orchestrator.execute({
        intent: intent.payload?.action || "custom",
        payload: intent.payload,
        priority: intent.priority,
        role: intent.role,
        domain: intent.domain
      });
    });
  }

  /* =========================================================
     HISTORY
  ========================================================= */

  _addToHistory(intent) {
    this._history.push({
      id: intent.id,
      type: intent.type,
      status: intent.status,
      createdAt: intent.createdAt,
      handledAt: this.clock.now()
    });

    if (this._history.length > this._historyLimit) {
      this._history.shift();
    }
  }

  getHistory(count = 50) {
    return this._history.slice(-count);
  }

  /* =========================================================
     STATE
  ========================================================= */

  getStats() {
    return {
      ...this._stats,
      registeredHandlers: this._handlers.size,
      middlewareCount: this._middlewares.length,
      historySize: this._history.length
    };
  }

  reset() {
    this._stats = {
      total: 0,
      handled: 0,
      failed: 0,
      rejected: 0,
      byType: {}
    };
    this._history = [];
  }

  /* =========================================================
     ORCHESTRATOR
  ========================================================= */

  setOrchestrator(orchestrator) {
    this.orchestrator = orchestrator;
    return this;
  }
}

/* =============================================================================
   FACTORY
============================================================================= */

export function createIntentHandler(opts = {}) {
  return new IntentHandler(opts);
}

/* =============================================================================
   EXPORTS
============================================================================= */

export {
  INTENT_HANDLER_VERSION
};

export default IntentHandler;