// t3/roblox-rbx/rbxlx-emitter.js — AF51-RBX
// Converts production-scenegraph.json → AF51.rbxlx (Roblox XML place file)
// so the user can double-click the file and Roblox Studio opens the world
// pre-built (no Rojo, no runtime Instance.new()).
//
// Palaset 1–3: Part, WedgePart, SpawnLocation, Folder, PointLight + Lighting
// service (Sky, Atmosphere, BloomEffect, ColorCorrectionEffect,
// DepthOfFieldEffect, SunRaysEffect) + Decal, SpecialMesh, BoolValue,
// IntValue, StringValue. Unsupported classes are skipped and reported.
// Palanen 4 (single-file playable): Script / LocalScript / ModuleScript
// + service hosts (ServerScriptService, StarterPlayer.StarterPlayerScripts,
// StarterGui, ReplicatedStorage). Script sources are embedded as
// <ProtectedString> CDATA so the .rbxlx is self-contained — no Rojo
// project, no separate src/ tree needed to make the place playable.
// Supported classes: a missing property-type converter is fail-fast
// (atomicity rule — no silent fallback to <string>).
//
// Deterministic: alphabetical property order, sequential referent IDs in
// traversal order, no Date.now() / Math.random().

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENUM_TABLE_PATH = path.resolve(__dirname, '../../production/rbxlx-enum-table.json');

const SUPPORTED_CLASSES = new Set([
  'Part', 'WedgePart', 'SpawnLocation', 'Folder',
  'PointLight',
  'Sky', 'Atmosphere',
  'BloomEffect', 'ColorCorrectionEffect', 'DepthOfFieldEffect', 'SunRaysEffect',
  'Decal', 'SpecialMesh',
  'BoolValue', 'IntValue', 'StringValue',
  'Script', 'LocalScript', 'ModuleScript',
]);

// Source property is emitted as <ProtectedString> with CDATA so newlines
// and quotes inside Luau source survive the XML round-trip unaltered.
const PROTECTED_STRING_PROPS = new Set([
  'Script:Source', 'LocalScript:Source', 'ModuleScript:Source',
]);

// CollectionService Tags are serialized as a BinaryString containing the
// tag names joined by NUL bytes, then base64-encoded. Roblox Studio reads
// this back via CollectionService:GetTags / GetTagged. Without this the
// .rbxlx looks correct in the tree view but every Kit's GetTagged() call
// returns an empty list — geometry and behaviour are silently uncoupled.
function _tagsBlob(tags) {
  return Buffer.from(tags.join('\0'), 'utf8').toString('base64');
}

// Instance attributes (`inst:GetAttribute("Income")` etc.) are serialized as
// the binary blob AttributesSerialize: uint32 LE count, then for each entry
// uint32 LE name length, UTF-8 name bytes, one type-tag byte, value bytes.
// We support the attribute types the AF51 composition-engine emits today
// (String, Bool, Number — Lua numbers always serialize as Float64). Any
// other type fails fast (atomicity rule); a future scalar/Vector kind must
// be added here explicitly, never silently coerced to string.
const ATTR_TYPE_STRING  = 0x02;
const ATTR_TYPE_BOOL    = 0x03;
const ATTR_TYPE_FLOAT64 = 0x06;
function _attributesBlob(attrs) {
  const keys = Object.keys(attrs).sort();
  const parts = [];
  const hdr = Buffer.alloc(4); hdr.writeUInt32LE(keys.length, 0);
  parts.push(hdr);
  for (const name of keys) {
    const nm = Buffer.from(name, 'utf8');
    const nl = Buffer.alloc(4); nl.writeUInt32LE(nm.length, 0);
    parts.push(nl, nm);
    const v = attrs[name];
    if (typeof v === 'string') {
      const sb = Buffer.from(v, 'utf8');
      const lb = Buffer.alloc(4); lb.writeUInt32LE(sb.length, 0);
      parts.push(Buffer.from([ATTR_TYPE_STRING]), lb, sb);
    } else if (typeof v === 'boolean') {
      parts.push(Buffer.from([ATTR_TYPE_BOOL, v ? 1 : 0]));
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      const nb = Buffer.alloc(8); nb.writeDoubleLE(v, 0);
      parts.push(Buffer.from([ATTR_TYPE_FLOAT64]), nb);
    } else {
      throw new Error(`unsupported attribute type for "${name}": ${typeof v} (${v})`);
    }
  }
  return Buffer.concat(parts).toString('base64');
}

// File-suffix → Roblox script class. Matches the SCRIPT_TYPE table in
// t3/roblox-rbx/luau-generator.js so the .rbxlx mirrors what Rojo would
// mount from the same src/ tree.
const SCRIPT_SUFFIX_TO_CLASS = [
  { suffix: '.server.lua', className: 'Script' },
  { suffix: '.client.lua', className: 'LocalScript' },
  { suffix: '.lua',        className: 'ModuleScript' },
];

// Service hosts that carry baked-in scripts. Order is fixed so the .rbxlx
// is byte-identical across builds. Each entry describes the top-level
// service Item and (optionally) a single mandatory inner container Item
// (e.g. StarterPlayer always has StarterPlayerScripts as the script root).
const SCRIPT_SERVICE_ROOTS = [
  { service: 'ReplicatedStorage', hostClass: 'ReplicatedStorage' },
  { service: 'ServerScriptService', hostClass: 'ServerScriptService' },
  { service: 'StarterGui', hostClass: 'StarterGui' },
  { service: 'StarterPlayer/StarterPlayerScripts', hostClass: 'StarterPlayer',
    inner: { className: 'StarterPlayerScripts', name: 'StarterPlayerScripts' } },
];

// Classes that live under the Lighting service (parent === "Lighting").
const LIGHTING_CHILDREN = new Set([
  'Sky', 'Atmosphere',
  'BloomEffect', 'ColorCorrectionEffect', 'DepthOfFieldEffect', 'SunRaysEffect',
]);

// Property name remap: scenegraph property name → XML attribute name.
// Part/WedgePart/SpawnLocation use lowercase "size" in XML (Roblox legacy).
const PROP_NAME_MAP = {
  'Part:Size':          'size',
  'WedgePart:Size':     'size',
  'SpawnLocation:Size': 'size',
};

// Properties whose XML element tag is not <float>/<string>/<bool>. Used when
// a class's Value (or similar) is strongly typed as int by Roblox.
const INT_PROPERTIES = new Set(['IntValue:Value']);

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function fmtFloat(n, ctx) {
  if (!Number.isFinite(n)) throw new Error(`non-finite number: ${n}${ctx ? ' (' + ctx + ')' : ''}`);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function parseTuple(s, prefix) {
  // Vector3.new(1, 2, 3) → [1, 2, 3]
  const inner = s.slice(prefix.length, s.lastIndexOf(')'));
  return inner.split(',').map(x => Number(x.trim()));
}

// CFrame.Angles term: a plain number, math.rad(N), or -math.rad(N).
function parseAngle(s) {
  const t = s.trim();
  const m = t.match(/^(-?)\s*math\.rad\(\s*(-?\d+(?:\.\d+)?)\s*\)$/);
  if (m) return (m[1] === '-' ? -1 : 1) * Number(m[2]) * Math.PI / 180;
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t);
  throw new Error(`unsupported CFrame angle term: "${s}"`);
}

// Bracket-aware "Prefix(...)" extractor — handles nested calls like math.rad(N).
function sliceCall(s, prefix) {
  if (!s.startsWith(prefix)) return null;
  let i = prefix.length, depth = 1;
  while (i < s.length) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return { args: s.slice(prefix.length, i), end: i + 1 };
    i++;
  }
  return null;
}

// Evaluate "CFrame.new(x, y, z)" optionally "* CFrame.Angles(rx, ry, rz)".
// Roblox convention: R = Rx · Ry · Rz (intrinsic XYZ).
function evalCFrame(value) {
  const a = sliceCall(value, 'CFrame.new(');
  if (!a) throw new Error(`unsupported CFrame expression: ${value}`);
  const rest = value.slice(a.end).replace(/^\s*\*\s*/, '');
  let anglesArgs = null;
  if (rest.length > 0) {
    const b = sliceCall(rest, 'CFrame.Angles(');
    if (!b || b.end !== rest.length) throw new Error(`unsupported CFrame expression: ${value}`);
    anglesArgs = b.args;
  }
  const [x, y, z] = a.args.split(',').map(s => Number(s.trim()));
  if (![x, y, z].every(Number.isFinite)) throw new Error(`bad CFrame position: ${a.args}`);
  let R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (anglesArgs !== null) {
    const parts = anglesArgs.split(',').map(s => s.trim());
    if (parts.length !== 3) throw new Error(`CFrame.Angles needs 3 args: ${anglesArgs}`);
    const [rx, ry, rz] = parts.map(parseAngle);
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);
    R = [
      [cy * cz,                -cy * sz,                sy],
      [sx * sy * cz + cx * sz, -sx * sy * sz + cx * cz, -sx * cy],
      [-cx * sy * cz + sx * sz, cx * sy * sz + sx * cz, cx * cy],
    ];
  }
  return { x, y, z, R };
}

// Recognises Luau call-style strings we cannot decode (fail-fast contract).
const LUAU_CALL_RE = /^[A-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*\(/;

// ── property-type emitters ───────────────────────────────────────────────
function emitProtectedString(xmlName, source) {
  // Escape any literal "]]>" inside the source so the CDATA closer stays
  // unambiguous. The split pattern "]]]]><![CDATA[>" is the standard XML
  // recipe and round-trips back to the original bytes through Roblox's
  // XML parser.
  const safe = String(source).replace(/\]\]>/g, ']]]]><![CDATA[>');
  return `<ProtectedString name="${xmlEscape(xmlName)}"><![CDATA[${safe}]]></ProtectedString>`;
}

function emitProp(className, propName, value, enumTable) {
  const xmlName = PROP_NAME_MAP[`${className}:${propName}`] || propName;
  if (PROTECTED_STRING_PROPS.has(`${className}:${propName}`)) {
    if (typeof value !== 'string') {
      throw new Error(`expected string Source for ${className}.${propName}, got ${typeof value}`);
    }
    return emitProtectedString(xmlName, value);
  }
  if (typeof value === 'boolean') {
    return `<bool name="${xmlEscape(xmlName)}">${value ? 'true' : 'false'}</bool>`;
  }
  if (typeof value === 'number') {
    if (INT_PROPERTIES.has(`${className}:${propName}`)) {
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error(`non-integer for ${className}.${propName}: ${value}`);
      }
      return `<int name="${xmlEscape(xmlName)}">${value}</int>`;
    }
    return `<float name="${xmlEscape(xmlName)}">${fmtFloat(value, `${className}.${propName}`)}</float>`;
  }
  if (typeof value !== 'string') {
    throw new Error(`unsupported value type for ${className}.${propName}: ${typeof value}`);
  }
  // Luau-style typed string values
  const ctx = `${className}.${propName}`;
  if (value.startsWith('Vector3.new(')) {
    const [x, y, z] = parseTuple(value, 'Vector3.new(');
    return `<Vector3 name="${xmlEscape(xmlName)}"><X>${fmtFloat(x, ctx)}</X><Y>${fmtFloat(y, ctx)}</Y><Z>${fmtFloat(z, ctx)}</Z></Vector3>`;
  }
  if (value.startsWith('Color3.fromRGB(')) {
    const [r, g, b] = parseTuple(value, 'Color3.fromRGB(');
    return `<Color3 name="${xmlEscape(xmlName)}"><R>${fmtFloat(r / 255, ctx)}</R><G>${fmtFloat(g / 255, ctx)}</G><B>${fmtFloat(b / 255, ctx)}</B></Color3>`;
  }
  if (value.startsWith('Color3.new(')) {
    const [r, g, b] = parseTuple(value, 'Color3.new(');
    return `<Color3 name="${xmlEscape(xmlName)}"><R>${fmtFloat(r, ctx)}</R><G>${fmtFloat(g, ctx)}</G><B>${fmtFloat(b, ctx)}</B></Color3>`;
  }
  if (value.startsWith('Enum.')) {
    const rest = value.slice('Enum.'.length); // "Material.Neon"
    const dot = rest.indexOf('.');
    const enumKey = `Enum.${rest.slice(0, dot)}`;
    const memberName = rest.slice(dot + 1);
    const table = enumTable[enumKey];
    if (!table) throw new Error(`unknown enum type: ${enumKey}`);
    const token = table[memberName];
    if (token == null) throw new Error(`unknown enum member: ${enumKey}.${memberName}`);
    return `<token name="${xmlEscape(xmlName)}">${token}</token>`;
  }
  if (value.startsWith('BrickColor.new(')) {
    const m = value.match(/^BrickColor\.new\("(.+)"\)$/);
    if (!m) throw new Error(`malformed BrickColor: ${value}`);
    const token = enumTable.BrickColor[m[1]];
    if (token == null) throw new Error(`unknown BrickColor name: "${m[1]}"`);
    return `<BrickColor name="${xmlEscape(xmlName)}">${token}</BrickColor>`;
  }
  if (value.startsWith('CFrame.')) {
    const cf = evalCFrame(value);
    const cells = [`<X>${fmtFloat(cf.x, ctx)}</X>`, `<Y>${fmtFloat(cf.y, ctx)}</Y>`, `<Z>${fmtFloat(cf.z, ctx)}</Z>`];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      cells.push(`<R${i}${j}>${fmtFloat(cf.R[i][j], ctx)}</R${i}${j}>`);
    }
    return `<CoordinateFrame name="${xmlEscape(xmlName)}">${cells.join('')}</CoordinateFrame>`;
  }
  // Tightened fallback: a string that looks like a Luau call we did not decode
  // is a bug, not a string property — fail-fast (atomicity rule).
  if (LUAU_CALL_RE.test(value)) {
    throw new Error(`unsupported Luau expression for ${className}.${propName}: ${value}`);
  }
  // plain string
  return `<string name="${xmlEscape(xmlName)}">${xmlEscape(value)}</string>`;
}

// ── tree building ────────────────────────────────────────────────────────
function buildChildIndex(nodes) {
  // parentPath → [node, ...] sorted by (className, name) so the emitter does
  // not depend on input array order. The scenegraph is already produced
  // deterministically, but this gives the same XML even if the upstream
  // producer ever changes its emit order.
  const idx = new Map();
  for (const n of nodes) {
    if (!idx.has(n.parent)) idx.set(n.parent, []);
    idx.get(n.parent).push(n);
  }
  for (const arr of idx.values()) {
    arr.sort((a, b) => {
      if (a.className !== b.className) return a.className < b.className ? -1 : 1;
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      return 0;
    });
  }
  return idx;
}

function nodePath(node) {
  // e.g. "Workspace/AF51Scene/StartPlatform"
  return `${node.parent}/${node.name}`;
}

// ── public API ───────────────────────────────────────────────────────────
export function emitRbxlx(sceneGraph, opts = {}) {
  if (!sceneGraph || !Array.isArray(sceneGraph.nodes)) {
    throw new Error('emitRbxlx: invalid scenegraph');
  }
  const enumTable = opts.enumTable || JSON.parse(readFileSync(ENUM_TABLE_PATH, 'utf8'));
  const childIndex = buildChildIndex(sceneGraph.nodes);

  const skipped = []; // { className, name, reason }
  let nextRef = 1;
  const ref = () => 'RBX' + String(nextRef++).padStart(16, '0');

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">');
  lines.push('  <External>null</External>');
  lines.push('  <External>nil</External>');

  function emitNode(node, indent) {
    if (!SUPPORTED_CLASSES.has(node.className)) {
      skipped.push({ className: node.className, name: node.name, reason: 'class not in emitter scope' });
      return;
    }
    const pad = '  '.repeat(indent);
    lines.push(`${pad}<Item class="${xmlEscape(node.className)}" referent="${ref()}">`);
    lines.push(`${pad}  <Properties>`);
    lines.push(`${pad}    <string name="Name">${xmlEscape(node.name)}</string>`);
    const propKeys = Object.keys(node.properties || {}).sort();
    for (const k of propKeys) {
      lines.push(`${pad}    ${emitProp(node.className, k, node.properties[k], enumTable)}`);
    }
    // CollectionService tags and instance attributes: the scenegraph carries
    // them as first-class fields; Studio reads them via BinaryString blobs.
    // Without these the .rbxlx tree looks complete but every Kit's
    // GetTagged()/GetAttribute() comes back empty in Play mode.
    if (Array.isArray(node.tags) && node.tags.length > 0) {
      lines.push(`${pad}    <BinaryString name="Tags">${_tagsBlob(node.tags)}</BinaryString>`);
    }
    if (node.attributes && typeof node.attributes === 'object' && Object.keys(node.attributes).length > 0) {
      lines.push(`${pad}    <BinaryString name="AttributesSerialize">${_attributesBlob(node.attributes)}</BinaryString>`);
    }
    lines.push(`${pad}  </Properties>`);
    const children = childIndex.get(nodePath(node)) || [];
    for (const c of children) emitNode(c, indent + 1);
    lines.push(`${pad}</Item>`);
  }

  // Workspace > AF51Scene (Folder) > <Parts...>
  lines.push(`  <Item class="Workspace" referent="${ref()}">`);
  lines.push('    <Properties>');
  lines.push('      <string name="Name">Workspace</string>');
  lines.push('    </Properties>');
  lines.push(`    <Item class="Folder" referent="${ref()}">`);
  lines.push('      <Properties>');
  lines.push('        <string name="Name">AF51Scene</string>');
  lines.push('      </Properties>');
  const sceneRoots = childIndex.get('Workspace/AF51Scene') || [];
  for (const n of sceneRoots) emitNode(n, 4);
  lines.push('    </Item>');
  lines.push('  </Item>');

  // Lighting service > <Sky/Atmosphere/Effects...>
  // Only emit when the scenegraph contains lighting children, so a scene
  // without effects stays byte-clean and we don't introduce empty noise.
  const lightingRoots = (childIndex.get('Lighting') || [])
    .filter(n => LIGHTING_CHILDREN.has(n.className));
  if (lightingRoots.length > 0) {
    lines.push(`  <Item class="Lighting" referent="${ref()}">`);
    lines.push('    <Properties>');
    lines.push('      <string name="Name">Lighting</string>');
    lines.push('    </Properties>');
    for (const n of lightingRoots) emitNode(n, 2);
    lines.push('  </Item>');
  }

  // ── Palanen 4 (single-file playable): bake script services ─────────────
  // Scripts arrive as { service, relPath, source } where service is one of
  // the entries in SCRIPT_SERVICE_ROOTS and relPath is the on-disk path
  // beneath that service root (directories become Folders, the leaf file
  // becomes Script / LocalScript / ModuleScript based on its suffix).
  // Each service block is only emitted when at least one script targets
  // it, keeping the .rbxlx byte-clean for empty services.
  const scripts = Array.isArray(opts.scripts) ? opts.scripts : [];
  if (scripts.length > 0) {
    const byService = new Map();
    for (const s of scripts) {
      if (!s || typeof s.service !== 'string' || typeof s.relPath !== 'string' || typeof s.source !== 'string') {
        throw new Error('emitRbxlx: each opts.scripts entry needs {service, relPath, source}');
      }
      if (!byService.has(s.service)) byService.set(s.service, []);
      byService.get(s.service).push(s);
    }
    for (const root of SCRIPT_SERVICE_ROOTS) {
      const bucket = byService.get(root.service);
      if (!bucket || bucket.length === 0) continue;
      bucket.sort((a, b) => a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0);
      lines.push(`  <Item class="${root.hostClass}" referent="${ref()}">`);
      lines.push('    <Properties>');
      lines.push(`      <string name="Name">${root.hostClass}</string>`);
      lines.push('    </Properties>');
      if (root.inner) {
        lines.push(`    <Item class="${root.inner.className}" referent="${ref()}">`);
        lines.push('      <Properties>');
        lines.push(`        <string name="Name">${root.inner.name}</string>`);
        lines.push('      </Properties>');
        emitScriptTree(bucket, lines, 3, ref, skipped);
        lines.push('    </Item>');
      } else {
        emitScriptTree(bucket, lines, 2, ref, skipped);
      }
      lines.push('  </Item>');
    }
  }

  lines.push('</roblox>');

  return { xml: lines.join('\n') + '\n', skipped };
}

// Folder hierarchy synthesized from script relPaths. Identical inputs
// produce identical output because: (a) the script bucket is sorted by
// relPath before this call, and (b) folder children at every depth are
// emitted in the sorted order their first appearance puts them in.
function emitScriptTree(bucket, lines, indent, ref, skipped) {
  // Build a synthetic node tree: { name → { __scripts: [...], __folders: Map<name, node> } }
  const root = { folders: new Map(), scripts: [] };
  for (const s of bucket) {
    const segs = s.relPath.split('/').filter(x => x.length > 0);
    if (segs.length === 0) continue;
    const fileName = segs[segs.length - 1];
    const dirs = segs.slice(0, -1);
    let cur = root;
    for (const d of dirs) {
      if (!cur.folders.has(d)) cur.folders.set(d, { folders: new Map(), scripts: [] });
      cur = cur.folders.get(d);
    }
    let className = null;
    let scriptName = null;
    for (const m of SCRIPT_SUFFIX_TO_CLASS) {
      if (fileName.endsWith(m.suffix)) {
        className = m.className;
        scriptName = fileName.slice(0, -m.suffix.length);
        break;
      }
    }
    if (!className) {
      skipped.push({ className: 'unknown', name: s.relPath, reason: 'unrecognized script file suffix' });
      continue;
    }
    cur.scripts.push({ className, name: scriptName, source: s.source });
  }

  function emitDir(dir, depth) {
    const pad = '  '.repeat(depth);
    // Folders first (sorted), then scripts (sorted by name). Per-class
    // grouping in the existing emitNode would put Script before
    // ModuleScript alphabetically; we mirror that for a stable shape.
    const folderNames = [...dir.folders.keys()].sort();
    for (const fname of folderNames) {
      lines.push(`${pad}<Item class="Folder" referent="${ref()}">`);
      lines.push(`${pad}  <Properties>`);
      lines.push(`${pad}    <string name="Name">${xmlEscape(fname)}</string>`);
      lines.push(`${pad}  </Properties>`);
      emitDir(dir.folders.get(fname), depth + 1);
      lines.push(`${pad}</Item>`);
    }
    const scripts = dir.scripts.slice().sort((a, b) => {
      if (a.className !== b.className) return a.className < b.className ? -1 : 1;
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      return 0;
    });
    for (const s of scripts) {
      lines.push(`${pad}<Item class="${s.className}" referent="${ref()}">`);
      lines.push(`${pad}  <Properties>`);
      lines.push(`${pad}    <string name="Name">${xmlEscape(s.name)}</string>`);
      lines.push(`${pad}    ${emitProtectedString('Source', s.source)}`);
      lines.push(`${pad}  </Properties>`);
      lines.push(`${pad}</Item>`);
    }
  }

  emitDir(root, indent);
}
