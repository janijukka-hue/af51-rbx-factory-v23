// t3/Factory/rbx-production/visual-director.js
// AF51-RBX | T3 Layer — VisualDirector
// Role  : Orchestrates the production chain over a SceneGraph:
//          SceneGraph → Composition → StructuralLayer → Density
//                     → Landmark → Silhouette → Traversal
//                     → Material → Lighting → Gameplay
//                     → Masterpiece → Tier → QualityGate → RobloxEmitter
//         Same target → byte-identical Luau output.

import { SceneGraph }          from "./scene-graph.js";
import { CompositionEngine }   from "./composition-engine.js";
import { StructuralLayerPass } from "./structural-layer-pass.js";
import { DensityController }   from "./density-controller.js";
import { LandmarkBuilder }     from "./landmark-builder.js";
import { SilhouettePass }      from "./silhouette-pass.js";
import { TraversalPass }       from "./traversal-pass.js";
import { MaterialPass }        from "./material-pass.js";
import { LightingPass }        from "./lighting-pass.js";
import { GameplayPass }        from "./gameplay-pass.js";
import { MasterpiecePass }     from "./masterpiece-pass.js";
import { MeshPass }            from "./mesh-pass.js";
import { DecalPass }           from "./decal-pass.js";
import { TerrainPass }         from "./terrain-pass.js";
import { TierTagger }          from "./tier-tagger.js";
import { QualityGate }         from "./quality-gate.js";
import { RobloxEmitter }       from "./roblox-emitter.js";

export const VisualDirector = {
  async direct({ buildRoot, target, auditLedger, buildId, deterministic, userSource = null }) {
    if (!buildRoot) throw new Error("[VisualDirector] buildRoot required");
    if (!target?.id) throw new Error("[VisualDirector] target.id required");

    const _a = (l, m, meta = {}) =>
      auditLedger?.[l]?.("[VisualDirector] " + m, { targetId: target.id, ...meta });

    const passLog = [];
    const _rec = (name, ok, info) => passLog.push({ name, ok, ...info });

    try {
      // Fresh per-build SceneGraph — guarantees no cross-target leakage
      // between back-to-back builds in the same Node process. Every pass
      // below is stateless and re-runs from this empty graph.
      const graph = new SceneGraph(target.id);
      if (graph.nodes.length !== 0) {
        throw new Error("[VisualDirector] SceneGraph constructor leaked state — refusing build");
      }
      _a("info", "FRESH BUILD STATE — empty graph", { target: target.id });

      // v64 CODE-AWARE FACTORY: if user provided Lua CODE (not prompt),
      // analyze it to determine what supporting infrastructure to build.
      // Prompts go through standard template-driven pipeline.
      let codeFeatures = null;
      let isLuaCode = false;
      if (userSource && typeof userSource === "string" && userSource.length > 0) {
        const { detectLuaInput } = await import("../../../m2/roblox/lua-input-detector.js");
        const detection = detectLuaInput(userSource);

        // Only analyze if it's actual Lua code, not a natural language prompt
        if (detection.isLua) {
          isLuaCode = true;
          const { analyzeCodeFeatures } = await import("../../../m2/roblox/lua-code-analyzer.js");
          codeFeatures = analyzeCodeFeatures(userSource);
          _a("info", `CODE-AWARE: ${codeFeatures.analysis.summary}`, {
            targetHint: codeFeatures.targetHint,
            signals: codeFeatures.analysis.signals,
            confidence: codeFeatures.analysis.confidence,
          });
        } else {
          // It's a prompt — log and continue to template-driven build
          _a("info", `PROMPT detected: "${userSource.slice(0, 50)}..." → template-driven build`);
        }
      }

      // Composition: if code-aware mode is active AND user code exists,
      // SKIP the full target composition (no RPG village, no OBBY course).
      // Instead, generate ONLY minimal support structures the code needs.
      let comp;
      let isCodeDriven = false;
      if (codeFeatures && codeFeatures.targetHint === "code-driven") {
        // User code is complete — no template needed
        _a("info", "CODE-DRIVEN mode: skipping template composition");
        comp = { ok: true, type: "code-driven", partsAdded: 0 };
        isCodeDriven = true;
      } else if (codeFeatures) {
        // User code needs some support — minimal composition
        _a("info", `CODE-AWARE mode: minimal ${codeFeatures.targetHint} support`);
        // TODO: implement minimal support builder here
        // For now, fall back to standard composition but log the intent
        comp = CompositionEngine.compose({ graph, target });
        isCodeDriven = true;  // Still code-driven, just with support
      } else {
        // No user code — standard target-based composition
        comp = CompositionEngine.compose({ graph, target });
      }
      _rec("composition", comp.ok, { partsAdded: comp.partsAdded, mode: codeFeatures ? "code-aware" : "template" });

      // World-believability passes (v61). Each runs on the SceneGraph in
      // place and is idempotent: a second run produces the same node count.
      const sl = StructuralLayerPass.apply({ graph });
      _rec("structuralLayer", sl.ok, {
        primariesTouched: sl.primariesTouched, secondaries: sl.secondaries,
        trims: sl.trims, lights: sl.lights, props: sl.props,
      });

      const dc = DensityController.apply({ graph, target });
      _rec("density", dc.ok, { totalAdded: dc.totalAdded, zones: dc.zones });

      const lm = LandmarkBuilder.apply({ graph, target });
      _rec("landmark", lm.ok, { parts: lm.parts });

      const sp = SilhouettePass.apply({ graph, target });
      _rec("silhouette", sp.ok, { formsAdded: sp.formsAdded, verticalSpan: sp.verticalSpan });

      const tr = TraversalPass.apply({ graph, target });
      _rec("traversal", tr.ok, { strips: tr.strips, markers: tr.markers, anchors: tr.anchors });

      const mat = MaterialPass.apply({ graph });
      _rec("material", mat.ok, { touched: mat.touched });

      const lit = LightingPass.apply({ graph, target });
      _rec("lighting", lit.ok, {
        lightsAdded: lit.lightsAdded,
        identityLights: lit.identityLights,
        beaconLights: lit.beaconLights,
      });

      const gp = GameplayPass.apply({ graph, target });
      _rec("gameplay", gp.ok, { added: gp.added });

      const mp = MasterpiecePass.apply({ graph, target });
      _rec("masterpiece", mp.ok, {
        shells: mp.shells, secondaryLandmarks: mp.secondaryLandmarks,
        propClusters: mp.propClusters, storytelling: mp.storytelling,
        rules: mp.rulesSatisfied,
      });

      // v63 — break cubic silhouette via engine-primitive shape mutation +
      // SpecialMesh children on hero geometry. No external AssetIds.
      const ms = MeshPass.apply({ graph });
      _rec("mesh", ms.ok, {
        shapesChanged: ms.shapesChanged,
        meshesAdded:   ms.meshesAdded,
        landmarksTouched: ms.landmarksTouched,
      });

      // v63 — per-target signage / faction iconography / surface graphics
      // on landmark + objective + gate parts. Tinted Decals, no Textures.
      const dp = DecalPass.apply({ graph, target });
      _rec("decal", dp.ok, { decalsAdded: dp.decalsAdded });

      // v63 — Real Roblox Terrain per-target biome (workspace.Terrain
      // :FillBlock ops emitted as AF51Terrain.server.lua).
      const tp = TerrainPass.apply({ graph, target });
      _rec("terrain", tp.ok, { biome: tp.biome, opsCount: tp.opsCount });

      const tt = TierTagger.apply({ graph });
      _rec("tier", tt.ok, { stamped: tt.stamped, perTier: tt.perTier });

      // v64 CODE-AWARE: if user provided code, relax QualityGate to allow
      // minimal/empty composition (user code drives the world, not templates).
      const qa = QualityGate.evaluate({ graph, target, isCodeDriven });
      _rec("qualityGate", qa.ok, {
        parts:     qa.parts,
        criticals: qa.criticals?.length || 0,
        warnings:  qa.warnings?.length  || 0,
        mode:      isCodeDriven ? "code-driven" : "template",
      });
      if (qa.warnings?.length) {
        _a("warn", "QualityGate warnings: " + qa.warnings.length, { warnings: qa.warnings });
      }

      // Emit metadata FIRST so the quality report lands in the ZIP even when
      // the gate blocks the build — operators need the evidence either way.
      const em = await RobloxEmitter.emit({ buildRoot, graph, buildId, deterministic });
      _rec("emit", em.ok, { files: em.files.length });

      // Blocking gate: if any critical invariant failed, fail the phase
      // (metadata is already on disk so the report is preserved).
      if (!qa.ok) {
        const msg = "QualityGate blocked build: " +
                    (qa.criticals || []).join("; ");
        _a("error", msg, { criticals: qa.criticals });
        throw new Error(msg);
      }

      _a("info", "VISUAL_PRODUCTION complete", {
        nodes: graph.nodes.length,
        files: em.files,
      });

      return {
        ok: true,
        files: em.files,
        nodeCount: graph.nodes.length,
        passLog,
        report: qa,
      };
    } catch (err) {
      _a("error", "VISUAL_PRODUCTION failed: " + err.message);
      return { ok: false, error: err.message, passLog };
    }
  },
};

export default VisualDirector;
