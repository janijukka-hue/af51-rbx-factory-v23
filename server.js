// server.js — ALX Factory Node.js Server
// Käynnistä: node server.js
// Env: PORT (default 3000), OLLAMA_ENDPOINT, ALX_WORKSPACE_ROOT
//
// HTTP API:
//   GET  /health       → status
//   POST /execute      → { input } → ALX execute
//   POST /build        → { name, target, features } → build app
//   GET  /status       → factory + orchestrator status
//   GET  /memory       → CoreMemory stats

// ── DIAGNOSTIC: surface any silent boot crash (added for Windows debugging) ──
process.on("unhandledRejection", function(reason) {
  console.error("\n[FATAL] Unhandled promise rejection during boot:");
  console.error(reason && reason.stack ? reason.stack : reason);
  process.exit(1);
});
process.on("uncaughtException", function(err) {
  console.error("\n[FATAL] Uncaught exception during boot:");
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});

import http from "http";
import { readFileSync, existsSync, appendFileSync } from "fs";
import fs from "fs";
import crypto from "crypto";
import energyRing from "./server/runtime/energy-ring.js";

// ── .env lataus (Windows-yhteensopiva) ──────────────────────
try {
  var _pmod  = await import("path");
  var _umod  = await import("url");
  var _envDir  = _pmod.default.dirname(_umod.fileURLToPath(import.meta.url));
  var _envPath = _pmod.default.join(_envDir, ".env");
  if (existsSync(_envPath)) {
    var envLines = readFileSync(_envPath, "utf8").split("\n");
    for (var line of envLines) {
      line = line.trim();
      if (!line || line.startsWith("#")) continue;
      var eqIdx = line.indexOf("=");
      if (eqIdx < 1) continue;
      var key = line.slice(0, eqIdx).trim();
      var val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !(key in process.env)) process.env[key] = val;
    }
    
  }
} catch (_envErr) { /* ok */ }
import { checkAuth, assertAuthConfigured } from "./middleware/auth.js";
import { handleWorkspaceSave, handleWorkspaceClear, handleWorkspaceLoad, handleWorkspaceList, handleWorkspaceSnapshot, handleWorkspaceRestore, handleWorkspaceAbort } from "./routes/workspace.js";
import { handleVaultUI, handleVaultSave, handleVaultList, handleVaultGet, handleVaultGetFull } from "./routes/vault.js";
import { handlePublish, handlePublishedList, handlePublishedDownload } from "./routes/publish.js";
import { handleWorksList, handleWorkSave, handleWorkDelete, handleWorkGet, handleWorkAttachAsset, handleWorkDetachAsset } from "./routes/works.js";
import { handleAssetUpload, handleAssetGet, handleAssetDelete, handleAssetList } from "./routes/assets.js";
import { handleCubeStart, handleCubeFinalize, handleArkku, handleVaultAudit, handleVaultHealth } from "./routes/ghostVault.js";
import { handleDetectStatus, handleDetectProject } from "./routes/detect.js";
import { handlePreviewStatus, handlePreviewProject, handleBusinessWalletPreview } from "./routes/preview.js";
import { createOrchestrator } from "./m2/Ohjaus/orchestrator.js";
import { getOllamaMemory }    from "./m2/agents/ollama-memory.js";
import { OllamaMemoryRing }   from "./m2/agents/ollama-memory-ring.js";
import { WorkspaceAdapterNode } from "./t3/Factory/adapters/fs/WorkspaceAdapterNode.js";
import { createNodeExecutor }   from "./t3/Factory/adapters/tools/node-executor.js";
import { CommandRunner }        from "./t3/Factory/adapters/tools/CommandRunner.js";

var PORT     = Number(process.env.PORT || 3000);
var OLLAMA   = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
var DEBUG    = process.env.ALX_DEBUG === "1";
var EXPORTS_DIR = (await import("node:path")).join(process.cwd(), "exports-rbx");

// Energy Ring runtime governor telemetry
var activeJobs = 0;
var buildLatency = 0;

function updateEnergyTelemetry(extra) {
  return energyRing.updateTelemetry(Object.assign({
    queueDepth: activeJobs,
    latency: buildLatency,
  }, extra || {}));
}

function logEnergyThrottle(route) {
  updateEnergyTelemetry();
  if (energyRing.shouldThrottle()) {
    console.log("⚡ Energy Ring throttle active", JSON.stringify({
      route: route || "unknown",
      profile: energyRing.getProfileName(),
      metrics: energyRing.getStatus().metrics,
    }));
  }
}

// OllamaMemory — singleton, pysyy muistissa serverin elinajan
var ollamaMemory = getOllamaMemory({ maxHistory: 20, maxSessions: 50 });

// ── Boot ──────────────────────────────────────────────────────────────────────


var orch = createOrchestrator({
  owner:          "alx-factory-server",
  debug:          DEBUG,
  llmEnabled:     !!process.env.OLLAMA_ENDPOINT,
  llmEndpoint:    OLLAMA,
  llmModel:       process.env.OLLAMA_MODEL || "llama3.2",
  factoryEnabled: true,
  learningEnabled: true,
});

// ── Auth pre-flight \u2014 strict-modessa palvelin EI k\u00e4ynnisty ilman ALX_API_TOKENia ──
// Strict laukeaa kun NODE_ENV=production tai ALX_REQUIRE_AUTH=1.
// Dev-tila (NODE_ENV ei "production", ALX_REQUIRE_AUTH ei "1") s\u00e4ilyy
// avoimena vanhalla varoituksella.
var _authStatus;
try {
  _authStatus = assertAuthConfigured();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
console.log("[auth] mode=" + _authStatus.mode + " configured=" + _authStatus.configured + " strict=" + _authStatus.strict);

var bootResult = await orch.boot();
if (!bootResult.ok) {
  console.error("\u274c Boot ep\u00e4onnistui:", bootResult.error);
  process.exit(1);
}

// Ollama-tila käynnistyksessä
var _ollamaEndpoint = process.env.OLLAMA_ENDPOINT || null;
var _ollamaAgent    = orch.getOllamaAgent();
if (_ollamaEndpoint && _ollamaAgent) {
  console.log("  Ollama: connected (" + _ollamaEndpoint + ")");
} else if (_ollamaEndpoint && !_ollamaAgent) {
  console.log("  Ollama: endpoint set but agent unavailable");
} else {
  console.log("  Ollama: not configured (deterministic mode)");
}

// Injektoi Node.js-adapterit Factoryyn
var factory = orch.getFactory();
if (factory && factory._pipeline) {
  var workspace = new WorkspaceAdapterNode({ debug: DEBUG });
  var runner    = new CommandRunner({
    executor:  createNodeExecutor({ debug: DEBUG }),
    debug:     DEBUG,
  });
  factory._pipeline.workspace = workspace;
  factory._pipeline.runner    = runner;
  // Päivitä myös phaseiden adapterit
  var phases = factory._pipeline._phases || {};
  ["TEMPLATE","SYNTHESIZE","DEPS","BUILD","VALIDATE","SECURITY","PACKAGE"].forEach(function(p) {
    if (phases[p]) {
      if (phases[p]._workspace !== undefined) phases[p]._workspace = workspace;
      if (phases[p]._runner    !== undefined) phases[p]._runner    = runner;
    }
  });
}




























// ── Ghost Vault production check ─────────────────────────────────────────────
// productionissa GUARDIAN_HMAC_SECRET pakollinen
// developmentissa varoitus riittaa
(function() {
  var secret = process.env.GUARDIAN_HMAC_SECRET;
  var isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      console.error("[FATAL] GUARDIAN_HMAC_SECRET puuttuu — Ghost Vault vaatii sen productionissa.");
      process.exit(1);
    } else {
      // Dev-moodi: generoi automaattinen secret ja tallenna .env:ään
      try {
        var _crypto2   = crypto;
        var _newSecret = _crypto2.randomBytes(32).toString("hex");
        process.env.GUARDIAN_HMAC_SECRET = _newSecret;
        // Lisää .env-tiedostoon
        var _envFile = path.join(process.cwd(), ".env");
        if (existsSync(_envFile)) {
          appendFileSync(_envFile, "\nGUARDIAN_HMAC_SECRET=" + _newSecret + "\n", "utf8");
          
        } else {
        }
      } catch (_ge) {
        console.warn("[ghost-vault] Secret-generointi epäonnistui:", _ge.message);
      }
    }
  }
})();

// ── Published-kansion automaattinen siivous ─────────────────────────────────
// Pitää max 20 viimeisintä releasea — poistaa vanhimmat
(function cleanupPublished() {
  try {
    var pubDir = path.resolve(process.cwd(), "published");
    if (!existsSync(pubDir)) return;
    var items = fs.readdirSync(pubDir);
    // Ryhmitä zip-tiedostojen mukaan (jokainen release = kansio + .zip)
    var zips = items
      .filter(function(f) { return f.endsWith(".zip"); })
      .map(function(f) {
        var fp = path.join(pubDir, f);
        return { name: f, mtime: fs.statSync(fp).mtimeMs, base: f.replace(".zip","") };
      })
      .sort(function(a, b) { return b.mtime - a.mtime; }); // uusin ensin

    var MAX_RELEASES = parseInt(process.env.ALX_MAX_RELEASES || "20", 10);
    var toDelete = zips.slice(MAX_RELEASES);

    if (toDelete.length > 0) {
      
      for (var rel of toDelete) {
        try {
          var zipFile = path.join(pubDir, rel.name);
          var relDir  = path.join(pubDir, rel.base);
          if (existsSync(zipFile)) fs.unlinkSync(zipFile);
          if (existsSync(relDir))  fs.rmSync(relDir, { recursive: true, force: true });
        } catch (_) {}
      }
    }
  } catch (_) {}
})();

// ── Security audit log ───────────────────────────────────────────────────────
// Kirjaa kriittiset reitit structured JSON-lokiin.
// Eri kuin middleware/logger.js (joka kirjaa kaikki) — tämä on security audit.

var _audit_critical = new Set(["/execute","/build","/publish",
  "/workspace/save","/ollama/chat","/vault/save","/candidate/approve","/energy/profile"]);

function securityAudit(req, status, meta) {
  if (!_audit_critical.has((req.url || "").split("?")[0])) return;
  var entry = {
    ts:      new Date().toISOString(),
    event:   "SECURITY_AUDIT",
    method:  req.method,
    url:     req.url,
    status:  status,
    ip:      req.socket ? req.socket.remoteAddress : "unknown",
    reqId:   req.headers["x-request-id"] || null,
    auth:    !!process.env.ALX_API_TOKEN ? checkAuth(req) : "no-auth",
    ...( meta || {} )
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Rate limiter ─────────────────────────────────────────────────────────────
// Yksinkertainen in-memory rate limit per IP.
// ENV: ALX_RATE_LIMIT = max pyyntöä per minuutti (oletus: 60)
// Kriittiset reitit (/execute, /build, /publish, /ollama/chat): tiukempi raja.

var _rl_window   = 60 * 1000;  // 1 minuutti
var _rl_default  = parseInt(process.env.ALX_RATE_LIMIT        || "60",  10);
var _rl_critical = parseInt(process.env.ALX_RATE_LIMIT_STRICT || "20",  10);
var _rl_map      = new Map();   // ip → { count, resetAt }

// Siivoa vanhentuneet entryt 5min välein
setInterval(function() {
  var now = Date.now();
  _rl_map.forEach(function(v, k) { if (v.resetAt < now) _rl_map.delete(k); });
}, 5 * 60 * 1000);

// Exact-match routes that count against the strict rate limit
var _critical_routes = ["/execute", "/build", "/publish", "/workspace/save", "/ollama/chat"];
// Prefix-match routes — used for RBX surfaces that carry path params
// (preview/:buildId, download/:zipName). PDF readiness-gate: /rbx/build,
// /rbx/download, /rbx/preview, /rbx/exports under strict rate limit.
var _critical_prefixes = ["/rbx/build", "/rbx/lua-build", "/rbx/lua-parse", "/rbx/preview", "/rbx/audit", "/rbx/download", "/rbx/exports"];

function _isCriticalPath(url) {
  if (_critical_routes.includes(url)) return true;
  for (var i = 0; i < _critical_prefixes.length; i++) {
    if (url === _critical_prefixes[i] || url.startsWith(_critical_prefixes[i] + "/")) return true;
  }
  return false;
}

function checkRateLimit(req) {
  var ip    = req.socket.remoteAddress || "unknown";
  var url   = (req.url || "").split("?")[0];
  var limit = _isCriticalPath(url) ? _rl_critical : _rl_default;
  var now   = Date.now();
  var entry = _rl_map.get(ip);
  if (!entry || entry.resetAt < now) {
    _rl_map.set(ip, { count: 1, resetAt: now + _rl_window });
    return { ok: true, remaining: limit - 1 };
  }
  entry.count++;
  if (entry.count > limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - entry.count };
}

// ── Body size limit ───────────────────────────────────────────────────────────
// Max body koko per reitti.
// /ollama/chat/file saa enemmän (tiedosto-upload).
var _MAX_BODY     = parseInt(process.env.ALX_MAX_BODY_BYTES || String(512 * 1024), 10); // 512 KB
var _MAX_BODY_FILE = 2 * 1024 * 1024; // 2 MB (tiedostoille)

function readBody(req, maxBytes) {
  var limit = maxBytes || _MAX_BODY;
  return new Promise(function(resolve, reject) {
    var chunks = [];
    var total  = 0;
    req.on("data", function(ch) {
      total += ch.length;
      if (total > limit) {
        req.destroy();
        return reject(new Error("Request body liian suuri (max " + Math.round(limit/1024) + " KB)"));
      }
      chunks.push(ch);
    });
    req.on("end",  function()  {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); }
      catch (e) { resolve({}); }
    });
    req.on("error", reject);
  });
}

function send(res, status, data) {
  var body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "Content-Type":   "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin":  process.env.ALX_CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-ALX-Token, Authorization, X-Request-Id",
  });
  res.end(body);
}

// ── Server ────────────────────────────────────────────────────────────────────
var server = http.createServer(async function(req, res) {
  var method = req.method;
  var url    = req.url.split("?")[0];

  try {

    // ── Rate limiting ───────────────────────────────────────
    var rl = checkRateLimit(req);
    if (!rl.ok) {
      res.writeHead(429, {
        "Content-Type": "application/json",
        "Retry-After":  String(rl.retryAfter || 60),
        "Access-Control-Allow-Origin": process.env.ALX_CORS_ORIGIN || "*",
      });
      return res.end(JSON.stringify({
        ok: false, error: "Rate limit ylitetty", retryAfter: rl.retryAfter
      }));
    }

    // ── Auth — pakollinen jos ALX_API_TOKEN asetettu ────────
    // Prodissa: aseta ALX_API_TOKEN .env:ään
    if (method !== "OPTIONS" && url !== "/health") {
      if (!checkAuth(req)) {
        return send(res, 401, { ok: false, error: "Unauthorized — X-ALX-Token puuttuu tai virheellinen" });
      }
    }

    // OPTIONS preflight — CORS
    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin":  process.env.ALX_CORS_ORIGIN || "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-ALX-Token, Authorization, X-Request-Id",
        "Access-Control-Max-Age": "86400",
      });
      return res.end();
    }

    // GET /health
    if (method === "GET" && url === "/health") {
      var mem = orch.getCoreMemory();
      return send(res, 200, {
        status:     "ok",
        version:    "1.0.0",
        session:    bootResult.sessionId,
        factory:    factory ? factory.getState() : "none",
        llm:        orch.cfg.llmEnabled ? orch.cfg.llmModel : "disabled",
        memory:     mem ? mem.getStats().totalEntries + " entries" : "none",
        workspace:  "node-fs",
        uptime:     Math.floor(process.uptime()) + "s",
        ts:         new Date().toISOString(),
      });
    }

    // GET /detect/status — Code Type Detector
    if (method === "GET" && url === "/detect/status") {
      return handleDetectStatus(req, res, send);
    }

    // POST /detect/project — Code Type Detector
    if (method === "POST" && url === "/detect/project") {
      return handleDetectProject(req, res, send, readBody);
    }

    // GET /preview/status — Preview Router
    if (method === "GET" && url === "/preview/status") {
      return handlePreviewStatus(req, res, send);
    }

    // POST /preview/project — Preview Router
    if (method === "POST" && url === "/preview/project") {
      return handlePreviewProject(req, res, send, readBody);
    }

    // GET /preview/business-wallet — Premium BusinessWallet live-preview-safe template
    if (method === "GET" && url === "/preview/business-wallet") {
      return handleBusinessWalletPreview(req, res, send);
    }

    // GET /energy/status
    if (method === "GET" && url === "/energy/status") {
      updateEnergyTelemetry();
      return send(res, 200, {
        ok: true,
        energy: energyRing.getStatus(),
      });
    }

    // POST /energy/profile/:profile
    if (method === "POST" && url.startsWith("/energy/profile/")) {
      var profile = decodeURIComponent(url.replace("/energy/profile/", "")).toUpperCase();
      var changed = energyRing.setProfile(profile);
      updateEnergyTelemetry();
      securityAudit(req, changed ? 200 : 400, { profile: profile });
      return send(res, changed ? 200 : 400, {
        ok: changed,
        activeProfile: energyRing.getProfileName(),
        requestedProfile: profile,
        availableProfiles: energyRing.getProfiles(),
        energy: energyRing.getStatus(),
        error: changed ? undefined : "Tuntematon Energy Ring profile",
      });
    }

    // GET /status
    if (method === "GET" && url === "/status") {
      var factStats = factory ? factory.getStats()   : null;
      var factState = factory ? factory.getState()   : "none";
      var factWrks  = factory ? factory.getWorkers() : {};
      return send(res, 200, {
        orchestrator: {
          state:    orch._state,
          session:  bootResult.sessionId,
          commands: orch._commandCount || 0,
        },
        factory: {
          state:   factState,
          stats:   factStats,
          workers: Object.keys(factWrks),
        },
        adapters: {
          workspace: "WorkspaceAdapterNode v2.0.0",
          executor:  "NodeExecutor v2.0.0",
        },
      });
    }

    // GET /memory
    if (method === "GET" && url === "/memory") {
      mem = orch.getCoreMemory();
      if (!mem) return send(res, 404, { error: "CoreMemory ei ole saatavilla" });
      var stats = mem.getStats();
      var verify = mem.verify();
      return send(res, 200, {
        stats:  stats,
        verify: { valid: verify.valid, errors: verify.errors ? verify.errors.length : 0 },
        recent: {
          episodic:   mem.getRecent("episodic",   5).map(function(e) { return { ts: e.timestamp, tags: e.tags }; }),
          procedural: mem.getRecent("procedural", 3).map(function(e) { return { ts: e.timestamp, tags: e.tags }; }),
        },
      });
    }

    // POST /execute
    if (method === "POST" && url === "/execute") {
      var body = await readBody(req);
      if (!body.input) return send(res, 400, { error: "input puuttuu" });
      activeJobs++;
      var executeStartedAt = Date.now();
      logEnergyThrottle("/execute");
      try {
        var result = await orch.execute(body.input, body.ctx || {});
        buildLatency = Date.now() - executeStartedAt;
        updateEnergyTelemetry();
        securityAudit(req, result.ok === false ? 422 : 200, { intent: result.intent, energyProfile: energyRing.getProfileName() });
        return send(res, 200, Object.assign({}, result, { energy: energyRing.getStatus() }));
      } finally {
        activeJobs = Math.max(0, activeJobs - 1);
        updateEnergyTelemetry();
      }
    }

    // POST /build
    if (method === "POST" && url === "/build") {
      body = await readBody(req);
      if (!body.name) return send(res, 400, { error: "name puuttuu" });
      if (!factory)   return send(res, 503, { error: "Factory ei ole saatavilla" });

      activeJobs++;
      var t0 = Date.now();
      logEnergyThrottle("/build");
      try {
        result = await factory.handleCommand({
          intent: "BUILD_PROJECT",
          target: body.target || "expo-app",
          spec: {
            name:        body.name,
            description: body.description || "",
            language:    body.language    || "javascript",
            features:    body.features    || [],
          },
        });
        buildLatency = Date.now() - t0;
      } finally {
        activeJobs = Math.max(0, activeJobs - 1);
        updateEnergyTelemetry({ latency: Date.now() - t0 });
      }

      // Lisää workspaceDir ja projectId vastaukseen — Factory Proof E2E tarvitsee ne
      var wsRoot    = process.env.ALX_WORKSPACE_ROOT || ".af51-workspaces";
      var specName  = body.name ? body.name.replace(/[^a-z0-9_-]/gi, "-").toLowerCase() : null;
      var wsDir     = null;
      if (specName) {
        var _path2 = await import("path");
        var _fs2   = await import("fs");
        var wsBase = _path2.default.resolve(process.cwd(), wsRoot);
        // Etsi kansio jonka nimi alkaa specNamella
        if (_fs2.default.existsSync(wsBase)) {
          var dirs = _fs2.default.readdirSync(wsBase);
          var match = dirs.find(function(d) { return d.startsWith(specName.slice(0, 12)); });
          if (match) wsDir = _path2.default.join(wsBase, match);
        }
      }
      var buildStatus = result.ok ? 200 : 422;
      securityAudit(req, buildStatus, { projectId: specName, target: body.target });
      return send(res, buildStatus, Object.assign({}, result, {
        buildTimeMs: Date.now() - t0,
        projectId:   specName,
        workspaceDir: wsDir,
        energy: energyRing.getStatus(),
      }));
    }


    // ── RBX LUA PARSE ROUTE — deterministic Lua → object graph ────────────
    // POST /rbx/lua-parse → { source }
    // Translates Roblox Lua patterns into preview objects. NO execution, NO VM.
    if (method === "POST" && url === "/rbx/lua-parse") {
      body = await readBody(req);
      var luaSource = body.source || "";
      if (!luaSource || typeof luaSource !== "string") {
        return send(res, 400, { ok: false, error: "Missing 'source' string" });
      }
      try {
        var lp = await import("./runtime/rbx-runtime/LuaParser.js");
        var ig = await import("./runtime/rbx-runtime/InstanceGraphBuilder.js");
        var pr = await import("./runtime/rbx-runtime/PreviewRenderer.js");
        var ast    = new lp.LuaParser().parse(luaSource);
        var graph  = new ig.InstanceGraphBuilder().build(ast);
        var render = new pr.PreviewRenderer().render(graph);
        return send(res, 200, {
          ok: true,
          isLuaMode: graph.nodes.length > 0,
          objectCount: graph.nodes.length,
          objects: graph.nodes,
          preview: {
            schemaVersion: "1.0.0",
            source: "lua-object-graph",
            structures: render.structures,
            lighting: { ambient: "#0F0F1A", sky: "#06080F", fogColor: "#080814", neonColor: "#25D0FF" },
            camera: { viewX: 10, viewZ: 8, rotation: "slow_orbit", elevation: 30 },
          },
        });
      } catch (e) {
        return send(res, 500, { ok: false, error: e.message });
      }
    }

    // ── RBX LUA BUILD ROUTE — user Lua → Studio-ready ZIP ─────────────────
    // POST /rbx/lua-build → { source, projectName?, scriptName? }
    // Parses user Lua, builds Rojo project, produces downloadable ZIP.
    if (method === "POST" && url === "/rbx/lua-build") {
      body = await readBody(req);
      var ubSource = body.source || "";
      if (!ubSource || typeof ubSource !== "string") {
        return send(res, 400, { ok: false, error: "Missing 'source' string" });
      }
      try {
        var lpb = await import("./runtime/rbx-runtime/LuaProjectBuilder.js");
        var built = await new lpb.LuaProjectBuilder().build(ubSource, {
          projectName: body.projectName || "AF51-RBX-Project",
          scriptName:  body.scriptName  || "Main",
          exportsDir:  EXPORTS_DIR,
        });
        if (!built.ok) return send(res, 400, { ok: false, error: built.error });
        return send(res, 200, {
          ok: true,
          buildId:      built.buildId,
          zipName:      built.zipName,
          downloadUrl:  "/rbx/download/" + built.zipName,
          fileCount:    built.fileCount,
          instanceCount: built.instanceCount,
          routing:      built.routing,
          signature:    built.signature,
          previewData:  built.preview,
          enriched:     built.enriched,   // Preview Director — technical understanding
          design:       built.design,     // Creative Director — design report
          studio:       built.studio,     // Studio Director — production readiness
          shots:        built.shots,      // Cinematic Director — camera shot list
          packageType:  built.packageType,
          runtimeTruth: built.runtimeTruth,
          previewType:  built.previewType,
          runtimeEvents: built.runtimeEvents,
          runtimeVerification: built.runtimeVerification,
          quality:      built.quality,
        });
      } catch (e) {
        return send(res, 500, { ok: false, error: e.message });
      }
    }

    // ── RBX BUILD ROUTE — Roblox-native ZIP pipeline ──────────────────────
    // POST /rbx/build → { targetId, profileId, source? }
    // Routes through RobloxOrchestrator — all 11 phases
    if (method === "POST" && url === "/rbx/build") {
      body = await readBody(req);
      var rbxTargetId  = body.targetId;   // no default — validate explicitly below
      var rbxProfileId = body.profileId || "development";

      var validRbxTargets = ["obby","tycoon","simulator","rpg","fps"];
      var validProfiles   = ["development","production","creator","marketplace"];

      // Validate targetId
      if (!rbxTargetId || typeof rbxTargetId !== "string" || !validRbxTargets.includes(rbxTargetId)) {
        return send(res, 400, { ok: false, error: "Unknown RBX target: " + String(rbxTargetId) + ". Valid: " + validRbxTargets.join(", ") });
      }
      // Validate profileId (fallback to development if unknown, but flag it)
      if (rbxProfileId && !validProfiles.includes(rbxProfileId)) {
        rbxProfileId = "development"; // safe fallback
      }

      var t0rbx = Date.now();
      try {
        var { RobloxOrchestrator, INTENT } = await import("./m2/roblox/roblox-orchestrator.js");
        var { RobloxTargetResolver }       = await import("./m2/roblox/roblox-target-resolver.js");
        var { RobloxPackageManager }       = await import("./m2/roblox/roblox-package-manager.js");

        var rbxAudit = {
          log:      (e,l) => console.log("  [RBX][" + (l||"INFO") + "] " + e),
          debug:    m => console.log("  [RBX][DEBUG] " + m),
          info:     m => console.log("  [RBX][INFO ] " + m),
          warn:     m => console.warn("  [RBX][WARN ] " + m),
          error:    m => console.error("  [RBX][ERROR] " + m),
          critical: m => console.error("  [RBX][CRIT ] " + m),
        };

        var rbxRoot = process.cwd();
        // v63/v2 — Route the build by detecting Lua input vs target prompt.
        // The detector lives in m2/roblox/lua-input-detector.js so the CLI
        // and HTTP server share one classifier. Lua source becomes
        // intent.userSource and is preserved verbatim as
        // src/ServerScriptService/AF51UserSeed.server.lua inside the ZIP —
        // the AF51 SceneBuilder still emits the target world ON TOP, the
        // user code runs alongside (never gets flattened away).
        var { routeBuildRequest } = await import("./m2/roblox/lua-input-detector.js");
        var rbxRoute = routeBuildRequest({ source: body.source, targetId: rbxTargetId });
        var rbxUserSource = rbxRoute.userSource;
        if (rbxRoute.route === "LUA_IMPORT_BUILD") {
          rbxAudit.info("LUA_IMPORT_BUILD route — " + rbxRoute.detection.summary);
        }
        var rbxResult = await RobloxOrchestrator.process(
          { type: INTENT.BUILD, targetId: rbxTargetId, profileId: rbxProfileId, userSource: rbxUserSource },
          {
            targetsDir:   rbxRoot + "/targets",
            profilesDir:  rbxRoot + "/packageProfiles",
            exportsDir:   rbxRoot + "/exports-rbx",
            auditLedger:  rbxAudit,
          }
        );

        var durationMs = Date.now() - t0rbx;
        rbxAudit.info("RBX build complete — " + rbxTargetId + " (" + durationMs + "ms)");

        // Read generatedPreview.json if present
        var rbxPreviewData = null;
        if (rbxResult.ok && rbxResult.zipPath) {
          try {
            var { readFileSync: _rfs, existsSync: _ex } = await import("fs");
            var { join: _j } = await import("path");
            // The tmp buildRoot is gone — preview is IN the ZIP
            // Return null; frontend generates preview client-side from generatePreviewHTML()
          } catch (_pe) {}
        }

        // v63 — prefer production-scenegraph.json (full v62 masterpiece graph,
        // tier-tagged, with rule tags). Fall back to generatedPreview.json only
        // if scenegraph is missing. Also pulls production-quality-report.json
        // so the UI can show QualityScore + tier coverage + rule satisfaction.
        var rbxZipSize = 0, rbxPreviewData = null, rbxQualityReport = null;
        if (rbxResult.zipPath) {
          try {
            var { statSync: _rss, existsSync: _rex } = await import("fs");
            if (_rex(rbxResult.zipPath)) rbxZipSize = _rss(rbxResult.zipPath).size;
            // Pure-Node ZIP reader (no `unzip` binary dependency). Falls
            // back to system unzip only if the pure-Node path fails.
            var _zr = await import("./t3/roblox-rbx/zip-reader.js");
            var _readFromZip = async function(name) {
              try { return _zr.readZipEntry(rbxResult.zipPath, name).toString("utf8"); }
              catch (_nodeErr) {
                var { execFile: _ef } = await import("child_process");
                var { promisify: _pp } = await import("util");
                var r = await _pp(_ef)("unzip", ["-p", rbxResult.zipPath, name]);
                return r.stdout;
              }
            };
            // Try scenegraph first.
            try {
              rbxPreviewData = JSON.parse(await _readFromZip("production-scenegraph.json"));
            } catch (_) {
              // Fallback for older builds.
              try { rbxPreviewData = JSON.parse(await _readFromZip("generatedPreview.json")); }
              catch (__) {}
            }
            // Quality report ride-along.
            try { rbxQualityReport = JSON.parse(await _readFromZip("production-quality-report.json")); }
            catch (_) {}
          } catch (_) {}
        }

        // Platform-safe basename: split on BOTH / and \\ (Windows + Unix)
        var rbxZipName = rbxResult.zipPath ? rbxResult.zipPath.split(/[\\/]/).pop() : null;
        return send(res, rbxResult.ok ? 200 : 422, {
          ok:           rbxResult.ok,
          buildId:      rbxResult.buildId,
          ghostId:      rbxResult.ghostId      || (rbxResult.result && rbxResult.result.ghostId)      || null,
          artifactHash: rbxResult.artifactHash || (rbxResult.result && rbxResult.result.artifactHash) || null,
          zipPath:      rbxResult.zipPath,
          zipName:      rbxZipName,
          zipSizeBytes: rbxZipSize,
          targetId:     rbxTargetId,
          profileId:    rbxProfileId,
          durationMs,
          phases:       rbxResult.result ? rbxResult.result.phases.length : 0,
          phasesDetail: rbxResult.result ? rbxResult.result.phases : [],
          previewData:  rbxPreviewData,      // production-scenegraph.json (preferred) or generatedPreview.json fallback
          qualityReport: rbxQualityReport,   // production-quality-report.json (v62 QualityGate V3)
          error:        rbxResult.error  || null,
          errors:       rbxResult.errors || [],
          downloadUrl:  rbxZipName ? ("/rbx/download/" + rbxZipName) : null,
          // v2 — explicit build-route metadata so callers can confirm
          // their Lua input was preserved (never silently flattened away).
          buildRoute:   rbxRoute.route,
          inputDetection: {
            isLua:    rbxRoute.detection.isLua,
            score:    rbxRoute.detection.score,
            signals:  rbxRoute.detection.signals,
            summary:  rbxRoute.detection.summary,
            preservedAt: rbxRoute.route === "LUA_IMPORT_BUILD"
              ? "src/ServerScriptService/AF51UserSeed.server.lua"
              : null,
          },
        });
      } catch (rbxErr) {
        console.error("[RBX] Build exception:", rbxErr.message);
        return send(res, 500, { ok: false, error: rbxErr.message, targetId: rbxTargetId });
      }
    }

    // ── RBX LIST ROUTE ──────────────────────────────────────────────────────
    // GET /rbx/list → available targets and profiles
    if (method === "GET" && url === "/rbx/list") {
      try {
        var { RobloxTargetResolver: RTR } = await import("./m2/roblox/roblox-target-resolver.js");
        var { RobloxPackageManager: RPM } = await import("./m2/roblox/roblox-package-manager.js");
        var rbxRoot2 = process.cwd();
        return send(res, 200, {
          ok:       true,
          targets:  RTR.listTargets(rbxRoot2 + "/targets"),
          profiles: RPM.listProfiles(rbxRoot2 + "/packageProfiles"),
        });
      } catch (e) {
        return send(res, 500, { ok: false, error: e.message });
      }
    }


    // ── RBX ZIP DOWNLOAD — stream Roblox-native ZIP to browser ────────────
    // GET /rbx/download/:filename → streams the ZIP file
    if (method === "GET" && url.startsWith("/rbx/download/")) {
      var rbxFilename = url.replace("/rbx/download/", "").split("?")[0];

      // Security: only allow valid AF51-RBX zip filenames
      if (!/^AF51-RBX-[A-Za-z0-9_-]+\.zip$/.test(rbxFilename)) {
        return send(res, 400, { ok: false, error: "Invalid filename: " + rbxFilename });
      }

      var { existsSync, createReadStream, statSync } = await import("fs");
      var { join } = await import("path");

      var rbxZipPath = join(process.cwd(), "exports-rbx", rbxFilename);

      if (!existsSync(rbxZipPath)) {
        // Try to find any ZIP for this target
        var { readdirSync } = await import("fs");
        var rbxDir = join(process.cwd(), "exports-rbx");
        var available = existsSync(rbxDir) ? readdirSync(rbxDir).filter(f => f.endsWith(".zip")) : [];
        return send(res, 404, {
          ok: false,
          error: "ZIP not found: " + rbxFilename,
          available: available,
        });
      }

      var rbxZipStat = statSync(rbxZipPath);

      res.setHeader("Content-Type",        "application/zip");
      res.setHeader("Content-Length",      rbxZipStat.size.toString());
      // RFC 6266 — both filename and filename* for max browser compat
      res.setHeader("Content-Disposition",
        "attachment; filename=\"" + rbxFilename + "\"; filename*=UTF-8''" + encodeURIComponent(rbxFilename));
      res.setHeader("Cache-Control",       "no-cache");
      res.setHeader("Access-Control-Allow-Origin", "*");

      var rbxStream = createReadStream(rbxZipPath);
      rbxStream.on("error", function(err) {
        console.error("[RBX] Stream error:", err.message);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end();
        }
      });
      rbxStream.pipe(res);
      return; // Don't call send() — stream handles the response
    }


    // ── RBX PREVIEW DATA — serve generatedPreview.json for a build ─────────
    // GET /rbx/preview/:buildId → returns generatedPreview.json schema
    // Frontend uses this to synchronize preview canvas with artifact reality
    if (method === "GET" && url.startsWith("/rbx/preview/")) {
      var previewBuildId = url.replace("/rbx/preview/", "").split("?")[0];

      if (!previewBuildId || previewBuildId.length < 5) {
        return send(res, 400, { ok: false, error: "buildId required" });
      }

      var { existsSync: _pEx, readdirSync: _pRd } = await import("fs");
      var { join: _pJ } = await import("path");
      var exportsDir = _pJ(process.cwd(), "exports-rbx");

      // Find the ZIP matching this buildId
      var matchingZip = null;
      if (_pEx(exportsDir)) {
        var zipFiles = _pRd(exportsDir).filter(f => f.endsWith(".zip") && f.includes(previewBuildId));
        if (zipFiles.length > 0) matchingZip = _pJ(exportsDir, zipFiles[0]);
      }

      if (!matchingZip) {
        return send(res, 404, { ok: false, error: "No ZIP found for buildId: " + previewBuildId });
      }

      // Extract generatedPreview.json from ZIP. Prefer pure-Node reader so
      // the route works on platforms without an `unzip` binary on PATH;
      // fall back to the system binary if the pure-Node reader fails.
      try {
        var preview = null;
        try {
          var { readZipEntry: _pRead } = await import("./t3/roblox-rbx/zip-reader.js");
          var _pBuf = _pRead(matchingZip, "generatedPreview.json");
          preview = JSON.parse(_pBuf.toString("utf8"));
        } catch (_pNodeErr) {
          var { execFile: _pExec } = await import("child_process");
          var { promisify: _pProm } = await import("util");
          var execAsync = _pProm(_pExec);
          var { stdout } = await execAsync("unzip", ["-p", matchingZip, "generatedPreview.json"]);
          preview = JSON.parse(stdout);
        }
        return send(res, 200, { ok: true, preview });
      } catch (e) {
        return send(res, 500, { ok: false, error: "Could not read preview: " + e.message });
      }
    }

    // ── RBX AUDIT STREAM — SSE-paced replay of an existing build's audit ───
    // GET /rbx/audit/stream/<buildId>?pacingMs=80 → Server-Sent Events.
    // Reads the same payload as /rbx/audit/<buildId> from the ZIP and emits:
    //   event: meta    → { traceId, total, intent, ledger, energy, world }
    //   event: record  → one PipelineAudit record at a time
    //   event: done    → { total }
    //   event: error   → { message }
    // Replay invariant: the final RingRuntime snapshot is identical to the
    // one /rbx/audit returns. Pacing is purely visual; the factory itself
    // remains atomic and untouched. MUST sit before the /rbx/audit/ handler
    // because url.startsWith("/rbx/audit/") would otherwise swallow this.
    if (method === "GET" && url.startsWith("/rbx/audit/stream/")) {
      var streamBuildId = url.replace("/rbx/audit/stream/", "").split("?")[0];

      // buildId must be a safe identifier: length 5..128 and only the chars
      // used by trace IDs (letters/digits/_/-). Rejects path traversal,
      // separators and any URL-encoded shenanigans before they touch fs.
      if (!streamBuildId || streamBuildId.length < 5 || streamBuildId.length > 128) {
        return send(res, 400, { ok: false, error: "buildId required" });
      }
      if (!/^[A-Za-z0-9_-]+$/.test(streamBuildId)) {
        return send(res, 400, { ok: false, error: "buildId contains invalid characters" });
      }

      // pacingMs: parse defensively, drop NaN/Infinity, then clamp 0..2000.
      var streamPacingMs = 80;
      var streamQuery = (req.url.indexOf("?") !== -1) ? req.url.split("?")[1] : "";
      var streamPacingMatch = streamQuery.match(/pacingMs=(\d+)/);
      if (streamPacingMatch) {
        var _streamParsed = parseInt(streamPacingMatch[1], 10);
        if (Number.isFinite(_streamParsed)) {
          streamPacingMs = Math.min(2000, Math.max(0, _streamParsed));
        }
      }

      var { existsSync: _sEx, readdirSync: _sRd, statSync: _sStat } = await import("fs");
      var { join: _sJ } = await import("path");
      var streamExportsDir = _sJ(process.cwd(), "exports-rbx");

      var streamZip = null;
      if (_sEx(streamExportsDir)) {
        var sZips = _sRd(streamExportsDir).filter(function (f) {
          return f.endsWith(".zip") && f.indexOf(streamBuildId) !== -1;
        });
        if (sZips.length > 0) streamZip = _sJ(streamExportsDir, sZips[0]);
      }
      if (!streamZip) {
        return send(res, 404, { ok: false, error: "No ZIP found for buildId: " + streamBuildId });
      }

      res.writeHead(200, {
        "Content-Type":                 "text/event-stream",
        "Cache-Control":                "no-cache, no-transform",
        "Connection":                   "keep-alive",
        "X-Accel-Buffering":            "no",
        "Access-Control-Allow-Origin":  process.env.ALX_CORS_ORIGIN || "*",
        "Access-Control-Allow-Headers": "Content-Type, X-ALX-Token, Authorization, X-Request-Id",
      });
      function _sse(type, data) {
        try {
          res.write("event: " + type + "\n");
          res.write("data: " + JSON.stringify(data) + "\n\n");
        } catch (_) {}
      }

      try {
        var { readZipEntry: _sRead, listZipEntries: _sList } = await import("./t3/roblox-rbx/zip-reader.js");
        function _sReadEntry(name) {
          try { return _sRead(streamZip, name).toString("utf8"); }
          catch (_) { return null; }
        }

        var sAuditRaw = _sReadEntry("production-pipeline-audit.json");
        if (!sAuditRaw) {
          _sse("error", { message: "production-pipeline-audit.json missing" });
          res.end();
          return;
        }
        var sAuditData = JSON.parse(sAuditRaw);
        var sRecords = Array.isArray(sAuditData.records) ? sAuditData.records : [];

        // Ride-along metadata: mirror /rbx/audit/<buildId> field-for-field so
        // the live SSE stream's final RingRuntime snapshot is byte-identical
        // to the replayed one (Replay Invariant).
        var sManifestRaw = _sReadEntry("manifest.json");
        var sQualityRaw  = _sReadEntry("production-quality-report.json");
        var sLineageRaw  = _sReadEntry("ghost/lineage.json");

        var sIntent = null;
        try {
          if (sManifestRaw || sQualityRaw) {
            var _sm = sManifestRaw ? JSON.parse(sManifestRaw) : {};
            var _sq = sQualityRaw  ? JSON.parse(sQualityRaw)  : {};
            sIntent = {
              targetId:     _sm.targetId     || null,
              targetType:   _sm.targetType   || _sq.type || null,
              gameName:     _sm.gameName     || null,
              version:      _sm.version      || null,
              qualityScore: typeof _sq.qualityScore === "number" ? _sq.qualityScore : null,
              qualityPass:  _sq.pass === true,
              rules: _sq.rules ? {
                total:     _sq.rules.total     || 0,
                satisfied: _sq.rules.satisfied || 0,
                identity:  _sq.rules.identity  || null,
              } : null,
              criticals: Array.isArray(_sq.criticals) ? _sq.criticals.length : 0,
              warnings:  Array.isArray(_sq.warnings)  ? _sq.warnings.length  : 0,
            };
          }
        } catch (_sIntentErr) { /* intent is optional */ }

        var sLedger = null;
        try {
          if (sLineageRaw) {
            var _sl = JSON.parse(sLineageRaw);
            sLedger = {
              ghostId:         _sl.ghostId         || null,
              artifactId:      _sl.artifactId      || null,
              project:         _sl.project         || null,
              version:         _sl.version         || null,
              parentCapsuleId: _sl.parentCapsuleId || null,
              buildGeneration: typeof _sl.buildGeneration === "number" ? _sl.buildGeneration : null,
              mutationSource:  _sl.mutationSource  || null,
              repairCount:     Array.isArray(_sl.repairHistory) ? _sl.repairHistory.length : 0,
              layerCount:      _sl.layers && typeof _sl.layers === "object" ? Object.keys(_sl.layers).length : 0,
              auditHash:       _sl.auditHash       || null,
              createdAt:       typeof _sl.createdAt === "number" ? _sl.createdAt : null,
              sealedAt:        typeof _sl.sealedAt  === "number" ? _sl.sealedAt  : null,
            };
          }
        } catch (_sLedgerErr) { /* ledger is optional */ }

        var sEnergy = null;
        try {
          var _sZipSize = 0;
          try { _sZipSize = _sStat(streamZip).size; } catch (_) {}
          var _sRecCount = sRecords.length;
          var _sRuntimeMods = 0;
          try {
            if (sManifestRaw) {
              var _smm = JSON.parse(sManifestRaw);
              if (_smm.runtime && Array.isArray(_smm.runtime.modules)) _sRuntimeMods = _smm.runtime.modules.length;
            }
          } catch (_) {}
          var _sEntries = 0;
          try { _sEntries = _sList(streamZip).length; } catch (_) {}
          var _sDur = null;
          try {
            if (sLineageRaw) {
              var _sll = JSON.parse(sLineageRaw);
              if (typeof _sll.buildDuration === "number") _sDur = _sll.buildDuration;
            }
          } catch (_) {}
          sEnergy = {
            buildDuration:  _sDur,
            zipSize:        _sZipSize,
            recordCount:    _sRecCount,
            runtimeModules: _sRuntimeMods,
            entryCount:     _sEntries,
          };
        } catch (_sEnergyErr) { /* energy is optional */ }

        var sWorld = null;
        try {
          if (sManifestRaw) {
            var _swm = JSON.parse(sManifestRaw);
            sWorld = {
              factory:          _swm.factory          || null,
              rojo:             _swm.rojo             || null,
              robloxCompatible: typeof _swm.robloxCompatible === "boolean" ? _swm.robloxCompatible : null,
              signedAt:         _swm.signedAt         || null,
              masterHash:       _swm.masterHash       || null,
            };
          }
        } catch (_sWorldErr) { /* world is optional */ }

        _sse("meta", {
          traceId: sAuditData.traceId || null,
          total:   sRecords.length,
          intent:  sIntent,
          ledger:  sLedger,
          energy:  sEnergy,
          world:   sWorld,
        });

        // Track the pending timer so a client disconnect cancels it instead
        // of letting it fire and walk through a closed response.
        var sIdx = 0;
        var sClosed = false;
        var sTimer = null;
        req.on("close", function () {
          sClosed = true;
          if (sTimer !== null) { clearTimeout(sTimer); sTimer = null; }
        });

        function _sPushNext() {
          sTimer = null;
          if (sClosed) return;
          if (sIdx >= sRecords.length) {
            _sse("done", { total: sRecords.length });
            try { res.end(); } catch (_) {}
            return;
          }
          _sse("record", sRecords[sIdx]);
          sIdx++;
          if (streamPacingMs === 0) setImmediate(_sPushNext);
          else                      sTimer = setTimeout(_sPushNext, streamPacingMs);
        }
        _sPushNext();
        return;
      } catch (e) {
        _sse("error", { message: e && e.message ? e.message : String(e) });
        try { res.end(); } catch (_) {}
        return;
      }
    }

    // ── RBX AUDIT — read-only — FutureMachine replay invariant ─────────────
    // GET /rbx/audit/<buildId> → PipelineAudit records from the ZIP.
    // Mirrors /rbx/preview/<buildId> exactly; only the entry name differs.
    // No pipeline access, no build state — pure file extraction.
    if (method === "GET" && url.startsWith("/rbx/audit/")) {
      var auditBuildId = url.replace("/rbx/audit/", "").split("?")[0];

      if (!auditBuildId || auditBuildId.length < 5) {
        return send(res, 400, { ok: false, error: "buildId required" });
      }

      var { existsSync: _aEx, readdirSync: _aRd } = await import("fs");
      var { join: _aJ } = await import("path");
      var auditExportsDir = _aJ(process.cwd(), "exports-rbx");

      var auditZip = null;
      if (_aEx(auditExportsDir)) {
        var aZips = _aRd(auditExportsDir).filter(function (f) {
          return f.endsWith(".zip") && f.indexOf(auditBuildId) !== -1;
        });
        if (aZips.length > 0) auditZip = _aJ(auditExportsDir, aZips[0]);
      }

      if (!auditZip) {
        return send(res, 404, { ok: false, error: "No ZIP found for buildId: " + auditBuildId });
      }

      try {
        var { readZipEntry: _aRead, listZipEntries: _aList } = await import("./t3/roblox-rbx/zip-reader.js");
        function _aReadEntry(name) {
          try { return _aRead(auditZip, name).toString("utf8"); }
          catch (_) { return null; }
        }
        var auditRaw = _aReadEntry("production-pipeline-audit.json");
        if (!auditRaw) {
          // Fallback to system unzip for robustness.
          var { execFile: _aExec } = await import("child_process");
          var { promisify: _aProm } = await import("util");
          var aExecAsync = _aProm(_aExec);
          var { stdout: _aStd } = await aExecAsync("unzip", ["-p", auditZip, "production-pipeline-audit.json"]);
          auditRaw = _aStd;
        }
        var auditData = JSON.parse(auditRaw);

        // Intent ride-along: extract static metadata (manifest + quality
        // report) so IntentRing can render without a second round-trip.
        // Missing files leave intent as null — UI handles that gracefully.
        var auditIntent = null;
        try {
          var manifestRaw = _aReadEntry("manifest.json");
          var qualityRaw  = _aReadEntry("production-quality-report.json");
          if (manifestRaw || qualityRaw) {
            var _m = manifestRaw ? JSON.parse(manifestRaw) : {};
            var _q = qualityRaw  ? JSON.parse(qualityRaw)  : {};
            auditIntent = {
              targetId:     _m.targetId     || null,
              targetType:   _m.targetType   || _q.type || null,
              gameName:     _m.gameName     || null,
              version:      _m.version      || null,
              qualityScore: typeof _q.qualityScore === "number" ? _q.qualityScore : null,
              qualityPass:  _q.pass === true,
              rules: _q.rules ? {
                total:     _q.rules.total     || 0,
                satisfied: _q.rules.satisfied || 0,
                identity:  _q.rules.identity  || null,
              } : null,
              criticals: Array.isArray(_q.criticals) ? _q.criticals.length : 0,
              warnings:  Array.isArray(_q.warnings)  ? _q.warnings.length  : 0,
            };
          }
        } catch (_intentErr) { /* intent is optional */ }

        // Ledger ride-along: extract ghost/lineage.json so MemoryRing can render
        // without a second round-trip. Missing file leaves ledger as null.
        var auditLedger = null;
        try {
          var lineageRaw = _aReadEntry("ghost/lineage.json");
          if (lineageRaw) {
            var _l = JSON.parse(lineageRaw);
            auditLedger = {
              ghostId:         _l.ghostId         || null,
              artifactId:      _l.artifactId      || null,
              project:         _l.project         || null,
              version:         _l.version         || null,
              parentCapsuleId: _l.parentCapsuleId || null,
              buildGeneration: typeof _l.buildGeneration === "number" ? _l.buildGeneration : null,
              mutationSource:  _l.mutationSource  || null,
              repairCount:     Array.isArray(_l.repairHistory) ? _l.repairHistory.length : 0,
              layerCount:      _l.layers && typeof _l.layers === "object" ? Object.keys(_l.layers).length : 0,
              auditHash:       _l.auditHash       || null,
              createdAt:       typeof _l.createdAt === "number" ? _l.createdAt : null,
              sealedAt:        typeof _l.sealedAt  === "number" ? _l.sealedAt  : null,
            };
          }
        } catch (_ledgerErr) { /* ledger is optional */ }

        // Energy ride-along: aggregate resource footprint so EnergyRing can
        // render without a second round-trip. All fields optional/derived.
        var auditEnergy = null;
        try {
          var { statSync: _aStat } = await import("fs");
          var _zipSize = 0;
          try { _zipSize = _aStat(auditZip).size; } catch (_) {}
          var _recCount = Array.isArray(auditData.records) ? auditData.records.length : 0;
          var _runtimeMods = 0;
          try {
            if (manifestRaw) {
              var _mm = JSON.parse(manifestRaw);
              if (_mm.runtime && Array.isArray(_mm.runtime.modules)) _runtimeMods = _mm.runtime.modules.length;
            }
          } catch (_) {}
          var _entries = 0;
          try { _entries = _aList(auditZip).length; } catch (_) {}
          // buildDuration lives in raw lineage but is dropped from auditLedger;
          // re-derive it here so EnergyRing has the number.
          var _dur = null;
          try {
            if (lineageRaw) {
              var _ll = JSON.parse(lineageRaw);
              if (typeof _ll.buildDuration === "number") _dur = _ll.buildDuration;
            }
          } catch (_) {}
          auditEnergy = {
            buildDuration:  _dur,
            zipSize:        _zipSize,
            recordCount:    _recCount,
            runtimeModules: _runtimeMods,
            entryCount:     _entries,
          };
        } catch (_energyErr) { /* energy is optional */ }

        // World ride-along: extract deploy-surface fields from manifest so
        // WorldRing can render. Missing manifest leaves world as null.
        var auditWorld = null;
        try {
          if (manifestRaw) {
            var _wm = JSON.parse(manifestRaw);
            auditWorld = {
              factory:          _wm.factory          || null,
              rojo:             _wm.rojo             || null,
              robloxCompatible: typeof _wm.robloxCompatible === "boolean" ? _wm.robloxCompatible : null,
              signedAt:         _wm.signedAt         || null,
              masterHash:       _wm.masterHash       || null,
            };
          }
        } catch (_worldErr) { /* world is optional */ }

        return send(res, 200, { ok: true, audit: auditData, intent: auditIntent, ledger: auditLedger, energy: auditEnergy, world: auditWorld });
      } catch (e) {
        return send(res, 500, { ok: false, error: "Could not read audit: " + e.message });
      }
    }

    // ── RBX EXPORTS LIST ───────────────────────────────────────────────────
    // GET /rbx/exports → list all produced ZIPs with download links
    if (method === "GET" && url === "/rbx/exports") {
      var { existsSync: exEx, readdirSync: exRd, statSync: exSt } = await import("fs");
      var { join: exJoin } = await import("path");
      var exDir = exJoin(process.cwd(), "exports-rbx");
      if (!exEx(exDir)) return send(res, 200, { ok: true, exports: [] });
      var exports = exRd(exDir)
        .filter(function(f) { return f.endsWith(".zip"); })
        .map(function(f) {
          var st = exSt(exJoin(exDir, f));
          return {
            filename:    f,
            sizeBytes:   st.size,
            modifiedAt:  st.mtime.toISOString(),
            downloadUrl: "/rbx/download/" + f,
          };
        })
        .sort(function(a,b) { return b.modifiedAt.localeCompare(a.modifiedAt); });
      return send(res, 200, { ok: true, exports: exports });
    }

    // ── Ollama-reitit — ERILLINEN VÄYLÄ, ei koske ALX:ään ────────────
    // GET /ollama/status → Ollama-yhteyden tila
    if (method === "GET" && url === "/ollama/status") {
      var ollamaAgent = orch.getOllamaAgent();
      if (!ollamaAgent) {
        return send(res, 200, { available: false, reason: "OllamaAgent ei käynnistetty" });
      }
      var available = await ollamaAgent.checkAvailability();
      return send(res, 200, {
        available: available,
        model:     ollamaAgent._model || null,
        stats:     ollamaAgent.getStats ? ollamaAgent.getStats() : null,
      });
    }

    // POST /ollama/chat → sessiomuistillinen chat OllamaAgentille
    // Body: { sessionId?, userMessage?, messages? }
    // Priorisoi userMessage+sessionId jos saatavilla, muuten messages[]
    if (method === "POST" && url === "/ollama/chat") {
      var chatBody = await readBody(req);
      var ollamaAgent2 = orch.getOllamaAgent();
      if (!ollamaAgent2) {
        return send(res, 503, { ok: false, error: "OllamaAgent ei ole saatavilla" });
      }

      var t0ollama = Date.now();

      // Sessiomuistillinen polku (uusi, suositeltu)
      if (chatBody.userMessage) {
        var mem       = ollamaMemory;
        var sessionId = chatBody.sessionId || "ollama-main";
        var userMsg   = chatBody.userMessage;

        // Rakennetaan viestiketju: system + historia + uusi viesti
        // Lisätään pysyvä memory ring kontekstina
        var ringContext = OllamaMemoryRing.buildContext(sessionId);
        var builtMessages = mem.buildMessages(sessionId, userMsg, ringContext);

        var chatResult = await ollamaAgent2.chat(builtMessages, {
          model:       chatBody.model       || null,
          temperature: chatBody.temperature || null,
          maxTokens:   chatBody.maxTokens   || null,
        });

        if (chatResult.ok && chatResult.content) {
          // Tallennetaan muistiin onnistumisen jälkeen
          mem.append(sessionId, userMsg, chatResult.content);
          // Tallenna myös pysyvään memory ringiin
          // Koodi-viestit merkitään "code"-tyypiksi
          var hasCode = chatResult.content.includes("export default") ||
                        chatResult.content.includes("function App") ||
                        chatResult.content.includes("```");
          OllamaMemoryRing.add(sessionId,
            hasCode ? "code" : "fact",
            userMsg.slice(0, 120) + " → " + chatResult.content.slice(0, 120),
            hasCode ? "high" : "normal"
          );
        }

        return send(res, chatResult.ok ? 200 : 503, Object.assign({}, chatResult, {
          durationMs: Date.now() - t0ollama,
          sessionId:  sessionId,
          historyLen: mem.getHistory(sessionId).length,
        }));

      // Stateless polku (taaksepäin yhteensopivuus)
      } else if (chatBody.messages && Array.isArray(chatBody.messages)) {
        var chatResult2 = await ollamaAgent2.chat(chatBody.messages, {
          model:       chatBody.model       || null,
          temperature: chatBody.temperature || null,
          maxTokens:   chatBody.maxTokens   || null,
        });
        return send(res, chatResult2.ok ? 200 : 503, Object.assign({}, chatResult2, {
          durationMs: Date.now() - t0ollama,
          stateless:  true,
        }));

      } else {
        return send(res, 400, { ok: false, error: "userMessage tai messages[] puuttuu" });
      }
    }

    // GET /ollama/memory/ring/:sessionId → ring stats
    if (method === "GET" && url.startsWith("/ollama/memory/ring")) {
      var ringSid = url.replace("/ollama/memory/ring", "").replace(/^\//, "") || "ollama-main";
      return send(res, 200, { ok: true, ring: OllamaMemoryRing.stats(ringSid) });
    }
    // DELETE /ollama/memory/ring/:sessionId → tyhjennä rinki
    if (method === "DELETE" && url.startsWith("/ollama/memory/ring/")) {
      var clearRingSid = url.replace("/ollama/memory/ring/", "");
      OllamaMemoryRing.clear(clearRingSid);
      return send(res, 200, { ok: true, cleared: clearRingSid });
    }
    // GET /ollama/memory/ring-list → kaikki sessiot
    if (method === "GET" && url === "/ollama/memory/ring-list") {
      return send(res, 200, { ok: true, sessions: OllamaMemoryRing.listSessions() });
    }

    // GET /ollama/memory/:sessionId → session stats
    if (method === "GET" && url.startsWith("/ollama/memory")) {
      var sid = url.replace("/ollama/memory", "").replace(/^\//, "") || null;
      return send(res, 200, { ok: true, stats: ollamaMemory.getStats(sid || undefined) });
    }

    // DELETE /ollama/memory/:sessionId → tyhjennä sessio
    if (method === "DELETE" && url.startsWith("/ollama/memory/")) {
      var clearSid = url.replace("/ollama/memory/", "");
      ollamaMemory.clear(clearSid);
      return send(res, 200, { ok: true, cleared: clearSid });
    }

    // ── Workspace-reitit ─────────────────────────────────────────────────
    if (method === "POST" && url === "/workspace/save")
      return handleWorkspaceSave(req, res, send, readBody);
    if (method === "GET"  && url === "/workspace")
      return handleWorkspaceList(req, res, send);
    if (method === "GET"  && url.startsWith("/workspace/"))
      return handleWorkspaceLoad(req, res, send, url);
    if (method === "POST" && url.includes("/snapshot"))
      return handleWorkspaceSnapshot(req, res, send, readBody, url);
    if (method === "POST" && url.includes("/restore/"))
      return handleWorkspaceRestore(req, res, send, readBody, url);
    if (method === "POST" && url.includes("/abort"))
      return handleWorkspaceAbort(req, res, send, url);
    if (method === "POST" && url.startsWith("/workspace/") && url.endsWith("/clear"))
      return handleWorkspaceClear(req, res, send, url);

    // ── Vault-reitit ──────────────────────────────────────────────────────
    if (method === "GET"  && url === "/vault")
      return handleVaultUI(req, res, send);
    if (method === "POST" && url === "/vault/save")
      return handleVaultSave(req, res, send, readBody);
    // ── Ghost Vault routes — 4-gate fail-closed security ──────
    if (method === "POST" && url === "/ghost/cube/start")
      return handleCubeStart(req, res, send, {});
    if (method === "POST" && url === "/ghost/cube/finalize")
      return handleCubeFinalize(req, res, send, readBody);
    if (method === "POST" && url === "/ghost/arkku")
      return handleArkku(req, res, send, readBody, {});
    if (method === "GET"  && url === "/ghost/audit")
      return handleVaultAudit(req, res, send);
    if (method === "GET"  && url === "/ghost/health")
      return handleVaultHealth(req, res, send);

    if (method === "GET"  && url === "/vault/builds")
      return handleVaultList(req, res, send);
    if (method === "GET"  && url.startsWith("/vault/builds/")) {
      // Parse: /vault/builds/build_123 → build_123
      var vaultBuildId = url.replace("/vault/builds/", "").split("/")[0];
      return handleVaultGet(req, res, send, vaultBuildId);
    }

    // ── Publish-reitit ────────────────────────────────────────────────────
    if (method === "POST" && url === "/publish") {
      // ── RBX CONTAMINATION BLOCK ──────────────────────────────────────────
      // /publish injects Vite/React/ReactDOM into workspace (ensureVite, normalizeStructure)
      // This MUST never run for RBX builds. RBX uses /rbx/build → /rbx/download only.
      var _pbody = await readBody(req).catch(function() { return {}; });
      var _isRbxPublish = (
        _pbody.rbxBuildId ||
        (typeof _pbody.source === "string" && _pbody.source.includes("RBX_BUILD")) ||
        (Array.isArray(_pbody.files) && _pbody.files.some(function(f){ return f && f.path === "rbx-build.json"; }))
      );
      if (_isRbxPublish) {
        return send(res, 400, {
          ok: false,
          error: "RBX_ISOLATION_VIOLATED: /publish injects Vite into workspaces. RBX artifacts use /rbx/download/:zipName only.",
          code: "RBX_CONTAMINATION_BLOCKED",
          fix: "Use EXPORT ZIP button which calls /rbx/download directly.",
        });
      }
      return handlePublish(req, res, send, function(r){ return Promise.resolve(_pbody); }, {});
    }
    if (method === "GET"  && url === "/published")
      return handlePublishedList(req, res, send);

    // ── Work Vault — työ-artifaktit ───────────────────────────
    // ── Asset routes ───────────────────────────────────────────
    if (method === "POST"   && url === "/assets/upload")
      return handleAssetUpload(req, res, send, readBody);
    if (method === "GET"    && url.startsWith("/assets/"))
      return handleAssetGet(req, res, url);
    if (method === "DELETE" && url.startsWith("/assets/"))
      return handleAssetDelete(req, res, send, url, await readBody(req).catch(()=>({}))); 
    if (method === "GET"    && url === "/assets")
      return handleAssetList(req, res, send);

    // ── Work attach/detach asset ────────────────────────────────
    if (method === "POST" && url.endsWith("/attach-asset"))
      return handleWorkAttachAsset(req, res, send, await readBody(req), url);
    if (method === "POST" && url.endsWith("/detach-asset"))
      return handleWorkDetachAsset(req, res, send, await readBody(req), url);

    if (method === "GET"  && url === "/works")
      return handleWorksList(req, res, send);
    if (method === "POST" && url === "/works/save")
      return handleWorkSave(req, res, send, readBody);
    if (method === "DELETE" && url.startsWith("/works/"))
      return handleWorkDelete(req, res, send, url);
    if (method === "GET"  && url.startsWith("/works/") && url !== "/works/")
      return handleWorkGet(req, res, send, url);
    if (method === "GET"  && url.startsWith("/published/") && url.endsWith("/download"))
      return handlePublishedDownload(req, res, url);

    send(res, 404, { error: "Reitti ei löydy: " + method + " " + url });

  } catch (err) {
    // Request body liian suuri tai yhteys katkaistiin — ei 500
    if (err.message && (err.message.includes("liian suuri") || err.code === "ECONNRESET" || err.code === "ERR_STREAM_DESTROYED")) {
      if (!res.writableEnded) send(res, 413, { ok: false, error: "Request liian suuri tai yhteys katkaistiin" });
      return;
    }
    console.error("[Server] Käsittelemätön virhe:", err.message, err.stack);
    var safeMsg = process.env.ALX_DEBUG === "1" ? err.message : "Internal server error";
    if (!res.writableEnded) send(res, 500, { ok: false, error: safeMsg, code: "INTERNAL_ERROR" });
  }
});

server.listen(PORT, function() {
  console.log("");
  console.log("  ========================================");
  console.log("  AF51-RBX server READY");
  console.log("  Listening: http://localhost:" + PORT);
  console.log("  Health:    http://localhost:" + PORT + "/health");
  console.log("  Lua build: POST /rbx/lua-build");
  console.log("  ========================================");
  console.log("  (Leave this window open. Open a 2nd Git Bash for: npx expo start --web --clear)");
  console.log("");
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on("SIGTERM", async function() {
  
  server.close();
  await orch.shutdown().catch(function() {});
  process.exit(0);
});

process.on("SIGINT", async function() {
  
  server.close();
  await orch.shutdown().catch(function() {});
  process.exit(0);
});

// Structured logging domains: PIPELINE EXPORT VAULT SECURITY AUDIT ERROR
