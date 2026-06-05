// k1/Ydin/enterprise-al-core.js
// Enterprise AL Core - k1 Facade
// - Kevyt wrapper k1-primitiiveille
// - Entry point k1-ytimen käyttöön
// - Delegoi Kernelille ja muille k1-moduuleille

import Kernel from "./kernel.js";
import { EventBus } from "./eventbus.js";
import { createEnergySystem, EnergyRing, DriftController, ObservabilityCore, ENERGY_SIGNAL, DRIFT_SEVERITY } from "./energia.js";
import { createMemorySystem, MemoryRing, COOLING_LEVEL, REDACTION, RING_TIER, MEMORY_SIGNAL } from "./muisti.js";
import { createDecisionCourt, DecisionCourt, DECISION_STATUS, DECISION_PRIORITY, DECISION_DOMAIN } from "./paatos.js";
import { createPolicyEngine, PolicyEngine, AL_ROLE, ACTION_TYPE, POLICY_MODE } from "./policy.js";
import { createAuditLedger, AuditLedger, NoopSeal, SimpleSeal, HMACSeal, AUDIT_LEVEL, AUDIT_AREA } from "./audit.js";
import { fnv1a32, stableStringify, DeterministicRuntime, ENERGY_COSTS, COOLING, PRIORITY } from "./alydin.js";
import { SystemClock, FixedClock, MemoryStorage } from "./core-seams.js";

const CORE_VERSION = "2.0.0";

/* =============================================================================
   DEFAULT CONFIG
============================================================================= */

const DEFAULT_CONFIG = {
  prefix: "k1",
  owner: "SYSTEM",
  deterministic: true,
  heartbeatMs: 250,
  eventHistoryLimit: 1000,
  auditEnabled: true,
  sealType: "SIMPLE",
  sealSecret: ""
};

/* =============================================================================
   ENTERPRISE AL CORE - K1 FACADE
============================================================================= */

export class EnterpriseALCore {

  constructor(opts = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...opts.config };
    this.version = CORE_VERSION;

    // Seams - injektoitavat riippuvuudet
    this.clock = opts.clock || new SystemClock();
    this.store = opts.store || new MemoryStorage();

    // Core components (luodaan init():ssä)
    this.kernel = null;
    this.audit = null;

    // State
    this._initialized = false;
    this._sessionId = null;
  }

  /* =========================================================
     INITIALIZATION
  ========================================================= */

  async init() {
    if (this._initialized) return this;

    // Generate session ID
    const ts = this.clock.now();
    this._sessionId = `session_${this.cfg.prefix}_${ts}_${fnv1a32(String(ts))}`;

    // Create audit ledger
    if (this.cfg.auditEnabled) {
      const seal = this._createSeal();
      this.audit = await createAuditLedger({
        store: this.store,
        prefix: this.cfg.prefix,
        clock: this.clock,
        seal: seal
      });

      await this.audit.info(AUDIT_AREA.SYSTEM, "CORE_INIT_START", {
        sessionId: this._sessionId,
        version: this.version
      });
    }

    // Create kernel
    this.kernel = new Kernel({
      prefix: this.cfg.prefix,
      clock: this.clock,
      store: this.store,
      hbMs: this.cfg.heartbeatMs,
      eventHistoryLimit: this.cfg.eventHistoryLimit
    });

    // Wire audit to kernel events
    if (this.audit) {
      this.kernel.onAll(async (event) => {
        await this.audit.debug(AUDIT_AREA.KERNEL, event.type, {
          eventId: event.id,
          payload: event.payload
        });
      });
    }

    // Start kernel
    await this.kernel.start();

    this._initialized = true;

    if (this.audit) {
      await this.audit.info(AUDIT_AREA.SYSTEM, "CORE_INIT_COMPLETE", {
        sessionId: this._sessionId,
        kernelRunning: this.kernel.getState().running
      });
    }

    return this;
  }

  _createSeal() {
    switch (this.cfg.sealType) {
      case "HMAC":
        return new HMACSeal(this.cfg.sealSecret);
      case "SIMPLE":
        return new SimpleSeal(this.cfg.sealSecret);
      case "NONE":
      default:
        return new NoopSeal();
    }
  }

  /* =========================================================
     LIFECYCLE
  ========================================================= */

  async start() {
    if (!this._initialized) {
      await this.init();
    }
    return this;
  }

  async stop() {
    if (!this._initialized) return;

    if (this.audit) {
      await this.audit.info(AUDIT_AREA.SYSTEM, "CORE_STOP", {
        sessionId: this._sessionId
      });
    }

    if (this.kernel) {
      await this.kernel.stop();
    }

    this._initialized = false;
  }

  /* =========================================================
     COMMAND HANDLING
  ========================================================= */

  async handle(command) {
    this._ensureInitialized();

    const cmd = this._normalizeCommand(command);

    // Audit command receipt
    if (this.audit) {
      await this.audit.info(AUDIT_AREA.SYSTEM, "COMMAND_RECEIVED", {
        id: cmd.id,
        intent: cmd.intent,
        priority: cmd.priority
      });
    }

    // Emit event
    this.kernel.emit("command:received", { command: cmd });

    // Evaluate policy
    const policyResult = this.kernel.evaluatePolicy(
      cmd.role || AL_ROLE.AL2,
      cmd.intent,
      {
        energyAvailable: this.kernel.energy?.status?.().energy || 100,
        memoryPressure: this.kernel.memory?.getState?.().pressure || 0
      }
    );

    if (!policyResult.allowed) {
      if (this.audit) {
        await this.audit.warn(AUDIT_AREA.POLICY, "COMMAND_DENIED", {
          id: cmd.id,
          intent: cmd.intent,
          reason: policyResult.reason
        });
      }

      this.kernel.emit("command:denied", { command: cmd, reason: policyResult.reason });

      return {
        ok: false,
        code: "POLICY_DENY",
        reason: policyResult.reason,
        commandId: cmd.id
      };
    }

    // Make decision
    const decision = await this.kernel.decide({
      domain: cmd.domain || DECISION_DOMAIN.SYSTEM,
      priority: cmd.priority || DECISION_PRIORITY.NORMAL,
      action: cmd.intent,
      payload: cmd.payload,
      requestedBy: cmd.role || "SYSTEM",
      context: cmd.context || {}
    });

    if (this.audit) {
      await this.audit.info(AUDIT_AREA.DECISION, "COMMAND_DECIDED", {
        commandId: cmd.id,
        decisionId: decision.id,
        status: decision.status
      });
    }

    this.kernel.emit("command:decided", { command: cmd, decision });

    return {
      ok: decision.status === DECISION_STATUS.APPROVED,
      code: decision.status,
      reason: decision.reason,
      commandId: cmd.id,
      decisionId: decision.id,
      decision: decision
    };
  }

  _normalizeCommand(cmdLike) {
    if (!cmdLike) {
      throw new Error("Empty command");
    }

    if (typeof cmdLike === "string") {
      return {
        id: this._generateId("cmd"),
        intent: cmdLike,
        payload: {},
        priority: DECISION_PRIORITY.NORMAL,
        role: AL_ROLE.AL2,
        issuedAt: this.clock.now()
      };
    }

    return {
      id: cmdLike.id || this._generateId("cmd"),
      intent: cmdLike.intent || cmdLike.type || "UNKNOWN",
      payload: cmdLike.payload || {},
      priority: cmdLike.priority || DECISION_PRIORITY.NORMAL,
      role: cmdLike.role || AL_ROLE.AL2,
      domain: cmdLike.domain || DECISION_DOMAIN.SYSTEM,
      context: cmdLike.context || {},
      issuedAt: cmdLike.issuedAt || this.clock.now()
    };
  }

  _generateId(prefix) {
    const ts = this.clock.now();
    return `${prefix}_${ts}_${fnv1a32(String(ts) + String(Math.random()))}`;
  }

  /* =========================================================
     MEMORY ACCESS
  ========================================================= */

  async addMemory(summary, domain = "SYSTEM", tier = "R2") {
    this._ensureInitialized();
    return this.kernel.addMemory({ summary, domain, tier });
  }

  async readMemory(tier, count = 10) {
    this._ensureInitialized();
    return this.kernel.memory.read(tier, count);
  }

  async snapshotMemory(label) {
    this._ensureInitialized();
    return this.kernel.memory.snapshot(label);
  }

  /* =========================================================
     STATE & METRICS
  ========================================================= */

  getState() {
    if (!this._initialized) {
      return {
        initialized: false,
        sessionId: null
      };
    }

    return {
      initialized: true,
      sessionId: this._sessionId,
      version: this.version,
      kernel: this.kernel.getState(),
      audit: this.audit ? {
        count: this.audit.count(),
        tipHash: this.audit.getTip()
      } : null
    };
  }

  getMetrics() {
    if (!this._initialized) return null;
    return this.kernel.getMetrics();
  }

  async getAuditLog(count = 100) {
    if (!this.audit) return [];
    return this.audit.tail(count);
  }

  async verifyAudit() {
    if (!this.audit) return { ok: true, message: "Audit disabled" };
    return this.audit.verify();
  }

  /* =========================================================
     EVENT ACCESS
  ========================================================= */

  on(eventType, handler) {
    this._ensureInitialized();
    return this.kernel.on(eventType, handler);
  }

  onAll(handler) {
    this._ensureInitialized();
    return this.kernel.onAll(handler);
  }

  emit(eventType, payload) {
    this._ensureInitialized();
    return this.kernel.emit(eventType, payload);
  }

  getEventHistory(count = 100) {
    this._ensureInitialized();
    return this.kernel.getEventHistory(count);
  }

  /* =========================================================
     EXPORT / SNAPSHOT
  ========================================================= */

  async exportSnapshot() {
    this._ensureInitialized();

    return {
      version: this.version,
      sessionId: this._sessionId,
      timestamp: this.clock.now(),
      config: { ...this.cfg },
      state: this.getState(),
      audit: this.audit ? {
        integrity: this.audit.verify(),
        stats: this.audit.getStats()
      } : null
    };
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  _ensureInitialized() {
    if (!this._initialized) {
      throw new Error("EnterpriseALCore not initialized. Call init() first.");
    }
  }

  isRunning() {
    return this._initialized && this.kernel?.getState?.().running;
  }
}

/* =============================================================================
   FACTORY
============================================================================= */

export async function createEnterpriseALCore(opts = {}) {
  const core = new EnterpriseALCore(opts);
  await core.init();
  return core;
}

/* =============================================================================
   RE-EXPORTS (k1 primitives)
============================================================================= */

export {
  // Kernel
  Kernel,
  
  // EventBus
  EventBus,
  
  // Energy
  EnergyRing,
  DriftController,
  ObservabilityCore,
  ENERGY_SIGNAL,
  DRIFT_SEVERITY,
  
  // Memory
  MemoryRing,
  COOLING_LEVEL,
  REDACTION,
  RING_TIER,
  MEMORY_SIGNAL,
  
  // Decision
  DecisionCourt,
  DECISION_STATUS,
  DECISION_PRIORITY,
  DECISION_DOMAIN,
  
  // Policy
  PolicyEngine,
  AL_ROLE,
  ACTION_TYPE,
  POLICY_MODE,
  
  // Audit
  AuditLedger,
  NoopSeal,
  SimpleSeal,
  HMACSeal,
  AUDIT_LEVEL,
  AUDIT_AREA,
  
  // Primitives
  fnv1a32,
  stableStringify,
  DeterministicRuntime,
  ENERGY_COSTS,
  COOLING,
  PRIORITY,
  
  // Seams
  SystemClock,
  FixedClock,
  MemoryStorage
};

export default EnterpriseALCore;