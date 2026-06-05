// m2/roblox/roblox-package-manager.js — ESM
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const VALID_PROFILES   = ['development', 'production', 'creator', 'marketplace'];
const REQUIRED_PROFILE = ['id', 'type', 'version', 'optimizations', 'validation', 'export'];

function fnv1a32(s) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

export class RobloxPackageManager {
  static loadProfile({ profileId, profilesDir, auditLedger }) {
    if (!VALID_PROFILES.includes(profileId)) return { ok: false, profile: null, errors: [`Unknown profile: '${profileId}'`] };
    const p = path.resolve(profilesDir, `${profileId}.profile.json`);
    if (!existsSync(p)) return { ok: false, profile: null, errors: [`Profile not found: ${p}`] };
    let profile;
    try { profile = JSON.parse(readFileSync(p, 'utf8')); }
    catch (e) { return { ok: false, profile: null, errors: [`Parse error: ${e.message}`] }; }
    const missing = REQUIRED_PROFILE.filter(f => !(f in profile));
    if (missing.length) return { ok: false, profile: null, errors: missing.map(f => `Missing field: ${f}`) };
    auditLedger?.info?.(`[PM] Loaded profile '${profileId}' v${profile.version}`);
    return { ok: true, profile, errors: [] };
  }

  static resolveDependencies({ target, profile, auditLedger }) {
    const core = [
      'AF51Runtime.AuditRuntime','AF51Runtime.EventBus','AF51Runtime.StateStore',
      'AF51Runtime.NetworkLayer','AF51Runtime.ServiceRegistry'
    ].map(name => ({ id: fnv1a32(`${name}:1.0.0`), name, type: 'runtime', version: '1.0.0' }));
    const extra = (target.runtime?.modules || [])
      .filter(m => !core.some(c => c.name === m))
      .map(name => ({ id: fnv1a32(`${name}:target`), name, type: 'runtime', version: 'target' }));
    const deps = [...core, ...extra];
    auditLedger?.info?.(`[PM] Resolved ${deps.length} deps for '${target.id}'`);
    return { ok: true, deps, errors: [] };
  }

  static writeLock({ buildRoot, target, profile, deps, buildId, auditLedger }) {
    const lock = {
      schemaVersion: '1.0.0', buildId,
      targetId: target.id, targetVersion: target.version,
      profileId: profile.id, profileVersion: profile.version,
      generatedAt: new Date().toISOString(), dependencies: deps,
      integrityHash: fnv1a32(`${buildId}:${target.id}:${profile.id}:${deps.map(d=>d.id).join(',')}`),
    };
    const lockPath = path.join(buildRoot, 'package-lock.json');
    try {
      mkdirSync(path.dirname(lockPath), { recursive: true });
      writeFileSync(lockPath, JSON.stringify(lock, null, 2), 'utf8');
    } catch (e) { return { ok: false, lockPath: null, errors: [e.message] }; }
    auditLedger?.info?.(`[PM] Lock written`);
    return { ok: true, lockPath, errors: [] };
  }

  static manage({ profileId, profilesDir, buildRoot, target, buildId, auditLedger }) {
    const pr = RobloxPackageManager.loadProfile({ profileId, profilesDir, auditLedger });
    if (!pr.ok) return { ok: false, profile: null, deps: [], lockPath: null, errors: pr.errors };
    const dr = RobloxPackageManager.resolveDependencies({ target, profile: pr.profile, auditLedger });
    if (!dr.ok) return { ok: false, profile: pr.profile, deps: [], lockPath: null, errors: dr.errors };
    const lr = RobloxPackageManager.writeLock({ buildRoot, target, profile: pr.profile, deps: dr.deps, buildId, auditLedger });
    return { ok: lr.ok, profile: pr.profile, deps: dr.deps, lockPath: lr.lockPath, errors: lr.errors };
  }

  static listProfiles(profilesDir) {
    if (!existsSync(profilesDir)) return [];
    return readdirSync(profilesDir)
      .filter(f => f.endsWith('.profile.json'))
      .map(f => f.replace('.profile.json', ''))
      .filter(id => VALID_PROFILES.includes(id))
      .sort();
  }
}

export { VALID_PROFILES };