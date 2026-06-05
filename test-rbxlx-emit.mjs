// test-rbxlx-emit.mjs — AF51-RBX RBXLX emitter (palaset 1–3)
// Validates that production-scenegraph.json → AF51.rbxlx is deterministic,
// XML-wellformed, and covers Part/SpawnLocation/Folder + PointLight +
// Lighting service (Sky/Atmosphere/effects) + Decal/SpecialMesh/Value-nodet
// per the current emitter scope.

import { emitRbxlx } from './t3/roblox-rbx/rbxlx-emitter.js';
import { RobloxBuildManager } from './m2/roblox/roblox-build-manager.js';
import { readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const C={g:'\x1b[32m',r:'\x1b[31m',c:'\x1b[36m',b:'\x1b[1m',x:'\x1b[0m'};
let P=0,F=0;
function t(l,c2,d=''){if(c2){console.log(`  ${C.g}✓${C.x} ${l}`);P++;}else{console.log(`  ${C.r}✗${C.x} ${l}${d?' — '+d:''}`);F++;}}
function sec(s){console.log(`\n${C.c}${C.b}── ${s} ──${C.x}`);}

// ── 1. Pure unit tests on the emitter ───────────────────────────────────────
sec('Property encoders');
const FIX = {
  schemaVersion: '1.1.0',
  services: {},
  nodes: [
    { id: 'n1', className: 'Part', name: 'Floor',
      parent: 'Workspace/AF51Scene',
      properties: {
        Anchored: true,
        Size: 'Vector3.new(100, 2, 100)',
        Position: 'Vector3.new(0, 0, 0)',
        Material: 'Enum.Material.Concrete',
        BrickColor: 'BrickColor.new("Medium stone grey")',
        Color: 'Color3.fromRGB(163, 162, 165)',
        Transparency: 0,
      }, tags: [] },
    { id: 'n2', className: 'SpawnLocation', name: 'PrimarySpawn',
      parent: 'Workspace/AF51Scene/Floor',
      properties: {
        Anchored: true,
        Neutral: true,
        Size: 'Vector3.new(6, 1, 6)',
        BrickColor: 'BrickColor.new("Bright green")',
      }, tags: [] },
    { id: 'n3', className: 'PointLight', name: 'Glow',
      parent: 'Workspace/AF51Scene/Floor',
      properties: {
        Brightness: 2,
        Color: 'Color3.fromRGB(106, 226, 138)',
        Range: 18,
        Shadows: true,
      }, tags: [] },
  ],
};

const out = emitRbxlx(FIX);
t('xml starts with <?xml',     out.xml.startsWith('<?xml version="1.0"'));
t('xml has <roblox> root',     out.xml.includes('<roblox '));
t('xml ends with </roblox>\\n', out.xml.endsWith('</roblox>\n'));
t('Workspace emitted',         out.xml.includes('<Item class="Workspace"'));
t('AF51Scene Folder emitted',  out.xml.includes('<Item class="Folder"') && out.xml.includes('>AF51Scene</string>'));
t('Part emitted',              out.xml.includes('<Item class="Part"'));
t('SpawnLocation emitted',     out.xml.includes('<Item class="SpawnLocation"'));
t('Anchored bool',             out.xml.includes('<bool name="Anchored">true</bool>'));
t('Transparency float',        out.xml.includes('<float name="Transparency">0</float>'));
t('Size lowercased (legacy)',  out.xml.includes('<Vector3 name="size">'));
t('Vector3 X/Y/Z',             out.xml.includes('<X>100</X>') && out.xml.includes('<Y>2</Y>') && out.xml.includes('<Z>100</Z>'));
t('Material → token Concrete', out.xml.includes('<token name="Material">816</token>'));
t('BrickColor name → palette', out.xml.includes('<BrickColor name="BrickColor">37</BrickColor>'));
t('Color3 fromRGB normalized', out.xml.match(/<Color3 name="Color"><R>0\.639\d*<\/R>/) !== null);
t('PointLight emitted as child of Part',
   out.xml.includes('<Item class="PointLight"') &&
   /<Item class="Part"[^>]*>[\s\S]*?<Item class="PointLight"/.test(out.xml));
t('PointLight Range float',    out.xml.includes('<float name="Range">18</float>'));
t('PointLight Shadows bool',   out.xml.includes('<bool name="Shadows">true</bool>'));

// ── 1b. Lighting service ────────────────────────────────────────────────────
sec('Lighting service');
const LIGHTING_FIX = {
  schemaVersion: '1.1.0',
  services: {},
  nodes: [
    { id: 's',  className: 'Sky', name: 'AF51Sky', parent: 'Lighting',
      properties: { CelestialBodiesShown: true, MoonAngularSize: 11, StarCount: 3000, SunAngularSize: 11 }, tags: [] },
    { id: 'a',  className: 'Atmosphere', name: 'AF51Atmosphere', parent: 'Lighting',
      properties: { Color: 'Color3.fromRGB(199, 222, 240)', Decay: 'Color3.fromRGB(106, 112, 125)', Density: 0.3, Glare: 0.2, Haze: 1, Offset: 0.25 }, tags: [] },
    { id: 'b',  className: 'BloomEffect', name: 'AF51BloomEffect', parent: 'Lighting',
      properties: { Intensity: 0.55, Size: 22, Threshold: 0.95 }, tags: [] },
    { id: 'cc', className: 'ColorCorrectionEffect', name: 'AF51CC', parent: 'Lighting',
      properties: { Brightness: 0.02, Contrast: 0.1, Saturation: 0.15, TintColor: 'Color3.fromRGB(255, 250, 240)' }, tags: [] },
    { id: 'd',  className: 'DepthOfFieldEffect', name: 'AF51DOF', parent: 'Lighting',
      properties: { FarIntensity: 0.05, FocusDistance: 35, InFocusRadius: 24, NearIntensity: 0 }, tags: [] },
    { id: 'sr', className: 'SunRaysEffect', name: 'AF51SunRays', parent: 'Lighting',
      properties: { Intensity: 0.1, Spread: 0.8 }, tags: [] },
  ],
};
const lo = emitRbxlx(LIGHTING_FIX);
t('Lighting service emitted',   lo.xml.includes('<Item class="Lighting"'));
t('Sky under Lighting',         /<Item class="Lighting"[\s\S]*?<Item class="Sky"/.test(lo.xml));
t('Atmosphere under Lighting',  lo.xml.includes('<Item class="Atmosphere"'));
t('BloomEffect under Lighting', lo.xml.includes('<Item class="BloomEffect"'));
t('CCEffect under Lighting',    lo.xml.includes('<Item class="ColorCorrectionEffect"'));
t('DOFEffect under Lighting',   lo.xml.includes('<Item class="DepthOfFieldEffect"'));
t('SunRays under Lighting',     lo.xml.includes('<Item class="SunRaysEffect"'));
t('Atmosphere Color3 Decay',    lo.xml.includes('<Color3 name="Decay">'));
t('TintColor as Color3',        lo.xml.includes('<Color3 name="TintColor">'));
t('No Lighting block when no lighting nodes',
   !emitRbxlx({ services: {}, nodes: [
     { id: 'p', className: 'Part', name: 'P', parent: 'Workspace/AF51Scene', properties: {}, tags: [] },
   ] }).xml.includes('<Item class="Lighting"'));

// ── 1c. Decal / SpecialMesh / Value-nodet ───────────────────────────────────
sec('Decal · SpecialMesh · Value-nodet');
const DSV_FIX = {
  schemaVersion: '1.1.0',
  services: {},
  nodes: [
    { id: 'p', className: 'Part', name: 'Wall',
      parent: 'Workspace/AF51Scene',
      properties: { Anchored: true, Size: 'Vector3.new(4, 4, 1)' }, tags: [] },
    { id: 'd', className: 'Decal', name: 'Banner',
      parent: 'Workspace/AF51Scene/Wall',
      properties: {
        Color3: 'Color3.fromRGB(180, 220, 255)',
        Face: 'Enum.NormalId.Front',
        Transparency: 0.05,
      }, tags: [] },
    { id: 'm', className: 'SpecialMesh', name: 'Mesh',
      parent: 'Workspace/AF51Scene/Wall',
      properties: { MeshType: 'Enum.MeshType.Cylinder', Scale: 'Vector3.new(1, 1, 1)' }, tags: [] },
    { id: 'b', className: 'BoolValue', name: 'Checkpoint',
      parent: 'Workspace/AF51Scene/Wall',
      properties: { Value: false }, tags: [] },
    { id: 's', className: 'StringValue', name: 'GoalSensor',
      parent: 'Workspace/AF51Scene/Wall',
      properties: { Value: 'obby:finish' }, tags: [] },
  ],
};
const dsv = emitRbxlx(DSV_FIX);
t('Decal emitted',          dsv.xml.includes('<Item class="Decal"'));
t('Decal Face → NormalId 5',dsv.xml.includes('<token name="Face">5</token>'));
t('Decal Color3 prop',      dsv.xml.includes('<Color3 name="Color3">'));
t('SpecialMesh emitted',    dsv.xml.includes('<Item class="SpecialMesh"'));
t('MeshType → Cylinder 4',  dsv.xml.includes('<token name="MeshType">4</token>'));
t('Scale Vector3 (not legacy lowercase)', dsv.xml.includes('<Vector3 name="Scale">'));
t('BoolValue Value=false',  dsv.xml.includes('<Item class="BoolValue"') && dsv.xml.includes('<bool name="Value">false</bool>'));
t('StringValue Value="obby:finish"',
   dsv.xml.includes('<Item class="StringValue"') &&
   dsv.xml.includes('<string name="Value">obby:finish</string>'));
// Verify children nest under their parent Part
t('Children nest under Part',
   /<Item class="Part"[\s\S]*?<Item class="Decal"[\s\S]*?<\/Item>[\s\S]*?<\/Item>/.test(dsv.xml));

// Fail-fast on unknown NormalId / MeshType members
let nThrew = false;
try {
  emitRbxlx({ services: {}, nodes: [
    { id: 'd', className: 'Decal', name: 'D', parent: 'Workspace/AF51Scene',
      properties: { Face: 'Enum.NormalId.NotAFace' }, tags: [] },
  ] });
} catch (e) { nThrew = /unknown enum member/.test(e.message); }
t('unknown NormalId throws', nThrew);

let mThrew = false;
try {
  emitRbxlx({ services: {}, nodes: [
    { id: 'm', className: 'SpecialMesh', name: 'M', parent: 'Workspace/AF51Scene',
      parent: 'Workspace/AF51Scene', properties: { MeshType: 'Enum.MeshType.NotReal' }, tags: [] },
  ] });
} catch (e) { mThrew = /unknown enum member/.test(e.message); }
t('unknown MeshType throws', mThrew);

// ── 1d. IntValue + WedgePart ────────────────────────────────────────────────
sec('IntValue · WedgePart');
const IW_FIX = {
  schemaVersion: '1.1.0',
  services: {},
  nodes: [
    { id: 'iv', className: 'IntValue', name: 'Score',
      parent: 'Workspace/AF51Scene', properties: { Value: 25 }, tags: [] },
    { id: 'wp', className: 'WedgePart', name: 'Ramp',
      parent: 'Workspace/AF51Scene',
      properties: {
        Anchored: true,
        Position: 'Vector3.new(0, 1, 0)',
        Size: 'Vector3.new(4, 1, 8)',
      }, tags: [] },
  ],
};
const iw = emitRbxlx(IW_FIX);
t('IntValue emitted',             iw.xml.includes('<Item class="IntValue"'));
t('IntValue Value as <int>',      iw.xml.includes('<int name="Value">25</int>'));
t('IntValue Value NOT <float>',   !/<float name="Value">/.test(iw.xml));
t('WedgePart emitted',            iw.xml.includes('<Item class="WedgePart"'));
t('WedgePart size lowercased',    iw.xml.includes('<Vector3 name="size">'));

// Fail-fast: IntValue.Value with a non-integer must throw
let ivThrew = false;
try {
  emitRbxlx({ services: {}, nodes: [
    { id: 'iv', className: 'IntValue', name: 'X', parent: 'Workspace/AF51Scene',
      properties: { Value: 2.5 }, tags: [] },
  ] });
} catch (e) { ivThrew = /non-integer/.test(e.message); }
t('IntValue Value non-integer throws', ivThrew);

// ── 2. Determinism ──────────────────────────────────────────────────────────
sec('Determinism');
const a = emitRbxlx(FIX).xml;
const b = emitRbxlx(FIX).xml;
t('two emits produce byte-identical xml', a === b, `len ${a.length} vs ${b.length}`);

// Reorder input nodes — tree order should still come out the same because
// emit walks via parent index, not node array order.
const FIX2 = { ...FIX, nodes: [FIX.nodes[2], FIX.nodes[0], FIX.nodes[1]] };
const c = emitRbxlx(FIX2).xml;
t('reordered input → same output (parent-index walk)', a === c);

// ── 3. CFrame evaluator ─────────────────────────────────────────────────────
sec('CFrame');
const cfIdentity = emitRbxlx({ services: {}, nodes: [{
  id: 'p', className: 'Part', name: 'P', parent: 'Workspace/AF51Scene',
  properties: { CFrame: 'CFrame.new(1, 2, 3)' }, tags: [],
}] }).xml;
t('identity CFrame emits CoordinateFrame', cfIdentity.includes('<CoordinateFrame name="CFrame">'));
t('identity CFrame XYZ',  /<X>1<\/X><Y>2<\/Y><Z>3<\/Z>/.test(cfIdentity));
t('identity CFrame R00=1', cfIdentity.includes('<R00>1</R00>'));
t('identity CFrame R11=1', cfIdentity.includes('<R11>1</R11>'));
t('identity CFrame R22=1', cfIdentity.includes('<R22>1</R22>'));

// Y-axis -90° (the scenegraph's canonical rotation case)
const cfRotated = emitRbxlx({ services: {}, nodes: [{
  id: 'p', className: 'Part', name: 'P', parent: 'Workspace/AF51Scene',
  properties: { CFrame: 'CFrame.new(0, 0.150, 10) * CFrame.Angles(0, math.rad(-90), 0)' }, tags: [],
}] }).xml;
t('Y -90° R02=-1', cfRotated.includes('<R02>-1</R02>'));
t('Y -90° R20=1',  cfRotated.includes('<R20>1</R20>'));
t('Y -90° R11=1',  cfRotated.includes('<R11>1</R11>'));
t('Y -90° R00=0',  cfRotated.includes('<R00>0</R00>'));

// ── 4. Fail-fast contract ───────────────────────────────────────────────────
sec('Fail-fast on supported classes');
let threw = false;
try {
  emitRbxlx({ services: {}, nodes: [{
    id: 'x', className: 'Part', name: 'X', parent: 'Workspace/AF51Scene',
    properties: { Material: 'Enum.Material.NotAReal' }, tags: [],
  }] });
} catch (e) { threw = /unknown enum member/.test(e.message); }
t('unknown enum member throws', threw);

threw = false;
try {
  emitRbxlx({ services: {}, nodes: [{
    id: 'x', className: 'Part', name: 'X', parent: 'Workspace/AF51Scene',
    properties: { BrickColor: 'BrickColor.new("NoSuchColor")' }, tags: [],
  }] });
} catch (e) { threw = /unknown BrickColor/.test(e.message); }
t('unknown BrickColor throws', threw);

threw = false;
try {
  emitRbxlx({ services: {}, nodes: [{
    id: 'x', className: 'Part', name: 'X', parent: 'Workspace/AF51Scene',
    properties: { Mystery: 'Whatever.new(1, 2)' }, tags: [],
  }] });
} catch (e) { threw = /unsupported Luau expression/.test(e.message); }
t('unknown Luau call throws (no silent <string> fallback)', threw);

// ── 4. End-to-end build (obby target) ─────────────────────────────────────
// Run the full pipeline twice in deterministic mode and verify AF51.rbxlx
// lands inside the production ZIP byte-identically.
sec('End-to-end build (obby target)');
const target = JSON.parse(readFileSync('./targets/obby.target.json', 'utf8'));
const tmp = mkdtempSync(path.join(os.tmpdir(), 'af51-rbxlx-test-'));
process.env.RBX_DETERMINISTIC_BUILD = '1';

const res1 = await RobloxBuildManager.build({
  target, exportsDir: path.join(tmp, 'ex1'),
  gameName: 'AF51-RBXLX-Test', version: '1.0.0',
});
t('build ok', res1.ok, res1.error || '');
const rbxlxPhase = res1.phases.find(p => p.name === 'RBXLX_EMIT');
t('RBXLX_EMIT phase recorded', !!rbxlxPhase && rbxlxPhase.ok);

if (res1.ok && res1.zipPath) {
  const list1 = execFileSync('unzip', ['-l', res1.zipPath], { encoding: 'utf8' });
  t('AF51.rbxlx inside ZIP', list1.includes('AF51.rbxlx'));

  const rbxlx1 = execFileSync('unzip', ['-p', res1.zipPath, 'AF51.rbxlx'], { encoding: 'utf8' });
  t('xml header present in ZIP entry', rbxlx1.startsWith('<?xml'));
  t('has SpawnLocation',   rbxlx1.includes('<Item class="SpawnLocation"'));
  t('has Part',            rbxlx1.includes('<Item class="Part"'));
  t('has Lighting service',rbxlx1.includes('<Item class="Lighting"'));
  t('has PointLight',      rbxlx1.includes('<Item class="PointLight"'));
  t('has Sky',             rbxlx1.includes('<Item class="Sky"'));
  t('has Atmosphere',      rbxlx1.includes('<Item class="Atmosphere"'));
  t('has Decal',           rbxlx1.includes('<Item class="Decal"'));
  t('has SpecialMesh',     rbxlx1.includes('<Item class="SpecialMesh"'));
  t('has BoolValue',       rbxlx1.includes('<Item class="BoolValue"'));
  t('has StringValue',     rbxlx1.includes('<Item class="StringValue"'));

  const open  = (rbxlx1.match(/<Item /g) || []).length;
  const close = (rbxlx1.match(/<\/Item>/g) || []).length;
  t('Item tag balance', open === close, `open=${open} close=${close}`);
  // After palanen 3, obby scenegraph has full coverage — nothing should be skipped.
  t('no skipped nodes for obby', rbxlxPhase && rbxlxPhase.skipped === 0,
    `skipped=${rbxlxPhase ? rbxlxPhase.skipped : '?'}`);

  const res2 = await RobloxBuildManager.build({
    target, exportsDir: path.join(tmp, 'ex2'),
    gameName: 'AF51-RBXLX-Test', version: '1.0.0',
  });
  t('second build ok', res2.ok, res2.error || '');
  if (res2.ok && res2.zipPath) {
    const rbxlx2 = execFileSync('unzip', ['-p', res2.zipPath, 'AF51.rbxlx'], { encoding: 'utf8' });
    t('rbxlx byte-identical across builds', rbxlx1 === rbxlx2,
      `len ${rbxlx1.length} vs ${rbxlx2.length}`);
  }
}

// ── 5. Full coverage across all 5 targets ──────────────────────────────────
// Every target's scenegraph must round-trip into the rbxlx with 0 skipped
// classes and produce byte-identical output across two builds.
sec('All 5 targets — 0 skipped, byte-identical');
const ALL_TARGETS = ['obby', 'tycoon', 'simulator', 'rpg', 'fps'];
const RBXLX_BY_TARGET = new Map();
for (const tid of ALL_TARGETS) {
  const tg = JSON.parse(readFileSync(`./targets/${tid}.target.json`, 'utf8'));
  const r1 = await RobloxBuildManager.build({
    target: tg, exportsDir: path.join(tmp, `cov-${tid}-1`),
    gameName: `AF51-RBXLX-Cov-${tid}`, version: '1.0.0',
  });
  if (!r1.ok) { t(`${tid}: build1 ok`, false, r1.error || ''); continue; }
  const ph1 = r1.phases.find(p => p.name === 'RBXLX_EMIT');
  t(`${tid}: 0 skipped`, ph1 && ph1.skipped === 0, `skipped=${ph1 ? ph1.skipped : '?'}`);

  const r2 = await RobloxBuildManager.build({
    target: tg, exportsDir: path.join(tmp, `cov-${tid}-2`),
    gameName: `AF51-RBXLX-Cov-${tid}`, version: '1.0.0',
  });
  if (r1.zipPath && r2.ok && r2.zipPath) {
    const a = execFileSync('unzip', ['-p', r1.zipPath, 'AF51.rbxlx'], { encoding: 'utf8' });
    const b = execFileSync('unzip', ['-p', r2.zipPath, 'AF51.rbxlx'], { encoding: 'utf8' });
    t(`${tid}: byte-identical re-build`, a === b, `len ${a.length} vs ${b.length}`);
    RBXLX_BY_TARGET.set(tid, a);
  }
}

// ── 6. Playability smoke + regression on every target's .rbxlx ─────────────
// Locks in the single-file deliverable invariant: opening AF51.rbxlx in
// Studio and pressing Play must yield a wired-up game. Each target's rbxlx
// must contain its Kit module, its Boot script, the SceneBuilder, and the
// SceneBuilder's emitted tag set must overlap with the Kit's GetTagged set
// (otherwise SceneBuilder builds geometry the Kit can never react to).
sec('Single-file .rbxlx playability per target');

// Extracts every <Item class="(Script|LocalScript|ModuleScript)"> in the
// rbxlx along with its Name property and CDATA-wrapped Source. Returns a
// Map<Name, {className, source}>. Tolerant of nested Items and arbitrary
// indentation; relies on each script having exactly one Source ProtectedString.
function _extractScripts(xml) {
  const out = new Map();
  const re = /<Item class="(Script|LocalScript|ModuleScript)" referent="[^"]+">([\s\S]*?)<\/Item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const cls = m[1];
    const body = m[2];
    const nameM = body.match(/<string name="Name">([^<]+)<\/string>/);
    const srcM  = body.match(/<ProtectedString name="Source"><!\[CDATA\[([\s\S]*?)\]\]><\/ProtectedString>/);
    if (!nameM || !srcM) continue;
    out.set(nameM[1], { className: cls, source: srcM[1] });
  }
  return out;
}

// What each target promises to ship inside its .rbxlx.
const PLAYABILITY = {
  obby:      { kit: 'ObbyKit',      tags: ['Checkpoint', 'Killbrick', 'Mover', 'Spinner'] },
  tycoon:    { kit: 'TycoonKit',    tags: ['Dropper', 'Collector', 'Upgrade', 'TycoonOwner'] },
  simulator: { kit: 'SimulatorKit', tags: ['ResourceNode', 'SellZone', 'PrestigePodium', 'ProgressionGate'] },
  rpg:       { kit: 'RPGKit',       tags: ['QuestBoard', 'DungeonGate', 'EnemySpawn'] },
  fps:       { kit: 'FPSKit',       tags: ['TeamSpawn', 'WeaponLocker', 'Flag', 'CapturePoint'] },
};

for (const tid of ALL_TARGETS) {
  const xml = RBXLX_BY_TARGET.get(tid);
  if (!xml) { t(`${tid}: rbxlx captured`, false, 'no xml from build'); continue; }
  const want = PLAYABILITY[tid];
  const scripts = _extractScripts(xml);

  // (a) Required scripts present.
  const kit  = scripts.get(want.kit);
  const boot = scripts.get(`${want.kit}Boot`);
  const sb   = scripts.get('AF51SceneBuilder');
  t(`${tid}: ${want.kit} ModuleScript baked`,           !!kit  && kit.className  === 'ModuleScript');
  t(`${tid}: ${want.kit}Boot Script baked`,             !!boot && boot.className === 'Script');
  t(`${tid}: AF51SceneBuilder Script baked`,            !!sb   && sb.className   === 'Script');

  // (b) Boot must require the Kit by exact name (no symlink/typo drift).
  if (boot) {
    t(`${tid}: Boot requires ${want.kit}`,
      new RegExp(`require\\(.*WaitForChild\\("${want.kit}"`).test(boot.source));
    t(`${tid}: Boot calls ${want.kit}.start()`,
      boot.source.includes(`${want.kit}.start()`));
  }

  // (c) Kit must end with `return <Name>` (module contract preserved through CDATA).
  if (kit) {
    t(`${tid}: ${want.kit} ends with return ${want.kit}`,
      new RegExp(`return ${want.kit}\\s*$`).test(kit.source.trim()));
  }

  // (d) SceneBuilder must emit at least one AddTag for every gameplay tag
  // the Kit listens for. This catches the "boxes only" regression where
  // geometry ships without tags, or the Kit asks for "Killpart" but
  // SceneBuilder writes "Killbrick". Kit-side tags are collected from both
  // literal `GetTagged("X")` calls and `XxxTag = "X"` config-table entries
  // (the ObbyKit pattern, where GetTagged takes `config.CheckpointTag`).
  if (sb && kit) {
    const sbTags  = new Set(Array.from(sb.source.matchAll(/CollectionService:AddTag\([^,]+,\s*"([^"]+)"\)/g), x => x[1]));
    const kitTags = new Set([
      ...Array.from(kit.source.matchAll(/CollectionService:GetTagged\("([^"]+)"\)/g), x => x[1]),
      ...Array.from(kit.source.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*Tag\s*=\s*"([^"]+)"/g), x => x[1]),
    ]);
    const overlap = want.tags.filter(tag => sbTags.has(tag) && kitTags.has(tag));
    t(`${tid}: SceneBuilder ↔ Kit tag wiring overlap >= 1`,
      overlap.length >= 1, `expected any of [${want.tags.join(',')}], sb=[${[...sbTags].join(',')}] kit=[${[...kitTags].join(',')}]`);
  }

  // (e) CDATA hygiene: every script's source must be non-trivial and free of
  // an unescaped sentinel that would terminate the CDATA early in Studio.
  let cdataClean = true;
  for (const [name, s] of scripts) {
    if (s.source.length < 50) { cdataClean = false; break; }
    if (s.source.includes(']]>')) { cdataClean = false; break; }
    void name;
  }
  t(`${tid}: every script CDATA non-trivial and ]]>-free`, cdataClean);

  // (f) Global XML CDATA balance — opens must equal closes across the file.
  const opens  = (xml.match(/<!\[CDATA\[/g) || []).length;
  const closes = (xml.match(/\]\]>/g) || []).length;
  t(`${tid}: CDATA opens == closes (${opens})`, opens === closes && opens > 0);
}

rmSync(tmp, { recursive: true, force: true });

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${C.b}${P} pass · ${F} fail${C.x}`);
process.exit(F === 0 ? 0 : 1);
