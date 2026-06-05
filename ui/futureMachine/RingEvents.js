// ui/futureMachine/RingEvents.js
// AF51 FutureMachine — read-only adapter from PipelineAudit records to
// "ring events" consumed by the visualization layer.
//
// IMPORTANT — scope:
//   This module is part of FutureMachine, a visual shell on top of the
//   existing production pipeline. It NEVER imports from the build manager,
//   the publish chain, the save chain, the ZIP chain or the preview format,
//   and it MUST NOT mutate factory state. Pure functions only.
//
// Source of truth: k1/Ydin/pipeline-audit.js — PipelineAudit.records[].
// Each record has the shape: { seq, traceId, phase, event, payload, at }.

// ── FactoryRing contract ─────────────────────────────────────────────────────
// 6 visual segments around the core sphere. The order here defines the
// clockwise layout starting at 12 o'clock (TARGET).
export const FactoryRingContract = Object.freeze({
  id: "factory",
  segments: ["TARGET", "HIERARCHY", "LUAU", "ASSETS", "PACKAGE", "ZIP"],
  // BUILD_PHASE (from k1/Ydin/pipeline-audit.js + m2/roblox/...) → segment.
  // FAILED applies to whichever segment was last active and is handled below.
  segmentMap: Object.freeze({
    STERILITY:         "TARGET",
    HIERARCHY:         "HIERARCHY",
    RUNTIME_INJECT:    "HIERARCHY",
    VISUAL_PRODUCTION: "HIERARCHY",
    LUAU_GEN:          "LUAU",
    REMOTE_BUILD:      "LUAU",
    UI_BUILD:          "LUAU",
    ROJO_EXPORT:       "ASSETS",
    PREVIEW_GEN:       "ASSETS",
    ASSET_PACKAGE:     "PACKAGE",
    ROJO_VALIDATE:     "PACKAGE",
    SIGN:              "ZIP",
    VALIDATE:          "ZIP",
    GHOST_SEAL:        "ZIP",
    ZIP_HARDEN:        "ZIP",
    COMPLETE:          "ZIP",
    FAILED:            null,
  }),
});

// ── CoreSphere contract ──────────────────────────────────────────────────────
// The sphere represents the build as a whole; transitions are derived from
// terminal-ish phases in the audit stream.
export const CoreSphereContract = Object.freeze({
  id: "core",
  states: ["idle", "building", "sealed", "error"],
});

// ── IntentRing contract ──────────────────────────────────────────────────────
// 5 visual segments representing "what the build was meant to be". Source is
// ZIP metadata (manifest.json + production-quality-report.json), NOT records.
// Because intent is a static property of the build, IntentRing is filled via
// runtime.applyIntent({...}) rather than from the audit stream.
export const IntentRingContract = Object.freeze({
  id: "intent",
  segments: ["TARGET", "TEMPLATE", "QUALITY", "RULES", "IDENTITY"],
  // Minimum QualityScore that the production gate requires to pass.
  qualityGate: 85,
});

// Pure: same intent payload always yields the same list of ring events.
// `intent` shape: { targetId, targetType, qualityScore, qualityPass,
//                   rules: { total, satisfied, identity }, ... }
// `atOverride` lets the runtime stamp events deterministically (e.g. with the
// last record timestamp) so replay and live ingestion produce identical lastAt.
export function intentToRingEvents(intent, atOverride) {
  if (!intent || typeof intent !== "object") return [];
  var out = [];
  var at = (typeof atOverride === "number" && atOverride > 0) ? atOverride : (intent.at || 0);
  function emit(seg, state) {
    out.push({ ring: "intent", segment: seg, state: state, at: at, raw: intent });
  }

  emit("TARGET",   intent.targetId   ? "done" : "idle");
  emit("TEMPLATE", intent.targetType ? "done" : "idle");

  var qs = Number(intent.qualityScore);
  if (Number.isFinite(qs)) {
    emit("QUALITY", qs >= IntentRingContract.qualityGate ? "done" : "error");
  } else {
    emit("QUALITY", "idle");
  }

  var rules = intent.rules || {};
  var total = Number(rules.total) || 0;
  var sat   = Number(rules.satisfied) || 0;
  if (total === 0)            emit("RULES", "idle");
  else if (sat === total)     emit("RULES", "done");
  else if (sat === 0)         emit("RULES", "error");
  else                        emit("RULES", "active");

  emit("IDENTITY", (rules.identity && String(rules.identity).length > 0) ? "done" : "idle");

  return out;
}

// ── MemoryRing contract ──────────────────────────────────────────────────────
// 5 visual segments representing the build's place in history. Source is
// ZIP metadata (ghost/lineage.json), NOT records. Like IntentRing, fed via
// runtime.applyMemory(ledger). Replay invariant preserved by stamping events
// with the runtime's lastRecordAt.
export const MemoryRingContract = Object.freeze({
  id: "memory",
  segments: ["LEDGER", "ANCESTOR", "GENERATION", "MUTATION", "HEALTH"],
});

// Pure: same ledger payload always yields the same list of ring events.
// `ledger` shape (subset of lineage.json):
//   { ghostId, artifactId, parentCapsuleId, buildGeneration,
//     mutationSource, repairCount, ... }
export function memoryToRingEvents(ledger, atOverride) {
  if (!ledger || typeof ledger !== "object") return [];
  var out = [];
  var at = (typeof atOverride === "number" && atOverride > 0) ? atOverride : (ledger.at || 0);
  function emit(seg, state) {
    out.push({ ring: "memory", segment: seg, state: state, at: at, raw: ledger });
  }

  emit("LEDGER", (ledger.ghostId && ledger.artifactId) ? "done" : "idle");

  // Genesis builds (parentCapsuleId === null) are not an error — they are
  // the start of a chain. Idle keeps the ring honest: "no ancestor known".
  emit("ANCESTOR", ledger.parentCapsuleId ? "done" : "idle");

  var gen = Number(ledger.buildGeneration);
  emit("GENERATION", Number.isFinite(gen) && gen >= 1 ? "done" : "idle");

  emit("MUTATION", (ledger.mutationSource && String(ledger.mutationSource).length > 0) ? "done" : "idle");

  var repairs = Number(ledger.repairCount) || 0;
  emit("HEALTH", repairs === 0 ? "done" : "active");

  return out;
}

// ── EnergyRing contract ──────────────────────────────────────────────────────
// 5 visual segments representing the build's resource footprint. Source is
// a server-side aggregate (buildDuration, zipSize, recordCount, runtimeModules,
// entryCount), NOT records. Fed via runtime.applyEnergy(energy). Same
// determinism contract as IntentRing/MemoryRing: stamped with lastRecordAt.
export const EnergyRingContract = Object.freeze({
  id: "energy",
  segments: ["DURATION", "FOOTPRINT", "RECORDS", "MODULES", "ENTRIES"],
});

// Pure: same energy payload always yields the same list of ring events.
// `energy` shape:
//   { buildDuration, zipSize, recordCount, runtimeModules, entryCount }
// All fields optional; missing/zero leaves the corresponding segment idle.
export function energyToRingEvents(energy, atOverride) {
  if (!energy || typeof energy !== "object") return [];
  var out = [];
  var at = (typeof atOverride === "number" && atOverride > 0) ? atOverride : (energy.at || 0);
  function emit(seg, state) {
    out.push({ ring: "energy", segment: seg, state: state, at: at, raw: energy });
  }

  var dur = Number(energy.buildDuration);
  emit("DURATION", Number.isFinite(dur) && dur > 0 ? "done" : "idle");

  var size = Number(energy.zipSize);
  emit("FOOTPRINT", Number.isFinite(size) && size > 0 ? "done" : "idle");

  var rec = Number(energy.recordCount);
  emit("RECORDS", Number.isFinite(rec) && rec > 0 ? "done" : "idle");

  var mods = Number(energy.runtimeModules);
  emit("MODULES", Number.isFinite(mods) && mods > 0 ? "done" : "idle");

  var ent = Number(energy.entryCount);
  emit("ENTRIES", Number.isFinite(ent) && ent > 0 ? "done" : "idle");

  return out;
}

// ── WorldRing contract ───────────────────────────────────────────────────────
// 5 visual segments representing the build's outer environment / deploy
// surface. Source is manifest.json (factory, rojo, robloxCompatible,
// signedAt, masterHash), NOT records. Fed via runtime.applyWorld(world).
// Same determinism contract as the other static rings: stamped with lastRecordAt.
export const WorldRingContract = Object.freeze({
  id: "world",
  segments: ["PLATFORM", "RUNTIME", "COMPATIBILITY", "SIGNATURE", "IDENTITY"],
});

// Pure: same world payload always yields the same list of ring events.
// `world` shape (subset of manifest.json):
//   { factory, rojo, robloxCompatible, signedAt, masterHash }
// All fields optional; missing/falsy leaves the corresponding segment idle.
// `robloxCompatible === false` is a hard error (red) — the build claims a
// Roblox surface but reports incompatibility.
export function worldToRingEvents(world, atOverride) {
  if (!world || typeof world !== "object") return [];
  var out = [];
  var at = (typeof atOverride === "number" && atOverride > 0) ? atOverride : (world.at || 0);
  function emit(seg, state) {
    out.push({ ring: "world", segment: seg, state: state, at: at, raw: world });
  }

  emit("PLATFORM", (world.factory && String(world.factory).length > 0) ? "done" : "idle");
  emit("RUNTIME",  (world.rojo    && String(world.rojo).length > 0)    ? "done" : "idle");

  if (world.robloxCompatible === false) emit("COMPATIBILITY", "error");
  else if (world.robloxCompatible === true) emit("COMPATIBILITY", "done");
  else emit("COMPATIBILITY", "idle");

  emit("SIGNATURE", (world.signedAt  && String(world.signedAt).length > 0)  ? "done" : "idle");
  emit("IDENTITY",  (world.masterHash && String(world.masterHash).length > 0) ? "done" : "idle");

  return out;
}

// ── GhostRing contract ───────────────────────────────────────────────────────
// 5 visual segments matching the 5 files produced by the Ghost Vault seal,
// as observed in GHOST_SEAL records' payload.files array.
export const GhostRingContract = Object.freeze({
  id: "ghost",
  segments: ["LINEAGE", "RECOVERY", "SIGNATURE", "HASH", "POLICY"],
  // ghost-file basename → segment
  fileMap: Object.freeze({
    "lineage.json":     "LINEAGE",
    "recovery.map":     "RECOVERY",
    "deploy.signature": "SIGNATURE",
    "runtime.hash":     "HASH",
    "policy.snapshot":  "POLICY",
  }),
});

// ── Event classification ─────────────────────────────────────────────────────
function classifyState(record) {
  var ev = String((record && record.event) || "");
  if (record && record.phase === "FAILED") return "error";
  if (/FAIL|ERROR|REJECT/i.test(ev)) return "error";
  // Phase-OK / sealing / hardening / completion all map to "done".
  if (/(^|_)OK$|PHASE_OK|SEAL_OK|HARDEN_OK|VALIDATED|COMPLETE/i.test(ev)) return "done";
  if (record && record.phase === "COMPLETE") return "done";
  return "active";
}

// Pure function: same record always yields the same list of ring events.
// Returns: Array<{ ring, segment|null, state, at, raw }>
export function recordToRingEvents(record) {
  if (!record || !record.phase) return [];
  var out = [];
  var seg = FactoryRingContract.segmentMap[record.phase];
  var state = classifyState(record);

  if (seg) {
    out.push({ ring: "factory", segment: seg, state: state, at: record.at || 0, raw: record });
  }

  // GhostRing transitions:
  //   SEAL_BEGIN → all 5 segments go "active" (sealing in progress)
  //   SEAL_OK + payload.files → listed files become "done"
  //   FAILED during seal → segments go "error"
  if (record.phase === "GHOST_SEAL") {
    if (record.event === "SEAL_BEGIN") {
      for (var i = 0; i < GhostRingContract.segments.length; i++) {
        out.push({ ring: "ghost", segment: GhostRingContract.segments[i], state: "active", at: record.at || 0, raw: record });
      }
    } else if (record.event === "SEAL_OK" || state === "done") {
      var files = (record.payload && record.payload.files) || [];
      for (var k = 0; k < files.length; k++) {
        var gseg = GhostRingContract.fileMap[files[k]];
        if (gseg) out.push({ ring: "ghost", segment: gseg, state: "done", at: record.at || 0, raw: record });
      }
    } else if (state === "error") {
      for (var j = 0; j < GhostRingContract.segments.length; j++) {
        out.push({ ring: "ghost", segment: GhostRingContract.segments[j], state: "error", at: record.at || 0, raw: record });
      }
    }
  }

  // CoreSphere transitions: STERILITY → building, GHOST_SEAL/COMPLETE → sealed,
  // FAILED → error. Other phases don't move the sphere.
  if (record.phase === "STERILITY") {
    out.push({ ring: "core", segment: null, state: "building", at: record.at || 0, raw: record });
  } else if (record.phase === "GHOST_SEAL" && state !== "error") {
    out.push({ ring: "core", segment: null, state: "sealed", at: record.at || 0, raw: record });
  } else if (record.phase === "COMPLETE") {
    out.push({ ring: "core", segment: null, state: "sealed", at: record.at || 0, raw: record });
  } else if (record.phase === "FAILED" || state === "error") {
    out.push({ ring: "core", segment: null, state: "error", at: record.at || 0, raw: record });
  }

  return out;
}
