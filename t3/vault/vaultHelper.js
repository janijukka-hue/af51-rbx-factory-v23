// t3/vault/vaultHelper.js — ALX Vault v2.0 (v12)
// Muutokset v2.0:
// - Kaikki I/O async (fs.promises)
// - vault/index.json nopea hakemisto
// - SHA-256 checksumit source + preview
// - generateBuildId() yksi viitepiste

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes, createHash } from "crypto";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = process.env.ALX_VAULT_ROOT ||
  path.resolve(__dirname, "../../vault");

const INDEX_PATH      = path.join(VAULT_ROOT, "index.json");
const MAX_SOURCE_BYTES  = 500 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 200 * 1024 * 1024;

// ── Apufunktiot ───────────────────────────────────────────────────────────────

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function buildDir(buildId) {
  return path.join(VAULT_ROOT, "builds", buildId);
}

function artifactDir(artifactId) {
  return path.join(VAULT_ROOT, "artifacts", artifactId);
}

function sha256(str) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

async function readSafe(filePath) {
  try { return await fs.promises.readFile(filePath, "utf8"); }
  catch { return null; }
}

// ── Index ─────────────────────────────────────────────────────────────────────

async function loadIndex() {
  try {
    var data = await fs.promises.readFile(INDEX_PATH, "utf8");
    return JSON.parse(data);
  } catch { return {}; }
}

async function updateIndex(meta) {
  await ensureDir(VAULT_ROOT);
  var index = await loadIndex();
  index[meta.buildId] = {
    buildId:      meta.buildId,
    projectName:  meta.projectName,
    status:       meta.status,
    createdAt:    meta.createdAt,
    buildMode:    meta.buildMode,
    sourceOrigin: meta.sourceOrigin,
    target:       meta.target,
    sizeChars:    meta.sizeChars,
  };
  await fs.promises.writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf8");
}

// ── Pääfunktiot ───────────────────────────────────────────────────────────────

export function generateBuildId() {
  return "build_" + Date.now() + "_" + randomBytes(2).toString("hex");
}

export async function saveBuild({
  buildId, artifactId, projectName, language,
  source, preview, log, status = "success",
  buildMode, target, sourceOrigin
}) {
  if (!buildId)                                    throw new Error("saveBuild: buildId puuttuu");
  if (typeof buildId !== "string" || !buildId.trim()) throw new Error("saveBuild: buildId tyhjä");

  projectName  = projectName  || "unknown";
  language     = language     || "jsx";
  buildMode    = buildMode    || "template";
  sourceOrigin = sourceOrigin || "template";

  // File size guardit
  if (source  && Buffer.byteLength(source,  "utf8") > MAX_SOURCE_BYTES)
    throw new Error("source liian suuri vaultille (max 500KB)");
  if (preview && Buffer.byteLength(preview, "utf8") > MAX_PREVIEW_BYTES)
    throw new Error("preview liian suuri vaultille (max 200KB)");

  var dir = buildDir(buildId);
  await ensureDir(dir);

  if (source)  await fs.promises.writeFile(path.join(dir, "source.jsx"),   source,  "utf8");
  if (preview) await fs.promises.writeFile(path.join(dir, "preview.html"), preview, "utf8");

  var logLine = log
    ? "[" + new Date().toISOString() + "] " + log + "\n"
    : "[" + new Date().toISOString() + "] Build " + buildId + " — " + status + "\n";
  await fs.promises.appendFile(path.join(dir, "log.txt"), logLine, "utf8");

  if (artifactId) {
    var aDir = artifactDir(artifactId);
    await ensureDir(aDir);
    await fs.promises.writeFile(
      path.join(aDir, "meta.json"),
      JSON.stringify({ artifactId, buildId, type: "jsx-preview", createdAt: new Date().toISOString(), status: "ready" }, null, 2),
      "utf8"
    );
  }

  // meta viimeisenä — olemassaolo = build valmis
  var meta = {
    buildId,
    projectName,
    createdAt:    new Date().toISOString(),
    status,
    language,
    buildMode,
    target:       target       || null,
    sourceOrigin: sourceOrigin || null,
    fileCount:    1,
    sourceFile:   source  ? "source.jsx"   : null,
    previewFile:  preview ? "preview.html" : null,
    logFile:      "log.txt",
    artifactId:   artifactId || null,
    sizeChars:    source ? source.length : 0,
    checksums: {
      source:  source  ? sha256(source)  : null,
      preview: preview ? sha256(preview) : null,
    },
  };
  await fs.promises.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");

  // Päivitä index
  await updateIndex(meta);

  return { ok: true, path: dir, meta };
}

export async function loadBuildMeta(buildId) {
  if (!buildId) return null;
  var p = path.join(buildDir(buildId), "meta.json");
  try {
    var data = await fs.promises.readFile(p, "utf8");
    return JSON.parse(data);
  } catch { return null; }
}

export async function loadBuildFull(buildId) {
  var meta = await loadBuildMeta(buildId);
  if (!meta) return null;
  var dir     = buildDir(buildId);
  var source  = meta.sourceFile  ? await readSafe(path.join(dir, meta.sourceFile))  : null;
  var preview = meta.previewFile ? await readSafe(path.join(dir, meta.previewFile)) : null;
  var log     = meta.logFile     ? await readSafe(path.join(dir, meta.logFile))     : null;
  return { meta, source, preview, log };
}

export async function listBuilds() {
  // Käytä indexiä jos olemassa — muuten fallback readdirSync
  try {
    var index = await loadIndex();
    var builds = Object.values(index);
    if (builds.length > 0) {
      return builds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  } catch { /* fallback alla */ }

  // Fallback: skannaa hakemisto
  var dir = path.join(VAULT_ROOT, "builds");
  ensureDirSync(dir);
  var ids = fs.readdirSync(dir)
    .filter(id => fs.existsSync(path.join(dir, id, "meta.json")));
  var metas = await Promise.all(ids.map(id => loadBuildMeta(id)));
  return metas.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function appendSystemLog(message) {
  var logsDir = path.join(VAULT_ROOT, "logs");
  await ensureDir(logsDir);
  await fs.promises.appendFile(
    path.join(logsDir, "system.log"),
    "[" + new Date().toISOString() + "] " + message + "\n",
    "utf8"
  );
}

export function getVaultRoot() {
  return VAULT_ROOT;
}