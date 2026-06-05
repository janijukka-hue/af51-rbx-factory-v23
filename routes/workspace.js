// routes/workspace.js — AF51 ONE Workspace routes
// Workspace = KESKENERÄINEN TYÖ (.af51-workspaces/)
//
// POST /workspace/save           → tallenna
// GET  /workspace                → listaa
// GET  /workspace/:id            → lataa
// POST /workspace/:id/snapshot   → snapshot
// POST /workspace/:id/restore/:snapId → palauta snapshot
// POST /workspace/:id/abort      → keskeytä
// POST /workspace/:id/clear      → poista

import {
  saveWorkspace,
  listWorkspaces,
  loadWorkspace,
  snapshotWorkspace,
  restoreSnapshot,
  abortWorkspace,
} from "../services/WorkspaceService.js";


function normalizeSourceText(text) {
  return String(text || "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/[\u2028\u2029]/g, "\n");
}

function isBuildStatusText(text) {
  var s = normalizeSourceText(text).trim();
  return (
    s.startsWith("Build valmis!") ||
    s.includes("Katso Preview Roomista") ||
    s.includes("Build ID:") ||
    s.includes("Koodia:")
  );
}

function sanitizeReactSource(text) {
  var s = normalizeSourceText(text).trim();
  s = s.replace(/^\s*build\s+(?=import\s+)/i, "");
  s = s.replace(/^\s*build\s+(?=function\s+App\s*\()/i, "");
  s = s.replace(/^\s*build\s+(?=export\s+default\s+function\s+App\s*\()/i, "");
  return s.trim();
}

function isReactAppSource(text) {
  var s = sanitizeReactSource(text);

  if (!s) return false;
  if (isBuildStatusText(s)) return false;

  return (
    s.includes("function App(") ||
    s.includes("function App()") ||
    s.includes("export default function App")
  );
}

function validateWorkspaceFiles(files, source) {
  var appFile = Array.isArray(files)
    ? files.find(function(f) {
        return f && (
          f.path === "src/App.jsx" ||
          f.path === "App.jsx" ||
          f.path === "App.js"
        );
      })
    : null;

  var appSource = appFile ? appFile.content : source;

  if (!appSource) {
    return { ok: false, error: "INVALID_SOURCE: missing App file" };
  }

  if (!isReactAppSource(appSource)) {
    return { ok: false, error: "INVALID_SOURCE: App file is not React App source" };
  }

  if (sanitizeReactSource(appSource).length < 500) {
    return { ok: false, error: "INVALID_SOURCE: App file too short" };
  }

  return { ok: true };
}

function parseProjectId(url, suffix) {
  // /workspace/proj_abc/snapshot → proj_abc
  var parts = url.split("/").filter(Boolean);
  var idx = parts.indexOf("workspace");
  return idx >= 0 ? parts[idx + 1] || null : null;
}

export async function handleWorkspaceSave(req, res, send, readBody) {
  try {
    var body   = await readBody(req);
    if (!body.source && (!Array.isArray(body.files) || body.files.length === 0))
      return send(res, 400, { ok: false, error: "source tai files[] puuttuu" });

    // ── RBX HARD ISOLATION: skip React validation for RBX build metadata ──
    // RBX saves contain rbx-build.json, not App.jsx — never run through web pipeline
    var isRbxSave = (
      (typeof body.source === "string" && body.source.includes('"type":"RBX_BUILD"')) ||
      (Array.isArray(body.files) && body.files.some(function(f) { return f && f.path === "rbx-build.json"; }))
    );

    if (!isRbxSave) {
      var validation = validateWorkspaceFiles(body.files, body.source);
      if (!validation.ok) {
        return send(res, 400, { ok: false, error: validation.error });
      }
      // Normalisoi hyväksytty App-lähde ennen levylle kirjoitusta.
      if (typeof body.source === "string") {
        body.source = sanitizeReactSource(body.source);
      }
      if (Array.isArray(body.files)) {
        body.files = body.files.map(function(file) {
          if (!file || typeof file.content !== "string") return file;
          if (file.path === "src/App.jsx" || file.path === "App.jsx" || file.path === "App.js") {
            return Object.assign({}, file, { content: sanitizeReactSource(file.content) });
          }
          return file;
        });
      }
    }
    // RBX saves bypass React validation and normalization entirely

    var result = await saveWorkspace(body);
    return send(res, result.ok ? 200 : 500, result);
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}

export function handleWorkspaceList(req, res, send) {
  try {
    var result = listWorkspaces();
    return send(res, 200, result);
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}

export function handleWorkspaceLoad(req, res, send, url) {
  try {
    var projectId = parseProjectId(url);
    if (!projectId) return send(res, 400, { ok: false, error: "projectId puuttuu" });
    var result = loadWorkspace(projectId);
    return send(res, result.ok ? 200 : 404, result);
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}

export async function handleWorkspaceSnapshot(req, res, send, readBody, url) {
  try {
    var projectId = parseProjectId(url);
    if (!projectId) return send(res, 400, { ok: false, error: "projectId puuttuu" });
    var body   = await readBody(req);
    var result = snapshotWorkspace(projectId, body.label || null);
    return send(res, result.ok ? 200 : 404, result);
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}

export async function handleWorkspaceRestore(req, res, send, readBody, url) {
  try {
    var parts     = url.split("/").filter(Boolean);
    var wsIdx     = parts.indexOf("workspace");
    var projectId = parts[wsIdx + 1] || null;
    var snapId    = parts[wsIdx + 3] || null; // /workspace/:id/restore/:snapId
    if (!projectId || !snapId) {
      return send(res, 400, { ok: false, error: "projectId tai snapId puuttuu" });
    }
    var result = restoreSnapshot(projectId, snapId);
    return send(res, result.ok ? 200 : 404, result);
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}

export async function handleWorkspaceAbort(req, res, send, url) {
  try {
    var projectId = parseProjectId(url);
    if (!projectId) return send(res, 400, { ok: false, error: "projectId puuttuu" });
    var result = abortWorkspace(projectId);
    return send(res, result.ok ? 200 : 404, result);
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}

export async function handleWorkspaceClear(req, res, send) {
  return send(res, 200, { ok: true, cleared: true, ts: Date.now() });
}