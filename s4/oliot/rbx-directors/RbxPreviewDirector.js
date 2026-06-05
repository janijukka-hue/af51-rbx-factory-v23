// s4/oliot/rbx-directors/RbxPreviewDirector.js
// KERROS: S4 – Olio · RBX Director Layer · Version 1.0.0
//
// RBX Preview Director — TECHNICAL understanding. Takes a scene graph (+ the
// per-node skill interpretation) and returns an enriched preview graph: what
// the code technically contains, grouped semantically. It does not draw, does
// not generate, does not change the product. Every section is derived from real
// nodes; absent signals yield empty groups, never invented ones.
//
//   const dir = new RbxPreviewDirector();
//   const enriched = dir.enrich(sceneGraph, interpretedMap);

import { gather, nameMatches } from "./_directorBase.js";

export class RbxPreviewDirector {
  enrich(graph, interpreted) {
    const nodes = (graph && graph.nodes) || [];
    interpreted = interpreted || {};

    return {
      kind: "ENRICHED_PREVIEW_GRAPH",
      schemaVersion: "1.0.0",
      semantic:    this._semantic(nodes, interpreted),
      characters:  this._characters(nodes, interpreted),
      materials:   this._materials(nodes),
      lighting:    this._lighting(nodes, interpreted),
      effects:     this._effects(nodes, interpreted),
      ui:          this._ui(nodes, interpreted),
      environment: this._environment(nodes),
      performance: this._performance(nodes, interpreted),
    };
  }

  // ── Semantic Intelligence: name what objects ARE, by name/role evidence ──
  _semantic(nodes, interp) {
    const buckets = {
      doors:    nameMatches(nodes, ["door"]),
      windows:  nameMatches(nodes, ["window"]),
      weapons:  nameMatches(nodes, ["weapon", "sword", "gun", "blaster", "blade"]),
      vehicles: nameMatches(nodes, ["car", "vehicle", "truck", "boat", "plane"]),
      npcs:     nameMatches(nodes, ["npc", "villager", "guard", "enemy", "boss", "merchant", "trader"]),
      shops:    nameMatches(nodes, ["shop", "store", "merchant", "stall"]),
      portals:  nameMatches(nodes, ["portal", "teleport", "warp"]),
      spawns:   gather(interp, nodes, (s, n) => n.className === "SpawnLocation"),
      questGivers: nameMatches(nodes, ["quest", "questgiver"]),
      lobbies:  nameMatches(nodes, ["lobby", "spawnarea", "hub"]),
    };
    // Strip empty buckets so we never imply content that isn't there.
    const out = {};
    for (const k of Object.keys(buckets)) if (buckets[k].length) out[k] = buckets[k];
    return out;
  }

  // ── Character Intelligence: rigs and their parts ─────────────────────────
  _characters(nodes, interp) {
    const characters = [];
    for (const n of nodes) {
      const sem = interp[n.id] || {};
      const isModel = n.className === "Model";
      if (sem.kind === "character" || sem.role === "humanoid-root" || isModel) {
        const parts = nodes.filter((c) => c.parentVar === n.varName);
        const partKinds = {};
        for (const c of parts) {
          const cs = interp[c.id] || {};
          if (cs.kind) partKinds[cs.kind] = (partKinds[cs.kind] || 0) + 1;
        }
        const hasHumanoid = parts.some((c) => c.className === "Humanoid");
        const hasBodyParts = !!(partKinds.head || partKinds.limb || partKinds.torso);
        // A Model counts as a character only if it actually has a Humanoid or
        // recognizable body parts — never invent a rig for an empty Model.
        if (sem.kind === "character" || hasHumanoid || hasBodyParts) {
          characters.push({
            name: (n.properties && n.properties.Name) || n.varName,
            rig: hasHumanoid ? "humanoid" : "model",
            parts: partKinds,
          });
        }
      }
    }
    const looseParts = gather(interp, nodes, (s) => s.role === "humanoid-part");
    return { rigs: characters, looseHumanoidParts: looseParts };
  }

  // ── Material Intelligence: real materials → render hints ─────────────────
  _materials(nodes) {
    const counts = {};
    for (const n of nodes) {
      const m = n.properties && n.properties.Material;
      if (m) {
        const key = String(m).replace(/^Enum\.Material\./, "");
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    const hints = {};
    if (counts.Neon) hints.glow = true;
    if (counts.Glass || counts.ForceField) hints.transparency = true;
    if (counts.Metal || counts.DiamondPlate) hints.reflection = true;
    return { counts, hints };
  }

  // ── Lighting Intelligence: light sources present ─────────────────────────
  _lighting(nodes, interp) {
    const lights = gather(interp, nodes, (s) => s.isLight === true);
    const atmosphere = nodes
      .filter((n) => ["Atmosphere", "ColorCorrectionEffect", "BloomEffect",
                      "SunRaysEffect", "DepthOfFieldEffect"].includes(n.className))
      .map((n) => n.className);
    return { lights, lightCount: lights.length, atmosphere };
  }

  // ── Effect Intelligence ──────────────────────────────────────────────────
  _effects(nodes, interp) {
    const effects = gather(interp, nodes, (s) => s.isEffect === true);
    return { effects, effectCount: effects.length };
  }

  // ── UI Intelligence: recognize UI surfaces by name/structure ─────────────
  _ui(nodes, interp) {
    const uiNodes = nodes.filter((n) => (interp[n.id] || {}).ui === true);
    const surfaces = {
      hud:       nameMatches(uiNodes, ["hud", "status"]),
      inventory: nameMatches(uiNodes, ["inventory", "backpack", "items"]),
      shop:      nameMatches(uiNodes, ["shop", "store", "buy"]),
      quest:     nameMatches(uiNodes, ["quest", "objective"]),
      dialog:    nameMatches(uiNodes, ["dialog", "dialogue", "speech"]),
      menu:      nameMatches(uiNodes, ["menu", "title", "start"]),
      settings:  nameMatches(uiNodes, ["settings", "options"]),
    };
    const out = {};
    for (const k of Object.keys(surfaces)) if (surfaces[k].length) out[k] = surfaces[k];
    return { surfaceCount: uiNodes.length, surfaces: out };
  }

  // ── Environment Intelligence: structural names ───────────────────────────
  _environment(nodes) {
    const env = {
      buildings: nameMatches(nodes, ["building", "house", "tower", "smithy", "inn", "temple", "shop"]),
      dungeon:   nameMatches(nodes, ["dungeon", "cave", "crypt"]),
      forest:    nameMatches(nodes, ["tree", "forest", "bush"]),
      arena:     nameMatches(nodes, ["arena", "ring", "stadium"]),
      track:     nameMatches(nodes, ["road", "path", "track", "lane"]),
    };
    const out = {};
    for (const k of Object.keys(env)) if (env[k].length) out[k] = env[k];
    return out;
  }

  // ── Performance Intelligence: real counts → mobile-cost estimate ─────────
  _performance(nodes, interp) {
    let parts = 0, meshes = 0, lights = 0, particles = 0;
    for (const n of nodes) {
      const s = interp[n.id] || {};
      if (n.className === "MeshPart" || s.kind === "meshpart") meshes++;
      else if (s.drawable !== false && (s.kind === "part" || s.kind === "head" ||
               s.kind === "limb" || s.kind === "torso" || s.kind === "meshed-part")) parts++;
      if (s.isLight) lights++;
      if (s.isEffect) particles++;
    }
    // Conservative, transparent heuristic (documented, not magic).
    const drawCalls = parts + meshes * 2 + lights * 2 + particles * 3;
    let mobile;
    if (drawCalls <= 60) mobile = "mobile-ready";
    else if (drawCalls <= 150) mobile = "mid-range";
    else mobile = "desktop-heavy";
    return { parts, meshes, lights, particles, drawCallEstimate: drawCalls, mobile };
  }
}

export default RbxPreviewDirector;
