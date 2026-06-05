// t3/roblox-rbx/zip-sterility-validator.js
// AF51-RBX | PHASE 1.2 — ZIP Sterility Validator
// Priority: CRITICAL
//
// Prevents contamination of Roblox-native ZIP with:
//   - node_modules
//   - vite remnants (.vite, vite.config, dist/)
//   - react remnants (jsx, tsx, react-native artifacts)
//   - temp files (.tmp, .DS_Store, Thumbs.db)
//   - old exports (prior build artifacts)
//   - cache artifacts (.cache, __pycache__)
//   - web platform files (index.html, bundle.js, webpack artifacts)
//
// Zero-tolerance. ZIP is blocked if any violation found.

import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

// ── Sterility rules ───────────────────────────────────────────────────────

const BANNED_DIRS = [
  'node_modules',
  '.cache',
  '.vite',
  'dist',
  '__pycache__',
  '.expo',
  '.next',
  '.nuxt',
  'build',          // generic web build output — not our Roblox build
  '.parcel-cache',
  '.webpack',
];

const BANNED_FILE_PATTERNS = [
  // Vite
  /vite\.config\.(js|ts|mjs)$/,
  /vite-env\.d\.ts$/,
  // React / React Native
  /\.(jsx|tsx)$/,
  /metro\.config\.(js|cjs)$/,
  /app\.json$/,           // Expo app.json (not Roblox manifest)
  /babel\.config\.(js|cjs)$/,
  // Webpack / bundlers
  /webpack\.config\.(js|ts)$/,
  /rollup\.config\.(js|ts)$/,
  // Temp / system
  /\.DS_Store$/,
  /Thumbs\.db$/,
  /\.tmp$/,
  /\.temp$/,
  /~$/,
  // Old exports in wrong place
  /AF51-RBX-.*\.zip$/,    // ZIP inside ZIP territory
  // Cache
  /\.cache$/,
  /\.swp$/,               // vim swap
  /\.bak$/,
  // Web artifacts
  /bundle\.js$/,
  /\.chunk\.js$/,
  /service-worker\.js$/,
];

const BANNED_FILE_NAMES = [
  'index.html',
  'index.htm',
  'package-lock.json',   // should not be in Roblox ZIP
  '.env',
  '.env.local',
  '.env.production',
  '.gitignore',
  '.gitattributes',
  'README.md',
  'CHANGELOG.md',
  'tsconfig.json',
  'jsconfig.json',
  '.eslintrc.js',
  '.eslintrc.json',
  '.prettierrc',
  'jest.config.js',
];

// Files that are ALLOWED regardless of pattern (whitelist overrides)
const ALLOWED_JSON_FILES = new Set([
  'default.project.json',
  'manifest.json',
  'package.json',        // Roblox package.json (minimal)
  'network-contract.json',
  'asset-manifest.json',
  'asset-map.json',
  'asset-hashes.json',
  'package-lock.json',   // only if it's our lock, but we filter at build root level
]);

// ── SterilityViolation type ───────────────────────────────────────────────

/**
 * @typedef {object} SterilityViolation
 * @property {string} type   — 'banned_dir' | 'banned_file' | 'banned_pattern'
 * @property {string} path   — relative path of violation
 * @property {string} reason — human-readable explanation
 */

// ── ZipSterilityValidator ─────────────────────────────────────────────────

export class ZipSterilityValidator {

  /**
   * Scan buildRoot for sterility violations.
   * Fail-closed: any violation → ZIP is blocked.
   *
   * @param {string} buildRoot
   * @param {object} [auditLedger]
   * @returns {{ ok: boolean, violations: SterilityViolation[], summary: object }}
   */
  static validate(buildRoot, auditLedger) {
    if (!existsSync(buildRoot)) {
      return {
        ok: false,
        violations: [{ type: 'config', path: buildRoot, reason: 'buildRoot does not exist' }],
        summary: { scanned: 0, violations: 1, clean: false },
      };
    }

    const violations = [];
    let scanned = 0;

    _scan(buildRoot, buildRoot, violations, () => scanned++);

    const ok = violations.length === 0;

    if (auditLedger) {
      auditLedger[ok ? 'info' : 'error']?.(
        `[ZipSterilityValidator] ${ok ? 'Clean' : `${violations.length} violation(s) found`}`,
        { scanned, violations: violations.length }
      );
    }

    return {
      ok,
      violations,
      summary: {
        scanned,
        violations: violations.length,
        clean:      ok,
        checkedAt:  new Date().toISOString(),
      },
    };
  }

  /**
   * Print sterility report to console.
   */
  static print(buildRoot, auditLedger) {
    const { ok, violations, summary } = ZipSterilityValidator.validate(buildRoot, auditLedger);
    
    
    if (ok) {
      
    } else {
      console.error(`  ✗ CONTAMINATED — ${violations.length} violation(s):`);
      for (const v of violations) {
        console.error(`    [${v.type.toUpperCase()}] ${v.path}`);
        console.error(`      → ${v.reason}`);
      }
    }
    
    return { ok, violations, summary };
  }

  /**
   * Returns list of all banned patterns for inspection.
   */
  static getRules() {
    return {
      bannedDirs:     BANNED_DIRS,
      bannedFileNames: BANNED_FILE_NAMES,
      bannedPatterns: BANNED_FILE_PATTERNS.map(p => p.toString()),
    };
  }
}

// ── Recursive scanner ─────────────────────────────────────────────────────

function _scan(root, dir, violations, onEntry) {
  let entries;
  try { entries = readdirSync(dir); }
  catch (_) { return; }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const relPath  = path.relative(root, fullPath);
    onEntry();

    let stat;
    try { stat = statSync(fullPath); }
    catch (_) { continue; }

    if (stat.isDirectory()) {
      // Check banned directory names
      if (BANNED_DIRS.includes(entry)) {
        violations.push({
          type:   'banned_dir',
          path:   relPath,
          reason: `Directory "${entry}" must not be included in Roblox ZIP`,
        });
        continue; // Don't recurse into banned dir
      }
      _scan(root, fullPath, violations, onEntry);
    } else {
      // Check exact banned file names
      if (BANNED_FILE_NAMES.includes(entry)) {
        violations.push({
          type:   'banned_file',
          path:   relPath,
          reason: `File "${entry}" must not be included in Roblox ZIP`,
        });
        continue;
      }

      // Check pattern bans
      for (const pattern of BANNED_FILE_PATTERNS) {
        if (pattern.test(entry)) {
          violations.push({
            type:   'banned_pattern',
            path:   relPath,
            reason: `File matches banned pattern ${pattern} — web/tooling artifact forbidden in Roblox ZIP`,
          });
          break;
        }
      }
    }
  }
}