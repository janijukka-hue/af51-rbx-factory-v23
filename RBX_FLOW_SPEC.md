# AF51-RBX CORRECT CHAIN — SESSION NOTE

## OIKEA JÄRJESTYS

```
RBX BUILD (16 phases, tmpDir)
  ↓
PREVIEW GENERATED (from tmpDir artifact, before ZIP)
  ↓
SAVE (metadata only: buildId + targetId + zipName — NO publishWorkspace, NO Vite)
  ↓
ZIP PACKAGED (last stage, only when user clicks EXPORT ZIP)
  ↓
DIRECT BLOB DOWNLOAD (fetch → blob → link.click, no localhost)
  ↓
USER DOUBLE-CLICKS AF51.rbxlx → ROBLOX STUDIO opens place directly
```

## 16-VAIHEINEN PIPELINE (m2/roblox/roblox-build-manager.js)

| # | Phase             | Tehtävä                                            |
|---|-------------------|----------------------------------------------------|
| 1 | STERILITY         | tmpDir sterile, ei vuotoja edellisistä builds      |
| 2 | HIERARCHY         | scenegraph rakennetaan targetin spec:in mukaan     |
| 3 | RUNTIME_INJECT    | AF51Runtime-paketit injektoidaan                   |
| 4 | LUAU_GEN          | Luau-lähdekoodi generoidaan                        |
| 5 | REMOTE_BUILD      | RemoteEvent/Function -topologia                    |
| 6 | UI_BUILD          | UI-rakenne 5 systeemissä                           |
| 7 | VISUAL_PRODUCTION | Materiaalit, valaistus, mesh, decals, terrain      |
| 8 | **RBXLX_EMIT**    | **production-scenegraph.json → AF51.rbxlx**        |
| 9 | ROJO_EXPORT       | Rojo-source-puu (src/...)                          |
| 10 | ASSET_PACKAGE    | Assetit pakattuna                                  |
| 11 | ROJO_VALIDATE    | Rojo-validation pass                               |
| 12 | SIGN             | PackageSigner — fingerprint kaikille tiedostoille  |
| 13 | VALIDATE         | PackageValidator end-to-end                        |
| 14 | PREVIEW_GEN      | generatedPreview.json HUD/UI:lle                   |
| 15 | GHOST_SEAL       | Ghost Vault — lineage + recovery map               |
| 16 | ZIP_HARDEN       | Deterministinen ZIP (epoch 1980-01-01)             |

## RBXLX_EMIT (vaihe 8, ent. "phase 7.5")

Tämä on Palaset 1–3:n lisäys joka muutti pipelinen 15-vaiheisesta 16-vaiheiseksi.
RBXLX_EMIT konvertoi `production-scenegraph.json` → `AF51.rbxlx` (Roblox XML place
file) ja sijoittaa sen ZIPin juureen. Käyttäjä tuplaklikkaa → Roblox Studio
avaa paikan suoraan, **ei Rojo-buildia, ei Open Cloud -julkaisua**.

Katetut luokat (0 skipped 5/5 targetissa, byte-identical re-build):

- Workspace + Lighting
- Part / WedgePart / SpawnLocation / Folder
- Decal / SpecialMesh / PointLight
- Sky / Atmosphere
- BloomEffect / ColorCorrectionEffect / DepthOfFieldEffect / SunRaysEffect
- BoolValue / IntValue / StringValue

Determinismi: sekventiaaliset referentit `RBX0000000000000001+`, properties
alphabetical, sibling sort `(className, name)`.

## V18 KORJAUKSET (historia)

- workspace.js: isRbxSave bypass
- server.js: /publish hard-blocked for RBX
- MasterRoomUI: CLEAR resets all RBX state

## V63 KORJAUKSET (UI race-condition fix)

- MasterRoomUI: `resetRbxBuildState()` helper, kutsutaan jokaisen buildin alkuun
- MasterRoomUI: `buildSeqRef` — stale async-vastauksen drop kun käyttäjä
  triggeroi uuden buildin ennen edellisen valmistumista
- Abort/CLEAR-handler käyttää samaa helperiä, resetoi myös `isLoading`

## SEURAAVAT (ehdotus, ei sitouduttu)

- Palanen 4: RBXLX_EMIT laajennus oletuspalveluihin (Camera, StarterPlayer,
  Players, ReplicatedStorage placeholders) — vain jos Studio-smoke näyttää
  Output-paneelissa puuttuvia palveluja koskevia varoituksia
- RBXM binary serializer (vaihtoehtoinen rinnakkainen reitti rbxlx:lle)

