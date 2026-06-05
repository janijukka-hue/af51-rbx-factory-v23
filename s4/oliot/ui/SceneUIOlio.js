// s4/oliot/ui/SceneUIOlio.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer
// Version: 1.0.0
//
// SceneUIOlio — mallintaa koko tuotetun Roblox-maailman UI:ta varten.
// Tietolähde Viewportille ja Hierarchylle. Node-muoto seuraa SceneGraphia:
//   { id, type, name, material, position:{x,y,z}, parent, tags }
//
// Ei sisällä renderöintilogiikkaa — pelkkä datamalli.

function SceneUIOlio(opts) {
  opts = opts || {};
  this.nodes = opts.nodes || [];
}

SceneUIOlio.prototype.count = function () {
  return this.nodes.length;
};

SceneUIOlio.prototype.byId = function (id) {
  for (var i = 0; i < this.nodes.length; i++) {
    if (this.nodes[i].id === id) return this.nodes[i];
  }
  return null;
};

SceneUIOlio.prototype.byType = function (type) {
  return this.nodes.filter(function (n) { return n.type === type; });
};

// Counts per class — handy for a "157 Parts · 5 SpawnLocations" UI strip.
SceneUIOlio.prototype.typeCounts = function () {
  var out = {};
  for (var i = 0; i < this.nodes.length; i++) {
    var t = this.nodes[i].type || "Unknown";
    out[t] = (out[t] || 0) + 1;
  }
  return out;
};

SceneUIOlio.prototype.toJSON = function () {
  return { nodes: this.nodes };
};

export { SceneUIOlio };
export function createSceneUIOlio(opts) { return new SceneUIOlio(opts); }
