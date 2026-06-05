// s4/oliot/ui/ViewportUIOlio.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer
// Version: 1.0.0
//
// ViewportUIOlio — omistaa kameran ja katselutilan. React ei hallitse
// orbit/zoom/pan-logiikkaa; se vain renderöi tämän olion tilan ja kutsuu
// metodeja. Renderöinti on siten erotettu tuotannosta.

function ViewportUIOlio(opts) {
  opts = opts || {};
  this.target   = opts.target   || { x: 0, y: 0, z: 0 }; // look-at point
  this.zoom     = opts.zoom     || 50;                   // distance
  this.rotation = opts.rotation || { yaw: 0.6, pitch: 0.4 };
  this.minZoom  = opts.minZoom  || 5;
  this.maxZoom  = opts.maxZoom  || 500;
}

ViewportUIOlio.prototype.orbit = function (dYaw, dPitch) {
  this.rotation.yaw   += dYaw;
  // clamp pitch so the camera never flips over the pole
  var p = this.rotation.pitch + dPitch;
  this.rotation.pitch = Math.max(-1.5, Math.min(1.5, p));
  return this;
};

ViewportUIOlio.prototype.zoomBy = function (delta) {
  this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));
  return this;
};

ViewportUIOlio.prototype.pan = function (dx, dy, dz) {
  this.target.x += dx || 0;
  this.target.y += dy || 0;
  this.target.z += dz || 0;
  return this;
};

ViewportUIOlio.prototype.focus = function (point) {
  if (point) this.target = { x: point.x || 0, y: point.y || 0, z: point.z || 0 };
  return this;
};

// Derived camera position from orbit angles + zoom (spherical → cartesian).
ViewportUIOlio.prototype.cameraPosition = function () {
  var r = this.zoom, yaw = this.rotation.yaw, pitch = this.rotation.pitch;
  return {
    x: this.target.x + r * Math.cos(pitch) * Math.sin(yaw),
    y: this.target.y + r * Math.sin(pitch),
    z: this.target.z + r * Math.cos(pitch) * Math.cos(yaw),
  };
};

ViewportUIOlio.prototype.toJSON = function () {
  return { target: this.target, zoom: this.zoom, rotation: this.rotation };
};

export { ViewportUIOlio };
export function createViewportUIOlio(opts) { return new ViewportUIOlio(opts); }
