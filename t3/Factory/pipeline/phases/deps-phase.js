// t3/Factory/pipeline/phases/deps-phase.js
// KERROS: T3 – Tuotanto
// Pipeline-vaihe: asentaa riippuvuudet CommandRunner:n kautta.
//
// Enterprise-sääntö: npm ci (ei npm install)
//   - npm ci vaatii package-lock.json
//   - Jos lockfile puuttuu → FAIL (deterministinen build pakollinen)
//   - Fallback npm install VAIN jos opts.allowNpmInstallFallback === true

import { BasePhase } from "../base-phase.js";

var DEPS_PHASE_NAME = "DEPS";
var DEPS_TIMEOUT_MS = 5 * 60 * 1000;

export class DepsPhase extends BasePhase {

  constructor(options) {
    var opts = options || {};
    super(DEPS_PHASE_NAME, opts);
    this._workspace               = opts.workspace               || null;
    this._runner                  = opts.runner                  || null;
    this._timeout                 = opts.timeout                 || DEPS_TIMEOUT_MS;
    this._packageManager          = opts.packageManager          || "npm";
    this._allowNpmInstallFallback = opts.allowNpmInstallFallback || false;
  }

  canSkip(context) {
    if (!context.isIncrementalHit()) return false;
    return !!(this._workspace && this._workspace.fileExists("node_modules/.package-lock.json"));
  }

  async execute(context) {
    if (!this._workspace) throw new Error("DepsPhase: workspace ei ole asetettu");
    if (!this._runner)    throw new Error("DepsPhase: runner (CommandRunner) ei ole asetettu");

    var cwd = this._workspace.getRootDir();
    if (!cwd) throw new Error("DepsPhase: workspace.getRootDir() palautti null — kutsu createWorkspace() ensin");

    // 1. package.json löytyy?
    if (!this._workspace.fileExists("package.json")) {
      throw new Error("DepsPhase: package.json puuttuu workspacesta — suoriutuiko TemplatePhase?");
    }

    // 2. Tool-versioiden tarkistus
    var versionCheck = this._runner.checkToolVersions();
    if (!versionCheck.ok) {
      var missing = Object.keys(versionCheck.checks)
        .filter(function(t) { return !versionCheck.checks[t].ok; })
        .map(function(t) {
          var c = versionCheck.checks[t];
          return t + ": " + (c.version || "ei löydy") + " (vaaditaan " + c.required + ")";
        })
        .join(", ");
      throw new Error("DepsPhase: Tool-versiot eivät täytä vaatimuksia: " + missing);
    }

    // 3. Lockfile-tarkistus — npm ci vaatii sen
    var lockfileExists =
      this._workspace.fileExists("package-lock.json") ||
      this._workspace.fileExists("yarn.lock")         ||
      this._workspace.fileExists("pnpm-lock.yaml");

    var usedCommand;
    var installResult;

    if (lockfileExists) {
      // Enterprise-standardi: deterministinen asennus
      usedCommand   = "npm ci";
      installResult = this._runner.npmCi(cwd);

    } else if (this._allowNpmInstallFallback) {
      // Fallback vain kehitysympäristöissä
      usedCommand   = "npm install (fallback)";
      installResult = this._runner.npmInstall(cwd);
      this._emit("DEPS:LOCKFILE_MISSING_FALLBACK", {
        cwd:     cwd,
        warning: "package-lock.json puuttui — käytettiin npm install. " +
                 "Enterprise-buildeissa lockfile on pakollinen."
      });

    } else {
      // Fail-fast: ei lockfilea, ei fallbackia → virhe
      throw new Error(
        "DepsPhase: package-lock.json puuttuu — npm ci ei onnistu. " +
        "Lisää lockfile versionhallintaan tai aseta allowNpmInstallFallback:true kehitysympäristöissä."
      );
    }

    if (!installResult.ok) {
      var detail  = (installResult.stderr || "").slice(-800) || installResult.error || "Tuntematon virhe";
      var timedMsg = installResult.timedOut ? " (TIMEOUT " + this._timeout + "ms)" : "";
      throw new Error(
        "DepsPhase: " + usedCommand + " epäonnistui (exit " +
        installResult.exitCode + ")" + timedMsg + ":\n" + detail
      );
    }

    var phaseResult = {
      command:        usedCommand,
      lockfileExists: lockfileExists,
      durationMs:     installResult.durationMs,
      packageManager: this._packageManager,
      nodeVersion:    versionCheck.checks.node ? versionCheck.checks.node.version : null,
      npmVersion:     versionCheck.checks.npm  ? versionCheck.checks.npm.version  : null,
      stub:           installResult.stub || false
    };

    context.setPhaseResult(DEPS_PHASE_NAME, phaseResult);
    this._emit("DEPS:INSTALLED", { cwd: cwd, command: usedCommand, durationMs: installResult.durationMs });
    return phaseResult;
  }
}

export function createDepsPhase(options) {
  return new DepsPhase(options || {});
}

export default DepsPhase;