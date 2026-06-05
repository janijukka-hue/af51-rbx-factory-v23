// m2/Ohjaus/learning-engine.js
// M2 Learning Engine - Heuristic Pattern Learning

var LEARNING_STATE = {
  IDLE: "IDLE",
  RUNNING: "RUNNING",
  STOPPED: "STOPPED"
};

function LearningEngine(options) {
  if (!options) {
    options = {};
  }
  
  this._clock = options.clock;
  this._coreMemory = options.coreMemory || null;
  this._alx = options.alx || null;
  this._debug = options.debug || false;
  
  this._state = LEARNING_STATE.IDLE;
  
  this._intentFrequency = new Map();
  this._commandFrequency = new Map();
  this._sequenceBuffer = [];
  this._sequenceWindowSize = 5;
  
  this._timingData = new Map();
  this._lastCommandTime = null;
  
  this._patterns = new Map();
  this._minPatternCount = 3;
  
  this._profile = {
    preferredLanguage:      null,        // Tunnistettu kieli
    mostUsedIntents:        [],          // Top-intents
    timeOfDayDistribution:  new Array(24).fill(0),
    errorRate:              0,           // command-tason virheet (ei build-failit)
    fiScoreTotal:           0,
    enScoreTotal:           0
    // averageSessionLength ja sessionCount: toteutetaan kun session tracking lisätään
  };
  
  this._totalCommands = 0;
  this._totalErrors   = 0;
  this._sessionCount  = 0;

  // Erillinen build-tulos tilastoille — ei sekoiteta _timingData:n kanssa
  this._buildOutcomeStats = new Map();   // target -> { ok: N, fail: N }

  // Pattern-kasvu rajoitettu
  this._maxPatterns = 500;
}

// _now() — yhtenäinen aikamalli, käyttää _clock:ia jos annettu
LearningEngine.prototype._now = function() {
  if (this._clock && typeof this._clock.now === "function") {
    return Number(this._clock.now());
  }
  return Date.now();
};

LearningEngine.prototype.boot = async function() {
  this._state = LEARNING_STATE.RUNNING;
  
  // Load previously learned data
  await this.loadFromMemory();
  
  if (this._debug) {
    
  }
  
  return { ok: true };
};

LearningEngine.prototype.shutdown = async function() {
  // Persist before shutdown
  await this._persistToMemory();
  
  this._state = LEARNING_STATE.STOPPED;
  
  if (this._debug) {
    
  }
  
  return { ok: true };
};

LearningEngine.prototype.observeInput = function(input, ctx) {
  if (this._state !== LEARNING_STATE.RUNNING) {
    return;
  }
  
  var now = Date.now();
  
  if (this._lastCommandTime) {
    var gap = now - this._lastCommandTime;
    this._recordTiming("command_gap", gap);
  }
  this._lastCommandTime = now;
  
  var hour = new Date(now).getHours();
  this._profile.timeOfDayDistribution[hour]++;
  
  var normalized = this._normalizeInput(input);
  var count = this._commandFrequency.get(normalized) || 0;
  this._commandFrequency.set(normalized, count + 1);
  
  this._totalCommands++;
};

LearningEngine.prototype.observeResult = function(input, result) {
  if (this._state !== LEARNING_STATE.RUNNING) {
    return;
  }
  
  if (result.intent) {
    var intentCount = this._intentFrequency.get(result.intent) || 0;
    this._intentFrequency.set(result.intent, intentCount + 1);
    
    this._sequenceBuffer.push(result.intent);
    // Keep buffer at max 2x windowSize
    if (this._sequenceBuffer.length > this._sequenceWindowSize * 2) {
      this._sequenceBuffer = this._sequenceBuffer.slice(-this._sequenceWindowSize * 2);
    }
    
    this._detectPatterns();
  }
  
  if (!result.ok) {
    this._totalErrors++;
  }
  
  if (this._totalCommands > 0) {
    this._profile.errorRate = this._totalErrors / this._totalCommands;
  }
  
  if (result.durationMs) {
    this._recordTiming("execution_" + (result.intent || "unknown"), result.durationMs);
  }
  
  if (result.intent === "GREETING" || result.intent === "HELP") {
    this._detectLanguage(input);
  }
  
  this._updateMostUsedIntents();
};

LearningEngine.prototype._detectPatterns = function() {
  if (this._sequenceBuffer.length < this._sequenceWindowSize) {
    return;
  }
  
  var window = this._sequenceBuffer.slice(-this._sequenceWindowSize);
  var pattern = window.join("->");
  
  var count = this._patterns.get(pattern) || 0;
  this._patterns.set(pattern, count + 1);

  // Rajoita kasvua — pidä vain yleisimmät
  if (this._patterns.size > this._maxPatterns) {
    var entries = Array.from(this._patterns.entries());
    entries.sort(function(a, b) { return a[1] - b[1]; });
    // Poista harvinaisimmat 20%
    var removeCount = Math.floor(this._maxPatterns * 0.2);
    for (var i = 0; i < removeCount; i++) {
      this._patterns.delete(entries[i][0]);
    }
  }
};

LearningEngine.prototype._detectLanguage = function(input) {
  if (!input || typeof input !== "string") {
    return;
  }
  
  var lower = input.toLowerCase();
  var fiIndicators = ["moi", "hei", "terve", "apua", "kiitos"];
  var enIndicators = ["hi", "hello", "help", "thanks", "please"];
  
  var fiScore = 0;
  var enScore = 0;
  
  for (var i = 0; i < fiIndicators.length; i++) {
    if (lower.indexOf(fiIndicators[i]) !== -1) {
      fiScore++;
    }
  }
  
  for (var j = 0; j < enIndicators.length; j++) {
    if (lower.indexOf(enIndicators[j]) !== -1) {
      enScore++;
    }
  }
  
  this._profile.fiScoreTotal += fiScore;
  this._profile.enScoreTotal += enScore;
  
  // Decide language when difference > threshold
  var threshold = 3;
  if (this._profile.fiScoreTotal - this._profile.enScoreTotal > threshold) {
    this._profile.preferredLanguage = "fi";
  } else if (this._profile.enScoreTotal - this._profile.fiScoreTotal > threshold) {
    this._profile.preferredLanguage = "en";
  }
};

LearningEngine.prototype._updateMostUsedIntents = function() {
  var entries = Array.from(this._intentFrequency.entries());
  entries.sort(function(a, b) {
    return b[1] - a[1];
  });
  
  this._profile.mostUsedIntents = entries.slice(0, 5).map(function(e) {
    return { intent: e[0], count: e[1] };
  });
};

LearningEngine.prototype._recordTiming = function(key, value) {
  if (!this._timingData.has(key)) {
    this._timingData.set(key, []);
  }
  
  var samples = this._timingData.get(key);
  samples.push(value);
  
  if (samples.length > 100) {
    samples.shift();
  }
};

LearningEngine.prototype.getSuggestions = function(context) {
  var suggestions = [];
  
  if (this._sequenceBuffer.length >= this._sequenceWindowSize - 1) {
    var recent = this._sequenceBuffer.slice(-(this._sequenceWindowSize - 1));
    var prefix = recent.join("->");
    var minCount = this._minPatternCount;
    
    this._patterns.forEach(function(count, pattern) {
      if (pattern.indexOf(prefix) === 0 && count >= minCount) {
        var parts = pattern.split("->");
        var nextIntent = parts[parts.length - 1];
        suggestions.push({
          type: "pattern",
          intent: nextIntent,
          confidence: Math.min(count / 10, 1),
          reason: "Based on your typical workflow"
        });
      }
    });
  }
  
  if (this._profile.mostUsedIntents.length > 0 && suggestions.length < 3) {
    for (var i = 0; i < this._profile.mostUsedIntents.length && suggestions.length < 3; i++) {
      var used = this._profile.mostUsedIntents[i];
      var alreadySuggested = suggestions.some(function(s) {
        return s.intent === used.intent;
      });
      
      if (!alreadySuggested) {
        suggestions.push({
          type: "frequency",
          intent: used.intent,
          confidence: 0.5,
          reason: "Frequently used"
        });
      }
    }
  }
  
  return suggestions;
};

LearningEngine.prototype._persistToMemory = async function() {
  if (!this._coreMemory) {
    if (this._debug) {
      
    }
    return;
  }
  
  try {
    var minCount = this._minPatternCount;
    var patternsArray = [];
    this._patterns.forEach(function(count, pattern) {
      if (count >= minCount) {
        patternsArray.push([pattern, count]);
      }
    });
    
    await this._coreMemory.write({
      store: "semantic",
      content: {
        type: "USER_PROFILE",
        profile: this._profile,
        intentFrequency: Array.from(this._intentFrequency.entries()),
        patterns: patternsArray,
        totalCommands: this._totalCommands,
        totalErrors: this._totalErrors
      },
      tags: ["learning", "profile", "user"],
      metadata: { persistedAt: Date.now() }
    });
    
    if (this._debug) {
      
    }
  } catch (err) {
    if (this._debug) {
      console.error("[LearningEngine] Persist error:", err);
    }
  }
};

LearningEngine.prototype.loadFromMemory = async function() {
  if (!this._coreMemory) {
    return { ok: false, error: "No CoreMemory" };
  }
  
  try {
    var entries = await this._coreMemory.query({
      store: "semantic",
      tags: ["learning", "profile"],
      limit: 1
    });
    
    if (entries.length > 0) {
      var data = entries[0].content;
      
      if (data.profile) {
        this._profile = data.profile;
      }
      
      if (data.intentFrequency) {
        this._intentFrequency = new Map(data.intentFrequency);
      }
      
      if (data.patterns) {
        this._patterns = new Map(data.patterns);
      }
      
      if (data.totalCommands) {
        this._totalCommands = data.totalCommands;
      }
      
      if (data.totalErrors) {
        this._totalErrors = data.totalErrors;
      }
      
      if (this._debug) {
        
      }
      
      return { ok: true };
    }
    
    return { ok: true, message: "No saved data" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

LearningEngine.prototype._normalizeInput = function(input) {
  if (typeof input !== "string") {
    return "";
  }
  return input.toLowerCase().trim().substring(0, 50);
};

LearningEngine.prototype.getStats = function() {
  return {
    state: this._state,
    totalCommands: this._totalCommands,
    totalErrors: this._totalErrors,
    errorRate: Math.round(this._profile.errorRate * 100) + "%",
    uniqueIntents: this._intentFrequency.size,
    uniqueCommands: this._commandFrequency.size,
    patternsDetected: this._patterns.size,
    preferredLanguage: this._profile.preferredLanguage,
    mostUsedIntents: this._profile.mostUsedIntents.slice(0, 3)
  };
};

LearningEngine.prototype.getProfile = function() {
  return this._profile;
};

function createLearningEngine(options) {
  return new LearningEngine(options);
}

// ─── ALX Factory integraatio ─────────────────────────────────
//
// LearningEngine EI SAA: kutsua executea, kirjoittaa policyyn,
// ohittaa invariantteja tai antaa suoria käskyjä.
// Se SAA: havainnoida, tilastoida, ehdottaa.

LearningEngine.prototype.observeBuildResult = function(spec, result) {
  if (this._state !== LEARNING_STATE.RUNNING) return;
  if (!spec || !result) return;

  var key = "build_" + (spec.target || "unknown");
  var existing = this._buildOutcomeStats.get(key) || { ok: 0, fail: 0 };
  if (result.ok) { existing.ok++; } else { existing.fail++; }
  this._buildOutcomeStats.set(key, existing);
  // Build-failit kirjataan erikseen — ei sekoiteta command error rateen
  if (!result.ok && this.cfg && this.cfg.debug) {
    
  }

  if (result.durationMs) {
    this._recordTiming("build_" + (spec.target || "unknown"), result.durationMs);
  }

  this._sequenceBuffer.push("BUILD_PROJECT");
  if (this._sequenceBuffer.length > this._sequenceWindowSize * 2) {
    this._sequenceBuffer = this._sequenceBuffer.slice(-this._sequenceWindowSize * 2);
  }
  this._detectPatterns();

  if (this._debug) {
    
  }
};

LearningEngine.prototype.getIntegrationStatus = function() {
  return {
    state:           this._state,
    hasALX:          !!this._alx,
    hasCoreMemory:   !!this._coreMemory,
    totalCommands:   this._totalCommands,
    totalErrors:     this._totalErrors,
    errorRate:       this._profile.errorRate,
    patternCount:       this._patterns.size,
    mostUsedIntents:    this._profile.mostUsedIntents.slice(0, 5),
    buildOutcomeStats:  Object.fromEntries ? Object.fromEntries(this._buildOutcomeStats) : null,
    capabilities: {
      canSuggestIntents:     true,
      canObserveBuildResult: true,
      canDirectExecute:      false,
      canOverridePolicy:     false,
      canBypassInvariants:   false
    }
  };
};

export { LearningEngine, createLearningEngine, LEARNING_STATE };