// t3-rbx/asset-packager.js
// AF51-RBX | T3 Layer — Asset Packager
// Role   : Generates asset-manifest.json, asset-map.json, asset-hashes.json
//          in the build assets/ directory.
//          Validates asset references against the target spec.
//          Assets themselves (images, audio, meshes) are referenced by Roblox asset ID.
//          This module does NOT upload assets — it packages their manifest descriptors.

import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// ─── Supported Asset Types ─────────────────────────────────────────────────

const ASSET_TYPE = {
  IMAGE:  "image",
  AUDIO:  "audio",
  MESH:   "mesh",
  ICON:   "icon",
  DECAL:  "decal",
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function _sha256(str) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

function _deterministicId(assetType, name, robloxId) {
  const base = `${assetType}:${name}:${robloxId}`;
  return `asset_${_sha256(base).slice(0, 12)}`;
}

// ─── Manifest Builder ─────────────────────────────────────────────────────

/**
 * Builds the three asset manifest files from a target's asset declarations.
 *
 * @param {object[]} assets - array of asset descriptors from target spec
 *   Each: { type, name, robloxId, tags?: string[] }
 * @returns {{ manifest: object, assetMap: object, hashes: object }}
 */
function _buildManifests(assets, buildId, targetId) {
  const manifest = {
    schemaVersion: 1,
    factory:       "AF51-RBX",
    targetId,
    buildId,
    generatedAt:   new Date().toISOString(),
    assetCount:    assets.length,
    assets:        [],
  };

  const assetMap = {
    schemaVersion: 1,
    // Maps logical name → roblox asset ID string
    byName: {},
    // Maps asset internal ID → roblox asset ID
    byId:   {},
  };

  const hashes = {
    schemaVersion: 1,
    // Maps asset internal ID → sha256 of "type:name:robloxId"
    entries: {},
    // Chain hash of all entries (sorted by id) for tamper detection
    chainHash: "",
  };

  const sortedAssets = [...assets].sort((a, b) => a.name.localeCompare(b.name));

  for (const asset of sortedAssets) {
    const { type, name, robloxId, tags } = asset;

    if (!Object.values(ASSET_TYPE).includes(type)) {
      throw new Error(`[AssetPackager] Unknown asset type: "${type}" for asset "${name}"`);
    }
    if (!name || typeof name !== "string") {
      throw new Error(`[AssetPackager] Asset missing name`);
    }
    if (!robloxId) {
      throw new Error(`[AssetPackager] Asset "${name}" missing robloxId`);
    }

    const internalId  = _deterministicId(type, name, String(robloxId));
    const assetHash   = _sha256(`${type}:${name}:${robloxId}`);
    const robloxAsset = `rbxassetid://${robloxId}`;

    // Manifest entry
    manifest.assets.push({
      id:       internalId,
      type,
      name,
      robloxId: String(robloxId),
      assetUri: robloxAsset,
      tags:     tags || [],
      hash:     assetHash,
    });

    // Map
    assetMap.byName[name] = robloxAsset;
    assetMap.byId[internalId] = robloxAsset;

    // Hash entry
    hashes.entries[internalId] = assetHash;
  }

  // Chain hash: sha256 over sorted concatenation of all entry hashes
  const sortedHashes = Object.entries(hashes.entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, h]) => `${id}:${h}`)
    .join("|");
  hashes.chainHash = _sha256(sortedHashes);

  return { manifest, assetMap, hashes };
}

// ─── Public API ───────────────────────────────────────────────────────────

const AssetPackager = {};

AssetPackager.ASSET_TYPE = ASSET_TYPE;

/**
 * Packages asset manifests into the build assets/ directory.
 *
 * @param {object} opts
 * @param {string}  opts.buildRoot    - absolute build output root
 * @param {object}  opts.target       - resolved target spec (target.assets = array)
 * @param {string}  opts.buildId      - build ID from RojoExporter
 * @param {object}  opts.auditLedger
 * @returns {Promise<{ok: boolean, files: string[], assetCount: number, chainHash: string, error?: string}>}
 */
AssetPackager.package = async function({ buildRoot, target, buildId, auditLedger }) {
  if (!buildRoot || !target) {
    throw new Error("[AssetPackager] buildRoot and target are required");
  }

  const assetsDir = path.join(buildRoot, "assets");
  const assets    = target.assets || [];
  const files     = [];

  try {
    auditLedger?.log("AssetPackager.package.start", "INFO", {
      buildRoot,
      targetId:   target.id,
      assetCount: assets.length,
    });

    const { manifest, assetMap, hashes } = _buildManifests(assets, buildId, target.id);

    // asset-manifest.json
    const manifestPath = path.join(assetsDir, "asset-manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    files.push("assets/asset-manifest.json");

    // asset-map.json
    const mapPath = path.join(assetsDir, "asset-map.json");
    await writeFile(mapPath, JSON.stringify(assetMap, null, 2), "utf8");
    files.push("assets/asset-map.json");

    // asset-hashes.json
    const hashesPath = path.join(assetsDir, "asset-hashes.json");
    await writeFile(hashesPath, JSON.stringify(hashes, null, 2), "utf8");
    files.push("assets/asset-hashes.json");

    auditLedger?.log("AssetPackager.package.complete", "INFO", {
      assetCount: assets.length,
      chainHash:  hashes.chainHash,
      files:      files.length,
    });

    return {
      ok:         true,
      files,
      assetCount: assets.length,
      chainHash:  hashes.chainHash,
    };

  } catch (err) {
    auditLedger?.log("AssetPackager.package.error", "ERROR", {
      error: err.message,
    });
    return { ok: false, files, assetCount: 0, chainHash: "", error: err.message };
  }
};

/**
 * Validates existing asset manifests in buildRoot.
 * Verifies chain hash integrity.
 * Returns { ok, error }
 */
AssetPackager.validate = async function(buildRoot) {
  const hashesPath = path.join(buildRoot, "assets/asset-hashes.json");

  if (!existsSync(hashesPath)) {
    return { ok: false, error: "asset-hashes.json not found" };
  }

  let hashes;
  try {
    const raw = await readFile(hashesPath, "utf8");
    hashes    = JSON.parse(raw);
  } catch {
    return { ok: false, error: "asset-hashes.json is malformed" };
  }

  // Recompute chain hash
  const sortedHashes = Object.entries(hashes.entries || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, h]) => `${id}:${h}`)
    .join("|");
  const recomputed = _sha256(sortedHashes);

  if (recomputed !== hashes.chainHash) {
    return {
      ok:    false,
      error: `Asset chain hash mismatch. Expected ${hashes.chainHash}, got ${recomputed}`,
    };
  }

  return { ok: true };
};

export { AssetPackager, ASSET_TYPE };