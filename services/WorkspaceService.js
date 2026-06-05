// services/WorkspaceService.js
// AF51 ONE — Workspace palvelukerros
//
// Workspace = KESKENERÄINEN TYÖ
// Eivät ole valmiita artifakteja, ei julkaistavissa suoraan.
// Rakenne: .af51-workspaces/<projectId>/
//   ├─ src/           — lähdekoodi
//   │  └─ App.jsx
//   ├─ meta.json      — projektin perustiedot
//   ├─ state.json     — nykyinen tila (active/aborted/completed)
//   ├─ snapshots/     — versiohistoria
//   │  └─ <ts>.snapshot.json
//   └─ audit.jsonl    — tapahtumaloki

import fs   from "fs";
import path from "path";
import { createHash } from "crypto";

var WS_ROOT = process.env.ALX_WORKSPACE_ROOT || ".af51-workspaces";

// ── Apufunktiot ───────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Salli vain turvallinen projectId — estä path traversal
function sanitizeProjectId(id) {
  if (typeof id !== "string" || !id) return null;
  // Salli vain: a-z A-Z 0-9 _ - ja pisteet (ei peräkkäisiä)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(id)) return null;
  // Estä .. ja polkuerottimet
  if (id.indexOf("..") >= 0 || id.indexOf("/") >= 0 || id.indexOf("\\") >= 0) return null;
  return id;
}

function projectDir(projectId) {
  var safe = sanitizeProjectId(projectId);
  if (!safe) throw new Error("Virheellinen projectId: " + JSON.stringify(projectId));
  var result   = path.resolve(WS_ROOT, safe);
  var wsRoot   = path.resolve(WS_ROOT);
  // Varmista että tulos pysyy WS_ROOTin sisällä
  if (!result.startsWith(wsRoot + path.sep) && result !== wsRoot) {
    throw new Error("Path traversal estetty: " + projectId);
  }
  return result;
}

function generateProjectId() {
  var ts   = Date.now().toString(36);
  var rand = Math.random().toString(36).slice(2, 7);
  return "proj_" + ts + "_" + rand;
}

function sha256(str) {
  return createHash("sha256").update(str || "", "utf8").digest("hex").slice(0, 16);
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return null;
  }
}

function appendAudit(dir, event, data) {
  try {
    var line = JSON.stringify({ ts: Date.now(), event: event, data: data || {} }) + "\n";
    fs.appendFileSync(path.join(dir, "audit.jsonl"), line, "utf8");
  } catch (_) {}
}

// ── Save ──────────────────────────────────────────────────────

export async function saveWorkspace(params) {
  var projectId = params.projectId || generateProjectId();
  var dir       = projectDir(projectId);
  var srcDir    = path.join(dir, "src");

  ensureDir(dir);
  ensureDir(srcDir);
  ensureDir(path.join(dir, "snapshots"));

  // Pääkoodi — tukee sekä source (yksittäinen) että files[] (monikansioinen)
  var source    = params.source || "";
  var files     = params.files;
  var fileCount = 1;

  if (Array.isArray(files) && files.length > 0) {
    // Monikansioinen: kirjoita kaikki tiedostot
    for (var fi of files) {
      if (!fi.path || typeof fi.content !== "string") continue;
      // Sanitoi polku — ei saa poistua workspacesta
      var safeRel = fi.path.replace(/\.\.\/|\.\.\\/g, "").replace(/^[\/\\]+/, "");
      var absPath = path.join(dir, safeRel);
      var absDir  = path.dirname(absPath);
      if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });
      fs.writeFileSync(absPath, fi.content, "utf8");
    }
    // source = ensimmäisen App.jsx sisältö backward-compat varten
    var appFile = files.find(function(f) { return f.path === "src/App.jsx" || f.path === "App.jsx"; });
    if (appFile) source = appFile.content;
    fileCount = files.length;
  } else {
    // Yksittäinen source → src/App.jsx
    fs.writeFileSync(path.join(srcDir, "App.jsx"), source, "utf8");
  }

  // meta.json
  var now  = Date.now();
  var meta = {
    projectId:   projectId,
    label:       params.label || ("Työ " + new Date(now).toLocaleString("fi-FI")),
    intent:      params.intent || "GENERATE_JSX",
    createdAt:   params.createdAt || now,
    updatedAt:   now,
    sourceHash:  sha256(source),
    fileCount:   fileCount,
    wsDir:       dir,
  };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");

  // state.json
  var state = readJsonSafe(path.join(dir, "state.json")) || {};
  state.status    = "active";
  state.updatedAt = now;
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2), "utf8");

  appendAudit(dir, "WORKSPACE_SAVED", { label: meta.label, sourceHash: meta.sourceHash });

  return { ok: true, projectId, wsDir: dir, meta };
}

// ── List ─────────────────────────────────────────────────────

export function listWorkspaces() {
  ensureDir(WS_ROOT);

  var dirs = [];
  try {
    dirs = fs.readdirSync(WS_ROOT).filter(function(d) {
      return fs.statSync(path.join(WS_ROOT, d)).isDirectory() && d.startsWith("proj_");
    });
  } catch (_) {}

  var projects = dirs.map(function(d) {
    var dir      = path.join(WS_ROOT, d);
    var meta     = readJsonSafe(path.join(dir, "meta.json")) || { projectId: d, label: d };
    var state    = readJsonSafe(path.join(dir, "state.json")) || {};
    var snapCount = 0;
    try {
      snapCount = fs.readdirSync(path.join(dir, "snapshots")).filter(function(f) {
        return f.endsWith(".snapshot.json");
      }).length;
    } catch (_) {}
    return Object.assign({}, meta, { status: state.status || "active", snapshots: snapCount });
  });

  // Järjestä uusin ensin
  projects.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

  return { ok: true, count: projects.length, projects };
}

// ── Load ─────────────────────────────────────────────────────

export function loadWorkspace(projectId) {
  var dir = projectDir(projectId);
  if (!fs.existsSync(dir)) {
    return { ok: false, error: "Workspacea ei löydy: " + projectId };
  }

  var meta  = readJsonSafe(path.join(dir, "meta.json")) || {};
  var state = readJsonSafe(path.join(dir, "state.json")) || {};

  var source = null;
  var srcFile = path.join(dir, "src", "App.jsx");
  if (fs.existsSync(srcFile)) {
    source = fs.readFileSync(srcFile, "utf8");
  }

  // Snapshot-lista
  var snapshots = [];
  try {
    snapshots = fs.readdirSync(path.join(dir, "snapshots"))
      .filter(function(f) { return f.endsWith(".snapshot.json"); })
      .map(function(f) {
        var snap = readJsonSafe(path.join(dir, "snapshots", f));
        return snap ? { ts: snap.ts, label: snap.label, hash: snap.sourceHash } : null;
      })
      .filter(Boolean)
      .sort(function(a, b) { return b.ts - a.ts; });
  } catch (_) {}

  return { ok: true, projectId, source, meta, state, snapshots, wsDir: dir };
}

// ── Snapshot ─────────────────────────────────────────────────

export function snapshotWorkspace(projectId, label) {
  var dir = projectDir(projectId);
  if (!fs.existsSync(dir)) {
    return { ok: false, error: "Workspacea ei löydy: " + projectId };
  }

  var snapDir = path.join(dir, "snapshots");
  ensureDir(snapDir);

  var source  = null;
  var srcFile = path.join(dir, "src", "App.jsx");
  if (fs.existsSync(srcFile)) {
    source = fs.readFileSync(srcFile, "utf8");
  }

  var now      = Date.now();
  var snapId   = now.toString(36);
  var snapshot = {
    snapId:     snapId,
    projectId:  projectId,
    label:      label || ("Snapshot " + new Date(now).toLocaleString("fi-FI")),
    ts:         now,
    source:     source,
    sourceHash: sha256(source),
  };

  fs.writeFileSync(
    path.join(snapDir, snapId + ".snapshot.json"),
    JSON.stringify(snapshot, null, 2),
    "utf8"
  );

  appendAudit(dir, "SNAPSHOT_CREATED", { snapId, label: snapshot.label });

  return { ok: true, snapId, projectId, ts: now, label: snapshot.label };
}

// ── Restore ──────────────────────────────────────────────────

export function restoreSnapshot(projectId, snapId) {
  var dir     = projectDir(projectId);
  var snapFile = path.join(dir, "snapshots", snapId + ".snapshot.json");

  if (!fs.existsSync(snapFile)) {
    return { ok: false, error: "Snapshotia ei löydy: " + snapId };
  }

  var snap = readJsonSafe(snapFile);
  if (!snap || !snap.source) {
    return { ok: false, error: "Snapshot on tyhjä tai vioittunut" };
  }

  var srcFile = path.join(dir, "src", "App.jsx");
  fs.writeFileSync(srcFile, snap.source, "utf8");

  // Päivitetään state
  var state = readJsonSafe(path.join(dir, "state.json")) || {};
  state.status      = "active";
  state.restoredFrom = snapId;
  state.updatedAt   = Date.now();
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2), "utf8");

  appendAudit(dir, "SNAPSHOT_RESTORED", { snapId, label: snap.label });

  return { ok: true, projectId, snapId, restored: true, source: snap.source };
}

// ── Abort ────────────────────────────────────────────────────

export function abortWorkspace(projectId) {
  var dir = projectDir(projectId);
  if (!fs.existsSync(dir)) {
    return { ok: false, error: "Workspacea ei löydy: " + projectId };
  }

  var state = readJsonSafe(path.join(dir, "state.json")) || {};
  state.status    = "aborted";
  state.abortedAt = Date.now();
  state.updatedAt = state.abortedAt;
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2), "utf8");

  appendAudit(dir, "WORKSPACE_ABORTED", {});

  return { ok: true, projectId, aborted: true };
}