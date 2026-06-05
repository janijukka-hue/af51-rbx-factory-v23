// m2/Ohjaus/orchestrator.js
// M2 Orchestrator - koordinoi k1-primitiivejä + ALX + LLM
// Version: 3.0.0 - Explicit decision loop + InvariantEngine + LearningEngine integration

import { CoreMemory } from "../../k1/Ydin/muisti.js";
import { ALX } from "../../k1/alx/core/ALX.js";
import { LearningEngine } from "./learning-engine.js";
import { OllamaAgent } from "../agents/ollama-agent.js";
import { Factory } from "../../t3/Factory/Factory.js";
import { FactoryBridge } from "./factory-bridge.js";
import { createInvariantEngine, INVARIANT_CHECKPOINT } from "../../k1/Ydin/invariant-engine.js";

// Core skills
import { HelpSkill } from "../../k1/alx/skills/core/HelpSkill.js";
import { StatusSkill } from "../../k1/alx/skills/core/StatusSkill.js";
import { EchoSkill } from "../../k1/alx/skills/core/EchoSkill.js";
import { TimeSkill } from "../../k1/alx/skills/core/TimeSkill.js";

// Factory skills
import { BuildSkill }    from "../../k1/alx/skills/factory/BuildSkill.js";
import { PipelineSkill } from "../../k1/alx/skills/factory/PipelineSkill.js";
import { CacheSkill }    from "../../k1/alx/skills/factory/CacheSkill.js";
import { SessionSkill }  from "../../k1/alx/skills/factory/SessionSkill.js";

// Memory skills
import { MemoryQuerySkill }  from "../../k1/alx/skills/memory/MemoryQuerySkill.js";
import { MemoryStatsSkill }  from "../../k1/alx/skills/memory/MemoryStatsSkill.js";
import { MemoryExportSkill } from "../../k1/alx/skills/memory/MemoryExportSkill.js";

// Security skills
import { AuditSkill }      from "../../k1/alx/skills/security/AuditSkill.js";
import { GuardSkill }      from "../../k1/alx/skills/security/GuardSkill.js";

// Language skills
import { IntentSkill }      from "../../k1/alx/skills/language/IntentSkill.js";
import { VocabularySkill }  from "../../k1/alx/skills/language/VocabularySkill.js";
import { TokenizeSkill }    from "../../k1/alx/skills/language/TokenizeSkill.js";
import { TemplateSkill }    from "../../k1/alx/skills/language/TemplateSkill.js";

// Security skills (lisää)
import { LockdownSkill }    from "../../k1/alx/skills/security/LockdownSkill.js";
import { PermissionSkill }  from "../../k1/alx/skills/security/PermissionSkill.js";

// Code skills
import { CodeAnalyzeSkill }   from "../../k1/alx/skills/code/CodeAnalyzeSkill.js";
import { CodeRiskSkill }      from "../../k1/alx/skills/code/CodeRiskSkill.js";
import { CodeStructureSkill } from "../../k1/alx/skills/code/CodeStructureSkill.js";
import { RobloxBuildSkill } from "../../k1/alx/skills/roblox/RobloxBuildSkill.js";
import { DiffSkill }          from "../../k1/alx/skills/code/DiffSkill.js";
import { DependencySkill }    from "../../k1/alx/skills/code/DependencySkill.js";

// Adaptive skills
import { BehaviorLearner }  from "../../k1/alx/skills/adaptive/BehaviorLearner.js";
import { PatternLearner }   from "../../k1/alx/skills/adaptive/PatternLearner.js";
import { ProfileBuilder }   from "../../k1/alx/skills/adaptive/ProfileBuilder.js";

var ORCHESTRATOR_VERSION = "3.0.0";

var ORCHESTRATOR_STATE = {
  IDLE: "IDLE",
  BOOTING: "BOOTING",
  RUNNING: "RUNNING",
  STOPPING: "STOPPING",
  STOPPED: "STOPPED",
  ERROR: "ERROR"
};

function Orchestrator(opts) {
  if (!opts) opts = {};
  
  this.cfg = {
    prefix: opts.prefix || "m2",
    owner: opts.owner || "system",
    debug: opts.debug || false,
    learningEnabled: opts.learningEnabled !== false,
    llmEnabled: opts.llmEnabled !== false,
    llmEndpoint: opts.llmEndpoint || "http://localhost:11434",
    llmModel: opts.llmModel || "llama3.2",
    llmSystemPrompt: opts.llmSystemPrompt || "",
    llmTemperature: opts.llmTemperature || 0.7,
    llmMaxTokens: opts.llmMaxTokens || 500,
    episodicLimit: opts.episodicLimit || 10000,
    semanticLimit: opts.semanticLimit || 5000,
    proceduralLimit: opts.proceduralLimit || 1000,
    localMemoryLimit: opts.localMemoryLimit || 500,
    localMemoryTTL: opts.localMemoryTTL || 300000,
    factoryEnabled: opts.factoryEnabled !== false
  };

  this._clock = opts.clock || this._createDefaultClock();
  
  this._coreMemory = null;
  this._alx = null;
  this._learningEngine = null;
  this._ollamaAgent = null;
  this._factory = null;
  this._factoryBridge = null;
  this._factoryBootError = null;
  
  this._state = ORCHESTRATOR_STATE.IDLE;
  this._bootTime = null;
  this._sessionId = null;
  this._commandCount = 0;
  this._systemMode = "NORMAL"; // NORMAL | SAFE | EMERGENCY | LOCKDOWN

  // Decision loop trace — viimeiset N päätösketjut debugia varten
  this._decisionTrace = [];
  this._maxTraceEntries = 50;

  this._listeners = new Map();
  // Cache: seedId -> CoreMemory entryId
  this._seedEntryCache = new Map();

  // InvariantEngine — alustetaan bootissa kun audit on käytettävissä
  this._invariantEngine = null;
}

Orchestrator.prototype._createDefaultClock = function() {
  var offset = 0;
  var base = Date.now();
  return {
    now: function() {
      return base + offset++;
    }
  };
};

Orchestrator.prototype.boot = async function() {
  if (this._state !== ORCHESTRATOR_STATE.IDLE && this._state !== ORCHESTRATOR_STATE.STOPPED) {
    return { ok: false, error: "Cannot boot from state: " + this._state };
  }

  this._state = ORCHESTRATOR_STATE.BOOTING;
  this._bootTime = this._clock.now();
  this._sessionId = this._generateSessionId();

  this._emit("orchestrator:booting", { sessionId: this._sessionId });

  try {
    this._coreMemory = new CoreMemory({
      clock: this._clock,
      owner: this.cfg.owner,
      episodicLimit: this.cfg.episodicLimit,
      semanticLimit: this.cfg.semanticLimit,
      proceduralLimit: this.cfg.proceduralLimit
    });

    if (this.cfg.debug) {
      
    }

    var self = this;
    var coreWriter = function(entry) {
      return self._coreMemory.write({
        store: entry.store || "episodic",
        content: entry.content,
        tags: entry.tags || ["alx"],
        metadata: entry.metadata || {}
      });
    };

    this._alx = new ALX({
      clock: this._clock,
      owner: this.cfg.owner,
      coreMemory: this._coreMemory,
      coreWriter: coreWriter,
      debug: this.cfg.debug,
      localMemoryLimit: this.cfg.localMemoryLimit,
      localMemoryTTL: this.cfg.localMemoryTTL,
      llmSystemPrompt: this.cfg.llmSystemPrompt
    });

    var alxBootResult = this._alx.boot();
    if (!alxBootResult.ok) {
      throw new Error("ALX boot failed: " + alxBootResult.error);
    }

    if (this.cfg.debug) {
      
    }

    if (this.cfg.llmEnabled) {
      this._ollamaAgent = new OllamaAgent({
        endpoint: this.cfg.llmEndpoint,
        model: this.cfg.llmModel,
        systemPrompt: this.cfg.llmSystemPrompt,
        temperature: this.cfg.llmTemperature,
        maxTokens: this.cfg.llmMaxTokens,
        debug: this.cfg.debug
      });

      this._ollamaAgent.checkAvailability().then(function(available) {
        if (self.cfg.debug) {
          
        }
      });

      // ALX on FAST-only — deterministinen pipeline, ei LLM
      // Ollama on käytettävissä vain /ollama/chat -reitin kautta
      // this._alx.setLLMAgent(this._ollamaAgent); // POISTETTU

      if (this.cfg.debug) {
        
      }
    }

    if (this.cfg.learningEnabled) {
      this._learningEngine = new LearningEngine({
        clock: this._clock,
        coreMemory: this._coreMemory,
        alx: this._alx,
        debug: this.cfg.debug
      });

      await this._learningEngine.boot();

      if (this.cfg.debug) {
        
      }
    }

    if (this.cfg.factoryEnabled) {
      await this._bootFactory();

      if (this.cfg.debug) console.log("[Orchestrator] ready");
    }

    this._state = ORCHESTRATOR_STATE.RUNNING;

    this._emit("orchestrator:running", {
      sessionId: this._sessionId,
      bootDuration: this._clock.now() - this._bootTime
    });

    // InvariantEngine — oikea audit-adapteri CoreMemoryyn
    var orchRef = this;
    var invariantAuditAdapter = this._coreMemory ? {
      append: function(entry) {
        try {
          orchRef._coreMemory.write({
            store:   "episodic",
            content: Object.assign({ _type: "invariant_audit" }, entry),
            tags:    ["audit", "invariant", entry.area || "unknown"],
            metadata: { ruleId: entry.ruleId || null, checkpoint: entry.checkpoint || null }
          });
        } catch (e) { /* audit-kirjaus ei saa kaataa järjestelmää */ }
      }
    } : null;

    this._invariantEngine = createInvariantEngine({
      audit: invariantAuditAdapter,
      debug: this.cfg.debug
    });
    if (this.cfg.debug) {
      
    }

    await this._coreMemory.write({
      store: "episodic",
      content: {
        event: "ORCHESTRATOR:BOOT",
        sessionId: this._sessionId,
        llmEnabled: this.cfg.llmEnabled,
        llmModel: this.cfg.llmModel
      },
      tags: ["orchestrator", "system", "boot"]
    });

    return {
      ok: true,
      sessionId: this._sessionId,
      bootTime: this._bootTime,
      llmEnabled: this.cfg.llmEnabled
    };

  } catch (err) {
    this._state = ORCHESTRATOR_STATE.ERROR;

    this._emit("orchestrator:error", {
      phase: "boot",
      error: err.message
    });

    return { ok: false, error: err.message };
  }
};

Orchestrator.prototype._bootFactory = async function() {
  var self = this;

  try {
    // 1. Luo ja buuttaa Factory
    var factory = new Factory({
      owner: this.cfg.owner,
      debug: this.cfg.debug,
      clock: this._clock
    });

    var fResult = factory.boot();

    if (!fResult.ok) {
      this._factoryBootError = fResult.error || "Factory boot failed";
      console.warn("[Orchestrator] Factory boot failed:", this._factoryBootError);
      // Ei kaadu — vain factory-skillit sanovat "ei yhdistetty"
      this._registerCoreSkills(null, null);
      return;
    }

    this._factory = factory;

    // 2. Luo FactoryBridge
    var bridge = new FactoryBridge({
      factory: factory,
      clock: this._clock
    });
    this._factoryBridge = bridge;

    // 3. Injektoi orchestratoriin (setFactory kutsuu myös alx.setFactory)
    this.setFactory(factory);
    this.setFactoryBridge(bridge);

    // 4. Forwardaa kaikki Factory eventit M2:n kautta S4:ään
    //    S4 EI käytä factory.getEventBus() suoraan — kaikki kulkee tämän kautta.
    var bus = factory.getEventBus();
    bus.subscribeAll(function(event) {
      self._emit(event.type, event.payload);
    });

    if (this.cfg.debug) {
      
    }

    // 5. Rekisteröi kaikki skillit
    this._registerCoreSkills(factory, bridge);

    if (this.cfg.debug) {
      console.log("[Orchestrator] _bootFactory complete, skills:",
        this.getAllSkills().map(function(s) { return s.name; }).join(", "));
    }

  } catch (err) {
    this._factoryBootError = err.message;
    console.warn("[Orchestrator] _bootFactory error:", err.message);
    // Ei heitä — rekisteröi core-skillit ilman factorya
    this._registerCoreSkills(null, null);
  }
};

Orchestrator.prototype._registerCoreSkills = function(factory, bridge) {
  var alx = this._alx;
  var clock = this._clock;

  // Core skillit — aina mukana
  this.registerSkill(new HelpSkill({ alx: alx }));
  this.registerSkill(new StatusSkill({ alx: alx }));
  this.registerSkill(new EchoSkill());
  this.registerSkill(new TimeSkill({ clock: clock }));

  // Factory skillit — factory voi olla null (sanovat "ei yhdistetty")
  this.registerSkill(new BuildSkill({ factory: factory, bridge: bridge, alx: alx }));
  this.registerSkill(new PipelineSkill({ factory: factory }));
  this.registerSkill(new CacheSkill({ factory: factory }));
  this.registerSkill(new SessionSkill({ alx: alx }));

  // Memory skillit
  this.registerSkill(new MemoryQuerySkill({ alx: alx }));
  this.registerSkill(new MemoryStatsSkill({ alx: alx }));
  this.registerSkill(new MemoryExportSkill({ alx: alx }));

  // Security skillit
  this.registerSkill(new AuditSkill({ alx: alx }));
  this.registerSkill(new GuardSkill({ alx: alx }));

  // Language skillit
  this.registerSkill(new IntentSkill({ alx: alx }));
  this.registerSkill(new VocabularySkill());
  this.registerSkill(new TokenizeSkill());
  this.registerSkill(new TemplateSkill({ alx: alx }));

  // Security skillit (kaikki)
  this.registerSkill(new LockdownSkill({ alx: alx }));
  this.registerSkill(new PermissionSkill({ alx: alx }));

  // Roblox build skill
  this.registerSkill(RobloxBuildSkill);

  // Code skillit
  this.registerSkill(new CodeAnalyzeSkill());
  this.registerSkill(new CodeRiskSkill());
  this.registerSkill(new CodeStructureSkill());
  this.registerSkill(new DiffSkill());
  this.registerSkill(new DependencySkill());

  // Adaptive skillit
  this.registerSkill(new BehaviorLearner());
  this.registerSkill(new PatternLearner());
  this.registerSkill(new ProfileBuilder());
};

Orchestrator.prototype.shutdown = async function() {
  if (this._state !== ORCHESTRATOR_STATE.RUNNING) {
    return { ok: false, error: "Not running" };
  }

  this._state = ORCHESTRATOR_STATE.STOPPING;
  this._emit("orchestrator:stopping", { sessionId: this._sessionId });

  try {
    if (this._learningEngine) {
      await this._learningEngine.shutdown();
    }

    if (this._alx) {
      await this._alx.shutdown();
    }

    if (this._coreMemory) {
      await this._coreMemory.write({
        store: "episodic",
        content: {
          event: "ORCHESTRATOR:SHUTDOWN",
          sessionId: this._sessionId,
          uptime: this._clock.now() - this._bootTime,
          commandCount: this._commandCount
        },
        tags: ["orchestrator", "system", "shutdown"]
      });
    }

    this._state = ORCHESTRATOR_STATE.STOPPED;
    this._seedEntryCache.clear();
  this._emit("orchestrator:stopped", { sessionId: this._sessionId });

    return { ok: true };

  } catch (err) {
    this._state = ORCHESTRATOR_STATE.ERROR;
    return { ok: false, error: err.message };
  }
};

// ── _resolveIntent ───────────────────────────────────────────
// Eksplisiittinen intent-resolvaus ennen päätöstä.
// Palauttaa: { intent, confidence, source }
//
// Prioriteetti:
//   1. ctx.intent — jos kutsuja antoi eksplisiittisen intentin
//   2. LearningEngine ensimmäinen suggestion
//   3. "UNKNOWN" — ALX ratkaisee myöhemmin execute-vaiheessa

Orchestrator.prototype._resolveIntent = function(perceptionInput, ctx, learningSuggestions) {
  // 1. Eksplisiittinen intent kontekstissa
  if (ctx && ctx.intent) {
    return { intent: ctx.intent, confidence: 1.0, source: "explicit" };
  }

  // 2. LearningEnginen vahvin ehdotus
  if (learningSuggestions && learningSuggestions.length > 0) {
    var top = learningSuggestions[0];
    return {
      intent:     top.intent || top.command || "UNKNOWN",
      confidence: top.confidence || top.score || 0.5,
      source:     "learning-engine"
    };
  }

  // 3. Fallback — ALX ratkaisee execute-vaiheessa
  return { intent: "UNKNOWN", confidence: 0.0, source: "pending" };
};

// ─── Decision Loop ───────────────────────────────────────────
//
// Eksplisiittinen 7-vaiheinen päätösputki.
// Jokainen vaihe:
//   - vastaanottaa selkeän inputin
//   - palauttaa selkeän outputin
//   - kirjoittaa trace-entryn debugia varten
//
// Vaiheet:
//   1. PERCEPTION  — Tunnista ja normalisoi input
//   2. INTENT      — Päätä mitä halutaan tehdä
//   3. DECISION    — Hyväksy tai hylkää intent
//   4. POLICY      — Tarkista lupa ja invariantit
//   5. EXECUTE     — Aja toiminto
//   6. AUDIT       — Kirjaa tulos
//   7. MEMORY      — Tallenna oppimista varten

Orchestrator.prototype.execute = async function(input, ctx) {
  if (this._state !== ORCHESTRATOR_STATE.RUNNING) {
    return { ok: false, error: "Orchestrator not running" };
  }

  if (!ctx) ctx = {};

  this._commandCount++;
  var traceId = this.cfg.prefix + "_trace_" + this._commandCount + "_" + this._clock.now();
  var t0 = Date.now();

  var trace = {
    traceId:   traceId,
    input:     typeof input === "string" ? input.substring(0, 100) : "object",
    stages:    {},
    startedAt: new Date().toISOString(),
    result:    null
  };

  // Yhteinen päätöskulkuobjekti — päivitetään vaihe vaiheelta
  var decisionCtx = {
    traceId:    traceId,
    perception: null,
    intent:     null,
    policy:     { passed: false },
    execution:  { ok: false },
    memory:     { written: false }
  };

  // ── 1. PERCEPTION ────────────────────────────────────────
  trace.stages.perception = { status: "running" };
  var perceptionInput = {
    raw:       input,
    userId:    ctx.userId    || "user",
    sessionId: ctx.sessionId || this._sessionId,
    metadata:  ctx.metadata  || {}
  };
  trace.stages.perception = { status: "completed", output: { type: typeof input, length: typeof input === "string" ? input.length : 0 } };

  this._emit("orchestrator:loop:perception", { traceId: traceId, input: perceptionInput });

  // ── 2. INTENT ─────────────────────────────────────────────
  trace.stages.intent = { status: "running" };

  // LearningEngine saa havainnoida inputin ennen intent-resolvausta
  if (this._learningEngine) {
    try {
      this._learningEngine.observeInput(input, ctx);
    } catch (leErr) {
      if (this.cfg.debug) console.warn("[Orchestrator] LearningEngine.observeInput error:", leErr.message);
    }
  }

  // LearningEngine voi ehdottaa optimointeja — mutta EI määrätä intentiä
  var learningSuggestions = [];
  if (this._learningEngine) {
    try {
      learningSuggestions = this._learningEngine.getSuggestions({ input: input, ctx: ctx }) || [];
    } catch (e) { /* suggestions-haku ei saa kaataa execute-putkea */ }
  }

  // Eksplisiittinen intent-resolvaus — ei jätetä ALX:n sisälle piiloon
  var resolvedIntent = this._resolveIntent(perceptionInput, ctx, learningSuggestions);

  trace.stages.intent = {
    status:      "resolved",
    intent:      resolvedIntent.intent,
    confidence:  resolvedIntent.confidence,
    source:      resolvedIntent.source,
    suggestions: learningSuggestions.length
  };
  this._emit("orchestrator:loop:intent", { traceId: traceId, intent: resolvedIntent.intent, suggestions: learningSuggestions });

  // ── 3. DECISION ───────────────────────────────────────────
  trace.stages.decision = { status: "running" };

  // InvariantEngine tarkistaa DECISION-checkpointin
  var decisionInvCheck = { ok: true, blocked: false, violations: [] };
  if (this._invariantEngine) {
    decisionInvCheck = this._invariantEngine.check(INVARIANT_CHECKPOINT.DECISION, {
      intent:         resolvedIntent.intent,
      source:         ctx.source || "user",
      policyBypassed: ctx.policyBypassed || false,
      systemMode:     this._systemMode
    });
  }

  if (decisionInvCheck.blocked) {
    trace.stages.decision = { status: "rejected", violations: decisionInvCheck.violations };
    trace.result = "blocked_by_invariant";
    this._recordTrace(trace);
    return {
      ok:       false,
      error:    "Decision estetty: " + (decisionInvCheck.violations[0] ? decisionInvCheck.violations[0].reason : "invariant"),
      traceId:  traceId,
      stage:    "decision"
    };
  }

  trace.stages.decision = { status: "accepted" };
  this._emit("orchestrator:loop:decision", { traceId: traceId, accepted: true });

  // ── 4. POLICY ─────────────────────────────────────────────
  trace.stages.policy = { status: "running" };

  // InvariantEngine tarkistaa EXECUTE-checkpointin
  // policyChecked: true koska olemme nyt policy-vaiheessa
  var policyInvCheck = { ok: true, blocked: false, violations: [] };
  if (this._invariantEngine) {
    policyInvCheck = this._invariantEngine.check(INVARIANT_CHECKPOINT.POLICY_CHECK, {
      intent:         resolvedIntent.intent,
      systemMode:     this._systemMode,
      policyChecked:  true,
      policyBypassed: ctx.policyBypassed || false,
      source:         ctx.source || "user"
    });
  }

  if (policyInvCheck.blocked) {
    trace.stages.policy = { status: "rejected", violations: policyInvCheck.violations };
    trace.result = "blocked_by_policy";
    this._recordTrace(trace);
    return {
      ok:      false,
      error:   "Policy estetty: " + (policyInvCheck.violations[0] ? policyInvCheck.violations[0].reason : "policy"),
      traceId: traceId,
      stage:   "policy"
    };
  }

  trace.stages.policy = { status: "passed" };
  this._emit("orchestrator:loop:policy", { traceId: traceId, passed: true });

  // ── 5. EXECUTE ────────────────────────────────────────────
  trace.stages.execute = { status: "running" };
  this._emit("orchestrator:command:received", {
    input: typeof input === "string" ? input.substring(0, 50) : "object",
    commandNumber: this._commandCount,
    traceId: traceId
  });

  var result;
  try {
    result = await this._alx.execute(input, {
      userId:    perceptionInput.userId,
      sessionId: perceptionInput.sessionId,
      metadata:  perceptionInput.metadata
    });
  } catch (execErr) {
    trace.stages.execute = { status: "failed", error: execErr.message };
    trace.result = "execute_error";
    this._recordTrace(trace);
    this._emit("orchestrator:loop:execute", { traceId: traceId, ok: false, error: execErr.message });
    return { ok: false, error: execErr.message, traceId: traceId, stage: "execute" };
  }

  trace.stages.execute = {
    status:     "completed",
    ok:         result.ok,
    intent:     result.intent,
    durationMs: result.durationMs
  };
  this._emit("orchestrator:loop:execute", { traceId: traceId, ok: result.ok, intent: result.intent });

  // ── 6. AUDIT ──────────────────────────────────────────────
  trace.stages.audit = { status: "running" };

  this._emit("orchestrator:command:completed", {
    ok:         result.ok,
    intent:     result.intent,
    route:      result.route,
    durationMs: result.durationMs,
    traceId:    traceId
  });

  trace.stages.audit = { status: "completed" };
  this._emit("orchestrator:loop:audit", { traceId: traceId, ok: result.ok });

  // ── 7. MEMORY ─────────────────────────────────────────────
  trace.stages.memory = { status: "running" };

  // LearningEngine oppii tuloksesta — rajoitettu vaikutus
  if (this._learningEngine) {
    try {
      this._learningEngine.observeResult(input, result);
      // LearningEngine EI saa muuttaa result:ia tai kutsua executea suoraan
    } catch (leErr) {
      if (this.cfg.debug) console.warn("[Orchestrator] LearningEngine.observeResult error:", leErr.message);
    }
  }

  // Kirjoita päätösyhteenveto episodic muistiin
  var memorySummary = {
    traceId:       traceId,
    inputSummary:  typeof input === "string" ? input.substring(0, 80) : "object",
    intent:        resolvedIntent.intent,
    intentSource:  resolvedIntent.source,
    ok:            result.ok,
    durationMs:    Date.now() - t0,
    commandCount:  this._commandCount,
    systemMode:    this._systemMode
  };

  // MEMORY_WRITE invariant-check ennen kirjoitusta
  var memInvCheck = { ok: true, blocked: false };
  if (this._invariantEngine) {
    memInvCheck = this._invariantEngine.check(INVARIANT_CHECKPOINT.MEMORY_WRITE, {
      memoryKey:   traceId,
      memoryValue: memorySummary
    });
  }

  if (!memInvCheck.blocked && this._coreMemory) {
    try {
      this._coreMemory.write({
        store:    "episodic",
        content:  memorySummary,
        tags:     ["decision", "trace", result.ok ? "success" : "failure"],
        metadata: { intent: resolvedIntent.intent, traceId: traceId }
      });
    } catch (memErr) {
      if (this.cfg.debug) console.warn("[Orchestrator] Memory write error:", memErr.message);
    }
  }

  trace.stages.memory = {
    status:  memInvCheck.blocked ? "blocked" : "completed",
    written: !memInvCheck.blocked
  };
  this._emit("orchestrator:loop:memory", { traceId: traceId, written: !memInvCheck.blocked });

  // ── Trace tallennus ───────────────────────────────────────
  trace.result    = result.ok ? "ok" : "failed";
  trace.durationMs = Date.now() - t0;
  this._recordTrace(trace);

  return Object.assign({}, result, { traceId: traceId });
};

// ── Decision trace apufunktiot ────────────────────────────────

Orchestrator.prototype._recordTrace = function(trace) {
  this._decisionTrace.push(trace);
  if (this._decisionTrace.length > this._maxTraceEntries) {
    this._decisionTrace = this._decisionTrace.slice(-this._maxTraceEntries);
  }
};

Orchestrator.prototype.getDecisionTrace = function(limit) {
  var n = limit || 10;
  return this._decisionTrace.slice(-n).reverse();
};

Orchestrator.prototype.getInvariantEngine = function() {
  return this._invariantEngine;
};

Orchestrator.prototype.setSystemMode = function(mode) {
  var allowed = ["NORMAL", "SAFE", "EMERGENCY", "LOCKDOWN"];
  if (allowed.indexOf(mode) === -1) {
    return { ok: false, error: "Tuntematon tila: " + mode };
  }
  var prev = this._systemMode;
  this._systemMode = mode;
  this._emit("orchestrator:system:mode", { prev: prev, mode: mode });
  if (this.cfg.debug) 
  return { ok: true, mode: mode };
};

Orchestrator.prototype.getSystemMode = function() {
  return this._systemMode;
};

Orchestrator.prototype.setFactory = function(factory) {
  this._factory = factory;
  
  if (this._alx) {
    this._alx.setFactory(factory);
  }
  
  this._emit("orchestrator:factory:connected", {
    factoryState: factory ? factory.getState() : null
  });
  
  if (this.cfg.debug) {
    
  }
  
  return { ok: true };
};

Orchestrator.prototype.setFactoryBridge = function(bridge) {
  this._factoryBridge = bridge;
  
  if (this._alx) {
    this._alx.setFactoryBridge(bridge);
  }
  
  if (this.cfg.debug) {
    
  }
  
  return { ok: true };
};

Orchestrator.prototype.getFactory = function() {
  return this._factory;
};

Orchestrator.prototype.getFactoryBridge = function() {
  return this._factoryBridge;
};

Orchestrator.prototype.registerSkill = function(skill) {
  if (!this._alx) {
    return { ok: false, error: "ALX not initialized" };
  }
  return this._alx.registerSkill(skill);
};

Orchestrator.prototype.getSkill = function(name) {
  if (!this._alx) return null;
  return this._alx.getSkill(name);
};

Orchestrator.prototype.getAllSkills = function() {
  if (!this._alx) return [];
  return this._alx.getAllSkills();
};

Orchestrator.prototype.getCoreMemory = function() {
  return this._coreMemory;
};

Orchestrator.prototype.writeMemory = async function(store, content, tags, metadata) {
  if (!this._coreMemory) {
    return { ok: false, error: "CoreMemory not initialized" };
  }

  // MEMORY_WRITE invariant-check
  if (this._invariantEngine) {
    var key = (metadata && metadata.key) || (typeof content === "string" ? content.substring(0, 20) : store);
    var invCheck = this._invariantEngine.check(INVARIANT_CHECKPOINT.MEMORY_WRITE, {
      memoryKey:   key,
      memoryValue: content,
      systemMode:  this._systemMode
    });
    if (invCheck.blocked) {
      return { ok: false, error: "writeMemory estetty invariantilla: " + (invCheck.violations[0] ? invCheck.violations[0].reason : "invariant") };
    }
  }

  return await this._coreMemory.write({
    store: store,
    content: content,
    tags: tags || [],
    metadata: metadata || {}
  });
};

Orchestrator.prototype.queryMemory = async function(store, options) {
  if (!this._coreMemory) {
    return [];
  }
  if (!options) options = {};
  return await this._coreMemory.query({
    store: store,
    tags: options.tags,
    text: options.text,
    limit: options.limit || 10
  });
};

Orchestrator.prototype.getLearningEngine = function() {
  return this._learningEngine;
};

Orchestrator.prototype.getSuggestions = function(context) {
  if (!this._learningEngine) {
    return [];
  }
  return this._learningEngine.getSuggestions(context);
};

Orchestrator.prototype.getALX = function() {
  return this._alx;
};

Orchestrator.prototype.getOllamaAgent = function() {
  return this._ollamaAgent;
};

Orchestrator.prototype.lockALX = function(reason) {
  if (!this._alx) {
    return { ok: false, error: "ALX not initialized" };
  }
  return this._alx.lock(reason);
};

Orchestrator.prototype.unlockALX = function() {
  if (!this._alx) {
    return { ok: false, error: "ALX not initialized" };
  }
  return this._alx.unlock();
};

// OSA 1: querySeeds palauttaa VAIN kevyen metadatan.
// Ei code, ei files[].content, ei combinedCode, ei koko artifactia.
// Snack ei enää jäädy.
Orchestrator.prototype.querySeeds = async function(options) {
  if (this._state !== ORCHESTRATOR_STATE.RUNNING) {
    return [];
  }
  
  if (!options) options = {};
  
  var limit = options.limit || 20;
  var seeds = [];
  var self = this;
  
  try {
    if (this._coreMemory) {
      var entries = await this._coreMemory.query({
        store: "episodic",
        tags: ["factory", "publish", "artifact"],
        limit: limit
      });
      
      if (this.cfg.debug) {
        
      }
      
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.content && entry.content.artifact) {
          var seed = self._artifactToSeedMeta(entry.content.artifact, entry);
          seeds.push(seed);
        }
      }
    }
    
    seeds.sort(function(a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    return seeds.slice(0, limit);
    
  } catch (err) {
    if (this.cfg.debug) {
      console.error("[Orchestrator] querySeeds error:", err);
    }
    return [];
  }
};

// OSA 1: Kevyt metadatamuunnos — EI sisällä code/files/combinedCode.
Orchestrator.prototype._artifactToSeedMeta = function(artifact, entry) {
  var aId = artifact.id || artifact.hash || entry.id;
  if (aId && entry.id) { this._seedEntryCache.set(aId, entry.id); }
  return {
    id: artifact.id || artifact.hash || entry.id,
    title: artifact.name || artifact.projectName || "Build " + (artifact.id || "").substring(0, 8),
    createdAt: artifact.createdAt || entry.timestamp || new Date().toISOString(),
    energy: artifact.energy || 50,
    chaos: artifact.chaos || 0,
    language: artifact.language || "javascript",
    fileCount: artifact.files ? artifact.files.length : (artifact.fileCount || 0),
    size: artifact.size || 0,
    tags: entry.tags || []
  };
};

// OSA 2: getSeedDetails(id) — hakee täyden artifactin CoreMemorystä.
// Kutsutaan VAIN ArtifactDetailsScreen / FileViewerScreen -kontekstissa.
// EI koskaan seed-listan latauksessa.
Orchestrator.prototype.getSeedDetails = async function(id) {
  if (!this._coreMemory) {
    return { ok: false, error: "CoreMemory not initialized" };
  }
  if (!id) {
    return { ok: false, error: "id required" };
  }

  try {
    // Polku 1: Cache-osuma -> suora O(1) read
    var cachedEntryId = this._seedEntryCache.get(id);
    if (cachedEntryId) {
      var cached = await this._coreMemory.read("episodic", cachedEntryId);
      if (cached && cached.content && cached.content.artifact) {
        var art = cached.content.artifact;
        // Sisällytä myös code + files content-objektista
        art.code  = art.code  || cached.content.code  || null;
        art.files = art.files || cached.content.files || [];
        return { ok: true, artifact: art, entryId: cached.id, timestamp: cached.timestamp };
      }
      this._seedEntryCache.delete(id);
    }

    // Polku 2: Scan kaikki artifact-entryit + lämmitä cache samalla
    var entries = await this._coreMemory.query({
      store: "episodic",
      tags: ["factory", "publish", "artifact"],
      limit: 200
    });

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var artifact = entry.content && entry.content.artifact;
      if (!artifact) continue;
      var artifactId = artifact.id || artifact.hash || entry.id;
      if (artifactId && entry.id) { this._seedEntryCache.set(artifactId, entry.id); }
      if (artifactId === id) {
        // Sisällytä myös code + files content-objektista
        artifact.code  = artifact.code  || entry.content.code  || null;
        artifact.files = artifact.files || entry.content.files || [];
        return { ok: true, artifact: artifact, entryId: entry.id, timestamp: entry.timestamp };
      }
    }

    return { ok: false, error: "Seed not found: " + id };

  } catch (err) {
    if (this.cfg.debug) { console.error("[Orchestrator] getSeedDetails error:", err); }
    return { ok: false, error: err.message };
  }
};

Orchestrator.prototype.getState = function() {
  return this._state;
};

Orchestrator.prototype.getStatus = function() {
  var alxStatus = this._alx ? this._alx.getStatus() : null;
  var coreMemoryStats = this._coreMemory ? this._coreMemory.getStats() : null;
  var learningStats = this._learningEngine ? this._learningEngine.getStats() : null;
  var ollamaStats = this._ollamaAgent ? this._ollamaAgent.getStats() : null;
  var factoryStats = this._factory ? this._factory.getStats() : null;

  return {
    version: ORCHESTRATOR_VERSION,
    state: this._state,
    sessionId: this._sessionId,
    bootTime: this._bootTime,
    uptime: this._bootTime ? this._clock.now() - this._bootTime : 0,
    commandCount: this._commandCount,
    llmEnabled: this.cfg.llmEnabled,
    factoryConnected: !!this._factory,
    factoryBootError: this._factoryBootError || null,
    alx: alxStatus,
    coreMemory: coreMemoryStats,
    learning: learningStats,
    ollama: ollamaStats,
    factory: factoryStats
  };
};

Orchestrator.prototype.isRunning = function() {
  return this._state === ORCHESTRATOR_STATE.RUNNING;
};

Orchestrator.prototype.on = function(eventType, handler) {
  if (!this._listeners.has(eventType)) {
    this._listeners.set(eventType, []);
  }
  this._listeners.get(eventType).push(handler);

  var self = this;
  return function unsubscribe() {
    var handlers = self._listeners.get(eventType);
    if (handlers) {
      var index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  };
};

Orchestrator.prototype._emit = function(eventType, payload) {
  var handlers = this._listeners.get(eventType);
  if (handlers) {
    for (var i = 0; i < handlers.length; i++) {
      try {
        handlers[i](payload);
      } catch (err) {
        if (this.cfg.debug) {
          console.error("[Orchestrator] Event handler error:", err);
        }
      }
    }
  }

  var allHandlers = this._listeners.get("*");
  if (allHandlers) {
    for (var j = 0; j < allHandlers.length; j++) {
      try {
        allHandlers[j]({ type: eventType, payload: payload });
      } catch (err) {
        if (this.cfg.debug) {
          console.error("[Orchestrator] Wildcard handler error:", err);
        }
      }
    }
  }
};

Orchestrator.prototype._generateSessionId = function() {
  var ts = this._clock.now();
  return this.cfg.prefix + "_session_" + ts;
};

function createOrchestrator(opts) {
  var orchestrator = new Orchestrator(opts);
  return orchestrator;
}

export { Orchestrator, createOrchestrator, ORCHESTRATOR_STATE, ORCHESTRATOR_VERSION };