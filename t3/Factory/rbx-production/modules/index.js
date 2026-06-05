// t3/Factory/rbx-production/modules/index.js
// AF51-RBX | T3 Layer — Module Library aggregator.
// Each category exports named factories returning arrays of part specs:
//   { className, name, properties, tags }
// `parent` is omitted — the caller supplies it when committing to the SceneGraph.

export { Walls }    from "./walls.js";
export { Floors }   from "./floors.js";
export { Corners }  from "./corners.js";
export { Stairs }   from "./stairs.js";
export { Doors }    from "./doors.js";
export { Pillars }  from "./pillars.js";
export { Bridges }  from "./bridges.js";
export { Railings } from "./railings.js";
export { Windows }  from "./windows.js";
export { Supports } from "./supports.js";

export { part, wedge, cylinder, v3, rgb, cf } from "./_util.js";

// Module catalogue used by ModuleLibrary.list() and QualityGate V2 for diversity checks.
export const MODULE_CATEGORIES = [
  "walls", "floors", "corners", "stairs", "doors",
  "pillars", "bridges", "railings", "windows", "supports",
];
