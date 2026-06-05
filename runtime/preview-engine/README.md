# AF51-RBX Preview Engine

Browser-based Roblox-Studio-style viewer for the deterministic ZIPs produced
by `node rbx.mjs build <target>`. Renders the `generatedPreview.json` inside
the ZIP via Three.js.

## Quick start

```sh
# 1) Build at least one target so exports-rbx/ has something to show
node rbx.mjs build obby

# 2) Launch the Studio preview (opens http://localhost:8765/)
node rbx.mjs preview
# or pin a target
node rbx.mjs preview tycoon
# or a custom port
AF51_PREVIEW_PORT=9000 node rbx.mjs preview
```

The server reads the most recent (or named) ZIP from `exports-rbx/`,
extracts `generatedPreview.json`, and serves it to the browser at
`/api/preview/latest`. The browser builds the scene with Three.js and
renders a 3-pane Studio shell:

| Pane     | Contents                                             |
|----------|------------------------------------------------------|
| Left     | DataModel-style explorer (services, folders, parts) |
| Center   | OrbitControls viewport — drag to rotate, wheel zoom |
| Right    | Properties of the selected instance                 |

## Offline mode

Default loader pulls Three.js from `unpkg.com` (pinned `0.160.0`). To run
without network access:

```sh
bash runtime/preview-engine/fetch-vendor.sh
```

This drops `three.module.js` and `OrbitControls.js` into
`runtime/preview-engine/vendor/`; the importmap in `index.html` prefers
those when present.

## Architecture

```
generatedPreview.json
   │  (extracted from ZIP by preview-server.js / zip-reader.js)
   ▼
ThreePreviewAdapter.buildSceneSpec()      ← universal, Node-testable
   │  spec = { meta, bounds, nodes, groups }
   ├─► SceneHierarchyRenderer.buildHierarchy()  ← left tree
   ├─► PreviewStateSynchronizer.diff()          ← hot-reload patch
   └─► scene-builder.buildSceneObjects()        ← Three.js meshes (browser)
```

* `ThreePreviewAdapter` — pure JS, no Three.js import. Safe to load from Node
  (the build pipeline uses it to validate spec shape).
* `scene-builder.js` — browser-only; receives the THREE namespace from the
  app entry, dispatches `luaClass` → mesh geometry (Folder/Model → wireframe,
  Part → box, RemoteEvent/Function → octahedron, Script* → tetrahedron,
  SpawnLocation → green disc, WedgePart → custom prism).
* `PreviewStateSynchronizer` — diff between two specs, used for hot-reload.

## Programmatic use

```js
import { ThreePreviewAdapter } from './runtime/preview-engine/ThreePreviewAdapter.js';
import { extractPreviewFromZip } from './runtime/preview-engine/zip-reader.js';

const json = await extractPreviewFromZip('./exports-rbx/AF51-RBX-AF51-OBBY-build_obby_0d8150c0.zip');
const spec = new ThreePreviewAdapter().buildSceneSpec(json);
console.log(spec.meta.structureCount, 'structures across', Object.keys(spec.groups).length, 'parents');
```

## Endpoints

| Path                                | Returns                                       |
|-------------------------------------|-----------------------------------------------|
| `/`                                 | `index.html`                                  |
| `/api/builds`                       | List of ZIPs in `exports-rbx/`                |
| `/api/preview/latest`               | `generatedPreview.json` from newest ZIP       |
| `/api/preview?target=<id>`          | preview JSON for the named target             |

## Keyboard

| Key | Action       |
|-----|--------------|
| F   | Frame all    |
| G   | Toggle grid  |

## Limitations

Current `generatedPreview.json` from `RbxPreviewBridge` exposes a flat list
of representative structures (≈3 per target). The renderer is built for the
richer per-instance schema the bridge can grow into; once the bridge emits
the full Lua object graph, this UI shows every Folder/Part/Script without
code changes (only the auto-layout disperses co-located nodes — explicit
positions from the bridge override it).
