// t3/Factory/adapters/fs/WorkspaceAdapterNode.js
// KERROS: T3 — Tuotanto
// Node.js filesystem-pohjainen workspace.
// Täysin yhteensopiva WorkspaceAdapter-rajapinnan kanssa.
//
// HUOM: Tämä tiedosto on tarkoitettu vain Node.js-runtimelle (ESM).
// Expo / React Native -ympäristössä käytä WorkspaceAdapter.js (in-memory).
/* eslint-disable */

import _fs     from "fs";
import _path   from "path";
import _crypto from "crypto";

export var WORKSPACE_NODE_VERSION = "2.0.0";

var WORKSPACE_ROOT_DEFAULT = ".af51-workspaces";

var WORKSPACE_STATE = {
  UNINITIALIZED: "UNINITIALIZED",
  READY:         "READY",
  CLEANED:       "CLEANED",
};

function normalizePath(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

export class WorkspaceAdapterNode {

  constructor(options) {
    var opts        = options || {};
    this._projectId = null;
    this._rootDir   = null;
    this._state     = WORKSPACE_STATE.UNINITIALIZED;
    this._clock     = opts.clock    || { now: function() { return Date.now(); } };
    this._eventBus  = opts.eventBus || null;
    this._debug     = opts.debug    || false;
    this._wsRoot    = opts.workspaceRoot
      || (typeof process !== "undefined" && process.env && process.env.ALX_WORKSPACE_ROOT)
      || WORKSPACE_ROOT_DEFAULT;
    this._snapshots = [];
    this._stats = {
      filesWritten: 0,
      filesRead:    0,
      bytesWritten: 0,
      snapshots:    0,
      createdAt:    null,
    };
  }

  // ── Init ────────────────────────────────────────────────────
  createWorkspace(projectId) {
    if (!projectId) throw new Error("WorkspaceAdapterNode.createWorkspace: projectId vaaditaan");

    this._projectId     = projectId;
    this._rootDir       = _path.join(this._wsRoot, projectId);
    this._state         = WORKSPACE_STATE.READY;
    this._stats.createdAt = this._clock.now();

    _fs.mkdirSync(this._rootDir, { recursive: true });
    if (this._debug) 
    this._emit("WORKSPACE:CREATED", { projectId: projectId, rootDir: this._rootDir });
    return { ok: true, projectId: projectId, rootDir: this._rootDir };
  }

  getProjectId() { return this._projectId; }
  getRootDir()   { return this._rootDir; }

  // ── Write ────────────────────────────────────────────────────
  writeFile(filePath, content) {
    this._assertReady("writeFile");
    var rel = normalizePath(filePath);
    if (!rel) throw new Error("writeFile: polku on tyhjä");
    var abs = _path.join(this._rootDir, rel);
    var str = typeof content === "string" ? content : String(content || "");
    _fs.mkdirSync(_path.dirname(abs), { recursive: true });
    _fs.writeFileSync(abs, str, "utf8");
    this._stats.filesWritten++;
    this._stats.bytesWritten += str.length;
    return { ok: true, path: rel, bytes: str.length };
  }

  writeFiles(files) {
    this._assertReady("writeFiles");
    if (!Array.isArray(files)) throw new Error("writeFiles: files täytyy olla taulukko");
    var written = 0; var failed = 0; var errors = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      try {
        this.writeFile(f.path, f.content != null ? f.content : (f.data || ""));
        written++;
      } catch (err) {
        failed++;
        errors.push({ path: f.path, error: err.message });
      }
    }
    return { ok: failed === 0, written: written, failed: failed, errors: errors };
  }

  // ── Read ─────────────────────────────────────────────────────
  readFile(filePath) {
    this._assertReady("readFile");
    var abs = _path.join(this._rootDir, normalizePath(filePath));
    if (!_fs.existsSync(abs)) return null;
    this._stats.filesRead++;
    return _fs.readFileSync(abs, "utf8");
  }

  fileExists(filePath) {
    if (!this._rootDir || !_fs) return false;
    return _fs.existsSync(_path.join(this._rootDir, normalizePath(filePath)));
  }

  listTree(subDir) {
    this._assertReady("listTree");
    var base = subDir
      ? _path.join(this._rootDir, normalizePath(subDir))
      : this._rootDir;
    if (!_fs.existsSync(base)) return [];
    var self = this;
    return self._walkDir(base).map(function(abs) {
      return abs.replace(base + _path.sep, "").replace(/\\/g, "/");
    });
  }

  _walkDir(dir) {
    var results = [];
    var entries = _fs.readdirSync(dir, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
      var full = _path.join(dir, entries[i].name);
      if (entries[i].isDirectory()) {
        results = results.concat(this._walkDir(full));
      } else {
        results.push(full);
      }
    }
    return results;
  }

  // ── Hash ─────────────────────────────────────────────────────
  hashAll() {
    this._assertReady("hashAll");
    var files = this.listTree();
    var h = _crypto.createHash("sha256");
    files.sort();
    for (var i = 0; i < files.length; i++) {
      h.update(files[i] + ":" + (this.readFile(files[i]) || ""));
    }
    return h.digest("hex");
  }

  // ── Snapshot ─────────────────────────────────────────────────
  snapshot(label) {
    this._assertReady("snapshot");
    var id    = "snap_" + this._clock.now() + "_" + Math.random().toString(36).slice(2, 6);
    var files = {};
    var tree  = this.listTree();
    for (var i = 0; i < tree.length; i++) {
      files[tree[i]] = this.readFile(tree[i]);
    }
    var snap = { id: id, label: label || "", ts: this._clock.now(), files: files };
    this._snapshots.push(snap);
    if (this._snapshots.length > 10) this._snapshots.shift();
    this._stats.snapshots++;
    return { ok: true, snapshotId: id, fileCount: tree.length };
  }

  getSnapshots() {
    return this._snapshots.map(function(s) {
      return { id: s.id, label: s.label, ts: s.ts, fileCount: Object.keys(s.files).length };
    });
  }

  restoreSnapshot(snapshotId) {
    this._assertReady("restoreSnapshot");
    var snap = null;
    for (var i = 0; i < this._snapshots.length; i++) {
      if (this._snapshots[i].id === snapshotId) { snap = this._snapshots[i]; break; }
    }
    if (!snap) return { ok: false, error: "Snapshot ei löydy: " + snapshotId };
    var files = snap.files;
    var keys  = Object.keys(files);
    for (var j = 0; j < keys.length; j++) {
      this.writeFile(keys[j], files[keys[j]] || "");
    }
    return { ok: true, snapshotId: snapshotId, restored: keys.length };
  }

  // ── Cleanup ───────────────────────────────────────────────────
  cleanup(keepSnapshots) {
    if (this._rootDir && _fs && _fs.existsSync(this._rootDir)) {
      _fs.rmSync(this._rootDir, { recursive: true, force: true });
    }
    this._state = WORKSPACE_STATE.CLEANED;
    if (!keepSnapshots) this._snapshots = [];
    return { ok: true };
  }

  serialize() {
    return {
      projectId: this._projectId,
      rootDir:   this._rootDir,
      state:     this._state,
      snapshots: this.getSnapshots(),
      stats:     this.getStats(),
    };
  }

  getState() { return this._state; }

  getStats() {
    return {
      projectId:    this._projectId,
      rootDir:      this._rootDir,
      state:        this._state,
      filesWritten: this._stats.filesWritten,
      filesRead:    this._stats.filesRead,
      bytesWritten: this._stats.bytesWritten,
      snapshots:    this._stats.snapshots,
      createdAt:    this._stats.createdAt,
    };
  }

  // ── Internal ─────────────────────────────────────────────────
  _assertReady(method) {
    if (this._state !== WORKSPACE_STATE.READY) {
      throw new Error("WorkspaceAdapterNode." + method + ": Kutsu createWorkspace() ensin");
    }
  }

  _emit(type, payload) {
    if (this._eventBus && this._eventBus.emit) {
      try { this._eventBus.emit(type, payload); } catch (e) { /* ignore */ }
    }
  }
}

export function createWorkspaceAdapterNode(options) {
  return new WorkspaceAdapterNode(options || {});
}

export default WorkspaceAdapterNode;