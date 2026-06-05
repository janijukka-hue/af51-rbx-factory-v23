// t3/Factory/rbx-production/gameplay-pass.js
// AF51-RBX | T3 Layer — GameplayPass v2
// Role  : Pins a SpawnLocation onto the canonical start anchor and stamps
//         goal-sensor StringValues on legacy-compatible spots. Composition
//         v2 already seeds all gameplay anchors with CollectionService
//         tags + attributes, so this pass is intentionally thin — its job
//         is the SpawnLocation (which is its own Roblox class) and a few
//         legacy BoolValue/StringValue children the rbxlx-emit tests still
//         assert on.

export const GameplayPass = {
  apply({ graph, target }) {
    const type = String(target.type || target.id || "").toLowerCase();
    let added = 0;

    // SpawnLocation pinned on the first "start"-tagged part (Composition v2
    // always seeds one). Fall back to other typical base anchors when a
    // legacy target spec gets routed here.
    const startPart =
      graph.findByTag("start")[0] ||
      graph.findByTag("base")[0]  ||
      graph.findByTag("arena")[0] ||
      graph.findByTag("floor")[0] ||
      graph.findByTag("town")[0];

    if (startPart) {
      graph.add({
        className: "SpawnLocation",
        name:      "PrimarySpawn",
        parent:    "Workspace/AF51Scene/" + startPart.name,
        properties: {
          Size:        "Vector3.new(6, 1, 6)",
          Position:    "Vector3.new(0, 1.0, 0)",
          Anchored:    true,
          Neutral:     true,
          AllowTeamChangeOnTouch: false,
          Duration:    0,
          BrickColor:  "BrickColor.new(\"Bright green\")",
        },
        tags: ["gameplay", "spawn"],
      });
      added++;
    }

    // ── Legacy BoolValue / StringValue / IntValue children ───────────────
    // Composition v2 already carries the Stage / Income / Reward / Team /
    // CaptureTime info as instance attributes, but the rbxlx tests still
    // assert that BoolValue and StringValue classes appear in the .rbxlx
    // for the obby target. Keep one canonical child per anchor to preserve
    // that contract without producing thousands of redundant values.

    if (type === "obby") {
      const checkpoints = graph.findByTag("Checkpoint");
      for (let i = 0; i < checkpoints.length; i++) {
        graph.add({
          className: "BoolValue",
          name:      "Reached",
          parent:    "Workspace/AF51Scene/" + checkpoints[i].name,
          properties: { Value: false },
          tags: ["gameplay", "checkpoint-flag"],
        });
        added++;
      }
      const finish = graph.findByTag("finish")[0];
      if (finish) {
        graph.add({
          className: "StringValue",
          name:      "GoalSensor",
          parent:    "Workspace/AF51Scene/" + finish.name,
          properties: { Value: "obby:finish" },
          tags: ["gameplay", "goal"],
        });
        added++;
      }
    } else if (type === "tycoon") {
      const droppers = graph.findByTag("Dropper");
      for (let i = 0; i < droppers.length; i++) {
        graph.add({
          className: "IntValue",
          name:      "IncomePerTick",
          parent:    "Workspace/AF51Scene/" + droppers[i].name,
          properties: { Value: droppers[i].attributes?.Income || 5 },
          tags: ["gameplay", "dropper-income"],
        });
        added++;
      }
      const claim = graph.findByTag("TycoonOwner")[0];
      if (claim) {
        graph.add({
          className: "StringValue",
          name:      "ClaimSignal",
          parent:    "Workspace/AF51Scene/" + claim.name,
          properties: { Value: "tycoon:claim" },
          tags: ["gameplay", "claim"],
        });
        added++;
      }
    } else if (type === "simulator") {
      const nodes = graph.findByTag("ResourceNode");
      for (let i = 0; i < nodes.length; i++) {
        graph.add({
          className: "IntValue",
          name:      "RewardValue",
          parent:    "Workspace/AF51Scene/" + nodes[i].name,
          properties: { Value: nodes[i].attributes?.Reward || 1 },
          tags: ["gameplay", "reward"],
        });
        added++;
      }
      const sell = graph.findByTag("SellZone")[0];
      if (sell) {
        graph.add({
          className: "StringValue",
          name:      "SellSignal",
          parent:    "Workspace/AF51Scene/" + sell.name,
          properties: { Value: "sim:sell" },
          tags: ["gameplay", "sell"],
        });
        added++;
      }
    } else if (type === "fps") {
      const objectives = graph.findByTag("Objective");
      for (let i = 0; i < objectives.length; i++) {
        graph.add({
          className: "StringValue",
          name:      "ObjectiveSignal",
          parent:    "Workspace/AF51Scene/" + objectives[i].name,
          properties: { Value: "fps:objective:" + (objectives[i].attributes?.ObjectiveKind || "capture") },
          tags: ["gameplay", "objective"],
        });
        added++;
      }
      const covers = graph.findByTag("Cover");
      for (let i = 0; i < covers.length; i++) {
        graph.add({
          className: "IntValue",
          name:      "CoverHealth",
          parent:    "Workspace/AF51Scene/" + covers[i].name,
          properties: { Value: 200 },
          tags: ["gameplay", "destructible"],
        });
        added++;
      }
    } else if (type === "rpg") {
      const npcs = graph.findByTag("NPC");
      for (let i = 0; i < npcs.length; i++) {
        graph.add({
          className: "StringValue",
          name:      "NpcDialogue",
          parent:    "Workspace/AF51Scene/" + npcs[i].name,
          properties: { Value: npcs[i].attributes?.Dialogue || "npc:default" },
          tags: ["gameplay", "interactable"],
        });
        added++;
      }
      const board = graph.findByTag("QuestBoard")[0];
      if (board) {
        graph.add({
          className: "StringValue",
          name:      "QuestBoardSignal",
          parent:    "Workspace/AF51Scene/" + board.name,
          properties: { Value: "rpg:quest-board" },
          tags: ["gameplay", "interactable"],
        });
        added++;
      }
    }

    return { ok: true, gameplayType: type, added };
  },
};

export default GameplayPass;
