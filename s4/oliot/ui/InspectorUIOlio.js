// s4/oliot/ui/InspectorUIOlio.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer
// Version: 1.0.0
//
// InspectorUIOlio — näyttää valitun objektin tiedot. Ei pidä omaa valintaa:
// se lukee SelectionUIOliosta mikä on valittuna ja hakee koko noden
// SceneUIOliosta. Tämä pitää valinnan yhtenä totuuslähteenä.

function InspectorUIOlio(opts) {
  opts = opts || {};
  this._scene     = opts.scene || null;     // SceneUIOlio
  this._selection = opts.selection || null; // SelectionUIOlio
}

InspectorUIOlio.prototype.bind = function (scene, selection) {
  this._scene = scene;
  this._selection = selection;
  return this;
};

InspectorUIOlio.prototype.selectedId = function () {
  return this._selection ? this._selection.currentSelection : null;
};

InspectorUIOlio.prototype.selectedObject = function () {
  var id = this.selectedId();
  if (!id || !this._scene) return null;
  return this._scene.byId(id);
};

// Render-ready property rows for the selected node, e.g.
//   [{ key:"Type", value:"Part" }, { key:"Material", value:"Neon" }, ...]
InspectorUIOlio.prototype.rows = function () {
  var obj = this.selectedObject();
  if (!obj) return [];
  var rows = [];
  if (obj.name)     rows.push({ key: "Name", value: obj.name });
  if (obj.type)     rows.push({ key: "Type", value: obj.type });
  if (obj.material) rows.push({ key: "Material", value: obj.material });
  if (obj.position) {
    rows.push({ key: "Position", value:
      "(" + [obj.position.x, obj.position.y, obj.position.z].join(", ") + ")" });
  }
  if (obj.tags && obj.tags.length) rows.push({ key: "Tags", value: obj.tags.join(", ") });
  return rows;
};

InspectorUIOlio.prototype.toJSON = function () {
  return { selectedId: this.selectedId(), selectedObject: this.selectedObject() };
};

export { InspectorUIOlio };
export function createInspectorUIOlio(opts) { return new InspectorUIOlio(opts); }
