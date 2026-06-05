// t3/patch/PatchEngine.js
// KERROS: T3 – Tuotanto
// Soveltaa patch-setin workspaceen TemplatePhase:n jälkeen.
// Pure JS, ei Node-buildineja.
//
// Patch-tyypit:
//   ADD    – lisää tiedosto (virhe jos on jo olemassa, ellei overwrite:true)
//   UPDATE – päivittää tiedoston (koko sisältö tai find+replace)
//   DELETE – poistaa tiedoston (tyhjentää)
//   MOVE   – siirtää tiedoston
//   APPEND – lisää sisältöä tiedoston loppuun

export const PATCH_ENGINE_VERSION = "1.0.0";

export const PATCH_TYPE = {
  ADD:    "ADD",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  MOVE:   "MOVE",
  APPEND: "APPEND"
};

export class PatchEngine {

  constructor(options) {
    var opts        = options || {};
    this._workspace = opts.workspace || null;
    this._eventBus  = opts.eventBus  || null;
    this._debug     = opts.debug     || false;
    if (!this._workspace) throw new Error("PatchEngine: workspace vaaditaan");
    this._stats = { total: 0, applied: 0, skipped: 0, failed: 0 };
  }

  // ── applyAll ────────────────────────────────────────────

  applyAll(patches) {
    if (!Array.isArray(patches) || patches.length === 0) {
      return { ok: true, applied: 0, failed: 0, results: [], message: "Ei patcheja" };
    }
    var results = [];
    for (var i = 0; i < patches.length; i++) {
      var r = this.applyOne(patches[i]);
      results.push(r);
      this._stats.total++;
      if (r.ok)            this._stats.applied++;
      else if (r.skipped)  this._stats.skipped++;
      else                 this._stats.failed++;
    }
    var ok = results.every(function(r) { return r.ok || r.skipped; });
    this._emit("PATCH:BATCH_COMPLETE", {
      total:   results.length,
      applied: results.filter(function(r) { return r.ok; }).length,
      failed:  results.filter(function(r) { return !r.ok && !r.skipped; }).length
    });
    return {
      ok:      ok,
      applied: results.filter(function(r) { return r.ok; }).length,
      failed:  results.filter(function(r) { return !r.ok && !r.skipped; }).length,
      results: results
    };
  }

  applyOne(patch) {
    if (!patch || !patch.type) return { ok: false, error: "Patch puuttuu tai type-kenttä puuttuu" };
    var type = String(patch.type).toUpperCase();
    try {
      switch (type) {
        case PATCH_TYPE.ADD:    return this._applyAdd(patch);
        case PATCH_TYPE.UPDATE: return this._applyUpdate(patch);
        case PATCH_TYPE.DELETE: return this._applyDelete(patch);
        case PATCH_TYPE.MOVE:   return this._applyMove(patch);
        case PATCH_TYPE.APPEND: return this._applyAppend(patch);
        default:
          return { ok: false, type: type, error: "Tuntematon patch-tyyppi: " + type };
      }
    } catch (err) {
      this._emit("PATCH:FAILED", { type: type, path: patch.path, error: err.message });
      return { ok: false, type: type, path: patch.path, error: err.message };
    }
  }

  // ── ADD ──────────────────────────────────────────────────

  _applyAdd(patch) {
    var filePath  = patch.path;
    var content   = patch.content != null ? patch.content : "";
    var overwrite = patch.overwrite || false;
    if (!filePath) throw new Error("ADD: path vaaditaan");
    if (!overwrite && this._workspace.fileExists(filePath)) {
      return { ok: false, skipped: true, type: PATCH_TYPE.ADD, path: filePath,
        message: "Tiedosto on jo olemassa: " + filePath + " (käytä overwrite:true tai UPDATE)" };
    }
    var r = this._workspace.writeFile(filePath, content);
    this._emit("PATCH:APPLIED", { type: PATCH_TYPE.ADD, path: filePath });
    return { ok: r.ok, type: PATCH_TYPE.ADD, path: filePath, size: r.size, hash: r.hash };
  }

  // ── UPDATE ───────────────────────────────────────────────

  _applyUpdate(patch) {
    var filePath = patch.path;
    var content  = patch.content;
    var find     = patch.find;
    var replace  = patch.replace;
    var all      = patch.all !== false;
    if (!filePath) throw new Error("UPDATE: path vaaditaan");

    // Koko tiedoston korvaus
    if (content !== undefined && find === undefined) {
      var r = this._workspace.writeFile(filePath, content);
      this._emit("PATCH:APPLIED", { type: PATCH_TYPE.UPDATE, path: filePath, mode: "full" });
      return { ok: r.ok, type: PATCH_TYPE.UPDATE, path: filePath, mode: "full" };
    }

    // Find & replace
    if (find !== undefined && replace !== undefined) {
      var readR = this._workspace.readFile(filePath);
      if (!readR.ok) return { ok: false, type: PATCH_TYPE.UPDATE, path: filePath, error: readR.error };
      var cur     = readR.content;
      var findStr = String(find);
      if (cur.indexOf(findStr) === -1) {
        return { ok: false, type: PATCH_TYPE.UPDATE, path: filePath,
          error: "find-merkkijono ei löydy: " + JSON.stringify(findStr.slice(0, 60)) };
      }
      var newContent = all ? cur.split(findStr).join(String(replace)) : cur.replace(findStr, String(replace));
      var wr = this._workspace.writeFile(filePath, newContent);
      this._emit("PATCH:APPLIED", { type: PATCH_TYPE.UPDATE, path: filePath, mode: "find-replace" });
      return { ok: wr.ok, type: PATCH_TYPE.UPDATE, path: filePath, mode: "find-replace" };
    }

    return { ok: false, type: PATCH_TYPE.UPDATE, path: filePath, error: "UPDATE vaatii content tai find+replace" };
  }

  // ── DELETE ───────────────────────────────────────────────

  _applyDelete(patch) {
    var filePath = patch.path;
    var ifExists = patch.ifExists || false;
    if (!filePath) throw new Error("DELETE: path vaaditaan");
    if (!this._workspace.fileExists(filePath)) {
      if (ifExists) return { ok: true, skipped: true, type: PATCH_TYPE.DELETE, path: filePath };
      return { ok: false, type: PATCH_TYPE.DELETE, path: filePath, error: "Tiedostoa ei löydy: " + filePath };
    }
    this._workspace.writeFile(filePath, "// DELETED\n");
    this._emit("PATCH:APPLIED", { type: PATCH_TYPE.DELETE, path: filePath });
    return { ok: true, type: PATCH_TYPE.DELETE, path: filePath };
  }

  // ── MOVE ─────────────────────────────────────────────────

  _applyMove(patch) {
    var from = patch.from;
    var to   = patch.to;
    if (!from) throw new Error("MOVE: from vaaditaan");
    if (!to)   throw new Error("MOVE: to vaaditaan");
    var readR = this._workspace.readFile(from);
    if (!readR.ok) return { ok: false, type: PATCH_TYPE.MOVE, from: from, to: to, error: readR.error };
    this._workspace.writeFile(to, readR.content);
    this._workspace.writeFile(from, "// MOVED to: " + to + "\n");
    this._emit("PATCH:APPLIED", { type: PATCH_TYPE.MOVE, from: from, to: to });
    return { ok: true, type: PATCH_TYPE.MOVE, from: from, to: to };
  }

  // ── APPEND ───────────────────────────────────────────────

  _applyAppend(patch) {
    var filePath = patch.path;
    var content  = patch.content || "";
    if (!filePath) throw new Error("APPEND: path vaaditaan");
    var existing = "";
    if (this._workspace.fileExists(filePath)) {
      var readR = this._workspace.readFile(filePath);
      if (readR.ok) existing = readR.content;
    }
    var wr = this._workspace.writeFile(filePath, existing + "\n" + content);
    this._emit("PATCH:APPLIED", { type: PATCH_TYPE.APPEND, path: filePath });
    return { ok: wr.ok, type: PATCH_TYPE.APPEND, path: filePath };
  }

  // ── Tilastot ─────────────────────────────────────────────

  getStats() { return Object.assign({}, this._stats, { version: PATCH_ENGINE_VERSION }); }

  _emit(type, payload) {
    if (this._eventBus && typeof this._eventBus.emit === "function") {
      this._eventBus.emit(type, payload);
    }
  }
}

export function createPatchEngine(options) {
  return new PatchEngine(options || {});
}

export default PatchEngine;