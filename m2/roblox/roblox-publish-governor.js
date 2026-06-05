// m2/roblox/roblox-publish-governor.js — ESM
import { existsSync, statSync } from 'node:fs';

const PRE_RULES = [
  { id: 'PRE_001', check: t => !t.id || !t.id.trim() ? { ok: false, reason: 'target.id required' } : { ok: true } },
  { id: 'PRE_002', check: t => !/^[a-z0-9_-]+$/.test(t.id||'') ? { ok: false, reason: `id "${t.id}" invalid chars` } : { ok: true } },
  { id: 'PRE_003', check: t => !/^\d+\.\d+\.\d+/.test(t.version||'') ? { ok: false, reason: `version "${t.version}" not semver` } : { ok: true } },
  { id: 'PRE_004', check: t => !t.gameName || t.gameName.length > 64 ? { ok: false, reason: 'gameName missing or >64 chars' } : { ok: true } },
  {
    id: 'PRE_005',
    check: t => {
      const REQUIRED = ['EventBus','StateStore','AuditRuntime','NetworkLayer'];
      const mods = (t.runtime && t.runtime.modules) || [];
      const missing = REQUIRED.filter(r => !mods.some(m => m === r || m.endsWith('.'+r)));
      return missing.length ? { ok: false, reason: `missing runtime modules: ${missing.join(', ')}` } : { ok: true };
    }
  },
];

const POST_RULES = [
  { id: 'POST_001', check: (t, r) => !r.ok ? { ok: false, reason: `build not ok: ${r.error}` } : { ok: true } },
  {
    id: 'POST_002',
    check: async (t, r) => {
      const p = r.outputZip || r.zipPath;
      if (!p) return { ok: false, reason: 'outputZip missing' };
      if (!existsSync(p)) return { ok: false, reason: `ZIP not found: ${p}` };
      if (statSync(p).size === 0) return { ok: false, reason: 'ZIP empty' };
      return { ok: true };
    }
  },
  { id: 'POST_003', check: (t, r) => !r.buildId ? { ok: false, reason: 'buildId missing' } : { ok: true } },
  { id: 'POST_004', check: (t, r) => { const f = (r.phases||[]).filter(p=>!p.ok); return f.length ? { ok: false, reason: `${f.length} phase(s) failed` } : { ok: true }; } },
  {
    id: 'POST_005',
    check: async (t, r) => {
      const p = r.outputZip || r.zipPath;
      if (!p || !existsSync(p)) return { ok: true };
      const s = statSync(p).size;
      if (s < 1024) return { ok: false, reason: `ZIP too small: ${s}B` };
      if (s > 500*1024*1024) return { ok: false, reason: `ZIP too large: ${s}B` };
      return { ok: true };
    }
  },
];

async function runRules(rules, ...args) {
  const results = []; let allOk = true;
  for (const rule of rules) {
    let r;
    try { r = await rule.check(...args); }
    catch (e) { r = { ok: false, reason: `threw: ${e.message}` }; }
    results.push({ id: rule.id, ok: r.ok, reason: r.reason || null });
    if (!r.ok) allOk = false;
  }
  return { ok: allOk, results };
}

export class RobloxPublishGovernor {
  static async preCheck({ target, auditLedger }) {
    const { ok, results } = await runRules(PRE_RULES, target);
    const failed = results.filter(r => !r.ok);
    auditLedger?.[ok?'info':'error']?.(`[Governor] preCheck ${ok?'passed':'FAILED'}`);
    return { ok, results, error: ok ? undefined : `Pre-check failed: ${failed.map(r=>r.reason).join(' | ')}` };
  }
  static async postCheck({ target, buildResult, auditLedger }) {
    const { ok, results } = await runRules(POST_RULES, target, buildResult);
    const failed = results.filter(r => !r.ok);
    auditLedger?.[ok?'info':'error']?.(`[Governor] postCheck ${ok?'passed':'FAILED'}`);
    return { ok, results, error: ok ? undefined : `Post-check failed: ${failed.map(r=>r.reason).join(' | ')}` };
  }
}