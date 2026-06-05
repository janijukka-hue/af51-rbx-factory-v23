// t3/Factory/pipeline/failure-recovery.js
// KERROS: T3 – Factory/Tuotanto
// Version: 1.0.0
//
// Failure Recovery Engine — hallitsee build-epäonnistumisia.
//
// Vastuut:
//   - Build state -malli (QUEUED → RUNNING → FAILED → RECOVERED / COMPLETED)
//   - Retry-logiikka per vaihe
//   - Rollback: partial artifaktit merkitään invalidiksi
//   - Cleanup: temp-tiedostot poistetaan
//   - Audit: jokainen recovery-yritys kirjataan
//
// Tämä ei korvaa BuildPipeline:a — se on sen apumoduuli.
// BuildPipeline kutsuu FailureRecovery:a kun vaihe epäonnistuu.

// ─── Build State ─────────────────────────────────────────────

export var BUILD_STATE = {
  QUEUED:    "QUEUED",    // Odottaa ajovuoroa
  RUNNING:   "RUNNING",   // Parhaillaan ajossa
  FAILED:    "FAILED",    // Epäonnistui — voi yrittää recoveryä
  RECOVERED: "RECOVERED", // Palautettiin onnistuneesti
  CANCELLED: "CANCELLED", // Peruutettu (käyttäjä tai policy)
  COMPLETED: "COMPLETED"  // Valmis
};

// ─── Phase Retry Policy ──────────────────────────────────────
// Per-vaihe policy: retry, rollback, severity

var PHASE_POLICY = {
  INTAKE:            { retry: false, rollback: false, severity: "blocking",  maxRetries: 0 },
  NORMALIZE:         { retry: true,  rollback: false, severity: "blocking",  maxRetries: 2 },
  INCREMENTAL_CHECK: { retry: true,  rollback: false, severity: "soft",      maxRetries: 3 },
  PLAN:              { retry: true,  rollback: false, severity: "blocking",  maxRetries: 2 },
  TEMPLATE:          { retry: false, rollback: true,  severity: "blocking",  maxRetries: 0 },
  SYNTHESIZE:        { retry: true,  rollback: true,  severity: "blocking",  maxRetries: 2 },
  DEPS:              { retry: true,  rollback: true,  severity: "blocking",  maxRetries: 3 },
  BUILD:             { retry: true,  rollback: true,  severity: "blocking",  maxRetries: 2 },
  VALIDATE:          { retry: false, rollback: false, severity: "soft",      maxRetries: 0 },
  SECURITY:          { retry: false, rollback: false, severity: "blocking",  maxRetries: 0 },
  PACKAGE:           { retry: true,  rollback: true,  severity: "blocking",  maxRetries: 2 },
  PREVIEW:           { retry: true,  rollback: false, severity: "soft",      maxRetries: 2 },
  PUBLISH:           { retry: false, rollback: true,  severity: "blocking",  maxRetries: 0 }
};

var DEFAULT_RETRY_DELAY_MS = 500;
var DEFAULT_MAX_RETRIES    = 2;

// ─── FailureRecovery ─────────────────────────────────────────

function FailureRecovery(options) {
  var opts = options || {};
  this._eventBus   = opts.eventBus   || null;
  this._audit      = opts.audit      || null;
  this._workspace  = opts.workspace  || null;
  this._debug      = opts.debug      || false;

  // Aktiiviset build-tilat: traceId → BuildRecord
  this._builds = new Map();
}

// ── createBuildRecord(traceId, command) ──────────────────────
// Rekisteröi uusi build — kutsutaan BuildPipeline.run():n alussa.

FailureRecovery.prototype.createBuildRecord = function(traceId, command) {
  var record = {
    traceId:      traceId,
    commandId:    command.commandId || command.id || traceId,
    projectName:  command.projectName || command.name || "unknown",
    state:        BUILD_STATE.QUEUED,
    startedAt:    Date.now(),
    finishedAt:   null,
    failedPhase:  null,
    error:        null,
    retryCount:   {},    // phase → N
    recoveryLog:  [],    // { ts, phase, action, result }
    invalidated:  false
  };
  this._builds.set(traceId, record);
  this._log(record, null, "created", { state: BUILD_STATE.QUEUED });
  return record;
};

// ── setState(traceId, state) ──────────────────────────────────

FailureRecovery.prototype.setState = function(traceId, state, extra) {
  var record = this._builds.get(traceId);
  if (!record) return { ok: false, error: "Build not found: " + traceId };

  var prev = record.state;
  record.state = state;

  if (state === BUILD_STATE.COMPLETED || state === BUILD_STATE.FAILED ||
      state === BUILD_STATE.CANCELLED || state === BUILD_STATE.RECOVERED) {
    record.finishedAt = Date.now();
  }

  if (extra) {
    if (extra.failedPhase) record.failedPhase = extra.failedPhase;
    if (extra.error)       record.error       = extra.error;
  }

  this._log(record, null, "state_change", { prev: prev, next: state });
  this._emit("FACTORY:BUILD_STATE_CHANGED", { traceId: traceId, prev: prev, state: state });

  return { ok: true, prev: prev, state: state };
};

// ── shouldRetry(traceId, phaseName) ──────────────────────────
// Palauttaa true jos vaihe voidaan yrittää uudelleen.

FailureRecovery.prototype.shouldRetry = function(traceId, phaseName) {
  var record = this._builds.get(traceId);
  if (!record) return false;

  var policy = PHASE_POLICY[phaseName] || { retry: false, maxRetries: DEFAULT_MAX_RETRIES };
  if (!policy.retry) return false;

  var count = record.retryCount[phaseName] || 0;
  return count < (policy.maxRetries || DEFAULT_MAX_RETRIES);
};

// ── recordRetry(traceId, phaseName) ──────────────────────────

FailureRecovery.prototype.recordRetry = function(traceId, phaseName) {
  var record = this._builds.get(traceId);
  if (!record) return { ok: false };

  var count = (record.retryCount[phaseName] || 0) + 1;
  record.retryCount[phaseName] = count;

  this._log(record, phaseName, "retry", { attempt: count });
  this._emit("FACTORY:PHASE_RETRY", { traceId: traceId, phase: phaseName, attempt: count });

  if (this._debug) {
    
  }

  return { ok: true, attempt: count, delayMs: DEFAULT_RETRY_DELAY_MS * count };
};

// ── retryDelay(traceId, phaseName) ───────────────────────────
// Eksponentiaalisesti kasvava viive.

FailureRecovery.prototype.retryDelay = function(traceId, phaseName) {
  var record = this._builds.get(traceId);
  if (!record) return DEFAULT_RETRY_DELAY_MS;
  var count = record.retryCount[phaseName] || 0;
  return DEFAULT_RETRY_DELAY_MS * Math.pow(2, count);
};

// ── rollback(traceId, phaseName) ─────────────────────────────
// Ajaa rollback-toimenpiteet epäonnistuneelle vaiheelle.

FailureRecovery.prototype.rollback = async function(traceId, phaseName) {
  var record = this._builds.get(traceId);
  if (!record) return { ok: false, error: "Build not found" };

  var policy = PHASE_POLICY[phaseName] || { rollback: false };
  if (!policy.rollback) {
    this._log(record, phaseName, "rollback_skipped", { reason: "policy.rollback=false" });
    return { ok: true, skipped: true };
  }

  this._log(record, phaseName, "rollback_started", {});
  this._emit("FACTORY:PHASE_ROLLBACK", { traceId: traceId, phase: phaseName });

  var actions = [];

  // 1. Merkitse partial artifaktit invalidiksi
  record.invalidated = true;
  actions.push("artifact_invalidated");

  // 2. Siivoa workspace temp-tiedostot
  if (this._workspace) {
    try {
      if (typeof this._workspace.cleanup === "function") {
        await this._workspace.cleanup();
        actions.push("workspace_cleaned");
      }
    } catch (e) {
      if (this._debug) console.warn("[FailureRecovery] workspace cleanup error:", e.message);
      actions.push("workspace_cleanup_failed");
    }
  }

  this._log(record, phaseName, "rollback_completed", { actions: actions });

  return { ok: true, actions: actions };
};

// ── handlePhaseError(traceId, phaseName, err) ─────────────────
// Päämetodi jonka BuildPipeline kutsuu kun vaihe kaatuu.
// Palauttaa: { action: "retry"|"rollback"|"abort", delayMs?, attempt? }

FailureRecovery.prototype.handlePhaseError = async function(traceId, phaseName, err) {
  var record = this._builds.get(traceId);
  if (!record) return { action: "abort", reason: "build_not_found" };

  var policy  = PHASE_POLICY[phaseName] || { retry: false, rollback: false, severity: "blocking" };
  var errMsg  = err && err.message ? err.message : String(err);

  this._log(record, phaseName, "phase_error", { error: errMsg, severity: policy.severity });

  // Soft severity — ei estä jatkamista
  if (policy.severity === "soft") {
    this._log(record, phaseName, "soft_fail_continue", {});
    return { action: "continue", reason: "soft_severity" };
  }

  // Retry mahdollinen?
  if (this.shouldRetry(traceId, phaseName)) {
    var retryInfo  = this.recordRetry(traceId, phaseName);
    var delay      = this.retryDelay(traceId, phaseName);
    return { action: "retry", attempt: retryInfo.attempt, delayMs: delay };
  }

  // Rollback tarvitaan?
  if (policy.rollback) {
    await this.rollback(traceId, phaseName);
  }

  // Merkitse failed
  this.setState(traceId, BUILD_STATE.FAILED, { failedPhase: phaseName, error: errMsg });

  // Audit
  if (this._audit) {
    try {
      this._audit.append({
        level:  "ERROR",
        area:   "FACTORY",
        action: "build_failed",
        traceId: traceId,
        phase:  phaseName,
        error:  errMsg
      });
    } catch (e) { /* audit ei saa kaataa recovery:ä */ }
  }

  return { action: "abort", reason: "no_retry_available", failedPhase: phaseName };
};

// ── getBuildRecord(traceId) ───────────────────────────────────

FailureRecovery.prototype.getBuildRecord = function(traceId) {
  return this._builds.get(traceId) || null;
};

FailureRecovery.prototype.getActiveBuildCount = function() {
  var count = 0;
  this._builds.forEach(function(r) {
    if (r.state === BUILD_STATE.RUNNING || r.state === BUILD_STATE.QUEUED) count++;
  });
  return count;
};

FailureRecovery.prototype.getPhasePolicy = function(phaseName) {
  return PHASE_POLICY[phaseName] || null;
};

FailureRecovery.prototype.getAllPolicies = function() {
  return Object.assign({}, PHASE_POLICY);
};

// ── Sisäiset apufunktiot ─────────────────────────────────────

FailureRecovery.prototype._log = function(record, phase, action, data) {
  var entry = {
    ts:     Date.now(),
    phase:  phase || null,
    action: action,
    data:   data || {}
  };
  record.recoveryLog.push(entry);
  // Rajoita loki 200 entryyn per build
  if (record.recoveryLog.length > 200) {
    record.recoveryLog = record.recoveryLog.slice(-200);
  }
};

FailureRecovery.prototype._emit = function(type, payload) {
  if (this._eventBus && typeof this._eventBus.emit === "function") {
    try { this._eventBus.emit(type, payload); } catch (e) { /* ei kaada */ }
  }
};

// ─── Factory ─────────────────────────────────────────────────

export function createFailureRecovery(options) {
  return new FailureRecovery(options);
}

export { FailureRecovery, PHASE_POLICY };
export default FailureRecovery;