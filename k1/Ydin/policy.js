// k1/Ydin/policy.js
// Policy Engine - k1 kernel policy enforcement
// - Role-based access control
// - Action permissions
// - Mode switching (NORMAL, SAFE, EMERGENCY)
// - Constraint evaluation
// - Deterministic

const POLICY_SCHEMA_VERSION = 1;

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

/* =============================================================================
   CONSTANTS
============================================================================= */

export const AL_ROLE = {
  AL1: "AL1",
  AL2: "AL2",
  AL3: "AL3",
  SYSTEM: "SYSTEM",
  GUEST: "GUEST"
};

export const ACTION_TYPE = {
  OBSERVE: "OBSERVE",
  READ: "READ",
  ANALYZE: "ANALYZE",
  PROPOSE: "PROPOSE",
  EXECUTE: "EXECUTE",
  WRITE: "WRITE",
  MODIFY: "MODIFY",
  DELETE: "DELETE",
  SYSTEM_OVERRIDE: "SYSTEM_OVERRIDE"
};

export const POLICY_MODE = {
  NORMAL: "NORMAL",
  SAFE: "SAFE",
  EMERGENCY: "EMERGENCY",
  LOCKDOWN: "LOCKDOWN"
};

export const CONSTRAINT_TYPE = {
  ENERGY: "ENERGY",
  MEMORY: "MEMORY",
  TIME: "TIME",
  ROLE: "ROLE",
  MODE: "MODE"
};

/* =============================================================================
   ACTION NORMALIZER
============================================================================= */

function normalizeAction(action) {
  // Jos action on jo objekti
  if (action && typeof action === "object" && action.type) {
    return {
      type: String(action.type).toUpperCase(),
      energyCost: action.energyCost || 0,
      estimatedTime: action.estimatedTime || 0,
      metadata: action.metadata || {}
    };
  }

  // Jos action on string
  if (typeof action === "string") {
    const type = action.toUpperCase();
    return {
      type: type,
      energyCost: 0,
      estimatedTime: 0,
      metadata: {}
    };
  }

  // Fallback
  return {
    type: "UNKNOWN",
    energyCost: 0,
    estimatedTime: 0,
    metadata: {}
  };
}

/* =============================================================================
   ROLE PERMISSIONS
============================================================================= */

const ROLE_PERMISSIONS = {
  [AL_ROLE.GUEST]: [
    ACTION_TYPE.OBSERVE
  ],
  [AL_ROLE.AL1]: [
    ACTION_TYPE.OBSERVE,
    ACTION_TYPE.READ
  ],
  [AL_ROLE.AL2]: [
    ACTION_TYPE.OBSERVE,
    ACTION_TYPE.READ,
    ACTION_TYPE.ANALYZE,
    ACTION_TYPE.PROPOSE,
    ACTION_TYPE.WRITE
  ],
  [AL_ROLE.AL3]: [
    ACTION_TYPE.OBSERVE,
    ACTION_TYPE.READ,
    ACTION_TYPE.ANALYZE,
    ACTION_TYPE.PROPOSE,
    ACTION_TYPE.EXECUTE,
    ACTION_TYPE.WRITE,
    ACTION_TYPE.MODIFY,
    ACTION_TYPE.DELETE
  ],
  [AL_ROLE.SYSTEM]: [
    ACTION_TYPE.OBSERVE,
    ACTION_TYPE.READ,
    ACTION_TYPE.ANALYZE,
    ACTION_TYPE.PROPOSE,
    ACTION_TYPE.EXECUTE,
    ACTION_TYPE.WRITE,
    ACTION_TYPE.MODIFY,
    ACTION_TYPE.DELETE,
    ACTION_TYPE.SYSTEM_OVERRIDE
  ]
};

/* =============================================================================
   MODE PERMISSIONS
============================================================================= */

const MODE_PERMISSIONS = {
  [POLICY_MODE.NORMAL]: [
    ACTION_TYPE.OBSERVE,
    ACTION_TYPE.READ,
    ACTION_TYPE.ANALYZE,
    ACTION_TYPE.PROPOSE,
    ACTION_TYPE.EXECUTE,
    ACTION_TYPE.WRITE,
    ACTION_TYPE.MODIFY,
    ACTION_TYPE.DELETE,
    ACTION_TYPE.SYSTEM_OVERRIDE
  ],
  [POLICY_MODE.SAFE]: [
    ACTION_TYPE.OBSERVE,
    ACTION_TYPE.READ,
    ACTION_TYPE.ANALYZE,
    ACTION_TYPE.PROPOSE
  ],
  [POLICY_MODE.EMERGENCY]: [
    ACTION_TYPE.OBSERVE,
    ACTION_TYPE.READ
  ],
  [POLICY_MODE.LOCKDOWN]: [
    ACTION_TYPE.OBSERVE
  ]
};

/* =============================================================================
   POLICY ENGINE
============================================================================= */

export class PolicyEngine {

  constructor(mode = POLICY_MODE.NORMAL, clock = null) {
    this.mode = mode;
    this.clock = clock;
    this.actionLog = [];
    this.logLimit = 1000;

    this._stats = {
      total: 0,
      allowed: 0,
      denied: 0
    };
  }

  _now() {
    return nowMs(this.clock);
  }

  _iso(ts) {
    return isoFromCounter(ts);
  }

  /* =========================================================
     PERMISSION CHECKS
  ========================================================= */

  allowAction(role, actionType) {
    const permissions = ROLE_PERMISSIONS[role];
    if (!permissions) return false;
    return permissions.includes(actionType);
  }

  allowInMode(actionType) {
    const permissions = MODE_PERMISSIONS[this.mode];
    if (!permissions) return false;
    return permissions.includes(actionType);
  }

  /* =========================================================
     MAIN EVALUATE
  ========================================================= */

  evaluate(role, action, context = {}) {
    const normalizedAction = normalizeAction(action);
    const actionType = normalizedAction.type;

    // Check role permission
    if (!this.allowAction(role, actionType)) {
      return {
        allowed: false,
        reason: `Role ${role} not permitted for action ${actionType}`,
        role: role,
        action: actionType,
        mode: this.mode
      };
    }

    // Check mode permission
    if (!this.allowInMode(actionType)) {
      return {
        allowed: false,
        reason: `Action ${actionType} not allowed in ${this.mode} mode`,
        role: role,
        action: actionType,
        mode: this.mode
      };
    }

    // Check energy constraint
    if (context.energyAvailable !== undefined && normalizedAction.energyCost > 0) {
      if (normalizedAction.energyCost > context.energyAvailable) {
        return {
          allowed: false,
          reason: `Insufficient energy: need ${normalizedAction.energyCost}, have ${context.energyAvailable}`,
          role: role,
          action: actionType,
          mode: this.mode
        };
      }
    }

    // Check memory pressure constraint
    if (context.memoryPressure !== undefined && context.memoryPressure > 90) {
      const heavyActions = [
        ACTION_TYPE.EXECUTE,
        ACTION_TYPE.WRITE,
        ACTION_TYPE.MODIFY,
        ACTION_TYPE.DELETE
      ];
      if (heavyActions.includes(actionType)) {
        return {
          allowed: false,
          reason: `Memory pressure too high: ${context.memoryPressure}%`,
          role: role,
          action: actionType,
          mode: this.mode
        };
      }
    }

    // Check time constraint
    if (context.deadline !== undefined && normalizedAction.estimatedTime > 0) {
      const now = this._now();
      const timeRemaining = context.deadline - now;

      if (normalizedAction.estimatedTime > timeRemaining) {
        return {
          allowed: false,
          reason: `Insufficient time: need ${normalizedAction.estimatedTime}ms, have ${timeRemaining}ms`,
          role: role,
          action: actionType,
          mode: this.mode
        };
      }
    }

    // All checks passed
    return {
      allowed: true,
      reason: null,
      role: role,
      action: actionType,
      mode: this.mode
    };
  }

  /* =========================================================
     LOGGING
  ========================================================= */

  logAction(role, action, allowed, reason = null) {
    const ts = this._now();
    const normalizedAction = normalizeAction(action);

    const entry = {
      ts,
      iso: this._iso(ts),
      role,
      action: normalizedAction.type,
      allowed,
      reason,
      mode: this.mode
    };

    this.actionLog.push(entry);

    // Bound log size
    if (this.actionLog.length > this.logLimit) {
      this.actionLog.shift();
    }

    // Update stats
    this._stats.total += 1;
    if (allowed) {
      this._stats.allowed += 1;
    } else {
      this._stats.denied += 1;
    }

    return entry;
  }

  /* =========================================================
     MODE CONTROL
  ========================================================= */

  setMode(mode) {
    if (!MODE_PERMISSIONS[mode]) {
      throw new Error(`Invalid policy mode: ${mode}`);
    }
    const oldMode = this.mode;
    this.mode = mode;
    return { oldMode, newMode: mode };
  }

  getMode() {
    return this.mode;
  }

  /* =========================================================
     QUERIES
  ========================================================= */

  getLog(limit = 100) {
    return this.actionLog.slice(-limit);
  }

  getDenied(limit = 50) {
    return this.actionLog.filter(entry => !entry.allowed).slice(-limit);
  }

  getByRole(role, limit = 50) {
    return this.actionLog.filter(entry => entry.role === role).slice(-limit);
  }

  getByAction(actionType, limit = 50) {
    const type = typeof actionType === "string" ? actionType.toUpperCase() : actionType;
    return this.actionLog.filter(entry => entry.action === type).slice(-limit);
  }

  getStats() {
    const approvalRate = this._stats.total > 0
      ? Math.round((this._stats.allowed / this._stats.total) * 100)
      : 100;

    return {
      total: this._stats.total,
      allowed: this._stats.allowed,
      denied: this._stats.denied,
      approvalRate,
      mode: this.mode
    };
  }

  /* =========================================================
     CLEAR / RESET
  ========================================================= */

  clearLog() {
    this.actionLog = [];
  }

  resetStats() {
    this._stats = {
      total: 0,
      allowed: 0,
      denied: 0
    };
  }

  reset() {
    this.clearLog();
    this.resetStats();
    this.mode = POLICY_MODE.NORMAL;
  }
}

/* =============================================================================
   CONSTRAINT EVALUATOR
============================================================================= */

export class ConstraintEvaluator {

  constructor() {
    this.constraints = [];
  }

  addConstraint(constraint) {
    if (!constraint || typeof constraint.check !== "function") {
      throw new Error("Constraint must have check() function");
    }
    this.constraints.push(constraint);
  }

  evaluate(context) {
    const violations = [];

    for (const constraint of this.constraints) {
      try {
        if (!constraint.check(context)) {
          violations.push({
            type: constraint.type || "UNKNOWN",
            message: constraint.message || "Constraint violated"
          });
        }
      } catch (error) {
        violations.push({
          type: constraint.type || "UNKNOWN",
          message: `Constraint check failed: ${error.message}`
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  clear() {
    this.constraints = [];
  }

  count() {
    return this.constraints.length;
  }

  getConstraints() {
    return this.constraints.map(c => ({
      type: c.type,
      message: c.message
    }));
  }
}

/* =============================================================================
   PREDEFINED CONSTRAINTS
============================================================================= */

export function energyConstraint(minEnergy) {
  return {
    type: CONSTRAINT_TYPE.ENERGY,
    message: `Requires at least ${minEnergy} energy`,
    check: (ctx) => (ctx.energyAvailable || 0) >= minEnergy
  };
}

export function memoryConstraint(maxPressure) {
  return {
    type: CONSTRAINT_TYPE.MEMORY,
    message: `Memory pressure must be below ${maxPressure}%`,
    check: (ctx) => (ctx.memoryPressure || 0) <= maxPressure
  };
}

export function timeConstraint(maxTime) {
  return {
    type: CONSTRAINT_TYPE.TIME,
    message: `Requires at least ${maxTime}ms remaining`,
    check: (ctx) => {
      if (!ctx.deadline) return true;
      const now = ctx.clockNow || 0;
      const remaining = ctx.deadline - now;
      return remaining >= maxTime;
    }
  };
}

export function roleConstraint(allowedRoles) {
  return {
    type: CONSTRAINT_TYPE.ROLE,
    message: `Requires one of roles: ${allowedRoles.join(", ")}`,
    check: (ctx) => allowedRoles.includes(ctx.role)
  };
}

export function modeConstraint(allowedModes) {
  return {
    type: CONSTRAINT_TYPE.MODE,
    message: `Requires one of modes: ${allowedModes.join(", ")}`,
    check: (ctx) => allowedModes.includes(ctx.mode)
  };
}

/* =============================================================================
   FACTORY
============================================================================= */

export function createPolicyEngine(mode = POLICY_MODE.NORMAL, clock = null) {
  return new PolicyEngine(mode, clock);
}

export function createConstraintEvaluator() {
  return new ConstraintEvaluator();
}

export default {
  PolicyEngine,
  ConstraintEvaluator,
  createPolicyEngine,
  createConstraintEvaluator,
  AL_ROLE,
  ACTION_TYPE,
  POLICY_MODE,
  CONSTRAINT_TYPE,
  energyConstraint,
  memoryConstraint,
  timeConstraint,
  roleConstraint,
  modeConstraint
};