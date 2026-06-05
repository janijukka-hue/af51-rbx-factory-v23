// t3/Factory/workers/prediction-worker.js
// Prediction Worker for Factory
// T3 Layer

var WORKER_STATE = {
  IDLE: "IDLE",
  BUSY: "BUSY",
  ERROR: "ERROR",
  STOPPED: "STOPPED"
};

var WORKER_TYPE = "PREDICTION";

function fnv1a32(str) {
  var hash = 2166136261;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function PredictionWorker(options) {
  if (!options) options = {};
  
  this._clock = options.clock || null;
  this._debug = options.debug || false;
  
  this._id = options.id || this._generateId();
  this._name = options.name || "PredictionWorker";
  
  this._engine = options.engine || null;
  
  this._state = WORKER_STATE.IDLE;
  this._sequence = 0;
  this._currentTask = null;
  
  // Queue
  this._queue = [];
  this._maxQueueSize = options.maxQueueSize || 100;
  
  // Stats
  this._stats = {
    tasksReceived: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    trainTasks: 0,
    predictTasks: 0,
    completeTasks: 0,
    totalDurationMs: 0
  };
  
  // Callbacks
  this._onComplete = options.onComplete || null;
  this._onError = options.onError || null;
}

PredictionWorker.prototype._now = function() {
  return this._clock ? this._clock.now() : Date.now();
};

PredictionWorker.prototype._generateId = function() {
  this._sequence++;
  var seed = "pw:" + Date.now() + ":" + this._sequence;
  return "pw_" + fnv1a32(seed).toString(16).padStart(8, "0");
};

PredictionWorker.prototype.getId = function() {
  return this._id;
};

PredictionWorker.prototype.getName = function() {
  return this._name;
};

PredictionWorker.prototype.getType = function() {
  return WORKER_TYPE;
};

PredictionWorker.prototype.getState = function() {
  return this._state;
};

PredictionWorker.prototype.setEngine = function(engine) {
  this._engine = engine;
};

PredictionWorker.prototype.isAvailable = function() {
  return this._state === WORKER_STATE.IDLE && this._engine !== null;
};

/* -------------------------------------------------------------------------- */
/*                              TASK HANDLING                                 */
/* -------------------------------------------------------------------------- */

PredictionWorker.prototype.submit = function(task) {
  if (!task) {
    return { ok: false, error: "NO_TASK" };
  }
  
  if (this._queue.length >= this._maxQueueSize) {
    return { ok: false, error: "QUEUE_FULL" };
  }
  
  var taskId = task.id || this._generateId();
  
  var wrappedTask = {
    id: taskId,
    type: task.type || "PREDICT",
    data: task.data || {},
    submittedAt: this._now(),
    priority: task.priority || 0
  };
  
  this._queue.push(wrappedTask);
  this._stats.tasksReceived++;
  
  // Sort by priority (higher first)
  this._queue.sort(function(a, b) {
    return b.priority - a.priority;
  });
  
  // Auto-process if idle
  if (this._state === WORKER_STATE.IDLE) {
    this._processNext();
  }
  
  return {
    ok: true,
    taskId: taskId,
    queuePosition: this._queue.length
  };
};

PredictionWorker.prototype._processNext = async function() {
  if (this._state !== WORKER_STATE.IDLE) {
    return;
  }
  
  if (this._queue.length === 0) {
    return;
  }
  
  if (!this._engine) {
    return;
  }
  
  var task = this._queue.shift();
  this._currentTask = task;
  this._state = WORKER_STATE.BUSY;
  
  var startTime = this._now();
  var result;
  
  try {
    switch (task.type) {
      case "TRAIN":
        result = await this._handleTrain(task);
        this._stats.trainTasks++;
        break;
        
      case "PREDICT":
        result = await this._handlePredict(task);
        this._stats.predictTasks++;
        break;
        
      case "COMPLETE":
        result = await this._handleComplete(task);
        this._stats.completeTasks++;
        break;
        
      default:
        result = { ok: false, error: "UNKNOWN_TASK_TYPE: " + task.type };
    }
    
    var durationMs = this._now() - startTime;
    this._stats.totalDurationMs += durationMs;
    
    if (result.ok) {
      this._stats.tasksCompleted++;
    } else {
      this._stats.tasksFailed++;
    }
    
    result.taskId = task.id;
    result.durationMs = durationMs;
    
    if (this._onComplete && result.ok) {
      try {
        this._onComplete(result);
      } catch (err) {
        if (this._debug) {
          console.error("[PredictionWorker] onComplete error:", err);
        }
      }
    }
    
    if (this._onError && !result.ok) {
      try {
        this._onError(result);
      } catch (err) {
        if (this._debug) {
          console.error("[PredictionWorker] onError error:", err);
        }
      }
    }
    
  } catch (err) {
    this._stats.tasksFailed++;
    this._state = WORKER_STATE.ERROR;
    
    if (this._debug) {
      console.error("[PredictionWorker] Task error:", err);
    }
    
    if (this._onError) {
      try {
        this._onError({
          ok: false,
          taskId: task.id,
          error: err.message
        });
      } catch (e) {
        // ignore
      }
    }
  }
  
  this._currentTask = null;
  this._state = WORKER_STATE.IDLE;
  
  // Process next in queue
  if (this._queue.length > 0) {
    var self = this;
    setImmediate(function() {
      self._processNext();
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                              TASK HANDLERS                                 */
/* -------------------------------------------------------------------------- */

PredictionWorker.prototype._handleTrain = async function(task) {
  var data = task.data;
  
  if (!data.text) {
    return { ok: false, error: "NO_TEXT_TO_TRAIN" };
  }
  
  var result = this._engine.train(data.text, data.documentId);
  
  return {
    ok: result.ok,
    type: "TRAIN",
    result: result
  };
};

PredictionWorker.prototype._handlePredict = async function(task) {
  var data = task.data;
  
  if (!data.context) {
    return { ok: false, error: "NO_CONTEXT" };
  }
  
  var result = this._engine.predict(data.context, {
    type: data.predictionType || "NEXT_TOKEN",
    count: data.count || 5
  });
  
  return {
    ok: result.ok,
    type: "PREDICT",
    result: result
  };
};

PredictionWorker.prototype._handleComplete = async function(task) {
  var data = task.data;
  
  if (!data.input) {
    return { ok: false, error: "NO_INPUT" };
  }
  
  var result = this._engine.complete(data.input, {
    maxTokens: data.maxTokens || 20
  });
  
  return {
    ok: result.ok,
    type: "COMPLETE",
    result: result
  };
};

/* -------------------------------------------------------------------------- */
/*                              CONTROL                                       */
/* -------------------------------------------------------------------------- */

PredictionWorker.prototype.stop = function() {
  this._state = WORKER_STATE.STOPPED;
  this._queue = [];
  this._currentTask = null;
  
  return { ok: true };
};

PredictionWorker.prototype.resume = function() {
  if (this._state === WORKER_STATE.STOPPED || this._state === WORKER_STATE.ERROR) {
    this._state = WORKER_STATE.IDLE;
    this._processNext();
    return { ok: true };
  }
  
  return { ok: false, error: "NOT_STOPPED" };
};

PredictionWorker.prototype.clearQueue = function() {
  var count = this._queue.length;
  this._queue = [];
  return { ok: true, cleared: count };
};

/* -------------------------------------------------------------------------- */
/*                              STATS                                         */
/* -------------------------------------------------------------------------- */

PredictionWorker.prototype.getStats = function() {
  return {
    id: this._id,
    name: this._name,
    type: WORKER_TYPE,
    state: this._state,
    queueSize: this._queue.length,
    currentTask: this._currentTask ? this._currentTask.id : null,
    tasksReceived: this._stats.tasksReceived,
    tasksCompleted: this._stats.tasksCompleted,
    tasksFailed: this._stats.tasksFailed,
    trainTasks: this._stats.trainTasks,
    predictTasks: this._stats.predictTasks,
    completeTasks: this._stats.completeTasks,
    successRate: this._stats.tasksReceived > 0
      ? Math.round((this._stats.tasksCompleted / this._stats.tasksReceived) * 100)
      : 0,
    avgDurationMs: this._stats.tasksCompleted > 0
      ? Math.round(this._stats.totalDurationMs / this._stats.tasksCompleted)
      : 0,
    engineConnected: this._engine !== null
  };
};

PredictionWorker.prototype.getQueueStatus = function() {
  return {
    size: this._queue.length,
    tasks: this._queue.map(function(t) {
      return {
        id: t.id,
        type: t.type,
        priority: t.priority,
        submittedAt: t.submittedAt
      };
    })
  };
};

/* -------------------------------------------------------------------------- */
/*                              FACTORY                                       */
/* -------------------------------------------------------------------------- */

function createPredictionWorker(options) {
  return new PredictionWorker(options);
}

export {
  PredictionWorker,
  createPredictionWorker,
  WORKER_STATE,
  WORKER_TYPE
};