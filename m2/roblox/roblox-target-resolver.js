// m2/roblox/roblox-target-resolver.js — ESM
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const REQUIRED_FIELDS = ['id', 'type', 'version', 'gameName', 'hierarchy', 'runtime'];
const VALID_TYPES     = ['obby', 'tycoon', 'simulator', 'rpg', 'fps'];

function _validate(target, filename) {
  const issues = [];
  for (const f of REQUIRED_FIELDS) {
    if (!target[f] && target[f] !== 0) issues.push(`Missing field: "${f}"`);
  }
  if (target.type && !VALID_TYPES.includes(target.type))
    issues.push(`Unknown type: "${target.type}". Valid: ${VALID_TYPES.join(', ')}`);
  if (target.id && filename && path.basename(filename) !== `${target.id}.target.json`)
    issues.push(`ID "${target.id}" does not match filename "${path.basename(filename)}"`);
  if (target.runtime && !Array.isArray(target.runtime.modules))
    issues.push('runtime.modules must be an array');
  return issues;
}

export class RobloxTargetResolver {
  static resolve({ targetId, targetsDir, auditLedger }) {
    const errors = [];
    if (!targetId) { errors.push('targetId required'); return { ok: false, target: null, errors }; }
    const p = path.resolve(targetsDir, `${targetId}.target.json`);
    if (!existsSync(p)) { errors.push(`Target not found: ${p}`); return { ok: false, target: null, errors }; }
    let target;
    try { target = JSON.parse(readFileSync(p, 'utf8')); }
    catch (e) { errors.push(`Parse error: ${e.message}`); return { ok: false, target: null, errors }; }
    const issues = _validate(target, p);
    if (issues.length) return { ok: false, target: null, errors: issues };
    auditLedger?.info?.(`[TargetResolver] Resolved '${targetId}' v${target.version}`);
    return { ok: true, target, errors: [] };
  }

  static listTargets(targetsDir) {
    if (!existsSync(targetsDir)) return [];
    return readdirSync(targetsDir)
      .filter(f => f.endsWith('.target.json'))
      .map(f => f.replace('.target.json', ''))
      .filter(id => VALID_TYPES.includes(id))
      .sort();
  }
}

export { VALID_TYPES };