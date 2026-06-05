// test-recognizability.mjs
// ----------------------------------------------------------------------------
// GO/NO-GO sprint guard. For each target, build the .rbxlx and assert it
// contains the MECHANIC SIGNATURE that makes the game recognizable & playable —
// not merely that "a script exists." These tests fail if a target regresses
// back to decorated boxes.
//
// Run: node test-recognizability.mjs   (also wired into test:all)

import { execSync } from "child_process";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

const C = { g: "\x1b[32m", r: "\x1b[31m", x: "\x1b[0m", b: "\x1b[1m", d: "\x1b[2m" };
let PASS = 0, FAIL = 0;

function check(name, cond, detail) {
  if (cond) { PASS++; console.log(`  ${C.g}✓${C.x} ${name}`); }
  else { FAIL++; console.log(`  ${C.r}✗ ${name}${C.x}${detail ? "  " + C.d + detail + C.x : ""}`); }
}

// Build a target and return the combined .rbxlx text (geometry + baked Lua).
function buildAndRead(target) {
  execSync(`node rbx.mjs build ${target} production`, { stdio: "ignore" });
  const dir = "exports-rbx";
  const zip = readdirSync(dir)
    .filter(f => f.toUpperCase().includes(target.toUpperCase()) && f.endsWith(".zip"))
    .map(f => ({ f, t: 0 }))
    .map(o => { o.t = readFileSync(path.join(dir, o.f)).length; return o; })
    .sort((a, b) => b.t - a.t)[0];
  // Unzip to temp and read AF51.rbxlx
  const tmp = mkdtempSync(path.join(tmpdir(), "rbxchk_"));
  execSync(`unzip -qo "${path.join(dir, zip.f)}" -d "${tmp}"`, { stdio: "ignore" });
  const rbxlx = execSync(`find "${tmp}" -name AF51.rbxlx`, { encoding: "utf8" }).trim().split("\n")[0];
  const xml = readFileSync(rbxlx, "utf8");
  rmSync(tmp, { recursive: true, force: true });
  return xml;
}

// Helpers
const has = (xml, re) => re.test(xml);
const count = (xml, re) => (xml.match(re) || []).length;
const classCount = (xml, cls) =>
  (xml.match(new RegExp(`<Item class="${cls}"`, "g")) || []).length;

console.log(`${C.b}AF51 RBX — Recognizability smoke tests${C.x}\n`);

// ── OBBY ────────────────────────────────────────────────────────────────────
// Recognizable obby: multiple checkpoints, hazards that kill, a finish,
// progression tracked in leaderstats.
{
  console.log(`${C.b}OBBY${C.x}`);
  const xml = buildAndRead("obby");
  // Respawn mechanic, not a specific implementation. A real obby returns the
  // player to their last checkpoint by EITHER per-checkpoint SpawnLocations OR
  // an in-kit CFrame teleport to the checkpoint part (ObbyKit pattern). Accept
  // either — requiring one class would reject a valid game built the other way.
  const obbyRespawn =
    classCount(xml, "SpawnLocation") >= 2 ||                 // static per-checkpoint spawns
    /checkpointCFrame|hrp\.CFrame\s*=/.test(xml);            // runtime teleport to checkpoint
  check("checkpoint respawn wired (spawns or CFrame teleport)", obbyRespawn,
    `spawns=${classCount(xml, "SpawnLocation")}`);
  check("multiple checkpoints present", (xml.match(/Checkpoint\d/g) || []).length >= 2,
    `found ${(xml.match(/Checkpoint\d/g) || []).length}`);
  check("checkpoint logic baked", has(xml, /checkpoint/i));
  check("hazard kills (Health = 0)", has(xml, /Health\s*=\s*0/));
  check("progression via leaderstats", has(xml, /leaderstats/));
  check("touch detection wired", has(xml, /\.Touched/));
}

// ── TYCOON ──────────────────────────────────────────────────────────────────
// Recognizable tycoon: dropper → conveyor → collector → money → upgrade loop.
{
  console.log(`${C.b}TYCOON${C.x}`);
  const xml = buildAndRead("tycoon");
  check("dropper mechanic", has(xml, /dropper/i));
  check("conveyor mechanic", has(xml, /conveyor/i));
  check("collector mechanic", has(xml, /collector/i));
  check("money tracked (leaderstats)", has(xml, /leaderstats/));
  check("collector uses touch", has(xml, /\.Touched/));
}

// ── SIMULATOR ────────────────────────────────────────────────────────────────
// Recognizable simulator: collect → sell → upgrade, currency tracked.
{
  console.log(`${C.b}SIMULATOR${C.x}`);
  const xml = buildAndRead("simulator");
  check("interaction wired (touch/click/prompt)",
    has(xml, /\.Touched/) || has(xml, /ClickDetector/) || has(xml, /ProximityPrompt/));
  check("currency tracked (leaderstats)", has(xml, /leaderstats/));
  check("persistence (DataStore)", has(xml, /DataStore/));
  check("spawn present", classCount(xml, "SpawnLocation") >= 1);
}

// ── RPG ──────────────────────────────────────────────────────────────────────
// Recognizable RPG hub: interactable NPCs/quests, a coherent world.
{
  console.log(`${C.b}RPG${C.x}`);
  const xml = buildAndRead("rpg");
  check("interaction prompts (ProximityPrompt)", has(xml, /ProximityPrompt/));
  check("stats/progress (leaderstats)", has(xml, /leaderstats/));
  check("world geometry present (≥50 Parts)", classCount(xml, "Part") >= 50,
    `found ${classCount(xml, "Part")}`);
  check("spawn present", classCount(xml, "SpawnLocation") >= 1);
  // Combat verb: the TownSword turns enemy spawns from set-dressing into a
  // loop. Guard it so the melee weapon can't silently regress to a prop.
  check("combat verb wired (melee Activated + damage)",
    has(xml, /Activated/) && has(xml, /TakeDamage/));
}

// ── FPS ───────────────────────────────────────────────────────────────────────
// Recognizable FPS arena: spawns, scoring, playable layout.
{
  console.log(`${C.b}FPS${C.x}`);
  const xml = buildAndRead("fps");
  // ≥2 spawn points OR a runtime team-spawn converter (FPSKit converts tagged
  // TeamSpawn anchors into per-team SpawnLocations at start). Either way the
  // arena ends up with multiple team spawns.
  const fpsSpawns =
    classCount(xml, "SpawnLocation") >= 2 ||
    /convertSpawn|wireTeamSpawns|TeamSpawn/.test(xml);
  check("multiple team spawns (static or converted)", fpsSpawns,
    `static spawns=${classCount(xml, "SpawnLocation")}`);
  check("scoring/stats (leaderstats)", has(xml, /leaderstats/));
  check("arena geometry present (≥50 Parts)", classCount(xml, "Part") >= 50,
    `found ${classCount(xml, "Part")}`);
  check("hit/touch detection", has(xml, /\.Touched/) || has(xml, /TakeDamage/));
  // Regression guards for the two bugs fixed in v4:
  check("blaster actually fires (Activated + damage)",
    has(xml, /Activated/) && has(xml, /TakeDamage/));
  check("no removed Region3 API in live code",
    !/[^-]\bWorkspace:FindPartsInRegion3\b/.test(xml));
}

// ── Summary ───────────────────────────────────────────────────────────────────
const tot = PASS + FAIL;
console.log(`\n${C.b}RECOGNIZABILITY: ${tot} | Pass: ${C.g}${PASS}${C.x} | Fail: ${FAIL > 0 ? C.r : ""}${FAIL}${C.x}`);
if (FAIL === 0) {
  console.log(`${C.g}${C.b}  ✓ ALL PASS — every target carries its mechanic signature 🔥${C.x}`);
  process.exit(0);
} else {
  console.log(`${C.r}  ✗ ${FAIL} failed — a target may have regressed to decorated boxes${C.x}`);
  process.exit(1);
}
