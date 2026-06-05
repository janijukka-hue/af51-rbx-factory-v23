// k1/Ydin/invariant-engine.js
// KERROS: k1 – Kernel/Ydin
// Version: 1.0.0
//
// Invariant Engine — keskitetty rikkoutumattomuuden valvoja.
//
// Kaikki kriittiset polut tarkastetaan täältä:
//   decision, execute, publish, vault write, memory write
//
// Oletuksena rikkomus estää toiminnon ja kirjoittaa audit-entryn.
// assert()-rajapinta heittää hard-fail Errorin jos blocked.
// Invariantit ovat deterministisiä: sama input → sama tulos aina.

// ─── Vakavuustasot ───────────────────────────────────────────

export var INVARIANT_SEVERITY = {
  WARN:     "WARN",     // Loggaa mutta ei estä
  BLOCK:    "BLOCK",    // Estää toiminnon
  CRITICAL: "CRITICAL"  // Estää + hälyttää + kirjoittaa audit
};

// ─── Checkpoint-tyypit ───────────────────────────────────────

export var INVARIANT_CHECKPOINT = {
  DECISION:     "DECISION",
  EXECUTE:      "EXECUTE",
  PUBLISH:      "PUBLISH",
  VAULT_WRITE:  "VAULT_WRITE",
  MEMORY_WRITE: "MEMORY_WRITE",
  POLICY_CHECK: "POLICY_CHECK"
};

// ─── Invarianttisäännöt ──────────────────────────────────────
//
// Jokaisella säännöllä:
//   id       — uniikki tunniste audit-trailia varten
//   name     — luettava nimi
//   severity — WARN / BLOCK / CRITICAL
//   check(ctx) → { ok: bool, reason: string }

var RULES = [

  // ── Layer-riippuvuus ──────────────────────────────────────

  {
    id:       "INV-001",
    name:     "Layer dependency: s4 ei saa kutsua t3 suoraan",
    severity: INVARIANT_SEVERITY.BLOCK,
    checkpoints: [INVARIANT_CHECKPOINT.EXECUTE],
    check: function(ctx) {
      if (ctx.callerLayer === "s4" && ctx.targetLayer === "t3") {
        return { ok: false, reason: "s4→t3 suora kutsu kielletty. Käytä m2 kautta." };
      }
      return { ok: true };
    }
  },

  {
    id:       "INV-002",
    name:     "Layer dependency: k1 ei saa riippua ylemmistä kerroksista",
    severity: INVARIANT_SEVERITY.CRITICAL,
    checkpoints: [INVARIANT_CHECKPOINT.EXECUTE, INVARIANT_CHECKPOINT.DECISION],
    check: function(ctx) {
      var forbidden = ["m2", "t3", "s4"];
      if (ctx.callerLayer === "k1" && forbidden.indexOf(ctx.targetLayer) !== -1) {
        return { ok: false, reason: "k1 ei saa riippua " + ctx.targetLayer + "-kerroksesta. Arkkitehtuuririkkomus." };
      }
      return { ok: true };
    }
  },

  // ── Execution-säännöt ─────────────────────────────────────

  {
    id:       "INV-010",
    name:     "Execution vaatii policy-checkin",
    severity: INVARIANT_SEVERITY.BLOCK,
    checkpoints: [INVARIANT_CHECKPOINT.EXECUTE],
    check: function(ctx) {
      if (ctx.policyChecked !== true) {
        return { ok: false, reason: "Executionia ei voi ajaa ilman policy-checkiä. Aseta ctx.policyChecked=true." };
      }
      return { ok: true };
    }
  },

  {
    id:       "INV-011",
    name:     "Execution vaatii audit-kirjauksen mahdollisuuden",
    severity: INVARIANT_SEVERITY.BLOCK,
    checkpoints: [INVARIANT_CHECKPOINT.EXECUTE],
    check: function(ctx) {
      if (ctx.auditDisabled === true) {
        return { ok: false, reason: "Auditia ei saa ohittaa execution-vaiheessa." };
      }
      return { ok: true };
    }
  },

  {
    id:       "INV-012",
    name:     "Emergency-tilassa ei voi ajaa EXECUTE",
    severity: INVARIANT_SEVERITY.CRITICAL,
    checkpoints: [INVARIANT_CHECKPOINT.EXECUTE],
    check: function(ctx) {
      if (ctx.systemMode === "EMERGENCY" || ctx.systemMode === "LOCKDOWN") {
        return { ok: false, reason: "Järjestelmä tilassa " + ctx.systemMode + ". Execution estetty." };
      }
      return { ok: true };
    }
  },

  // ── Publish-säännöt ───────────────────────────────────────

  {
    id:       "INV-020",
    name:     "Publish vaatii build success",
    severity: INVARIANT_SEVERITY.BLOCK,
    checkpoints: [INVARIANT_CHECKPOINT.PUBLISH],
    check: function(ctx) {
      if (ctx.buildSuccess !== true) {
        return { ok: false, reason: "Julkaisu estetty: build ei ole onnistunut." };
      }
      return { ok: true };
    }
  },

  {
    id:       "INV-021",
    name:     "Publish vaatii security pass",
    severity: INVARIANT_SEVERITY.BLOCK,
    checkpoints: [INVARIANT_CHECKPOINT.PUBLISH],
    check: function(ctx) {
      if (ctx.securityPass !== true) {
        return { ok: false, reason: "Julkaisu estetty: security-tarkistus ei ole läpäisty." };
      }
      return { ok: true };
    }
  },

  {
    id:       "INV-022",
    name:     "Publish vaatii policy pass",
    severity: INVARIANT_SEVERITY.BLOCK,
    checkpoints: [INVARIANT_CHECKPOINT.PUBLISH],
    check: function(ctx) {
      if (ctx.policyPass !== true) {
        return { ok: false, reason: "Julkaisu estetty: policy-tarkistus ei ole hyväksytty." };
      }
      return { ok: true };
    }
  },

  // ── Vault-säännöt ─────────────────────────────────────────

  {
    id:       "INV-030",
    name:     "Vault write vaatii validoidun artifaktin",
    severity: INVARIANT_SEVERITY.BLOCK,
    checkpoints: [INVARIANT_CHECKPOINT.VAULT_WRITE],
    check: function(ctx) {
      if (!ctx.artifactId) {
        return { ok: false, reason: "Vault write estetty: artifactId puuttuu." };
      }
      if (!ctx.artifactHash) {
        return { ok: false, reason: "Vault write estetty: artifactHash puuttuu." };
      }
      return { ok: true };
    }
  },

  // ── Memory-säännöt ────────────────────────────────────────

  {
    id:       "INV-040",
    name:     "Memory write vaatii validoidun entryn",
    severity: INVARIANT_SEVERITY.BLOCK,
    checkpoints: [INVARIANT_CHECKPOINT.MEMORY_WRITE],
    check: function(ctx) {
      if (!ctx.memoryKey) {
        return { ok: false, reason: "Memory write: key puuttuu." };
      }
      if (ctx.memoryValue === undefined || ctx.memoryValue === null) {
        return { ok: false, reason: "Memory write: value on null/undefined." };
      }
      return { ok: true };
    }
  },

  // ── Policy-säännöt ───────────────────────────────────────

  {
    id:       "INV-060",
    name:     "Policy check: intent-kenttä vaaditaan",
    severity: INVARIANT_SEVERITY.WARN,
    checkpoints: [INVARIANT_CHECKPOINT.POLICY_CHECK],
    check: function(ctx) {
      // UNKNOWN on ok — tarkoittaa "ALX ratkaisee intent EXECUTE-vaiheessa".
      // Blokki vain jos intent puuttuu kokonaan (null/undefined).
      if (ctx.intent === null || ctx.intent === undefined) {
        return { ok: false, reason: "Intent-kenttä puuttuu kokonaan policy-tarkistuksesta." };
      }
      return { ok: true };
    }
  },

  {
    id:       "INV-061",
    name:     "Policy check estyy EMERGENCY/LOCKDOWN-tilassa",
    severity: INVARIANT_SEVERITY.CRITICAL,
    checkpoints: [INVARIANT_CHECKPOINT.POLICY_CHECK],
    check: function(ctx) {
      if (ctx.systemMode === "EMERGENCY" || ctx.systemMode === "LOCKDOWN") {
        return { ok: false, reason: "Policy check estetty tilassa " + ctx.systemMode + "." };
      }
      return { ok: true };
    }
  },

  {
    id:       "INV-062",
    name:     "Policy bypass ei sallittu",
    severity: INVARIANT_SEVERITY.CRITICAL,
    checkpoints: [INVARIANT_CHECKPOINT.POLICY_CHECK],
    check: function(ctx) {
      if (ctx.policyBypassed === true) {
        return { ok: false, reason: "Policy bypass ei ole sallittu." };
      }
      return { ok: true };
    }
  },

  // ── Decision-säännöt ─────────────────────────────────────

  {
    id:       "INV-050",
    name:     "Decision vaatii intentin",
    severity: INVARIANT_SEVERITY.BLOCK,
    checkpoints: [INVARIANT_CHECKPOINT.DECISION],
    check: function(ctx) {
      if (!ctx.intent) {
        return { ok: false, reason: "Päätöstä ei voi tehdä ilman intent-tyyppiä." };
      }
      return { ok: true };
    }
  },

  {
    id:       "INV-051",
    name:     "Decision: LearningEngine ei saa ohittaa policy:a",
    severity: INVARIANT_SEVERITY.CRITICAL,
    checkpoints: [INVARIANT_CHECKPOINT.DECISION],
    check: function(ctx) {
      if (ctx.source === "learning-engine" && ctx.policyBypassed === true) {
        return { ok: false, reason: "LearningEngine ei saa ohittaa policy-tarkistusta." };
      }
      return { ok: true };
    }
  }
];

// ─── InvariantEngine ─────────────────────────────────────────

function InvariantEngine(options) {
  var opts = options || {};
  this._audit    = opts.audit    || null;
  this._debug    = opts.debug    || false;
  this._violations = [];
  this._maxViolations = 100;

  // Esindeksoidaan säännöt checkpointin mukaan — vältä filter() joka tarkistuksella
  this._rulesByCheckpoint = {};
  for (var i = 0; i < RULES.length; i++) {
    var rule = RULES[i];
    for (var j = 0; j < rule.checkpoints.length; j++) {
      var cp = rule.checkpoints[j];
      if (!this._rulesByCheckpoint[cp]) this._rulesByCheckpoint[cp] = [];
      this._rulesByCheckpoint[cp].push(rule);
    }
  }
}

// ── check(checkpoint, ctx) ───────────────────────────────────
//
// Ajaa kaikki kyseiselle checkpointille rekisteröidyt säännöt.
// Palauttaa: { ok: bool, blocked: bool, violations: [] }
//
//   ok       = kaikki BLOCK/CRITICAL-säännöt läpäisty
//   blocked  = yksikin BLOCK tai CRITICAL -sääntö rikkoutui
//   violations = lista rikkomusraporteista

InvariantEngine.prototype.check = function(checkpoint, ctx) {
  var violations = [];
  var blocked    = false;

  var relevantRules = this._rulesByCheckpoint[checkpoint] || [];

  for (var i = 0; i < relevantRules.length; i++) {
    var rule   = relevantRules[i];
    var result = rule.check(ctx || {});

    if (!result.ok) {
      var violation = {
        ruleId:     rule.id,
        ruleName:   rule.name,
        severity:   rule.severity,
        checkpoint: checkpoint,
        reason:     result.reason,
        ts:         Date.now(),
        ctx:        this._sanitizeCtx(ctx)
      };

      violations.push(violation);
      this._recordViolation(violation);

      if (rule.severity === INVARIANT_SEVERITY.BLOCK ||
          rule.severity === INVARIANT_SEVERITY.CRITICAL) {
        blocked = true;
      }

      if (this._debug) {
        console.warn("[InvariantEngine] " + rule.severity + " " + rule.id + ": " + result.reason);
      }

      // Audit-kirjaus
      if (this._audit) {
        try {
          this._audit.append({
            level:   rule.severity === INVARIANT_SEVERITY.WARN ? "WARN" : "ERROR",
            area:    "INVARIANT",
            action:  "invariant_violation",
            ruleId:  rule.id,
            checkpoint: checkpoint,
            reason:  result.reason,
            blocked: blocked
          });
        } catch (e) {
          // Audit-kirjaus ei saa kaataa invariant-tarkistusta
        }
      }
    }
  }

  var warningCount  = violations.filter(function(v) { return v.severity === INVARIANT_SEVERITY.WARN; }).length;
  var blockingCount = violations.filter(function(v) { return v.severity === INVARIANT_SEVERITY.BLOCK; }).length;
  var criticalCount = violations.filter(function(v) { return v.severity === INVARIANT_SEVERITY.CRITICAL; }).length;

  return {
    ok:                      !blocked,
    blocked:                 blocked,
    violations:              violations,
    warningCount:            warningCount,
    blockingCount:           blockingCount,
    criticalCount:           criticalCount,
    hasWarnings:             warningCount > 0,
    hasBlockingViolations:   blockingCount > 0,
    hasCriticalViolations:   criticalCount > 0
  };
};

// ── assert(checkpoint, ctx) ───────────────────────────────────
// Kuten check() mutta heittää Error jos blocked.
// Käytä kun haluat hard-failin.

InvariantEngine.prototype.assert = function(checkpoint, ctx) {
  var result = this.check(checkpoint, ctx);
  if (result.blocked) {
    var reasons = result.violations
      .filter(function(v) {
        return v.severity === INVARIANT_SEVERITY.BLOCK ||
               v.severity === INVARIANT_SEVERITY.CRITICAL;
      })
      .map(function(v) { return "[" + v.ruleId + "] " + v.reason; })
      .join("; ");
    throw new Error("InvariantEngine: " + checkpoint + " estetty. " + reasons);
  }
  return result;
};

// ── getViolations() ──────────────────────────────────────────

InvariantEngine.prototype.getViolations = function(limit) {
  var n = limit || 20;
  return this._violations.slice(-n);
};

InvariantEngine.prototype.getViolationCount = function() {
  return this._violations.length;
};

// ── Sisäiset apufunktiot ─────────────────────────────────────

InvariantEngine.prototype._recordViolation = function(violation) {
  this._violations.push(violation);
  if (this._violations.length > this._maxViolations) {
    this._violations = this._violations.slice(-this._maxViolations);
  }
};

InvariantEngine.prototype._sanitizeCtx = function(ctx) {
  if (!ctx) return {};
  // Poistetaan suuret payload-kentät audit-träilistä
  var safe = {};
  var safeKeys = [
    "callerLayer", "targetLayer", "intent", "source", "systemMode",
    "policyChecked", "auditDisabled", "policyBypassed",
    "buildSuccess", "securityPass", "policyPass",
    "artifactId", "artifactHash", "memoryKey"
  ];
  for (var i = 0; i < safeKeys.length; i++) {
    if (ctx[safeKeys[i]] !== undefined) {
      safe[safeKeys[i]] = ctx[safeKeys[i]];
    }
  }
  return safe;
};

// ─── Factory ─────────────────────────────────────────────────

export function createInvariantEngine(options) {
  return new InvariantEngine(options);
}

export { InvariantEngine };
export default InvariantEngine;