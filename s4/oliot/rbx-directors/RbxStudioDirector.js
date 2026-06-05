// s4/oliot/rbx-directors/RbxStudioDirector.js
// KERROS: S4 – Olio · RBX Director Layer · Version 1.0.0
//
// RBX Studio Director — PRODUCTION READINESS. Reads the scene graph + the
// Preview Director's enriched output and assesses whether this is fit to ship:
// mobile readiness, performance, scalability, publish readiness, technical
// risks. It interprets only — it never changes the product or invents issues.
// Every warning/risk points at a concrete signal in the build.
//
//   const sd = new RbxStudioDirector();
//   const r = sd.assess(enriched, sceneGraph);  // { readiness, warnings, risks, recommendations }

import { finding } from "./_directorBase.js";

export class RbxStudioDirector {
  assess(enriched, graph) {
    enriched = enriched || {};
    const nodes = (graph && graph.nodes) || [];
    const perf = enriched.performance || {};

    const warnings = [];
    const risks = [];
    const recommendations = [];

    // ── Mobile readiness — from the Preview Director's draw-call estimate ──
    const draws = perf.drawCallEstimate || 0;
    const mobile = perf.mobile || "undetermined";
    if (mobile === "desktop-heavy") {
      risks.push("High draw-call estimate (" + draws + ") — likely poor on mobile devices.");
      recommendations.push("Reduce part/effect count or merge geometry for mobile.");
    } else if (mobile === "mid-range") {
      warnings.push("Moderate scene cost (" + draws + " draws) — test on low-end devices.");
    }

    // ── Publish readiness — must have a spawn, must not be empty ──────────
    const hasSpawn = nodes.some((n) => n.className === "SpawnLocation");
    if (!hasSpawn) {
      risks.push("No SpawnLocation — players have nowhere to spawn on publish.");
      recommendations.push("Add a SpawnLocation before publishing.");
    }
    if (nodes.length === 0) {
      risks.push("Empty scene — nothing to publish.");
    }

    // ── Scripts present? (a world with no logic is static) ───────────────
    const scriptCount = nodes.filter((n) =>
      ["Script", "LocalScript", "ModuleScript"].includes(n.className)).length;
    if (scriptCount === 0 && nodes.length > 0) {
      warnings.push("No scripts — the place is static (no gameplay logic).");
    }

    // ── Effects/lights cost on mobile ────────────────────────────────────
    if ((perf.particles || 0) > 5) {
      warnings.push((perf.particles) + " particle effects — heavy on mobile GPUs.");
    }
    if ((perf.lights || 0) > 8) {
      warnings.push((perf.lights) + " dynamic lights — consider baking or reducing.");
    }

    // ── Scalability note (transparent heuristic) ─────────────────────────
    const scalability =
      nodes.length > 500 ? "large scene — watch streaming/memory" :
      nodes.length > 0   ? "manageable scene size" : "empty";

    // ── Overall readiness verdict (evidence = the counts above) ──────────
    let level, conf;
    if (risks.length > 0)        { level = "not-ready"; conf = 0.8; }
    else if (warnings.length > 1){ level = "needs-review"; conf = 0.6; }
    else                         { level = "publish-ready"; conf = 0.7; }

    return {
      kind: "STUDIO_REPORT",
      schemaVersion: "1.0.0",
      readiness: finding(level, conf, [
        (hasSpawn ? "has spawn" : "no spawn"),
        "mobile: " + mobile,
        scriptCount + " scripts",
        nodes.length + " instances",
      ]),
      mobile,
      scalability,
      warnings,
      risks,
      recommendations,
      // The honest runtime boundary: AF51 previews structure; play needs Studio.
      runtimeNote: "AF51 previews the built structure. Full play/physics/lighting requires Roblox Studio.",
    };
  }
}

export default RbxStudioDirector;
