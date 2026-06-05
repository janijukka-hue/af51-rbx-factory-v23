// runtime/rbx-runtime/InstanceGraphBuilder.js
// AF51-RBX — Builds an RBX object graph from a LuaAST.
// Deterministic value parsing. No execution. Resolves parent to instance or service.

const BRICKCOLORS = {
  "Bright green": "#4B974B", "Bright red": "#C4281C", "Bright blue": "#0D69AC",
  "Bright yellow": "#F5CD30", "Bright orange": "#D85B2B", "White": "#F2F3F3",
  "Black": "#1B2A35", "Medium stone grey": "#A1A5A2", "Dark stone grey": "#6D6E6C",
  "Really black": "#0A0A0A", "Really red": "#FF0000", "Lime green": "#BBE90B",
  "New Yeller": "#FFFF00", "Pastel blue": "#80BBDB", "Bright purple": "#A75FF6",
};

function parseVector3(str) {
  const m = str.match(/Vector3\.new\(\s*([^)]*)\)/);
  if (!m) return null;
  const nums = m[1].split(',').map((v) => Number(v.trim()));
  return nums.length === 3 && nums.every(Number.isFinite) ? nums : null;
}

function parseColor3(str) {
  let m = str.match(/Color3\.fromRGB\(\s*([^)]*)\)/);
  if (m) {
    const c = m[1].split(',').map((v) => Math.max(0, Math.min(255, Math.round(Number(v.trim())))));
    if (c.length === 3 && c.every(Number.isFinite)) return rgbHex(c);
  }
  m = str.match(/Color3\.new\(\s*([^)]*)\)/);
  if (m) {
    const c = m[1].split(',').map((v) => Math.max(0, Math.min(255, Math.round(Number(v.trim()) * 255))));
    if (c.length === 3 && c.every(Number.isFinite)) return rgbHex(c);
  }
  return null;
}

function parseBrickColor(str) {
  const m = str.match(/BrickColor\.new\(\s*["']([^"']+)["']\s*\)/);
  if (m && BRICKCOLORS[m[1]]) return BRICKCOLORS[m[1]];
  return null;
}

function parseCFrame(str) {
  const m = str.match(/CFrame\.new\(\s*([^)]*)\)/);
  if (!m) return null;
  const nums = m[1].split(',').map((v) => Number(v.trim()));
  return nums.length >= 3 && nums.slice(0, 3).every(Number.isFinite) ? nums.slice(0, 3) : null;
}

function rgbHex(c) {
  return '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function parseValue(raw) {
  const r = raw.trim();
  if (/Vector3\.new/.test(r)) return parseVector3(r);
  if (/Color3\./.test(r))     return parseColor3(r);
  if (/BrickColor\.new/.test(r)) return parseBrickColor(r);
  if (/CFrame\.new/.test(r))  return parseCFrame(r);
  // Enum.Material.Neon → "Neon",  Enum.PartType.Ball → "Ball"
  const enumM = r.match(/Enum\.(?:Material|PartType|Shape)\.(\w+)/);
  if (enumM) return enumM[1];
  if (/^["'].*["']$/.test(r)) return r.replace(/^["']|["']$/g, '');
  if (/^(true|false)$/.test(r)) return r === 'true';
  if (Number.isFinite(Number(r))) return Number(r);
  return r;
}

const SERVICES = ['workspace', 'Workspace', 'ReplicatedStorage', 'ServerScriptService',
  'StarterGui', 'StarterPlayer', 'Lighting', 'SoundService', 'ServerStorage', 'Players'];

export class InstanceGraphBuilder {
  build(ast) {
    const byVar = {};
    const order = [];

    for (const node of ast.nodes) {
      if (node.type === 'InstanceCreation') {
        if (!byVar[node.varName]) {
          const obj = {
            id: `node_${order.length + 1}`,
            varName: node.varName,
            className: node.className,
            parent: 'workspace',
            parentVar: null,
            properties: {},
          };
          byVar[node.varName] = obj;
          order.push(obj);
        }
      } else if (node.type === 'ParentAssignment') {
        const obj = byVar[node.varName];
        if (obj) {
          // Resolve service vars (game:GetService alias) to canonical names.
          const p = node.parent;
          if (SERVICES.includes(p)) {
            obj.parent = p === 'Workspace' ? 'workspace' : p;
          } else if (byVar[p]) {
            obj.parent = byVar[p].className + '(' + p + ')';
            obj.parentVar = p;
          } else {
            obj.parent = p; // unresolved var → could be a service alias declared via GetService
          }
        }
      } else if (node.type === 'PropertyAssignment') {
        const obj = byVar[node.varName];
        if (obj) {
          // Prefer a pre-computed value (from loop-unrolled expressions)
          if (node.computed != null) {
            obj.properties[node.property] = node.computed;
          } else {
            const v = parseValue(node.rawValue);
            if (v !== null && v !== undefined) obj.properties[node.property] = v;
          }
        }
      }
    }

    return { nodes: order };
  }
}

export default InstanceGraphBuilder;
