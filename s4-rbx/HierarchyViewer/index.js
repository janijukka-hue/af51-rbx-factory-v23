// s4-rbx/HierarchyViewer/index.js — AF51-RBX Studio Layer
// Reads and displays the generated Roblox project hierarchy.
// Spec §18: NO browser preview systems.
import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

export class HierarchyViewer {
  static scan(buildRoot) {
    const srcDir = path.join(buildRoot, 'src');
    if (!existsSync(srcDir)) return { ok: false, tree: null, summary: { error: 'src/ not found' } };
    const tree = _scanDir(srcDir);
    return {
      ok: true,
      tree,
      summary: {
        totalFiles: tree._meta.files,
        luaFiles:   tree._meta.lua,
        jsonFiles:  tree._meta.json,
        scannedAt:  new Date().toISOString(),
      },
    };
  }
  static print(buildRoot) {
    const { ok, tree, summary } = HierarchyViewer.scan(buildRoot);
    if (!ok) { console.error('[HierarchyViewer] ' + summary.error); return; }
    console.log(`[HierarchyViewer] ${summary.totalFiles} files, ${summary.luaFiles} Lua, ${summary.jsonFiles} JSON`);
    _printNode(tree, '');
  }
}

function _scanDir(dir) {
  const node = { _name: path.basename(dir), _type: 'dir', _children: [], _meta: { files: 0, dirs: 0, lua: 0, json: 0 } };
  let entries;
  try { entries = readdirSync(dir); } catch (_) { return node; }
  for (const e of entries.sort()) {
    if (e === '.gitkeep') continue;
    const full = path.join(dir, e);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      const child = _scanDir(full);
      node._children.push(child);
      node._meta.dirs  += 1 + child._meta.dirs;
      node._meta.files += child._meta.files;
      node._meta.lua   += child._meta.lua;
      node._meta.json  += child._meta.json;
    } else {
      node._children.push({ _name: e, _type: 'file' });
      node._meta.files++;
      if (e.endsWith('.lua'))  node._meta.lua++;
      if (e.endsWith('.json')) node._meta.json++;
    }
  }
  return node;
}

function _printNode(node, prefix) {
  for (let i = 0; i < node._children.length; i++) {
    const child = node._children[i];
    const isLast = i === node._children.length - 1;
    const branch = isLast ? '└─ ' : '├─ ';
    const icon = child._type === 'dir' ? '📁 ' : child._name.endsWith('.lua') ? '🌙 ' : '📄 ';
    console.log(prefix + branch + icon + child._name);
    if (child._type === 'dir') _printNode(child, prefix + (isLast ? '   ' : '│  '));
  }
}

export default HierarchyViewer;
