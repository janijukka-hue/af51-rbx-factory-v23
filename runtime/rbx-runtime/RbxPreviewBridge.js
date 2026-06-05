// runtime/rbx-runtime/RbxPreviewBridge.js
// AF51-RBX — Phase 9 adapter.
// Reads the REAL generated Workspace Lua from the build package, runs it through
// the deterministic Lua → AST → graph → preview chain, and writes
// generatedPreview.json. Replaces the removed hardcoded PreviewGenerator.
//
// No hardcoded scenes. No execution. Preview reflects the actual built artifact.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LuaParser } from './LuaParser.js';
import { InstanceGraphBuilder } from './InstanceGraphBuilder.js';
import { PreviewRenderer } from './PreviewRenderer.js';

// Walk a directory, collecting .lua files (sync, deterministic order).
function collectLua(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...collectLua(full));
    else if (e.name.endsWith('.lua') || e.name.endsWith('.luau')) out.push(full);
  }
  return out;
}

// Map a Lua file name → Roblox script class. Honours Rojo conventions:
//   *.server.lua  → Script         (server-only)
//   *.client.lua  → LocalScript    (client-only)
//   anything else → ModuleScript   (required by other scripts)
function scriptClassFor(name) {
  if (/\.server\.lua[u]?$/i.test(name)) return 'Script';
  if (/\.client\.lua[u]?$/i.test(name)) return 'LocalScript';
  return 'ModuleScript';
}

// Strip Rojo suffixes for the display label.
function scriptLabelFor(name) {
  return name.replace(/\.(server|client)\.lua[u]?$/i, '').replace(/\.lua[u]?$/i, '');
}

// Walk src/, emit synthetic file-tree nodes (folders + scripts) so the preview
// shows the actual Roblox DataModel the player will see. Deterministic order:
// directories are visited alphabetically.
function buildFileTreeNodes(srcDir, startId) {
  const structures = [];
  let nextId = startId;
  if (!fs.existsSync(srcDir)) return { structures, nextId };

  // Each top-level directory under src/ is a Roblox service.
  const serviceDirs = fs.readdirSync(srcDir, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();

  for (const svc of serviceDirs) {
    walkDir(path.join(srcDir, svc), svc, svc);
  }
  return { structures, nextId };

  function walkDir(dir, parentRojoPath, parentLabel) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const id = `tree_${nextId++}`;
        structures.push({
          id, type: 'platform', label: e.name.toUpperCase(),
          x: 0, y: 0, z: 0, w: 4, h: 1, d: 4,
          color: '#3A4250', glow: false,
          luaClass: 'Folder', parent: parentRojoPath,
          anchored: false, material: 'SmoothPlastic', shape: 'Folder',
        });
        walkDir(full, parentRojoPath + '/' + e.name, e.name);
      } else if (e.name.endsWith('.lua') || e.name.endsWith('.luau')) {
        const cls = scriptClassFor(e.name);
        const id = `tree_${nextId++}`;
        structures.push({
          id, type: 'platform', label: scriptLabelFor(e.name).toUpperCase(),
          x: 0, y: 0, z: 0, w: 3, h: 1, d: 3,
          color: cls === 'Script' ? '#A8FF2F' : cls === 'LocalScript' ? '#25D0FF' : '#C2A0FF',
          glow: false,
          luaClass: cls, parent: parentRojoPath,
          anchored: false, material: 'SmoothPlastic', shape: cls,
        });
      }
    }
  }
}

// Extract NetworkLayer.declareRemote("Name", "Event"|"Function", "C2S"|"S2C")
// calls — the v60 idiom for declaring RemoteEvents / RemoteFunctions instead
// of raw Instance.new. Deterministic by file order, then source order.
function extractDeclaredRemotes(luaFiles, startId) {
  const structures = [];
  const seen = new Set();
  let nextId = startId;
  const re = /declareRemote\(\s*["']([^"']+)["']\s*,\s*["'](Event|Function)["']\s*(?:,\s*["']([^"']+)["'])?\s*\)/g;
  for (const file of luaFiles) {
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(src)) !== null) {
      const [, name, kind, dir] = m;
      const key = name + '|' + kind;
      if (seen.has(key)) continue;
      seen.add(key);
      const cls = kind === 'Event' ? 'RemoteEvent' : 'RemoteFunction';
      structures.push({
        id: `rem_${nextId++}`, type: 'effect',
        label: name.toUpperCase(),
        x: 0, y: 0, z: 0, w: 2, h: 2, d: 2,
        color: kind === 'Event' ? '#46C0FF' : '#FFB046',
        glow: true,
        luaClass: cls, parent: 'ReplicatedStorage/Remotes',
        anchored: false, material: 'Neon', shape: cls,
        direction: dir || null,
      });
    }
    re.lastIndex = 0;
  }
  return { structures, nextId };
}

export const PreviewGenerator = {
  // Same signature the build-manager already calls: ({ buildRoot, target, buildId, auditLedger })
  generate({ buildRoot, target, buildId, auditLedger }) {
    try {
      const srcDir = path.join(buildRoot, 'src');
      // Prefer Workspace Lua (the geometry), fall back to all src Lua.
      // Prefer Workspace Lua (geometry). If Workspace exists but is
      // empty (placeholder dir), fall through to scanning the full src/
      // tree so script-only targets still produce a real preview.
      const wsDir = path.join(srcDir, 'Workspace');
      let luaFiles = fs.existsSync(wsDir) ? collectLua(wsDir) : [];
      if (luaFiles.length === 0) luaFiles = collectLua(srcDir);

      const parser = new LuaParser();
      const builder = new InstanceGraphBuilder();
      const renderer = new PreviewRenderer();

      // Merge AST nodes from every Lua file (deterministic file order).
      const mergedNodes = [];
      for (const file of luaFiles) {
        const source = fs.readFileSync(file, 'utf8');
        const ast = parser.parse(source);
        for (const n of ast.nodes) mergedNodes.push(n);
      }

      const graph = builder.build({ nodes: mergedNodes });
      const rendered = renderer.render(graph);

      // Enrich with synthetic nodes the LuaParser doesn't recognise:
      //  - The actual DataModel file tree (each .lua → Script/LocalScript/ModuleScript)
      //  - Every NetworkLayer.declareRemote(...) call → a RemoteEvent / RemoteFunction
      let nextId = rendered.structures.length + 1;
      const tree = buildFileTreeNodes(srcDir, nextId);
      nextId = tree.nextId;
      const remotes = extractDeclaredRemotes(luaFiles, nextId);
      nextId = remotes.nextId;

      const allStructures = rendered.structures
        .concat(tree.structures)
        .concat(remotes.structures);

      // Production-artifact envelope — same contract RobloxEmitter applies
      // to production-scenegraph.json so both files agree on schemaVersion,
      // target, buildId, and producedAt. producedAt is pinned to the 1980
      // epoch when RBX_DETERMINISTIC_BUILD=1 to keep byte-stability.
      const _det = process.env.RBX_DETERMINISTIC_BUILD === '1';
      const _producedAt = _det ? 315532800000 : Date.now();

      // Cross-reference the scenegraph as ground truth — embeds its SHA-256
      // (when present) so UI/Studio can verify they're looking at the same
      // build's geometry.
      let scenegraphRef = null;
      const _sgPath = path.join(buildRoot, 'production-scenegraph.json');
      if (fs.existsSync(_sgPath)) {
        const _sgBuf = fs.readFileSync(_sgPath);
        const _sgHash = crypto.createHash('sha256').update(_sgBuf).digest('hex');
        let _sgNodeCount = null;
        try { _sgNodeCount = (JSON.parse(_sgBuf.toString('utf8')).nodes || []).length; } catch { /* ignore */ }
        scenegraphRef = { path: 'production-scenegraph.json', sha256: _sgHash, nodeCount: _sgNodeCount };
      }

      // Build the generatedPreview.json the rest of the pipeline expects.
      const preview = {
        schemaVersion: '1.1.0',
        kind: 'rbx-preview',
        buildId: buildId || null,
        target: target && target.id ? target.id : String(target || 'unknown'),
        producedAt: _producedAt,
        source: 'lua-object-graph',
        scenegraphRef,
        structures: allStructures,
        lighting: { ambient: '#0F0F1A', sky: '#06080F', fogColor: '#080814', neonColor: '#25D0FF' },
        camera: { viewX: 10, viewZ: 8, rotation: 'slow_orbit', elevation: 30 },
        runtime: {
          modules: ['AuditRuntime', 'EventBus', 'NetworkLayer', 'RuntimeInit', 'ServiceRegistry', 'StateStore'],
          governance: 'k1-governed',
        },
        hierarchy: {
          luaFileCount: luaFiles.length,
          rojoReady: true,
          fileTreeNodes: tree.structures.length,
          declaredRemotes: remotes.structures.length,
          parsedInstances: rendered.structures.length,
        },
      };

      const outPath = path.join(buildRoot, 'generatedPreview.json');
      fs.writeFileSync(outPath, JSON.stringify(preview, null, 2), 'utf8');

      if (auditLedger && typeof auditLedger.info === 'function') {
        auditLedger.info(
          `PREVIEW_GEN: ${allStructures.length} structures from ${luaFiles.length} Lua files ` +
          `(parsed=${rendered.structures.length}, tree=${tree.structures.length}, remotes=${remotes.structures.length})`
        );
      }

      return { ok: true, structureCount: allStructures.length, luaFileCount: luaFiles.length, previewPath: outPath };
    } catch (e) {
      return { ok: false, errors: [e.message] };
    }
  },
};

export default PreviewGenerator;
