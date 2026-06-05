// t3/Factory/core/build-ring.js
// ⚠️  DEPRECATED — EI KÄYTÖSSÄ
//
// Tämä on 9-vaiheinen vanha pipeline-toteutus.
// Autoritatiivinen pipeline on:
//   t3/Factory/pipeline/build-pipeline.js  (13 vaihetta)
//
// Factory.js alustaa tämän mutta ei käytä sitä build-poluissa.
// getBuildRing() palauttaa sen getStats()-kutsua varten — ei muuhun.
//
// Poistettava kun Factory.js refaktoroidaan käyttämään
// vain BuildPipeline:a myös stats-raportoinnissa.
//
// Riski [1] — tunnistettu 2026-03-29
// Korjaaja: refaktoroi Factory.js _buildRing → _pipeline stats

var BUILD_PHASE = {
  INIT: "INIT",
  VALIDATE: "VALIDATE",
  ANALYZE: "ANALYZE",
  TRANSFORM: "TRANSFORM",
  COMPILE: "COMPILE",
  OPTIMIZE: "OPTIMIZE",
  PACKAGE: "PACKAGE",
  VERIFY: "VERIFY",
  FINALIZE: "FINALIZE"
};

var BUILD_STATE = {
  IDLE: "IDLE",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
};

var PHASE_ORDER = [
  BUILD_PHASE.INIT,
  BUILD_PHASE.VALIDATE,
  BUILD_PHASE.ANALYZE,
  BUILD_PHASE.TRANSFORM,
  BUILD_PHASE.COMPILE,
  BUILD_PHASE.OPTIMIZE,
  BUILD_PHASE.PACKAGE,
  BUILD_PHASE.VERIFY,
  BUILD_PHASE.FINALIZE
];

function fnv1a32(str) {
  var hash = 2166136261;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function BuildRing(options) {
  if (!options) options = {};
  
  this._clock = options.clock || null;
  this._debug = options.debug || false;
  
  this._state = BUILD_STATE.IDLE;
  this._currentPhase = null;
  this._sequence = 0;
  
  this._phaseHandlers = new Map();
  
  this._stats = {
    runsCompleted: 0,
    runsFailed: 0,
    totalDurationMs: 0,
    phaseDurations: {}
  };
  
  for (var i = 0; i < PHASE_ORDER.length; i++) {
    this._stats.phaseDurations[PHASE_ORDER[i]] = 0;
  }
}

BuildRing.prototype._now = function() {
  return this._clock ? this._clock.now() : Date.now();
};

BuildRing.prototype._generateId = function(prefix) {
  this._sequence++;
  var seed = prefix + ":" + this._now() + ":" + this._sequence;
  return prefix + "_" + fnv1a32(seed).toString(16).padStart(8, "0");
};

BuildRing.prototype.registerPhaseHandler = function(phase, handler) {
  if (PHASE_ORDER.indexOf(phase) === -1) {
    return { ok: false, error: "Invalid phase: " + phase };
  }
  
  if (typeof handler !== "function") {
    return { ok: false, error: "Handler must be a function" };
  }
  
  this._phaseHandlers.set(phase, handler);
  
  if (this._debug) {
    
  }
  
  return { ok: true, phase: phase };
};

BuildRing.prototype.run = async function(input) {
  if (this._state === BUILD_STATE.RUNNING) {
    return { ok: false, error: "Build already running" };
  }
  
  var runId = this._generateId("run");
  var startTime = this._now();
  
  this._state = BUILD_STATE.RUNNING;
  
  var context = {
    runId: runId,
    startTime: startTime,
    input: input || {},
    artifacts: [],
    errors: [],
    failures: [],
    metadata: {},
    phaseResults: {}
  };
  
  var phases = [];
  
  try {
    for (var i = 0; i < PHASE_ORDER.length; i++) {
      var phase = PHASE_ORDER[i];
      this._currentPhase = phase;
      
      var phaseStart = this._now();
      var handler = this._phaseHandlers.get(phase);
      
      var phaseResult;
      
      if (handler) {
        try {
          phaseResult = await handler(context, phase);
        } catch (err) {
          phaseResult = { ok: false, error: err.message };
        }
      } else {
        phaseResult = { ok: true, skipped: true };
      }
      
      var phaseDuration = this._now() - phaseStart;
      this._stats.phaseDurations[phase] += phaseDuration;
      
      context.phaseResults[phase] = phaseResult;
      
      phases.push({
        phase: phase,
        ok: phaseResult ? phaseResult.ok !== false : true,
        durationMs: phaseDuration,
        skipped: phaseResult ? phaseResult.skipped === true : false
      });
      
      if (phaseResult && phaseResult.ok === false && !phaseResult.skipped) {
        var isCritical = phase === BUILD_PHASE.VALIDATE || 
                         phase === BUILD_PHASE.COMPILE ||
                         phase === BUILD_PHASE.VERIFY;
        
        if (isCritical) {
          throw new Error("Critical phase failed: " + phase + " - " + (phaseResult.error || "Unknown error"));
        }
      }
      
      if (this._debug) {
        
      }
    }
    
    var totalDuration = this._now() - startTime;
    this._stats.runsCompleted++;
    this._stats.totalDurationMs += totalDuration;
    
    this._state = BUILD_STATE.COMPLETED;
    this._currentPhase = null;
    
    return {
      ok: true,
      runId: runId,
      phases: phases,
      artifacts: context.artifacts,
      failures: context.failures,
      durationMs: totalDuration
    };
    
  } catch (err) {
    var errorDuration = this._now() - startTime;
    this._stats.runsFailed++;
    this._stats.totalDurationMs += errorDuration;
    
    this._state = BUILD_STATE.FAILED;
    
    if (this._debug) {
      console.error("[BuildRing] Run failed:", err);
    }
    
    return {
      ok: false,
      runId: runId,
      error: err.message,
      failedPhase: this._currentPhase,
      phases: phases,
      errors: context.errors,
      durationMs: errorDuration
    };
  }
};

BuildRing.prototype.reset = function() {
  this._state = BUILD_STATE.IDLE;
  this._currentPhase = null;
  return { ok: true };
};

BuildRing.prototype.getState = function() {
  return this._state;
};

BuildRing.prototype.getCurrentPhase = function() {
  return this._currentPhase;
};

BuildRing.prototype.getStats = function() {
  return {
    state: this._state,
    currentPhase: this._currentPhase,
    runsCompleted: this._stats.runsCompleted,
    runsFailed: this._stats.runsFailed,
    totalRuns: this._stats.runsCompleted + this._stats.runsFailed,
    avgDurationMs: (this._stats.runsCompleted + this._stats.runsFailed) > 0
      ? Math.round(this._stats.totalDurationMs / (this._stats.runsCompleted + this._stats.runsFailed))
      : 0,
    phaseDurations: Object.assign({}, this._stats.phaseDurations)
  };
};

BuildRing.prototype.getPhases = function() {
  return PHASE_ORDER.slice();
};

function createBuildRing(options) {
  return new BuildRing(options);
}

export { BuildRing, createBuildRing, BUILD_PHASE, BUILD_STATE, PHASE_ORDER };