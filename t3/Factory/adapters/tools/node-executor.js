// t3/Factory/adapters/tools/node-executor.js
// KERROS: T3 — Tuotanto
// Node.js-pohjainen komennon ajaja CommandRunnerille.
// Korvaa createStubExecutor() tuotantoympäristössä.
//
// HUOM: Tämä tiedosto on tarkoitettu vain Node.js-runtimelle.
// Expo / React Native -ympäristössä CommandRunner käyttää createStubExecutor().
// ESM-yhteensopiva: käyttää createRequire() require():n sijaan.
/* eslint-disable */

import { createRequire } from "module";

export var NODE_EXECUTOR_VERSION = "2.0.0";

var DEFAULT_TIMEOUT = 5 * 60 * 1000;

export function createNodeExecutor(opts) {
  var options = opts || {};
  var debug   = options.debug || false;

  // child_process ladataan vain Node-ympäristössä
  // ESM: createRequire() antaa require()-funktion ESM-moduulissa
  var _execFileSync;
  try {
    var _require = createRequire(import.meta.url);
    _execFileSync = _require("child_process").execFileSync;
  } catch (e) {
    if (debug) console.warn("[NodeExecutor] child_process ei saatavilla:", e.message);
    return function() {
      return { ok: false, stdout: "", stderr: "Node.js required", exitCode: 1, stub: true };
    };
  }

  // Windows: npm/npx/yarn ovat .cmd-tiedostoja — lisää .cmd-pääte
  var WIN = process.platform === "win32";
  var WIN_CMD_TOOLS = new Set(["npm", "npx", "yarn", "pnpm", "expo", "tsc", "jest", "eslint", "prettier"]);

  function resolveCmd(cmd) {
    if (WIN && WIN_CMD_TOOLS.has(cmd)) return cmd + ".cmd";
    return cmd;
  }

  return function nodeExecute(cmd, args, runOpts) {
    var resolvedCmd = resolveCmd(cmd);
    var cmdArgs    = Array.isArray(args) ? args : [];
    var cwd        = (runOpts && runOpts.cwd) || process.cwd();
    var timeout    = (runOpts && runOpts.timeout) || DEFAULT_TIMEOUT;
    var t0         = Date.now();

    if (debug) console.log("[NodeExecutor] start");

    try {
      var stdout = _execFileSync(resolvedCmd, cmdArgs, {
        cwd:      cwd,
        timeout:  timeout,
        encoding: "utf8",
        stdio:    ["pipe", "pipe", "pipe"],
        env:      Object.assign({}, process.env, { NO_COLOR: "1", FORCE_COLOR: "0" }),
      });
      return {
        ok: true, stdout: stdout || "", stderr: "",
        exitCode: 0, durationMs: Date.now() - t0, stub: false,
      };
    } catch (err) {
      return {
        ok: false, stdout: err.stdout || "", stderr: err.stderr || err.message || "",
        exitCode: err.status || 1, durationMs: Date.now() - t0,
        timedOut: err.signal === "SIGTERM", stub: false, error: err.message,
      };
    }
  };
}

export default createNodeExecutor;