// s4/oliot/rbx-directors/RbxCinematicDirector.js
// KERROS: S4 – Olio · RBX Director Layer · Version 1.0.0
//
// RBX Cinematic Director — CAMERAS. It does NOT generate content. It selects
// which shots are worth showing, based purely on what the scene graph and the
// other directors already found: a hero shot of the largest object, a character
// shot if a rig exists, a UI shot if UI exists, an environment flythrough, a
// gameplay overview. Each shot is a camera CONFIG the Video Preview Engine
// executes — the director picks; the engine moves.
//
//   const cd = new RbxCinematicDirector();
//   const shots = cd.plan(enriched, design, sceneGraph); // ordered shot list

export class RbxCinematicDirector {
  plan(enriched, design, graph) {
    enriched = enriched || {};
    design = design || {};
    const nodes = (graph && graph.nodes) || [];
    const shots = [];

    // ── Hero shot — orbit the largest drawable object (from Creative Dir) ──
    const heroName = design.cinematic && design.cinematic.value !== "undetermined"
      ? design.cinematic.value : null;
    if (heroName) {
      shots.push({
        id: "hero",
        mode: "hero",            // engine: frame + slow orbit around target
        label: "Hero Shot",
        target: heroName,
        evidence: "largest drawable object",
      });
    }

    // ── Character shot — only if a rig actually exists ────────────────────
    const rigs = (enriched.characters && enriched.characters.rigs) || [];
    if (rigs.length > 0) {
      shots.push({
        id: "character",
        mode: "character",       // engine: focus + arc around the character
        label: "Character Shot",
        target: rigs[0].name,
        evidence: rigs.length + " rig(s)",
      });
    }

    // ── Environment flythrough — if there's a world to fly through ────────
    const envKeys = Object.keys(enriched.environment || {});
    if (nodes.length >= 6) {
      shots.push({
        id: "environment",
        mode: "flythrough",      // engine: dolly across the scene bounds
        label: "Environment Flythrough",
        target: null,
        evidence: envKeys.length ? envKeys.join(", ") : nodes.length + " objects",
      });
    }

    // ── UI shot — only if UI surfaces exist ───────────────────────────────
    const uiCount = (enriched.ui && enriched.ui.surfaceCount) || 0;
    if (uiCount > 0) {
      shots.push({
        id: "ui",
        mode: "ui",              // engine: front-on flat view of UI layer
        label: "UI Shot",
        target: null,
        evidence: uiCount + " UI element(s)",
      });
    }

    // ── Gameplay overview — always available as the establishing shot ─────
    shots.push({
      id: "overview",
      mode: "orbit",            // engine: continuous slow orbit of whole scene
      label: "Overview",
      target: null,
      evidence: "establishing shot",
    });

    return {
      kind: "SHOT_LIST",
      schemaVersion: "1.0.0",
      shots,
      // The first non-overview shot is the recommended opening shot.
      opening: shots.find((s) => s.id !== "overview") ? shots[0].id : "overview",
    };
  }
}

export default RbxCinematicDirector;
