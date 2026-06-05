// m2/Ohjaus/project-spec.js
// KERROS: M2 – Ohjaus
// M2 tuottaa ProjectSpec-olion → T3 rakentaa sen.
// M2 ei kirjoita tiedostoja, ei suorita komentoja.

export const PROJECT_SPEC_VERSION = "1.0.0";

export const TARGET = {
  EXPO_APP:     "expo-app",
  NODE_SERVICE: "node-service",
  WEB_REACT:    "web-react",
  API_SERVER:   "api-server"
};

export const STACK = {
  EXPO_MANAGED: "expo-managed",
  EXPO_BARE:    "expo-bare",
  NODE_ESM:     "node-esm",
  NODE_CJS:     "node-cjs",
  REACT_VITE:   "react-vite",
  REACT_CRA:    "react-cra",
  EXPRESS:      "express",
  FASTIFY:      "fastify"
};

export const FEATURE = {
  TYPESCRIPT:   "typescript",
  ESLINT:       "eslint",
  PRETTIER:     "prettier",
  JEST:         "jest",
  TESTING_LIB:  "testing-library",
  REACT_NAV:    "react-navigation",
  EXPO_ROUTER:  "expo-router",
  TAILWIND:     "tailwind",
  ZUSTAND:      "zustand",
  REACT_QUERY:  "react-query"
};

export const CONSTRAINT = {
  MAX_BUNDLE_KB:     "maxBundleKb",
  MAX_DEPS:          "maxDeps",
  NODE_VERSION:      "nodeVersion",
  EXPO_SDK_VERSION:  "expoSdkVersion",
  NO_NATIVE_MODULES: "noNativeModules",
  WEB_ONLY:          "webOnly"
};

var DEFAULT_STACK = {
  "expo-app":     STACK.EXPO_MANAGED,
  "node-service": STACK.NODE_ESM,
  "web-react":    STACK.REACT_VITE,
  "api-server":   STACK.EXPRESS
};

var DEFAULT_FEATURES = {
  "expo-app":     [FEATURE.ESLINT, FEATURE.REACT_NAV],
  "node-service": [FEATURE.TYPESCRIPT, FEATURE.ESLINT, FEATURE.JEST],
  "web-react":    [FEATURE.TYPESCRIPT, FEATURE.ESLINT, FEATURE.PRETTIER, FEATURE.JEST],
  "api-server":   [FEATURE.TYPESCRIPT, FEATURE.ESLINT, FEATURE.JEST]
};

var DEFAULT_CONSTRAINTS = {
  "expo-app":     { maxBundleKb: 5120, noNativeModules: false, expoSdkVersion: "51" },
  "node-service": { nodeVersion: "18", maxDeps: 50 },
  "web-react":    { maxBundleKb: 1024, webOnly: true },
  "api-server":   { nodeVersion: "18", maxDeps: 30 }
};

var DEFAULT_STAGES = {
  "expo-app":     ["VALIDATE","TEMPLATE","SYNTHESIZE","DEPS","BUILD","TEST","SECURITY","PACKAGE","PREVIEW","PUBLISH"],
  "node-service": ["VALIDATE","TEMPLATE","SYNTHESIZE","DEPS","BUILD","TEST","SECURITY","PACKAGE","PUBLISH"],
  "web-react":    ["VALIDATE","TEMPLATE","SYNTHESIZE","DEPS","BUILD","TEST","SECURITY","PACKAGE","PREVIEW","PUBLISH"],
  "api-server":   ["VALIDATE","TEMPLATE","SYNTHESIZE","DEPS","BUILD","TEST","SECURITY","PACKAGE","PUBLISH"]
};

function uniqueArr(a, b) {
  var set = {};
  var out = [];
  var merged = a.concat(b);
  for (var i = 0; i < merged.length; i++) {
    if (!set[merged[i]]) { set[merged[i]] = true; out.push(merged[i]); }
  }
  return out;
}

function randomId() {
  var ts  = Date.now();
  var rnd = Math.random().toString(36).slice(2, 8);
  return "spec_" + ts + "_" + rnd;
}

// ─── buildProjectSpec ────────────────────────────────────────

export function buildProjectSpec(target, params) {
  var p = params || {};
  if (!target) throw new Error("buildProjectSpec: target vaaditaan");
  if (!DEFAULT_STACK[target]) {
    throw new Error("buildProjectSpec: tuntematon target '" + target + "'. Tuetut: " + Object.keys(DEFAULT_STACK).join(", "));
  }

  var name        = p.name  || ("project-" + Date.now());
  var stack       = p.stack || DEFAULT_STACK[target];
  var features    = uniqueArr(DEFAULT_FEATURES[target] || [], Array.isArray(p.features) ? p.features : []);
  var constraints = Object.assign({}, DEFAULT_CONSTRAINTS[target] || {}, p.constraints || {});
  var stages      = Array.isArray(p.stages) ? p.stages : (DEFAULT_STAGES[target] || []);

  return {
    id:          randomId(),
    version:     PROJECT_SPEC_VERSION,
    createdAt:   new Date().toISOString(),
    requestedBy: p.requestedBy || "system",
    target:      target,
    stack:       stack,
    name:        name,
    features:    features,
    constraints: constraints,
    patches:     Array.isArray(p.patches) ? p.patches : [],
    meta:        p.meta || {},
    pipeline: {
      stages:   stages,
      timeout:  p.pipelineTimeout || 15 * 60 * 1000
    }
  };
}

// ─── validateProjectSpec ─────────────────────────────────────

export function validateProjectSpec(spec) {
  var errors = [];
  if (!spec)                              { errors.push("spec on null"); return { valid: false, errors: errors }; }
  if (!spec.id)                           errors.push("id puuttuu");
  if (!spec.target)                       errors.push("target puuttuu");
  if (!spec.stack)                        errors.push("stack puuttuu");
  if (!spec.name)                         errors.push("name puuttuu");
  if (!Array.isArray(spec.features))      errors.push("features ei ole taulukko");
  if (typeof spec.constraints !== "object") errors.push("constraints ei ole objekti");
  if (spec.target && !DEFAULT_STACK[spec.target]) errors.push("Tuntematon target: " + spec.target);
  if (spec.name && !/^[a-zA-Z0-9_\-]{1,64}$/.test(spec.name)) {
    errors.push("Projektin nimi '" + spec.name + "' sisältää kiellettyjä merkkejä tai on liian pitkä");
  }
  return { valid: errors.length === 0, errors: errors };
}

// ─── specToT3Command ─────────────────────────────────────────

export function specToT3Command(spec) {
  var validation = validateProjectSpec(spec);
  if (!validation.valid) throw new Error("specToT3Command: Virheellinen spec: " + validation.errors.join(", "));
  return {
    intent:      "BUILD_PROJECT",
    specId:      spec.id,
    projectName: spec.name,
    target:      spec.target,
    stack:       spec.stack,
    features:    spec.features,
    constraints: spec.constraints,
    patches:     spec.patches,
    pipeline:    spec.pipeline,
    metadata:    { requestedBy: spec.requestedBy, createdAt: spec.createdAt, meta: spec.meta }
  };
}

// ─── Pikafunktiot ────────────────────────────────────────────

export function specExpoApp(name, params)    { return buildProjectSpec(TARGET.EXPO_APP,     Object.assign({ name: name }, params || {})); }
export function specNodeService(name, params){ return buildProjectSpec(TARGET.NODE_SERVICE, Object.assign({ name: name }, params || {})); }
export function specWebReact(name, params)   { return buildProjectSpec(TARGET.WEB_REACT,    Object.assign({ name: name }, params || {})); }

export default buildProjectSpec;