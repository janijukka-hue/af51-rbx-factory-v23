// t3/Factory/pipeline/build-pipeline.js
// T3 Factory - Build Pipeline
// Enterprise phase order:
//   Intake → Normalize → IncrementalCheck → Plan →
//   Template → Synthesize → Deps → Build → Validate →
//   Security → Package → Preview → Publish

import { PIPELINE_PHASE, FACTORY_STATE } from "../core/factory-types.js";
import { FactoryError, ERROR_CODE }       from "../core/factory-errors.js";
import { fnv1a32 }                        from "../core/factory-utils.js";
import { PipelineContext }                from "./pipeline-context.js";

// Alkuperäiset phaset
import { IntakePhase }           from "./phases/intake-phase.js";
import { NormalizePhase }        from "./phases/normalize-phase.js";
import { IncrementalCheckPhase } from "./phases/incremental-check-phase.js";
import { PlanPhase }             from "./phases/plan-phase.js";
import { BuildPhase }            from "./phases/build-phase.js";
import { ValidatePhase }         from "./phases/validate-phase.js";
import { PackagePhase }          from "./phases/package-phase.js";
import { PreviewPhase }          from "./phases/preview-phase.js";
import { PublishPhase }          from "./phases/publish-phase.js";

// Uudet enterprise-phaset
import { TemplatePhase }         from "./phases/template-phase.js";
import { SynthesizePhase }       from "./phases/synthesize-phase.js";
import { DepsPhase }             from "./phases/deps-phase.js";
import { SecurityPhase }         from "./phases/security-phase.js";

/* =============================================================================
   PHASE ORDER — Enterprise tuotantolinja
   ProjectSpec-pohjaisella buildilla: TEMPLATE → SYNTHESIZE → DEPS ennen BUILD:ia.
   SECURITY tulee BUILD:n jälkeen ennen PACKAGE:a.
============================================================================= */

const PHASE_ORDER = [
  PIPELINE_PHASE.INTAKE,
  PIPELINE_PHASE.NORMALIZE,
  PIPELINE_PHASE.INCREMENTAL_CHECK,
  PIPELINE_PHASE.PLAN,
  PIPELINE_PHASE.TEMPLATE,     // Uusi: kopioi template workspaceen
  PIPELINE_PHASE.SYNTHESIZE,   // Uusi: soveltaa patchit
  PIPELINE_PHASE.DEPS,         // Uusi: npm ci
  PIPELINE_PHASE.BUILD,
  PIPELINE_PHASE.VALIDATE,
  PIPELINE_PHASE.SECURITY,     // Uusi: audit + secret scan + blacklist
  PIPELINE_PHASE.PACKAGE,
  PIPELINE_PHASE.PREVIEW,
  PIPELINE_PHASE.PUBLISH
];

/* =============================================================================
   BUILD PIPELINE
============================================================================= */

export class BuildPipeline {

  constructor(opts = {}) {
    this.clock      = opts.clock;
    this.eventBus   = opts.eventBus || null;
    this.config     = opts.config   || {};

    // Memory systems
    this.memory          = opts.memory || {};
    this.artifactVault   = opts.memory?.vault    || null;
    this.releaseRegistry = opts.memory?.registry || null;
    this.auditRing       = opts.memory?.audit    || null;
    this.energyRing      = opts.memory?.energy   || null;
    this.workMemory      = opts.memory?.workRing || null;

    // Workers
    this.workers = opts.workers || {};

    // Policy
    this.policyEngine = opts.policyEngine || null;

    // Enterprise-injektiot (T3 Node-runtime)
    // Expo-ympäristössä nämä ovat null → phaset käyttävät stubia
    this.workspace = opts.workspace || null;  // WorkspaceAdapter tai WorkspaceAdapterNode
    this.runner    = opts.runner    || null;  // CommandRunner

    // Templates registry { "expo-app": template, ... }
    this.templates = opts.templates || {};

    // Config
    this.stopOnError    = opts.stopOnError    !== false;
    this.includePublish = opts.includePublish || false;

    // State
    this._state   = FACTORY_STATE.IDLE;
    this._counter = 0;

    // Initialize phases
    this._phases = this._initializePhases(opts);
  }

  /* =========================================================
     PHASE INITIALIZATION
  ========================================================= */

  _initializePhases(opts) {
    const commonOpts = {
      clock:     this.clock,
      eventBus:  this.eventBus,
      config:    this.config
    };

    return {
      // ── Alkuperäiset ────────────────────────────────────

      [PIPELINE_PHASE.INTAKE]: new IntakePhase({
        ...commonOpts,
        ...opts.intakeConfig
      }),

      [PIPELINE_PHASE.NORMALIZE]: new NormalizePhase({
        ...commonOpts,
        ...opts.normalizeConfig
      }),

      [PIPELINE_PHASE.INCREMENTAL_CHECK]: new IncrementalCheckPhase({
        ...commonOpts,
        artifactVault: this.artifactVault,
        ...opts.incrementalConfig
      }),

      [PIPELINE_PHASE.PLAN]: new PlanPhase({
        ...commonOpts,
        ...opts.planConfig
      }),

      // ── Uudet enterprise-stagit ──────────────────────────

      [PIPELINE_PHASE.TEMPLATE]: new TemplatePhase({
        ...commonOpts,
        workspace: this.workspace,
        templates: this.templates,
        ...opts.templateConfig
      }),

      [PIPELINE_PHASE.SYNTHESIZE]: new SynthesizePhase({
        ...commonOpts,
        workspace: this.workspace,
        ...opts.synthesizeConfig
      }),

      [PIPELINE_PHASE.DEPS]: new DepsPhase({
        ...commonOpts,
        workspace: this.workspace,
        runner:    this.runner,
        allowNpmInstallFallback: true,
        ...opts.depsConfig
      }),

      // ── Build + Validate ─────────────────────────────────

      [PIPELINE_PHASE.BUILD]: new BuildPhase({
        ...commonOpts,
        builderWorker: this.workers.builder,
        workspace:     this.workspace,
        runner:        this.runner,
        ...opts.buildConfig
      }),

      [PIPELINE_PHASE.VALIDATE]: new ValidatePhase({
        ...commonOpts,
        codeInspector: this.workers.inspector,
        testRunner:    this.workers.testRunner,
        securityScanner: this.workers.security,
        ...opts.validateConfig
      }),

      // ── Security ─────────────────────────────────────────

      [PIPELINE_PHASE.SECURITY]: new SecurityPhase({
        ...commonOpts,
        workspace:       this.workspace,
        runner:          this.runner,
        blockOnCritical: opts.securityConfig?.blockOnCritical !== false,
        ...opts.securityConfig
      }),

      // ── Package / Preview / Publish ──────────────────────

      [PIPELINE_PHASE.PACKAGE]: new PackagePhase({
        ...commonOpts,
        packagerWorker: this.workers.packager,
        workspace:      this.workspace,
        ...opts.packageConfig
      }),

      [PIPELINE_PHASE.PREVIEW]: new PreviewPhase({
        ...commonOpts,
        previewWorker: this.workers.preview,
        ...opts.previewConfig
      }),

      [PIPELINE_PHASE.PUBLISH]: new PublishPhase({
        ...commonOpts,
        publisherWorker: this.workers.publisher,
        releaseRegistry: this.releaseRegistry,
        artifactVault:   this.artifactVault,
        policyEngine:    this.policyEngine,
        ...opts.publishConfig
      })
    };
  }

  /* =========================================================
     RUN PIPELINE
  ========================================================= */

  async run(command) {
    const startedAt = this.clock.now();
    const traceId   = this._generateTraceId(command);

    const context = new PipelineContext({
      traceId,
      commandId: command.commandId || command.id,
      command,
      clock:    this.clock,
      files:    command.files    || [],
      metadata: command.metadata || {}
    });

    this._emitPipelineStarted(context, startedAt);
    this._auditAppend("PIPELINE_STARTED", traceId, {
      commandId: command.commandId || command.id,
      fileCount: context.files.length,
      intent:    command.intent || "BUILD"
    });

    this._state = FACTORY_STATE.BUILDING;

    const phaseResults = [];
    let success     = true;
    let failedPhase = null;
    let error       = null;

    const phasesToRun = this.includePublish
      ? PHASE_ORDER
      : PHASE_ORDER.filter((p) => p !== PIPELINE_PHASE.PUBLISH);

    for (const phaseName of phasesToRun) {
      const phase = this._phases[phaseName];

      // Phase puuttuu → ohitetaan hiljaa
      if (!phase) continue;

      try {
        const phaseResult = await phase.run(context);
        phaseResults.push(phaseResult);

        if (this.energyRing && phaseResult.durationMs) {
          this.energyRing.record(phaseName, phaseResult.durationMs);
        }

        if (this.workMemory) {
          this.workMemory.push({
            traceId,
            commandId: command.commandId || command.id,
            phase:     phaseName,
            summary:   phaseResult.skipped ? "SKIPPED" : "COMPLETED",
            confidence: 1.0,
            metaKeys: phaseResult.result ? Object.keys(phaseResult.result) : []
          });
        }

        // Fail-fast
        if (!phaseResult.ok && this.stopOnError) {
          success     = false;
          failedPhase = phaseName;
          error       = phaseResult.error;
          break;
        }

      } catch (err) {
        success     = false;
        failedPhase = phaseName;
        error       = { code: err.code || "PHASE_ERROR", message: err.message };

        phaseResults.push({ ok: false, phase: phaseName, error });

        if (this.stopOnError) break;
      }
    }

    const finishedAt = this.clock.now();
    const durationMs = finishedAt - startedAt;

    this._state = success ? FACTORY_STATE.IDLE : FACTORY_STATE.ERROR;

    if (success && this.artifactVault) {
      for (const artifact of context.getArtifacts()) {
        this.artifactVault.store(artifact);
      }
    }

    if (success) {
      this._emitPipelineCompleted(context, startedAt, finishedAt, phaseResults);
      this._auditAppend("PIPELINE_COMPLETED", traceId, {
        durationMs,
        phaseCount:    phaseResults.length,
        artifactCount: context.getArtifacts().length
      });
    } else {
      this._emitPipelineFailed(context, startedAt, finishedAt, failedPhase, error);
      this._auditAppend("PIPELINE_FAILED", traceId, { durationMs, failedPhase, error });
    }

    return {
      ok:         success,
      traceId,
      commandId:  command.commandId || command.id,
      startedAt,
      finishedAt,
      durationMs,
      phases:     phaseResults,
      artifacts:  context.getArtifacts(),
      metrics:    context.getMetrics(),
      snapshot:   context.toSnapshot(),
      error:      success ? null : { phase: failedPhase, ...error }
    };
  }

  /* =========================================================
     BUILD / BUILD AND PUBLISH
  ========================================================= */

  async build(command) {
    const orig = this.includePublish;
    this.includePublish = false;
    try { return await this.run(command); }
    finally { this.includePublish = orig; }
  }

  async buildAndPublish(command) {
    const orig = this.includePublish;
    this.includePublish = true;
    try { return await this.run(command); }
    finally { this.includePublish = orig; }
  }

  /* =========================================================
     STATE
  ========================================================= */

  getState()   { return this._state; }
  isIdle()     { return this._state === FACTORY_STATE.IDLE; }
  isBuilding() { return this._state === FACTORY_STATE.BUILDING; }

  /* =========================================================
     EVENTS
  ========================================================= */

  _emitPipelineStarted(context, startedAt) {
    if (!this.eventBus) return;
    this.eventBus.emit("FACTORY:PIPELINE_STARTED", {
      traceId:   context.traceId,
      commandId: context.commandId,
      startedAt,
      fileCount: context.files.length
    });
  }

  _emitPipelineCompleted(context, startedAt, finishedAt, phaseResults) {
    if (!this.eventBus) return;
    this.eventBus.emit("FACTORY:PIPELINE_COMPLETED", {
      traceId:       context.traceId,
      commandId:     context.commandId,
      startedAt,
      finishedAt,
      durationMs:    finishedAt - startedAt,
      phaseCount:    phaseResults.length,
      artifactCount: context.getArtifacts().length
    });
  }

  _emitPipelineFailed(context, startedAt, finishedAt, failedPhase, error) {
    if (!this.eventBus) return;
    this.eventBus.emit("FACTORY:PIPELINE_FAILED", {
      traceId:     context.traceId,
      commandId:   context.commandId,
      startedAt,
      finishedAt,
      durationMs:  finishedAt - startedAt,
      failedPhase,
      error
    });
  }

  /* =========================================================
     AUDIT
  ========================================================= */

  _auditAppend(type, traceId, meta) {
    if (!this.auditRing) return;
    this.auditRing.record({ action: type, data: { traceId, ...meta } });
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  _generateTraceId(command) {
    this._counter += 1;
    const ts   = this.clock.now();
    const base = `trace:${ts}:${this._counter}:${command.commandId || command.id || ""}`;
    return `trace_${fnv1a32(base)}`;
  }
}

export function createBuildPipeline(opts = {}) {
  return new BuildPipeline(opts);
}

export default BuildPipeline;