// t3/Factory/pipeline/stages/prediction-stage.js
// Prediction Stage for BuildRing Pipeline
// T3 Layer

var STAGE_NAME = "PREDICTION";

var STAGE_STATE = {
  IDLE: "IDLE",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED"
};

function PredictionStage(options) {
  if (!options) options = {};
  
  this._clock = options.clock || null;
  this._debug = options.debug || false;
  
  this._engine = options.engine || null;
  
  this._state = STAGE_STATE.IDLE;
  this._sequence = 0;
  
  // Config
  this._autoTrain = options.autoTrain !== false;
  this._predictOnBuild = options.predictOnBuild !== false;
  this._minTokensForPrediction = options.minTokensForPrediction || 3;
  
  // Stats
  this._stats = {
    processed: 0,
    trained: 0,
    predicted: 0,
    skipped: 0,
    errors: 0,
    totalDurationMs: 0
  };
}

PredictionStage.prototype._now = function() {
  return this._clock ? this._clock.now() : Date.now();
};

PredictionStage.prototype.getName = function() {
  return STAGE_NAME;
};

PredictionStage.prototype.getState = function() {
  return this._state;
};

PredictionStage.prototype.setEngine = function(engine) {
  this._engine = engine;
};

PredictionStage.prototype.process = async function(context) {
  if (!context) {
    return { ok: false, error: "NO_CONTEXT", stage: STAGE_NAME };
  }
  
  var startTime = this._now();
  this._state = STAGE_STATE.PROCESSING;
  this._stats.processed++;
  
  try {
    if (!this._engine) {
      this._state = STAGE_STATE.SKIPPED;
      this._stats.skipped++;
      
      return {
        ok: true,
        stage: STAGE_NAME,
        state: STAGE_STATE.SKIPPED,
        reason: "NO_ENGINE"
      };
    }
    
    var result = {
      stage: STAGE_NAME,
      trained: false,
      predicted: false,
      predictions: []
    };
    
    // Auto-train on source code / content
    if (this._autoTrain && context.content) {
      var content = this._extractTrainableContent(context);
      
      if (content && content.length > 0) {
        var trainResult = this._engine.train(content, context.buildId);
        result.trained = trainResult.ok;
        result.trainStats = {
          tokenCount: trainResult.tokenCount,
          vocabularySize: trainResult.vocabularySize
        };
        
        this._stats.trained++;
      }
    }
    
    // Predict based on context
    if (this._predictOnBuild && context.input) {
      var tokens = context.input.split(/\s+/);
      
      if (tokens.length >= this._minTokensForPrediction) {
        var predictResult = this._engine.predict(context.input, {
          type: "NEXT_TOKEN",
          count: 5
        });
        
        if (predictResult.ok) {
          result.predicted = true;
          result.predictions = predictResult.predictions;
          this._stats.predicted++;
        }
      }
    }
    
    var durationMs = this._now() - startTime;
    this._stats.totalDurationMs += durationMs;
    
    this._state = STAGE_STATE.COMPLETED;
    
    return {
      ok: true,
      stage: STAGE_NAME,
      state: STAGE_STATE.COMPLETED,
      result: result,
      durationMs: durationMs
    };
    
  } catch (err) {
    this._state = STAGE_STATE.FAILED;
    this._stats.errors++;
    
    if (this._debug) {
      console.error("[PredictionStage] Error:", err);
    }
    
    return {
      ok: false,
      stage: STAGE_NAME,
      state: STAGE_STATE.FAILED,
      error: err.message,
      durationMs: this._now() - startTime
    };
  }
};

PredictionStage.prototype._extractTrainableContent = function(context) {
  var parts = [];
  
  // Source code
  if (context.sourceCode) {
    parts.push(context.sourceCode);
  }
  
  // Files content
  if (context.files && Array.isArray(context.files)) {
    for (var i = 0; i < context.files.length; i++) {
      var file = context.files[i];
      if (file.content && typeof file.content === "string") {
        parts.push(file.content);
      }
    }
  }
  
  // Generic content
  if (context.content && typeof context.content === "string") {
    parts.push(context.content);
  }
  
  // Comments / documentation
  if (context.comments && Array.isArray(context.comments)) {
    parts.push(context.comments.join(" "));
  }
  
  return parts.join("\n\n");
};

PredictionStage.prototype.getStats = function() {
  return {
    name: STAGE_NAME,
    state: this._state,
    processed: this._stats.processed,
    trained: this._stats.trained,
    predicted: this._stats.predicted,
    skipped: this._stats.skipped,
    errors: this._stats.errors,
    avgDurationMs: this._stats.processed > 0
      ? Math.round(this._stats.totalDurationMs / this._stats.processed)
      : 0,
    engineStats: this._engine ? this._engine.getStats() : null
  };
};

PredictionStage.prototype.reset = function() {
  this._state = STAGE_STATE.IDLE;
  this._stats = {
    processed: 0,
    trained: 0,
    predicted: 0,
    skipped: 0,
    errors: 0,
    totalDurationMs: 0
  };
};

function createPredictionStage(options) {
  return new PredictionStage(options);
}

export {
  PredictionStage,
  createPredictionStage,
  STAGE_NAME,
  STAGE_STATE
};