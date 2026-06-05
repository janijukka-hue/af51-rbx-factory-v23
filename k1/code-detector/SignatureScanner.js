// k1/code-detector/SignatureScanner.js
// AF51 Code Type Detection Layer v1.0
// Deterministic scanner for project/runtime signatures.
// Rule: scan project structure and user/source files only. Do not treat AF51 core/docs as user runtime risk.

import fs from "fs";
import path from "path";

const DEFAULT_EXCLUDED_DIRS = new Set([
  "node_modules", ".git", ".expo", ".next", ".cache", "coverage",
  "dist", "build", "published", "vault", "assets"
]);

const INTERNAL_DIRS = new Set([
  "k1", "m2", "t3", "s4", "core", "docs", "scripts", "middleware", "routes", "services", "server"
]);

const TEXT_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".json", ".html", ".css", ".md", ".mjs", ".cjs", ".yml", ".yaml", ".env", ".example"
]);

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return null;
  }
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || base === ".env" || base.endsWith(".env.example");
}

function walk(rootDir, options = {}) {
  const excluded = new Set([...(options.excludedDirs || DEFAULT_EXCLUDED_DIRS)]);
  const maxFiles = Number(options.maxFiles || 1200);
  const results = [];

  try {
    const stat = fs.statSync(rootDir);
    if (stat.isFile()) {
      return [{ abs: rootDir, rel: path.basename(rootDir), name: path.basename(rootDir), ext: path.extname(rootDir).toLowerCase() }];
    }
  } catch (_) {}

  function visit(absDir) {
    if (results.length >= maxFiles) return;
    let entries = [];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) return;
      const abs = path.join(absDir, entry.name);
      const rel = path.relative(rootDir, abs).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (excluded.has(entry.name)) continue;
        visit(abs);
        continue;
      }

      if (!entry.isFile()) continue;
      results.push({ abs, rel, name: entry.name, ext: path.extname(entry.name).toLowerCase() });
    }
  }

  visit(rootDir);
  return results;
}

function readSampleFiles(files, maxBytesPerFile = 160000) {
  return files
    .filter((file) => isTextFile(file.abs))
    .map((file) => {
      try {
        const stat = fs.statSync(file.abs);
        if (stat.size > maxBytesPerFile) return { ...file, text: "", skipped: "too_large", size: stat.size };
        return { ...file, text: fs.readFileSync(file.abs, "utf8"), size: stat.size };
      } catch (_) {
        return { ...file, text: "", skipped: "read_failed", size: 0 };
      }
    });
}

function countByExt(files) {
  const out = {};
  for (const f of files) out[f.ext || "[none]"] = (out[f.ext || "[none]"] || 0) + 1;
  return out;
}

function pathExists(rootDir, relPath) {
  return fs.existsSync(path.join(rootDir, relPath));
}

function hasFile(files, matcher) {
  return files.some((f) => matcher(f.rel, f.name));
}

function userSourceFiles(files) {
  return files.filter((file) => {
    const first = file.rel.split("/")[0];
    if (INTERNAL_DIRS.has(first)) return false;
    if (file.rel.startsWith("src/")) return true;
    if (["App.js", "App.jsx", "index.js", "index.jsx", "main.js", "main.jsx"].includes(file.rel)) return true;
    if (["package.json", "app.json", "index.html", "vite.config.js", "vite.config.mjs", "next.config.js"].includes(file.rel)) return true;
    return false;
  });
}

export function scanProject(rootDir, options = {}) {
  const requestedRoot = path.resolve(rootDir || process.cwd());
  let isSingleFile = false;
  let projectRoot = requestedRoot;
  try {
    const stat = fs.statSync(requestedRoot);
    if (stat.isFile()) {
      isSingleFile = true;
      projectRoot = path.dirname(requestedRoot);
    }
  } catch (_) {}

  const files = walk(requestedRoot, options);
  const textFiles = readSampleFiles(files, options.maxBytesPerFile || 160000);
  const packageJson = !isSingleFile && pathExists(projectRoot, "package.json") ? safeReadJson(path.join(projectRoot, "package.json")) : null;
  const appJson = !isSingleFile && pathExists(projectRoot, "app.json") ? safeReadJson(path.join(projectRoot, "app.json")) : null;

  const sourceScoped = isSingleFile ? textFiles : userSourceFiles(textFiles);
  const joinedSource = sourceScoped.map((f) => `\n/* ${f.rel} */\n${f.text}`).join("\n");

  const signatures = {
    isSingleFile,
    hasPackageJson: !!packageJson,
    hasAppJson: !!appJson,
    hasViteConfig: hasFile(files, (rel) => /^vite\.config\.(js|mjs|ts)$/.test(rel)),
    hasNextConfig: hasFile(files, (rel) => /^next\.config\.(js|mjs|ts)$/.test(rel)),
    hasExpoConfig: !!appJson || hasFile(files, (rel) => rel === "app.config.js" || rel === "app.config.ts"),
    hasIndexHtml: pathExists(projectRoot, "index.html"),
    hasSrcMain: hasFile(files, (rel) => /^src\/main\.(jsx|tsx|js|ts)$/.test(rel)),
    hasSrcApp: hasFile(files, (rel) => /^src\/App\.(jsx|tsx|js|ts)$/.test(rel)),
    hasRootAppJs: pathExists(projectRoot, "App.js") || pathExists(projectRoot, "App.jsx"),
    hasServerJs: pathExists(projectRoot, "server.js"),
    hasExpressImport: /from\s+["']express["']|require\(["']express["']\)/.test(joinedSource),
    hasReactComponent: /function\s+App\s*\(|const\s+App\s*=|export\s+default\s+function\s+App/.test(joinedSource),
    hasReactDom: /react-dom|createRoot\s*\(/.test(joinedSource),
    hasReactNative: /react-native|from\s+["']react-native["']/.test(joinedSource),
    hasExpo: /expo|expo-status-bar/.test(joinedSource),
    hasHtmlCssJs: pathExists(projectRoot, "index.html") && (hasFile(files, (rel) => rel.endsWith(".css")) || hasFile(files, (rel) => rel.endsWith(".js"))),
    hasAF51Factory: pathExists(projectRoot, "server.js") && pathExists(projectRoot, "k1/index.js") && pathExists(projectRoot, "t3/Factory"),
  };

  const deps = Object.assign({}, packageJson?.dependencies || {}, packageJson?.devDependencies || {});
  signatures.dependencies = Object.keys(deps);
  signatures.hasReactDep = !!deps.react;
  signatures.hasReactDomDep = !!deps["react-dom"];
  signatures.hasReactNativeDep = !!deps["react-native"];
  signatures.hasExpoDep = !!deps.expo;
  signatures.hasViteDep = !!deps.vite;
  signatures.hasNextDep = !!deps.next;
  signatures.hasExpressDep = !!deps.express;

  return {
    projectRoot: requestedRoot,
    baseDir: projectRoot,
    files,
    textFiles,
    sourceScopedFiles: sourceScoped,
    packageJson,
    appJson,
    signatures,
    stats: {
      fileCount: files.length,
      textFileCount: textFiles.length,
      sourceScopedTextFileCount: sourceScoped.length,
      byExtension: countByExt(files),
    },
  };
}

export default { scanProject };