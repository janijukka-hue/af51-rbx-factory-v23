// t3/Factory/pipeline/pipeline-context.js
// Pipeline Context - Jaettu tila pipelinessa
// v2: lisätty addReport / getReports (ProjectArtifact 2.0)

import { PIPELINE_PHASE } from "../core/factory-types.js";

export class PipelineContext {
  constructor(options = {}) {
    this.traceId   = options.traceId;
    this.commandId = options.commandId;
    this.command   = options.command || {};
    this.clock     = options.clock;

    this.files    = options.files    || [];
    this.metadata = options.metadata || {};

    this._normalizedFiles    = [];
    this._buildOutput        = [];
    this._artifacts          = [];
    this._phaseResults       = new Map();
    this._reports            = [];   // ProjectArtifact 2.0: stage-raportit

    this._checksum              = null;
    this._incrementalHit        = false;
    this._incrementalArtifactId = null;

    this._manifest          = null;
    this._validationResults = null;
    this._preview           = null;
    this._release           = null;

    this._metrics = {
      startedAt: this.clock ? this.clock.now() : Date.now(),
      phases: {}
    };

    this._errors   = [];
    this._failures = [];
  }

  // ── Perus ────────────────────────────────────────────────

  getCommand()         { return this.command; }
  getFiles()           { return this.files; }

  setNormalizedFiles(files)  { this._normalizedFiles = files; }
  getNormalizedFiles()       { return this._normalizedFiles; }

  setBuildOutput(output)     { this._buildOutput = output; }
  getBuildOutput()           { return this._buildOutput; }

  addArtifact(artifact)      { this._artifacts.push(artifact); }
  getArtifacts()             { return this._artifacts; }

  setPhaseResult(phase, result) { this._phaseResults.set(phase, result); }
  getPhaseResult(phase)         { return this._phaseResults.get(phase); }

  getAllPhaseResults() {
    var results = {};
    this._phaseResults.forEach(function(result, phase) { results[phase] = result; });
    return results;
  }

  setChecksum(checksum)    { this._checksum = checksum; }
  getChecksum()            { return this._checksum; }

  setIncrementalHit(hit, artifactId) {
    this._incrementalHit        = hit;
    this._incrementalArtifactId = artifactId || null;
  }
  isIncrementalHit()           { return this._incrementalHit; }
  getIncrementalArtifactId()   { return this._incrementalArtifactId; }

  setManifest(manifest)        { this._manifest = manifest; }
  getManifest()                { return this._manifest; }

  setValidationResults(r)      { this._validationResults = r; }
  getValidationResults()       { return this._validationResults; }

  setPreview(preview)          { this._preview = preview; }
  getPreview()                 { return this._preview; }

  setRelease(release)          { this._release = release; }
  getRelease()                 { return this._release; }

  // ── Reports (ProjectArtifact 2.0) ───────────────────────
  // Jokainen stage voi lisätä raporttinsa tähän listaan.
  // PackagePhase sisällyttää ne artifact.reports[]-kenttään.

  /**
   * addReport(report)
   * @param {object} report
   *   report.phase    {string}  — PIPELINE_PHASE-vakio
   *   report.type     {string}  — "security" | "test" | "lint" | "deps" | "custom"
   *   report.ok       {boolean}
   *   report.data     {object}  — phase-kohtainen payload
   *   report.auditRef {string?} — viite ulkoiseen audit-tietueeseen
   */
  addReport(report) {
    if (!report || !report.phase) return;
    this._reports.push(Object.assign({ createdAt: this.clock ? this.clock.now() : Date.now() }, report));
  }

  getReports()          { return this._reports.slice(); }
  getReportsByPhase(ph) { return this._reports.filter(function(r) { return r.phase === ph; }); }

  // ── Metrics ──────────────────────────────────────────────

  recordPhaseMetrics(phase, durationMs, data) {
    this._metrics.phases[phase] = Object.assign({ durationMs: durationMs }, data || {});
  }

  getMetrics() {
    var now = this.clock ? this.clock.now() : Date.now();
    return Object.assign({}, this._metrics, {
      finishedAt:      now,
      totalDurationMs: now - this._metrics.startedAt
    });
  }

  // ── Errors / Warnings ────────────────────────────────────

  addError(phase, error) {
    this._errors.push({ phase: phase, error: error, timestamp: this.clock ? this.clock.now() : Date.now() });
  }
  getErrors()   { return this._errors; }

  addWarning(phase, warning) {
    this._failures.push({ phase: phase, warning: warning, timestamp: this.clock ? this.clock.now() : Date.now() });
  }
  getWarnings() { return this._failures; }

  // ── Snapshot ─────────────────────────────────────────────

  toSnapshot() {
    return {
      traceId:        this.traceId,
      commandId:      this.commandId,
      fileCount:      this.files.length,
      checksum:       this._checksum,
      incrementalHit: this._incrementalHit,
      manifest:       this._manifest,
      artifactCount:  this._artifacts.length,
      reportCount:    this._reports.length,
      phases:         Object.keys(this._metrics.phases),
      errorCount:     this._errors.length,
      warningCount:   this._failures.length
    };
  }
}

export function createPipelineContext(options) {
  return new PipelineContext(options);
}

export default PipelineContext;