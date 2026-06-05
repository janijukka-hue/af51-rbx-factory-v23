// s4/oliot/ui/SelectionUIOlio.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer
// Version: 1.0.0
//
// SelectionUIOlio — keskitetty valinta. Yksi totuuslähde sille mikä node on
// valittuna. Inspector, Viewport ja Hierarchy lukevat tästä — ei omia
// valintatiloja siellä täällä. Tukee kuuntelijoita, jotta näkymät päivittyvät.

function SelectionUIOlio(opts) {
  opts = opts || {};
  this.currentSelection = opts.currentSelection || null; // node id
  this._listeners = new Set();
}

SelectionUIOlio.prototype.select = function (id) {
  if (this.currentSelection === id) return this;
  this.currentSelection = id;
  this._emit();
  return this;
};

SelectionUIOlio.prototype.clear = function () {
  if (this.currentSelection === null) return this;
  this.currentSelection = null;
  this._emit();
  return this;
};

SelectionUIOlio.prototype.has = function () {
  return this.currentSelection !== null;
};

SelectionUIOlio.prototype.subscribe = function (fn) {
  if (typeof fn !== "function") return function () {};
  this._listeners.add(fn);
  var self = this;
  return function () { self._listeners.delete(fn); };
};

SelectionUIOlio.prototype._emit = function () {
  var id = this.currentSelection;
  this._listeners.forEach(function (fn) { try { fn(id); } catch (e) {} });
};

SelectionUIOlio.prototype.toJSON = function () {
  return { currentSelection: this.currentSelection };
};

export { SelectionUIOlio };
export function createSelectionUIOlio(opts) { return new SelectionUIOlio(opts); }
