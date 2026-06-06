// runtime/rbx-runtime/LuaProjectBuilder.js
// AF51-RBX — Turns user-supplied Roblox Lua into a Studio-ready Rojo project ZIP.
//
// Flow: user Lua → LuaParser → InstanceGraphBuilder → service routing →
//       Rojo tree + src/ files → deterministic ZIP that opens directly in
//       Roblox Studio via `rojo serve`.
//
// No execution. No templates. The ZIP contains exactly the user's code,
// placed in the correct Roblox service folder.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import archiver from 'archiver';
import { LuaParser } from './LuaParser.js';
import { InstanceGraphBuilder } from './InstanceGraphBuilder.js';
import { PreviewRenderer } from './PreviewRenderer.js';
import { runLuaPasses } from './LuaPasses.js';
import { expandFactoryFunctions } from './LuaFactoryExpander.js';
// Dual Preview Intelligence — read-only analysis of the parsed graph. Produces
// the enriched preview graph (technical) + design report (creative). Does not
// touch the ZIP, parser, or Rojo layout; purely interprets what was parsed.
import { analyzeScene } from '../../s4/oliot/rbx-directors/index.js';

// Decide which Roblox service a script belongs in, from its content.
function routeScript(source) {
  const s = source || '';

  // ── KORJAUS 1: honor explicit @AF51_TARGET directive before guessing ──
  // A script can declare its destination: -- @AF51_TARGET: ServerScriptService
  const directive = s.match(/--\s*@AF51_TARGET:\s*([A-Za-z/]+)/);
  if (directive) {
    const target = directive[1].trim();
    const extByService = {
      'ServerScriptService': '.server.lua',
      'StarterPlayer/StarterPlayerScripts': '.client.lua',
      'StarterPlayerScripts': '.client.lua',
      'StarterGui': '.lua',
      'ReplicatedStorage': '.lua',
      'Workspace': '.lua',
    };
    // Normalize StarterPlayerScripts → full path
    const svc = target === 'StarterPlayerScripts' ? 'StarterPlayer/StarterPlayerScripts' : target;
    if (extByService[target]) {
      return { service: svc, ext: extByService[target], explicit: true };
    }
  }

  // Client-only API usage → StarterPlayerScripts
  if (/LocalPlayer|:GetMouse\(|UserInputService|PlayerGui|game\.Players\.LocalPlayer/.test(s)) {
    return { service: 'StarterPlayer/StarterPlayerScripts', ext: '.client.lua' };
  }
  // GUI construction → StarterGui
  if (/ScreenGui|Instance\.new\(["']ScreenGui|TextLabel|TextButton|Frame/.test(s) &&
      !/ServerScriptService/.test(s)) {
    return { service: 'StarterGui', ext: '.lua' };
  }
  // Module pattern → ReplicatedStorage
  if (/^\s*local\s+\w+\s*=\s*{}/.test(s) && /return\s+\w+\s*$/m.test(s)) {
    return { service: 'ReplicatedStorage', ext: '.lua' };
  }
  // Pure geometry (Instance.new Parts parented to workspace) → Workspace as a script that builds it
  if (/Instance\.new\(["'](Part|Model|SpawnLocation|MeshPart)/.test(s)) {
    return { service: 'ServerScriptService', ext: '.server.lua' };
  }
  // Default: server script
  return { service: 'ServerScriptService', ext: '.server.lua' };
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export class LuaProjectBuilder {
  /**
   * Build a Studio-ready project from user Lua.
   * @param {string} source  user's Roblox Lua
   * @param {object} opts     { projectName?, scriptName?, exportsDir? }
   * @returns {object} { ok, zipPath, zipName, buildId, preview, routing, fileCount }
   */
  async build(source, opts = {}) {
    if (!source || typeof source !== 'string') {
      return { ok: false, error: 'Empty Lua source' };
    }

    const projectName = (opts.projectName || 'AF51-RBX-Project').replace(/[^A-Za-z0-9_-]/g, '');
    const scriptBase = (opts.scriptName || 'Main').replace(/[^A-Za-z0-9_]/g, '');
    // KORJAUS 5: deterministic buildId — derived from source content only.
    // Same Lua → same buildId → same ZIP name (reproducible). Caller may
    // override with opts.buildId for explicit versioning.
    const buildId = opts.buildId || ('lua_' + fnv1a(source).slice(0, 8));

    // 1) Parse + analyze
    const ast = new LuaParser().parse(source);

    // v64 KORJAUS 1: Expand factory function calls (makePart, makeNPC, etc)
    // into Instance.new equivalent AST nodes BEFORE InstanceGraphBuilder.
    const expandedAst = expandFactoryFunctions(source, ast);

    const graph = new InstanceGraphBuilder().build(expandedAst);
    const preview = new PreviewRenderer().render(graph);
    const passCtx = runLuaPasses(graph);  // read-only analysis: quality + groups + features

    // v67 SKILLS RING: Enterprise capability analysis (14 skills across 4 domains)
    let skillsRingResult = null;
    try {
      const { quickAnalyze } = await import('../../k1/SkillsRingBootstrap.mjs');
      const skillsGraph = {
        nodes: graph.nodes.map(n => ({
          id: n.id,
          className: n.className,
          properties: n.properties || {},
          parent: n.parent
        }))
      };
      skillsRingResult = await quickAnalyze(skillsGraph, 'analyze-scene');
      console.log('[LuaProjectBuilder] Skills Ring analysis complete:', skillsRingResult.pipeline.length, 'skills');
    } catch (error) {
      console.warn('[LuaProjectBuilder] Skills Ring analysis failed:', error.message);
      // Non-fatal: continue without Skills Ring data
    }

    // KORJAUS 6: Parser diagnostics (count from AST nodes, not graph nodes)
    const allInstanceCreations = expandedAst.nodes.filter(n => n.type === 'InstanceCreation');
    const directInstances = allInstanceCreations.filter(n => !n.source || n.source === 'direct').length;
    const factoryInstances = allInstanceCreations.filter(n => n.source && n.source.startsWith('expanded_')).length;
    const surfaceGuiCount = graph.nodes.filter(n =>
      n.className === 'SurfaceGui' || n.className === 'BillboardGui'
    ).length;
    const parentResolved = graph.nodes.filter(n => n.parentVar != null).length;

    const diagnostics = {
      direct: directInstances,
      factory: factoryInstances,
      surfaceGui: surfaceGuiCount,
      parentResolved,
    };

    // 2) Route the script to a service
    const route = routeScript(source);
    const scriptName = scriptBase + route.ext;

    // 3) Lay out src/ tree
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'af51lua-'));
    const srcDir = path.join(tmpRoot, 'src');
    const serviceDirs = ['ReplicatedStorage', 'ServerScriptService', 'StarterGui',
      'StarterPlayer/StarterPlayerScripts', 'Workspace'];
    for (const d of serviceDirs) fs.mkdirSync(path.join(srcDir, d), { recursive: true });

    // 4) Write the user's script into its routed service
    const scriptPath = path.join(srcDir, route.service, scriptName);
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, source, 'utf8');

    // 5) default.project.json (Rojo 7.x) — all 5 services mapped
    const project = {
      name: projectName,
      tree: {
        $className: 'DataModel',
        ReplicatedStorage: { $path: 'src/ReplicatedStorage' },
        ServerScriptService: { $path: 'src/ServerScriptService' },
        StarterGui: { $path: 'src/StarterGui' },
        StarterPlayer: { StarterPlayerScripts: { $path: 'src/StarterPlayer/StarterPlayerScripts' } },
        Workspace: { $path: 'src/Workspace', $properties: { Gravity: 196.2 } },
      },
      serveAddress: 'localhost',
      servePort: 34872,
    };
    fs.writeFileSync(path.join(tmpRoot, 'default.project.json'), JSON.stringify(project, null, 2), 'utf8');

    // 6) generatedPreview.json — the real parsed graph
    const previewDoc = {
      schemaVersion: '1.0.0',
      source: 'user-lua',
      buildId,
      structures: preview.structures,
      objects: preview.objects,
      routing: { service: route.service, file: scriptName },
      lighting: { ambient: '#0F0F1A', sky: '#06080F', fogColor: '#080814', neonColor: '#25D0FF' },
      camera: { viewX: 10, viewZ: 8, rotation: 'slow_orbit', elevation: 30 },
    };
    fs.writeFileSync(path.join(tmpRoot, 'generatedPreview.json'), JSON.stringify(previewDoc, null, 2), 'utf8');

    // 7) Keep src/Workspace non-empty for Rojo (.gitkeep-style placeholder meta only if empty)
    const wsDir = path.join(srcDir, 'Workspace');
    if (fs.readdirSync(wsDir).length === 0) {
      // Rojo needs the folder; an init meta keeps it a valid folder mapping.
      fs.writeFileSync(path.join(wsDir, 'init.meta.json'), JSON.stringify({ className: 'Folder' }, null, 2), 'utf8');
    }

    // 8) manifest + signature
    const allFiles = [];
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else allFiles.push(path.relative(tmpRoot, full).split(path.sep).join('/'));
      }
    })(tmpRoot);

    const manifest = {
      factory: 'AF51-RBX',
      buildId,
      projectName,
      source: 'user-lua',
      instanceCount: graph.nodes.length,
      routing: route.service,
      files: allFiles,
      // KOHTA 6: honest package metadata — this is a raw Lua Rojo ZIP,
      // NOT a full AF51 governed runtime package. Don't overclaim.
      packageType: 'raw-lua-rojo',
      runtimeTruth: 'roblox-studio',
      previewType: 'static-structure-preview',
      containsAF51Runtime: false,
      containsGovernanceRuntime: false,
      rojoCompatible: true,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(tmpRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    const sigBasis = allFiles.map((f) => f + ':' + fnv1a(fs.readFileSync(path.join(tmpRoot, f), 'utf8'))).join('|');
    const signature = {
      factory: 'AF51-RBX',
      buildId,
      fingerprint: fnv1a(sigBasis),
      masterHash: crypto.createHash('sha256').update(sigBasis).digest('hex'),
      fileCount: allFiles.length,
    };
    fs.writeFileSync(path.join(tmpRoot, 'signature.json'), JSON.stringify(signature, null, 2), 'utf8');

    // KORJAUS 5: Run intelligence AFTER fileCount is known
    // Dual Preview Intelligence (read-only): technical enrichment + creative
    // report, both derived strictly from the parsed graph. Wrapped so a director
    // error can never fail a build that otherwise succeeded.
    let intelligence = null;
    try {
      intelligence = analyzeScene(graph, { fileCount: allFiles.length, instanceCount: graph.nodes.length });
    } catch (e) {
      intelligence = null;
    }

    // 9) ZIP it (Studio-ready)
    const exportsDir = opts.exportsDir || path.join(process.cwd(), 'exports-rbx');
    fs.mkdirSync(exportsDir, { recursive: true });
    const zipName = `AF51-RBX-${projectName}-${buildId}.zip`;
    const zipPath = path.join(exportsDir, zipName);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(tmpRoot + '/', false);
      archive.finalize();
    });

    // cleanup tmp
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}

    // KOHTA 8: detect runtime features present in the source — shown as
    // metadata badges. These run in Roblox, NOT in the web preview.
    const runtimeEvents = [];
    if (/TweenService/.test(source)) runtimeEvents.push('TweenService');
    if (/\.Touched/.test(source)) runtimeEvents.push('Touched');
    if (/PlayerAdded/.test(source)) runtimeEvents.push('PlayerAdded');
    if (/CharacterAdded/.test(source)) runtimeEvents.push('CharacterAdded');
    if (/task\.(spawn|wait|defer)/.test(source)) runtimeEvents.push('task.spawn');
    if (/Humanoid/.test(source)) runtimeEvents.push('Humanoid');
    if (/RunService/.test(source)) runtimeEvents.push('RunService');

    return {
      ok: true,
      zipPath,
      zipName,
      buildId,
      fileCount: allFiles.length,
      instanceCount: graph.nodes.length,
      routing: { service: route.service, file: scriptName },
      preview: previewDoc,
      signature,
      packageType: 'raw-lua-rojo',
      runtimeTruth: 'roblox-studio',
      previewType: 'static-structure-preview',
      runtimeEvents,
      runtimeVerification: 'Requires Roblox Studio Play',
      diagnostics,  // KORJAUS 6: Parser capability status
      quality: passCtx.report,  // measured from user's Lua — informational, non-blocking
      enriched: intelligence ? intelligence.enriched : null,  // Preview Director (technical)
      design:   intelligence ? intelligence.report : null,    // Creative Director (creative)
      studio:   intelligence ? intelligence.studio : null,    // Studio Director (readiness)
      shots:    intelligence ? intelligence.shots : null,     // Cinematic Director (camera shots)
      skillsRing: skillsRingResult,  // v67: Skills Ring (14 skills, 4 domains)
    };
  }
}

export default LuaProjectBuilder;
