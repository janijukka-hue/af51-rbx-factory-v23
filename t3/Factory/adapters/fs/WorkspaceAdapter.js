// t3/Factory/adapters/fs/WorkspaceAdapter.js
// KERROS: T3 – Tuotanto
// Virtuaalinen tiedostojärjestelmä, pure JS, React Native compatible.
// Ei Node-buildineja.

import { simpleHash256, fnv1a32 } from "../hashing-adapter.js";

export const WORKSPACE_VERSION = "2.0.0";

export const WORKSPACE_STATE = {
  UNINITIALIZED: "UNINITIALIZED",
  READY:         "READY",
  CLEANED:       "CLEANED"
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES     = 1000;

// ─── helpers ────────────────────────────────────────────────

function normalizePath(raw) {
  if (!raw || typeof raw !== "string") return "";
  const parts = raw.replace(/\\/g, "/").split("/");
  const out   = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p === ".." || p === "." || p === "") continue;
    out.push(p);
  }
  return out.join("/");
}

function startsWithDir(filePath, dir) {
  if (!dir) return true;
  var d = dir.replace(/\/+$/, "");
  return filePath === d || filePath.startsWith(d + "/");
}

// ─── WorkspaceAdapter ───────────────────────────────────────

export class WorkspaceAdapter {

  constructor(options) {
    var opts        = options || {};
    this._projectId = null;
    this._state     = WORKSPACE_STATE.UNINITIALIZED;
    this._clock     = opts.clock    || { now: function() { return Date.now(); } };
    this._eventBus  = opts.eventBus || null;
    this._debug     = opts.debug    || false;
    this._files     = new Map();
    this._snapshots = [];
    this._stats     = {
      filesWritten: 0,
      filesRead:    0,
      bytesWritten: 0,
      snapshots:    0,
      createdAt:    null
    };
  }

  createWorkspace(projectId) {
    if (!projectId) throw new Error("WorkspaceAdapter.createWorkspace: projectId vaaditaan");
    this._projectId       = projectId;
    this._state           = WORKSPACE_STATE.READY;
    this._files           = new Map();
    this._stats.createdAt = this._clock.now();
    this._emit("WORKSPACE:CREATED", { projectId: projectId });
    return { ok: true, projectId: projectId };
  }

  getProjectId() { return this._projectId; }
  getRootDir()   { return this._projectId ? ("/workspace/" + this._projectId) : null; }

  writeFile(filePath, content) {
    this._assertReady("writeFile");
    var p = normalizePath(filePath);
    if (!p) throw new Error("writeFile: polku on tyhjä tai virheellinen");
    var str = typeof content === "string" ? content : String(content || "");
    if (str.length > MAX_FILE_SIZE) {
      throw new Error("Tiedosto liian suuri: " + p + " (" + str.length + " merkkiä)");
    }
    var hash     = simpleHash256(str);
    var ts       = this._clock.now();
    var existing = this._files.get(p);
    this._files.set(p, {
      content:    str,
      hash:       hash,
      size:       str.length,
      createdAt:  existing ? existing.createdAt : ts,
      modifiedAt: ts
    });
    this._stats.filesWritten++;
    this._stats.bytesWritten += str.length;
    return { ok: true, path: p, size: str.length, hash: hash };
  }

  writeFiles(files) {
    this._assertReady("writeFiles");
    if (!Array.isArray(files)) throw new Error("writeFiles: files[] vaaditaan");
    if (files.length > MAX_FILES) throw new Error("Liian monta tiedostoa: " + files.length);
    var results = [];
    var errors  = [];
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (!file || !file.path) {
        errors.push({ path: "(tuntematon)", error: "path puuttuu" });
        continue;
      }
      try {
        results.push(this.writeFile(file.path, file.content || ""));
      } catch (err) {
        errors.push({ path: file.path, error: err.message });
      }
    }
    this._emit("WORKSPACE:FILES_WRITTEN", {
      projectId: this._projectId,
      count:     results.length,
      errors:    errors.length
    });
    return { ok: errors.length === 0, written: results.length, failed: errors.length, results: results, errors: errors };
  }

  readFile(filePath) {
    this._assertReady("readFile");
    var p     = normalizePath(filePath);
    var entry = this._files.get(p);
    if (!entry) return { ok: false, error: "Tiedostoa ei löydy: " + p };
    this._stats.filesRead++;
    return { ok: true, path: p, content: entry.content, size: entry.size, hash: entry.hash, modifiedAt: entry.modifiedAt };
  }

  fileExists(filePath) {
    if (!filePath || this._state === WORKSPACE_STATE.UNINITIALIZED) return false;
    return this._files.has(normalizePath(filePath));
  }

  listTree(subDir) {
    this._assertReady("listTree");
    var dir   = normalizePath(subDir || "");
    var files = [];
    this._files.forEach(function(entry, path) {
      if (!startsWithDir(path, dir)) return;
      files.push({ path: path, size: entry.size, hash: entry.hash, modifiedAt: entry.modifiedAt });
    });
    return { ok: true, projectId: this._projectId, subDir: dir || "/", files: files, count: files.length };
  }

  hashAll() {
    this._assertReady("hashAll");
    var fileHashes = [];
    var combined   = "";
    this._files.forEach(function(entry, path) {
      fileHashes.push({ path: path, hash: entry.hash, size: entry.size });
      combined += path + ":" + entry.hash + "\n";
    });
    return { ok: true, treeHash: simpleHash256(combined), files: fileHashes, totalFiles: fileHashes.length };
  }

  snapshot(label) {
    this._assertReady("snapshot");
    var safeLabel = label || "snapshot";
    var ts        = this._clock.now();
    var copy      = new Map();
    this._files.forEach(function(entry, path) { copy.set(path, Object.assign({}, entry)); });
    var snap = {
      id:        "snap_" + ts + "_" + fnv1a32(safeLabel + ts).toString(16),
      label:     safeLabel,
      createdAt: ts,
      files:     copy,
      fileCount: copy.size,
      treeHash:  this.hashAll().treeHash
    };
    this._snapshots.push(snap);
    this._stats.snapshots++;
    this._emit("WORKSPACE:SNAPSHOT", { projectId: this._projectId, snapshotId: snap.id, fileCount: snap.fileCount });
    return { ok: true, snapshot: { id: snap.id, label: safeLabel, createdAt: snap.createdAt, fileCount: snap.fileCount } };
  }

  getSnapshots() {
    return this._snapshots.map(function(s) {
      return { id: s.id, label: s.label, createdAt: s.createdAt, fileCount: s.fileCount };
    });
  }

  restoreSnapshot(snapshotId) {
    var snap = null;
    for (var i = 0; i < this._snapshots.length; i++) {
      if (this._snapshots[i].id === snapshotId) { snap = this._snapshots[i]; break; }
    }
    if (!snap) return { ok: false, error: "Snapshotia ei löydy: " + snapshotId };
    this._files = new Map();
    snap.files.forEach(function(entry, path) { this._files.set(path, Object.assign({}, entry)); }, this);
    this._emit("WORKSPACE:RESTORED", { projectId: this._projectId, snapshotId: snapshotId });
    return { ok: true, snapshotId: snapshotId, fileCount: this._files.size };
  }

  serialize() {
    var files = [];
    this._files.forEach(function(entry, path) {
      files.push({ path: path, content: entry.content, hash: entry.hash, size: entry.size });
    });
    return { projectId: this._projectId, files: files };
  }

  cleanup(keepSnapshots) {
    if (!keepSnapshots) this._snapshots = [];
    this._files = new Map();
    this._state = WORKSPACE_STATE.CLEANED;
    this._emit("WORKSPACE:CLEANED", { projectId: this._projectId });
    return { ok: true, projectId: this._projectId };
  }

  getState() { return this._state; }

  getStats() {
    return Object.assign({}, this._stats, {
      state:         this._state,
      projectId:     this._projectId,
      fileCount:     this._files.size,
      snapshotCount: this._snapshots.length,
      version:       WORKSPACE_VERSION
    });
  }

  _assertReady(method) {
    if (this._state === WORKSPACE_STATE.UNINITIALIZED) {
      throw new Error("WorkspaceAdapter." + method + ": Kutsu createWorkspace() ensin");
    }
    if (this._state === WORKSPACE_STATE.CLEANED) {
      throw new Error("WorkspaceAdapter." + method + ": Workspace on jo siivottu");
    }
  }

  _emit(type, payload) {
    if (this._eventBus && typeof this._eventBus.emit === "function") {
      this._eventBus.emit(type, payload);
    }
  }
}

export function createWorkspaceAdapter(options) {
  return new WorkspaceAdapter(options || {});
}

export default WorkspaceAdapter;