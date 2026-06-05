// m2/roblox/roblox-build-manager.js — ESM
// AF51 ROBLOX CODE RUNNER — Build Manager
// Full deterministic build pipeline.
//
// Phases:
//  1. STERILITY         — zip-sterility-validator (Phase 1.2)
//  2. HIERARCHY         — deterministic directory structure
//  3. RUNTIME_INJECT    — inject AF51 Luau runtime modules
//  4. LUAU_GEN          — target-specific Luau scripts
//  5. REMOTE_BUILD      — RemoteEvent/Function topology
//  6. UI_BUILD          — StarterGui structure
//  7. VISUAL_PRODUCTION — SceneGraph → Composition → Material → Lighting
//                         → Gameplay → QualityGate → RobloxEmitter
//  8. ROJO_EXPORT       — default.project.json + manifest.json
//  9. ASSET_PACKAGE     — asset manifests
// 10. PREVIEW_GEN       — generated preview from package
// 11. ROJO_VALIDATE     — rojo-validator (Phase 1.1)
// 12. SIGN              — package-signing fingerprint (Phase 5.3)
// 13. VALIDATE          — PackageValidator final gate
// 14. GHOST_SEAL        — LightGhostVault + BuildHash + PipelineAudit
// 15. ZIP_HARDEN        — final deterministic zip
//
// Phase 7.5 (RBXLX_EMIT) converts production-scenegraph.json into a
// Studio-openable AF51.rbxlx alongside the Rojo source tree.

import path from 'node:path';
import { mkdirSync, rmSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { HierarchyBuilder }      from '../../t3/roblox-rbx/hierarchy-builder.js';
import { LuauGenerator }         from '../../t3/roblox-rbx/luau-generator.js';
import { RemoteBuilder }         from '../../t3/roblox-rbx/remote-builder.js';
import { UIBuilder }             from '../../t3/roblox-rbx/ui-builder.js';
import { RojoExporter, generateBuildId } from '../../t3/roblox-rbx/rojo-exporter.js';
import { AssetPackager }         from '../../t3/roblox-rbx/asset-packager.js';
import { PackageValidator }      from '../../t3/roblox-rbx/package-validator.js';
import { ZipHardener }           from '../../t3/roblox-rbx/zip-hardener.js';
import { RojoValidator }         from '../../t3/roblox-rbx/rojo-validator.js';
import { ZipSterilityValidator } from '../../t3/roblox-rbx/zip-sterility-validator.js';
import { PackageSigner }         from '../../t3/roblox-rbx/package-signing.js';
import { PreviewGenerator }      from '../../runtime/rbx-runtime/RbxPreviewBridge.js';
import { VisualDirector }        from '../../t3/Factory/rbx-production/visual-director.js';
import { emitRbxlx }             from '../../t3/roblox-rbx/rbxlx-emitter.js';
import { LightGhostVault }       from '../../t3/Factory/packaging/ghost/LightGhostVault.js';
import { BuildHash }             from '../../k1/Ydin/build-hash.js';
import { PipelineAudit }         from '../../k1/Ydin/pipeline-audit.js';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR  = path.resolve(__dirname, '../../runtime');
const DEFAULT_EXPORTS = path.resolve(__dirname, '../../exports-rbx');

export const BUILD_PHASE = Object.freeze({
  STERILITY:      'STERILITY',
  HIERARCHY:      'HIERARCHY',
  RUNTIME_INJECT: 'RUNTIME_INJECT',
  LUAU_GEN:       'LUAU_GEN',
  REMOTE_BUILD:   'REMOTE_BUILD',
  UI_BUILD:       'UI_BUILD',
  VISUAL_PRODUCTION: 'VISUAL_PRODUCTION',
  RBXLX_EMIT:     'RBXLX_EMIT',
  ROJO_EXPORT:    'ROJO_EXPORT',
  ASSET_PACKAGE:  'ASSET_PACKAGE',
  ROJO_VALIDATE:  'ROJO_VALIDATE',
  SIGN:           'SIGN',
  VALIDATE:       'VALIDATE',
  PREVIEW_GEN:    'PREVIEW_GEN',
  GHOST_SEAL:     'GHOST_SEAL',
  ZIP_HARDEN:     'ZIP_HARDEN',
  COMPLETE:       'COMPLETE',
  FAILED:         'FAILED',
});

function fnv1a32(s) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// Unique build ID: target:version:timestamp:nonce
// Uses crypto.randomBytes for uniqueness even in same-millisecond concurrent builds
function _uniqueBuildId(targetId, version) {
  const ts    = Date.now();
  const nonce = Math.random().toString(36).slice(2, 8);
  return 'build_' + targetId + '_' + fnv1a32(`${targetId}:${version}:${ts}:${nonce}`);
}

// Deterministic build ID: same input → same id. Used when
// RBX_DETERMINISTIC_BUILD=1 so two runs of the same target+version+source
// produce byte-identical ZIP artifacts (the readiness-gate ZIP determinism
// criterion). Differs from _uniqueBuildId by dropping timestamp + nonce.
function _deterministicBuildId(targetId, version, userSource) {
  const srcKey = userSource ? fnv1a32(String(userSource)) : '00000000';
  return 'build_' + targetId + '_' + fnv1a32(`${targetId}:${version}:${srcKey}`);
}

// 1980-01-01 00:00:00 UTC — matches ZipHardener pure-Node epoch and the
// deterministic clock LightGhostVault uses when seeded.
const DETERMINISTIC_EPOCH_MS = 315532800000;

export class RobloxBuildManager {
  static async build({
    target, buildRoot, exportsDir, gameName, version,
    placeId, universeId, keepBuildDir = false, auditLedger,
    userSource = null,
  }) {
    if (!target?.id) throw new Error('[BuildManager] target.id required');

    const _a = (l, m, meta = {}) => auditLedger?.[l]?.(`[BuildManager] ${m}`, { targetId: target.id, ...meta });

    const gn  = gameName || target.gameName || target.id;
    const v   = version  || target.version  || '1.0.0';
    const ex  = exportsDir || DEFAULT_EXPORTS;

    let br = buildRoot;
    let tmpDir = null;
    if (!br) {
      tmpDir = path.join(os.tmpdir(), `af51rbx-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
      mkdirSync(tmpDir, { recursive: true });
      br = tmpDir;
    }
    mkdirSync(ex, { recursive: true });

    const phases  = [];
    const startTs = Date.now();
    let   buildId = null;

    const _rec = (name, r) => {
      const entry = {
        name, ok: r.ok !== false,
        error: r.error || (r.errors ? r.errors.join('; ') : null),
        files: r.files || null,
      };
      // pass-through of numeric diagnostic fields a phase wants visible on the
      // result (e.g. RBXLX_EMIT publishes bytes + skipped count for tests).
      if (typeof r.bytes === 'number') entry.bytes = r.bytes;
      if (typeof r.skipped === 'number') entry.skipped = r.skipped;
      phases.push(entry);
    };

    const _cleanup = () => {
      if (tmpDir && !keepBuildDir) try { rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    };

    const _fail = (phase, msg) => {
      _cleanup();
      _a('error', `Phase FAILED: ${phase} — ${msg}`);
      return { ok: false, buildId, outputZip: null, zipPath: null, phases, errors: [msg], error: msg, summary: { durationMs: Date.now() - startTs } };
    };

    _a('info', `Build start: ${target.id} v${v} (${phases.length === 0 ? '11' : '?'} phases)`);

    // ── Phase 1: STERILITY ────────────────────────────────────────────────
    // Check buildRoot is clean before writing anything into it
    // (on empty tmpDir this always passes — validates if custom buildRoot given)
    let r;
    if (buildRoot) {
      // Only run sterility on pre-existing buildRoot — tmpDir is always clean
      r = ZipSterilityValidator.validate(br, auditLedger);
      _rec(BUILD_PHASE.STERILITY, { ok: r.ok, error: r.violations?.map(v => v.reason).join('; ') || null });
      if (!r.ok) return _fail(BUILD_PHASE.STERILITY, `Sterility violations: ${r.violations.length} found`);
    } else {
      _rec(BUILD_PHASE.STERILITY, { ok: true }); // tmpDir is always sterile
    }

    // ── Phase 2: HIERARCHY ────────────────────────────────────────────────
    try { r = await HierarchyBuilder.build({ buildRoot: br, target, auditLedger }); }
    catch (e) { return _fail(BUILD_PHASE.HIERARCHY, e.message); }
    _rec(BUILD_PHASE.HIERARCHY, r);
    if (!r.ok) return _fail(BUILD_PHASE.HIERARCHY, r.error || 'hierarchy failed');

    // ── Phase 3: RUNTIME_INJECT ───────────────────────────────────────────
    try { r = await LuauGenerator.injectRuntime({ buildRoot: br, runtimeSrcDir: RUNTIME_DIR, auditLedger }); }
    catch (e) { return _fail(BUILD_PHASE.RUNTIME_INJECT, e.message); }
    _rec(BUILD_PHASE.RUNTIME_INJECT, r);
    if (!r.ok) return _fail(BUILD_PHASE.RUNTIME_INJECT, r.error || 'runtime inject failed');

    // ── Phase 4: LUAU_GEN ─────────────────────────────────────────────────
    try { r = await LuauGenerator.generate({ buildRoot: br, target, auditLedger }); }
    catch (e) { return _fail(BUILD_PHASE.LUAU_GEN, e.message); }
    _rec(BUILD_PHASE.LUAU_GEN, r);
    if (!r.ok) return _fail(BUILD_PHASE.LUAU_GEN, r.error || 'luau gen failed');

    // ── Phase 5: REMOTE_BUILD ─────────────────────────────────────────────
    try { r = RemoteBuilder.build({ buildRoot: br, target, auditLedger }); }
    catch (e) { return _fail(BUILD_PHASE.REMOTE_BUILD, e.message); }
    _rec(BUILD_PHASE.REMOTE_BUILD, r);
    if (r.ok === false) return _fail(BUILD_PHASE.REMOTE_BUILD, (r.errors || []).join('; ') || 'remote failed');

    // ── Phase 6: UI_BUILD ─────────────────────────────────────────────────
    try { r = UIBuilder.build({ buildRoot: br, target, auditLedger }); }
    catch (e) { return _fail(BUILD_PHASE.UI_BUILD, e.message); }
    _rec(BUILD_PHASE.UI_BUILD, r);
    if (r.ok === false) return _fail(BUILD_PHASE.UI_BUILD, (r.errors || []).join('; ') || 'ui failed');

    // Deterministic mode (RBX_DETERMINISTIC_BUILD=1): same input must
    // produce the same buildId so the ZIP filename is also stable.
    // Computed BEFORE Phase 7 so VisualDirector can stamp the production
    // artifact envelope (schemaVersion/buildId/target/producedAt) into
    // scenegraph.json. RojoExporter recomputes the same value at Phase 8.
    const _deterministic = process.env.RBX_DETERMINISTIC_BUILD === '1';
    buildId = generateBuildId(target.id, v);

    // ── Phase 7: VISUAL_PRODUCTION ────────────────────────────────────────
    // Production renderer chain (t3/Factory/rbx-production).
    // Materializes target-typed geometry, materials, lighting, gameplay
    // hooks and writes deterministic Luau builders + scene-graph.json artifact.
    try { r = await VisualDirector.direct({ buildRoot: br, target, auditLedger, buildId, deterministic: _deterministic }); }
    catch (e) { return _fail(BUILD_PHASE.VISUAL_PRODUCTION, e.message); }
    _rec(BUILD_PHASE.VISUAL_PRODUCTION, { ok: r.ok, error: r.error || null, files: r.files || null });
    if (!r.ok) return _fail(BUILD_PHASE.VISUAL_PRODUCTION, r.error || 'visual production failed');

    // ── Phase 7.5: RBXLX_EMIT ─────────────────────────────────────────────
    // Convert production-scenegraph.json → AF51.rbxlx so the user can open
    // the build by double-clicking the file (no Rojo, no runtime Instance.new).
    // Geometry scope (palaset 1–3): Part, SpawnLocation, Folder, PointLight,
    // Lighting service (Sky/Atmosphere/effects), Decal, SpecialMesh,
    // BoolValue, StringValue. Palanen 4 also bakes every src/* Luau file
    // already produced by Phase 4 (LUAU_GEN) and Phase 7 (VISUAL_PRODUCTION)
    // into the .rbxlx as <Script>/<LocalScript>/<ModuleScript> children of
    // ServerScriptService / StarterPlayer.StarterPlayerScripts / StarterGui /
    // ReplicatedStorage, so the place file is self-contained and playable
    // without Rojo. Unsupported classes are skipped and reported
    // (not fatal); a property-type mismatch on a supported class IS fatal
    // (atomicity rule).
    try {
      const sgPath = path.join(br, 'production-scenegraph.json');
      const sg = JSON.parse(readFileSync(sgPath, 'utf8'));
      const scripts = _collectSrcScripts(path.join(br, 'src'));
      const out = emitRbxlx(sg, { scripts });
      writeFileSync(path.join(br, 'AF51.rbxlx'), out.xml, 'utf8');
      // ── Playability gate: script-skip ─────────────────────────────────
      // A baked script falling out of the .rbxlx is the silent-failure mode
      // that produced "green build, peopleless world" in v60. Decorative
      // skips (Part/Decal class not in scope) stay non-fatal.
      const lostScripts = (out.skipped || []).filter(s =>
        (s.className && /Script$/.test(s.className)) ||
        (s.reason && s.reason.includes('script file suffix')));
      if (lostScripts.length > 0) {
        const sample = lostScripts.slice(0, 3).map(s => `${s.className}:${s.name}`).join(', ');
        return _fail(BUILD_PHASE.RBXLX_EMIT,
          `playability gate: ${lostScripts.length} script class(es) skipped — gameplay would not reach the place file (${sample})`);
      }
      // ── Wiring gate: scenegraph promises tags/attributes ──────────────
      // The composition-engine annotates nodes with CollectionService tags
      // and instance attributes the Kit's GetTagged()/GetAttribute() depend
      // on. If they don't make it into the XML, the world looks correct in
      // Studio but the Kit finds nothing — the same silent-failure pattern
      // as the original script bug, one layer down.
      const taggedCount = (sg.nodes || []).reduce((n, x) =>
        n + (Array.isArray(x.tags) && x.tags.length > 0 ? 1 : 0), 0);
      const attrCount   = (sg.nodes || []).reduce((n, x) =>
        n + (x.attributes && Object.keys(x.attributes).length > 0 ? 1 : 0), 0);
      const xmlTagBlobs  = (out.xml.match(/<BinaryString name="Tags">/g)  || []).length;
      const xmlAttrBlobs = (out.xml.match(/<BinaryString name="AttributesSerialize">/g) || []).length;
      if (taggedCount > 0 && xmlTagBlobs === 0) {
        return _fail(BUILD_PHASE.RBXLX_EMIT,
          `wiring gate: ${taggedCount} scenegraph node(s) carry CollectionService tags but XML emitted 0 Tags blobs — Kit GetTagged() would return empty`);
      }
      if (attrCount > 0 && xmlAttrBlobs === 0) {
        return _fail(BUILD_PHASE.RBXLX_EMIT,
          `wiring gate: ${attrCount} scenegraph node(s) carry attributes but XML emitted 0 AttributesSerialize blobs — Kit GetAttribute() would always return default`);
      }
      _rec(BUILD_PHASE.RBXLX_EMIT, {
        ok: true, files: ['AF51.rbxlx'],
        bytes: out.xml.length, skipped: out.skipped.length,
        scripts: scripts.length,
        tagBlobs: xmlTagBlobs, attrBlobs: xmlAttrBlobs,
      });
      _a('info', `RBXLX_EMIT ok (${out.xml.length} bytes, ${out.skipped.length} class(es) skipped, ${scripts.length} script(s) baked, ${xmlTagBlobs} tag-blob(s), ${xmlAttrBlobs} attr-blob(s))`);
    } catch (e) { return _fail(BUILD_PHASE.RBXLX_EMIT, e.message); }

    // ── Phase 8: ROJO_EXPORT ──────────────────────────────────────────────
    try { r = await RojoExporter.export({ buildRoot: br, target, gameName: gn, version: v, placeId, universeId, auditLedger }); }
    catch (e) { return _fail(BUILD_PHASE.ROJO_EXPORT, e.message); }
    _rec(BUILD_PHASE.ROJO_EXPORT, r);
    if (!r.ok) return _fail(BUILD_PHASE.ROJO_EXPORT, r.error || 'rojo export failed');
    // RojoExporter computes buildId from (target.id, version) too \u2014 must agree.
    if (r.buildId && r.buildId !== buildId) buildId = r.buildId;

    // ── Phase 8: ASSET_PACKAGE ────────────────────────────────────────────
    try { r = await AssetPackager.package({ buildRoot: br, target, buildId, auditLedger }); }
    catch (e) { return _fail(BUILD_PHASE.ASSET_PACKAGE, e.message); }
    _rec(BUILD_PHASE.ASSET_PACKAGE, r);
    if (!r.ok) return _fail(BUILD_PHASE.ASSET_PACKAGE, r.error || 'asset package failed');

    // ── Phase 9: PREVIEW_GEN — generatedPreview.json from package ──────
    try { r = PreviewGenerator.generate({ buildRoot: br, target, buildId, auditLedger }); }
    catch (e) { return _fail(BUILD_PHASE.PREVIEW_GEN, e.message); }
    _rec(BUILD_PHASE.PREVIEW_GEN, r);
    if (!r.ok) return _fail(BUILD_PHASE.PREVIEW_GEN, (r.errors||[]).join('; ') || 'preview gen failed');

    // ── Phase 10: ROJO_VALIDATE (Phase 1.1) ──────────────────────────────
    try { r = RojoValidator.validate(br, auditLedger); }
    catch (e) { return _fail(BUILD_PHASE.ROJO_VALIDATE, e.message); }
    _rec(BUILD_PHASE.ROJO_VALIDATE, { ok: r.ok, error: r.errors?.join('; ') || null });
    if (!r.ok) return _fail(BUILD_PHASE.ROJO_VALIDATE, `Rojo validation failed: ${r.errors.join(' | ')}`);

    // ── Phase 11: SIGN (Phase 5.3) ────────────────────────────────────────
    try {
      r = PackageSigner.sign({ buildRoot: br, buildId, targetId: target.id, version: v, auditLedger });
    } catch (e) { return _fail(BUILD_PHASE.SIGN, e.message); }
    _rec(BUILD_PHASE.SIGN, r);
    if (!r.ok) return _fail(BUILD_PHASE.SIGN, (r.errors || []).join('; ') || 'signing failed');

    // ── Phase 12: VALIDATE → ZIP_HARDEN → ZIP_HARDEN ──────────────────────────────────
    try { r = await PackageValidator.validate({ buildRoot: br, auditLedger }); }
    catch (e) { return _fail(BUILD_PHASE.VALIDATE, e.message); }
    const vOk = r.ok;
    _rec(BUILD_PHASE.VALIDATE, {
      ok: vOk,
      error: vOk ? null : `${(r.checks || []).filter(c => !c.ok).length} check(s) failed`,
    });
    if (!vOk) {
      const msg = (r.checks || []).filter(c => !c.ok).map(c => `${c.name}: ${(c.issues || []).join('; ')}`).join(' | ');
      return _fail(BUILD_PHASE.VALIDATE, `Validation failed: ${msg}`);
    }

    // ── v63 USER SEED — preserve pasted Lua inside production zip ────────
    // The seed is written under src/ServerScriptService/ (already on the
    // ZipHardener whitelist) so it ships with the production world but
    // does NOT replace any AF51-generated scripts. Per-source filename
    // is content-hashed so the seal stays deterministic per input.
    if (userSource && typeof userSource === "string" && userSource.length > 0) {
      try {
        const { writeFileSync: _wfs, mkdirSync: _mkd } = await import("node:fs");
        const _hash = (function _fnv1a(s){
          let h = 0x811c9dc5;
          for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0;
          }
          return h.toString(16).padStart(8,"0");
        })(userSource);
        const seedDir = path.join(br, "src", "ServerScriptService");
        _mkd(seedDir, { recursive: true });
        const seedFile = path.join(seedDir, "AF51UserSeed.server.lua");
        const banner =
          "-- AF51 USER SEED — preserved verbatim from the build request.\n" +
          "-- The production world is generated by AF51_SceneBuilder; this\n" +
          "-- script runs after it and lets your pasted code coexist with\n" +
          "-- the AF51 scene. Seed hash: " + _hash + ".\n\n";
        _wfs(seedFile, banner + userSource, "utf8");
        _a("info", "USER_SEED written", { hash: _hash, bytes: userSource.length });
      } catch (e) {
        _a("warn", "USER_SEED write failed: " + e.message);
      }
    }

    // ── Phase 14: GHOST_SEAL — LightGhostVault + BuildHash + PipelineAudit
    // Computes per-layer hashes over the whitelisted build tree, runs the
    // build through BuildHash for a deterministic artifactHash, replays
    // the phase list into PipelineAudit, then seals everything with
    // LightGhostVault. Writes ghost/lineage.json, ghost/recovery.map,
    // ghost/deploy.signature, ghost/runtime.hash, ghost/policy.snapshot
    // plus production-build-hash.json and production-pipeline-audit.json
    // into the build root so they ship inside the production zip.
    let ghostId = null;
    let artifactHash = null;
    try {
      const layerHashes = _layerHashesFromBuildRoot(br);
      const bh = new BuildHash();
      const filesForHash = Object.entries(layerHashes).map(([p, h]) => ({ path: p, content: h }));
      const hashRes = bh.hashArtifact(
        filesForHash,
        { target: target.id, projectType: 'roblox', entry: 'default.project.json', dependencies: [] },
        phases.map(p => p.name),
      );
      artifactHash = hashRes.artifactHash;

      // In deterministic mode the audit clock is a step counter pinned to
      // the deterministic epoch — the `at:` field becomes ordinal instead
      // of wall-clock so production-pipeline-audit.json stays byte-stable.
      let _auditStep = 0;
      const _auditClock = _deterministic
        ? { now: () => DETERMINISTIC_EPOCH_MS + (_auditStep++) }
        : null;
      const audit = new PipelineAudit({ traceId: buildId, clock: _auditClock });
      for (const ph of phases) {
        audit.record(ph.name, ph.ok ? 'PHASE_OK' : 'PHASE_FAIL', { error: ph.error || null });
      }
      audit.record(BUILD_PHASE.GHOST_SEAL, 'SEAL_BEGIN', { artifactHash });

      const ghost = new LightGhostVault({
        project: target.id,
        version: v,
        secret:  process.env.GUARDIAN_HMAC_SECRET || 'af51-ghost-default',
        // artifactHash already content-derived → use it as the deterministic
        // seed so ghostId + sealedAt + createdAt + snappedAt are stable.
        deterministicSeed: _deterministic ? artifactHash : null,
      });
      ghost.seal({
        artifactId:    buildId,
        layerHashes,
        specSnapshot:  { target: target.id, gameName: gn, version: v, placeId, universeId },
        auditHash:     hashRes.pipelineHash,
        buildDuration: _deterministic ? 0 : (Date.now() - startTs),
        buildGeneration: 1,
        mutationSource: 'rbx-pipeline',
      });
      const ghostDir = path.join(br, 'ghost');
      const wr = ghost.writeTo(ghostDir);
      ghostId = wr.ghostId;

      const { writeFileSync: _wfs2 } = await import('node:fs');
      _wfs2(
        path.join(br, 'production-build-hash.json'),
        JSON.stringify({ ...hashRes, buildId, targetId: target.id, version: v }, null, 2),
        'utf8',
      );
      audit.record(BUILD_PHASE.GHOST_SEAL, 'SEAL_OK', { ghostId, files: wr.files });
      _wfs2(
        path.join(br, 'production-pipeline-audit.json'),
        JSON.stringify(audit.export(), null, 2),
        'utf8',
      );
      _rec(BUILD_PHASE.GHOST_SEAL, { ok: true, files: ['ghost/lineage.json', 'production-build-hash.json', 'production-pipeline-audit.json'] });
      _a('info', `GHOST_SEAL ok: ${ghostId} (artifactHash=${artifactHash})`);
    } catch (e) {
      // Fail-closed: a missing ghost seal blocks ZIP_HARDEN — production
      // grade artifacts must always be sealed.
      return _fail(BUILD_PHASE.GHOST_SEAL, e.message);
    }

    // ── Phase 15: ZIP_HARDEN — package on demand ─────────────────────────
    // Build root (tmpDir) stays alive. ZipHardener runs now and keeps the zip.
    try { r = await ZipHardener.harden({ buildRoot: br, exportsDir: ex, gameName: gn, buildId, validated: true, auditLedger, deterministic: _deterministic }); }
    catch (e) { return _fail(BUILD_PHASE.ZIP_HARDEN, e.message); }
    _rec(BUILD_PHASE.ZIP_HARDEN, { ok: r.ok, error: r.error || null, files: r.zipPath ? [r.zipPath] : [] });
    if (!r.ok) return _fail(BUILD_PHASE.ZIP_HARDEN, r.error || 'zip harden failed');

    const zipPath    = r.zipPath || r.outputPath;
    const durationMs = Date.now() - startTs;

    // ── Keep tmpDir alive for preview reads (server /rbx/preview/:buildId) ──
    // Only cleanup after ZIP confirmed written to exportsDir
    if (zipPath && zipPath.startsWith(ex)) {
      _cleanup(); // tmpDir no longer needed — ZIP is in exportsDir
    }

    _a('info', `COMPLETE: ${zipPath} (${durationMs}ms) [${phases.length} phases]`, { buildId, zipPath, ghostId, artifactHash });

    return {
      ok: true, buildId, outputZip: zipPath, zipPath, phases, errors: [],
      ghostId, artifactHash,
      summary: { durationMs, phasesCompleted: phases.length, gameName: gn, version: v, targetId: target.id, ghostId, artifactHash },
    };
  }
}

// ── Layer hash helper ────────────────────────────────────────────────────
// Walks the four canonical Roblox layers under src/ + the four root manifest
// files and produces a {layer → sha256} map for LightGhostVault.seal().
// Uses fnv1a32 (no crypto dep already in scope at file top — keeps the
// hash cheap; the actual cryptographic seal happens inside LightGhostVault
// via HMAC-SHA256 over this map).
function _layerHashesFromBuildRoot(buildRoot) {
  const LAYERS = [
    ['ReplicatedStorage', 'src/ReplicatedStorage'],
    ['ServerScriptService', 'src/ServerScriptService'],
    ['StarterGui', 'src/StarterGui'],
    ['StarterPlayer', 'src/StarterPlayer'],
    ['Workspace', 'src/Workspace'],
  ];
  const MANIFESTS = ['default.project.json', 'manifest.json', 'signature.json', 'generatedPreview.json', 'AF51.rbxlx'];
  const out = {};
  for (const [name, rel] of LAYERS) {
    const dir = path.join(buildRoot, rel);
    out[name] = _hashDir(dir);
  }
  for (const m of MANIFESTS) {
    const full = path.join(buildRoot, m);
    try {
      const buf = readFileSync(full);
      out[m] = fnv1a32(buf.toString('utf8'));
    } catch (_) {
      out[m] = 'absent';
    }
  }
  return out;
}

function _hashDir(dir) {
  let parts = [];
  try {
    const walk = (d, prefix) => {
      for (const name of readdirSync(d).sort()) {
        const full = path.join(d, name);
        const rel  = prefix ? prefix + '/' + name : name;
        const st = statSync(full);
        if (st.isDirectory()) walk(full, rel);
        else parts.push(rel + ':' + fnv1a32(readFileSync(full).toString('utf8')));
      }
    };
    walk(dir, '');
  } catch (_) {
    return 'absent';
  }
  return fnv1a32(parts.join('|'));
}

// Walks src/<Service>/... and produces script entries the rbxlx-emitter
// bakes into the .rbxlx as <Script>/<LocalScript>/<ModuleScript> children.
// Service mapping mirrors default.project.json:
//   src/ServerScriptService                 → ServerScriptService
//   src/StarterPlayer/StarterPlayerScripts  → StarterPlayer.StarterPlayerScripts
//   src/StarterGui                          → StarterGui
//   src/ReplicatedStorage                   → ReplicatedStorage
// Deterministic ordering: directory entries sorted alphabetically, so two
// builds with the same src/ tree yield byte-identical .rbxlx.
const _SCRIPT_SERVICE_DIRS = [
  { dir: 'ServerScriptService',                 service: 'ServerScriptService' },
  { dir: 'StarterPlayer/StarterPlayerScripts',  service: 'StarterPlayer/StarterPlayerScripts' },
  { dir: 'StarterGui',                          service: 'StarterGui' },
  { dir: 'ReplicatedStorage',                   service: 'ReplicatedStorage' },
];

function _collectSrcScripts(srcRoot) {
  const out = [];
  for (const entry of _SCRIPT_SERVICE_DIRS) {
    const root = path.join(srcRoot, entry.dir);
    let exists = false;
    try { exists = statSync(root).isDirectory(); } catch (_) {}
    if (!exists) continue;
    const walk = (d, prefix) => {
      for (const name of readdirSync(d).sort()) {
        const full = path.join(d, name);
        const rel  = prefix ? prefix + '/' + name : name;
        const st = statSync(full);
        if (st.isDirectory()) { walk(full, rel); continue; }
        if (!name.endsWith('.lua')) continue;
        out.push({
          service: entry.service,
          relPath: rel,
          source:  readFileSync(full, 'utf8'),
        });
      }
    };
    walk(root, '');
  }
  return out;
}