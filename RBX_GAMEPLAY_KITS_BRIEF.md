# AF51 RBX — Gameplay Kits Brief

**Status:** 1/5 targets wired · 4/5 awaiting Kit modules
**Reference implementation:** `src/ServerScriptService/Kits/ObbyKit.lua` (in any `obby` ZIP)
**Owner:** next developer · **Scope:** strictly Kits — no pipeline / no quality-gate / no preview changes

---

## One acceptance criterion

> A first-time player joins the server, **never reads documentation**, and within 60 seconds can describe what kind of game they are in: *"this is an obby / a tycoon / a simulator / an RPG / an FPS."* The Kit must wire **behaviour onto the geometry that World Generator v2 already emits**.

If the player only sees themed labels with nothing reacting to them, the Kit has failed.

---

## Baseline — verified from code, not wishes

| Target    | Geometry v2 emits (tags + attrs)                                                                 | Kit shipped today | Behaviour wired |
|-----------|--------------------------------------------------------------------------------------------------|:-----------------:|:---------------:|
| obby      | `Checkpoint{Stage}`, `Killbrick`, `Mover{Axis,Distance,Speed,Phase}`, `Spinner{Axis,Speed}`, `Goal` | ✅ `ObbyKit.lua`   | ✅ full          |
| tycoon    | `TycoonOwner{ClaimType}`, `Dropper{Income,Interval,Tier}` ×4, `Collector{Currency,Tier}` ×4, `Upgrade{Cost,UpgradeKind}` ×3 | ❌                | ❌               |
| simulator | `ResourceNode{Currency,Reward,Tier}` ×15 (+`Clickable`), `SellZone{SellRate}`, `UpgradeShop`/`PetShop`/`Shop`, `PrestigePodium{RequiredLevel}`, `ProgressionGate{RequiredLevel}` | ❌                | ❌               |
| rpg       | `NPC{NpcName,Role,Dialogue}` ×4 (+`Interactable`), `QuestBoard{Interaction}`, `DungeonGate` ×3, `Portal{Destination,RequiredLevel}`, `EnemySpawn{EnemyType}` ×2 | ❌                | ❌               |
| fps       | `TeamSpawn{Team}` ×2, `Flag{Team,ObjectiveKind}` ×2, `WeaponLocker{Team}` ×2, `Cover` ×12, `CapturePoint{CaptureTime,ObjectiveKind}` | ❌                | ❌               |

The tags and attributes above are **already on the parts** in every shipped ZIP. The Kits' job is to read them and turn them into a game.

---

## Per-Kit checklists

### TycoonKit
- [ ] Player claims plot via `TycoonOwner` ProximityPrompt → single-owner, name floats above podium.
- [ ] `Dropper` tag spawns a tagged cash part every `Interval` seconds, worth `Income`, with collision filtered to its own plot.
- [ ] `Collector.Touched` adds `Income` to `leaderstats.Cash` and despawns the cash part.
- [ ] `Upgrade` ProximityPrompt: if `Cash >= Cost`, deduct, then raise `Income`/`Interval`/`Tier` per `UpgradeKind`.
- [ ] Progress persists in `DataStore("TycoonKit_v1")` per UserId.

### SimulatorKit
- [ ] `ResourceNode` ClickDetector → `leaderstats.Resources += Reward`, animate node briefly, respawn after cooldown.
- [ ] `SellZone.Touched` → `leaderstats.Cash += Resources * SellRate`, zero Resources.
- [ ] `UpgradeShop` ProximityPrompt raises a `ClickPower` IntValue tracked per player.
- [ ] `PrestigePodium` ProximityPrompt: if `Level >= RequiredLevel`, reset stats, grant permanent `Rebirths += 1` multiplier.
- [ ] `ProgressionGate` Touched is rejected (CFrame push-back) unless `Level >= RequiredLevel`.

### RPGKit
- [ ] `NPC`/`Interactable` ProximityPrompt opens a `BillboardGui` dialogue (`NpcName`, `Dialogue`), optionally grants a quest from `Role`.
- [ ] `QuestBoard` ProximityPrompt lists active quests in a fullscreen ScreenGui.
- [ ] Completing a quest awards `leaderstats.Gold += reward`; every N quests bumps `leaderstats.Level += 1`.
- [ ] `Portal`/`ProgressionGate.Touched` teleports to `Destination` if `Level >= RequiredLevel`, otherwise prints "Requires Level X".
- [ ] `EnemySpawn` spawns a basic R6 dummy every 15s up to a cap; on `Humanoid.Died`, killer gets Gold.

### FPSKit
- [ ] On `ServerStart`: ensure two `Team` instances (Blue/Red) with the correct `TeamColor`.
- [ ] Each `TeamSpawn` becomes a `SpawnLocation` with `TeamColor` matching its `Team` attribute, `Neutral = false`.
- [ ] `Flag.Touched` by a player from the *enemy* `Team` → `leaderstats.Captures += 1`, flag returns to base.
- [ ] `WeaponLocker` ProximityPrompt gives the player a basic `Tool` (HopperBin or simple raycast blaster) if they match the locker's `Team`.
- [ ] `CapturePoint`: if only one team is inside for `CaptureTime` seconds, that team scores; show on a `TextLabel` overlay.

Every Kit must also:
- be a single `ServerScriptService/Kits/<Name>Kit.lua` ModuleScript + a `<Name>KitBoot.server.lua` boot script (mirror `ObbyKit` shape).
- be gated by `targetSpec.type` in `t3/roblox-rbx/luau-generator.js → _buildScriptManifest()` so it ships **only** in its own target's ZIP.
- degrade gracefully in Studio when DataStore is unavailable (warn + memory only, never crash).
- never mutate geometry, never add tags, never call services not already used by `ObbyKit`.

---

## Development priority (in order)

1. **TycoonKit** — clearest mechanical loop, most recognisable as a "real game" the fastest.
2. **SimulatorKit** — second-fastest dopamine loop, reuses Cash/leaderstats pattern from TycoonKit.
3. **RPGKit** — dialogue + teleport is more UI work; ship after the two number-go-up kits.
4. **FPSKit** — multi-team logic is the most likely to break determinism; ship last with the most testing.

---

## Out of scope (do NOT touch)

- 16-stage pipeline · `composition-engine.js` · `quality-gate.js` · `roblox-emitter.js` · `scene-graph.js`
- The Ghost Seal, AuditRuntime, ZipHardener
- The preview engine / camera framing
- Quality-gate thresholds — they are already tuned for v2
- Adding new tags or attributes to the geometry — read what's there

---

## GO / NO-GO

- **GO** when: per-target ZIP contains `Kits/<Name>Kit.lua` + `Kits/<Name>KitBoot.server.lua`, deterministic SHA-256 across two builds, `npm run rbx:verify` 55/55 pass, `npm run test:all` green, and a Studio playtest of each target lets a fresh tester answer the one acceptance criterion in 60 s.
- **NO-GO** when: any quality-gate gameplay anchor count drops, any target's ZIP byte-changes between identical builds, or any Kit imports a service ObbyKit doesn't use.
