// t3/Factory/adapters/fs/index.js
// Expo-bundle käyttää in-memory WorkspaceAdapteria.
// Node-runtime (WorkspaceAdapterNode) on erillisessä alx-factory-server -projektissa.
export { WorkspaceAdapter, createWorkspaceAdapter, WORKSPACE_STATE, WORKSPACE_VERSION } from "./WorkspaceAdapter.js";