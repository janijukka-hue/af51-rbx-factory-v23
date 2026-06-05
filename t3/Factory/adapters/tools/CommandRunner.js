// t3/Factory/adapters/tools/CommandRunner.js
// KERROS: T3 – Tuotanto
// Executor-strategia: varsinainen suoritus delegoidaan injektoituun executor-funktioon.
//
// Metro/Expo-yhteensopivuus:
//   Tässä tiedostossa EI ole yhtään Node.js-importtia eikä viittausta node-executor.js:ään.
//   Metro bundlaa tämän turvallisesti ilman child_process / fs / crypto -virheitä.
//
// Oletusexecutor = createStubExecutor() (Expo/RN-ympäristö)
// Node-runtime: injektoi oikea executor kutsumalla runner.setNodeExecutor(executor)
//   tai rakentamalla CommandRunner({ executor: createNodeExecutor(...) })
//   — createNodeExecutor tuodaan VAIN Node-runtimessa (alx-factory-server).
//
// Käyttö Expolassa:
//   const runner = new CommandRunner();          // stub-executorilla
//
// Käyttö Node-serverillä (alx-factory-server):
//   import { createNodeExecutor } from "./node-executor.js";
//   const runner = new CommandRunner({ executor: createNodeExecutor({ workspaceRoot }) });

export var COMMAND_RUNNER_VERSION = "3.1.0";

export var RUN_STATE = {
  IDLE:    "IDLE",
  RUNNING: "RUNNING",
  DONE:    "DONE",
  ERROR:   "ERROR"
};

export var ALLOWED_COMMANDS = new Set([
  "node", "npm", "npx", "yarn", "pnpm",
  "expo", "tsc", "jest", "eslint", "prettier",
  "webpack", "vite", "rollup", "esbuild"
]);

var DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
var MAX_OUTPUT_SIZE    = 2 * 1024 * 1024; // 2 MB

// ─── Stub executor — Metro-safe, ei Node-buildineja ──────────
// Käytetään Expo/RN-ympäristössä ja testeissä.

export function createStubExecutor(overrides) {
  var results = overrides || {};
  return function stubExecute(cmd, args) {
    var key = cmd + " " + (args || []).join(" ");
    if (results[key]) return results[key];
    return {
      ok:       true,
      exitCode: 0,
      stdout:   "[STUB] " + key,
      stderr:   "",
      timedOut: false,
      stub:     true
    };
  };
}

// ─── CommandRunner ───────────────────────────────────────────

export class CommandRunner {

  constructor(options) {
    var opts = options || {};

    // Oletusexecutor on AINA stub — ei Node-importteja tässä tiedostossa.
    // Node-runtime injektoi createNodeExecutor() konstruktorin kautta tai setNodeExecutor():lla.
    this._executor     = opts.executor || createStubExecutor();

    this._clock        = opts.clock        || { now: function() { return Date.now(); } };
    this._eventBus     = opts.eventBus     || null;
    this._debug        = opts.debug        || false;
    this._allowlist    = opts.allowlist    || ALLOWED_COMMANDS;
    this._toolVersions = opts.toolVersions || { node: ">=18", npm: ">=9", expo: ">=50" };

    this._state        = RUN_STATE.IDLE;
    this._history      = [];
    this._historyLimit = opts.historyLimit || 100;
    this._stats        = { total: 0, succeeded: 0, failed: 0, timedOut: 0, totalMs: 0 };
  }

  // ── Runtime-injektio Node-executorille ───────────────────
  // Kutsutaan alx-factory-server -puolella boottauksen yhteydessä.
  // Expo-bundlessa tätä ei kutsuta koskaan.

  setNodeExecutor(executor) {
    if (typeof executor !== "function") {
      throw new Error("CommandRunner.setNodeExecutor: executor täytyy olla funktio");
    }
    this._executor = executor;
    if (this._debug) 
  // }

  // isStub() {
    return !!(this._executor && this._executor.name === "stubExecute");
  }

  // ── run ──────────────────────────────────────────────────

  run(cmd, args, opts) {
    var cmdArgs   = args   || [];
    var runOpts   = opts   || {};
    var startedAt = this._clock.now();
    var label     = runOpts.label   || (cmd + " " + cmdArgs.join(" ")).trim();
    var timeout   = runOpts.timeout || DEFAULT_TIMEOUT_MS;
    var cwd       = runOpts.cwd     || (typeof process !== "undefined" ? process.cwd() : "/");
    var auditOn   = runOpts.audit   !== false;

    this._stats.total++;
    this._state = RUN_STATE.RUNNING;

    // Allowlist-tarkistus
    var baseCmd = cmd.replace(/.*[/\\]/, "").replace(/\.cmd$|\.exe$/, "");
    if (!this._allowlist.has(baseCmd)) {
      this._stats.failed++;
      this._state = RUN_STATE.ERROR;
      var blocked = {
        ok: false, cmd: cmd, args: cmdArgs, cwd: cwd,
        error: "Komento '" + cmd + "' ei ole sallituissa (allowlist)",
        code: "COMMAND_NOT_ALLOWED", durationMs: 0, label: label
      };
      if (auditOn) this._emitAudit("COMMAND_BLOCKED", { cmd: cmd, cwd: cwd });
      this._addHistory(Object.assign({}, blocked, { startedAt: startedAt }));
      return blocked;
    }

    if (auditOn) this._emitAudit("COMMAND_STARTED", { cmd: cmd, args: cmdArgs, cwd: cwd, label: label });

    var execResult;
    try {
      execResult = this._executor(cmd, cmdArgs, { cwd: cwd, timeout: timeout, env: runOpts.env || {} });
    } catch (err) {
      var dMs = this._clock.now() - startedAt;
      this._stats.failed++;
      this._state = RUN_STATE.ERROR;
      var ex = { ok: false, cmd: cmd, args: cmdArgs, cwd: cwd, error: err.message, code: "EXECUTOR_ERROR", durationMs: dMs, label: label };
      this._addHistory(Object.assign({}, ex, { startedAt: startedAt }));
      if (auditOn) this._emitAudit("COMMAND_ERROR", { cmd: cmd, error: err.message });
      return ex;
    }

    var durationMs = this._clock.now() - startedAt;
    var stdout     = (execResult.stdout || "").slice(0, MAX_OUTPUT_SIZE);
    var stderr     = (execResult.stderr || "").slice(0, MAX_OUTPUT_SIZE);
    var exitCode   = execResult.exitCode != null ? execResult.exitCode : (execResult.ok ? 0 : 1);
    var timedOut   = execResult.timedOut || false;
    var ok         = exitCode === 0 && !timedOut;

    if (timedOut)   this._stats.timedOut++;
    else if (ok)    this._stats.succeeded++;
    else            this._stats.failed++;

    this._stats.totalMs += durationMs;
    this._state = ok ? RUN_STATE.DONE : RUN_STATE.ERROR;

    var result = {
      ok: ok, cmd: cmd, args: cmdArgs, cwd: cwd,
      exitCode: exitCode, stdout: stdout, stderr: stderr,
      timedOut: timedOut, durationMs: durationMs, label: label,
      stub: execResult.stub || false
    };
    if (!ok) result.error = timedOut ? "Timeout (" + timeout + "ms)" : "Exit code " + exitCode;

    this._addHistory(Object.assign({}, result, { startedAt: startedAt }));

    var auditType = ok ? "COMMAND_COMPLETED" : (timedOut ? "COMMAND_TIMEOUT" : "COMMAND_FAILED");
    if (auditOn) this._emitAudit(auditType, { cmd: cmd, label: label, exitCode: exitCode, durationMs: durationMs });

    return result;
  }

  // ── Wrapperit ────────────────────────────────────────────

  /** npm ci — enterprise: deterministinen, vaatii package-lock.json */
  npmCi(cwd) {
    return this.run("npm", ["ci", "--no-audit", "--prefer-offline"], {
      cwd: cwd, label: "npm ci", timeout: 5 * 60 * 1000
    });
  }

  /** npm install — fallback kun lockfile puuttuu */
  npmInstall(cwd, flags) {
    return this.run("npm", ["install", "--legacy-peer-deps", "--no-audit"].concat(flags || []), {
      cwd: cwd, label: "npm install", timeout: 5 * 60 * 1000
    });
  }

  npmRun(script, cwd, flags) {
    return this.run("npm", ["run", script].concat(flags || []), {
      cwd: cwd, label: "npm run " + script, timeout: 10 * 60 * 1000
    });
  }

  expoExport(cwd, outputDir) {
    return this.run("npx", ["expo", "export", "--output-dir", outputDir || "dist", "--platform", "web"], {
      cwd: cwd, label: "expo export web", timeout: 10 * 60 * 1000
    });
  }

  runTests(cwd) {
    return this.run("npm", ["test", "--", "--passWithNoTests", "--forceExit", "--ci"], {
      cwd: cwd, label: "npm test", timeout: 5 * 60 * 1000
    });
  }

  runLint(cwd) {
    return this.run("npm", ["run", "lint"], { cwd: cwd, label: "eslint", timeout: 60 * 1000 });
  }

  checkToolVersions() {
    var nodeR  = this.run("node", ["--version"], { audit: false, label: "node --version" });
    var npmR   = this.run("npm",  ["--version"], { audit: false, label: "npm --version" });
    var checks = {
      node: { ok: nodeR.ok, version: (nodeR.stdout || "").trim(), required: this._toolVersions.node },
      npm:  { ok: npmR.ok,  version: (npmR.stdout  || "").trim(), required: this._toolVersions.npm  }
    };
    return { ok: checks.node.ok && checks.npm.ok, checks: checks };
  }

  // ── Tilastot ─────────────────────────────────────────────

  getHistory(count) { return this._history.slice(-(count || 20)); }
  getState()        { return this._state; }
  getStats()        { return Object.assign({}, this._stats, { state: this._state, version: COMMAND_RUNNER_VERSION }); }

  _addHistory(entry) {
    this._history.push(entry);
    if (this._history.length > this._historyLimit) this._history.shift();
  }

  _emitAudit(type, payload) {
    if (this._eventBus && typeof this._eventBus.emit === "function") {
      this._eventBus.emit("TOOL:" + type, payload);
    }
  }
}

export function createCommandRunner(options) {
  return new CommandRunner(options || {});
}

export default CommandRunner;