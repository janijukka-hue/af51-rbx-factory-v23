# AF51 RBX Production Status

Pipeline: **16-stage** deterministic build (fail-fast, no silent correction).
Phase order in `m2/roblox/roblox-build-manager.js` BUILD_PHASE:

```
1 STERILITY · 2 HIERARCHY · 3 RUNTIME_INJECT · 4 LUAU_GEN · 5 REMOTE_BUILD ·
6 UI_BUILD · 7 VISUAL_PRODUCTION · 8 RBXLX_EMIT · 9 ROJO_EXPORT ·
10 ASSET_PACKAGE · 11 ROJO_VALIDATE · 12 SIGN · 13 VALIDATE · 14 PREVIEW_GEN ·
15 GHOST_SEAL · 16 ZIP_HARDEN
```

Implemented:
- ALX semantic intake
- RBX runtime orchestration
- worker pipeline
- deterministic export scaffolds
- semantic graph flow
- preview runtime architecture
- serializer architecture
- torture test scaffolds
- deterministic `.rbxlx` place emit (RBXLX_EMIT, stage 8 — historically
  referred to as "phase 7.5" because it was inserted between VISUAL_PRODUCTION
  and ROJO_EXPORT without renumbering downstream stages):
  Workspace + Lighting; Part / WedgePart / SpawnLocation / Folder /
  Decal / SpecialMesh / PointLight / Sky / Atmosphere / Bloom-/CC-/DOF-/SunRaysEffect /
  Bool- / Int- / StringValue. 0 skipped across all 5 targets, byte-identical
  across builds. Whitelisted into the production ZIP as `AF51.rbxlx`.
- UI race-condition guard (v63): `resetRbxBuildState()` clears stale ZIP /
  preview / quality report at start of every build; `buildSeqRef` drops
  late-arriving responses from superseded builds; CLEAR uses the same helper
  and resets `isLoading` so the user can re-build immediately.

Remaining before true production:
- full Lua grammar coverage
- real Three.js/Babylon integration
- real RBXM binary serialization
- large-scale runtime benchmarking

Out of scope (product decision):
- Roblox Open Cloud publishing — superseded by the manual flow where the
  user downloads the build ZIP and opens `AF51.rbxlx` in Studio directly.