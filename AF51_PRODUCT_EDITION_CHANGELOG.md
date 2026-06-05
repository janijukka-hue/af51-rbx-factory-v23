# AF51 Product Edition — UI Change Log

This package keeps the working AF51 machinery intact and changes only the visible cockpit/UI layer.

## Changed

- Replaced the old MasterRoom UI with a new AF51 Product Edition interface.
- Added the Nordic Intelligence / AF51 visual theme.
- Added background artwork asset: `assets/af51-nordic-intelligence.jpg`.
- Added clean top navigation inside the main builder view.
- Added public builder flow:
  - BUILD command prefix locked in front of input
  - command input
  - runtime preview panel
  - build status panel
  - save
  - publish
  - export ZIP
  - vault
  - snapshot
- Added Admin Cockpit view for machine-room status without exposing model/provider branding.
- Removed Ollama from the visible navigation and public UI.
- Simplified bottom navigation to:
  - Builder
  - Preview
  - Vault
  - ZIP
  - Settings

## Preserved

- Backend routes are unchanged.
- Factory pipeline is unchanged.
- Workspace save flow is unchanged.
- Publish / ZIP flow is unchanged.
- Vault flow is unchanged.
- Runtime and governance machinery remain on the machine-room side.

## Backup Files

Original files are preserved as:

- `ui/MasterRoomUI.legacy.js`
- `s4/navigation/AppNavigator.legacy.js`
- `s4/navigation/routes.legacy.js`

## Startup

Backend:

```bash
node server.js
```

Web UI:

```bash
npm run web
```

If web script is not available in another package variant:

```bash
npm run dev
```

## v2 Preview Cleanup
- Bottom navigation simplified to Builder + ZIP only.
- Right-side Runtime View changed from source-code display to live rendered preview using LiveRenderView.
- Separate Preview/Vault/Settings bottom tabs removed from public product navigation.
- Top product navigation simplified to Builder + ZIP.
- Factory backend, routes, vault, publish pipeline and core machinery untouched.
