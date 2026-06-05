// k1/alx/core/HybridRouter.js
// Hybrid Router - Fast Path (rules) vs Smart Path (LLM)
// Deterministic routing logic

var ROUTE = {
  FAST: "FAST",
  SMART: "SMART"
};

var SMART_TRIGGERS = [
  "selitä",
  "explain",
  "miksi",
  "why",
  "kirjoita",
  "write",
  "generoi",
  "generate",
  "luo",
  "create",
  "paranna",
  "improve",
  "refactor",
  "kuvaile",
  "describe",
  "vertaa",
  "compare",
  "analysoi syvemmin",
  "analyze deeply",
  "mitä tarkoittaa",
  "what does",
  "miten voisin",
  "how could i",
  "ehdota",
  "suggest",
  "tiivistä",
  "summarize",
  "käännä",
  "translate",
  "dokumentoi",
  "document",
  "kerro lisää",
  "tell me more",
  "anna esimerkki",
  "give example",
  "miten toimii",
  "how does",
  "what is",
  "mikä on"
];

var FAST_INTENTS = [
  "GREETING",
  "HELP",
  "STATUS",
  "ECHO",
  "TIME",
  "BUILD",
  "BUILD_START",
  "BUILD_PROJECT",
  "PIPELINE",
  "PIPELINE_STATUS",
  "MEMORY_QUERY",
  "MEMORY_STATS",
  "MEMORY_EXPORT",
  "LOCKDOWN",
  "UNLOCK",
  "AUDIT",
  "GUARD",
  "PERMISSION",
  "CACHE",
  "SESSION"
];

function HybridRouter(options) {
  if (!options) options = {};
  
  this._llmAgent = options.llmAgent || null;
  this._smartTriggers = SMART_TRIGGERS.slice();
  this._fastIntents = FAST_INTENTS.slice();
  this._minInputLength = options.minInputLength || 20;
  this._forceSmartThreshold = options.forceSmartThreshold || 100;
  this._debug = options.debug || false;
  
  this._stats = {
    fastCount: 0,
    smartCount: 0,
    fallbackCount: 0
  };
}

HybridRouter.prototype.setLLMAgent = function(agent) {
  this._llmAgent = agent;
};

HybridRouter.prototype.getLLMAgent = function() {
  return this._llmAgent;
};

HybridRouter.prototype.addSmartTrigger = function(trigger) {
  var lower = trigger.toLowerCase();
  if (this._smartTriggers.indexOf(lower) === -1) {
    this._smartTriggers.push(lower);
  }
};

HybridRouter.prototype.removeSmartTrigger = function(trigger) {
  var lower = trigger.toLowerCase();
  var index = this._smartTriggers.indexOf(lower);
  if (index !== -1) {
    this._smartTriggers.splice(index, 1);
  }
};

HybridRouter.prototype.addFastIntent = function(intent) {
  if (this._fastIntents.indexOf(intent) === -1) {
    this._fastIntents.push(intent);
  }
};

HybridRouter.prototype.removeFastIntent = function(intent) {
  var index = this._fastIntents.indexOf(intent);
  if (index !== -1) {
    this._fastIntents.splice(index, 1);
  }
};

HybridRouter.prototype.route = function(input, intent, context) {
  if (!context) context = {};
  
  if (context.forceSmart) {
    return this._createRoute(ROUTE.SMART, "FORCE_REQUESTED");
  }
  
  if (context.forceFast) {
    return this._createRoute(ROUTE.FAST, "FORCE_REQUESTED");
  }
  
  if (!this._llmAgent) {
    return this._createRoute(ROUTE.FAST, "NO_LLM_AGENT");
  }
  
  if (!this._llmAgent.isAvailable || !this._llmAgent.isAvailable()) {
    return this._createRoute(ROUTE.FAST, "LLM_UNAVAILABLE");
  }
  
  if (intent && this._fastIntents.indexOf(intent) !== -1) {
    return this._createRoute(ROUTE.FAST, "FAST_INTENT:" + intent);
  }
  
  var inputLower = input.toLowerCase();
  
  for (var i = 0; i < this._smartTriggers.length; i++) {
    var trigger = this._smartTriggers[i];
    if (inputLower.indexOf(trigger) !== -1) {
      return this._createRoute(ROUTE.SMART, "TRIGGER:" + trigger);
    }
  }
  
  if (input.length > this._forceSmartThreshold) {
    return this._createRoute(ROUTE.SMART, "LONG_INPUT");
  }
  
  if (input.indexOf("```") !== -1) {
    return this._createRoute(ROUTE.SMART, "CODE_BLOCK");
  }
  
  if (input.indexOf("?") !== -1 && input.length > this._minInputLength) {
    return this._createRoute(ROUTE.SMART, "QUESTION");
  }
  
  return this._createRoute(ROUTE.FAST, "DEFAULT");
};

HybridRouter.prototype._createRoute = function(route, reason) {
  if (route === ROUTE.FAST) {
    this._stats.fastCount++;
  } else {
    this._stats.smartCount++;
  }
  
  if (this._debug) {
    
  }
  
  return {
    route: route,
    reason: reason,
    useLLM: route === ROUTE.SMART
  };
};

HybridRouter.prototype.shouldUseLLM = function(input, intent, context) {
  var routing = this.route(input, intent, context);
  return routing.useLLM;
};

HybridRouter.prototype.recordFallback = function() {
  this._stats.fallbackCount++;
};

HybridRouter.prototype.getSmartTriggers = function() {
  return this._smartTriggers.slice();
};

HybridRouter.prototype.getFastIntents = function() {
  return this._fastIntents.slice();
};

HybridRouter.prototype.getStats = function() {
  var total = this._stats.fastCount + this._stats.smartCount;
  
  return {
    fastCount: this._stats.fastCount,
    smartCount: this._stats.smartCount,
    fallbackCount: this._stats.fallbackCount,
    totalRouted: total,
    fastPercent: total > 0 ? Math.round((this._stats.fastCount / total) * 100) : 0,
    smartPercent: total > 0 ? Math.round((this._stats.smartCount / total) * 100) : 0,
    llmAvailable: this._llmAgent && this._llmAgent.isAvailable ? this._llmAgent.isAvailable() : false,
    smartTriggerCount: this._smartTriggers.length,
    fastIntentCount: this._fastIntents.length
  };
};

HybridRouter.prototype.resetStats = function() {
  this._stats.fastCount = 0;
  this._stats.smartCount = 0;
  this._stats.fallbackCount = 0;
};

function createHybridRouter(options) {
  return new HybridRouter(options);
}

export { HybridRouter, createHybridRouter, ROUTE, SMART_TRIGGERS, FAST_INTENTS };