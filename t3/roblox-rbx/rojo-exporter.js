// t3-rbx/rojo-exporter.js
// AF51-RBX | T3 Layer — Rojo Exporter
// Role   : Generates default.project.json + manifest.json + package.json
//          in the build root. Ensures Rojo-compatible filesystem mapping.
// Spec   : https://rojo.space/docs/v7/project-format/

import { writeFile } from "node:fs/promises";
import path from "node:path";

// ─── Rojo Project Template ────────────────────────────────────────────────

function _buildRojoProject(opts) {
  const {
    gameName,
    targetId,
    targetType,
    placeId,
    universeId,
  } = opts;

  return {
    name: gameName,
    tree: {
      $className: "DataModel",

      ReplicatedStorage: {
        $path: "src/ReplicatedStorage",
      },

      ServerScriptService: {
        $path: "src/ServerScriptService",
      },

      StarterGui: {
        $path: "src/StarterGui",
      },

      StarterPlayer: {
        $path: "src/StarterPlayer",
      },

      Workspace: {
        $path: "src/Workspace",
        // Gravity is a common Workspace property override
        $properties: {
          Gravity: 196.2,
        },
      },
    },

    // Rojo serve configuration
    serveAddress: "localhost",
    servePort: 34872,

    // Optional: place / universe IDs for publish integration
    ...(placeId ? { placeId: Number(placeId) } : {}),
    ...(universeId ? { universeId: Number(universeId) } : {}),
  };
}

// ─── Manifest ─────────────────────────────────────────────────────────────

function _buildManifest(opts) {
  const {
    gameName,
    targetId,
    targetType,
    version,
    buildTimestamp,
    buildId,
  } = opts;

  return {
    schemaVersion: 1,
    factory: "AF51-RBX",
    gameName,
    targetId,
    targetType,
    version,
    buildId,
    buildTimestamp,
    rojo: "7.x",
    luau: true,
    robloxCompatible: true,
    hierarchy: {
      ReplicatedStorage: "src/ReplicatedStorage",
      ServerScriptService: "src/ServerScriptService",
      StarterGui: "src/StarterGui",
      StarterPlayer: "src/StarterPlayer",
      Workspace: "src/Workspace",
      Packages: "src/Packages",
    },
    runtime: {
      modules: [
        "AuditRuntime",
        "EventBus",
        "StateStore",
        "ServiceRegistry",
        "NetworkLayer",
        "RuntimeInit",
      ],
      location: "ReplicatedStorage.Packages.AF51Runtime",
    },
  };
}

// ─── Package.json ─────────────────────────────────────────────────────────

function _buildPackageJson(opts) {
  const { gameName, version } = opts;
  return {
    name:    gameName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    version: version,
    private: true,
    description: `AF51-RBX generated Roblox project: ${gameName}`,
    scripts: {
      serve: "rojo serve default.project.json",
      build: "rojo build default.project.json --output game.rbxl",
    },
    devDependencies: {
      // Rojo is installed globally; no npm dep needed
    },
    af51: {
      factory:  "AF51-RBX",
      targetId: opts.targetId,
    },
  };
}

// ─── Build ID generation ──────────────────────────────────────────────────
// Deterministic: based on targetId + version + timestamp (truncated to second).

// Deterministic per production/zip-determinism-policy.json:
//   stableHashes=true, randomTempNamesAllowed=false.
// Derive buildId from input identity only. Same target+version → same buildId,
// byte for byte. Set AF51_BUILD_ID env var to pin an explicit buildId.
function _generateBuildId(targetId, version, _ts) {
  const override = (typeof process !== "undefined" && process.env && process.env.AF51_BUILD_ID) || "";
  if (override) return override;
  const base = `${targetId}:${version}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `build_${targetId}_${h.toString(16).padStart(8, "0")}`;
}

// Exposed so phases that run before ROJO_EXPORT (e.g. VISUAL_PRODUCTION
// emitting production-scenegraph.json) can stamp the same buildId that
// RojoExporter will derive later. Identical algorithm, identical result \u2014
// keeps the envelope contract consistent across the pipeline.
export function generateBuildId(targetId, version) {
  return _generateBuildId(targetId, version);
}

// ─── Public API ───────────────────────────────────────────────────────────

const RojoExporter = {};

/**
 * Generates all Rojo project files in buildRoot.
 *
 * @param {object} opts
 * @param {string}  opts.buildRoot    - absolute build output directory
 * @param {object}  opts.target       - resolved target spec
 * @param {string}  opts.gameName     - human-readable game name
 * @param {string}  opts.version      - semver string (e.g. "1.0.0")
 * @param {number?} opts.placeId      - Roblox place ID
 * @param {number?} opts.universeId   - Roblox universe ID
 * @param {object}  opts.auditLedger
 * @returns {Promise<{ok: boolean, files: string[], buildId: string, error?: string}>}
 */
RojoExporter.export = async function({
  buildRoot,
  target,
  gameName,
  version,
  placeId,
  universeId,
  auditLedger,
}) {
  if (!buildRoot || !target || !gameName || !version) {
    throw new Error("[RojoExporter] buildRoot, target, gameName, and version are required");
  }

  // Deterministic epoch (see production/zip-determinism-policy.json).
  // AF51_BUILD_EPOCH can override (ms since epoch). Default: ZIP entry epoch
  // 1980-01-01T00:00:00Z so manifest+ZIP timestamps agree.
  const _epochOverride = (typeof process !== "undefined" && process.env && process.env.AF51_BUILD_EPOCH) || "";
  const ts      = _epochOverride ? Number(_epochOverride) : 315532800000;
  const buildId = _generateBuildId(target.id, version, ts);
  const files   = [];

  const sharedOpts = {
    gameName,
    targetId:       target.id,
    targetType:     target.type,
    version,
    buildTimestamp: new Date(ts).toISOString(),
    buildId,
    placeId,
    universeId,
  };

  try {
    auditLedger?.log("RojoExporter.export.start", "INFO", { buildRoot, targetId: target.id, buildId });

    // default.project.json
    const projectJson = _buildRojoProject(sharedOpts);
    const projectPath = path.join(buildRoot, "default.project.json");
    await writeFile(projectPath, JSON.stringify(projectJson, null, 2), "utf8");
    files.push("default.project.json");

    // manifest.json
    const manifestJson = _buildManifest(sharedOpts);
    const manifestPath = path.join(buildRoot, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifestJson, null, 2), "utf8");
    files.push("manifest.json");

    // package.json
    const pkgJson  = _buildPackageJson(sharedOpts);
    const pkgPath  = path.join(buildRoot, "package.json");
    await writeFile(pkgPath, JSON.stringify(pkgJson, null, 2), "utf8");
    files.push("package.json");

    auditLedger?.log("RojoExporter.export.complete", "INFO", {
      buildRoot,
      buildId,
      filesWritten: files.length,
    });

    return { ok: true, files, buildId };

  } catch (err) {
    auditLedger?.log("RojoExporter.export.error", "ERROR", {
      buildRoot,
      buildId,
      error: err.message,
    });
    return { ok: false, files, buildId, error: err.message };
  }
};

/**
 * Validates that a directory contains a valid Rojo project file.
 * Returns { ok, error }
 */
RojoExporter.validateProject = async function(buildRoot) {
  const projectPath = path.join(buildRoot, "default.project.json");

  let raw;
  try {
    const { readFile } = await import("node:fs/promises");
    raw = await readFile(projectPath, "utf8");
  } catch {
    return { ok: false, error: "default.project.json not found" };
  }

  let project;
  try {
    project = JSON.parse(raw);
  } catch {
    return { ok: false, error: "default.project.json is not valid JSON" };
  }

  const requiredKeys = ["name", "tree"];
  for (const key of requiredKeys) {
    if (!project[key]) {
      return { ok: false, error: `default.project.json missing required key: "${key}"` };
    }
  }

  const requiredServices = [
    "ReplicatedStorage",
    "ServerScriptService",
    "StarterGui",
    "StarterPlayer",
    "Workspace",
  ];

  for (const svc of requiredServices) {
    if (!project.tree[svc]) {
      return { ok: false, error: `default.project.json missing tree entry: "${svc}"` };
    }
    if (!project.tree[svc].$path) {
      return { ok: false, error: `default.project.json missing $path for: "${svc}"` };
    }
  }

  return { ok: true };
};

export { RojoExporter };