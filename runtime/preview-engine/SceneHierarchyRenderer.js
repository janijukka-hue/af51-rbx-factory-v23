// runtime/preview-engine/SceneHierarchyRenderer.js
//
// Builds the left-pane Studio-style tree from a scene spec produced by
// ThreePreviewAdapter. Universal (no DOM, no Three.js); the browser pane
// renders the returned tree.
//
// Tree shape:
//   { roots: [TreeNode, ...] }
//   TreeNode = { key, label, luaClass, icon, nodeId|null, children: [TreeNode] }
//
// Top-level service containers (Workspace, ReplicatedStorage, ...) become
// the roots, even when no scene structure lives directly under them — so
// the user sees a recognisable Roblox DataModel layout.

const SERVICE_ORDER = [
  'Workspace', 'Players', 'Lighting', 'ReplicatedStorage',
  'ServerStorage', 'ServerScriptService', 'StarterGui',
  'StarterPack', 'StarterPlayer', 'SoundService', 'Teams',
];

const ICONS = {
  Workspace: '🌐', Players: '👥', Lighting: '💡',
  ReplicatedStorage: '📦', ServerStorage: '🔐',
  ServerScriptService: '⚙️', StarterGui: '🖥️',
  StarterPack: '🎒', StarterPlayer: '🧍',
  SoundService: '🔊', Teams: '🏳️',
  Folder: '📁', Model: '🧱', Part: '🟦', WedgePart: '◢',
  MeshPart: '🧊', SpawnLocation: '⭐',
  RemoteEvent: '📡', RemoteFunction: '📞', BindableEvent: '🔔',
  Script: '📜', LocalScript: '📃', ModuleScript: '📕',
  Sound: '🎵', Animation: '🎞️', Decal: '🎨',
  PointLight: '💡', SpotLight: '🔦', SurfaceLight: '🌟',
};

function _icon(luaClass) { return ICONS[luaClass] || '◻️'; }

export class SceneHierarchyRenderer {
  /**
   * @param {object} spec - output of ThreePreviewAdapter.buildSceneSpec
   * @returns {{ roots: Array<object> }} renderable tree
   */
  buildHierarchy(spec) {
    if (!spec || !Array.isArray(spec.nodes)) return { roots: [] };

    // Index nodes by their label so child-of-Folder lookups can resolve.
    const byLabel = new Map();
    for (const n of spec.nodes) {
      if (n.label && !byLabel.has(n.label)) byLabel.set(n.label, n);
    }

    // Children-of map keyed by parent string.
    const childrenOf = new Map();
    for (const n of spec.nodes) {
      const arr = childrenOf.get(n.parent) || [];
      arr.push(n);
      childrenOf.set(n.parent, arr);
    }

    const visited = new Set();

    const make = (parentKey, nodeMaybe) => {
      const node = nodeMaybe || byLabel.get(parentKey);
      if (node && visited.has(node.id)) return null;
      if (node) visited.add(node.id);

      const label    = node ? node.label : parentKey;
      const luaClass = node ? node.luaClass : parentKey;
      const childArr = childrenOf.get(label) || (node ? (childrenOf.get(node.label) || []) : []);

      const children = childArr
        .map(c => make(c.label, c))
        .filter(Boolean);

      return {
        key:      node ? node.id : `svc_${parentKey}`,
        label,
        luaClass,
        icon:     _icon(luaClass),
        nodeId:   node ? node.id : null,
        tier:     node && typeof node.tier === 'number' ? node.tier : null,
        ruleTags: node && Array.isArray(node.ruleTags) ? node.ruleTags : [],
        children,
      };
    };

    // Service roots, in the conventional Studio order, plus any unrecognised
    // top-level parents that show up in the data.
    const knownParents = new Set([...childrenOf.keys()]);
    const orderedRoots = [
      ...SERVICE_ORDER,
      ...[...knownParents].filter(k => !SERVICE_ORDER.includes(k)),
    ];

    const roots = orderedRoots
      .map(svc => make(svc))
      .filter(Boolean);

    return { roots };
  }

  /** Flatten the tree for keyboard navigation / search. */
  flatten(tree) {
    const out = [];
    const walk = (node, depth) => {
      out.push({ ...node, depth });
      for (const c of node.children || []) walk(c, depth + 1);
    };
    for (const r of tree.roots || []) walk(r, 0);
    return out;
  }
}

export default SceneHierarchyRenderer;
