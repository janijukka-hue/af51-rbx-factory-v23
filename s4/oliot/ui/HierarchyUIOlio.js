// s4/oliot/ui/HierarchyUIOlio.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer
// Version: 1.0.0
//
// HierarchyUIOlio — mallintaa Roblox Explorer -puun. Rakennetaan SceneUIOlion
// nodeista (parent-poluista). Pitää kirjaa avatuista solmuista.
//
//   roots      [{ id, name, type, children:[...] }]
//   expanded   { id: true } — mitkä solmut on avattu

function HierarchyUIOlio(opts) {
  opts = opts || {};
  this.roots    = opts.roots    || [];
  this.expanded = opts.expanded || {};
}

HierarchyUIOlio.prototype.isExpanded = function (id) {
  return !!this.expanded[id];
};

HierarchyUIOlio.prototype.toggle = function (id) {
  this.expanded[id] = !this.expanded[id];
  return this;
};

HierarchyUIOlio.prototype.expandAll = function () {
  var self = this;
  (function walk(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      self.expanded[nodes[i].id] = true;
      if (nodes[i].children) walk(nodes[i].children);
    }
  })(this.roots);
  return this;
};

HierarchyUIOlio.prototype.toJSON = function () {
  return { roots: this.roots, expanded: this.expanded };
};

// Build a tree from a flat node list using `parent` paths (Workspace/Folder/Part).
// Nodes with no resolvable parent become roots. Deterministic: preserves the
// input node order at every level.
HierarchyUIOlio.fromNodes = function (nodes) {
  var byPath = {};
  var roots = [];

  function nodePath(n) {
    // SceneGraph parent is a path like "Workspace/AF51Scene"; node identity is
    // parent + "/" + name. Fall back to id when name/parent missing.
    if (n.parent && n.name) return n.parent + "/" + n.name;
    return n.id;
  }

  // First pass: index every node by its full path.
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    byPath[nodePath(n)] = {
      id: n.id, name: n.name || n.type || n.id, type: n.type, children: [],
    };
  }
  // Second pass: attach to parent path, else treat as root.
  for (var j = 0; j < nodes.length; j++) {
    var node = nodes[j];
    var entry = byPath[nodePath(node)];
    var parentEntry = node.parent ? byPath[node.parent] : null;
    if (parentEntry) parentEntry.children.push(entry);
    else roots.push(entry);
  }
  return new HierarchyUIOlio({ roots: roots });
};

export { HierarchyUIOlio };
export function createHierarchyUIOlio(opts) { return new HierarchyUIOlio(opts); }
