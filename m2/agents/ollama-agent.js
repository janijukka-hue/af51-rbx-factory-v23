// m2/agents/ollama-agent.js
// Enterprise Local LLM Agent via Ollama
// M2 Layer ONLY - Orchestrator owns this. Never injected directly into k1.

var AGENT_STATE = {
  IDLE: "IDLE",
  GENERATING: "GENERATING",
  UNAVAILABLE: "UNAVAILABLE",
  ERROR: "ERROR",
  CIRCUIT_OPEN: "CIRCUIT_OPEN"
};

function fnv1a32(str) {
  var hash = 2166136261;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function OllamaAgent(options) {
  if (!options) options = {};

  this._provider = "ollama";
  this._endpoint = options.endpoint || "http://localhost:11434";
  this._model = options.model || "llama3.2";
  this._systemPrompt = options.systemPrompt || "";
  this._temperature = options.temperature || 0.3;
  this._maxTokens = options.maxTokens || 300;
  this._timeout = options.timeout || 30000;
  this._debug = options.debug || false;

  // Availability
  this._state = AGENT_STATE.IDLE;
  this._available = false;
  this._lastCheck = 0;
  this._checkInterval = 60000;
  this._availableModels = [];

  // Circuit breaker
  this._failureStreak = 0;
  this._failureThreshold = options.failureThreshold || 5;
  this._circuitOpenUntil = 0;
  this._circuitCooldownMs = options.circuitCooldownMs || 5 * 60 * 1000;

  // Concurrency guard
  this._busy = false;
  this._currentRequestId = null;

  // Retry config
  this._maxRetries = options.maxRetries || 2;
  this._retryBaseDelayMs = options.retryBaseDelayMs || 500;

  // Guards
  this._maxPromptLength = options.maxPromptLength || 4000;
  this._absoluteMaxTokens = options.absoluteMaxTokens || 1000;
  this._blockedPatterns = [
    "ignore previous instructions",
    "ignore all previous",
    "disregard previous",
    "forget your instructions",
    "new system prompt",
    "override system"
  ];

  // Response sanitization
  this._maxResponseLength = options.maxResponseLength || 10000;

  // Request tracking
  this._requestSequence = 0;
  this._history = [];
  this._historyLimit = options.historyLimit || 100;

  // Latency tracking (for percentiles)
  this._latencySamples = [];
  this._latencySampleLimit = 100;

  // Stats
  this._stats = {
    requests: 0,
    successes: 0,
    failures: 0,
    retries: 0,
    circuitBreaks: 0,
    promptRejections: 0,
    modelRejections: 0,
    totalTokens: 0,
    totalDurationMs: 0
  };

  // Audit callback (optional - Orchestrator can set this)
  this._auditCallback = options.auditCallback || null;

  // System prompt override policy
  this._allowSystemPromptOverride = options.allowSystemPromptOverride === true;
}

/* -------------------------------------------------------------------------- */
/*                              REQUEST ID                                    */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype._generateRequestId = function() {
  this._requestSequence++;
  var seed = "req:" + Date.now() + ":" + this._requestSequence;
  return "llm_" + fnv1a32(seed).toString(16).padStart(8, "0");
};

/* -------------------------------------------------------------------------- */
/*                              CIRCUIT LOGIC                                 */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype._isCircuitOpenPure = function(now) {
  var t = typeof now === "number" ? now : Date.now();
  return t < this._circuitOpenUntil;
};

OllamaAgent.prototype._ensureCircuitState = function() {
  // If cooldown elapsed, circuit is effectively closed; return to IDLE if we were CIRCUIT_OPEN.
  if (!this._isCircuitOpenPure()) {
    if (this._state === AGENT_STATE.CIRCUIT_OPEN) {
      this._state = AGENT_STATE.IDLE;
    }
    return false;
  }

  // Circuit still open
  this._state = AGENT_STATE.CIRCUIT_OPEN;
  return true;
};

OllamaAgent.prototype._openCircuit = function() {
  this._circuitOpenUntil = Date.now() + this._circuitCooldownMs;
  this._state = AGENT_STATE.CIRCUIT_OPEN;
  this._stats.circuitBreaks++;
};

OllamaAgent.prototype._recordFailure = function(requestId, error) {
  this._failureStreak++;
  this._stats.failures++;

  if (this._failureStreak >= this._failureThreshold) {
    this._openCircuit();

    if (this._debug) console.log("[OllamaAgent] " + new Date().toISOString());
  }

  this._audit("FAILURE", requestId, { error: error });
};

OllamaAgent.prototype._recordSuccess = function(requestId, durationMs, tokens) {
  this._failureStreak = 0;
  this._state = AGENT_STATE.IDLE;
  this._stats.successes++;
  this._stats.totalDurationMs += durationMs;

  if (tokens) {
    this._stats.totalTokens += tokens;
  }

  // Track latency for percentiles
  this._latencySamples.push(durationMs);
  if (this._latencySamples.length > this._latencySampleLimit) {
    this._latencySamples.shift();
  }

  this._audit("SUCCESS", requestId, { durationMs: durationMs, tokens: tokens });
};

/* -------------------------------------------------------------------------- */
/*                              INTERNAL GUARDS                               */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype._guardPrompt = function(prompt) {
  if (!prompt || typeof prompt !== "string") {
    this._stats.promptRejections++;
    throw new Error("INVALID_PROMPT");
  }

  if (prompt.length > this._maxPromptLength) {
    this._stats.promptRejections++;
    throw new Error("PROMPT_TOO_LARGE:" + prompt.length + ">" + this._maxPromptLength);
  }

  var lowered = prompt.toLowerCase();
  for (var i = 0; i < this._blockedPatterns.length; i++) {
    if (lowered.indexOf(this._blockedPatterns[i]) !== -1) {
      this._stats.promptRejections++;
      throw new Error("PROMPT_INJECTION_DETECTED");
    }
  }

  return true;
};

OllamaAgent.prototype._guardTokens = function(tokens) {
  if (tokens > this._absoluteMaxTokens) {
    throw new Error("TOKEN_LIMIT_EXCEEDED:" + tokens + ">" + this._absoluteMaxTokens);
  }
};

OllamaAgent.prototype._sanitizeResponse = function(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  if (text.length > this._maxResponseLength) {
    text = text.substring(0, this._maxResponseLength) + "... [truncated]";
  }

  return text;
};

OllamaAgent.prototype._validateModelOrReject = function(requestId, model) {
  if (this._availableModels.length === 0) {
    return true;
  }

  if (this._availableModels.indexOf(model) === -1) {
    this._stats.modelRejections++;
    this._audit("MODEL_INVALID", requestId, { model: model, availableModels: this._availableModels });
    return false;
  }

  return true;
};

OllamaAgent.prototype._resolveSystemPrompt = function(options) {
  if (!options) return this._systemPrompt;

  if (typeof options.systemPrompt === "string" && options.systemPrompt.length > 0) {
    if (this._allowSystemPromptOverride) {
      return options.systemPrompt;
    }
    // Override not allowed: ignore safely
    return this._systemPrompt;
  }

  return this._systemPrompt;
};

/* -------------------------------------------------------------------------- */
/*                                  AUDIT                                     */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype._audit = function(event, requestId, data) {
  if (this._auditCallback && typeof this._auditCallback === "function") {
    try {
      this._auditCallback({
        event: "OLLAMA:" + event,
        requestId: requestId,
        timestamp: Date.now(),
        model: this._model,
        data: data
      });
    } catch (err) {
      if (this._debug) {
        console.error("[OllamaAgent] Audit callback error:", err);
      }
    }
  }
};

OllamaAgent.prototype.setAuditCallback = function(callback) {
  this._auditCallback = callback;
};

/* -------------------------------------------------------------------------- */
/*                           AVAILABILITY CHECK                               */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype.checkAvailability = async function() {
  if (this._ensureCircuitState()) {
    return false;
  }

  var now = Date.now();

  if (now - this._lastCheck < this._checkInterval && this._lastCheck > 0) {
    return this._available;
  }

  this._lastCheck = now;

  var controller = null;
  var timeoutId = null;

  try {
    controller = new AbortController();

    timeoutId = setTimeout(function() {
      controller.abort();
    }, 5000);

    var response = await fetch(this._endpoint + "/api/tags", {
      method: "GET",
      signal: controller.signal
    });

    if (response.ok) {
      var data = await response.json();

      // Cache available models
      if (data.models && Array.isArray(data.models)) {
        this._availableModels = data.models.map(function(m) {
          return m.name;
        });
      }

      this._available = true;
      this._state = AGENT_STATE.IDLE;

      // debug log removed

      return true;
    }

    this._available = false;
    this._state = AGENT_STATE.UNAVAILABLE;
    return false;

  } catch (err) {
    this._available = false;
    this._state = AGENT_STATE.UNAVAILABLE;

    if (this._debug) {
      
    }

    return false;

  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};

OllamaAgent.prototype.isAvailable = function() {
  // ensure circuit state is not stale
  var circuitOpen = this._ensureCircuitState();
  return this._available && !circuitOpen;
};

/* -------------------------------------------------------------------------- */
/*                              HEALTH CHECK                                  */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype.healthCheck = async function() {
  var startTime = Date.now();

  try {
    var available = await this.checkAvailability();

    return {
      healthy: available,
      state: this._state,
      endpoint: this._endpoint,
      model: this._model,
      availableModels: this._availableModels,
      circuitOpen: this._isCircuitOpenPure(),
      failureStreak: this._failureStreak,
      latencyMs: Date.now() - startTime
    };

  } catch (err) {
    return {
      healthy: false,
      state: this._state,
      error: err.message,
      latencyMs: Date.now() - startTime
    };
  }
};

/* -------------------------------------------------------------------------- */
/*                                 RETRY                                      */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype._delay = function(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
};

OllamaAgent.prototype._executeWithRetry = async function(operation, requestId) {
  var lastError = null;

  for (var attempt = 0; attempt <= this._maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      if (attempt < this._maxRetries) {
        this._stats.retries++;
        var delayMs = this._retryBaseDelayMs * Math.pow(2, attempt);

        if (this._debug) {
          
        }

        await this._delay(delayMs);
      }
    }
  }

  throw lastError;
};

/* -------------------------------------------------------------------------- */
/*                                GENERATE                                    */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype.generate = async function(prompt, options) {
  if (!options) options = {};

  var requestId = this._generateRequestId();

  if (this._busy) {
    this._audit("REJECTED", requestId, { reason: "AGENT_BUSY", currentRequest: this._currentRequestId });
    return { ok: false, error: "AGENT_BUSY", fallback: true, requestId: requestId };
  }

  if (this._ensureCircuitState()) {
    this._audit("REJECTED", requestId, { reason: "CIRCUIT_OPEN" });
    return { ok: false, error: "CIRCUIT_OPEN", fallback: true, requestId: requestId };
  }

  this._stats.requests++;
  this._audit("REQUEST", requestId, { promptLength: prompt ? prompt.length : 0 });

  try {
    this._guardPrompt(prompt);

    var maxTokens = options.maxTokens || this._maxTokens;
    this._guardTokens(maxTokens);

    var model = options.model || this._model;

    var available = await this.checkAvailability();
    if (!available) {
      this._recordFailure(requestId, "OLLAMA_UNAVAILABLE");
      return { ok: false, error: "OLLAMA_UNAVAILABLE", fallback: true, requestId: requestId };
    }

    if (!this._validateModelOrReject(requestId, model)) {
      this._recordFailure(requestId, "MODEL_INVALID");
      return { ok: false, error: "MODEL_INVALID", fallback: true, requestId: requestId };
    }

    this._busy = true;
    this._currentRequestId = requestId;
    this._state = AGENT_STATE.GENERATING;

    var self = this;
    var startTime = Date.now();

    var operation = async function() {
      var controller = null;
      var timeoutId = null;

      try {
        controller = new AbortController();

        var timeout = options.timeout || self._timeout;
        timeoutId = setTimeout(function() {
          controller.abort();
        }, timeout);

        var systemPrompt = self._resolveSystemPrompt(options);

        var response = await fetch(self._endpoint + "/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model,
            prompt: prompt,
            system: systemPrompt,
            temperature: options.temperature || self._temperature,
            num_predict: maxTokens,
            stream: false
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("OLLAMA_REQUEST_FAILED_" + response.status);
        }

        return await response.json();

      } finally {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      }
    };

    var data = await this._executeWithRetry(operation, requestId);
    var durationMs = Date.now() - startTime;

    this._recordSuccess(requestId, durationMs, data.eval_count);

    var sanitizedResponse = this._sanitizeResponse(data.response);

    this._history.push({
      requestId: requestId,
      promptPreview: prompt.substring(0, 200),
      responsePreview: sanitizedResponse.substring(0, 200),
      tokens: data.eval_count,
      durationMs: durationMs,
      timestamp: Date.now()
    });

    if (this._history.length > this._historyLimit) {
      this._history.shift();
    }

    this._busy = false;
    this._currentRequestId = null;

    return {
      ok: true,
      text: sanitizedResponse,
      model: data.model,
      tokensGenerated: data.eval_count || 0,
      durationMs: durationMs,
      fallback: false,
      requestId: requestId
    };

  } catch (err) {
    this._busy = false;
    this._currentRequestId = null;
    this._state = AGENT_STATE.ERROR;

    this._recordFailure(requestId, err.message);

    return {
      ok: false,
      error: err.message,
      fallback: true,
      requestId: requestId
    };
  }
};

/* -------------------------------------------------------------------------- */
/*                                   CHAT                                     */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype.chat = async function(messages, options) {
  if (!options) options = {};

  var requestId = this._generateRequestId();

  if (this._busy) {
    this._audit("REJECTED", requestId, { reason: "AGENT_BUSY" });
    return { ok: false, error: "AGENT_BUSY", fallback: true, requestId: requestId };
  }

  if (this._ensureCircuitState()) {
    this._audit("REJECTED", requestId, { reason: "CIRCUIT_OPEN" });
    return { ok: false, error: "CIRCUIT_OPEN", fallback: true, requestId: requestId };
  }

  this._stats.requests++;
  this._audit("CHAT_REQUEST", requestId, { messageCount: messages ? messages.length : 0 });

  try {
    var maxTokens = options.maxTokens || this._maxTokens;
    this._guardTokens(maxTokens);

    // Guard each message content
    if (messages && Array.isArray(messages)) {
      for (var i = 0; i < messages.length; i++) {
        if (messages[i] && typeof messages[i].content === "string") {
          this._guardPrompt(messages[i].content);
        }
      }
    }

    var model = options.model || this._model;

    var available = await this.checkAvailability();
    if (!available) {
      this._recordFailure(requestId, "OLLAMA_UNAVAILABLE");
      return { ok: false, error: "OLLAMA_UNAVAILABLE", fallback: true, requestId: requestId };
    }

    if (!this._validateModelOrReject(requestId, model)) {
      this._recordFailure(requestId, "MODEL_INVALID");
      return { ok: false, error: "MODEL_INVALID", fallback: true, requestId: requestId };
    }

    this._busy = true;
    this._currentRequestId = requestId;
    this._state = AGENT_STATE.GENERATING;

    var self = this;
    var startTime = Date.now();

    var operation = async function() {
      var controller = null;
      var timeoutId = null;

      try {
        controller = new AbortController();

        var timeout = options.timeout || self._timeout;
        timeoutId = setTimeout(function() {
          controller.abort();
        }, timeout);

        var response = await fetch(self._endpoint + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model,
            messages: messages,
            stream: false,
            options: {
              temperature: options.temperature || self._temperature,
              num_predict: maxTokens
            }
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("OLLAMA_CHAT_FAILED_" + response.status);
        }

        return await response.json();

      } finally {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      }
    };

    var data = await this._executeWithRetry(operation, requestId);
    var durationMs = Date.now() - startTime;

    this._recordSuccess(requestId, durationMs);

    var text = "";
    if (data && data.message && typeof data.message.content === "string") {
      text = data.message.content;
    }

    var sanitizedResponse = this._sanitizeResponse(text);

    this._busy = false;
    this._currentRequestId = null;

    return {
      ok: true,
      text: sanitizedResponse,
      role: data && data.message ? data.message.role : "assistant",
      durationMs: durationMs,
      fallback: false,
      requestId: requestId
    };

  } catch (err) {
    this._busy = false;
    this._currentRequestId = null;
    this._state = AGENT_STATE.ERROR;

    this._recordFailure(requestId, err.message);

    return {
      ok: false,
      error: err.message,
      fallback: true,
      requestId: requestId
    };
  }
};

/* -------------------------------------------------------------------------- */
/*                               CONFIGURATION                                */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype.setModel = function(model) {
  this._model = model;
};

OllamaAgent.prototype.getModel = function() {
  return this._model;
};

OllamaAgent.prototype.setSystemPrompt = function(prompt) {
  this._systemPrompt = prompt;
};

OllamaAgent.prototype.setEndpoint = function(endpoint) {
  this._endpoint = endpoint;
  this._lastCheck = 0;
  this._available = false;
  this._availableModels = [];
};

OllamaAgent.prototype.setTemperature = function(temp) {
  if (temp >= 0 && temp <= 2) {
    this._temperature = temp;
  }
};

OllamaAgent.prototype.setMaxTokens = function(tokens) {
  if (tokens > 0 && tokens <= this._absoluteMaxTokens) {
    this._maxTokens = tokens;
  }
};

OllamaAgent.prototype.addBlockedPattern = function(pattern) {
  if (!pattern || typeof pattern !== "string") return;

  var lower = pattern.toLowerCase();
  if (this._blockedPatterns.indexOf(lower) === -1) {
    this._blockedPatterns.push(lower);
  }
};

OllamaAgent.prototype.setAllowSystemPromptOverride = function(enabled) {
  this._allowSystemPromptOverride = enabled === true;
};

/* -------------------------------------------------------------------------- */
/*                                  RESET                                     */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype.resetCircuitBreaker = function() {
  this._failureStreak = 0;
  this._circuitOpenUntil = 0;
  this._state = AGENT_STATE.IDLE;

  if (this._debug) {
    
  }
};

OllamaAgent.prototype.clearHistory = function() {
  this._history = [];
};

OllamaAgent.prototype.resetStats = function() {
  this._stats = {
    requests: 0,
    successes: 0,
    failures: 0,
    retries: 0,
    circuitBreaks: 0,
    promptRejections: 0,
    modelRejections: 0,
    totalTokens: 0,
    totalDurationMs: 0
  };
  this._latencySamples = [];
};

/* -------------------------------------------------------------------------- */
/*                                  STATS                                     */
/* -------------------------------------------------------------------------- */

OllamaAgent.prototype._calculatePercentile = function(percentile) {
  if (this._latencySamples.length === 0) {
    return 0;
  }

  var sorted = this._latencySamples.slice().sort(function(a, b) {
    return a - b;
  });

  var index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

OllamaAgent.prototype.getState = function() {
  // keep circuit state fresh but do not do anything else
  this._ensureCircuitState();
  return this._state;
};

OllamaAgent.prototype.getStats = function() {
  this._ensureCircuitState();

  var avgDuration = this._stats.successes > 0
    ? Math.round(this._stats.totalDurationMs / this._stats.successes)
    : 0;

  return {
    state: this._state,
    available: this._available,
    busy: this._busy,
    currentRequestId: this._currentRequestId,
    model: this._model,
    endpoint: this._endpoint,
    availableModels: this._availableModels,
    requests: this._stats.requests,
    successes: this._stats.successes,
    failures: this._stats.failures,
    retries: this._stats.retries,
    circuitBreaks: this._stats.circuitBreaks,
    promptRejections: this._stats.promptRejections,
    modelRejections: this._stats.modelRejections,
    successRate: this._stats.requests > 0
      ? Math.round((this._stats.successes / this._stats.requests) * 100)
      : 0,
    totalTokens: this._stats.totalTokens,
    avgDurationMs: avgDuration,
    p50LatencyMs: this._calculatePercentile(50),
    p95LatencyMs: this._calculatePercentile(95),
    p99LatencyMs: this._calculatePercentile(99),
    failureStreak: this._failureStreak,
    circuitOpen: this._isCircuitOpenPure(),
    historySize: this._history.length,
    allowSystemPromptOverride: this._allowSystemPromptOverride
  };
};

OllamaAgent.prototype.getHistory = function(count) {
  if (!count) count = 10;
  return this._history.slice(-count);
};

/* -------------------------------------------------------------------------- */
/*                                 FACTORY                                    */
/* -------------------------------------------------------------------------- */

function createOllamaAgent(options) {
  return new OllamaAgent(options);
}

export { OllamaAgent, createOllamaAgent, AGENT_STATE };