// t3/Factory/Factory.js
// T3 Factory - 9-Phase BuildRing with All Workers
// Enterprise Production System

import { EventBus } from "../../k1/Ydin/eventbus.js";
import { createBuildRing } from "./core/build-ring.js";
import { createFactoryMemory } from "./memory/factory-memory.js";
import { createPredictionEngine } from "./core/prediction/prediction-engine.js";

import {
  createAL2BuilderWorker,
  createPackagerWorker,
  createPredictionWorker,
  createPublisherWorker,
  createSecurityScannerWorker
} from "./workers/index.js";

// Enterprise pipeline (BUILD_PROJECT intent)
import { BuildPipeline }          from "./pipeline/build-pipeline.js";
import { WorkspaceAdapter }       from "./adapters/fs/WorkspaceAdapter.js";
import { CommandRunner,
         createStubExecutor }     from "./adapters/tools/CommandRunner.js";
import { TEMPLATES }              from "../templates/index.js";

var FACTORY_STATE = {
  OFFLINE: "OFFLINE",
  BOOTING: "BOOTING",
  READY: "READY",
  BUILDING: "BUILDING",
  STOPPING: "STOPPING",
  ERROR: "ERROR"
};

var FACTORY_EVENT = {
  BOOT_STARTED: "factory:boot:started",
  BOOT_COMPLETED: "factory:boot:completed",
  BOOT_FAILED: "factory:boot:failed",
  SHUTDOWN_STARTED: "factory:shutdown:started",
  SHUTDOWN_COMPLETED: "factory:shutdown:completed",
  BUILD_STARTED: "factory:build:started",
  BUILD_COMPLETED: "factory:build:completed",
  BUILD_FAILED: "factory:build:failed",
  WORKER_STARTED: "factory:worker:started",
  WORKER_COMPLETED: "factory:worker:completed",
  WORKER_FAILED: "factory:worker:failed",
  WORKER_REGISTERED: "factory:worker:registered",
  STATE_CHANGED: "factory:state:changed"
};

function fnv1a32(str) {
  var hash = 2166136261;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function Factory(options) {
  if (!options) options = {};
  
  this._clock = options.clock || null;
  this._owner = options.owner || "system";
  this._debug = options.debug || false;
  this._config = options.config || {};
  
  this._state = FACTORY_STATE.OFFLINE;
  this._bootedAt = null;
  this._sequence = 0;
  
  this._eventBus = null;
  this._buildRing = null;
  this._memory = null;
  this._predictionEngine = null;
  
  this._workers = new Map();
  this._workerOrder = [];

  // Enterprise pipeline (BUILD_PROJECT)
  this._pipeline = null;

  this._stats = {
    builds: 0,
    successes: 0,
    failures: 0,
    totalDurationMs: 0
  };
  
  this._alCoordinator = null;
}

Factory.prototype._now = function() {
  return this._clock ? this._clock.now() : Date.now();
};

Factory.prototype._generateId = function(prefix) {
  this._sequence++;
  var seed = prefix + ":" + this._now() + ":" + this._sequence;
  return prefix + "_" + fnv1a32(seed).toString(16).padStart(8, "0");
};

Factory.prototype._setState = function(newState) {
  var oldState = this._state;
  this._state = newState;
  
  if (this._eventBus) {
    this._eventBus.emit(FACTORY_EVENT.STATE_CHANGED, {
      oldState: oldState,
      newState: newState,
      timestamp: this._now()
    });
  }
};

Factory.prototype._emit = function(eventType, payload) {
  if (this._eventBus) {
    return this._eventBus.emit(eventType, payload);
  }
  return null;
};

Factory.prototype.boot = function() {
  if (this._state !== FACTORY_STATE.OFFLINE) {
    return { ok: false, error: "Factory already booted", state: this._state };
  }
  
  this._setState(FACTORY_STATE.BOOTING);
  this._bootedAt = this._now();
  
  try {
    this._eventBus = new EventBus({
      prefix: "t3",
      clock: this._clock,
      historyLimit: this._config.eventHistoryLimit || 1000
    });
    
    this._emit(FACTORY_EVENT.BOOT_STARTED, {
      bootedAt: this._bootedAt,
      owner: this._owner
    });
    
    if (this._debug) {
      
    }
    
    this._memory = createFactoryMemory({
      clock: this._clock,
      caps: this._config.memoryCaps || {}
    });
    
    if (this._debug) {
      
    }
    
    this._buildRing = createBuildRing({
      clock: this._clock,
      debug: this._debug
    });
    
    if (this._debug) {
      
    }
    
    this._predictionEngine = createPredictionEngine({
      clock: this._clock,
      order: 3,
      debug: this._debug
    });
    
    if (this._debug) {
      
    }
    
    this._initializeWorkers();
    
    if (this._debug) {
      
    }

    // Enterprise pipeline (BUILD_PROJECT)
    this._initializePipeline();
    
    this._setState(FACTORY_STATE.READY);
    
    this._emit(FACTORY_EVENT.BOOT_COMPLETED, {
      bootedAt: this._bootedAt,
      durationMs: this._now() - this._bootedAt,
      workerCount: this._workerOrder.length
    });
    
    this._memory.write("audit", {
      event: "FACTORY:BOOT",
      bootedAt: this._bootedAt,
      workerCount: this._workerOrder.length
    });
    
    return {
      ok: true,
      state: this._state,
      bootedAt: this._bootedAt,
      workers: this._workerOrder.slice()
    };
    
  } catch (err) {
    this._setState(FACTORY_STATE.ERROR);
    
    if (this._eventBus) {
      this._emit(FACTORY_EVENT.BOOT_FAILED, {
        error: err.message
      });
    }
    
    if (this._debug) {
      console.error("[Factory] Boot error:", err);
    }
    
    return {
      ok: false,
      error: err.message,
      state: this._state
    };
  }
};

Factory.prototype._initializeWorkers = function() {
  var clock = this._clock;
  var debug = this._debug;
  
  var securityScanner = createSecurityScannerWorker({
    clock: clock,
    debug: debug,
    id: this._generateId("worker"),
    name: "SecurityScanner"
  });
  this._registerWorker("SECURITY_SCANNER", securityScanner);
  
  var predictionWorker = createPredictionWorker({
    clock: clock,
    debug: debug,
    id: this._generateId("worker"),
    name: "Prediction",
    engine: this._predictionEngine
  });
  this._registerWorker("PREDICTION", predictionWorker);
  
  var al2Builder = createAL2BuilderWorker({
    clock: clock,
    debug: debug,
    id: this._generateId("worker"),
    name: "AL2Builder"
  });
  this._registerWorker("AL2_BUILDER", al2Builder);
  
  var packager = createPackagerWorker({
    clock: clock,
    debug: debug,
    id: this._generateId("worker"),
    name: "Packager"
  });
  this._registerWorker("PACKAGER", packager);
  
  var publisher = createPublisherWorker({
    clock: clock,
    debug: debug,
    id: this._generateId("worker"),
    name: "Publisher"
  });
  this._registerWorker("PUBLISHER", publisher);
};

Factory.prototype._registerWorker = function(type, worker) {
  this._workers.set(type, worker);
  this._workerOrder.push(type);
  
  this._emit(FACTORY_EVENT.WORKER_REGISTERED, {
    type: type,
    id: worker.getId ? worker.getId() : null,
    name: worker.getName ? worker.getName() : type
  });
  
  if (this._debug) {
    
  }
};

Factory.prototype.shutdown = function() {
  if (this._state === FACTORY_STATE.OFFLINE) {
    return { ok: true, message: "Already offline" };
  }
  
  this._emit(FACTORY_EVENT.SHUTDOWN_STARTED, {});
  this._setState(FACTORY_STATE.STOPPING);
  
  var self = this;
  this._workers.forEach(function(worker) {
    if (worker.stop && typeof worker.stop === "function") {
      try {
        worker.stop();
      } catch (err) {
        if (self._debug) {
          console.error("[Factory] Worker stop error:", err);
        }
      }
    }
  });
  
  var uptime = this._now() - this._bootedAt;
  var stats = this.getStats();
  
  this._memory.write("audit", {
    event: "FACTORY:SHUTDOWN",
    uptime: uptime,
    stats: stats
  });
  
  this._emit(FACTORY_EVENT.SHUTDOWN_COMPLETED, {
    uptime: uptime,
    stats: stats
  });
  
  this._setState(FACTORY_STATE.OFFLINE);
  
  return {
    ok: true,
    uptime: uptime,
    stats: stats
  };
};

Factory.prototype.setALCoordinator = function(coordinator) {
  this._alCoordinator = coordinator;
  
  var al2Builder = this._workers.get("AL2_BUILDER");
  if (al2Builder && al2Builder.setCoordinator) {
    al2Builder.setCoordinator(coordinator);
  }
};

Factory.prototype.addALWorker = function(alWorker) {
  var al2Builder = this._workers.get("AL2_BUILDER");
  if (al2Builder && al2Builder.addWorker) {
    al2Builder.addWorker(alWorker);
    return { ok: true };
  }
  return { ok: false, error: "AL2_BUILDER not found" };
};

Factory.prototype.build = async function(config) {
  if (this._state !== FACTORY_STATE.READY) {
    return { ok: false, error: "Factory not ready", state: this._state };
  }
  
  var buildId = this._generateId("build");
  var startTime = this._now();
  
  this._setState(FACTORY_STATE.BUILDING);
  this._stats.builds++;
  
  this._emit(FACTORY_EVENT.BUILD_STARTED, {
    buildId: buildId,
    config: config ? { name: config.name, type: config.type } : {}
  });
  
  var context = {
    buildId: buildId,
    config: config,
    startTime: startTime,
    artifacts: [],
    errors: [],
    failures: [],
    workerResults: new Map()
  };
  
  var self = this;
  
  try {
    for (var i = 0; i < this._workerOrder.length; i++) {
      var workerType = this._workerOrder[i];
      var worker = this._workers.get(workerType);
      
      if (!worker) continue;
      
      if (worker.isAvailable && !worker.isAvailable()) {
        if (this._debug) {
          
        }
        continue;
      }
      
      this._emit(FACTORY_EVENT.WORKER_STARTED, {
        buildId: buildId,
        workerType: workerType
      });
      
      var workerResult = await this._runWorker(worker, workerType, context);
      context.workerResults.set(workerType, workerResult);
      
      if (workerResult.ok) {
        this._emit(FACTORY_EVENT.WORKER_COMPLETED, {
          buildId: buildId,
          workerType: workerType,
          durationMs: workerResult.durationMs
        });
      } else {
        this._emit(FACTORY_EVENT.WORKER_FAILED, {
          buildId: buildId,
          workerType: workerType,
          error: workerResult.error
        });
      }
      
      if (!workerResult.ok && workerResult.critical) {
        throw new Error("Critical worker failure: " + workerType);
      }
    }
    
    var durationMs = this._now() - startTime;
    this._stats.successes++;
    this._stats.totalDurationMs += durationMs;
    
    this._setState(FACTORY_STATE.READY);
    
    this._memory.write("audit", {
      event: "BUILD:SUCCESS",
      buildId: buildId,
      durationMs: durationMs,
      artifactCount: context.artifacts.length
    });
    
    this._emit(FACTORY_EVENT.BUILD_COMPLETED, {
      buildId: buildId,
      durationMs: durationMs,
      artifactCount: context.artifacts.length
    });
    
    return {
      ok: true,
      buildId: buildId,
      artifacts: context.artifacts,
      failures: context.failures,
      durationMs: durationMs,
      workerResults: Object.fromEntries(context.workerResults)
    };
    
  } catch (err) {
    var errorDuration = this._now() - startTime;
    this._stats.failures++;
    this._stats.totalDurationMs += errorDuration;
    
    this._setState(FACTORY_STATE.READY);
    
    this._memory.write("audit", {
      event: "BUILD:FAIL",
      buildId: buildId,
      error: err.message,
      durationMs: errorDuration
    });
    
    this._emit(FACTORY_EVENT.BUILD_FAILED, {
      buildId: buildId,
      error: err.message,
      durationMs: errorDuration
    });
    
    if (this._debug) {
      console.error("[Factory] Build failed:", err);
    }
    
    return {
      ok: false,
      buildId: buildId,
      error: err.message,
      errors: context.errors,
      durationMs: errorDuration
    };
  }
};

Factory.prototype._runWorker = async function(worker, workerType, context) {
  var startTime = this._now();
  
  try {
    var result;
    
    if (worker.process && typeof worker.process === "function") {
      result = await worker.process(context);
    } else if (worker.execute && typeof worker.execute === "function") {
      result = await worker.execute(context);
    } else if (worker.run && typeof worker.run === "function") {
      result = await worker.run(context);
    } else {
      return {
        ok: true,
        skipped: true,
        reason: "No process/execute/run method"
      };
    }
    
    var durationMs = this._now() - startTime;
    
    if (this._debug) {
      
    }
    
    return {
      ok: result ? result.ok !== false : true,
      result: result,
      durationMs: durationMs
    };
    
  } catch (err) {
    if (this._debug) {
      console.error("[Factory] Worker error:", workerType, err);
    }
    
    context.errors.push({
      worker: workerType,
      error: err.message
    });
    
    return {
      ok: false,
      error: err.message,
      critical: workerType === "SECURITY_SCANNER",
      durationMs: this._now() - startTime
    };
  }
};

Factory.prototype.handleCommand = async function(command) {
  if (!command || !command.intent) {
    return { ok: false, error: "No command intent" };
  }
  
  var intent = command.intent.toUpperCase();
  
  if (intent === "BUILD") {
    return await this.build({
      files: command.files || [],
      metadata: command.metadata || {}
    });
  }

  // Enterprise: ProjectSpec-pohjainen deterministinen build
  if (intent === "BUILD_PROJECT" || intent === "BUILD_AND_PUBLISH") {
    return await this.buildFromSpec(command);
  }
  
  if (intent === "STATUS") {
    return { ok: true, status: this.getStatus() };
  }
  
  if (intent === "STATS") {
    return { ok: true, stats: this.getStats() };
  }
  
  if (intent === "SHUTDOWN") {
    return this.shutdown();
  }
  
  return { ok: false, error: "Unknown command: " + intent };
};

// ── Enterprise: BuildPipeline-alustus ────────────────────────

Factory.prototype._initializePipeline = function() {
  var workspace = new WorkspaceAdapter({
    clock:    this._clock,
    eventBus: this._eventBus,
    debug:    this._debug
  });

  var runner = new CommandRunner({
    executor:  createStubExecutor(),  // Expo: stub. Node-runtime injektoi oikean.
    clock:     this._clock,
    eventBus:  this._eventBus,
    debug:     this._debug
  });

  this._pipeline = new BuildPipeline({
    clock:      this._clock,
    eventBus:   this._eventBus,
    config:     this._config,
    memory:     this._memory ? {
      vault:    this._memory.vault    || null,
      registry: this._memory.registry || null,
      audit:    this._memory.audit    || null,
      energy:   this._memory.energy   || null,
      workRing: this._memory.workRing || null
    } : {},
    workspace:  workspace,
    runner:     runner,
    templates:  TEMPLATES,
    stopOnError: true
  });

    if (this._debug) console.log("[Factory] init");
};

// ── Enterprise: buildFromSpec ─────────────────────────────────

Factory.prototype.buildFromSpec = async function(command) {
  if (this._state !== FACTORY_STATE.READY && this._state !== FACTORY_STATE.BUILDING) {
    return { ok: false, error: "Factory not ready", state: this._state };
  }

  if (!this._pipeline) {
    return { ok: false, error: "BuildPipeline ei ole alustettu" };
  }

  // Varmistetaan että command sisältää tarvittavat kentät
  // BUG FIX: hyväksytään myös command.projectSpec (FactoryBridge/BuildSkill lähettää sen tässä muodossa)
  if (!command.target && !command.spec && !command.projectSpec) {
    return { ok: false, error: "BUILD_PROJECT vaatii command.target, command.spec tai command.projectSpec" };
  }

  // Normalisoidaan projectSpec → spec jos target puuttuu
  if (!command.target && !command.spec && command.projectSpec) {
    command = Object.assign({}, command, { spec: command.projectSpec });
  }

  var startTime = this._now();
  this._setState(FACTORY_STATE.BUILDING);
  this._stats.builds++;

  this._emit(FACTORY_EVENT.BUILD_STARTED, {
    intent:  command.intent,
    target:  command.target,
    specId:  command.specId || null
  });

  try {
    // BUG FIX: createWorkspace() ennen pipeline - WorkspaceAdapter vaatii sen
    // WorkspaceAdapter on pure JS virtual filesystem - toimii Snack-ymparistossa
    if (this._pipeline && this._pipeline.workspace) {
      var projectId = (command.spec && command.spec.name)
        ? command.spec.name.replace(/[^a-z0-9_-]/gi, "-").toLowerCase()
        : "build-" + this._now();
      this._pipeline.workspace.createWorkspace(projectId);
    }
    var includePublish = command.intent === "BUILD_AND_PUBLISH";
    var result = includePublish
      ? await this._pipeline.buildAndPublish(command)
      : await this._pipeline.build(command);

    var durationMs = this._now() - startTime;
    this._stats.totalDurationMs += durationMs;

    if (result.ok) {
      this._stats.successes++;
      this._setState(FACTORY_STATE.READY);
      this._emit(FACTORY_EVENT.BUILD_COMPLETED, {
        traceId:   result.traceId,
        durationMs: durationMs,
        phases:    (result.phases || []).length
      });
    } else {
      this._stats.failures++;
      this._setState(FACTORY_STATE.READY); // Pysytään READY — ei kaaduta virheeseen
      this._emit(FACTORY_EVENT.BUILD_FAILED, {
        traceId: result.traceId,
        error:   result.error,
        durationMs: durationMs
      });
    }

    return result;

  } catch (err) {
    this._stats.failures++;
    this._setState(FACTORY_STATE.READY);
    this._emit(FACTORY_EVENT.BUILD_FAILED, { error: err.message });
    return { ok: false, error: err.message };
  }
};

Factory.prototype.getEventBus = function() {
  return this._eventBus;
};

Factory.prototype.getWorker = function(type) {
  return this._workers.get(type) || null;
};

Factory.prototype.getWorkers = function() {
  var result = {};
  var self = this;
  
  this._workerOrder.forEach(function(type) {
    var worker = self._workers.get(type);
    if (worker) {
      result[type] = {
        worker: worker,
        type: type,
        id: worker.getId ? worker.getId() : null,
        name: worker.getName ? worker.getName() : type,
        state: worker.getState ? worker.getState() : "UNKNOWN",
        available: worker.isAvailable ? worker.isAvailable() : true,
        stats: worker.getStats ? worker.getStats() : null
      };
    }
  });
  
  return result;
};

Factory.prototype.getWorkerTypes = function() {
  return this._workerOrder.slice();
};

Factory.prototype.getWorkerStats = function() {
  var stats = {};
  
  this._workers.forEach(function(worker, type) {
    if (worker.getStats && typeof worker.getStats === "function") {
      stats[type] = worker.getStats();
    } else {
      stats[type] = {
        state: worker.getState ? worker.getState() : "UNKNOWN"
      };
    }
  });
  
  return stats;
};

Factory.prototype.getPredictionEngine = function() {
  return this._predictionEngine;
};

Factory.prototype.getBuildRing = function() {
  // DEPRECATED — kayta getStats() tai _pipeline suoraan
  return this._buildRing;
};

Factory.prototype.getMemory = function() {
  return this._memory;
};

Factory.prototype.getState = function() {
  return this._state;
};

Factory.prototype.isReady = function() {
  return this._state === FACTORY_STATE.READY;
};

Factory.prototype.isBuilding = function() {
  return this._state === FACTORY_STATE.BUILDING;
};

Factory.prototype.train = function(text, documentId) {
  if (!this._predictionEngine) {
    return { ok: false, error: "No prediction engine" };
  }
  return this._predictionEngine.train(text, documentId);
};

Factory.prototype.predict = function(context, options) {
  if (!this._predictionEngine) {
    return { ok: false, error: "No prediction engine", predictions: [] };
  }
  return this._predictionEngine.predict(context, options);
};

Factory.prototype.getStatus = function() {
  var workerStatuses = {};
  
  this._workers.forEach(function(worker, type) {
    workerStatuses[type] = {
      state: worker.getState ? worker.getState() : "UNKNOWN",
      available: worker.isAvailable ? worker.isAvailable() : true
    };
  });
  
  return {
    state: this._state,
    bootedAt: this._bootedAt,
    uptime: this._bootedAt ? this._now() - this._bootedAt : 0,
    workerCount: this._workers.size,
    workers: workerStatuses,
    eventBus: this._eventBus ? this._eventBus.getStats() : null,
    predictionEngine: this._predictionEngine ? this._predictionEngine.getStats() : null,
    buildRing: this._buildRing ? this._buildRing.getStats() : null,
    memory: this._memory ? this._memory.getStats() : null,
    alCoordinatorConnected: this._alCoordinator !== null
  };
};

Factory.prototype.getStats = function() {
  return {
    state: this._state,
    builds: this._stats.builds,
    successes: this._stats.successes,
    failures: this._stats.failures,
    successRate: this._stats.builds > 0
      ? Math.round((this._stats.successes / this._stats.builds) * 100)
      : 0,
    avgDurationMs: this._stats.builds > 0
      ? Math.round(this._stats.totalDurationMs / this._stats.builds)
      : 0,
    workerCount: this._workers.size
  };
};

Factory.prototype.on = function(eventType, handler) {
  if (!this._eventBus) {
    throw new Error("Factory not booted - no event bus");
  }
  return this._eventBus.subscribe(eventType, handler);
};

Factory.prototype.off = function(eventType, handler) {
  if (this._eventBus) {
    this._eventBus.unsubscribe(eventType, handler);
  }
};

function createFactory(options) {
  return new Factory(options);
}

export { Factory, createFactory, FACTORY_STATE, FACTORY_EVENT };