// s4/oliot/ui/BuildStateUIOlio.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer
// Version: 1.0.0
//
// BuildStateUIOlio — edustaa tuotantotilaa yhtenä oliona.
// Ei React-state. Pipeline-tulos muunnetaan tähän UIObjectAdapterin kautta.
//
//   state        "IDLE" | "BUILDING" | "OK" | "FAIL"
//   currentPhase viimeisin/ajossa oleva vaihe (esim. "VISUAL_PRODUCTION")
//   progress     0..100 (phasesCompleted / totalPhases)
//   durationMs   build-kesto millisekunteina
//   phases       [{ name, status }] vaihekohtainen tila

function BuildStateUIOlio(opts) {
  opts = opts || {};
  this.state        = opts.state || "IDLE";
  this.currentPhase = opts.currentPhase || null;
  this.progress     = typeof opts.progress === "number" ? opts.progress : 0;
  this.durationMs   = opts.durationMs || 0;
  this.phases       = opts.phases || [];
}

BuildStateUIOlio.prototype.isBuilding = function () {
  return this.state === "BUILDING";
};

BuildStateUIOlio.prototype.isDone = function () {
  return this.state === "OK" || this.state === "FAIL";
};

// A short, render-ready summary line: "BUILDING · VISUAL_PRODUCTION · 78%"
BuildStateUIOlio.prototype.label = function () {
  var parts = [this.state];
  if (this.currentPhase) parts.push(this.currentPhase);
  if (this.state === "BUILDING") parts.push(Math.round(this.progress) + "%");
  return parts.join(" · ");
};

BuildStateUIOlio.prototype.toJSON = function () {
  return {
    state: this.state,
    currentPhase: this.currentPhase,
    progress: this.progress,
    durationMs: this.durationMs,
    phases: this.phases,
  };
};

export { BuildStateUIOlio };
export function createBuildStateUIOlio(opts) { return new BuildStateUIOlio(opts); }
