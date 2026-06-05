// t3-rbx/package-validator.js
// AF51-RBX | T3 Layer — Package Validator
// Role   : Pre-export validation gate.
//          ZIP export is FORBIDDEN if any check fails.
//          All checks are deterministic and produce structured reports.

import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

// ─── Required hierarchy paths ──────────────────────────────────────────────

const REQUIRED_DIRS = [
  "src/ReplicatedStorage",
  "src/ReplicatedStorage/Packages/AF51Runtime",
  "src/ReplicatedStorage/Remotes",
  "src/ReplicatedStorage/Shared",
  "src/ServerScriptService",
  "src/StarterGui",
  "src/StarterPlayer",
  "src/StarterPlayer/StarterPlayerScripts",
  "src/Workspace",
];

const REQUIRED_FILES = [
  "default.project.json",
  "manifest.json",
  "signature.json",
  "generatedPreview.json",
  "src/ReplicatedStorage/Packages/AF51Runtime/EventBus.lua",
  "src/ReplicatedStorage/Packages/AF51Runtime/StateStore.lua",
  "src/ReplicatedStorage/Packages/AF51Runtime/ServiceRegistry.lua",
  "src/ReplicatedStorage/Packages/AF51Runtime/NetworkLayer.lua",
  "src/ReplicatedStorage/Packages/AF51Runtime/AuditRuntime.lua",
  "src/ReplicatedStorage/Packages/AF51Runtime/RuntimeInit.lua",
  "src/ReplicatedStorage/Remotes/RemoteEvents.lua",
  "src/ReplicatedStorage/Remotes/RemoteFunctions.lua",
  "src/ReplicatedStorage/Remotes/ValidationGate.lua",
  "src/ReplicatedStorage/Remotes/network-contract.json",
  "src/ServerScriptService/RuntimeInit.server.lua",
  "src/StarterPlayer/StarterPlayerScripts/ClientInit.client.lua",
];

const REQUIRED_ROJO_KEYS = ["name", "tree"];
const REQUIRED_ROJO_TREE = [
  "ReplicatedStorage",
  "ServerScriptService",
  "StarterGui",
  "StarterPlayer",
  "Workspace",
];

const REQUIRED_MANIFEST_KEYS = [
  "schemaVersion",
  "factory",
  "targetId",
  "targetType",
  "version",
  "buildId",
  "runtime",
];

// ─── Forbidden patterns in Luau files ─────────────────────────────────────
// Anti-exploit: these patterns indicate bypassed governance.

const FORBIDDEN_LUAU_PATTERNS = [
  { pattern: /RemoteEvent\.new\(\)/g,   reason: "Direct RemoteEvent.new() — use NetworkLayer.declareRemote()" },
  { pattern: /RemoteFunction\.new\(\)/g, reason: "Direct RemoteFunction.new() — use NetworkLayer.declareRemote()" },
  { pattern: /BindableEvent\.new\(\)/g,  reason: "Direct BindableEvent.new() — use EventBus" },
  { pattern: /(?<![\.\w])wait\s*\(/g,          reason: "Deprecated wait() — use task.wait()" },
];

// ─── Check Functions ──────────────────────────────────────────────────────

async function _checkHierarchy(buildRoot) {
  const issues = [];
  for (const relPath of REQUIRED_DIRS) {
    const abs = path.join(buildRoot, relPath);
    if (!existsSync(abs)) {
      issues.push(`Missing directory: ${relPath}`);
    } else {
      try {
        const s = await stat(abs);
        if (!s.isDirectory()) {
          issues.push(`Expected directory but found file: ${relPath}`);
        }
      } catch {
        issues.push(`Cannot stat: ${relPath}`);
      }
    }
  }
  return { name: "hierarchy", ok: issues.length === 0, issues };
}

async function _checkRequiredFiles(buildRoot) {
  const issues = [];
  for (const relPath of REQUIRED_FILES) {
    const abs = path.join(buildRoot, relPath);
    if (!existsSync(abs)) {
      issues.push(`Missing required file: ${relPath}`);
    } else {
      try {
        const s = await stat(abs);
        if (s.isDirectory()) {
          issues.push(`Expected file but found directory: ${relPath}`);
        }
        if (s.size === 0) {
          issues.push(`Empty file (zero bytes): ${relPath}`);
        }
      } catch {
        issues.push(`Cannot stat: ${relPath}`);
      }
    }
  }
  return { name: "requiredFiles", ok: issues.length === 0, issues };
}

async function _checkRojoProject(buildRoot) {
  const issues = [];
  const projectPath = path.join(buildRoot, "default.project.json");

  let project;
  try {
    const raw = await readFile(projectPath, "utf8");
    project   = JSON.parse(raw);
  } catch (err) {
    return { name: "rojo", ok: false, issues: [`default.project.json parse error: ${err.message}`] };
  }

  for (const key of REQUIRED_ROJO_KEYS) {
    if (!project[key]) {
      issues.push(`default.project.json missing key: "${key}"`);
    }
  }

  if (project.tree) {
    for (const svc of REQUIRED_ROJO_TREE) {
      if (!project.tree[svc]) {
        issues.push(`default.project.json missing tree["${svc}"]`);
      } else if (!project.tree[svc].$path) {
        issues.push(`default.project.json missing tree["${svc}"].$path`);
      }
    }
  }

  return { name: "rojo", ok: issues.length === 0, issues };
}

async function _checkManifest(buildRoot) {
  const issues = [];
  const mPath  = path.join(buildRoot, "manifest.json");

  let manifest;
  try {
    const raw = await readFile(mPath, "utf8");
    manifest  = JSON.parse(raw);
  } catch (err) {
    return { name: "manifest", ok: false, issues: [`manifest.json parse error: ${err.message}`] };
  }

  for (const key of REQUIRED_MANIFEST_KEYS) {
    if (manifest[key] === undefined || manifest[key] === null || manifest[key] === "") {
      issues.push(`manifest.json missing or empty key: "${key}"`);
    }
  }

  if (manifest.factory !== "AF51-RBX") {
    issues.push(`manifest.json factory must be "AF51-RBX", got "${manifest.factory}"`);
  }

  return { name: "manifest", ok: issues.length === 0, issues };
}

async function _checkAssetLinkage(buildRoot) {
  // assets/ directory no longer included in Roblox ZIP (AF51 internal only)
  // Asset linkage validation is skipped — assets are resolved at runtime via rbxassetid://
  return { name: "assetLinkage", ok: true, issues: [] };
}

async function _checkRemoteTopology(buildRoot) {
  const issues = [];
  // Validate server init declares remotes
  const serverInitPath = path.join(buildRoot, "src/ServerScriptService/RuntimeInit.server.lua");

  if (!existsSync(serverInitPath)) {
    return { name: "remoteTopology", ok: false, issues: ["RuntimeInit.server.lua not found"] };
  }

  const content = await readFile(serverInitPath, "utf8");

  if (!content.includes("NetworkLayer.declareRemote") && !content.includes("RuntimeInit.boot")) {
    issues.push("RuntimeInit.server.lua does not use RuntimeInit.boot() or NetworkLayer.declareRemote()");
  }

  return { name: "remoteTopology", ok: issues.length === 0, issues };
}

async function _checkAntiExploit(buildRoot) {
  const issues = [];

  // Scan all .lua files in src/
  const srcDir = path.join(buildRoot, "src");
  const { readdir } = await import("node:fs/promises");

  async function scanDir(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(full);
      } else if (entry.name.endsWith(".lua") || entry.name.endsWith(".luau")) {
        let content;
        try {
          content = await readFile(full, "utf8");
        } catch {
          continue;
        }
        const rel = path.relative(buildRoot, full);
        for (const { pattern, reason } of FORBIDDEN_LUAU_PATTERNS) {
          if (pattern.test(content)) {
            issues.push(`Anti-exploit violation in ${rel}: ${reason}`);
          }
          // Reset regex state
          pattern.lastIndex = 0;
        }
      }
    }
  }

  await scanDir(srcDir);
  return { name: "antiExploit", ok: issues.length === 0, issues };
}

async function _checkInvariants(buildRoot) {
  const issues = [];

  // Invariant 1: RuntimeInit.lua must exist in AF51Runtime
  const initPath = path.join(buildRoot, "src/ReplicatedStorage/Packages/AF51Runtime/RuntimeInit.lua");
  if (!existsSync(initPath)) {
    issues.push("Invariant violated: RuntimeInit.lua missing from AF51Runtime package");
  }

  // Invariant 2: No script files outside src/ or runtime/
  // (checked by hierarchy validator — additional check: no .lua files at root)
  const { readdir } = await import("node:fs/promises");
  let rootEntries = [];
  try {
    rootEntries = await readdir(buildRoot, { withFileTypes: true });
  } catch {
    issues.push("Cannot read buildRoot for invariant check");
  }
  for (const entry of rootEntries) {
    if (!entry.isDirectory() && (entry.name.endsWith(".lua") || entry.name.endsWith(".luau"))) {
      issues.push(`Invariant violated: Lua file at build root: ${entry.name}`);
    }
  }

  // Invariant 3: manifest.json and default.project.json must agree on name
  try {
    const mRaw = await readFile(path.join(buildRoot, "manifest.json"), "utf8");
    const pRaw = await readFile(path.join(buildRoot, "default.project.json"), "utf8");
    const m    = JSON.parse(mRaw);
    const p    = JSON.parse(pRaw);
    if (m.gameName && p.name && m.gameName !== p.name) {
      issues.push(`Invariant violated: manifest.gameName "${m.gameName}" ≠ project.name "${p.name}"`);
    }
  } catch {
    // Already flagged by other checks
  }

  return { name: "invariants", ok: issues.length === 0, issues };
}

// ─── Public API ───────────────────────────────────────────────────────────

const PackageValidator = {};

/**
 * Runs all validation checks against the build at buildRoot.
 * Returns a structured report.
 * ZIP export MUST be blocked if report.ok === false.
 *
 * @param {object} opts
 * @param {string}  opts.buildRoot    - absolute build output root
 * @param {object}  opts.auditLedger
 * @returns {Promise<{
 *   ok:      boolean,
 *   checks:  { name: string, ok: boolean, issues: string[] }[],
 *   summary: { passed: number, failed: number, totalIssues: number },
 * }>}
 */
PackageValidator.validate = async function({ buildRoot, auditLedger }) {
  if (!buildRoot || !existsSync(buildRoot)) {
    return {
      ok:      false,
      checks:  [{ name: "root", ok: false, issues: [`buildRoot not found: ${buildRoot}`] }],
      summary: { passed: 0, failed: 1, totalIssues: 1 },
    };
  }

  auditLedger?.log("PackageValidator.validate.start", "INFO", { buildRoot });

  const checks = await Promise.all([
    _checkHierarchy(buildRoot),
    _checkRequiredFiles(buildRoot),
    _checkRojoProject(buildRoot),
    _checkManifest(buildRoot),
    _checkAssetLinkage(buildRoot),
    _checkRemoteTopology(buildRoot),
    _checkAntiExploit(buildRoot),
    _checkInvariants(buildRoot),
  ]);

  const failed      = checks.filter(c => !c.ok);
  const passed      = checks.filter(c => c.ok);
  const totalIssues = checks.reduce((acc, c) => acc + c.issues.length, 0);
  const allOk       = failed.length === 0;

  const summary = {
    passed:      passed.length,
    failed:      failed.length,
    totalIssues,
  };

  auditLedger?.log("PackageValidator.validate.complete", allOk ? "INFO" : "ERROR", {
    buildRoot,
    ok: allOk,
    summary,
    failedChecks: failed.map(c => c.name),
  });

  return { ok: allOk, checks, summary };
};

export { PackageValidator };