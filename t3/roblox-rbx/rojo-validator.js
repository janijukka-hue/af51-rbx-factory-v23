// t3/roblox-rbx/rojo-validator.js
// AF51-RBX | PHASE 1.1 — Rojo Validation System
// Priority: CRITICAL
//
// Validates:
//   - default.project.json mapping correctness
//   - hierarchy consistency (src/ paths match project tree)
//   - package paths (AF51Runtime present and resolvable)
//   - runtime references (all Luau modules declared)
//
// Rojo 7.x spec compliance only. Fail-closed.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// ── Required Rojo tree nodes ──────────────────────────────────────────────

const REQUIRED_TREE_NODES = [
  'ReplicatedStorage',
  'ServerScriptService',
  'StarterGui',
  'StarterPlayer',
  'Workspace',
];

// Package paths that MUST resolve inside AF51Runtime
const REQUIRED_RUNTIME_PACKAGES = [
  'AuditRuntime',
  'EventBus',
  'StateStore',
  'NetworkLayer',
  'ServiceRegistry',
  'RuntimeInit',
];

// ── RojoValidator ─────────────────────────────────────────────────────────

export class RojoValidator {

  /**
   * Full Rojo project validation.
   *
   * @param {string} buildRoot — root of the assembled build
   * @param {object} [auditLedger]
   * @returns {{ ok: boolean, checks: object[], errors: string[] }}
   */
  static validate(buildRoot, auditLedger) {
    const checks = [];
    const errors = [];

    const _check = (id, name, fn) => {
      let ok = false;
      let issues = [];
      try {
        const result = fn();
        ok     = result.ok;
        issues = result.issues || [];
      } catch (e) {
        issues = [`threw: ${e.message}`];
      }
      checks.push({ id, name, ok, issues });
      if (!ok) errors.push(...issues.map(i => `[${id}] ${i}`));
    };

    // ── CHECK 1: project file exists ────────────────────────────────────
    _check('RJV_001', 'project_file_exists', () => {
      const p = path.join(buildRoot, 'default.project.json');
      return existsSync(p)
        ? { ok: true }
        : { ok: false, issues: ['default.project.json not found'] };
    });

    // ── CHECK 2: project JSON parseable ─────────────────────────────────
    let project = null;
    _check('RJV_002', 'project_json_parseable', () => {
      const p = path.join(buildRoot, 'default.project.json');
      if (!existsSync(p)) return { ok: false, issues: ['project file missing'] };
      try {
        project = JSON.parse(readFileSync(p, 'utf8'));
        return { ok: true };
      } catch (e) {
        return { ok: false, issues: [`JSON parse error: ${e.message}`] };
      }
    });

    // ── CHECK 3: required project fields ────────────────────────────────
    _check('RJV_003', 'project_required_fields', () => {
      if (!project) return { ok: false, issues: ['project not loaded'] };
      const issues = [];
      if (!project.name)              issues.push('missing: name');
      if (!project.tree)              issues.push('missing: tree');
      if (typeof project.name !== 'string') issues.push('name must be string');
      return { ok: issues.length === 0, issues };
    });

    // ── CHECK 4: required Roblox hierarchy nodes in tree ───────────────
    _check('RJV_004', 'hierarchy_nodes_in_tree', () => {
      if (!project?.tree) return { ok: false, issues: ['tree missing'] };
      const issues = REQUIRED_TREE_NODES
        .filter(n => !project.tree[n])
        .map(n => `tree missing node: ${n}`);
      return { ok: issues.length === 0, issues };
    });

    // ── CHECK 5: source paths resolve to actual directories ─────────────
    _check('RJV_005', 'source_paths_resolve', () => {
      if (!project?.tree) return { ok: false, issues: ['tree missing'] };
      const issues = [];

      const _walk = (node, nodeName) => {
        if (!node || typeof node !== 'object') return;
        if (node['$path']) {
          const fullPath = path.join(buildRoot, node['$path']);
          if (!existsSync(fullPath)) {
            issues.push(`$path not found: ${node['$path']} (node: ${nodeName})`);
          }
        }
        for (const [key, val] of Object.entries(node)) {
          if (!key.startsWith('$') && typeof val === 'object' && val !== null) {
            _walk(val, key);
          }
        }
      };

      _walk(project.tree, 'root');
      return { ok: issues.length === 0, issues };
    });

    // ── CHECK 6: AF51Runtime package path present ───────────────────────
    _check('RJV_006', 'af51runtime_package_path', () => {
      const runtimeDir = path.join(
        buildRoot, 'src', 'ReplicatedStorage', 'Packages', 'AF51Runtime'
      );
      return existsSync(runtimeDir)
        ? { ok: true }
        : { ok: false, issues: ['src/ReplicatedStorage/Packages/AF51Runtime/ not found'] };
    });

    // ── CHECK 7: all required runtime modules present ───────────────────
    _check('RJV_007', 'runtime_modules_complete', () => {
      const runtimeDir = path.join(
        buildRoot, 'src', 'ReplicatedStorage', 'Packages', 'AF51Runtime'
      );
      if (!existsSync(runtimeDir)) return { ok: false, issues: ['AF51Runtime dir missing'] };
      const files = readdirSync(runtimeDir).map(f => f.replace('.lua', ''));
      const missing = REQUIRED_RUNTIME_PACKAGES.filter(m => !files.includes(m));
      return {
        ok: missing.length === 0,
        issues: missing.map(m => `missing runtime module: ${m}.lua`),
      };
    });

    // ── CHECK 8: Remotes directory present with required files ──────────
    _check('RJV_008', 'remotes_directory', () => {
      const remotesDir = path.join(buildRoot, 'src', 'ReplicatedStorage', 'Remotes');
      if (!existsSync(remotesDir)) return { ok: false, issues: ['Remotes/ directory missing'] };
      const required = ['RemoteEvents.lua', 'RemoteFunctions.lua', 'ValidationGate.lua'];
      const missing  = required.filter(f => !existsSync(path.join(remotesDir, f)));
      return {
        ok: missing.length === 0,
        issues: missing.map(f => `missing: Remotes/${f}`),
      };
    });

    // ── CHECK 9: ServerScriptService has RuntimeInit ────────────────────
    _check('RJV_009', 'server_runtime_init', () => {
      const p = path.join(buildRoot, 'src', 'ServerScriptService', 'RuntimeInit.server.lua');
      return existsSync(p)
        ? { ok: true }
        : { ok: false, issues: ['ServerScriptService/RuntimeInit.server.lua missing'] };
    });

    // ── CHECK 10: StarterPlayer has ClientInit ───────────────────────────
    _check('RJV_010', 'client_init_present', () => {
      const p = path.join(
        buildRoot, 'src', 'StarterPlayer', 'StarterPlayerScripts', 'ClientInit.client.lua'
      );
      return existsSync(p)
        ? { ok: true }
        : { ok: false, issues: ['StarterPlayer/StarterPlayerScripts/ClientInit.client.lua missing'] };
    });

    const allOk = checks.every(c => c.ok);

    if (auditLedger) {
      const failed = checks.filter(c => !c.ok);
      auditLedger[allOk ? 'info' : 'error']?.(
        `[RojoValidator] ${allOk ? 'All checks passed' : `${failed.length} check(s) failed`}`,
        { checks: checks.length, failed: failed.length }
      );
    }

    return { ok: allOk, checks, errors };
  }

  /**
   * Print results to console.
   */
  static print(buildRoot, auditLedger) {
    const { ok, checks, errors } = RojoValidator.validate(buildRoot, auditLedger);
    
    for (const c of checks) {
      const icon = c.ok ? '✓' : '✗';
      
      if (!c.ok) c.issues.forEach(i => console.error(`       → ${i}`));
    }
    // `}\n`);
    return { ok, checks, errors };
  }
}