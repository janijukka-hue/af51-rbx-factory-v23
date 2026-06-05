// s4/oliot/rbx-directors/RbxCreativeDirector.js
// KERROS: S4 – Olio · RBX Director Layer · Version 1.0.0
//
// RBX Creative Director — CREATIVE assessment. Reads the scene graph (+ skill
// interpretation) and produces a design report: what kind of game/level/art
// this appears to be. It does NOT render, draw, or change the product, and —
// critically — it never invents a verdict. Every assessment carries evidence
// and a confidence; with no supporting signal the verdict is UNDETERMINED.
//
//   const cd = new RbxCreativeDirector();
//   const report = cd.assess(sceneGraph, interpretedMap);

import { finding, UNDETERMINED, nameMatches, gather } from "./_directorBase.js";

export class RbxCreativeDirector {
  assess(graph, interpreted) {
    const nodes = (graph && graph.nodes) || [];
    interpreted = interpreted || {};

    return {
      kind: "DESIGN_REPORT",
      schemaVersion: "1.0.0",
      gameplayType:  this._gameplay(nodes),
      artDirection:  this._artDirection(nodes),
      levelDesign:   this._levelDesign(nodes, interpreted),
      characterArt:  this._characterArt(nodes, interpreted),
      uiux:          this._uiux(nodes, interpreted),
      cinematic:     this._cinematic(nodes, interpreted),
    };
  }

  // ── Game Design Intelligence — infer type from gameplay signals ──────────
  _gameplay(nodes) {
    const signals = {
      obby:      nameMatches(nodes, ["checkpoint", "killpart", "killbrick", "lava", "obstacle"]),
      tycoon:    nameMatches(nodes, ["dropper", "conveyor", "buyport", "cash", "collector"]),
      simulator: nameMatches(nodes, ["zone", "tier", "rebirth", "multiplier", "pet"]),
      rpg:       nameMatches(nodes, ["quest", "npc", "merchant", "dungeon", "level"]),
      fps:       nameMatches(nodes, ["weapon", "gun", "blaster", "ammo", "team", "capture"]),
    };
    // Pick the strongest signal; tie or none → undetermined (no guessing).
    let best = null, bestN = 0;
    for (const k of Object.keys(signals)) {
      if (signals[k].length > bestN) { best = k; bestN = signals[k].length; }
    }
    if (!best) return UNDETERMINED;
    const confidence = Math.min(0.95, 0.4 + bestN * 0.15);
    return finding(best, confidence, signals[best]);
  }

  // ── Art Direction — only assert a style with real material+color evidence ─
  _artDirection(nodes) {
    const mats = {};
    let darkColors = 0, brightColors = 0, total = 0;
    for (const n of nodes) {
      const m = n.properties && n.properties.Material;
      if (m) { const k = String(m).replace(/^Enum\.Material\./, ""); mats[k] = (mats[k] || 0) + 1; }
      const c = n.properties && n.properties.Color;
      if (Array.isArray(c) && c.length >= 3) {
        total++;
        const lum = (c[0] + c[1] + c[2]) / 3;
        if (lum < 70) darkColors++; else if (lum > 180) brightColors++;
      }
    }
    const ev = [];
    let style = null, conf = 0;
    // Cyberpunk/Sci-Fi: neon on dark palette.
    if (mats.Neon && darkColors > 0) {
      style = "sci-fi / cyberpunk"; conf = 0.5 + Math.min(0.3, mats.Neon * 0.1);
      ev.push("Neon×" + mats.Neon, "dark palette×" + darkColors);
    } else if (mats.Wood && nameMatches(nodes, ["castle", "tavern", "inn", "temple"]).length) {
      style = "fantasy"; conf = 0.55; ev.push("Wood material", "fantasy structures");
    } else if (mats.Metal && nameMatches(nodes, ["base", "outpost", "bunker", "turret"]).length) {
      style = "military / industrial"; conf = 0.5; ev.push("Metal material", "military structures");
    } else if (brightColors > darkColors && brightColors >= 3) {
      style = "cartoon / stylized"; conf = 0.4; ev.push("bright palette×" + brightColors);
    }
    if (!style) return UNDETERMINED;   // honest: no clear signal
    return finding(style, conf, ev);
  }

  // ── Level Design — readability/flow from spawns + landmarks ──────────────
  _levelDesign(nodes, interp) {
    const spawns = nodes.filter((n) => n.className === "SpawnLocation").length;
    const landmarks = nameMatches(nodes, ["tower", "temple", "boss", "portal", "gate", "castle"]);
    const notes = [];
    if (spawns === 0) notes.push("no spawn point — players have nowhere to start");
    if (spawns >= 1) notes.push(spawns + " spawn(s) present");
    if (landmarks.length) notes.push("landmarks aid wayfinding: " + landmarks.slice(0, 5).join(", "));
    else notes.push("few landmarks — wayfinding may be weak");
    const readability = (spawns >= 1 ? 0.5 : 0) + Math.min(0.5, landmarks.length * 0.15);
    return finding(readability >= 0.6 ? "good" : readability >= 0.3 ? "fair" : "weak",
      readability, notes);
  }

  // ── Character Art — silhouette/recognizability from part variety ─────────
  _characterArt(nodes, interp) {
    const heads = gather(interp, nodes, (s) => s.kind === "head");
    const limbs = gather(interp, nodes, (s) => s.kind === "limb");
    const torsos = gather(interp, nodes, (s) => s.kind === "torso");
    if (!heads.length && !limbs.length && !torsos.length) return UNDETERMINED;
    const shapeVariety = (heads.length ? 1 : 0) + (limbs.length ? 1 : 0) + (torsos.length ? 1 : 0);
    const ev = [];
    if (heads.length) ev.push(heads.length + " head(s)");
    if (limbs.length) ev.push(limbs.length + " limb(s)");
    if (torsos.length) ev.push(torsos.length + " torso(s)");
    // More shape variety → stronger silhouette/readability.
    return finding(shapeVariety >= 2 ? "readable silhouette" : "blocky / low variety",
      Math.min(0.9, shapeVariety * 0.3), ev);
  }

  // ── UI/UX — contrast/mobile from UI presence ─────────────────────────────
  _uiux(nodes, interp) {
    const uiNodes = nodes.filter((n) => (interp[n.id] || {}).ui === true);
    if (!uiNodes.length) return UNDETERMINED;
    const buttons = uiNodes.filter((n) => /Button/.test(n.className)).length;
    const notes = [uiNodes.length + " UI element(s)"];
    if (buttons) notes.push(buttons + " interactive button(s)");
    return finding(buttons >= 1 ? "interactive UI present" : "display-only UI",
      Math.min(0.8, uiNodes.length * 0.1), notes);
  }

  // ── Cinematic — first impression / hero object (largest/most central) ────
  _cinematic(nodes, interp) {
    let hero = null, heroVol = 0;
    for (const n of nodes) {
      const s = interp[n.id] || {};
      if (s.drawable === false) continue;
      const sz = (n.properties && n.properties.Size) || [];
      const vol = Array.isArray(sz) && sz.length >= 3 ? sz[0] * sz[1] * sz[2] : 0;
      if (vol > heroVol) { heroVol = vol; hero = (n.properties && n.properties.Name) || n.varName; }
    }
    if (!hero) return UNDETERMINED;
    return finding(hero, heroVol > 0 ? 0.6 : 0.2, ["largest drawable object (volume " + Math.round(heroVol) + ")"]);
  }
}

export default RbxCreativeDirector;
