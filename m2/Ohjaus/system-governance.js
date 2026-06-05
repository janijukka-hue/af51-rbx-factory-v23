// m2/Ohjaus/system-governance.js
// KERROS: M2 – Ohjaus/MasterRoom
// Version: 1.0.0
//
// System Governance Layer — kaikelle toiminnalle yksi näkyvä hallintataso.
//
// Sisältää:
//   SystemStateController  — koko järjestelmän tila
//   DecisionGate           — viimeinen hyväksyntäpiste ennen executionia
//   GlobalInvariants       — koko järjestelmän yhteiset rikkoutumattomat säännöt
//   EmergencyMode          — pysäytys, lockdown, vain luku -tila, turvallinen palautus
//
// Kytkentä:
//   Orchestrator luo SystemGovernance bootin jälkeen.
//   execute()-putki kutsuu DecisionGate:a ennen EXECUTE-vaihetta.
//   setSystemMode() delegoi GovernanceLayeriin joka validoi siirtymän.

import { INVARIANT_CHECKPOINT } from "../../k1/Ydin/invariant-engine.js";

// ─── Järjestelmätilat ────────────────────────────────────────

export var SYSTEM_STATE = {
  BOOTING:   "BOOTING",   // Käynnistyy
  READY:     "READY",     // Normaali käyttö
  DEGRADED:  "DEGRADED",  // Toimii rajoitetusti (jokin komponentti viallinen)
  LOCKED:    "LOCKED",    // Lukittu — vain luku, ei executionia
  EMERGENCY: "EMERGENCY", // Hätätila — vain kriittiset operaatiot
  SHUTDOWN:  "SHUTDOWN"   // Sammutustilassa
};

// ─── Sallitut tilasiirtymät ──────────────────────────────────

var ALLOWED_TRANSITIONS = {
  BOOTING:   ["READY", "DEGRADED", "EMERGENCY", "SHUTDOWN"],
  READY:     ["DEGRADED", "LOCKED", "EMERGENCY", "SHUTDOWN"],
  DEGRADED:  ["READY", "LOCKED", "EMERGENCY", "SHUTDOWN"],
  LOCKED:    ["READY", "EMERGENCY", "SHUTDOWN"],
  EMERGENCY: ["LOCKED", "SHUTDOWN"],    // Ei suoraan READY — pitää käydä LOCKED kautta
  SHUTDOWN:  []                          // Terminaali tila
};

// ─── DecisionGate riskitasot ─────────────────────────────────

export var RISK_LEVEL = {
  LOW:      "LOW",
  MEDIUM:   "MEDIUM",
  HIGH:     "HIGH",
  CRITICAL: "CRITICAL"
};

// ─── GlobalInvariants ─────────────────────────────────────────
// Koko järjestelmän yhteiset säännöt — tarkistetaan DecisionGate:ssa.

var GLOBAL_INVARIANTS = [
  {
    id:   "GOV-001",
    name: "SHUTDOWN-tilassa ei voi ajaa mitään",
    check: function(ctx) {
      if (ctx.systemState === SYSTEM_STATE.SHUTDOWN) {
        return { ok: false, reason: "Järjestelmä on SHUTDOWN-tilassa. Kaikki operaatiot estetty." };
      }
      return { ok: true };
    }
  },
  {
    id:   "GOV-002",
    name: "EMERGENCY-tilassa vain kriittiset operaatiot sallittu",
    check: function(ctx) {
      if (ctx.systemState === SYSTEM_STATE.EMERGENCY && !ctx.isCritical) {
        return { ok: false, reason: "EMERGENCY-tila: vain kriittiset operaatiot sallittu." };
      }
      return { ok: true };
    }
  },
  {
    id:   "GOV-003",
    name: "LOCKED-tilassa ei voi ajaa executionia",
    check: function(ctx) {
      if (ctx.systemState === SYSTEM_STATE.LOCKED && ctx.isExecution) {
        return { ok: false, reason: "LOCKED-tila: execution estetty. Vain luku -tila." };
      }
      return { ok: true };
    }
  },
  {
    id:   "GOV-004",
    name: "CRITICAL-riskitaso vaatii eksplisiittisen hyväksynnän",
    check: function(ctx) {
      if (ctx.riskLevel === RISK_LEVEL.CRITICAL && !ctx.criticalApproved) {
        return { ok: false, reason: "CRITICAL-riskitaso vaatii eksplisiittisen hyväksynnän (criticalApproved: true)." };
      }
      return { ok: true };
    }
  },
  {
    id:   "GOV-005",
    name: "Resurssitila: energiataso ei saa olla kriittinen",
    check: function(ctx) {
      if (ctx.energyLevel !== undefined && ctx.energyLevel < 10) {
        return { ok: false, reason: "Energiataso kriittinen (" + ctx.energyLevel + "). Operaatio estetty." };
      }
      return { ok: true };
    }
  }
];

// ─── SystemStateController ───────────────────────────────────

function SystemStateController(options) {
  var opts = options || {};
  this._state      = SYSTEM_STATE.BOOTING;
  this._eventBus   = opts.eventBus   || null;
  this._audit      = opts.audit      || null;
  this._debug      = opts.debug      || false;
  this._stateLog   = [];             // Historia
  this._maxLog     = 100;
  this._lockedAt   = null;
  this._lockReason = null;
}

SystemStateController.prototype.getState = function() {
  return this._state;
};

SystemStateController.prototype.transition = function(nextState, reason) {
  var allowed = ALLOWED_TRANSITIONS[this._state] || [];

  if (allowed.indexOf(nextState) === -1) {
    return {
      ok:    false,
      error: "Tilasiirtymä " + this._state + " → " + nextState + " ei ole sallittu."
    };
  }

  var prev = this._state;
  this._state = nextState;

  var entry = {
    ts:     Date.now(),
    prev:   prev,
    next:   nextState,
    reason: reason || null
  };

  this._stateLog.push(entry);
  if (this._stateLog.length > this._maxLog) {
    this._stateLog = this._stateLog.slice(-this._maxLog);
  }

  if (nextState === SYSTEM_STATE.LOCKED) {
    this._lockedAt   = Date.now();
    this._lockReason = reason || "manual";
  }

  if (this._eventBus) {
    try {
      this._eventBus.emit("GOVERNANCE:STATE_CHANGED", { prev: prev, state: nextState, reason: reason });
    } catch (e) { /* ei kaada */ }
  }

  if (this._audit) {
    try {
      this._audit.append({
        level:  "WARN",
        area:   "GOVERNANCE",
        action: "system_state_transition",
        prev:   prev,
        next:   nextState,
        reason: reason || null
      });
    } catch (e) { /* ei kaada */ }
  }

  if (this._debug) {
    
  }

  return { ok: true, prev: prev, state: nextState };
};

SystemStateController.prototype.isOperational = function() {
  return this._state === SYSTEM_STATE.READY || this._state === SYSTEM_STATE.DEGRADED;
};

SystemStateController.prototype.getStateLog = function(limit) {
  return this._stateLog.slice(-(limit || 20));
};

SystemStateController.prototype.getStatus = function() {
  return {
    state:       this._state,
    operational: this.isOperational(),
    lockedAt:    this._lockedAt,
    lockReason:  this._lockReason,
    logLength:   this._stateLog.length
  };
};

// ─── DecisionGate ────────────────────────────────────────────
// Viimeinen hyväksyntäpiste ennen executionia.
// Tarkistaa: policy, invariantit, riskitaso, resurssitila.

function DecisionGate(options) {
  var opts = options || {};
  this._stateController  = opts.stateController  || null;
  this._invariantEngine  = opts.invariantEngine  || null;
  this._eventBus         = opts.eventBus         || null;
  this._debug            = opts.debug            || false;
  this._gateLog          = [];
  this._maxLog           = 100;
}

// gate(request) — päämetodi
// request: { intent, source, riskLevel, isCritical, isExecution, energyLevel, criticalApproved, traceId }
// Palauttaa: { ok: bool, blocked: bool, reasons: [], gateId }

DecisionGate.prototype.gate = function(request) {
  var req     = request || {};
  var gateId  = "gate_" + Date.now();
  var reasons = [];
  var blocked = false;

  var systemState = this._stateController
    ? this._stateController.getState()
    : SYSTEM_STATE.READY;

  var ctx = {
    systemState:      systemState,
    intent:           req.intent           || null,
    source:           req.source           || "user",
    riskLevel:        req.riskLevel        || RISK_LEVEL.LOW,
    isCritical:       req.isCritical       || false,
    isExecution:      req.isExecution      !== false, // oletus: true
    energyLevel:      req.energyLevel,
    criticalApproved: req.criticalApproved || false
  };

  // ── 1. GlobalInvariants ───────────────────────────────────
  for (var i = 0; i < GLOBAL_INVARIANTS.length; i++) {
    var inv    = GLOBAL_INVARIANTS[i];
    var result = inv.check(ctx);
    if (!result.ok) {
      reasons.push({ id: inv.id, reason: result.reason });
      blocked = true;
    }
  }

  // ── 2. InvariantEngine EXECUTE-checkpoint ─────────────────
  if (!blocked && this._invariantEngine) {
    var invCheck = this._invariantEngine.check(INVARIANT_CHECKPOINT.EXECUTE, {
      policyChecked:  true,
      auditDisabled:  false,
      systemMode:     systemState,
      callerLayer:    "m2",
      targetLayer:    "t3"
    });
    if (invCheck.blocked) {
      blocked = true;
      invCheck.violations.forEach(function(v) {
        reasons.push({ id: v.ruleId, reason: v.reason });
      });
    }
  }

  // ── 3. Kirjaa gate-päätös ─────────────────────────────────
  var entry = {
    gateId:      gateId,
    ts:          Date.now(),
    traceId:     req.traceId || null,
    intent:      ctx.intent,
    systemState: systemState,
    riskLevel:   ctx.riskLevel,
    blocked:     blocked,
    reasons:     reasons
  };

  this._gateLog.push(entry);
  if (this._gateLog.length > this._maxLog) {
    this._gateLog = this._gateLog.slice(-this._maxLog);
  }

  if (this._eventBus) {
    try {
      this._eventBus.emit("GOVERNANCE:DECISION_GATE", {
        gateId:  gateId,
        blocked: blocked,
        intent:  ctx.intent,
        traceId: req.traceId || null
      });
    } catch (e) { /* ei kaada */ }
  }

  if (this._debug) {
    console.log("[DecisionGate]", gateId, blocked ? "BLOCKED" : "PASSED",
      blocked ? reasons.map(function(r) { return r.id; }).join(", ") : "");
  }

  return {
    ok:          !blocked,
    blocked:     blocked,
    gateId:      gateId,
    reasons:     reasons,
    systemState: systemState
  };
};

DecisionGate.prototype.getGateLog = function(limit) {
  return this._gateLog.slice(-(limit || 20));
};

// ─── EmergencyMode ───────────────────────────────────────────

function EmergencyMode(options) {
  var opts = options || {};
  this._stateController = opts.stateController || null;
  this._eventBus        = opts.eventBus        || null;
  this._audit           = opts.audit           || null;
  this._debug           = opts.debug           || false;
  this._active          = false;
  this._activatedAt     = null;
  this._activationLog   = [];
}

// activate(reason) — hätätila päälle
EmergencyMode.prototype.activate = function(reason) {
  if (this._active) {
    return { ok: false, error: "Emergency mode jo aktiivinen" };
  }

  this._active      = true;
  this._activatedAt = Date.now();
  this._activationLog.push({ ts: this._activatedAt, action: "activated", reason: reason || "manual" });

  if (this._stateController) {
    this._stateController.transition(SYSTEM_STATE.EMERGENCY, reason || "emergency_mode_activated");
  }

  if (this._eventBus) {
    try { this._eventBus.emit("GOVERNANCE:EMERGENCY_ACTIVATED", { reason: reason }); } catch (e) { /* ei kaada */ }
  }

  if (this._audit) {
    try {
      this._audit.append({ level: "CRITICAL", area: "GOVERNANCE", action: "emergency_activated", reason: reason || "manual" });
    } catch (e) { /* ei kaada */ }
  }

  if (this._debug) console.warn("[EmergencyMode] ACTIVATED:", reason);

  return { ok: true, activatedAt: this._activatedAt };
};

// lockdown(reason) — vain luku -tila
EmergencyMode.prototype.lockdown = function(reason) {
  this._activationLog.push({ ts: Date.now(), action: "lockdown", reason: reason || "manual" });

  if (this._stateController) {
    this._stateController.transition(SYSTEM_STATE.LOCKED, reason || "lockdown");
  }

  if (this._eventBus) {
    try { this._eventBus.emit("GOVERNANCE:LOCKDOWN", { reason: reason }); } catch (e) { /* ei kaada */ }
  }

  if (this._debug) console.warn("[EmergencyMode] LOCKDOWN:", reason);

  return { ok: true, lockedAt: Date.now() };
};

// safeRestore() — turvallinen palautus LOCKED → READY
EmergencyMode.prototype.safeRestore = function(reason) {
  this._active = false;
  this._activationLog.push({ ts: Date.now(), action: "safe_restore", reason: reason || "manual" });

  if (this._stateController) {
    // EMERGENCY → LOCKED → READY (kaksi siirtymää)
    var state = this._stateController.getState();
    if (state === SYSTEM_STATE.EMERGENCY) {
      this._stateController.transition(SYSTEM_STATE.LOCKED, "emergency_to_locked");
    }
    this._stateController.transition(SYSTEM_STATE.READY, reason || "safe_restore");
  }

  if (this._eventBus) {
    try { this._eventBus.emit("GOVERNANCE:SAFE_RESTORE", { reason: reason }); } catch (e) { /* ei kaada */ }
  }

  if (this._debug) 

  return { ok: true, restoredAt: Date.now() };
};

EmergencyMode.prototype.isActive = function() { return this._active; };
EmergencyMode.prototype.getLog   = function() { return this._activationLog.slice(-20); };

// ─── SystemGovernance — pääluokka ────────────────────────────
// Kokoaa kaikki osat yhteen. Orchestrator käyttää tätä.

function SystemGovernance(options) {
  var opts = options || {};

  this.stateController = new SystemStateController({
    eventBus: opts.eventBus,
    audit:    opts.audit,
    debug:    opts.debug
  });

  this.decisionGate = new DecisionGate({
    stateController: this.stateController,
    invariantEngine: opts.invariantEngine || null,
    eventBus:        opts.eventBus,
    debug:           opts.debug
  });

  this.emergencyMode = new EmergencyMode({
    stateController: this.stateController,
    eventBus:        opts.eventBus,
    audit:           opts.audit,
    debug:           opts.debug
  });

  this._debug = opts.debug || false;
}

// Nopeat delegoinnit

SystemGovernance.prototype.getState       = function() { return this.stateController.getState(); };
SystemGovernance.prototype.transition     = function(s, r) { return this.stateController.transition(s, r); };
SystemGovernance.prototype.gate           = function(req) { return this.decisionGate.gate(req); };
SystemGovernance.prototype.emergency      = function(r) { return this.emergencyMode.activate(r); };
SystemGovernance.prototype.lockdown       = function(r) { return this.emergencyMode.lockdown(r); };
SystemGovernance.prototype.safeRestore    = function(r) { return this.emergencyMode.safeRestore(r); };
SystemGovernance.prototype.isOperational  = function() { return this.stateController.isOperational(); };

SystemGovernance.prototype.getStatus = function() {
  return {
    systemState:   this.stateController.getStatus(),
    emergencyMode: this.emergencyMode.isActive(),
    recentGates:   this.decisionGate.getGateLog(5),
    globalInvariants: GLOBAL_INVARIANTS.map(function(i) { return { id: i.id, name: i.name }; })
  };
};

// ─── Factory ─────────────────────────────────────────────────

export function createSystemGovernance(options) {
  return new SystemGovernance(options);
}

export {
  SystemGovernance,
  SystemStateController,
  DecisionGate,
  EmergencyMode,
  GLOBAL_INVARIANTS
};
export default SystemGovernance;