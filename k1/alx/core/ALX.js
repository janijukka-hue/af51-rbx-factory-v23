// k1/alx/core/ALX.js
// ALX - Deterministic Factory Intelligence
// Version: 3.2.1 - Factory Integration Fixed

import { ALX_STATE, createSkillContext, createSkillResult } from "./types.js";
import { SkillRegistry } from "./SkillRegistry.js";
import { IntentMatcher } from "./IntentMatcher.js";
import { SessionManager } from "./SessionManager.js";
import { HybridRouter, ROUTE } from "./HybridRouter.js";
import { tokenize } from "../utils/tokenizer.js";
import { validateInput } from "../config/security.config.js";
import { INTENT_TO_SKILL } from "../config/skills.config.js";

function ALX(options) {
  if (!options) options = {};
  
  this._clock = options.clock;
  this._owner = options.owner || "system";
  this._debug = options.debug || false;
  
  this._state = ALX_STATE.OFFLINE;
  this._bootedAt = null;
  this._sessionId = null;
  
  this._coreMemory = options.coreMemory || null;
  this._coreWriter = options.coreWriter || null;
  
  // Factory integration
  this._factory = options.factory || null;
  this._factoryBridge = options.factoryBridge || null;
  
  this._localMemory = new Map();
  this._localMemoryLimit = options.localMemoryLimit || 500;
  this._localMemoryTTL = options.localMemoryTTL || 300000;
  
  this._registry = new SkillRegistry({ clock: this._clock });
  this._matcher = new IntentMatcher({ clock: this._clock });
  this._sessions = new SessionManager({ clock: this._clock });
  
  this._llmAgent = options.llmAgent || null;
  
  this._router = new HybridRouter({
    llmAgent: this._llmAgent,
    debug: this._debug
  });
  
  this._llmSystemPrompt = options.llmSystemPrompt || this._defaultSystemPrompt();
  
  this._executionCount = 0;
  this._errorCount = 0;
  this._cacheHits = 0;
  this._cacheMisses = 0;
  this._llmCalls = 0;
  this._locked = false;
  this._lockReason = null;
}

ALX.prototype._defaultSystemPrompt = function() {
  return [
    "Olet ALX, Factory Intelligence -järjestelmän avustaja.",
    "Vastaat suomeksi tai englanniksi käyttäjän kielen mukaan.",
    "Olet tekninen, tarkka ja hyödyllinen.",
    "Jos et tiedä jotain, sano se suoraan.",
    "Koodiblokit merkitään ``` merkeillä.",
    "Pidä vastaukset ytimekkäinä ellei tarvita pidempiä selityksiä."
  ].join(" ");
};

ALX.prototype._realNow = function() {
  return Date.now();
};

ALX.prototype._tickNow = function() {
  return this._clock ? this._clock.now() : Date.now();
};

// ============================================================================
// FACTORY INTEGRATION
// ============================================================================

ALX.prototype.setFactory = function(factory) {
  this._factory = factory;
  
  // Update factory skills
  this._updateFactorySkills();
  
  if (this._debug) {
    
  }
  
  return { ok: true };
};

ALX.prototype.getFactory = function() {
  return this._factory;
};

ALX.prototype.setFactoryBridge = function(bridge) {
  this._factoryBridge = bridge;
  
  // Update factory skills
  this._updateFactorySkills();
  
  if (this._debug) {
    
  }
  
  return { ok: true };
};

ALX.prototype.getFactoryBridge = function() {
  return this._factoryBridge;
};

ALX.prototype._updateFactorySkills = function() {
  var factorySkillNames = ["build", "pipeline", "session", "cache"];
  var self = this;
  
  factorySkillNames.forEach(function(skillName) {
    var skill = self._registry.get(skillName);
    if (skill) {
      if (skill.setFactory && self._factory) {
        skill.setFactory(self._factory);
        if (self._debug) {
          
        }
      }
      if (skill.setBridge && self._factoryBridge) {
        skill.setBridge(self._factoryBridge);
        if (self._debug) {
          
        }
      }
    }
  });
};

// ============================================================================
// CACHE
// ============================================================================

ALX.prototype._getCacheKey = function(input, ctx) {
  // BUG FIX: null / non-string input ei saa kaataa cache-lookuppia
  var str = (input == null) ? "" : String(input);
  var normalized = str.toLowerCase().trim();
  if (normalized.length > 100) {
    normalized = normalized.substring(0, 100);
  }
  var user = ctx && ctx.userId ? ctx.userId : "anon";
  var session = ctx && ctx.sessionId ? ctx.sessionId : this._sessionId;
  return "cache:" + user + ":" + session + ":" + normalized;
};

ALX.prototype.getLocal = function(key) {
  var entry = this._localMemory.get(key);
  if (!entry) {
    return null;
  }
  
  var now = this._realNow();
  if (now - entry.timestamp > this._localMemoryTTL) {
    this._localMemory.delete(key);
    return null;
  }
  
  return entry.value;
};

ALX.prototype.setLocal = function(key, value) {
  if (this._localMemory.size >= this._localMemoryLimit) {
    this._pruneLocalMemory();
  }
  
  this._localMemory.set(key, {
    value: value,
    timestamp: this._realNow()
  });
};

ALX.prototype.clearLocal = function() {
  this._localMemory.clear();
};

ALX.prototype._pruneLocalMemory = function() {
  var now = this._realNow();
  var toDelete = [];
  var self = this;
  
  this._localMemory.forEach(function(entry, key) {
    if (now - entry.timestamp > self._localMemoryTTL) {
      toDelete.push(key);
    }
  });
  
  for (var i = 0; i < toDelete.length; i++) {
    this._localMemory.delete(toDelete[i]);
  }
  
  if (this._localMemory.size >= this._localMemoryLimit) {
    var entries = Array.from(this._localMemory.entries());
    entries.sort(function(a, b) {
      return a[1].timestamp - b[1].timestamp;
    });
    
    var removeCount = Math.floor(this._localMemoryLimit * 0.2);
    for (var j = 0; j < removeCount && j < entries.length; j++) {
      this._localMemory.delete(entries[j][0]);
    }
  }
};

// ============================================================================
// CORE MEMORY
// ============================================================================

ALX.prototype.getCoreMemory = function() {
  return this._coreMemory;
};

ALX.prototype.setCoreMemory = function(memory) {
  this._coreMemory = memory;
};

ALX.prototype.setCoreWriter = function(writer) {
  this._coreWriter = writer;
};

ALX.prototype.commitCore = async function(entry) {
  if (!this._coreWriter) {
    if (this._debug) {
      
    }
    return { ok: false, error: "NO_CORE_WRITER" };
  }
  
  try {
    return await this._coreWriter(entry);
  } catch (err) {
    if (this._debug) {
      console.error("[ALX] Core commit failed:", err);
    }
    return { ok: false, error: err.message };
  }
};

ALX.prototype.queryCore = async function(store, options) {
  if (!this._coreMemory) {
    return [];
  }
  
  return await this._coreMemory.query({
    store: store,
    tags: options.tags,
    text: options.text,
    limit: options.limit || 10,
    since: options.since,
    until: options.until
  });
};

// ============================================================================
// LLM
// ============================================================================

ALX.prototype.setLLMAgent = function(agent) {
  this._llmAgent = agent;
  this._router.setLLMAgent(agent);
};

ALX.prototype.getLLMAgent = function() {
  return this._llmAgent;
};

ALX.prototype.setLLMSystemPrompt = function(prompt) {
  this._llmSystemPrompt = prompt;
};

ALX.prototype.getLLMSystemPrompt = function() {
  return this._llmSystemPrompt;
};

ALX.prototype._generateWithLLM = async function(prompt, context) {
  if (!this._llmAgent) {
    return { ok: false, error: "NO_LLM_AGENT", fallback: true };
  }
  
  this._llmCalls++;
  
  var result = await this._llmAgent.generate(prompt, {
    systemPrompt: this._llmSystemPrompt,
    temperature: 0.7,
    maxTokens: 500
  });
  
  var self = this;
  this.commitCore({
    store: "episodic",
    content: {
      event: "LLM:GENERATE",
      promptPreview: prompt.substring(0, 100),
      ok: result.ok,
      tokensGenerated: result.tokensGenerated || 0,
      durationMs: result.durationMs || 0,
      model: result.model || "unknown"
    },
    tags: ["alx", "llm", "generate"]
  }).catch(function(err) {
    if (self._debug) {
      console.error("[ALX] LLM audit commit failed:", err);
    }
  });
  
  return result;
};

// ============================================================================
// BOOT / SHUTDOWN
// ============================================================================

ALX.prototype.boot = function() {
  if (this._state !== ALX_STATE.OFFLINE) {
    return { ok: false, error: "ALX already booted" };
  }
  
  this._state = ALX_STATE.BOOTING;
  this._bootedAt = this._tickNow();
  this._sessionId = "alx_" + this._bootedAt;
  
  if (!this._coreWriter) {
    if (this._debug) {
      
    }
  }
  
  // Inject factory to skills after boot
  this._updateFactorySkills();
  
  var self = this;
  this.commitCore({
    store: "episodic",
    content: {
      event: "ALX:BOOT",
      owner: this._owner,
      sessionId: this._sessionId,
      llmAvailable: this._llmAgent ? true : false,
      factoryConnected: this._factory ? true : false
    },
    tags: ["alx", "system", "boot"]
  }).catch(function(err) {
    if (self._debug) {
      console.error("[ALX] Boot commit failed:", err);
    }
  });
  
  this._state = ALX_STATE.READY;
  
  if (this._debug) {
    
    
    
    
  }
  
  return {
    ok: true,
    sessionId: this._sessionId,
    bootedAt: this._bootedAt,
    coreMemoryConnected: !!this._coreMemory,
    coreWriterConfigured: !!this._coreWriter,
    llmAgentConfigured: !!this._llmAgent,
    factoryConnected: !!this._factory
  };
};

ALX.prototype.shutdown = async function() {
  var self = this;
  
  try {
    await this.commitCore({
      store: "episodic",
      content: {
        event: "ALX:SHUTDOWN",
        executionCount: this._executionCount,
        errorCount: this._errorCount,
        cacheHits: this._cacheHits,
        cacheMisses: this._cacheMisses,
        llmCalls: this._llmCalls
      },
      tags: ["alx", "system", "shutdown"]
    });
  } catch (err) {
    if (this._debug) {
      console.error("[ALX] Shutdown commit error:", err);
    }
  }
  
  this.clearLocal();
  this._state = ALX_STATE.OFFLINE;
  return { ok: true };
};

// ============================================================================
// EXECUTE
// ============================================================================

ALX.prototype.execute = async function(input, ctx) {
  if (!ctx) ctx = {};
  
  if (this._state !== ALX_STATE.READY) {
    return createSkillResult(false, {
      error: "ALX_NOT_READY",
      output: "ALX ei ole valmis. Tila: " + this._state
    });
  }
  
  if (this._locked) {
    return createSkillResult(false, {
      error: "ALX_LOCKED",
      output: "ALX on lukittu. Syy: " + this._lockReason
    });
  }
  
  var validation = validateInput(input);
  if (!validation.valid) {
    return createSkillResult(false, {
      error: "VALIDATION_FAILED",
      output: "Validointi epäonnistui: " + JSON.stringify(validation.issues)
    });
  }
  
  var startedAt = this._tickNow();
  this._state = ALX_STATE.EXECUTING;
  
  var cacheKey = this._getCacheKey(input, ctx);
  var cached = this.getLocal(cacheKey);
  
  if (cached && !this._hasCodeBlock(input)) {
    this._cacheHits++;
    this._state = ALX_STATE.READY;
    
    if (this._debug) console.log("[ALX] debug");
    
    return cached;
  }
  
  this._cacheMisses++;
  
  var coreContext = [];
  if (this._coreMemory) {
    coreContext = await this.queryCore("semantic", {
      text: input,
      limit: 5
    });
  }
  
  var tokens = tokenize(input);
  var intent = this._matcher.match(tokens, input);
  
  if (this._debug) {
    
  }
  
  var routing = this._router.route(input, intent.name, ctx);
  
  if (this._debug) {
    
  }
  
  var result;
  
  // BUG FIX: try-catch varmistaa että _state palautuu READY myös virhetilanteessa
  // ilman tätä numero/object-input jättää ALX:n EXECUTING-tilaan ikuisesti
  try {
    if (routing.route === ROUTE.SMART && this._llmAgent) {
      result = await this._executeSmartPath(input, intent, coreContext, ctx);
    } else {
      result = await this._executeFastPath(input, intent, tokens, coreContext, ctx);
    }
  } catch (unexpectedErr) {
    this._state = ALX_STATE.READY;
    this._errorCount++;
    return {
      ok: false,
      error: "ALX_INTERNAL_ERROR",
      output: "Sisäinen virhe: " + (unexpectedErr && unexpectedErr.message ? unexpectedErr.message : String(unexpectedErr))
    };
  }
  
  var finishedAt = this._tickNow();
  var durationMs = finishedAt - startedAt;
  
  var response = {
    ok: result.ok,
    output: result.output,
    error: result.error,
    metadata: result.metadata,
    intent: intent.name,
    confidence: intent.confidence,
    skill: result.skill || null,
    route: routing.route,
    routeReason: routing.reason,
    durationMs: durationMs,
    cacheHit: false,
    llmUsed: routing.route === ROUTE.SMART
  };
  
  if (result.ok && routing.route === ROUTE.FAST && !this._hasCodeBlock(input)) {
    this.setLocal(cacheKey, response);
  }
  
  var self = this;
  this.commitCore({
    store: "episodic",
    content: {
      event: "ALX:EXECUTE",
      intent: intent.name,
      route: routing.route,
      skill: result.skill,
      ok: result.ok,
      durationMs: durationMs,
      inputPreview: input.substring(0, 100)
    },
    tags: ["alx", "execution", routing.route.toLowerCase()]
  }).catch(function(err) {
    if (self._debug) {
      console.error("[ALX] Execute audit failed:", err);
    }
  });
  
  this._executionCount++;
  this._state = ALX_STATE.READY;
  
  var session = this._sessions.getOrCreate(ctx.userId || "anonymous");
  this._sessions.update(session.id, {
    historyEntry: {
      input: input.substring(0, 100),
      intent: intent.name,
      route: routing.route,
      ok: result.ok
    }
  });
  
  return response;
};

ALX.prototype._executeFastPath = async function(input, intent, tokens, coreContext, ctx) {
  var skillName = INTENT_TO_SKILL[intent.name] || INTENT_TO_SKILL.UNKNOWN || "help";
  var skill = this._registry.get(skillName);
  
  if (!skill) {
    var allSkills = this._registry.getAllNames().join(", ");
    return {
      ok: false,
      error: "SKILL_NOT_FOUND",
      output: "Skill '" + skillName + "' ei löydy. Rekisteröidyt: " + allSkills,
      skill: skillName
    };
  }
  
  var fullCtx = createSkillContext({
    clock: this._clock,
    userId: ctx.userId || "anonymous",
    sessionId: ctx.sessionId || this._sessionId,
    input: input,
    tokens: tokens,
    intent: intent,
    coreContext: coreContext,
    metadata: ctx.metadata || {},
    factory: this._factory,
    factoryBridge: this._factoryBridge
  });
  
  try {
    var result = await skill.execute(fullCtx);
    
    if (!result) {
      return {
        ok: false,
        error: "SKILL_NO_RESULT",
        output: "Skill '" + skillName + "' ei palauttanut tulosta.",
        skill: skillName
      };
    }
    
    return {
      ok: result.ok,
      output: result.output,
      error: result.error,
      metadata: result.metadata,
      skill: skillName
    };
    
  } catch (err) {
    this._errorCount++;
    var errorMessage = err && err.message ? err.message : String(err);
    
    if (this._debug) {
      console.error("[ALX] Skill error:", errorMessage);
    }
    
    return {
      ok: false,
      error: "SKILL_EXECUTION_ERROR",
      output: "Virhe skillin '" + skillName + "' suorituksessa: " + errorMessage,
      skill: skillName
    };
  }
};

ALX.prototype._executeSmartPath = async function(input, intent, coreContext, ctx) {
  var prompt = this._buildSmartPrompt(input, intent, coreContext, ctx);
  
  var llmResult = await this._generateWithLLM(prompt, ctx);
  
  if (!llmResult.ok) {
    this._router.recordFallback();
    
    if (this._debug) {
      
    }
    
    var tokens = tokenize(input);
    return await this._executeFastPath(input, intent, tokens, coreContext, ctx);
  }
  
  return {
    ok: true,
    output: llmResult.text,
    metadata: {
      model: llmResult.model,
      tokensGenerated: llmResult.tokensGenerated,
      llmDurationMs: llmResult.durationMs
    },
    skill: "llm"
  };
};

ALX.prototype._buildSmartPrompt = function(input, intent, coreContext, ctx) {
  var parts = [];
  
  parts.push("Käyttäjän viesti: " + input);
  
  if (intent && intent.name !== "UNKNOWN") {
    parts.push("Tunnistettu intent: " + intent.name + " (confidence: " + intent.confidence + ")");
  }
  
  if (coreContext && coreContext.length > 0) {
    parts.push("Aiempi konteksti muistista:");
    for (var i = 0; i < Math.min(coreContext.length, 3); i++) {
      var entry = coreContext[i];
      if (entry.content) {
        var contentStr = JSON.stringify(entry.content);
        if (contentStr.length > 150) {
          contentStr = contentStr.substring(0, 150) + "...";
        }
        parts.push("- " + contentStr);
      }
    }
  }
  
  parts.push("");
  parts.push("Vastaa käyttäjän kysymykseen hyödyllisesti ja ytimekkäästi.");
  
  return parts.join("\n\n");
};

ALX.prototype._hasCodeBlock = function(text) {
  return text && text.indexOf("```") !== -1;
};

// ============================================================================
// SKILL MANAGEMENT
// ============================================================================

ALX.prototype.registerSkill = function(skill) {
  var result = this._registry.register(skill);
  
  if (result.ok) {
    // Inject factory if this is a factory skill
    if (skill.setFactory && this._factory) {
      skill.setFactory(this._factory);
    }
    if (skill.setBridge && this._factoryBridge) {
      skill.setBridge(this._factoryBridge);
    }
    
    var self = this;
    this.commitCore({
      store: "procedural",
      content: {
        event: "SKILL:REGISTERED",
        name: skill.name,
        category: skill.category,
        description: skill.description
      },
      tags: ["alx", "skill", skill.name]
    }).catch(function(err) {
      if (self._debug) {
        console.error("[ALX] Skill register audit failed:", err);
      }
    });
  }
  
  return result;
};

ALX.prototype.unregisterSkill = function(name) {
  return this._registry.unregister(name);
};

ALX.prototype.getSkill = function(name) {
  return this._registry.get(name);
};

ALX.prototype.hasSkill = function(name) {
  return this._registry.has(name);
};

ALX.prototype.getAllSkills = function() {
  return this._registry.getAll();
};

// ============================================================================
// LOCK
// ============================================================================

ALX.prototype.lock = function(reason) {
  this._locked = true;
  this._lockReason = reason;
  this._state = ALX_STATE.LOCKED;
  
  var self = this;
  this.commitCore({
    store: "episodic",
    content: {
      event: "ALX:LOCKED",
      reason: reason
    },
    tags: ["alx", "security", "lock"]
  }).catch(function(err) {
    if (self._debug) {
      console.error("[ALX] Lock audit failed:", err);
    }
  });
  
  return { ok: true };
};

ALX.prototype.unlock = function() {
  this._locked = false;
  this._lockReason = null;
  this._state = ALX_STATE.READY;
  
  var self = this;
  this.commitCore({
    store: "episodic",
    content: {
      event: "ALX:UNLOCKED"
    },
    tags: ["alx", "security", "unlock"]
  }).catch(function(err) {
    if (self._debug) {
      console.error("[ALX] Unlock audit failed:", err);
    }
  });
  
  return { ok: true };
};

// ============================================================================
// STATUS
// ============================================================================

ALX.prototype.getState = function() {
  return this._state;
};

ALX.prototype.getRouter = function() {
  return this._router;
};

ALX.prototype.getMatcher = function() {
  return this._matcher;
};

ALX.prototype.getSessions = function() {
  return this._sessions;
};

ALX.prototype.getStatus = function() {
  var now = this._tickNow();
  
  var coreStats = null;
  if (this._coreMemory) {
    coreStats = this._coreMemory.getStats();
  }
  
  var llmStats = null;
  if (this._llmAgent && this._llmAgent.getStats) {
    llmStats = this._llmAgent.getStats();
  }
  
  var factoryStats = null;
  if (this._factory && this._factory.getStats) {
    factoryStats = this._factory.getStats();
  }
  
  return {
    state: this._state,
    owner: this._owner,
    sessionId: this._sessionId,
    bootedAt: this._bootedAt,
    uptimeMs: this._bootedAt ? now - this._bootedAt : 0,
    executionCount: this._executionCount,
    errorCount: this._errorCount,
    cacheHits: this._cacheHits,
    cacheMisses: this._cacheMisses,
    cacheHitRate: this._executionCount > 0
      ? Math.round((this._cacheHits / this._executionCount) * 100)
      : 0,
    llmCalls: this._llmCalls,
    locked: this._locked,
    lockReason: this._lockReason,
    localMemory: {
      size: this._localMemory.size,
      limit: this._localMemoryLimit,
      ttlMs: this._localMemoryTTL
    },
    coreMemory: coreStats,
    coreMemoryConnected: !!this._coreMemory,
    coreWriterConfigured: !!this._coreWriter,
    llm: llmStats,
    llmAgentConfigured: !!this._llmAgent,
    factory: factoryStats,
    factoryConnected: !!this._factory,
    router: this._router.getStats(),
    skills: this._registry.getStats(),
    sessions: this._sessions.getStats(),
    matcher: this._matcher.getStats()
  };
};

ALX.prototype.verifyIntegrity = function() {
  if (!this._coreMemory) {
    return { valid: true, errors: [], message: "No CoreMemory connected" };
  }
  return this._coreMemory.verify();
};

ALX.prototype.setDebug = function(enabled) {
  this._debug = enabled;
  this._router._debug = enabled;
};

function createALX(options) {
  return new ALX(options);
}

export { ALX, createALX };
export default ALX;