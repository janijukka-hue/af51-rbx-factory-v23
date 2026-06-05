// t3/roblox-rbx/zip-hardener.js — AF51-RBX | T3 Layer — ZIP Hardener
// Assembles the final AF51-RBX-GAME.zip capsule. FORBIDDEN to run if
// PackageValidator.validate() returned ok=false. Output is deterministic.
// Tries archiver (npm) first, then a pure-Node ZIP writer (no system zip),
// keeping the system-zip fallback only as a tertiary safety net.

import { createWriteStream, existsSync, readdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

// ── CRC-32 (IEEE 802.3) — required for ZIP local & central directory headers ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── Roblox-strict whitelist (shared by archiver + pure-Node paths) ────────
const ROBLOX_WHITELIST_PREFIXES = [
  "src/ReplicatedStorage/", "src/ServerScriptService/",
  "src/StarterGui/", "src/StarterPlayer/", "src/Workspace/",
  "ghost/",
];
const ROBLOX_WHITELIST_FILES = new Set([
  "default.project.json", "generatedPreview.json", "signature.json",
  "manifest.json", "production-scenegraph.json", "production-quality-report.json",
  "production-build-hash.json", "production-pipeline-audit.json",
  "AF51.rbxlx",
]);
function _isAllowed(rel) {
  const n = rel.replace(/\\/g, "/");
  if (n.startsWith("node_modules") || n.startsWith(".git") || n.startsWith("exports-rbx")) return false;
  if (n.endsWith(".DS_Store") || n.endsWith("Thumbs.db") || n.endsWith(".gitkeep")) return false;
  if (n === "package.json" || n === "package-lock.json") return false;
  if (n.startsWith("assets/") || n.startsWith("runtime/")) return false;
  if (n.startsWith("packageProfiles/") || n.startsWith("targets/") || n.startsWith("audit")) return false;
  if (ROBLOX_WHITELIST_FILES.has(n)) return true;
  return ROBLOX_WHITELIST_PREFIXES.some(p => n.startsWith(p));
}

function _walkAllowed(buildRoot) {
  const out = [];
  function walk(dir, rel) {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const relPath = (rel ? rel + "/" : "") + name;
      const st = statSync(full);
      if (st.isDirectory()) walk(full, relPath);
      else if (_isAllowed(relPath)) out.push({ full, rel: relPath });
    }
  }
  walk(buildRoot, "");
  return out;
}

// ── Pure-Node ZIP writer (no archiver, no system zip) ─────────────────────
function _createZipPureNode(buildRoot, outputPath) {
  const files = _walkAllowed(buildRoot);
  const chunks = []; let offset = 0; const central = [];
  // MS-DOS timestamp 1980-01-01 00:00:00 — deterministic across runs/machines.
  const DOS_TIME = 0x0000, DOS_DATE = 0x0021;
  for (const f of files) {
    const data = readFileSync(f.full);
    const compressed = deflateRawSync(data, { level: 9 });
    const useStore = compressed.length >= data.length;
    const payload = useStore ? data : compressed;
    const method = useStore ? 0 : 8;
    const crc = crc32(data);
    const nameBuf = Buffer.from(f.rel, "utf8");

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); lfh.writeUInt16LE(20, 4); lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(method, 8); lfh.writeUInt16LE(DOS_TIME, 10); lfh.writeUInt16LE(DOS_DATE, 12);
    lfh.writeUInt32LE(crc, 14); lfh.writeUInt32LE(payload.length, 18);
    lfh.writeUInt32LE(data.length, 22); lfh.writeUInt16LE(nameBuf.length, 26); lfh.writeUInt16LE(0, 28);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); cdh.writeUInt16LE(20, 4); cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8); cdh.writeUInt16LE(method, 10); cdh.writeUInt16LE(DOS_TIME, 12);
    cdh.writeUInt16LE(DOS_DATE, 14); cdh.writeUInt32LE(crc, 16); cdh.writeUInt32LE(payload.length, 20);
    cdh.writeUInt32LE(data.length, 24); cdh.writeUInt16LE(nameBuf.length, 28); cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32); cdh.writeUInt16LE(0, 34); cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38); cdh.writeUInt32LE(offset, 42);

    chunks.push(lfh, nameBuf, payload);
    central.push(Buffer.concat([cdh, nameBuf]));
    offset += lfh.length + nameBuf.length + payload.length;
  }
  const cdStart = offset;
  for (const c of central) { chunks.push(c); offset += c.length; }
  const cdSize = offset - cdStart;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12); eocd.writeUInt32LE(cdStart, 16); eocd.writeUInt16LE(0, 20);
  chunks.push(eocd);

  writeFileSync(outputPath, Buffer.concat(chunks));
  return { size: statSync(outputPath).size, fileCount: files.length };
}

// ── archiver path (preferred when installed) ──────────────────────────────
async function _createZipWithArchiver(buildRoot, outputPath) {
  const archiver = (await import("archiver")).default;
  return new Promise((resolve, reject) => {
    const output  = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve({ size: archive.pointer() }));
    archive.on("error", reject);
    archive.on("warning", (w) => { if (w.code !== "ENOENT") reject(w); });
    archive.pipe(output);
    for (const f of _walkAllowed(buildRoot)) archive.file(f.full, { name: f.rel });
    archive.finalize();
  });
}

// ── System-zip path (tertiary; only kept for parity with v59 behaviour) ──
async function _createZipWithSystemZip(buildRoot, outputPath) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  if (existsSync(outputPath)) (await import("node:fs/promises")).then(m => m.unlink(outputPath));
  const paths = [...ROBLOX_WHITELIST_FILES, ...ROBLOX_WHITELIST_PREFIXES.map(p => p.replace(/\/$/, ""))]
    .filter(p => existsSync(path.join(buildRoot, p)));
  await execFileAsync("zip", ["-r", "-9", outputPath, ...paths], { cwd: buildRoot, maxBuffer: 100 * 1024 * 1024 });
  return { size: statSync(outputPath).size };
}

function _zipFilename(gameName, buildId) {
  const safe = gameName.replace(/[^a-zA-Z0-9-_]/g, "_").toUpperCase();
  return `AF51-RBX-${safe}-${buildId}.zip`;
}

const ZipHardener = {};

ZipHardener.harden = async function({ buildRoot, exportsDir, gameName, buildId, validated, auditLedger, deterministic }) {
  if (!validated) {
    auditLedger?.log?.("ZipHardener.harden.blocked", "CRITICAL", { reason: "not_validated", buildRoot });
    throw new Error("[ZipHardener] ZIP export blocked: validated=false. Run PackageValidator first.");
  }
  if (!buildRoot || !existsSync(buildRoot)) throw new Error(`[ZipHardener] buildRoot not found: ${buildRoot}`);

  await mkdir(exportsDir, { recursive: true });
  const filename   = _zipFilename(gameName, buildId);
  const outputPath = path.join(exportsDir, filename);
  const startTs    = Date.now();
  // Deterministic mode: archiver uses fs mtime for entry timestamps which
  // breaks byte-equality across runs. Only the pure-Node writer is fully
  // deterministic (DOS_TIME=0, DOS_DATE=0x0021 = 1980-01-01).
  const _forcePureNode = deterministic === true || process.env.RBX_DETERMINISTIC_BUILD === '1';
  auditLedger?.log?.("ZipHardener.harden.start", "INFO", { buildRoot, outputPath, gameName, buildId, deterministic: _forcePureNode });

  try {
    let result, via = "archiver";
    if (_forcePureNode) {
      result = _createZipPureNode(buildRoot, outputPath);
      via = "pure-node";
    } else try {
      result = await _createZipWithArchiver(buildRoot, outputPath);
    } catch (archiverErr) {
      // Fall back to a pure-Node ZIP writer — no archiver, no system zip.
      // Catches both "archiver not installed" and runtime archiver failures.
      auditLedger?.log?.("ZipHardener.harden.archiverFallback", "WARN", { archiverError: archiverErr.message });
      try {
        result = _createZipPureNode(buildRoot, outputPath);
        via = "pure-node";
      } catch (pureErr) {
        // Last-ditch tertiary: system zip binary (legacy behaviour).
        auditLedger?.log?.("ZipHardener.harden.pureNodeFallback", "WARN", { pureNodeError: pureErr.message });
        result = await _createZipWithSystemZip(buildRoot, outputPath);
        via = "system-zip";
      }
    }

    const durationMs = Date.now() - startTs;
    auditLedger?.log?.("ZipHardener.harden.complete", "INFO",
      { outputPath, buildId, sizeBytes: result.size, durationMs, via });
    return { ok: true, outputPath, zipPath: outputPath, filename, size: result.size, durationMs, via };
  } catch (err) {
    auditLedger?.log?.("ZipHardener.harden.error", "ERROR", { outputPath, error: err.message });
    return { ok: false, outputPath, zipPath: null, filename, size: 0, error: err.message };
  }
};

ZipHardener.getOutputFilename = function(gameName, buildId) {
  return _zipFilename(gameName, buildId);
};

ZipHardener.inspectZip = async function(zipPath) {
  if (!existsSync(zipPath)) return { ok: false, entries: [], error: "ZIP file not found" };
  const REQUIRED_ENTRIES = [
    "default.project.json", "manifest.json", "signature.json", "generatedPreview.json",
    "src/ReplicatedStorage/Packages/AF51Runtime/EventBus.lua",
    "src/ReplicatedStorage/Packages/AF51Runtime/StateStore.lua",
    "src/ReplicatedStorage/Packages/AF51Runtime/NetworkLayer.lua",
    "src/ReplicatedStorage/Packages/AF51Runtime/RuntimeInit.lua",
    "src/ReplicatedStorage/Remotes/RemoteEvents.lua",
    "src/ReplicatedStorage/Remotes/ValidationGate.lua",
    "src/ServerScriptService/RuntimeInit.server.lua",
    "src/StarterPlayer/StarterPlayerScripts/ClientInit.client.lua",
  ];
  try {
    const yauzl = await import("yauzl").catch(() => null);
    if (yauzl) {
      return new Promise((resolve) => {
        yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
          if (err) { resolve({ ok: false, entries: [], error: err.message }); return; }
          const entries = [];
          zipfile.readEntry();
          zipfile.on("entry", (e) => { entries.push(e.fileName); zipfile.readEntry(); });
          zipfile.on("end", () => {
            const missing = REQUIRED_ENTRIES.filter(r => !entries.includes(r));
            resolve({ ok: missing.length === 0, entries, missing });
          });
          zipfile.on("error", (e) => resolve({ ok: false, entries, error: e.message }));
        });
      });
    }
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { stdout } = await promisify(execFile)("unzip", ["-l", zipPath]);
    const entries = [];
    for (const line of stdout.split("\n")) {
      const m = line.match(/\s+\d+\s+\S+\s+\S+\s+(.+)/);
      if (m) entries.push(m[1].trim());
    }
    const missing = REQUIRED_ENTRIES.filter(r => !entries.includes(r));
    return { ok: missing.length === 0, entries, missing };
  } catch (err) {
    return { ok: false, entries: [], error: err.message };
  }
};

export { ZipHardener };
