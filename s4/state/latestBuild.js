// s4/state/latestBuild.js
// AF51-RBX — Canonical latestBuild shape + normalizer.
//
// One place that turns a /rbx/lua-build response into the shared latestBuild
// object both the Builder and the Cockpit read. Keeping this single source of
// truth prevents the two views from drifting into different shapes. Pure data
// transform — no network, no side effects.
//
//   latestBuild = {
//     source, status, errors,
//     previewData, structures,
//     enriched, design, studio, shots, diagnostics, skillsRing,
//     buildId, signature, artifactHash, zipName, downloadUrl, createdAt
//   }

export function normalizeLuaBuild(source, resp) {
  resp = resp || {};
  var sig = resp.signature || {};
  var zipName = resp.zipName || (resp.downloadUrl ? String(resp.downloadUrl).split(/[\\/]/).pop() : null);
  var previewData = resp.previewData || resp.preview || null;
  return {
    source: source || "",
    status: resp.ok ? "ok" : "failed",
    errors: resp.ok ? [] : [resp.error || "Unknown error"],

    previewData: previewData,
    structures: (previewData && previewData.structures) || [],

    enriched: resp.enriched || null,
    design:   resp.design || null,
    studio:   resp.studio || null,
    shots:    resp.shots || null,
    diagnostics: resp.diagnostics || null,
    skillsRing:  resp.skillsRing || null,

    buildId:      resp.buildId || null,
    signature:    sig.fingerprint || (typeof resp.signature === "string" ? resp.signature : null),
    artifactHash: sig.fingerprint || resp.artifactHash || null,
    instanceCount: resp.instanceCount != null ? resp.instanceCount : null,
    fileCount:     resp.fileCount != null ? resp.fileCount : null,

    zipName:     zipName,
    downloadUrl: resp.downloadUrl || null,
    createdAt:   Date.now(),
    origin:      "lua-build",
  };
}

// A failed build still produces a latestBuild (so the UI can show the error)
export function failedBuild(source, errorMessage) {
  return {
    source: source || "", status: "failed", errors: [errorMessage || "Build failed"],
    previewData: null, structures: [], enriched: null, design: null, studio: null, shots: null,
    diagnostics: null, skillsRing: null,
    buildId: null, signature: null, artifactHash: null, instanceCount: null, fileCount: null,
    zipName: null, downloadUrl: null, createdAt: Date.now(), origin: "lua-build",
  };
}

export default { normalizeLuaBuild, failedBuild };
