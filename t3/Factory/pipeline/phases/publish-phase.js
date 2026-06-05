// t3/Factory/pipeline/phases/publish-phase.js
// Publish Phase - Distribute to channels
// Version: 2.0.0 - Publish checklist + rollback model

import { BasePhase } from "../base-phase.js";
import { PIPELINE_PHASE } from "../../core/factory-types.js";

// ─── Publish checklist ────────────────────────────────────────
// Jokainen ehto tarkistetaan ennen julkaisua.

var PUBLISH_CHECKLIST = [
  {
    id:   "CHK-001",
    name: "Build success",
    check: function(ctx) {
      if (!ctx.buildSuccess) {
        return { pass: false, reason: "Build ei onnistunut — ei voi julkaista" };
      }
      return { pass: true };
    }
  },
  {
    id:   "CHK-002",
    name: "Artifact olemassa",
    check: function(ctx) {
      if (!ctx.artifact || !ctx.artifact.id) {
        return { pass: false, reason: "Artifaktia ei löydy" };
      }
      return { pass: true };
    }
  },
  {
    id:   "CHK-003",
    name: "Package hash laskettu",
    check: function(ctx) {
      var hasHash = ctx.artifact &&
        ctx.artifact.package &&
        ctx.artifact.package.zipHash;
      if (!hasHash) {
        return { pass: false, reason: "Package hash puuttuu — deterministisyys ei voitu varmistaa" };
      }
      return { pass: true };
    }
  },
  {
    id:   "CHK-004",
    name: "Security pass (ei CRITICAL)",
    check: function(ctx) {
      var reports = (ctx.artifact && ctx.artifact.reports) || [];
      var secReport = reports.find(function(r) { return r.type === "security"; });
      if (secReport && secReport.riskLevel === "CRITICAL") {
        return { pass: false, reason: "Security-tarkistus: CRITICAL-riski — julkaisu estetty" };
      }
      return { pass: true };
    }
  },
  {
    id:   "CHK-005",
    name: "Versio määritelty",
    check: function(ctx) {
      if (!ctx.version || ctx.version === "0.0.0") {
        return { pass: false, reason: "Versio puuttuu tai on 0.0.0" };
      }
      return { pass: true };
    }
  }
];

export class PublishPhase extends BasePhase {
  constructor(options = {}) {
    super(PIPELINE_PHASE.PUBLISH, options);
    this._publisherWorker = options.publisherWorker || null;
    this._releaseRegistry = options.releaseRegistry || null;
  }

  canSkip(context) {
    const command = context.getCommand();
    return !command.options?.channels || command.options.channels.length === 0;
  }

  async execute(context) {
    const command   = context.getCommand();
    const artifacts = context.getArtifacts();
    const manifest  = context.getManifest();
    const channels  = command.options?.channels || ["LOCAL"];

    if (!artifacts.length) {
      return { published: false, reason: "No artifacts to publish" };
    }

    const artifact = artifacts[0];

    // ── Publish checklist ─────────────────────────────────
    var checklistCtx = {
      buildSuccess: context.getPhaseResult ? !!context.getPhaseResult("BUILD") : true,
      artifact:     artifact,
      version:      manifest.version || command.version || "1.0.0",
    };

    var checklistResult = this._runChecklist(checklistCtx);
    if (!checklistResult.pass) {
      return {
        published:    false,
        blocked:      true,
        checklist:    checklistResult,
        reason:       "Publish checklist epäonnistui: " + checklistResult.failedItems.map(function(i) { return i.id; }).join(", ")
      };
    }

    // ── Rakenna release ───────────────────────────────────
    var releaseId = "rel_" + (this._clock ? this._clock.now() : Date.now());
    var version   = manifest.version || command.version || "1.0.0";

    var release = {
      id:          releaseId,
      artifactId:  artifact.id,
      projectName: manifest.projectName || command.projectName || "unknown",
      version:     version,
      channels:    channels,
      checksum:    artifact.checksum || (artifact.package && artifact.package.zipHash),
      packageHash: artifact.package  ? artifact.package.zipHash : null,
      distHash:    artifact.build    ? artifact.build.distHash  : null,
      fileCount:   artifact.build    ? artifact.build.fileCount : 0,
      createdAt:   this._clock ? this._clock.now() : Date.now(),
      checklist:   checklistResult,
      // Rollback-metadata
      rollback: {
        supported:    true,
        rolledBack:   false,
        rolledBackAt: null,
        rolledBackBy: null,
        reason:       null
      }
    };

    // ── Julkaisu ──────────────────────────────────────────
    if (this._publisherWorker) {
      try {
        const result = await this._publisherWorker.publish(artifact, release, channels);
        release.publishResult = result;
      } catch (e) {
        release.publishResult = { ok: false, error: e.message };
      }
    }

    // ── Rekisteröi ────────────────────────────────────────
    if (this._releaseRegistry) {
      this._releaseRegistry.register(release);
    }

    context.setRelease(release);

    return {
      published:   true,
      releaseId:   releaseId,
      version:     version,
      channels:    channels,
      packageHash: release.packageHash ? release.packageHash.slice(0, 16) : null,
      checklist:   checklistResult
    };
  }

  // ── _runChecklist(ctx) ────────────────────────────────────

  _runChecklist(ctx) {
    var passedItems = [];
    var failedItems = [];

    for (var i = 0; i < PUBLISH_CHECKLIST.length; i++) {
      var item   = PUBLISH_CHECKLIST[i];
      var result = item.check(ctx);
      if (result.pass) {
        passedItems.push({ id: item.id, name: item.name });
      } else {
        failedItems.push({ id: item.id, name: item.name, reason: result.reason });
      }
    }

    return {
      pass:        failedItems.length === 0,
      passedItems: passedItems,
      failedItems: failedItems,
      total:       PUBLISH_CHECKLIST.length,
      passed:      passedItems.length,
      failed:      failedItems.length
    };
  }
}

// ── Rollback-apufunktio ───────────────────────────────────────
// Käytetään ReleaseRegistry:n kautta.

export function rollbackRelease(releaseRegistry, releaseId, reason, actor) {
  if (!releaseRegistry) return { ok: false, error: "ReleaseRegistry puuttuu" };

  var release = releaseRegistry.get(releaseId);
  if (!release) return { ok: false, error: "Release ei löydy: " + releaseId };

  if (release.rollback && release.rollback.rolledBack) {
    return { ok: false, error: "Release on jo peruttu" };
  }

  release.rollback = {
    supported:    true,
    rolledBack:   true,
    rolledBackAt: Date.now(),
    rolledBackBy: actor || "system",
    reason:       reason || "manual_rollback"
  };

  // Päivitä registry
  if (typeof releaseRegistry.update === "function") {
    releaseRegistry.update(releaseId, release);
  }

  return {
    ok:           true,
    releaseId:    releaseId,
    rolledBackAt: release.rollback.rolledBackAt,
    reason:       reason
  };
}

export function createPublishPhase(options) {
  return new PublishPhase(options);
}

export { PUBLISH_CHECKLIST };
export default PublishPhase;