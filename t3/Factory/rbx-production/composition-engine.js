// t3/Factory/rbx-production/composition-engine.js
// AF51-RBX | T3 Layer — CompositionEngine v2
// Role  : Seeds the SceneGraph with target-typed structural geometry +
//         CollectionService tags + instance attributes that downstream
//         gameplay kits (ObbyKit, TycoonKit, etc.) read at runtime.
//         Each target type has a canonical, deterministic layout —
//         no randomness, same target spec → same parts in the same order.
//
// CONVENTIONS
//   • Lowercase tags (start, finish, base, zone:*, layer:*) are pipeline-
//     internal and consumed by Density/Quality/Tier passes.
//   • Uppercase tags (Checkpoint, Killbrick, Mover, Dropper, …) are
//     CollectionService tags emitted to Roblox at runtime.
//   • `attributes` carry scalar gameplay metadata read by kits via
//     :GetAttribute (Stage, Axis, Speed, Distance, Phase, Team, Tier).
//   • Each target must seed enough recognizable gameplay anchors that
//     QualityGate v2 passes its per-target requirements; otherwise the
//     build is correctly blocked.

import { buildHumanoid } from "./humanoid-builder.js";

const SCENE_ROOT = "Workspace/AF51Scene";

// ─── Shared primitives ────────────────────────────────────────────────────

function _part(graph, opts) {
  return graph.add({
    className: "Part",
    name:      opts.name,
    parent:    opts.parent || SCENE_ROOT,
    properties: Object.assign(
      {
        Size:     `Vector3.new(${opts.sx}, ${opts.sy}, ${opts.sz})`,
        Position: `Vector3.new(${opts.x}, ${opts.y}, ${opts.z})`,
        Anchored: true,
      },
      opts.properties || {},
    ),
    tags:       opts.tags || [],
    attributes: opts.attributes || {},
  });
}

// ─── OBBY v2 ──────────────────────────────────────────────────────────────
// 5-stage parkour: StartLobby → BasicJumps → MovingPlatforms → HazardField →
// TowerClimb → FinalGate. 5 checkpoints, 4 hazards, 3 movers, 1 spinner.
// Z-axis-aligned linear progression — preview camera looks down the lane.

function _obby(graph) {
  // Start lobby (Stage 1 checkpoint sits on it).
  _part(graph, { name: "StartLobby", x: 0, y: 0.5, z: 0,
    sx: 24, sy: 1, sz: 24, tags: ["surface", "start", "stage:1"] });
  _part(graph, { name: "Checkpoint1", x: 0, y: 1.6, z: 0,
    sx: 6, sy: 1, sz: 6,
    properties: { BrickColor: 'BrickColor.new("Bright green")', Material: "Enum.Material.Neon" },
    tags: ["start", "Checkpoint"], attributes: { Stage: 1, Reward: 10 } });

  // STAGE 2 — Basic jumps (6 small platforms growing in gap).
  for (let i = 0; i < 6; i++) {
    const z = 18 + i * 7;
    _part(graph, { name: `BasicJump${i + 1}`, x: 0, y: 1, z,
      sx: 6, sy: 1, sz: 5, tags: ["surface", "obstacle", "stage:2", "zone:obstacleZone"] });
  }
  _part(graph, { name: "Checkpoint2", x: 0, y: 1.6, z: 62,
    sx: 6, sy: 1, sz: 6,
    properties: { BrickColor: 'BrickColor.new("Bright green")', Material: "Enum.Material.Neon" },
    tags: ["Checkpoint", "obstacle", "stage:2"], attributes: { Stage: 2, Reward: 20 } });

  // STAGE 3 — Moving platforms (3 mover platforms, alternating axis).
  _part(graph, { name: "MoverPlatform1", x: -6, y: 2, z: 78,
    sx: 6, sy: 1, sz: 6, tags: ["surface", "obstacle", "Mover", "stage:3", "zone:obstacleZone"],
    attributes: { Axis: "X", Distance: 8, Speed: 0.5, Phase: 0 } });
  _part(graph, { name: "MoverPlatform2", x:  6, y: 2, z: 90,
    sx: 6, sy: 1, sz: 6, tags: ["surface", "obstacle", "Mover", "stage:3", "zone:obstacleZone"],
    attributes: { Axis: "X", Distance: 8, Speed: 0.5, Phase: 0.5 } });
  _part(graph, { name: "MoverPlatform3", x:  0, y: 4, z: 102,
    sx: 6, sy: 1, sz: 6, tags: ["surface", "obstacle", "Mover", "stage:3", "zone:obstacleZone"],
    attributes: { Axis: "Y", Distance: 4, Speed: 0.4, Phase: 0 } });
  _part(graph, { name: "Checkpoint3", x: 0, y: 1.6, z: 118,
    sx: 6, sy: 1, sz: 6,
    properties: { BrickColor: 'BrickColor.new("Bright green")', Material: "Enum.Material.Neon" },
    tags: ["Checkpoint", "obstacle", "stage:3"], attributes: { Stage: 3, Reward: 30 } });

  // STAGE 4 — Hazard field (4 killbricks the player must dodge between).
  for (let i = 0; i < 4; i++) {
    const x = (i % 2 === 0) ? -4 : 4;
    const z = 132 + i * 8;
    _part(graph, { name: `Killbrick${i + 1}`, x, y: 1.5, z,
      sx: 4, sy: 1, sz: 4,
      properties: { BrickColor: 'BrickColor.new("Bright red")', Material: "Enum.Material.Neon" },
      tags: ["Killbrick", "hazard", "stage:4", "zone:obstacleZone"] });
    _part(graph, { name: `HazardSafe${i + 1}`, x: -x, y: 1, z,
      sx: 6, sy: 1, sz: 6, tags: ["surface", "obstacle", "stage:4", "zone:obstacleZone"] });
  }
  _part(graph, { name: "Checkpoint4", x: 0, y: 1.6, z: 170,
    sx: 6, sy: 1, sz: 6,
    properties: { BrickColor: 'BrickColor.new("Bright green")', Material: "Enum.Material.Neon" },
    tags: ["Checkpoint", "obstacle", "stage:4"], attributes: { Stage: 4, Reward: 40 } });

  // STAGE 5 — Tower climb with a rotating spinner hazard mid-tower.
  for (let i = 0; i < 5; i++) {
    const y = 2 + i * 4;
    const angle = i * 90;
    const x = Math.round(Math.cos(angle * Math.PI / 180) * 4);
    const z = 184 + Math.round(Math.sin(angle * Math.PI / 180) * 4);
    _part(graph, { name: `TowerStep${i + 1}`, x, y, z,
      sx: 5, sy: 1, sz: 5, tags: ["surface", "obstacle", "stage:5", "zone:obstacleZone"] });
  }
  _part(graph, { name: "SpinnerBar", x: 0, y: 14, z: 184,
    sx: 12, sy: 1, sz: 2,
    properties: { BrickColor: 'BrickColor.new("Bright red")', Material: "Enum.Material.Neon" },
    tags: ["Killbrick", "Spinner", "hazard", "stage:5", "zone:obstacleZone"],
    attributes: { Axis: "Y", Speed: 90 } });

  // FINAL GATE + finish checkpoint.
  _part(graph, { name: "FinishPlatform", x: 0, y: 22.5, z: 184,
    sx: 20, sy: 1, sz: 20,
    properties: { BrickColor: 'BrickColor.new("Bright yellow")', Material: "Enum.Material.Neon" },
    tags: ["surface", "finish", "zone:finishZone"] });
  _part(graph, { name: "Checkpoint5", x: 0, y: 23.6, z: 184,
    sx: 6, sy: 1, sz: 6,
    properties: { BrickColor: 'BrickColor.new("Bright yellow")', Material: "Enum.Material.Neon" },
    tags: ["Checkpoint", "finish", "stage:5"], attributes: { Stage: 5, Reward: 50 } });
  _part(graph, { name: "FinalGate", x: 0, y: 26, z: 184,
    sx: 16, sy: 6, sz: 1,
    properties: { BrickColor: 'BrickColor.new("Bright yellow")', Material: "Enum.Material.Neon", Transparency: 0.4 },
    tags: ["finish", "Goal"] });
}

// ─── TYCOON v2 ────────────────────────────────────────────────────────────
// Central tycoon plot with 4 dropper-conveyor-collector loops + 3 upgrade
// pads + perimeter walls + a claim podium. Each loop is a recognizable
// "machine": dropper bench (top) → conveyor strip (slope) → collector pad.

function _tycoon(graph) {
  // Tycoon plot baseplate (large) + claim podium.
  _part(graph, { name: "TycoonBase", x: 0, y: 0.5, z: 0,
    sx: 80, sy: 1, sz: 80,
    properties: { BrickColor: 'BrickColor.new("Dark stone grey")', Material: "Enum.Material.Concrete" },
    tags: ["surface", "base", "zone:productionZone"] });
  _part(graph, { name: "ClaimPodium", x: 0, y: 2, z: -32,
    sx: 8, sy: 3, sz: 8,
    properties: { BrickColor: 'BrickColor.new("Bright yellow")', Material: "Enum.Material.Neon" },
    tags: ["start", "TycoonOwner", "zone:spawnZone"], attributes: { ClaimType: "tycoon" } });

  // Perimeter walls (8 segments → recognizable as "the tycoon plot").
  const wallSpec = [
    { x:  0, z:  38, sx: 80, sz: 2 }, { x:  0, z: -38, sx: 80, sz: 2 },
    { x:  38, z: 0, sx: 2, sz: 80 }, { x: -38, z: 0, sx: 2, sz: 80 },
  ];
  for (let i = 0; i < wallSpec.length; i++) {
    const w = wallSpec[i];
    _part(graph, { name: `Wall${i + 1}`, x: w.x, y: 3, z: w.z,
      sx: w.sx, sy: 6, sz: w.sz,
      properties: { BrickColor: 'BrickColor.new("Medium stone grey")', Material: "Enum.Material.Brick" },
      tags: ["wall", "perimeter", "zone:perimeterZone"] });
  }

  // 4 dropper machines, one per quadrant. Each machine = 4 parts:
  // DropperBench (top), ConveyorRamp, CollectorPad, IncomeMarker.
  // Iron is unlocked on tycoon claim (Locked=false); the other three sit
  // dormant behind a DropperGate buy pad with a tier-scaled price, so the
  // session has a real progressive purchase arc instead of all-droppers-
  // on-from-second-zero.
  const quads = [
    { qx: -16, qz:  16, tier: 1, income:  5, name: "Iron",     gateCost:    0 },
    { qx:  16, qz:  16, tier: 2, income: 12, name: "Copper",   gateCost:  100 },
    { qx: -16, qz: -16, tier: 3, income: 25, name: "Gold",     gateCost:  500 },
    { qx:  16, qz: -16, tier: 4, income: 50, name: "Platinum", gateCost: 2500 },
  ];
  for (const q of quads) {
    _part(graph, { name: `${q.name}Dropper`, x: q.qx, y: 8, z: q.qz,
      sx: 6, sy: 4, sz: 6,
      properties: { BrickColor: 'BrickColor.new("Bright blue")', Material: "Enum.Material.Metal" },
      tags: ["dropper-base", "Dropper", `tycoon-tier:${q.tier}`, "zone:productionZone"],
      attributes: { Income: q.income, Tier: q.tier, Interval: 2.5, Locked: q.gateCost > 0 } });
    // Surface Velocity points from the conveyor toward the quadrant's
    // Collector. Roblox propagates this to any anchored-on-top part as a
    // surface impulse, so the dropper's cash part actually travels —
    // without it the tagged conveyor is just a static black slab and
    // the dropper → collector loop never reaches the collector.
    const conveyorPushX = q.qx > 0 ? -16 : 16;
    _part(graph, { name: `${q.name}Conveyor`, x: q.qx + (q.qx > 0 ? -4 : 4), y: 3, z: q.qz,
      sx: 10, sy: 1, sz: 4,
      properties: { BrickColor: 'BrickColor.new("Black")', Material: "Enum.Material.SmoothPlastic",
        Velocity: `Vector3.new(${conveyorPushX}, 0, 0)` },
      tags: ["surface", "conveyor", `tycoon-tier:${q.tier}`, "zone:productionZone"] });
    _part(graph, { name: `${q.name}Collector`, x: q.qx > 0 ? 4 : -4, y: 1.5, z: q.qz,
      sx: 6, sy: 1, sz: 6,
      properties: { BrickColor: 'BrickColor.new("Bright yellow")', Material: "Enum.Material.Neon" },
      tags: ["surface", "Collector", `tycoon-tier:${q.tier}`, "zone:productionZone"],
      attributes: { Tier: q.tier, Currency: "coins" } });
    // Buy pad for the locked tiers. Sits at the quadrant's outer edge so
    // the player walks past it on the way in, sees the price, and the
    // tycoon arc becomes "claim → save → unlock Copper → save → unlock
    // Gold → ..." instead of a single claim that lights up the whole map.
    if (q.gateCost > 0) {
      _part(graph, { name: `Buy${q.name}`, x: q.qx, y: 1.5, z: q.qz + (q.qz > 0 ? 8 : -8),
        sx: 4, sy: 1, sz: 4,
        properties: { BrickColor: 'BrickColor.new("Bright green")', Material: "Enum.Material.Neon" },
        tags: ["surface", "DropperGate", `tycoon-tier:${q.tier}`, "zone:productionZone"],
        attributes: { Cost: q.gateCost, Tier: q.tier, DropperName: `${q.name}Dropper` } });
    }
  }

  // 3 upgrade pads in a row (shop area in the center-back).
  const upgradeSpec = [
    { name: "UpgradeSpeed",      x: -12, cost:  100, kind: "speed" },
    { name: "UpgradeIncome",     x:   0, cost:  500, kind: "income" },
    { name: "UpgradeAutomation", x:  12, cost: 2000, kind: "automation" },
  ];
  for (const u of upgradeSpec) {
    _part(graph, { name: u.name, x: u.x, y: 1.5, z: 28,
      sx: 6, sy: 1, sz: 6,
      properties: { BrickColor: 'BrickColor.new("Bright violet")', Material: "Enum.Material.Neon" },
      tags: ["surface", "Upgrade", "zone:productionZone"],
      attributes: { Cost: u.cost, UpgradeKind: u.kind } });
  }
}


// ─── SIMULATOR v2 ─────────────────────────────────────────────────────────
// Tier-segregated grind arena: 3 tiers (Bronze/Silver/Gold) each with 5
// ResourceNode parts the player clicks, plus a central SellZone, a PetShop,
// an UpgradeShop, and a Prestige podium. Concentric rings around origin.

function _simulator(graph) {
  _part(graph, { name: "Arena", x: 0, y: 0.5, z: 0,
    sx: 90, sy: 1, sz: 90,
    properties: { BrickColor: 'BrickColor.new("Earth green")', Material: "Enum.Material.Grass" },
    tags: ["surface", "arena", "zone:arenaZone"] });

  // Spawn lobby (south of arena).
  _part(graph, { name: "SpawnLobby", x: 0, y: 0.6, z: -36,
    sx: 18, sy: 1, sz: 12,
    properties: { BrickColor: 'BrickColor.new("Bright green")', Material: "Enum.Material.Neon" },
    tags: ["surface", "start", "zone:spawnZone"] });

  // 3 tier zones (Bronze inner, Silver middle, Gold outer), each with 5 ResourceNodes.
  const tiers = [
    { name: "Bronze", color: "Brown",  ringR: 14, reward:  1, tier: 1 },
    { name: "Silver", color: "Medium stone grey", ringR: 22, reward:  5, tier: 2 },
    { name: "Gold",   color: "Bright yellow", ringR: 30, reward: 25, tier: 3 },
  ];
  for (const t of tiers) {
    _part(graph, { name: `${t.name}ZoneFloor`, x: 0, y: 1.1, z: 0,
      sx: t.ringR * 2, sy: 0.2, sz: t.ringR * 2,
      properties: { BrickColor: `BrickColor.new("${t.color}")`, Material: "Enum.Material.Neon", Transparency: 0.6 },
      tags: ["surface", "zone", t.name.toLowerCase(), `sim-tier:${t.tier}`] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = Math.round(Math.cos(a) * (t.ringR - 2));
      const z = Math.round(Math.sin(a) * (t.ringR - 2));
      _part(graph, { name: `${t.name}Node${i + 1}`, x, y: 2, z,
        sx: 3, sy: 3, sz: 3,
        properties: { BrickColor: `BrickColor.new("${t.color}")`, Material: "Enum.Material.Slate" },
        tags: ["ResourceNode", "Clickable", `sim-tier:${t.tier}`, "zone:arenaZone"],
        attributes: { Reward: t.reward, Tier: t.tier, Currency: "coins" } });
    }
  }

  // Central SellZone, UpgradeShop, PetShop, Prestige podium.
  _part(graph, { name: "SellZone", x: 0, y: 1.5, z: 0,
    sx: 8, sy: 1, sz: 8,
    properties: { BrickColor: 'BrickColor.new("Bright yellow")', Material: "Enum.Material.Neon" },
    tags: ["surface", "SellZone", "zone:arenaZone"],
    attributes: { SellRate: 1 } });
  _part(graph, { name: "UpgradeShop", x: -36, y: 2.5, z: 0,
    sx: 6, sy: 5, sz: 6,
    properties: { BrickColor: 'BrickColor.new("Bright violet")', Material: "Enum.Material.Neon" },
    tags: ["UpgradeShop", "Shop", "zone:perimeterZone"],
    attributes: { ShopKind: "upgrade" } });
  _part(graph, { name: "PetShop", x: 36, y: 2.5, z: 0,
    sx: 6, sy: 5, sz: 6,
    properties: { BrickColor: 'BrickColor.new("Light pink")', Material: "Enum.Material.Neon" },
    tags: ["PetShop", "Shop", "zone:perimeterZone"],
    attributes: { ShopKind: "pet" } });
  _part(graph, { name: "PrestigePodium", x: 0, y: 3, z: 36,
    sx: 8, sy: 6, sz: 8,
    properties: { BrickColor: 'BrickColor.new("Lapis")', Material: "Enum.Material.Neon" },
    tags: ["PrestigePodium", "ProgressionGate", "zone:perimeterZone"],
    attributes: { RequiredLevel: 50 } });
}

// ─── FPS ARENA v2 ─────────────────────────────────────────────────────────
// Two-base team arena: BlueBase (-X) and RedBase (+X), each with spawn
// pads + an objective flag. Three lanes (left/center/right) with cover.
// 12 cover blocks total, 1 central objective (CTF flag).

function _fps(graph) {
  _part(graph, { name: "ArenaFloor", x: 0, y: 0.5, z: 0,
    sx: 140, sy: 1, sz: 90,
    properties: { BrickColor: 'BrickColor.new("Medium stone grey")', Material: "Enum.Material.Concrete" },
    tags: ["surface", "floor", "zone:combatZone"] });

  // Two team bases.
  const bases = [
    { team: "Blue", side: -1, color: "Bright blue",   x: -55 },
    { team: "Red",  side:  1, color: "Bright red",    x:  55 },
  ];
  for (const b of bases) {
    _part(graph, { name: `${b.team}BaseFloor`, x: b.x, y: 1.5, z: 0,
      sx: 24, sy: 1, sz: 60,
      properties: { BrickColor: `BrickColor.new("${b.color}")`, Material: "Enum.Material.Neon", Transparency: 0.5 },
      tags: ["surface", "team-base", `team:${b.team.toLowerCase()}`, "zone:spawnZone"] });
    _part(graph, { name: `${b.team}SpawnPad`, x: b.x, y: 2.1, z: 0,
      sx: 8, sy: 1, sz: 8,
      properties: { BrickColor: `BrickColor.new("${b.color}")`, Material: "Enum.Material.Neon" },
      tags: [b.team === "Blue" ? "start" : "team-spawn", "TeamSpawn", `team:${b.team.toLowerCase()}`, "zone:spawnZone"],
      attributes: { Team: b.team } });
    _part(graph, { name: `${b.team}Flag`, x: b.x, y: 4, z: -20,
      sx: 2, sy: 6, sz: 2,
      properties: { BrickColor: `BrickColor.new("${b.color}")`, Material: "Enum.Material.Neon" },
      tags: ["Objective", "Flag", `team:${b.team.toLowerCase()}`, "zone:spawnZone"],
      attributes: { Team: b.team, ObjectiveKind: "flag" } });
    _part(graph, { name: `${b.team}WeaponLocker`, x: b.x, y: 3, z: 20,
      sx: 4, sy: 4, sz: 4,
      properties: { BrickColor: 'BrickColor.new("Dark stone grey")', Material: "Enum.Material.Metal" },
      tags: ["WeaponLocker", `team:${b.team.toLowerCase()}`, "zone:spawnZone"],
      attributes: { Team: b.team } });
  }

  // 3 lanes × 4 cover blocks = 12 covers, evenly spaced between bases.
  const lanes = [-22, 0, 22];
  for (let li = 0; li < lanes.length; li++) {
    const z = lanes[li];
    for (let i = 0; i < 4; i++) {
      const x = -27 + i * 18;
      _part(graph, { name: `Cover_L${li + 1}_${i + 1}`, x, y: 2.5, z,
        sx: 6, sy: 4, sz: 2,
        properties: { BrickColor: 'BrickColor.new("Dark stone grey")', Material: "Enum.Material.Concrete" },
        tags: ["Cover", "cover", `lane:${li + 1}`, "zone:combatZone"] });
    }
    _part(graph, { name: `LaneMarker${li + 1}`, x: 0, y: 1.1, z,
      sx: 100, sy: 0.2, sz: 4,
      properties: { BrickColor: 'BrickColor.new("Bright orange")', Material: "Enum.Material.Neon", Transparency: 0.7 },
      tags: ["surface", "lane", `lane:${li + 1}`, "zone:combatZone"] });
  }

  // Central capture point.
  _part(graph, { name: "CentralObjective", x: 0, y: 2, z: 0,
    sx: 10, sy: 1, sz: 10,
    properties: { BrickColor: 'BrickColor.new("Bright yellow")', Material: "Enum.Material.Neon" },
    tags: ["Objective", "CapturePoint", "zone:combatZone"],
    attributes: { ObjectiveKind: "capture", CaptureTime: 8 } });
}


// ─── RPG v2 ───────────────────────────────────────────────────────────────
// Hub town with TownSquare + 4 buildings (Inn/Smithy/Market/Temple),
// QuestBoard kiosk, 4 NPC anchor stands, road network (4 spokes), and a
// gated dungeon entrance. Concentric layout: square in centre, buildings
// on a 22-radius ring, gate at z=+36.

function _rpg(graph) {
  _part(graph, { name: "TownSquare", x: 0, y: 0.5, z: 0,
    sx: 60, sy: 1, sz: 60,
    properties: { BrickColor: 'BrickColor.new("Cool yellow")', Material: "Enum.Material.Cobblestone" },
    tags: ["surface", "town", "zone:villageZone"] });

  // Spawn lobby pad (south).
  _part(graph, { name: "TownSpawn", x: 0, y: 1.1, z: -22,
    sx: 8, sy: 1, sz: 8,
    properties: { BrickColor: 'BrickColor.new("Bright green")', Material: "Enum.Material.Neon" },
    tags: ["surface", "start", "zone:spawnZone"] });

  // QuestBoard kiosk (centre of town).
  _part(graph, { name: "QuestBoard", x: 0, y: 3, z: 0,
    sx: 4, sy: 4, sz: 1,
    properties: { BrickColor: 'BrickColor.new("Reddish brown")', Material: "Enum.Material.Wood" },
    tags: ["QuestBoard", "Interactable", "zone:villageZone"],
    attributes: { Interaction: "quest-board" } });

  // 4 buildings on a circle + 4 named NPC characters beside each building.
  const buildings = [
    { name: "Inn",     npcName: "Innkeeper",   role: "rest",   color: "Reddish brown", npcColor: "Pastel brown" },
    { name: "Smithy",  npcName: "Blacksmith",  role: "craft",  color: "Dark stone grey", npcColor: "Dark stone grey" },
    { name: "Market",  npcName: "Merchant",    role: "shop",   color: "Cool yellow", npcColor: "Bright yellow" },
    { name: "Temple",  npcName: "Priest",      role: "bless",  color: "White", npcColor: "White" },
  ];
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const a = (i / buildings.length) * Math.PI * 2;
    const x = Math.round(Math.cos(a) * 22);
    const z = Math.round(Math.sin(a) * 22);
    // Building plinth (base) + roof block to make it read as a building.
    _part(graph, { name: `${b.name}Plinth`, x, y: 2, z,
      sx: 10, sy: 4, sz: 10,
      properties: { BrickColor: `BrickColor.new("${b.color}")`, Material: "Enum.Material.Brick" },
      tags: ["building", b.role, b.name.toLowerCase(), "zone:villageZone"] });
    _part(graph, { name: `${b.name}Roof`, x, y: 5, z,
      sx: 11, sy: 2, sz: 11,
      properties: { BrickColor: 'BrickColor.new("Bright red")', Material: "Enum.Material.Slate" },
      tags: ["building-roof", b.name.toLowerCase(), "zone:villageZone"] });
    _part(graph, { name: `${b.name}Door`, x, y: 1.5, z: z - (z >= 0 ? -5 : 5) - (z === 0 ? 5 : 0),
      sx: 3, sy: 3, sz: 0.5,
      properties: { BrickColor: 'BrickColor.new("Reddish brown")', Material: "Enum.Material.Wood" },
      tags: ["door", b.name.toLowerCase()] });
    // NPC humanoid character (positioned just outside the building toward town centre).
    const nx = Math.round(Math.cos(a) * 16);
    const nz = Math.round(Math.sin(a) * 16);
    buildHumanoid(graph, {
      name: b.npcName,
      x: nx, y: 1.0, z: nz,
      color: b.npcColor,
      scale: 0.9,
      tags: ["NPC", "Interactable", b.role, "zone:villageZone"],
      attributes: { NpcName: b.npcName, Role: b.role, Dialogue: `npc:${b.npcName.toLowerCase()}` }
    });
  }

  // Road spokes (4 cardinal paths from centre outward).
  const spokes = [[0, 18], [0, -18], [18, 0], [-18, 0]];
  for (let i = 0; i < spokes.length; i++) {
    const [x, z] = spokes[i];
    _part(graph, { name: `Road${i + 1}`, x: x * 0.5, y: 1.0, z: z * 0.5,
      sx: x === 0 ? 4 : 20, sy: 0.2, sz: z === 0 ? 4 : 20,
      properties: { BrickColor: 'BrickColor.new("Dark stone grey")', Material: "Enum.Material.Concrete", Transparency: 0.2 },
      tags: ["surface", "road", "zone:villageZone"] });
  }

  // Dungeon gate (north exit) — recognizable RPG progression anchor.
  _part(graph, { name: "DungeonGateWallL", x: -4, y: 4, z: 36,
    sx: 4, sy: 8, sz: 2,
    properties: { BrickColor: 'BrickColor.new("Black")', Material: "Enum.Material.Slate" },
    tags: ["gate", "DungeonGate", "zone:perimeterZone"] });
  _part(graph, { name: "DungeonGateWallR", x:  4, y: 4, z: 36,
    sx: 4, sy: 8, sz: 2,
    properties: { BrickColor: 'BrickColor.new("Black")', Material: "Enum.Material.Slate" },
    tags: ["gate", "DungeonGate", "zone:perimeterZone"] });
  _part(graph, { name: "DungeonGateArch", x: 0, y: 8.5, z: 36,
    sx: 12, sy: 1, sz: 2,
    properties: { BrickColor: 'BrickColor.new("Black")', Material: "Enum.Material.Slate" },
    tags: ["gate", "DungeonGate", "zone:perimeterZone"] });
  _part(graph, { name: "DungeonEntrance", x: 0, y: 1.5, z: 36,
    sx: 8, sy: 1, sz: 4,
    properties: { BrickColor: 'BrickColor.new("Bright red")', Material: "Enum.Material.Neon", Transparency: 0.4 },
    tags: ["surface", "Portal", "ProgressionGate", "zone:perimeterZone"],
    attributes: { Destination: "DungeonSanctum", RequiredLevel: 5 } });

  // 2 ambient enemy spawn markers near the dungeon entrance (anchors for combat).
  _part(graph, { name: "EnemySpawn1", x: -10, y: 1.2, z: 30,
    sx: 3, sy: 0.2, sz: 3,
    properties: { BrickColor: 'BrickColor.new("Dark orange")', Material: "Enum.Material.Neon", Transparency: 0.5 },
    tags: ["EnemySpawn", "zone:perimeterZone"], attributes: { EnemyType: "Goblin" } });
  _part(graph, { name: "EnemySpawn2", x:  10, y: 1.2, z: 30,
    sx: 3, sy: 0.2, sz: 3,
    properties: { BrickColor: 'BrickColor.new("Dark orange")', Material: "Enum.Material.Neon", Transparency: 0.5 },
    tags: ["EnemySpawn", "zone:perimeterZone"], attributes: { EnemyType: "Goblin" } });

  // ─── Dungeon chamber (north of the gate, z≈80) ─────────────────────────
  // DungeonSanctum is the teleport target the entrance Portal resolves to via
  // Workspace:FindFirstChild("DungeonSanctum", true). Without this part the
  // portal silently no-ops; players reach Level 5, touch the red pad, and
  // nothing happens. The chamber gives the gated content somewhere to land,
  // with two interior Goblin spawns and a return portal back to TownSpawn so
  // the loop closes.
  _part(graph, { name: "DungeonSanctum", x: 0, y: 0.5, z: 80,
    sx: 30, sy: 1, sz: 30,
    properties: { BrickColor: 'BrickColor.new("Black")', Material: "Enum.Material.Slate" },
    tags: ["surface", "dungeon", "zone:dungeonZone"] });
  _part(graph, { name: "DungeonWallN", x: 0, y: 5, z: 95,
    sx: 32, sy: 9, sz: 2,
    properties: { BrickColor: 'BrickColor.new("Dark stone grey")', Material: "Enum.Material.Rock" },
    tags: ["wall", "dungeon", "zone:dungeonZone"] });
  _part(graph, { name: "DungeonWallE", x: 15, y: 5, z: 80,
    sx: 2, sy: 9, sz: 30,
    properties: { BrickColor: 'BrickColor.new("Dark stone grey")', Material: "Enum.Material.Rock" },
    tags: ["wall", "dungeon", "zone:dungeonZone"] });
  _part(graph, { name: "DungeonWallW", x: -15, y: 5, z: 80,
    sx: 2, sy: 9, sz: 30,
    properties: { BrickColor: 'BrickColor.new("Dark stone grey")', Material: "Enum.Material.Rock" },
    tags: ["wall", "dungeon", "zone:dungeonZone"] });
  _part(graph, { name: "DungeonEnemy1", x: -8, y: 1.2, z: 80,
    sx: 3, sy: 0.2, sz: 3,
    properties: { BrickColor: 'BrickColor.new("Dark orange")', Material: "Enum.Material.Neon", Transparency: 0.5 },
    tags: ["EnemySpawn", "zone:dungeonZone"], attributes: { EnemyType: "Goblin" } });
  _part(graph, { name: "DungeonEnemy2", x:  8, y: 1.2, z: 80,
    sx: 3, sy: 0.2, sz: 3,
    properties: { BrickColor: 'BrickColor.new("Dark orange")', Material: "Enum.Material.Neon", Transparency: 0.5 },
    tags: ["EnemySpawn", "zone:dungeonZone"], attributes: { EnemyType: "Goblin" } });
  _part(graph, { name: "DungeonExit", x: 0, y: 1.5, z: 68,
    sx: 8, sy: 1, sz: 4,
    properties: { BrickColor: 'BrickColor.new("Bright blue")', Material: "Enum.Material.Neon", Transparency: 0.4 },
    tags: ["surface", "Portal", "zone:dungeonZone"],
    attributes: { Destination: "TownSpawn", RequiredLevel: 1 } });
}

// ─── Dispatcher ───────────────────────────────────────────────────────────

const COMPOSERS = { obby: _obby, tycoon: _tycoon, simulator: _simulator, fps: _fps, rpg: _rpg };

export const CompositionEngine = {
  compose({ graph, target }) {
    const type = String(target.type || target.id || "").toLowerCase();
    const composer = COMPOSERS[type] || _obby;
    composer(graph);
    return { ok: true, type, partsAdded: graph.findByClass("Part").length };
  },
};

export default CompositionEngine;
