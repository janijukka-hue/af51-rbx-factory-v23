// t3/Factory/rbx-production/module-library.js
// AF51-RBX | T3 Layer — Module Library facade
// Role  : Single entry point that subsequent passes (Density, StructuralLayer,
//         Landmark, Silhouette, Traversal) use to drop pre-made module spec
//         groups into the SceneGraph. Handles parent paths and unique naming.

import * as M from "./modules/index.js";

const DEFAULT_PARENT = "Workspace/AF51Scene";

// _commit: walk an array of part specs and call graph.add() with merged parent + name.
// Names are made unique-per-graph by appending an integer suffix when needed.
function _commit(graph, specs, { parent = DEFAULT_PARENT, namePrefix = "M", tags = [] } = {}) {
  const added = [];
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const finalName = _uniqueName(graph, namePrefix + "_" + s.name);
    const node = graph.add({
      className:  s.className,
      name:       finalName,
      parent,
      properties: s.properties,
      tags:       [...s.tags, ...tags],
    });
    added.push(node);
  }
  return added;
}

function _uniqueName(graph, base) {
  let candidate = base;
  let i = 1;
  while (_nameTaken(graph, candidate)) {
    candidate = base + "_" + i;
    i++;
  }
  return candidate;
}

function _nameTaken(graph, name) {
  for (let i = 0; i < graph.nodes.length; i++) {
    if (graph.nodes[i].name === name) return true;
  }
  return false;
}

export const ModuleLibrary = {
  // Categories available — used by QualityGate V2 for diversity checks.
  categories: M.MODULE_CATEGORIES,

  // Generic placement: caller supplies the category, factory name, options, and parent.
  // Example: ModuleLibrary.place(graph, "pillars", "capped", { x: 0, y: 0, z: 10 }, { namePrefix: "MainCol" })
  place(graph, category, factory, opts, commitOpts = {}) {
    const cat = M[_capitalize(category)];
    if (!cat) throw new Error("[ModuleLibrary] unknown category: " + category);
    const fn = cat[factory];
    if (typeof fn !== "function") {
      throw new Error("[ModuleLibrary] unknown factory: " + category + "." + factory);
    }
    const specs = fn(opts);
    return _commit(graph, specs, commitOpts);
  },

  // Convenience helpers used heavily by upcoming passes:
  pillar(graph, opts, commitOpts) {
    return _commit(graph, M.Pillars.capped(opts), commitOpts);
  },
  tower(graph, opts, commitOpts) {
    return _commit(graph, M.Pillars.tapered(opts), commitOpts);
  },
  beam(graph, opts, commitOpts) {
    return _commit(graph, M.Supports.beam(opts), commitOpts);
  },
  truss(graph, opts, commitOpts) {
    return _commit(graph, M.Supports.truss(opts), commitOpts);
  },
  gateway(graph, opts, commitOpts) {
    return _commit(graph, M.Doors.gateway(opts), commitOpts);
  },
  rail(graph, opts, commitOpts) {
    return _commit(graph, M.Railings.full(opts), commitOpts);
  },
  bridge(graph, opts, commitOpts) {
    return _commit(graph, M.Bridges.truss(opts), commitOpts);
  },
  bridgeDeck(graph, opts, commitOpts) {
    return _commit(graph, M.Bridges.deck(opts), commitOpts);
  },
  stairs(graph, opts, commitOpts) {
    return _commit(graph, M.Stairs.run(opts), commitOpts);
  },
  floorGrid(graph, opts, commitOpts) {
    return _commit(graph, M.Floors.grid(opts), commitOpts);
  },
  wall(graph, opts, commitOpts) {
    return _commit(graph, M.Walls.segment(opts), commitOpts);
  },
  wallCorner(graph, opts, commitOpts) {
    return _commit(graph, M.Walls.cornerL(opts), commitOpts);
  },
  buttress(graph, opts, commitOpts) {
    return _commit(graph, M.Walls.buttress(opts), commitOpts);
  },
  window(graph, opts, commitOpts) {
    return _commit(graph, M.Windows.frame(opts), commitOpts);
  },
  chamfer(graph, opts, commitOpts) {
    return _commit(graph, M.Corners.chamfer(opts), commitOpts);
  },
  stepped(graph, opts, commitOpts) {
    return _commit(graph, M.Corners.stepped(opts), commitOpts);
  },

  // Raw commit (for callers that hand-build specs).
  commit(graph, specs, commitOpts) {
    return _commit(graph, specs, commitOpts);
  },
};

function _capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default ModuleLibrary;
