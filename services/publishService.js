// services/publishService.js — v2.1
// Muutos v2.1: normalizeStructure()
//   App.jsx      → src/App.jsx
//   components/  → src/components/
//   utils/       → src/utils/
// Näin published-appi on suoraan ajettavissa ilman käsin siirtelyä.

import fs            from "fs/promises";
import { existsSync, statSync, readdirSync, readFileSync, mkdirSync } from "fs";
import path          from "path";
import crypto        from "crypto";
import { execFile }  from "child_process";
import { promisify } from "util";

var execFileAsync = promisify(execFile);
var FACTORY_NAME  = "ALX Factory v21 — Segerlandia Research Complex";
var FACTORY_VER   = "v21";
var PRODUCT_EXPORT_VER = "product-export-v7";
var PUBLISHED_ROOT = path.resolve(process.cwd(), "published");

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeSourceText(text) {
  return String(text || "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/[\u2028\u2029]/g, "\n");
}

function safeName(name) {
  return String(name || "alx-app")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "alx-app";
}

async function pathExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function walkFiles(rootDir) {
  var results = [];
  async function walk(cur) {
    var entries = await fs.readdir(cur, { withFileTypes: true });
    for (var e of entries) {
      var full = path.join(cur, e.name);
      var rel  = path.relative(rootDir, full).replaceAll("\\", "/");
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".git") continue;
        await walk(full);
      } else if (e.isFile()) {
        results.push(rel);
      }
    }
  }
  await walk(rootDir);
  return results.sort();
}

async function hashFile(p) {
  var buf = await fs.readFile(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function hashDirectory(rootDir, files) {
  var h = crypto.createHash("sha256");
  for (var f of files) {
    var fh = await hashFile(path.join(rootDir, f));
    h.update(f); h.update(fh);
  }
  return h.digest("hex");
}

function productHashFiles(files) {
  var generated = new Set(["MANIFEST.json", "README.md", "PRODUCT_REPORT.md"]);
  return files.filter(function(f) {
    return !generated.has(f);
  });
}

// ── normalizeStructure — tärkeä v2.1-muutos ──────────────────────────────────
// Siirtää juuressa olevat JSX-tiedostot src/-kansioon
// jotta Vite löytää ne src/main.jsx importista

async function normalizeStructure(dir) {
  var moved = [];
  var srcDir = path.join(dir, "src");

  // Tiedostot jotka siirretään src/:hen jos ne ovat juuressa
  var JSX_FILES = ["App.jsx", "App.tsx"];
  var JSX_DIRS  = ["components", "utils", "hooks", "screens", "lib", "api"];

  await fs.mkdir(srcDir, { recursive: true });

  // 1. Siirrä App.jsx/App.tsx → src/
  for (var fname of JSX_FILES) {
    var rootFile = path.join(dir, fname);
    var srcFile  = path.join(srcDir, fname);
    if (await pathExists(rootFile) && !(await pathExists(srcFile))) {
      await fs.rename(rootFile, srcFile);
      moved.push(fname + " → src/" + fname);
    }
  }

  // 2. Siirrä components/, utils/ jne. → src/components/, src/utils/ jne.
  for (var dname of JSX_DIRS) {
    var rootSubDir = path.join(dir, dname);
    var srcSubDir  = path.join(srcDir, dname);
    if (await pathExists(rootSubDir) && !(await pathExists(srcSubDir))) {
      var stat = await fs.stat(rootSubDir);
      if (stat.isDirectory()) {
        await fs.rename(rootSubDir, srcSubDir);
        moved.push(dname + "/ → src/" + dname + "/");
      }
    }
  }

  return moved;
}


// ── makeProductAppSource / ensureRunnableReactApp — Product Export v4 ───────
// Factoryn preview hyväksyy paljaan `function App()`, mutta standalone Vite-tuote
// tarvitsee ES-moduulin. Tämä muunnos tehdään AINA ennen QA-buildiä ja zipiä.
function makeProductAppSource(source) {
  var code = normalizeSourceText(source).trim();

  // Sama pieni sanitointi kuin save/publish guardissa.
  code = code.replace(/^\s*build\s+(?=import\s+)/i, "");
  code = code.replace(/^\s*build\s+(?=function\s+App\s*\()/i, "");
  code = code.replace(/^\s*build\s+(?=export\s+default\s+function\s+App\s*\()/i, "");
  code = code.trim();

  // React import. Jos App käyttää React.useState tai JSX:ää, importti on pakollinen.
  var hasReactDefaultImport = /import\s+React\b/.test(code);
  var hasAnyReactImport = /from\s+['"]react['"]/.test(code);
  var usesReactNamespace = /\bReact\s*\./.test(code);
  var usesJsx = /<[A-Za-z][\s\S]*>/.test(code);

  if ((usesReactNamespace || usesJsx) && !hasReactDefaultImport) {
    // Named-import ei riitä, jos koodi käyttää React.useState -namespacea.
    code = 'import React from "react";\n\n' + code;
  }  // Default export. Vite main.jsx tekee `import App from "./App.jsx"`.
  var hasDefaultExport = /export\s+default\b/.test(code);
  var hasFunctionApp = /function\s+App\s*\(/.test(code);
  var hasConstApp = /(?:const|let|var)\s+App\s*=/.test(code);

  if (!hasDefaultExport && (hasFunctionApp || hasConstApp)) {
    code = code.replace(/\s*$/, "\n\nexport default App;\n");
  }

  return code;
}

async function ensureRunnableReactApp(dir) {
  var srcDir = path.join(dir, "src");
  var candidates = [
    path.join(srcDir, "App.jsx"),
    path.join(srcDir, "App.js"),
    path.join(srcDir, "App.tsx")
  ];

  var appPath = candidates.find(function(p) { return existsSync(p); });
  if (!appPath) return { fixed: false, reason: "missing App file" };

  var original = await fs.readFile(appPath, "utf8");
  var code = makeProductAppSource(original);
  var fixed = code !== original;

  // Kirjoita aina takaisin: samalla normalisoituu Unicode + rivinvaihdot.
  await fs.writeFile(appPath, code, "utf8");
  return { fixed: fixed, appFile: path.relative(dir, appPath).replaceAll("\\", "/") };
}

// ── ZIP ───────────────────────────────────────────────────────────────────────

async function zipDirectory(srcDir, zipPath) {
  // Pure JS ZIP writer. Tällä vältetään Windows Compress-Archive -ongelma,
  // jossa zip-entryihin voi tulla backslash-polut (`src\App.jsx`).
  // Tuote-zipissä pitää aina olla POSIX-polut (`src/App.jsx`), jotta se aukeaa
  // oikein Git Bashissa, macOS:ssä, Linuxissa ja CI:ssä.
  try {
    var files = await walkFiles(srcDir);
    var chunks = [];
    var central = [];
    var offset = 0;

    function crc32(buf) {
      if (!crc32.table) {
        var table = new Uint32Array(256);
        for (var i = 0; i < 256; i++) {
          var c = i;
          for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          table[i] = c >>> 0;
        }
        crc32.table = table;
      }
      var crc = 0xFFFFFFFF;
      for (var j = 0; j < buf.length; j++) crc = crc32.table[(crc ^ buf[j]) & 0xFF] ^ (crc >>> 8);
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function dosDateTime(d) {
      var year = Math.max(1980, d.getFullYear());
      var dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
      var dosDate = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
      return { dosTime, dosDate };
    }

    for (var rel of files) {
      var normalized = rel.replaceAll("\\", "/");
      var abs = path.join(srcDir, rel);
      var data = await fs.readFile(abs);
      var name = Buffer.from(normalized, "utf8");
      var crc = crc32(data);
      var dt = dosDateTime(new Date(statSync(abs).mtimeMs));

      var local = Buffer.alloc(30 + name.length);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);      // version needed
      local.writeUInt16LE(0x0800, 6);  // UTF-8 names
      local.writeUInt16LE(0, 8);       // store, no compression
      local.writeUInt16LE(dt.dosTime, 10);
      local.writeUInt16LE(dt.dosDate, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);
      name.copy(local, 30);
      chunks.push(local, data);

      var cdir = Buffer.alloc(46 + name.length);
      cdir.writeUInt32LE(0x02014b50, 0);
      cdir.writeUInt16LE(20, 4);       // version made by
      cdir.writeUInt16LE(20, 6);       // version needed
      cdir.writeUInt16LE(0x0800, 8);   // UTF-8 names
      cdir.writeUInt16LE(0, 10);       // store
      cdir.writeUInt16LE(dt.dosTime, 12);
      cdir.writeUInt16LE(dt.dosDate, 14);
      cdir.writeUInt32LE(crc, 16);
      cdir.writeUInt32LE(data.length, 20);
      cdir.writeUInt32LE(data.length, 24);
      cdir.writeUInt16LE(name.length, 28);
      cdir.writeUInt16LE(0, 30);
      cdir.writeUInt16LE(0, 32);
      cdir.writeUInt16LE(0, 34);
      cdir.writeUInt16LE(0, 36);
      cdir.writeUInt32LE(0, 38);
      cdir.writeUInt32LE(offset, 42);
      name.copy(cdir, 46);
      central.push(cdir);
      offset += local.length + data.length;
    }

    var centralSize = central.reduce(function(n, b) { return n + b.length; }, 0);
    var centralOffset = offset;
    var end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(centralOffset, 16);
    end.writeUInt16LE(0, 20);

    await fs.writeFile(zipPath, Buffer.concat(chunks.concat(central, [end])));
    var stat = statSync(zipPath);
    return { ok: true, size: stat.size };
  } catch (err) {
    console.warn("[publishService] ZIP epäonnistui:", err.message);
    return { ok: false, size: 0, error: err.message };
  }
}

// ── Vite-infrastruktuuri ──────────────────────────────────────────────────────

async function ensureStandalonePackage(dir, appName) {
  var pkgPath = path.join(dir, "package.json");
  var pkg = {};
  try { pkg = JSON.parse(await fs.readFile(pkgPath, "utf8")); } catch (_) {}

  var fixed = false;
  if (!pkg.name)             { pkg.name = appName; fixed = true; }
  if (pkg.type !== "module") { pkg.type = "module"; fixed = true; }

  var needsVite = !pkg.scripts || !pkg.scripts.dev ||
    (pkg.scripts.start && pkg.scripts.start.includes("react-scripts"));
  if (needsVite) {
    pkg.scripts = { dev:"vite", start:"vite", build:"vite build", preview:"vite preview" };
    fixed = true;
  }
  if (!pkg.devDependencies?.vite) {
    pkg.devDependencies = Object.assign(pkg.devDependencies || {}, {
      "vite": "^5.4.2", "@vitejs/plugin-react": "^4.3.1"
    });
    fixed = true;
  }
  if (!pkg.dependencies?.react) {
    pkg.dependencies = Object.assign(pkg.dependencies || {}, {
      "react": "^18.3.1", "react-dom": "^18.3.1"
    });
    fixed = true;
  }
  delete pkg._alxBuild; delete pkg._factoryInternal;
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
  return { fixed };
}

async function ensureViteFiles(dir, appName, entryFile) {
  // vite.config.js
  var cfg = path.join(dir, "vite.config.js");
  if (!(await pathExists(cfg))) {
    await fs.writeFile(cfg,
      "import { defineConfig } from 'vite';\n" +
      "import react from '@vitejs/plugin-react';\n" +
      "export default defineConfig({ plugins: [react()] });\n"
    );
  }

  // index.html — skripti osoittaa aina /src/main.jsx
  var html = path.join(dir, "index.html");
  var ext  = (entryFile || "").endsWith(".tsx") ? "tsx" : "jsx";
  // Kirjoita aina uudelleen — varmistaa oikean src/-polun
  await fs.writeFile(html,
    "<!DOCTYPE html>\n<html lang='fi'>\n<head>\n" +
    "  <meta charset='UTF-8' />\n" +
    "  <meta name='viewport' content='width=device-width,initial-scale=1.0' />\n" +
    "  <title>" + appName + "</title>\n</head>\n<body>\n" +
    "  <div id='root'></div>\n" +
    "  <script type='module' src='/src/main." + ext + "'></script>\n" +
    "</body>\n</html>\n"
  );

  // src/main.jsx — importtaa ./App.jsx (src/-kansiosta)
  var srcDir  = path.join(dir, "src");
  var mainJsx = path.join(srcDir, "main.jsx");
  var mainTsx = path.join(srcDir, "main.tsx");
  await fs.mkdir(srcDir, { recursive: true });

  // Kirjoita aina — varmistaa oikean ./App.jsx polun
  if (!(await pathExists(mainTsx))) {
    await fs.writeFile(mainJsx,
      "import React from 'react';\n" +
      "import ReactDOM from 'react-dom/client';\n" +
      "import App from './App.jsx';\n\n" +
      "ReactDOM.createRoot(document.getElementById('root')).render(\n" +
      "  <React.StrictMode><App /></React.StrictMode>\n);\n"
    );
  }
}

async function writeReadme(dir, manifest) {
  await fs.writeFile(path.join(dir, "README.md"), [
    "# " + manifest.projectName,
    "",
    "Generated by **" + manifest.factory + "**",
    "",
    "| Field | Value |",
    "|-------|-------|",
    "| Publish ID | `" + manifest.publishId + "` |",
    "| Build ID   | `" + (manifest.buildId || "—") + "` |",
    "| Status     | `" + manifest.status + "` |",
    "| Published  | " + manifest.publishedAt + " |",
    "| Source     | `" + manifest.sourceWorkspace + "` |",
    "| SHA-256    | `" + manifest.sha256 + "` |",
    "",
    "## Quick Start — Windows",
    "",
    "Double-click:",
    "",
    "```",
    "start.bat",
    "```",
    "",
    "This installs dependencies if needed, verifies the build, starts Vite, and opens the browser.",
    "",
    "## Manual Start",
    "",
    "```bash",
    "npm install",
    "npm run dev",
    "```",
    "",
    "Opens at: **http://localhost:5173**",
    "",
    "## Structure",
    "",
    "```",
    "src/",
    "  main.jsx      ← entry point",
    "  App.jsx       ← root component",
    "  components/   ← UI components",
    "  utils/        ← utilities",
    "index.html",
    "vite.config.js",
    "package.json",
    "MANIFEST.json",
    "PRODUCT_REPORT.md",
    "start.bat",
    "start-preview.bat",
    "```",
    "",
    "> Engineered Beyond Ordinary — Segerlandia Research Complex 2026",
  ].join("\n"), "utf8");
}



async function writeStartBat(dir, manifest) {
  var title = "AF51 Runtime - " + (manifest.projectName || "Generated Product");
  var lines = [
    "@echo off",
    "setlocal",
    "title " + title.replace(/[&<>|]/g, ""),
    "cd /d \"%~dp0\"",
    "echo.",
    "echo ==========================================",
    "echo   AF51 GENERATED RUNTIME",
    "echo ==========================================",
    "echo.",
    "echo [AF51] Kaynnistetaan tuotetta: " + (manifest.projectName || "alx-app"),
    "echo [AF51] Publish ID: " + (manifest.publishId || "unknown"),
    "echo.",
    "where node >nul 2>nul",
    "if errorlevel 1 (",
    "  echo [VIRHE] Node.js ei loytynyt.",
    "  echo Asenna Node.js: https://nodejs.org",
    "  pause",
    "  exit /b 1",
    ")",
    "where npm >nul 2>nul",
    "if errorlevel 1 (",
    "  echo [VIRHE] npm ei loytynyt.",
    "  echo Node.js-asennus sisaltaa npm:n. Asenna Node.js uudelleen: https://nodejs.org",
    "  pause",
    "  exit /b 1",
    ")",
    "if not exist package.json (",
    "  echo [VIRHE] package.json puuttuu. Pura zip ensin normaaliksi kansioksi.",
    "  pause",
    "  exit /b 1",
    ")",
    "if not exist node_modules (",
    "  echo [AF51] Asennetaan riippuvuudet...",
    "  call npm install",
    "  if errorlevel 1 (",
    "    echo [VIRHE] npm install epaonnistui.",
    "    pause",
    "    exit /b 1",
    "  )",
    ") else (",
    "  echo [AF51] Moduulit OK.",
    ")",
    "if not exist dist (",
    "  echo [AF51] Buildataan tuotepaketti...",
    "  call npm run build",
    "  if errorlevel 1 (",
    "    echo [VIRHE] npm run build epaonnistui.",
    "    pause",
    "    exit /b 1",
    "  )",
    ") else (",
    "  echo [AF51] dist/ loytyy.",
    ")",
    "echo.",
    "echo [AF51] Avataan selain: http://localhost:5173",
    "start \"\" http://localhost:5173",
    "echo [AF51] Runtime kaynnistyy. Sulje tama ikkuna lopettaaksesi.",
    "echo.",
    "call npm run dev",
    "pause",
    "endlocal"
  ];
  await fs.writeFile(path.join(dir, "start.bat"), lines.join("\r\n") + "\r\n", "utf8");
}

async function writeStartPreviewBat(dir, manifest) {
  var lines = [
    "@echo off",
    "setlocal",
    "title AF51 Runtime Preview",
    "cd /d \"%~dp0\"",
    "echo [AF51] Kaynnistetaan production preview...",
    "where node >nul 2>nul",
    "if errorlevel 1 ( echo [VIRHE] Node.js ei loytynyt. & pause & exit /b 1 )",
    "where npm >nul 2>nul",
    "if errorlevel 1 ( echo [VIRHE] npm ei loytynyt. & pause & exit /b 1 )",
    "if not exist node_modules call npm install",
    "if not exist dist call npm run build",
    "start \"\" http://localhost:4173",
    "call npm run preview",
    "pause",
    "endlocal"
  ];
  await fs.writeFile(path.join(dir, "start-preview.bat"), lines.join("\r\n") + "\r\n", "utf8");
}


async function writeProductReport(dir, manifest) {
  var qa = manifest.exportQa || {};
  await fs.writeFile(path.join(dir, "PRODUCT_REPORT.md"), [
    "# AF51 Product Report",
    "",
    "## What this is",
    "This package is a standalone React/Vite product exported by AF51 Factory.",
    "It is intended to run outside AF51 on a normal developer machine.",
    "",
    "## How to run",
    "",
    "Windows one-click:",
    "",
    "```",
    "start.bat",
    "```",
    "",
    "Manual:",
    "",
    "```bash",
    "npm install",
    "npm run dev",
    "```",
    "",
    "Open: http://localhost:5173",
    "",
    "## Build check",
    "",
    "```bash",
    "npm run build",
    "```",
    "",
    "## Export QA",
    "",
    "| Check | Result |",
    "|-------|--------|",
    "| Required files | `" + (qa.requiredFilesOk ? "PASS" : "FAIL") + "` |",
    "| React source clean | `" + (qa.sourceClean ? "PASS" : "FAIL") + "` |",
    "| Package scripts | `" + (qa.packageScriptsOk ? "PASS" : "FAIL") + "` |",
    "| npm install | `" + (qa.npmInstallOk ? "PASS" : "SKIPPED/FAIL") + "` |",
    "| npm run build | `" + (qa.buildOk ? "PASS" : "SKIPPED/FAIL") + "` |",
    "",
    "## Manifest",
    "",
    "- Publish ID: `" + manifest.publishId + "`",
    "- Build ID: `" + (manifest.buildId || "—") + "`",
    "- Source hash: `" + (manifest.sourceHash || "—") + "`",
    "- Product hash: `" + manifest.sha256 + "`",
    "- File count: `" + manifest.fileCount + "`",
    "",
    "## Files",
    "",
    "- `package.json`",
    "- `index.html`",
    "- `vite.config.js`",
    "- `src/main.jsx`",
    "- `src/App.jsx`",
    "- `README.md`",
    "- `MANIFEST.json`",
    "- `PRODUCT_REPORT.md`",
    "- `start.bat`",
    "- `start-preview.bat`",
    "",
    "Generated by AF51 Factory Product Export v7 with one-click Windows runtime start scripts, React module export hardening and Windows shell QA runner fix.",
  ].join("\n"), "utf8");
}

function readJsonSafe(filePath) {
  try { return JSON.parse(readFileSync(filePath, "utf8")); }
  catch (_) { return null; }
}

function sourceLooksPoisoned(source) {
  var s = normalizeSourceText(source).trim();
  return (
    !s ||
    s.startsWith("Build valmis!") ||
    s.includes("Katso Preview Roomista") ||
    s.includes("Build ID:") ||
    s.includes("Koodia:") ||
    /^build\s+function\s+App\s*\(/i.test(s) ||
    /^build\s+import\s+/i.test(s)
  );
}

function resolveQaCommand(cmd) {
  // Product Export v6:
  // Windowsilla Node execFile/spawn voi antaa ENOENT/EINVAL jos npm ajetaan
  // suoraan. Ajetaan npm shellin kautta, jolloin cmd.exe löytää npm.cmd:n
  // samalla tavalla kuin käyttäjän Git Bash / terminaali.
  return String(cmd || "");
}

async function runCommandForQa(cmd, args, cwd) {
  var resolvedCmd = resolveQaCommand(cmd);
  var useShell = process.platform === "win32";
  try {
    var result = await execFileAsync(resolvedCmd, args, {
      cwd: cwd,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 5,
      windowsHide: true,
      shell: useShell
    });
    return {
      ok: true,
      command: resolvedCmd,
      shell: useShell,
      stdout: String(result.stdout || "").slice(-3000),
      stderr: String(result.stderr || "").slice(-3000)
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      command: resolvedCmd,
      shell: useShell,
      code: err.code || null,
      errno: err.errno || null,
      stdout: String(err.stdout || "").slice(-3000),
      stderr: String(err.stderr || "").slice(-3000)
    };
  }
}

async function exportQaGate(dir) {
  var required = ["package.json", "index.html", "vite.config.js", "src/main.jsx", "src/App.jsx", "start.bat", "start-preview.bat"];
  var missing = [];
  for (var rel of required) {
    if (!existsSync(path.join(dir, rel))) missing.push(rel);
  }

  var appPath = path.join(dir, "src", "App.jsx");
  var appSource = existsSync(appPath) ? readFileSync(appPath, "utf8") : "";
  var normalizedAppSource = normalizeSourceText(appSource);
  if (appSource && normalizedAppSource !== appSource) {
    await fs.writeFile(appPath, normalizedAppSource, "utf8");
    appSource = normalizedAppSource;
  }
  var sourceClean = !sourceLooksPoisoned(appSource) && /function\s+App\s*\(/.test(appSource);

  var pkg = readJsonSafe(path.join(dir, "package.json"));
  var scripts = pkg && pkg.scripts ? pkg.scripts : {};
  var packageScriptsOk = !!(scripts.dev && scripts.build && String(scripts.dev).includes("vite") && String(scripts.build).includes("vite build"));

  var qa = {
    version: PRODUCT_EXPORT_VER,
    checkedAt: new Date().toISOString(),
    requiredFiles: required,
    missingFiles: missing,
    requiredFilesOk: missing.length === 0,
    sourceClean: sourceClean,
    packageScriptsOk: packageScriptsOk,
    npmInstallOk: false,
    buildOk: false,
    commands: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      preview: "npm run preview"
    },
    errors: []
  };

  if (!qa.requiredFilesOk) qa.errors.push("Missing files: " + missing.join(", "));
  if (!qa.sourceClean) qa.errors.push("src/App.jsx is missing App component or contains poisoned source text");
  if (!qa.packageScriptsOk) qa.errors.push("package.json scripts are missing vite dev/build commands");

  if (qa.errors.length === 0) {
    var install = await runCommandForQa("npm", ["install", "--no-audit", "--no-fund", "--silent"], dir);
    qa.npmInstallOk = install.ok;
    qa.installOutput = install.ok ? "ok" : install;
    if (!install.ok) qa.errors.push("npm install failed: " + install.error);
  }

  if (qa.errors.length === 0) {
    var build = await runCommandForQa("npm", ["run", "build", "--silent"], dir);
    qa.buildOk = build.ok;
    qa.buildOutput = build.ok ? "ok" : build;
    if (!build.ok) qa.errors.push("npm run build failed: " + build.error);
  }

  qa.ok = qa.requiredFilesOk && qa.sourceClean && qa.packageScriptsOk && qa.npmInstallOk && qa.buildOk && qa.errors.length === 0;
  return qa;
}

// ── Pääfunktio ────────────────────────────────────────────────────────────────

export async function publishWorkspace(options = {}) {
  var workspacePath  = options.workspacePath || options.workspaceDir;
  var projectName    = safeName(options.projectName || options.name);
  var buildId        = options.buildId        || null;
  var factoryVersion = options.factoryVersion || FACTORY_VER;
  var factory        = options.factory        || FACTORY_NAME;
  var publishedRoot  = options.publishedRoot  || PUBLISHED_ROOT;

  if (!workspacePath) throw new Error("publishWorkspace: workspacePath puuttuu");

  var absWs = path.resolve(workspacePath);
  if (!(await pathExists(absWs)))
    throw new Error("Workspace ei löydy: " + absWs);

  var wsStat = await fs.stat(absWs);
  if (!wsStat.isDirectory())
    throw new Error("Workspace ei ole kansio: " + absWs);

  var timestamp  = Date.now();
  var publishId  = "pub-" + timestamp;
  var folderName = projectName + "-" + timestamp;
  var publishDir = path.join(publishedRoot, folderName);
  var zipPath    = path.join(publishedRoot, folderName + ".zip");

  try {
    // 1. Kopioi workspace
    await fs.mkdir(publishedRoot, { recursive: true });
    await fs.cp(absWs, publishDir, {
      recursive: true, force: true,
      filter: function(src) {
        var base = path.basename(src);
        return base !== "node_modules" && base !== ".git";
      }
    });

    // 2. NORMALIZE — siirrä App.jsx + kansiot src/:hen
    var moved = await normalizeStructure(publishDir);
    if (moved.length > 0) {
      console.log("[PUBLISH] normalized " + moved.length + " entries into src/");
    }

    // 2b. Tee App.jsx:stä standalone-ajettava ES module.
    var runnableResult = await ensureRunnableReactApp(publishDir);

    // 3. Vite-infrastruktuuri + standalone package.json
    var entryFile = options.entryFile || "App.jsx";
    await ensureViteFiles(publishDir, projectName, entryFile);
    var pkgResult = await ensureStandalonePackage(publishDir, projectName);

    // 3a. One-click Windows runtime launchers. Kirjoitetaan ennen QA:ta,
    // jotta julkaisu todistaa myös distribution-tason.
    await writeStartBat(publishDir, { projectName: projectName, publishId: publishId });
    await writeStartPreviewBat(publishDir, { projectName: projectName, publishId: publishId });

    // 3b. Kopioi work.assets → public/assets/ ENNEN sha256-laskentaa
    // Luetaan assetit vault/works/<workId>.json:sta (attach-asset tallentaa sinne)
    if (options.workId) {
      var WORKS_DIR2 = path.resolve(process.cwd(), "vault", "works");
      var workFile2  = path.join(WORKS_DIR2, options.workId + ".json");
      if (existsSync(workFile2)) {
        try {
          var workArtifact2 = JSON.parse(await fs.readFile(workFile2, "utf8"));
          var wAssets2 = workArtifact2.assets || [];
          if (wAssets2.length > 0) {
            var pubAssetsDir3 = path.join(publishDir, "public", "assets");
            if (!existsSync(pubAssetsDir3)) mkdirSync(pubAssetsDir3, { recursive: true });
            for (var wa2 of wAssets2) {
              var srcAsset3 = path.resolve(process.cwd(), wa2.path || "");
              if (existsSync(srcAsset3)) {
                await fs.copyFile(srcAsset3, path.join(pubAssetsDir3, wa2.filename));
              }
            }
            
          }
        } catch (_ae2) { /* asset-kopio ei kriittinen */ }
      }
    }

    // 4. SHA-256 — lasketaan VASTA kun kaikki tiedostot (myös assetit) ovat paikallaan
    var files  = await walkFiles(publishDir);
    var sourceHash = existsSync(path.join(publishDir, "src", "App.jsx"))
      ? await hashFile(path.join(publishDir, "src", "App.jsx"))
      : null;

    // 4b. Product Export v2 QA — julkaise vain ajettava tuote.
    var exportQa = await exportQaGate(publishDir);
    if (!exportQa.ok) {
      var err = new Error("PRODUCT_EXPORT_QA_FAILED: " + exportQa.errors.join("; "));
      err.exportQa = exportQa;
      throw err;
    }

    var sha256 = await hashDirectory(publishDir, productHashFiles(files));

    // Laske käyttäjän omat projekti-tiedostot (ei metadata)
    var META_FILES = new Set(["MANIFEST.json","README.md","meta.json","state.json",
                               "audit.jsonl","vite.config.js"]);
    var sourceFileCount = files.filter(function(f) {
      var base = f.split("/").pop();
      return !META_FILES.has(base) && !f.startsWith("snapshots/");
    }).length;

    var detectedEntry = files.find(f => f === "src/main.jsx") ||
      files.find(f => f === "index.html") ||
      files.find(f => f.endsWith("App.jsx")) ||
      files[0] || null;

    // 5. MANIFEST.json
    var manifest = {
      af51_version:    factoryVersion,
      publishId:       publishId,
      projectName:     projectName,
      buildId:         buildId,
      sourceWorkspace: absWs,
      sourceHash:      sourceHash,
      exportedAt:      new Date(timestamp).toISOString(),
      publishedAt:     new Date(timestamp).toISOString(),
      entryFile:       detectedEntry,
      fileCount:       files.length,
      sourceFileCount: sourceFileCount,
      files:           files,
      sha256:          sha256,
      factory:         factory,
      status:          "PUBLISHED",
      standalone:      true,
      runInstructions: ["Double-click start.bat on Windows", "npm install", "npm run dev"],
      runCommand:      "npm run dev",
      buildCommand:    "npm run build",
      installCommand:  "npm install",
      previewCommand:  "npm run preview",
      oneClickCommand: "start.bat",
      oneClickPreviewCommand: "start-preview.bat",
      previewUrl:      "http://localhost:5173",
      normalizedFiles: moved,
      runnableFixed:   runnableResult.fixed,
      exportQa:        exportQa,
    };
    await fs.writeFile(
      path.join(publishDir, "MANIFEST.json"),
      JSON.stringify(manifest, null, 2), "utf8"
    );

    // 6. README + PRODUCT_REPORT
    await writeReadme(publishDir, manifest);
    await writeProductReport(publishDir, manifest);

    // 7. Lopullinen SHA-256 (MANIFEST + README mukana)
    files  = await walkFiles(publishDir);
    sha256 = await hashDirectory(publishDir, productHashFiles(files));
    manifest.fileCount = files.length;
    manifest.files     = files;
    manifest.sha256    = sha256;
    await fs.writeFile(
      path.join(publishDir, "MANIFEST.json"),
      JSON.stringify(manifest, null, 2), "utf8"
    );
    await writeProductReport(publishDir, manifest);

    // Final pass: PRODUCT_REPORT changed after final manifest. Recompute once more.
    files = await walkFiles(publishDir);
    sha256 = await hashDirectory(publishDir, productHashFiles(files));
    manifest.fileCount = files.length;
    manifest.files = files;
    manifest.sha256 = sha256;
    await fs.writeFile(path.join(publishDir, "MANIFEST.json"), JSON.stringify(manifest, null, 2), "utf8");
    await writeProductReport(publishDir, manifest);

    // 8. ZIP
    var zipResult = await zipDirectory(publishDir, zipPath);

    return {
      ok:           true,
      publishId:    publishId,
      publishDir:   publishDir,
      zipPath:      zipPath,
      zipOk:        zipResult.ok,
      zipSize:      zipResult.size,
      manifest:     manifest,
      pkgFixed:     pkgResult.fixed,
      normalizedFiles: moved,
      runnableFixed:   runnableResult.fixed,
      exportQa:        exportQa,
    };

  } catch (err) {
    try { await fs.rm(publishDir, { recursive: true, force: true }); } catch (_) {}
    throw err;
  }
}

// ── Listaukset ────────────────────────────────────────────────────────────────

export async function listPublished(publishedRoot) {
  var root = publishedRoot || PUBLISHED_ROOT;
  if (!(await pathExists(root))) return [];
  var entries = await fs.readdir(root, { withFileTypes: true });
  var results = [];
  for (var e of entries) {
    if (!e.isDirectory()) continue;
    var mp = path.join(root, e.name, "MANIFEST.json");
    try {
      results.push(JSON.parse(await fs.readFile(mp, "utf8")));
    } catch (_) {
      results.push({ publishId: e.name, projectName: e.name, status: "UNKNOWN" });
    }
  }
  return results.sort(function(a, b) {
    return (b.publishedAt || "").localeCompare(a.publishedAt || "");
  });
}

export function getZipPath(publishId, publishedRoot) {
  var root = publishedRoot || PUBLISHED_ROOT;
  if (!existsSync(root)) return null;
  var entries = readdirSync(root, { withFileTypes: true });
  for (var e of entries) {
    if (!e.isDirectory()) continue;
    var mp = path.join(root, e.name, "MANIFEST.json");
    try {
      var m = JSON.parse(readFileSync(mp, "utf8"));
      if (m.publishId === publishId) {
        var zip = path.join(root, e.name + ".zip");
        return existsSync(zip) ? zip : null;
      }
    } catch (_) {}
  }
  return null;
}

export default { publishWorkspace, listPublished, getZipPath };