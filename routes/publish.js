// routes/publish.js — enterprise v1
//
// POST /publish              → validate → publish → manifest → zip → audit
// GET  /published            → listaa julkaistut (manifest-pohjainen)
// GET  /published/:id/download → turvallinen zip-lataus
//
// Turvarajoitukset:
//   - Lähde sallittu vain .af51-workspaces/ sisältä (v1)
//   - Path traversal esto canonicalize + startsWith
//   - Download vain published/-kansion sisältä
//   - Virheviestit eivät paljasta absoluuttisia polkuja
//   - requestId jokaisessa vastauksessa

import path from "path";
import fs   from "fs";
import { publishWorkspace, listPublished } from "../services/publishService.js";

var WORKSPACE_ROOT = path.resolve(process.cwd(), ".af51-workspaces");
var PUBLISHED_ROOT = path.resolve(process.cwd(), "published");
var MAX_NAME_LEN   = 80;

// ── Turvafunktiot ─────────────────────────────────────────────────────────────

function safeId(raw) {
  if (!raw || typeof raw !== "string") return null;
  // Salli vain: kirjaimet, numerot, viiva, alaviiva, piste
  var clean = raw.replace(/[^a-zA-Z0-9\-_.]/g, "");
  return clean.length > 0 && clean.length < 200 ? clean : null;
}

function canonicalize(rawPath) {
  // Palauttaa absoluuttisen, normalisoidun polun
  if (!rawPath || typeof rawPath !== "string") return null;
  try { return path.resolve(rawPath); }
  catch (_) { return null; }
}

function isInsideWorkspaceRoot(absPath) {
  // Varmistaa että polku on .af51-workspaces/ sisällä
  var norm = absPath + path.sep;
  return norm.startsWith(WORKSPACE_ROOT + path.sep) ||
         absPath === WORKSPACE_ROOT;
}

function isInsidePublishedRoot(absPath) {
  var norm = absPath + path.sep;
  return norm.startsWith(PUBLISHED_ROOT + path.sep) ||
         absPath === PUBLISHED_ROOT;
}

function safePath(raw) {
  // Ei paljasta absoluuttisia polkuja vastauksissa
  if (!raw || typeof raw !== "string") return "—";
  return ".../" + path.basename(raw);
}


function normalizeSourceText(text) {
  return String(text || "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/[\u2028\u2029]/g, "\n");
}

function isBuildStatusText(text) {
  var src = normalizeSourceText(text).trim();
  return (
    src.startsWith("Build valmis!") ||
    src.includes("Katso Preview Roomista") ||
    src.includes("Build ID:") ||
    src.includes("Koodia:")
  );
}

function sanitizeReactSource(text) {
  var src = normalizeSourceText(text).trim();
  src = src.replace(/^\s*build\s+(?=import\s+)/i, "");
  src = src.replace(/^\s*build\s+(?=function\s+App\s*\()/i, "");
  src = src.replace(/^\s*build\s+(?=export\s+default\s+function\s+App\s*\()/i, "");
  return src.trim();
}

function isReactAppSource(text) {
  var src = sanitizeReactSource(text);
  if (!src) return false;
  if (isBuildStatusText(src)) return false;
  return (
    src.includes("function App(") ||
    src.includes("function App()") ||
    src.includes("export default function App")
  );
}

function validateWorkspaceSourceForPublish(workspaceDir) {
  var candidates = [
    path.join(workspaceDir, "src", "App.jsx"),
    path.join(workspaceDir, "App.jsx"),
    path.join(workspaceDir, "App.js")
  ];

  var appPath = candidates.find(function(filePath) {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  });

  if (!appPath) {
    return { ok: false, error: "INVALID_SOURCE: missing App file" };
  }

  var source = fs.readFileSync(appPath, "utf8");

  if (!isReactAppSource(source)) {
    return { ok: false, error: "INVALID_SOURCE: App file is not React App source" };
  }

  var cleanSource = sanitizeReactSource(source);

  if (String(cleanSource || "").trim().length < 500) {
    return { ok: false, error: "INVALID_SOURCE: App file too short" };
  }

  if (cleanSource !== source) {
    fs.writeFileSync(appPath, cleanSource, "utf8");
  }

  return { ok: true, appPath: appPath };
}

function auditLog(requestId, action, details) {
  var entry = {
    ts:        new Date().toISOString(),
    requestId: requestId || "—",
    action:    action,
    ...details,
  };
  console.log("[PUBLISH AUDIT]", JSON.stringify(entry));
}

function rid(req) {
  return req._requestId || ("pub-" + Date.now().toString(36));
}

// ── POST /publish ─────────────────────────────────────────────────────────────

export async function handlePublish(req, res, send, readBody, ctx) {
  var requestId = rid(req);
  var body = await readBody(req);

  // ── 1. Input validation ───────────────────────────────────────────────────
  if (!body.workspacePath && !body.workspaceDir) {
    auditLog(requestId, "PUBLISH_REJECTED", { reason: "missing_workspace_path" });
    return send(res, 400, {
      ok: false, requestId,
      error: "workspacePath puuttuu",
      code:  "MISSING_INPUT"
    });
  }

  var rawPath = body.workspacePath || body.workspaceDir;

  if (typeof rawPath !== "string" || rawPath.length > 500) {
    auditLog(requestId, "PUBLISH_REJECTED", { reason: "invalid_path_type" });
    return send(res, 400, {
      ok: false, requestId,
      error: "workspacePath on virheellinen",
      code:  "INVALID_INPUT"
    });
  }

  var projectName = body.projectName || body.name || null;
  if (projectName && (typeof projectName !== "string" || projectName.length > MAX_NAME_LEN)) {
    return send(res, 400, {
      ok: false, requestId,
      error: "projectName liian pitkä tai virheellinen",
      code:  "INVALID_NAME"
    });
  }

  // ── 2. Path canonicalize + traversal check ────────────────────────────────
  var absPath = canonicalize(rawPath);
  if (!absPath) {
    auditLog(requestId, "PUBLISH_REJECTED", { reason: "path_canonicalize_failed" });
    return send(res, 400, {
      ok: false, requestId,
      error: "Polun käsittely epäonnistui",
      code:  "INVALID_PATH"
    });
  }

  // V1: Lähde vain .af51-workspaces/ sisältä
  if (!isInsideWorkspaceRoot(absPath)) {
    auditLog(requestId, "PUBLISH_REJECTED", {
      reason:  "path_outside_workspace_root",
      display: safePath(absPath),
    });
    return send(res, 403, {
      ok: false, requestId,
      error: "Lähde sallittu vain .af51-workspaces/-kansion sisältä",
      code:  "PATH_NOT_ALLOWED"
    });
  }

  // ── 3. Workspace exists ───────────────────────────────────────────────────
  if (!fs.existsSync(absPath)) {
    auditLog(requestId, "PUBLISH_REJECTED", {
      reason:  "workspace_not_found",
      display: safePath(absPath),
    });
    return send(res, 404, {
      ok: false, requestId,
      error: "Workspace-kansiota ei löydy",
      code:  "WORKSPACE_NOT_FOUND"
    });
  }

  var stat = fs.statSync(absPath);
  if (!stat.isDirectory()) {
    return send(res, 400, {
      ok: false, requestId,
      error: "Workspace ei ole kansio",
      code:  "NOT_A_DIRECTORY"
    });
  }

  // ── 4. Source validation — publish ei saa pakata statusviestiä ───────────
  var sourceValidation = validateWorkspaceSourceForPublish(absPath);
  if (!sourceValidation.ok) {
    auditLog(requestId, "PUBLISH_REJECTED", {
      reason: "invalid_source",
      error:  sourceValidation.error,
      workspace: safePath(absPath),
    });
    return send(res, 400, {
      ok: false, requestId,
      error: sourceValidation.error,
      code:  "INVALID_SOURCE"
    });
  }

  // ── 5. Ei jo julkaistu (tarkista manifest) — optional, skip v1 ───────────
  // V1 sallii republish

  auditLog(requestId, "PUBLISH_START", {
    workspace: safePath(absPath),
    project:   projectName || "(auto)",
    buildId:   body.buildId || null,
  });

  // ── 5. Publish ───────────────────────────────────────────────────────────
  var result;
  try {
    result = await publishWorkspace({
      workspacePath:  absPath,
      projectName:    projectName,
      buildId:        body.buildId    || null,
      entryFile:      body.entryFile  || null,
      fileCount:      body.fileCount  || null,
      buildTimeMs:    body.buildTimeMs || null,
      workId:         body.workId     || null,
    });
  } catch (err) {
    auditLog(requestId, "PUBLISH_ERROR", {
      error: err.message,
      workspace: safePath(absPath),
    });
    var details = err && err.exportQa ? {
      exportQaErrors: err.exportQa.errors || [],
      buildOutput: err.exportQa.buildOutput || null,
      installOutput: err.exportQa.installOutput || null
    } : null;
    return send(res, 500, {
      ok: false, requestId,
      error: err && err.message ? err.message : "Publish epäonnistui",
      code:  "PUBLISH_FAILED",
      details: details
    });
  }

  // ── 6. Audit log ─────────────────────────────────────────────────────────
  auditLog(requestId, "PUBLISH_OK", {
    publishId:  result.publishId,
    fileCount:  result.manifest.fileCount,
    sha256:     result.manifest.sha256,
    zipOk:      result.zipOk,
    zipSize:    result.zipSize,
  });

  // ── 7. Structured response — polut suhteellisina ─────────────────────────
  return send(res, 200, {
    ok:        true,
    requestId: requestId,
    publishId: result.publishId,
    status:    "PUBLISHED",

    // Käyttäjälle näytettävät polut suhteellisina
    publishDir:  path.relative(process.cwd(), result.publishDir),
    zipPath:     result.zipOk
      ? path.relative(process.cwd(), result.zipPath)
      : null,
    zipSize:     result.zipSize || null,

    manifest: {
      af51_version:    result.manifest.af51_version,
      publishId:       result.manifest.publishId,
      projectName:     result.manifest.projectName,
      buildId:         result.manifest.buildId,
      publishedAt:     result.manifest.publishedAt,
      entryFile:       result.manifest.entryFile,
      fileCount:       result.manifest.fileCount,
      sourceFileCount: result.manifest.sourceFileCount || null,
      sha256:          result.manifest.sha256,
      status:          result.manifest.status,
      standalone:      result.manifest.standalone,
    },

    runInstructions: result.manifest.runInstructions,
    previewUrl:      result.manifest.previewUrl,

    // Download-linkki
    downloadUrl: "/published/" + result.publishId + "/download",
  });
}

// ── GET /published ────────────────────────────────────────────────────────────

export async function handlePublishedList(req, res, send) {
  var requestId = rid(req);
  try {
    var list = await listPublished(PUBLISHED_ROOT);
    // Poista absoluuttiset polut vastauksesta
    var safe = list.map(function(m) {
      return {
        publishId:   m.publishId,
        projectName: m.projectName,
        status:      m.status,
        publishedAt: m.publishedAt,
        fileCount:   m.fileCount,
        sha256:      m.sha256,
        buildId:     m.buildId,
        af51_version: m.af51_version,
        downloadUrl: "/published/" + m.publishId + "/download",
      };
    });
    return send(res, 200, { ok: true, requestId, count: safe.length, published: safe });
  } catch (err) {
    return send(res, 500, { ok: false, requestId, error: "Listaus epäonnistui", code: "LIST_ERROR" });
  }
}

// ── GET /published/:id/download ───────────────────────────────────────────────

export async function handlePublishedDownload(req, res, url) {
  // Parseoidaan publishId URL:sta: /published/<id>/download
  var parts    = url.split("/");
  var rawId    = parts[2] || "";
  var safeId_  = safeId(rawId);

  if (!safeId_) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Virheellinen publish ID", code: "INVALID_ID" }));
    return;
  }

  // Etsi zip PUBLISHED_ROOT:sta — vain tiedostot joissa on tämä publishId
  var zipPath = null;
  try {
    var entries = fs.readdirSync(PUBLISHED_ROOT, { withFileTypes: true });
    for (var e of entries) {
      if (!e.isDirectory()) continue;
      var mp = path.join(PUBLISHED_ROOT, e.name, "MANIFEST.json");
      if (!fs.existsSync(mp)) continue;
      try {
        var m = JSON.parse(fs.readFileSync(mp, "utf8"));
        if (m.publishId === safeId_) {
          var candidate = path.join(PUBLISHED_ROOT, e.name + ".zip");
          if (fs.existsSync(candidate)) zipPath = candidate;
          break;
        }
      } catch (_) {}
    }
  } catch (_) {}

  if (!zipPath) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Zip ei löydy", code: "ZIP_NOT_FOUND" }));
    return;
  }

  // Traversal-tarkistus — zip pitää olla PUBLISHED_ROOT:n sisällä
  var absZip = path.resolve(zipPath);
  if (!isInsidePublishedRoot(absZip)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Kielletty", code: "FORBIDDEN" }));
    return;
  }

  var zipName  = path.basename(absZip);
  var zipStat  = fs.statSync(absZip);
  res.writeHead(200, {
    "Content-Type":        "application/zip",
    "Content-Disposition": "attachment; filename=\"" + zipName + "\"",
    "Content-Length":      zipStat.size,
  });
  fs.createReadStream(absZip).pipe(res);
}