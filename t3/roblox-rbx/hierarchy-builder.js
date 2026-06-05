// t3-rbx/hierarchy-builder.js
// AF51-RBX | T3 Layer — Hierarchy Builder
// Role   : Generates the deterministic Roblox project filesystem hierarchy.
//          No random folder generation. Structure is fully spec-driven.
// Output : build/roblox/src/{ReplicatedStorage,ServerScriptService,...}

import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

// ─── Canonical hierarchy spec ─────────────────────────────────────────────
// This defines the COMPLETE expected output structure.
// Nothing outside this spec is generated.

const ROBLOX_HIERARCHY = {
  "src/ReplicatedStorage": {
    "Packages/AF51Runtime": null,       // Luau runtime ModuleScripts injected here
    "Remotes": null,                    // RemoteEvents / RemoteFunctions
    "Shared": {
      "Constants": null,
      "Types": null,
      "Utils": null,
    },
  },
  "src/ServerScriptService": {
    "Services": null,
    "DataStore": null,
    "Admin": null,
  },
  "src/StarterGui": {
    "HUD": null,
    "Menus": null,
    "Notifications": null,
    "Shop": null,
    "Inventory": null,
  },
  "src/StarterPlayer": {
    "StarterPlayerScripts": null,
    "StarterCharacterScripts": null,
  },
  "src/Workspace": {
    "Map": null,
    "Systems": null,
  },
  "src/Packages": null,                 // External packages (Knit, Promise, etc.)
  "runtime": null,                      // Source Luau runtime files
  "assets": null,                       // Asset manifests
  "packageProfiles": null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Recursively creates directory nodes from a nested spec object.
 * @param {string} base    - absolute base path
 * @param {object|null} spec - nested spec; null = leaf directory
 * @param {string[]} created - accumulator of created paths
 */
async function _createNodes(base, spec, created) {
  await mkdir(base, { recursive: true });
  created.push(base);

  if (spec === null || typeof spec !== "object") {
    return;
  }

  for (const [key, childSpec] of Object.entries(spec)) {
    const childPath = path.join(base, key);
    await _createNodes(childPath, childSpec, created);
  }
}

/**
 * Writes a .gitkeep value so empty dirs survive git.
 * Only writes if the directory has no files yet.
 */
async function _writeGitkeep(dirPath) {
  const keepPath = path.join(dirPath, ".gitkeep");
  if (!existsSync(keepPath)) {
    await writeFile(keepPath, "", "utf8");
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

const HierarchyBuilder = {};

/**
 * Generates the full deterministic Roblox hierarchy under buildRoot.
 *
 * @param {object} opts
 * @param {string}  opts.buildRoot    - absolute path to the build output directory
 * @param {object}  opts.target       - resolved target spec (from TargetResolver)
 * @param {object}  opts.auditLedger  - audit ledger reference (k1 governance)
 * @returns {Promise<{ok: boolean, dirs: string[], error?: string}>}
 */
HierarchyBuilder.build = async function({ buildRoot, target, auditLedger }) {
  if (!buildRoot || typeof buildRoot !== "string") {
    throw new Error("[HierarchyBuilder] buildRoot must be a non-empty string");
  }
  if (!target || typeof target !== "object") {
    throw new Error("[HierarchyBuilder] target must be a resolved target spec object");
  }

  const created = [];

  try {
    auditLedger?.log("HierarchyBuilder.build.start", "INFO", {
      buildRoot,
      targetId: target.id,
      targetType: target.type,
    });

    // Create root
    await mkdir(buildRoot, { recursive: true });
    created.push(buildRoot);

    // Build canonical hierarchy
    for (const [relPath, spec] of Object.entries(ROBLOX_HIERARCHY)) {
      const absPath = path.join(buildRoot, relPath);
      await _createNodes(absPath, spec, created);
    }

    // Apply target-specific extra directories
    if (target.extraDirs && Array.isArray(target.extraDirs)) {
      for (const relDir of target.extraDirs) {
        // Validate: must be under src/ only, no path traversal
        const normalised = path.normalize(relDir);
        if (normalised.startsWith("..") || (!normalised.startsWith("src/") && !normalised.startsWith("src\\"))) {
          throw new Error(`[HierarchyBuilder] target.extraDirs entry escapes src/: "${relDir}"`);
        }
        const absDir = path.join(buildRoot, normalised);
        await mkdir(absDir, { recursive: true });
        created.push(absDir);
        await _writeGitkeep(absDir);
      }
    }

    // Write .gitkeep in all leaf directories
    for (const dirPath of created) {
      if (existsSync(dirPath)) {
        await _writeGitkeep(dirPath);
      }
    }

    auditLedger?.log("HierarchyBuilder.build.complete", "INFO", {
      buildRoot,
      directoriesCreated: created.length,
    });

    return { ok: true, dirs: created };

  } catch (err) {
    auditLedger?.log("HierarchyBuilder.build.error", "ERROR", {
      buildRoot,
      error: err.message,
    });
    return { ok: false, dirs: created, error: err.message };
  }
};

/**
 * Returns the canonical hierarchy spec as a flat list of relative paths.
 * Used by PackageValidator to verify completeness.
 */
HierarchyBuilder.getExpectedPaths = function(includeExtraDirs = []) {
  const paths = [];

  function flatten(spec, prefix) {
    paths.push(prefix);
    if (spec && typeof spec === "object") {
      for (const [key, child] of Object.entries(spec)) {
        flatten(child, path.join(prefix, key));
      }
    }
  }

  for (const [relPath, spec] of Object.entries(ROBLOX_HIERARCHY)) {
    flatten(spec, relPath);
  }

  for (const extra of includeExtraDirs) {
    const normalised = path.normalize(extra);
    if (!paths.includes(normalised)) {
      paths.push(normalised);
    }
  }

  return paths;
};

/**
 * Validates that the hierarchy at buildRoot is complete.
 * Returns { ok, missing: string[], unexpected: string[] }
 */
HierarchyBuilder.validate = function(buildRoot, includeExtraDirs = []) {
  const expected = HierarchyBuilder.getExpectedPaths(includeExtraDirs);
  const missing = [];

  for (const relPath of expected) {
    const absPath = path.join(buildRoot, relPath);
    if (!existsSync(absPath)) {
      missing.push(relPath);
    }
  }

  return {
    ok:      missing.length === 0,
    missing,
  };
};

export { HierarchyBuilder };