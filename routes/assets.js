// routes/assets.js — Asset Pipeline
// upload → vault/assets/<assetId>/
// attach → work.assets[]
// delete → blocked if work uses it (unless force=true)

import fs     from "fs";
import path   from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

var __dir       = path.dirname(fileURLToPath(import.meta.url));
var ASSETS_DIR  = path.resolve(__dir, "..", "vault", "assets");
var WORKS_DIR   = path.resolve(__dir, "..", "vault", "works");

var MAX_ASSET_BYTES = parseInt(process.env.ALX_MAX_ASSET_SIZE_MB || "20", 10) * 1024 * 1024;

var ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm",
]);

var MIME_EXT = {
  "image/jpeg": ".jpg", "image/png": ".png",
  "image/webp": ".webp", "image/gif": ".gif",
  "video/mp4": ".mp4", "video/webm": ".webm",
};

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function rid(req) { return req.headers["x-request-id"] || "ast-" + Date.now().toString(36); }
function newAssetId() { return "ast_" + crypto.randomBytes(5).toString("hex"); }
function sha256(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }

function safeFilename(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function listWorks() {
  if (!fs.existsSync(WORKS_DIR)) return [];
  return fs.readdirSync(WORKS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(WORKS_DIR, f), "utf8")); } catch { return null; } })
    .filter(Boolean);
}

function worksUsingAsset(assetId) {
  return listWorks().filter(w => (w.assets || []).some(a => a.id === assetId));
}

// ── POST /assets/upload — multipart tai raw body ──────────────
// Body: { filename, mime, data (base64) }
export async function handleAssetUpload(req, res, send, readBody) {
  try {
    ensureDir(ASSETS_DIR);
    var body = await readBody(req, MAX_ASSET_BYTES + 1024);

    var filename = safeFilename(body.filename || "upload");
    var mime     = (body.mime || "").toLowerCase();
    var dataB64  = body.data || "";

    if (!ALLOWED_MIME.has(mime)) {
      return send(res, 400, { ok: false, error: "MIME-tyyppi ei sallittu: " + mime +
        ". Sallitut: " + [...ALLOWED_MIME].join(", ") });
    }

    var buf = Buffer.from(dataB64, "base64");

    if (buf.length > MAX_ASSET_BYTES) {
      return send(res, 400, { ok: false, error: "Asset liian suuri (max " +
        process.env.ALX_MAX_ASSET_SIZE_MB || "20" + " MB)" });
    }

    // Pakota oikea pääte MIME-tyypin mukaan
    var ext  = MIME_EXT[mime] || path.extname(filename) || ".bin";
    var base = path.basename(filename, path.extname(filename));
    var safeName = base + ext;

    var assetId  = newAssetId();
    var assetDir = path.join(ASSETS_DIR, assetId);
    ensureDir(assetDir);
    fs.writeFileSync(path.join(assetDir, safeName), buf);

    var meta = {
      id:        assetId,
      filename:  safeName,
      mime:      mime,
      size:      buf.length,
      sha256:    sha256(buf),
      url:       "/assets/" + assetId + "/" + safeName,
      path:      path.join("vault", "assets", assetId, safeName),
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(assetDir, "meta.json"), JSON.stringify(meta, null, 2));

    return send(res, 200, { ok: true, asset: meta });
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}

// ── GET /assets/:id/:file — hae assetti ─────────────────────
export async function handleAssetGet(req, res, url) {
  try {
    var parts   = url.replace("/assets/", "").split("/");
    var assetId = parts[0];
    var file    = parts[1];

    if (!assetId) return res.writeHead(400) && res.end();

    var assetDir = path.join(ASSETS_DIR, assetId);
    if (!fs.existsSync(assetDir)) {
      res.writeHead(404); return res.end("Asset not found");
    }

    if (!file) {
      // Palauta meta
      var meta = JSON.parse(fs.readFileSync(path.join(assetDir, "meta.json"), "utf8"));
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, asset: meta }));
    }

    // Palauta tiedosto
    var safePath = path.join(assetDir, path.basename(file));
    if (!fs.existsSync(safePath)) {
      res.writeHead(404); return res.end("File not found");
    }

    var ext  = path.extname(file).toLowerCase();
    var mime = {
      ".jpg": "image/jpeg", ".png": "image/png",
      ".webp": "image/webp", ".gif": "image/gif",
      ".mp4": "video/mp4", ".webm": "video/webm",
    }[ext] || "application/octet-stream";

    var buf = fs.readFileSync(safePath);
    res.writeHead(200, {
      "Content-Type":   mime,
      "Content-Length": buf.length,
      "Cache-Control":  "public, max-age=3600",
    });
    return res.end(buf);
  } catch (err) {
    res.writeHead(500); return res.end(err.message);
  }
}

// ── DELETE /assets/:id — poista (ei jos käytössä) ────────────
export async function handleAssetDelete(req, res, send, url, body) {
  try {
    var assetId = url.replace("/assets/", "").split("/")[0];
    var force   = body && body.force === true;

    var assetDir = path.join(ASSETS_DIR, assetId);
    if (!fs.existsSync(assetDir)) {
      return send(res, 404, { ok: false, error: "Asset ei löydy: " + assetId });
    }

    // Tarkista onko käytössä
    var using = worksUsingAsset(assetId);
    if (using.length > 0 && !force) {
      return send(res, 409, {
        ok:    false,
        error: "Asset on käytössä " + using.length + " työssä. Käytä force:true poistaaksesi.",
        usedBy: using.map(w => ({ id: w.id, title: w.title })),
      });
    }

    fs.rmSync(assetDir, { recursive: true, force: true });
    return send(res, 200, { ok: true, deleted: assetId, forced: force });
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}

// ── GET /assets — listaa kaikki assetit ──────────────────────
export async function handleAssetList(req, res, send) {
  try {
    ensureDir(ASSETS_DIR);
    var dirs   = fs.readdirSync(ASSETS_DIR).filter(d => {
      var full = path.join(ASSETS_DIR, d);
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "meta.json"));
    });
    var assets = dirs.map(d => {
      try { return JSON.parse(fs.readFileSync(path.join(ASSETS_DIR, d, "meta.json"), "utf8")); }
      catch { return null; }
    }).filter(Boolean);

    return send(res, 200, { ok: true, assets, count: assets.length });
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message });
  }
}