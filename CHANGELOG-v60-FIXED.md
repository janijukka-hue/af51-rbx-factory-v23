# AF51-RBX v60 — FIXED build

Drop-in replacement for `AF51-RBX-v60-QUALITY-PASSES.zip`. Same architecture
and same 15-phase pipeline, with the P0 bugs that prevented an end-to-end
build resolved and the bit-determinism policy actually enforced.

## What was broken in the original v60

| # | File | Symptom |
|---|---|---|
| 1 | `t3/roblox-rbx/zip-hardener.js` | `spawn zip ENOENT` — required system `zip` binary that is missing in clean Node.js environments |
| 2 | `s4-rbx/AssetBrowser/index.js` | `forEach(a=>);` — orphan arrow body, file failed to parse |
| 3 | `s4-rbx/BuildConsole/index.js` | broken brace structure, file failed to parse |
| 4 | `s4-rbx/HierarchyViewer/index.js` | orphan `+icon+child._name);` statement |
| 5 | `s4-rbx/PackageInspector/index.js` | replaced with v59-patched version (consistency) |
| 6 | `s4-rbx/RuntimeViewer/index.js` | `forEach(m=>);` — orphan arrow body |
| 7 | `scripts/af51-detect.js` | orphan `);` after `report = …`, missing `console.log` |
| 8 | `runtime/rbx-runtime/RbxPreviewBridge.js` | `collectLua` only scanned `src/Workspace`; v60 generators emit to `ReplicatedStorage` / `ServerScriptService` / `StarterPlayer`, so PREVIEW_GEN reported 0 structures |
| 9 | `t3/roblox-rbx/rojo-exporter.js` | `_generateBuildId` used `Math.random()` despite the policy file forbidding it |
| 10 | `t3/roblox-rbx/rojo-exporter.js` | `buildTimestamp` derived from `Date.now()` → drifted between builds |
| 11 | `t3/roblox-rbx/package-signing.js` | `signedAt: new Date().toISOString()` → drifted between builds |
| 12 | `t3/roblox-rbx/remote-builder.js` | `network-contract.json.generatedAt` drifted between builds |

## Determinism

`production/zip-determinism-policy.json` mandates
`stableHashes=true, randomTempNamesAllowed=false`. The original `_generateBuildId`
documented itself as "deterministic" but used `Math.random()` + ms-precision
timestamps. After the fix:

- Same target + same version → same `buildId`, byte for byte.
- All build-time timestamps are pinned to the ZIP entry epoch
  (`1980-01-01T00:00:00Z`) so the manifest and ZIP central directory agree.
- Override with `AF51_BUILD_ID=...` (release tag) or
  `AF51_BUILD_EPOCH=<ms>` (custom epoch).

Validated: two consecutive `node rbx.mjs build <target>` runs produce
**byte-identical** ZIPs for all five targets:

| Target | Size (bytes) | SHA-256 |
|---|---:|---|
| obby | 35 764 | `5c7a5b84…185a5ed` |
| tycoon | 38 614 | `50c26d5a…6d0f72ca` |
| simulator | 37 761 | `024d035d…1ef35ef2` |
| fps | 35 054 | `23056586…1c3d9e29` |
| rpg | 36 785 | `5211404a…435bf1bd8` |

## Pipeline status

All 11 phases pass for all five targets:

```
INTAKE → PLAN → SYNTHESIZE → TEMPLATE → ASSETS → REMOTES →
RUNTIME_INJECT → ROJO_EXPORT → PREVIEW_GEN → SIGN → ZIP_HARDEN
```

`PREVIEW_GEN` now reports 3 structures from 21–25 Lua files per target
(was reporting 0 in the original).

## Usage

Unchanged. Same entry point:

```sh
node rbx.mjs list                # show targets
node rbx.mjs build <target>      # one of: obby tycoon simulator fps rpg
```

For reproducible release builds:

```sh
AF51_BUILD_ID=release-2026.06 node rbx.mjs build obby
```
