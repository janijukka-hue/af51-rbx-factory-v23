// t3/Factory/rbx-production/silhouette-pass.js
// AF51-RBX | T3 Layer — SilhouettePass
// Role  : Adds vertical forms at the map perimeter so the scene reads
//         as a recognizable silhouette when the camera zooms out.
//         Per-target form catalogue: towers, arches, bridges, supports.
//         Forms are placed deterministically around an anchor ring.

import { ModuleLibrary } from "./module-library.js";

const SILHOUETTE_TAG = "silhouette";

// Per-target form ring: { radius, count, forms: [...], y }
// `forms` is rotated through deterministically by index.
const SILHOUETTE_PLANS = {
  obby: {
    radius: 50, count: 6, y: 0,
    forms: [
      { kind: "tower",   opts: { height: 18, baseSize: 4, topSize: 1.5 } },
      { kind: "pillar",  opts: { height: 14, thickness: 1.4, capSize: 2.4 } },
      { kind: "tower",   opts: { height: 22, baseSize: 5, topSize: 2 } },
      { kind: "pillar",  opts: { height: 12, thickness: 1.2, capSize: 2 } },
    ],
  },
  tycoon: {
    radius: 40, count: 8, y: 0,
    forms: [
      { kind: "tower",   opts: { height: 16, baseSize: 3.5, topSize: 1.4 } },
      { kind: "truss",   opts: { height: 12, baseWidth: 4, thickness: 0.4 } },
      { kind: "pillar",  opts: { height: 14, thickness: 1.3, capSize: 2.2 } },
      { kind: "truss",   opts: { height: 10, baseWidth: 4, thickness: 0.4 } },
    ],
  },
  simulator: {
    radius: 50, count: 8, y: 0,
    forms: [
      { kind: "tower",   opts: { height: 24, baseSize: 5, topSize: 2 } },
      { kind: "tower",   opts: { height: 20, baseSize: 4, topSize: 1.5 } },
      { kind: "pillar",  opts: { height: 16, thickness: 1.4, capSize: 2.4 } },
      { kind: "tower",   opts: { height: 28, baseSize: 6, topSize: 2.5 } },
    ],
  },
  fps: {
    radius: 70, count: 10, y: 0,
    forms: [
      { kind: "truss",   opts: { height: 18, baseWidth: 5, thickness: 0.5 } },
      { kind: "tower",   opts: { height: 22, baseSize: 5, topSize: 1.8 } },
      { kind: "pillar",  opts: { height: 14, thickness: 1.4, capSize: 2.4 } },
      { kind: "truss",   opts: { height: 16, baseWidth: 5, thickness: 0.5 } },
      { kind: "tower",   opts: { height: 26, baseSize: 6, topSize: 2 } },
    ],
  },
  rpg: {
    radius: 38, count: 6, y: 0,
    forms: [
      { kind: "pillar",  opts: { height: 14, thickness: 1.6, capSize: 2.8 } },
      { kind: "tower",   opts: { height: 16, baseSize: 4, topSize: 1.8 } },
      { kind: "pillar",  opts: { height: 12, thickness: 1.4, capSize: 2.4 } },
      { kind: "tower",   opts: { height: 18, baseSize: 4.5, topSize: 2 } },
    ],
  },
};

function _placeForm(graph, form, x, y, z, idx) {
  const commitOpts = { namePrefix: "Silhouette_" + idx, tags: [SILHOUETTE_TAG, "vertical-form"] };
  const opts = { ...form.opts, x, y, z };
  switch (form.kind) {
    case "tower":  return ModuleLibrary.tower(graph,  opts, commitOpts);
    case "pillar": return ModuleLibrary.pillar(graph, opts, commitOpts);
    case "truss":  return ModuleLibrary.truss(graph,  opts, commitOpts);
    case "bridge": return ModuleLibrary.bridge(graph, opts, commitOpts);
    default:       return [];
  }
}

export const SilhouettePass = {
  apply({ graph, target }) {
    const type = String(target.type || target.id || "").toLowerCase();
    const plan = SILHOUETTE_PLANS[type];
    if (!plan) return { ok: true, type, formsAdded: 0, skipped: true };

    let formsAdded = 0;
    let maxHeight  = 0;
    for (let i = 0; i < plan.count; i++) {
      const angle = (i / plan.count) * Math.PI * 2;
      const x = Math.round(Math.cos(angle) * plan.radius);
      const z = Math.round(Math.sin(angle) * plan.radius);
      const form = plan.forms[i % plan.forms.length];
      const nodes = _placeForm(graph, form, x, plan.y, z, i);
      formsAdded += nodes.length;
      if (form.opts && form.opts.height && form.opts.height > maxHeight) {
        maxHeight = form.opts.height;
      }
    }

    return { ok: true, type, formsAdded, verticalSpan: maxHeight, count: plan.count };
  },
};

export default SilhouettePass;
