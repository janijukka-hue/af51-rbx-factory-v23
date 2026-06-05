// routes/works.js — Work Vault API
// Tallentaa, listaa ja poistaa work artifakteja
// Work artifact = generoitu koodi pakattuna omaksi projektiksi
// chat message ≠ work artifact

import fs   from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

var __dir     = path.dirname(fileURLToPath(import.meta.url));
var WORKS_DIR = path.resolve(__dir, "..", "vault", "works");

function ensureDir() {
  if (!fs.existsSync(WORKS_DIR)) fs.mkdirSync(WORKS_DIR, { recursive: true });
}

function rid(req) {
  return req.headers["x-request-id"] || "wrk-" + Date.now().toString(36);
}

function safeId(s) {
  return String(s || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

// ── GET /works — listaa kaikki tallennetut työt ───────────────
export async function handleWorksList(req, res, send) {
  try {
    ensureDir();
    var files = fs.readdirSync(WORKS_DIR).filter(f => f.endsWith(".json"));
    var works = [];
    for (var f of files) {
      try {
        var raw = JSON.parse(fs.readFileSync(path.join(WORKS_DIR, f), "utf8"));
        works.push({
          id:        raw.id,
          title:     raw.title,
          type:      raw.type,
          status:    raw.status,
          createdAt: raw.createdAt,
          fileCount: Array.isArray(raw.files) ? raw.files.length : 0,
          source:    raw.metadata && raw.metadata.source,
        });
      } catch (_) {}
    }
    // Uusimmat ensin
    works.sort(function(a, b) { return b.createdAt > a.createdAt ? 1 : -1; });
    return send(res, 200, { ok: true, works: works, count: works.length });
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}

// ── POST /works/save — tallenna work artifact ─────────────────
export async function handleWorkSave(req, res, send, readBody) {
  try {
    ensureDir();
    var body = await readBody(req);

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return send(res, 400, { ok: false, error: "files[] vaaditaan — chat message ei kelpaa suoraan" });
    }

    var id    = "work_" + Date.now().toString(36) + "_" + crypto.randomBytes(3).toString("hex");
    var title = body.title || ("Work " + new Date().toLocaleString("fi-FI"));
    var now   = new Date().toISOString();

    // Laske SHA256 tiedostorakenteesta
    var allContent = body.files.map(function(f) { return f.path + ":" + (f.content || ""); }).join("|");
    var sha256 = crypto.createHash("sha256").update(allContent, "utf8").digest("hex");

    var artifact = {
      id:        id,
      title:     title,
      type:      body.type || "react-web",
      status:    "saved",
      createdAt: now,
      sha256:    sha256,
      files:     body.files.map(function(f) {
        return {
          path:     f.path,
          language: f.language || (f.path.endsWith(".jsx") ? "jsx" :
                    f.path.endsWith(".js") ? "javascript" :
                    f.path.endsWith(".css") ? "css" :
                    f.path.endsWith(".html") ? "html" : "text"),
          content:  f.content || "",
        };
      }),
      assets:   Array.isArray(body.assets) ? body.assets : [],
      metadata: Object.assign({
        source:       "manual",
        previewReady: true,
        af51_version: "1.0.0",
      }, body.metadata || {}),
    };

    var savePath = path.join(WORKS_DIR, safeId(id) + ".json");
    fs.writeFileSync(savePath, JSON.stringify(artifact, null, 2), "utf8");

    return send(res, 200, {
      ok:        true,
      workId:    id,
      title:     title,
      fileCount: artifact.files.length,
      sha256:    sha256,
      savedAt:   now,
    });
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}

// ── DELETE /works/:id — poista work artifact ──────────────────
export async function handleWorkDelete(req, res, send, url) {
  try {
    ensureDir();
    var workId = url.replace("/works/", "").split("/")[0];
    var safeWorkId = safeId(workId);
    var filePath = path.join(WORKS_DIR, safeWorkId + ".json");

    if (!fs.existsSync(filePath)) {
      return send(res, 404, { ok: false, error: "Työtä ei löydy: " + workId });
    }

    // Lue ensin meta
    var meta = JSON.parse(fs.readFileSync(filePath, "utf8"));
    fs.unlinkSync(filePath);

    return send(res, 200, {
      ok:      true,
      deleted: workId,
      title:   meta.title,
    });
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}


// ── POST /works/:id/attach-asset ─────────────────────────────
export async function handleWorkAttachAsset(req, res, send, body, url) {
  try {
    ensureDir();
    var workId = url.replace("/works/", "").split("/")[0];
    var asset  = body.asset;
    if (!asset || !asset.id) return send(res, 400, { ok: false, error: "asset puuttuu" });
    var fp = path.join(WORKS_DIR, safeId(workId) + ".json");
    if (!fs.existsSync(fp)) return send(res, 404, { ok: false, error: "Työtä ei löydy" });
    var work = JSON.parse(fs.readFileSync(fp, "utf8"));
    if (!Array.isArray(work.assets)) work.assets = [];
    if (!work.assets.some(function(a) { return a.id === asset.id; })) {
      work.assets.push(asset);
      work.updatedAt = new Date().toISOString();
      fs.writeFileSync(fp, JSON.stringify(work, null, 2));
    }
    return send(res, 200, { ok: true, workId, assetCount: work.assets.length });
  } catch (err) { return send(res, 500, { ok: false, error: err.message }); }
}

// ── POST /works/:id/detach-asset ─────────────────────────────
export async function handleWorkDetachAsset(req, res, send, body, url) {
  try {
    ensureDir();
    var workId  = url.replace("/works/", "").split("/")[0];
    var assetId = body.assetId;
    if (!assetId) return send(res, 400, { ok: false, error: "assetId puuttuu" });
    var fp = path.join(WORKS_DIR, safeId(workId) + ".json");
    if (!fs.existsSync(fp)) return send(res, 404, { ok: false, error: "Työtä ei löydy" });
    var work = JSON.parse(fs.readFileSync(fp, "utf8"));
    work.assets = (work.assets || []).filter(function(a) { return a.id !== assetId; });
    work.updatedAt = new Date().toISOString();
    fs.writeFileSync(fp, JSON.stringify(work, null, 2));
    return send(res, 200, { ok: true, workId, assetCount: work.assets.length });
  } catch (err) { return send(res, 500, { ok: false, error: err.message }); }
}

// ── GET /works/:id — hae yksittäinen work artifact ────────────
export async function handleWorkGet(req, res, send, url) {
  try {
    ensureDir();
    var workId = url.replace("/works/", "").split("/")[0];
    var filePath = path.join(WORKS_DIR, safeId(workId) + ".json");

    if (!fs.existsSync(filePath)) {
      return send(res, 404, { ok: false, error: "Työtä ei löydy: " + workId });
    }

    var artifact = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return send(res, 200, { ok: true, work: artifact });
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}